"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { format } from "date-fns";
import {
  PageHeader,
  LoadingPage,
  Eyebrow,
  useDashData,
  TaskRow,
  LearningRow,
  DashTask,
  DashLearning,
  localIsoDate,
  BROWN_LINE,
} from "./DashFinal";

export function TasksLearningPage() {
  const [date, setDate] = useState(() => localIsoDate());
  const data = useDashData(date);
  const [viewDate, setViewDate] = useState(() => new Date(date));

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
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [showAllArchive, setShowAllArchive] = useState(false);

  // Sync calendar view when date changes
  useEffect(() => {
    setViewDate(new Date(date));
  }, [date]);

  // Sync learning date state when active calendar date changes
  useEffect(() => {
    setLearningDate(date);
  }, [date]);

  const toggleTask = useCallback(async (task: DashTask) => {
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !task.done }),
    });
    window.location.reload();
  }, []);

  const deleteTask = useCallback(async (task: DashTask) => {
    await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    window.location.reload();
  }, []);

  const deleteLearning = useCallback(async (l: DashLearning) => {
    await fetch("/api/learnings", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: l.id }),
    });
    window.location.reload();
  }, []);

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
      setTaskTitle("");
      setTaskDueDate("");
      window.location.reload();
    } catch (err: any) {
      setTaskError(err.message || "An error occurred");
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
      window.location.reload();
    } catch (err: any) {
      setLearningError(err.message || "An error occurred");
    } finally {
      setIsSubmittingLearning(false);
    }
  };

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Generate calendar days for monthly grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = firstDay.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const result: { isoStr: string; isCurrentMonth: boolean; dayNum: number }[] = [];

    // Prepend previous month days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      result.push({
        isoStr: localIsoDate(d),
        isCurrentMonth: false,
        dayNum: daysInPrevMonth - i,
      });
    }

    // Add current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      result.push({
        isoStr: localIsoDate(d),
        isCurrentMonth: true,
        dayNum: i,
      });
    }

    // Pad next month days to multiples of 7 (at least 35 or 42 cells)
    const totalCells = Math.ceil(result.length / 7) * 7;
    const padDays = totalCells - result.length;
    for (let i = 1; i <= padDays; i++) {
      const d = new Date(year, month + 1, i);
      result.push({
        isoStr: localIsoDate(d),
        isCurrentMonth: false,
        dayNum: i,
      });
    }

    // Keep grid height stable at exactly 6 rows (42 cells)
    while (result.length < 42) {
      const nextDayIdx = result.length - startDayOfWeek - daysInMonth + 1;
      const d = new Date(year, month + 1, nextDayIdx);
      result.push({
        isoStr: localIsoDate(d),
        isCurrentMonth: false,
        dayNum: nextDayIdx,
      });
    }

    return result;
  }, [year, month]);

  if (!data) return <LoadingPage />;

  // Page styling aligned with warm light beige theme
  const pageStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: "var(--bg)",
    color: "var(--text)",
    display: "flex",
    flexDirection: "column",
    fontFamily: "var(--sans)",
  };

  const cardStyle: React.CSSProperties = {
    background: "linear-gradient(180deg, rgba(205,187,159,0.12), transparent)",
    border: "1px solid var(--line)",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "28px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "10.5px",
    color: "var(--muted)",
    letterSpacing: "0.14em",
    fontWeight: 600,
    textTransform: "uppercase",
    marginBottom: "4px",
    display: "block",
  };

  const inputStyle = (isFocused: boolean): React.CSSProperties => ({
    background: "var(--bg)",
    border: isFocused ? "1px solid var(--blue)" : "1px solid var(--line)",
    borderRadius: "6px",
    padding: "10px 14px",
    color: "var(--text)",
    fontSize: "14px",
    width: "100%",
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
    boxShadow: isFocused ? "0 0 0 2px rgba(36, 84, 214, 0.15)" : "none",
  });

  const buttonStyle = (isHovered: boolean, isDisabled: boolean): React.CSSProperties => ({
    background: isDisabled ? "var(--dim)" : "var(--blue)",
    color: "#fffaf0",
    border: "none",
    borderRadius: "6px",
    padding: "10px 18px",
    fontSize: "11px",
    fontFamily: "var(--mono)",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    fontWeight: 600,
    cursor: isDisabled ? "not-allowed" : "pointer",
    alignSelf: "flex-end",
    transition: "background-color 0.2s, opacity 0.2s, transform 0.1s",
    opacity: isHovered && !isDisabled ? 0.9 : 1,
    transform: isHovered && !isDisabled ? "scale(1.02)" : "scale(1)",
  });

  return (
    <div style={pageStyle}>
      <PageHeader active="tasks" data={data} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          flex: 1,
        }}
      >
        {/* Left main area: Tasks & Learnings split columns */}
        <div
          style={{
            padding: "34px 40px 48px",
            borderRight: `1px solid ${BROWN_LINE}`,
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr",
            gap: "40px",
          }}
        >
          {/* Left Sub-Column: Tasks */}
          <div>
            {/* Add Task Form */}
            <Eyebrow label="Add Task" color="var(--blue)" />
            <form onSubmit={handleAddTask} style={cardStyle}>
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

            <Eyebrow label="Tasks" right={`${data.TASKS.length} open`} />
            <div style={{ display: "flex", flexDirection: "column", marginBottom: 40 }}>
              {(showAllTasks ? data.TASKS : data.TASKS.slice(0, 5)).map((t) => (
                <TaskRow key={t.id} t={t} onToggle={toggleTask} onDelete={deleteTask} />
              ))}
              {data.TASKS.length === 0 && (
                <div className="mono uc" style={{ fontSize: 10.5, color: "var(--dim)", padding: "16px 0", letterSpacing: "0.14em" }}>
                  No open tasks
                </div>
              )}
              {data.TASKS.length > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAllTasks(!showAllTasks)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--blue)",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontFamily: "var(--mono)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    alignSelf: "flex-start",
                    padding: "8px 0",
                    marginTop: 4,
                    textAlign: "left",
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.textDecoration = "underline")}
                  onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
                >
                  {showAllTasks ? "Show less" : `See more (+${data.TASKS.length - 5} tasks)`}
                </button>
              )}
            </div>

            <div>
              <Eyebrow label="Archive" right={`${data.DONE_TASKS.length} done`} color="var(--dim)" />
              <div style={{ display: "flex", flexDirection: "column" }}>
                {(showAllArchive ? data.DONE_TASKS : data.DONE_TASKS.slice(0, 5)).map((t) => (
                  <TaskRow key={t.id} t={t} onToggle={toggleTask} onDelete={deleteTask} />
                ))}
                {data.DONE_TASKS.length === 0 && (
                  <div className="mono uc" style={{ fontSize: 10.5, color: "var(--dim)", padding: "16px 0", letterSpacing: "0.14em" }}>
                    No completed tasks
                  </div>
                )}
                {data.DONE_TASKS.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowAllArchive(!showAllArchive)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--dim)",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontFamily: "var(--mono)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      alignSelf: "flex-start",
                      padding: "8px 0",
                      marginTop: 4,
                      textAlign: "left",
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.textDecoration = "underline")}
                    onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
                  >
                    {showAllArchive ? "Show less" : `See more (+${data.DONE_TASKS.length - 5} tasks)`}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Sub-Column: Learnings */}
          <div style={{ paddingLeft: "20px", borderLeft: `1px solid ${BROWN_LINE}` }}>
            {/* Add Learning Form */}
            <Eyebrow label="Add Learning" color="var(--blue)" />
            <form onSubmit={handleAddLearning} style={cardStyle}>
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
                    minHeight: "80px",
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

            <Eyebrow label="Learnings" right="last 5" />
            <div style={{ display: "flex", flexDirection: "column" }}>
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
        </div>

        {/* Right main area: Month Picker Calendar */}
        <div
          style={{
            padding: "32px 36px",
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <div>
            <Eyebrow label="Calendar Selection" color="var(--blue)" />

            {/* Calendar Month Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 18,
              }}
            >
              <button
                type="button"
                onClick={() => setViewDate(new Date(year, month - 1, 1))}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--muted)",
                  fontSize: 18,
                  padding: "4px 8px",
                  lineHeight: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 4,
                  transition: "background 0.2s",
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = "var(--bg-2)")}
                onMouseOut={(e) => (e.currentTarget.style.background = "none")}
              >
                ‹
              </button>

              <div
                className="mono uc"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text)",
                  letterSpacing: "0.14em",
                }}
              >
                {format(viewDate, "MMMM yyyy")}
              </div>

              <button
                type="button"
                onClick={() => setViewDate(new Date(year, month + 1, 1))}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--muted)",
                  fontSize: 18,
                  padding: "4px 8px",
                  lineHeight: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 4,
                  transition: "background 0.2s",
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = "var(--bg-2)")}
                onMouseOut={(e) => (e.currentTarget.style.background = "none")}
              >
                ›
              </button>
            </div>

            {/* Weekday Names */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 4,
                textAlign: "center",
                marginBottom: 8,
              }}
            >
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                <div
                  key={day}
                  className="mono uc"
                  style={{
                    fontSize: 9.5,
                    color: "var(--dim)",
                    fontWeight: 500,
                  }}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Grid Days */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 4,
              }}
            >
              {calendarDays.map((day, idx) => {
                const isSelected = day.isoStr === date;
                const isCurrentToday = day.isoStr === localIsoDate();

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setDate(day.isoStr)}
                    style={{
                      aspectRatio: "1",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      background: isSelected ? "var(--blue)" : "transparent",
                      color: isSelected
                        ? "#fffaf0"
                        : day.isCurrentMonth
                        ? "var(--text)"
                        : "var(--dim)",
                      border:
                        isCurrentToday && !isSelected
                          ? "1px solid var(--blue)"
                          : "none",
                      borderRadius: "50%",
                      cursor: "pointer",
                      fontSize: 11,
                      fontFamily: "var(--mono)",
                      fontWeight: isSelected ? "600" : "400",
                      position: "relative",
                      transition: "background 0.15s, color 0.15s",
                    }}
                    onMouseOver={(e) => {
                      if (!isSelected) e.currentTarget.style.background = "var(--bg-2)";
                    }}
                    onMouseOut={(e) => {
                      if (!isSelected) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {day.dayNum}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
