"""Receive Dash task reminder events and create one-shot Hermes cron jobs.

Run this on the VM, expose it with ngrok/cloudflared, then set Dash env vars:

  HERMES_REMINDER_WEBHOOK_URL=https://your-tunnel.example/dash/reminder
  HERMES_REMINDER_WEBHOOK_SECRET=<same secret as receiver>

The receiver keeps a local SQLite mapping from Dash task IDs to Hermes cron job
IDs, so task edits and deletes can replace/cancel the existing scheduled job.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import sqlite3
import subprocess
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

HOST = os.environ.get("DASH_EVENT_HOST", "127.0.0.1")
PORT = int(os.environ.get("DASH_EVENT_PORT", "8080"))
SECRET = os.environ.get("HERMES_REMINDER_WEBHOOK_SECRET", os.environ.get("DASH_EVENT_SECRET", ""))
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


def run_command(args: list[str]) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(args, text=True, capture_output=True, check=False, timeout=30)
    except FileNotFoundError as exc:
        raise RuntimeError(f"Hermes executable not found: {HERMES_BIN}") from exc
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(f"Hermes command timed out after 30 seconds: {' '.join(args)}") from exc


def parse_job_id(output: str) -> str:
    match = re.search(r"Created job:\s*([A-Za-z0-9_-]+)", output)
    if not match:
        raise RuntimeError(f"Could not parse Hermes job ID from output: {output!r}")
    return match.group(1)


def safe_task_fragment(task_id: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9_.-]+", "_", task_id).strip("._-")
    return safe[:80] or "task"


def make_message(title: str) -> str:
    clean_title = " ".join(str(title).split()).strip() or "Untitled task"
    return f"\u23f0 {clean_title} - due now!"


def create_script(task_id: str, title: str) -> str:
    SCRIPTS_DIR.mkdir(parents=True, exist_ok=True)
    script_name = f"dash_task_{safe_task_fragment(task_id)}.py"
    script_path = SCRIPTS_DIR / script_name
    message_json = json.dumps(make_message(title), ensure_ascii=True)
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
    script_path = SCRIPTS_DIR / script_name
    try:
        script_path.unlink()
    except FileNotFoundError:
        pass


def cancel_existing(task_id: str) -> None:
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
    cancel_existing(task_id)
    script_name = create_script(task_id, title)

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
    cancel_existing(task_id)
    return {"ok": True, "task_id": task_id, "cancelled": True}


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
                result = upsert_reminder(payload)
            elif event == "cancel":
                result = cancel_reminder(payload)
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
    if not SECRET:
        raise RuntimeError("HERMES_REMINDER_WEBHOOK_SECRET must be configured")
    if shutil.which(HERMES_BIN) is None:
        raise RuntimeError(f"Hermes executable not found: {HERMES_BIN}")
    init_db()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"[dash-event-receiver] listening on http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
