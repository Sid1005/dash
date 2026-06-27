"""Receive Dash task/event reminder events and create one-shot Hermes cron jobs.

Run this on the VM, expose it with ngrok/cloudflared, then set Dash env vars:

  HERMES_REMINDER_WEBHOOK_URL=https://your-tunnel.example/dash/reminder
  HERMES_REMINDER_WEBHOOK_SECRET=<same secret as receiver>

The receiver keeps a local SQLite mapping from Dash task/event IDs to Hermes
cron job IDs, so edits and deletes can replace/cancel the existing scheduled job.

Payload shapes accepted on POST /dash/reminder:

  Task upsert:   { "event": "upsert", "task_id": "...", "title": "...", "due_at": "..." }
  Task cancel:   { "event": "cancel", "task_id": "..." }
  Event upsert:  { "event": "upsert", "event_id": "...", "title": "...", "start_at": "2026-06-27T09:30:00+05:30" }
  Event cancel:  { "event": "cancel", "event_id": "..." }

Tasks fire at due_at ("⏰ task - due now!").
Calendar events fire 1 minute before start_at ("⏰ event starts in 1 minute!").
"""

from __future__ import annotations

import json
import os
import re
import sqlite3
import subprocess
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

HOST = os.environ.get("DASH_EVENT_HOST", "127.0.0.1")
PORT = int(os.environ.get("DASH_EVENT_PORT", "8080"))
SECRET = os.environ.get("DASH_EVENT_SECRET", "")
HERMES_HOME = Path(os.environ.get("HERMES_HOME", str(Path.home() / ".hermes")))
SCRIPTS_DIR = HERMES_HOME / "scripts"
STATE_DB = Path(os.environ.get("DASH_EVENT_STATE_DB", str(HERMES_HOME / "dash_reminders.sqlite3")))
HERMES_BIN = os.environ.get("HERMES_BIN", "hermes")
DELIVER_TARGET = os.environ.get("DASH_EVENT_DELIVER", "telegram")


def init_db() -> None:
    STATE_DB.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(STATE_DB) as conn:
        conn.execute(
            """
            create table if not exists reminders (
              task_id text primary key,
              job_id text not null,
              script_name text not null,
              due_at text not null,
              payload_json text not null,
              updated_at text not null
            )
            """
        )
        conn.execute(
            """
            create table if not exists event_reminders (
              event_id text primary key,
              job_id text not null,
              script_name text not null,
              start_at text not null,
              payload_json text not null,
              updated_at text not null
            )
            """
        )


def run_command(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, text=True, capture_output=True, check=False)


def parse_job_id(output: str) -> str:
    match = re.search(r"Created job:\s*([A-Za-z0-9_-]+)", output)
    if not match:
        raise RuntimeError(f"Could not parse Hermes job ID from output: {output!r}")
    return match.group(1)


def safe_task_fragment(task_id: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9_.-]+", "_", task_id).strip("._-")
    return safe[:80] or "task"


# ── Tasks ─────────────────────────────────────────────────────────────────────

def make_task_message(title: str) -> str:
    clean_title = " ".join(str(title).split()).strip() or "Untitled task"
    return f"⏰ {clean_title} - due now!"


def create_task_script(task_id: str, title: str) -> str:
    SCRIPTS_DIR.mkdir(parents=True, exist_ok=True)
    script_name = f"dash_task_{safe_task_fragment(task_id)}.py"
    script_path = SCRIPTS_DIR / script_name
    message_json = json.dumps(make_task_message(title), ensure_ascii=True)
    script_path.write_text(
        "#!/usr/bin/env python3\n"
        f"MESSAGE = {message_json}\n"
        "print(MESSAGE)\n",
        encoding="utf-8",
    )
    script_path.chmod(0o700)
    return script_name


def remove_script(script_name: str | None) -> None:
    if not script_name:
        return
    try:
        (SCRIPTS_DIR / script_name).unlink()
    except FileNotFoundError:
        pass


def cancel_task_existing(task_id: str) -> None:
    with sqlite3.connect(STATE_DB) as conn:
        row = conn.execute(
            "select job_id, script_name from reminders where task_id = ?",
            (task_id,),
        ).fetchone()
        if not row:
            return
        job_id, script_name = row
        result = run_command([HERMES_BIN, "cron", "remove", str(job_id)])
        if result.returncode != 0 and "not found" not in (result.stderr + result.stdout).lower():
            raise RuntimeError(result.stderr or result.stdout)
        remove_script(script_name)
        conn.execute("delete from reminders where task_id = ?", (task_id,))


def validate_due_at(due_at: str) -> str:
    parsed = datetime.fromisoformat(due_at.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    if parsed <= datetime.now(timezone.utc):
        raise ValueError("due_at must be in the future")
    return parsed.isoformat()


def upsert_reminder(payload: dict[str, Any]) -> dict[str, Any]:
    task_id = str(payload.get("task_id") or "").strip()
    title = str(payload.get("title") or "").strip()
    due_at = str(payload.get("due_at") or "").strip()
    if not task_id or not title or not due_at:
        raise ValueError("upsert requires task_id, title, and due_at")

    normalized_due_at = validate_due_at(due_at)
    cancel_task_existing(task_id)
    script_name = create_task_script(task_id, title)

    result = run_command(
        [
            HERMES_BIN,
            "cron",
            "create",
            "--name",
            f"dash-task-{safe_task_fragment(task_id)}",
            "--script",
            script_name,
            "--no-agent",
            "--deliver",
            DELIVER_TARGET,
            normalized_due_at,
        ]
    )
    if result.returncode != 0:
        remove_script(script_name)
        raise RuntimeError(result.stderr or result.stdout)

    job_id = parse_job_id(result.stdout)
    now = datetime.now(timezone.utc).isoformat()
    with sqlite3.connect(STATE_DB) as conn:
        conn.execute(
            """
            insert into reminders (task_id, job_id, script_name, due_at, payload_json, updated_at)
            values (?, ?, ?, ?, ?, ?)
            on conflict(task_id) do update set
              job_id = excluded.job_id,
              script_name = excluded.script_name,
              due_at = excluded.due_at,
              payload_json = excluded.payload_json,
              updated_at = excluded.updated_at
            """,
            (task_id, job_id, script_name, normalized_due_at, json.dumps(payload), now),
        )
    return {"ok": True, "task_id": task_id, "job_id": job_id, "due_at": normalized_due_at}


def cancel_reminder(payload: dict[str, Any]) -> dict[str, Any]:
    task_id = str(payload.get("task_id") or "").strip()
    if not task_id:
        raise ValueError("cancel requires task_id")
    cancel_task_existing(task_id)
    return {"ok": True, "task_id": task_id, "cancelled": True}


# ── Calendar events ────────────────────────────────────────────────────────────

def make_event_message(title: str) -> str:
    clean_title = " ".join(str(title).split()).strip() or "Untitled event"
    return f"⏰ {clean_title} starts in 1 minute!"


def create_event_script(event_id: str, title: str) -> str:
    SCRIPTS_DIR.mkdir(parents=True, exist_ok=True)
    script_name = f"dash_event_{safe_task_fragment(event_id)}.py"
    script_path = SCRIPTS_DIR / script_name
    message_json = json.dumps(make_event_message(title), ensure_ascii=True)
    script_path.write_text(
        "#!/usr/bin/env python3\n"
        f"MESSAGE = {message_json}\n"
        "print(MESSAGE)\n",
        encoding="utf-8",
    )
    script_path.chmod(0o700)
    return script_name


def cancel_event_existing(event_id: str) -> None:
    with sqlite3.connect(STATE_DB) as conn:
        row = conn.execute(
            "select job_id, script_name from event_reminders where event_id = ?",
            (event_id,),
        ).fetchone()
        if not row:
            return
        job_id, script_name = row
        result = run_command([HERMES_BIN, "cron", "remove", str(job_id)])
        if result.returncode != 0 and "not found" not in (result.stderr + result.stdout).lower():
            raise RuntimeError(result.stderr or result.stdout)
        remove_script(script_name)
        conn.execute("delete from event_reminders where event_id = ?", (event_id,))


def upsert_event_reminder(payload: dict[str, Any]) -> dict[str, Any]:
    event_id = str(payload.get("event_id") or "").strip()
    title = str(payload.get("title") or "").strip()
    start_at = str(payload.get("start_at") or "").strip()
    if not event_id or not title or not start_at:
        raise ValueError("upsert requires event_id, title, and start_at")

    event_time = datetime.fromisoformat(start_at)
    if event_time.tzinfo is None:
        raise ValueError("start_at must include a timezone offset (e.g. +05:30)")

    remind_at = event_time - timedelta(minutes=1)
    if remind_at <= datetime.now(timezone.utc).astimezone(remind_at.tzinfo):
        raise ValueError("event starts too soon (less than 1 minute away)")

    remind_at_iso = remind_at.isoformat()
    cancel_event_existing(event_id)
    script_name = create_event_script(event_id, title)

    result = run_command(
        [
            HERMES_BIN,
            "cron",
            "create",
            "--name",
            f"dash-event-{safe_task_fragment(event_id)}",
            "--script",
            script_name,
            "--no-agent",
            "--deliver",
            DELIVER_TARGET,
            remind_at_iso,
        ]
    )
    if result.returncode != 0:
        remove_script(script_name)
        raise RuntimeError(result.stderr or result.stdout)

    job_id = parse_job_id(result.stdout)
    now = datetime.now(timezone.utc).isoformat()
    with sqlite3.connect(STATE_DB) as conn:
        conn.execute(
            """
            insert into event_reminders (event_id, job_id, script_name, start_at, payload_json, updated_at)
            values (?, ?, ?, ?, ?, ?)
            on conflict(event_id) do update set
              job_id = excluded.job_id,
              script_name = excluded.script_name,
              start_at = excluded.start_at,
              payload_json = excluded.payload_json,
              updated_at = excluded.updated_at
            """,
            (event_id, job_id, script_name, start_at, json.dumps(payload), now),
        )
    return {"ok": True, "event_id": event_id, "job_id": job_id, "remind_at": remind_at_iso}


def cancel_event_reminder(payload: dict[str, Any]) -> dict[str, Any]:
    event_id = str(payload.get("event_id") or "").strip()
    if not event_id:
        raise ValueError("cancel requires event_id")
    cancel_event_existing(event_id)
    return {"ok": True, "event_id": event_id, "cancelled": True}


# ── HTTP server ────────────────────────────────────────────────────────────────

def authorized(headers: BaseHTTPRequestHandler.headers) -> bool:
    if not SECRET:
        return True
    return headers.get("Authorization") == f"Bearer {SECRET}"


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path != "/healthz":
            self.write_json(404, {"error": "not found"})
            return
        self.write_json(200, {"ok": True})

    def do_POST(self) -> None:
        if self.path != "/dash/reminder":
            self.write_json(404, {"error": "not found"})
            return
        if not authorized(self.headers):
            self.write_json(401, {"error": "unauthorized"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
            event = payload.get("event")

            if event == "upsert":
                if "task_id" in payload:
                    result = upsert_reminder(payload)
                elif "event_id" in payload:
                    result = upsert_event_reminder(payload)
                else:
                    raise ValueError("upsert requires task_id or event_id")
            elif event == "cancel":
                if "task_id" in payload:
                    result = cancel_reminder(payload)
                elif "event_id" in payload:
                    result = cancel_event_reminder(payload)
                else:
                    raise ValueError("cancel requires task_id or event_id")
            else:
                raise ValueError("event must be upsert or cancel")

            self.write_json(200, result)
        except Exception as exc:
            self.write_json(400, {"ok": False, "error": str(exc)})

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"[dash-event-receiver] {self.address_string()} - {fmt % args}")

    def write_json(self, status: int, body: dict[str, Any]) -> None:
        data = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main() -> None:
    init_db()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"[dash-event-receiver] listening on http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
