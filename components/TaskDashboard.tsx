"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import type { TaskRow } from "@/lib/tasks-types";
import { cn } from "@/lib/utils";

function formatDue(dueAtIso: string) {
  const d = new Date(dueAtIso);
  if (isNaN(d.getTime())) return { line1: "", line2: "" };
  return {
    line1: new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d),
    line2: new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d),
  };
}

function defaultDueLocal() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === "year")?.value;
  const month = parts.find(p => p.type === "month")?.value;
  const day = parts.find(p => p.type === "day")?.value;
  const hour = parts.find(p => p.type === "hour")?.value;
  const minute = parts.find(p => p.type === "minute")?.value;
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export default function TaskDashboard() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [dueLocal, setDueLocal] = useState(defaultDueLocal);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const r = await fetch("/api/tasks");
    const j = await r.json();
    if (!r.ok) {
      setError(j.error ?? "Failed to load tasks");
      setTasks([]);
      return;
    }
    setTasks(j.tasks ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().finally(() => setLoading(false));
  }, [load]);

  const sorted = useMemo(() => {
    const open = tasks.filter((t) => !t.done);
    const done = tasks.filter((t) => t.done);
    const byDue = (a: TaskRow, b: TaskRow) =>
      new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    open.sort(byDue);
    done.sort(byDue);
    return { open, done };
  }, [tasks]);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t || !dueLocal) return;
    const due_at = new Date(dueLocal + "+05:30").toISOString();
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t, due_at }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Save failed");
      setTitle("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleDone(task: TaskRow, done: boolean) {
    setError(null);
    const r = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done }),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error ?? "Update failed");
      return;
    }
    setTasks((prev) => prev.map((x) => (x.id === task.id ? j.task : x)));
  }

  return (
    <div className="dash-page">
      <div className="dash-intro">
        <div className="dash-kicker">Tasks</div>
        <div className="dash-headline">
          What the agent has queued, sorted by what needs your attention next.
        </div>
      </div>

      <div className="dash-container space-y-9">
        {error && (
          <div className="border px-4 py-3 text-sm" style={{ borderColor: "var(--rose)", color: "var(--rose)" }}>
            {error}
          </div>
        )}

        <form onSubmit={addTask} className="dash-panel p-5 sm:p-6 space-y-4">
          <div className="dash-eyebrow">New task</div>
          <div className="flex flex-col gap-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to happen?"
              className="dash-input w-full px-3 py-2 text-base"
              maxLength={2000}
            />
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <label className="mono uc flex flex-col gap-1 text-[10px] flex-1" style={{ color: "var(--muted-ink)", letterSpacing: "0.16em" }}>
                Due date &amp; time
                <input
                  type="datetime-local"
                  value={dueLocal}
                  onChange={(e) => setDueLocal(e.target.value)}
                  className="dash-input mt-1 px-3 py-2 text-sm normal-case tracking-normal"
                />
              </label>
              <Button type="submit" disabled={saving || !title.trim()} className="dash-action rounded-none px-4 py-2">
                {saving ? "Adding..." : "Add task"}
              </Button>
            </div>
          </div>
        </form>

        <div className="grid grid-cols-1 gap-9 lg:grid-cols-[1.2fr_0.8fr]">
          <section>
            <div className="dash-eyebrow">
              <span>Open</span>
              <span className="ml-auto" style={{ color: "var(--muted-ink)" }}>{sorted.open.length} open</span>
            </div>
            {loading ? (
              <p className="text-sm" style={{ color: "var(--muted-ink)" }}>Loading...</p>
            ) : sorted.open.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--muted-ink)" }}>Nothing open. Add one above.</p>
            ) : (
              <ul>
                {sorted.open.map((task) => (
                  <TaskRowItem key={task.id} task={task} onToggle={toggleDone} />
                ))}
              </ul>
            )}
          </section>

          <section className="lg:border-l lg:pl-9" style={{ borderColor: "var(--line)" }}>
            <div className="dash-eyebrow">
              <span>Done</span>
              <span className="ml-auto" style={{ color: "var(--muted-ink)" }}>{sorted.done.length} closed</span>
            </div>
            {!loading && sorted.done.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--muted-ink)" }}>No completed tasks yet.</p>
            ) : (
              <ul>
                {sorted.done.map((task) => (
                  <TaskRowItem key={task.id} task={task} onToggle={toggleDone} />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function TaskRowItem({
  task,
  onToggle,
}: {
  task: TaskRow;
  onToggle: (task: TaskRow, done: boolean) => void;
}) {
  const { line1, line2 } = formatDue(task.due_at);
  return (
    <li
      className={cn(
        "dash-row grid grid-cols-[16px_1fr_auto] items-start gap-3 py-3",
        task.done && "opacity-70"
      )}
    >
      <input
        type="checkbox"
        checked={task.done}
        onChange={(e) => onToggle(task, e.target.checked)}
        className="mt-1 size-4 cursor-pointer accent-[#2454d6]"
        aria-label={task.done ? "Mark not done" : "Mark done"}
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[15px] leading-snug",
            task.done && "line-through"
          )}
          style={{ color: task.done ? "var(--muted-ink)" : "var(--text)" }}
        >
          {task.title}
        </p>
        <div className="mono mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] tabular-nums">
          <span style={{ color: "var(--blue)" }}>{line1}</span>
          <span style={{ color: "var(--dim)" }}>{line2}</span>
        </div>
        {task.completed_at && (
          <p className="mono mt-1 text-[10px]" style={{ color: "var(--dim)" }}>
            Completed {(() => {
              const d = new Date(task.completed_at);
              const dateStr = new Intl.DateTimeFormat("en-US", {
                timeZone: "Asia/Kolkata",
                month: "short",
                day: "numeric",
                year: "numeric",
              }).format(d);
              const timeStr = new Intl.DateTimeFormat("en-US", {
                timeZone: "Asia/Kolkata",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              }).format(d);
              return `${dateStr} at ${timeStr}`;
            })()}
          </p>
        )}
      </div>
    </li>
  );
}
