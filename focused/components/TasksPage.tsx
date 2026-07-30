"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "./AppShell";
import { DateCalendar } from "./DateCalendar";
import { QueryBox } from "./QueryBox";
import { currentIstDate, formatDateLong } from "../lib/time";
import type { TaskRow } from "../lib/types";

function today() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function taskTime(task: TaskRow) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(task.due_at));
  const hour = parts.find((part) => part.type === "hour")?.value ?? "18";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

export function TasksPage() {
  const initialDateResolved = useRef(false);
  const [selectedDate, setSelectedDate] = useState(today);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("18:00");
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/tasks");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Tasks could not be loaded.");
      const nextTasks = body.tasks ?? [];
      setTasks(nextTasks);
      if (!initialDateResolved.current) {
        const todayValue = today();
        const active = Array.from(new Set(
          nextTasks.map((task: TaskRow) => currentIstDate(new Date(task.due_at)))
        )).sort();
        if (!active.includes(todayValue) && active.at(-1)) setSelectedDate(active.at(-1) as string);
        initialDateResolved.current = true;
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Tasks could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const dayTasks = useMemo(() => tasks.filter((task) => currentIstDate(new Date(task.due_at)) === selectedDate), [tasks, selectedDate]);
  const remaining = dayTasks.filter((task) => !task.done).length;
  const monthTasks = useMemo(() => tasks.filter((task) => currentIstDate(new Date(task.due_at)).startsWith(selectedDate.slice(0, 7))), [tasks, selectedDate]);
  const completedThisMonth = monthTasks.filter((task) => task.done).length;
  const activeDates = useMemo(() => Array.from(new Set(tasks.map((task) => currentIstDate(new Date(task.due_at))))), [tasks]);
  const viewingToday = selectedDate === today();

  function clearForm() {
    setEditingId(null);
    setTitle("");
    setTime("18:00");
  }

  function beginEdit(task: TaskRow) {
    setEditingId(task.id);
    setSelectedDate(currentIstDate(new Date(task.due_at)));
    setTitle(task.title);
    setTime(taskTime(task));
  }

  async function saveTask(event: React.FormEvent) {
    event.preventDefault();
    setNotice("");
    const dueAt = new Date(`${selectedDate}T${time}:00+05:30`).toISOString();
    const endpoint = editingId ? `/api/tasks/${editingId}` : "/api/tasks";
    const response = await fetch(endpoint, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, due_at: dueAt }),
    });
    const body = await response.json();
    if (!response.ok) return setNotice(body.error ?? "Could not save task.");
    clearForm();
    await load();
  }

  async function toggle(task: TaskRow) {
    setTasks((current) => current.map((entry) => entry.id === task.id ? { ...entry, done: !task.done } : entry));
    const response = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !task.done }),
    });
    if (!response.ok) await load();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this task?")) return;
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (editingId === id) clearForm();
    await load();
  }

  return (
    <AppShell title="Tasks">
      <section className="ledger-header">
        <div className="ledger-heading">
          <span className="section-kicker">Daily ledger</span>
          <div className="day-heading">
            <h1>{formatDateLong(selectedDate)}</h1>
            <div className="heading-metrics" aria-label="Task summary">
              <div><strong>{remaining}</strong><span>{viewingToday ? "left today" : "left this day"}</span></div>
              <div><strong>{completedThisMonth}</strong><span>done {new Date(`${selectedDate}T12:00:00+05:30`).toLocaleDateString("en-IN", { month: "short" })}</span></div>
            </div>
          </div>
        </div>
        <DateCalendar selectedDate={selectedDate} onChange={setSelectedDate} activeDates={activeDates} />
      </section>

      <div className="workspace-grid task-workspace">
        <section className="panel primary-panel">
          <span className="paperclip" aria-hidden="true" />
          <div className="panel-title-row">
            <div className="panel-label"><span>{viewingToday ? "Tasks today" : "Tasks on this day"}</span><span>{dayTasks.length} total</span></div>
          </div>
          <div className="record-list">
            {loadError && <p className="load-error" role="alert">{loadError}</p>}
            {loading && <p className="empty">Loading…</p>}
            {!loading && dayTasks.map((task) => (
              <article className={task.done ? "record-row task-record done" : "record-row task-record"} key={task.id}>
                <button type="button" className="task-check" onClick={() => void toggle(task)} aria-label={task.done ? "Mark unfinished" : "Mark complete"}>{task.done ? "✓" : ""}</button>
                <div><strong>{task.title}</strong><span>{taskTime(task)}</span></div>
                <div className="row-actions"><button type="button" onClick={() => beginEdit(task)}>Edit</button><button type="button" onClick={() => void remove(task.id)}>Delete</button></div>
              </article>
            ))}
            {!loading && !loadError && dayTasks.length === 0 && <p className="empty">No tasks for this date. Dates with saved tasks are marked above.</p>}
          </div>
        </section>

        <aside className="side-stack">
          <form className="panel compact-form" onSubmit={saveTask}>
            <span className="paperclip" aria-hidden="true" />
            <div className="panel-label"><span>{editingId ? "Edit task" : "Add task"}</span><span>+</span></div>
            {editingId && <button type="button" className="text-button cancel-button" onClick={clearForm}>Cancel edit</button>}
            <label>Task<input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What needs doing?" /></label>
            <label>Time<input required type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label>
            <button className="primary-button">{editingId ? "Save changes" : "Add task"}</button>
            {notice && <p className="form-notice">{notice}</p>}
          </form>
          <QueryBox
            domain="tasks"
            placeholder="Query past or open tasks"
            examples={["open tasks", "completed tasks in June"]}
          />
        </aside>
      </div>
    </AppShell>
  );
}
