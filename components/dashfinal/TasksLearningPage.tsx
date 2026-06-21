"use client";

import React, { useState, useCallback, useEffect } from "react";
import { format } from "date-fns";
import {
  PageHeader,
  LoadingPage,
  useDashData,
  TaskRow,
  LearningRow,
  localIsoDate,
  dueLabel,
  weightForTask,
  DateNavigator,
} from "./DashFinal";
import type { DashLearning, DashTask } from "./types";

export function TasksLearningPage() {
  const [date, setDate] = useState(() => localIsoDate());
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const data = useDashData(date, refreshTrigger, {
    includeLearnings: true,
    includeTasks: true,
    includeProblems: false,
    includeQuotes: false,
  });
  // Local tasks state for optimistic checklist updates
  const [localTasks, setLocalTasks] = useState<DashTask[]>([]);

  // Task form state
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  const [taskError, setTaskError] = useState("");

  // Learning form state
  const [learningText, setLearningText] = useState("");
  const [learningDate, setLearningDate] = useState(() => date);
  const [isSubmittingLearning, setIsSubmittingLearning] = useState(false);
  const [learningError, setLearningError] = useState("");

  // Interactive UI states for premium feel
  const [btnTaskHover, setBtnTaskHover] = useState(false);
  const [btnLearningHover, setBtnLearningHover] = useState(false);
  const [taskTitleFocus, setTaskTitleFocus] = useState(false);
  const [taskDueFocus, setTaskDueFocus] = useState(false);
  const [learnTextFocus, setLearnTextFocus] = useState(false);
  const [learnDateFocus, setLearnDateFocus] = useState(false);

  // Sync learning date state when active calendar date changes
  useEffect(() => {
    setLearningDate(date);
  }, [date]);

  // Sync local tasks when backend data loads or updates
  useEffect(() => {
    if (data) {
      const combined = [...data.TASKS, ...data.DONE_TASKS].sort(
        (a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime()
      );
      setLocalTasks(combined);
    }
  }, [data]);

  const toggleTask = useCallback(async (task: DashTask) => {
    // 1. Optimistic update
    setLocalTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t))
    );

    // 2. Perform API fetch in the background without reloading
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !task.done }),
      });
      if (!res.ok) {
        throw new Error("Failed to update task");
      }
    } catch (e) {
      console.error(e);
      // Revert status on failure
      setLocalTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, done: task.done } : t))
      );
    }
  }, []);

  const deleteTask = useCallback(async (task: DashTask) => {
    // 1. Optimistic update
    setLocalTasks((prev) => prev.filter((t) => t.id !== task.id));

    // 2. Perform API delete in the background
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error("Failed to delete task");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to delete task from server");
    }
  }, []);

  const deleteLearning = useCallback(async (l: DashLearning) => {
    await fetch("/api/learnings", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: l.id }),
    });
    setRefreshTrigger((prev) => prev + 1);
  }, [setRefreshTrigger]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !taskDueDate) return;
    setIsSubmittingTask(true);
    setTaskError("");
    try {
      const dueAt = new Date(taskDueDate + "+05:30").toISOString();
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: taskTitle.trim(), due_at: dueAt }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add task");
      }

      const json = await res.json();

      // Only add to localTasks if the task is due on the currently selected date
      const taskDate = localIsoDate(new Date(dueAt));
      if (taskDate === date) {
        const newTask: DashTask = {
          id: json.task.id,
          title: json.task.title,
          due: dueLabel(json.task.due_at),
          weight: weightForTask(json.task.title),
          context: "tasks",
          done: json.task.done,
          due_at: json.task.due_at,
        };
        setLocalTasks((prev) => {
          const updated = [...prev, newTask];
          return updated.sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
        });
      }

      setTaskTitle("");
      setTaskDueDate("");
    } catch (err: unknown) {
      setTaskError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmittingTask(false);
    }
  };

  const handleAddLearning = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!learningText.trim() || !learningDate) return;
    setIsSubmittingLearning(true);
    setLearningError("");
    try {
      const res = await fetch("/api/learnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: learningText.trim(), date: learningDate }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add learning");
      }
      setLearningText("");
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      setLearningError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmittingLearning(false);
    }
  };

  if (!data) return <LoadingPage />;

  // Page styling aligned with warm light beige theme
  const pageStyle: React.CSSProperties = {
    height: "100vh",
    background: "var(--bg)",
    color: "var(--text)",
    display: "flex",
    flexDirection: "column",
    fontFamily: "var(--sans)",
    overflow: "hidden",
  };

  const cardStyle: React.CSSProperties = {
    padding: "16px 22px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    flexShrink: 0,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "10.5px",
    color: "var(--muted)",
    letterSpacing: "0.14em",
    fontWeight: 600,
    textTransform: "uppercase",
    marginBottom: 3,
    display: "block",
  };

  const inputStyle = (isFocused: boolean): React.CSSProperties => ({
    background: "#ffffff",
    border: isFocused ? "2px solid #0c0c0e" : "2px solid #000000",
    borderRadius: 0,
    padding: "8px 10px",
    color: "var(--text)",
    fontSize: "14px",
    width: "100%",
    outline: "none",
    transition: "box-shadow 0.2s",
    boxShadow: isFocused ? "3px 3px 0 #000000" : "none",
    fontFamily: "inherit",
  });

  const buttonStyle = (isHovered: boolean, isDisabled: boolean): React.CSSProperties => ({
    background: isDisabled ? "#66666a" : "#0c0c0e",
    color: "#faf9f6",
    border: "none",
    borderRadius: 0,
    padding: "8px 14px",
    fontSize: "11px",
    fontFamily: "var(--mono)",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    fontWeight: 600,
    cursor: isDisabled ? "not-allowed" : "pointer",
    alignSelf: "flex-end",
    transition: "opacity 0.2s, transform 0.1s",
    opacity: isHovered && !isDisabled ? 0.9 : 1,
    transform: isHovered && !isDisabled ? "translate(-1px, -1px)" : "none",
  });

  return (
    <div style={pageStyle}>
      <PageHeader active="tasks" data={data} />

      <main style={{ padding: "32px 32px 40px", flex: 1, minHeight: 0, display: "flex", justifyContent: "center", overflow: "hidden" }}>
        <div style={{ width: "100%", maxWidth: 1180, display: "flex", flexDirection: "column", gap: 18, minHeight: 0 }}>
          {/* Header showing selected date & DateNavigator */}
          <div className="grid-card" style={{ padding: "14px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexShrink: 0 }}>
            <div className="zine-paperclip" />
            <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
              <div className="zine-eyebrow blue" style={{ marginBottom: 0, flexShrink: 0 }}>
                <span>↳ tasks & learning</span>
                <span>01</span>
              </div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "var(--text)", letterSpacing: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {format(new Date(`${date}T12:00:00`), "EEEE, MMMM d, yyyy")}
              </h1>
            </div>
            <DateNavigator selectedDate={date} onChange={setDate} />
          </div>

          {/* Content area: Tasks & Learnings split columns */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 1fr)",
              gap: 28,
              flex: 1,
              minHeight: 0,
            }}
          >
          {/* Left Sub-Column: Tasks */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18, minHeight: 0 }}>
            <div className="grid-card" style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16, flex: 1, minHeight: 0 }}>
              <div className="zine-paperclip" />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 14, flexShrink: 0 }}>
                <div className="zine-eyebrow">
                  <span>↳ tasks</span>
                  <span>03</span>
                </div>
                <span className="mono" style={{ fontSize: 15, color: "#0c0c0e", whiteSpace: "nowrap" }}>{localTasks.filter((t) => !t.done).length} open</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", overflowY: "auto", minHeight: 0 }}>
                {localTasks.map((t) => (
                  <TaskRow key={t.id} t={t} onToggle={toggleTask} onDelete={deleteTask} />
                ))}
                {localTasks.length === 0 && (
                  <div className="mono uc" style={{ fontSize: 10.5, color: "var(--dim)", padding: "16px 0", letterSpacing: "0.14em" }}>
                    No tasks logged
                  </div>
                )}
              </div>
            </div>

            <form onSubmit={handleAddTask} className="grid-card" style={cardStyle}>
              <div className="zine-paperclip" />
              <div className="zine-eyebrow blue">
                <span>↳ add task</span>
                <span>02</span>
              </div>
              {taskError && (
                <div style={{ color: "var(--rose)", fontSize: "12px", fontFamily: "var(--mono)" }}>
                  {taskError}
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={labelStyle}>Task Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Finish dashboard coding"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    onFocus={() => setTaskTitleFocus(true)}
                    onBlur={() => setTaskTitleFocus(false)}
                    style={inputStyle(taskTitleFocus)}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>Due Date & Time</label>
                  <input
                    type="datetime-local"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    onFocus={() => setTaskDueFocus(true)}
                    onBlur={() => setTaskDueFocus(false)}
                    style={inputStyle(taskDueFocus)}
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isSubmittingTask}
                onMouseOver={() => setBtnTaskHover(true)}
                onMouseOut={() => setBtnTaskHover(false)}
                style={buttonStyle(btnTaskHover, isSubmittingTask)}
              >
                {isSubmittingTask ? "Adding..." : "Add Task"}
              </button>
            </form>
          </div>

          {/* Right Sub-Column: Learnings */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18, minHeight: 0 }}>
            <div className="grid-card" style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16, flex: 1, minHeight: 0 }}>
              <div className="zine-paperclip" />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 14, flexShrink: 0 }}>
                <div className="zine-eyebrow">
                  <span>↳ learnings</span>
                  <span>05</span>
                </div>
                <span className="mono" style={{ fontSize: 15, color: "#0c0c0e", whiteSpace: "nowrap" }}>last 5</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", overflowY: "auto", minHeight: 0 }}>
                {data.LEARNINGS.map((l, i) => (
                  <LearningRow key={i} l={l} onDelete={deleteLearning} />
                ))}
                {data.LEARNINGS.length === 0 && (
                  <div className="mono uc" style={{ fontSize: 10.5, color: "var(--dim)", padding: "16px 0", letterSpacing: "0.14em" }}>
                    No learnings logged yet
                  </div>
                )}
              </div>
            </div>

            <form onSubmit={handleAddLearning} className="grid-card" style={cardStyle}>
              <div className="zine-paperclip" />
              <div className="zine-eyebrow blue">
                <span>↳ add learning</span>
                <span>04</span>
              </div>
              {learningError && (
                <div style={{ color: "var(--rose)", fontSize: "12px", fontFamily: "var(--mono)" }}>
                  {learningError}
                </div>
              )}
              <div>
                <label style={labelStyle}>What did you learn today?</label>
                <textarea
                  placeholder="Write down a learning, signal, or takeaway..."
                  value={learningText}
                  onChange={(e) => setLearningText(e.target.value)}
                  onFocus={() => setLearnTextFocus(true)}
                  onBlur={() => setLearnTextFocus(false)}
                  style={{
                    ...inputStyle(learnTextFocus),
                    minHeight: 56,
                    resize: "vertical",
                  }}
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>Date</label>
                <input
                  type="date"
                  value={learningDate}
                  onChange={(e) => setLearningDate(e.target.value)}
                  onFocus={() => setLearnDateFocus(true)}
                  onBlur={() => setLearnDateFocus(false)}
                  style={inputStyle(learnDateFocus)}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isSubmittingLearning}
                onMouseOver={() => setBtnLearningHover(true)}
                onMouseOut={() => setBtnLearningHover(false)}
                style={buttonStyle(btnLearningHover, isSubmittingLearning)}
              >
                {isSubmittingLearning ? "Saving..." : "Save Learning"}
              </button>
            </form>
          </div>
        </div>

        </div>
      </main>
    </div>
  );
}
