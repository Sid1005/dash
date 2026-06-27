"use client";

import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  DateNavigator,
  DayTimeline,
  LoadingPage,
  PageHeader,
  TaskRow,
  localIsoDate,
  nowMinutes,
  useDashData,
  useDayView,
} from "./DashFinal";
import type { DashBlock, DashTask } from "./types";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function blockKey(block: DashBlock) {
  return block.id ?? `${block.kind}-${block.start}-${block.end}-${block.label}`;
}

export function PlannerPage() {
  const [scheduleDate, setScheduleDate] = useState(() => localIsoDate());
  const [taskDate, setTaskDate] = useState(() => localIsoDate());
  const today = localIsoDate();
  const isScheduleToday = scheduleDate === today;
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const data = useDashData(taskDate, refreshTrigger, {
    includeTasks: true,
    includeProblems: false,
    includeQuotes: false,
  });
  const dayData = useDayView(scheduleDate, refreshTrigger);
  const [localTasks, setLocalTasks] = useState<DashTask[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<DashBlock | null>(null);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  const [taskError, setTaskError] = useState("");
  const [btnTaskHover, setBtnTaskHover] = useState(false);
  const [taskTitleFocus, setTaskTitleFocus] = useState(false);
  const [taskDueFocus, setTaskDueFocus] = useState(false);

  const [blockTitle, setBlockTitle] = useState("");
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockCategory, setBlockCategory] = useState("Deep Work");
  const [blockSubmitting, setBlockSubmitting] = useState(false);
  const [blockError, setBlockError] = useState("");

  useEffect(() => {
    if (!data) return;
    setLocalTasks(
      [...data.TASKS, ...data.DONE_TASKS].sort(
        (a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime()
      )
    );
  }, [data]);

  useEffect(() => {
    setSelectedBlock(null);
  }, [scheduleDate]);

  useEffect(() => {
    if (!selectedBlock || !dayData) return;
    const freshBlock = dayData.blocks.find((block) => blockKey(block) === blockKey(selectedBlock));
    if (!freshBlock) {
      setSelectedBlock(null);
      return;
    }
    setSelectedBlock(freshBlock);
  }, [dayData, selectedBlock]);

  const toggleTask = useCallback(async (task: DashTask) => {
    setLocalTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t))
    );
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !task.done }),
      });
      if (!res.ok) throw new Error("Failed to update task");
    } catch (e) {
      console.error(e);
      setLocalTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, done: task.done } : t))
      );
    }
  }, []);

  const deleteTask = useCallback(async (task: DashTask) => {
    setLocalTasks((prev) => prev.filter((t) => t.id !== task.id));
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete task");
    } catch (e) {
      console.error(e);
      alert("Failed to delete task from server");
    }
  }, []);

  async function handleAddTask(e: React.FormEvent) {
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
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      setTaskError(errorMessage(err, "An error occurred"));
    } finally {
      setIsSubmittingTask(false);
    }
  }

  async function handleAddTimeBlock(e: FormEvent) {
    e.preventDefault();
    if (!blockTitle || !blockStart || !blockEnd) {
      setBlockError("Title, start time, and end time are required.");
      return;
    }
    if (blockEnd <= blockStart) {
      setBlockError("End time must be after start time.");
      return;
    }
    setBlockError("");
    setBlockSubmitting(true);

    try {
      const res = await fetch("/api/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: scheduleDate,
          type: "time_block",
          data: {
            activity: blockTitle,
            start: blockStart,
            end: blockEnd,
            category: blockCategory,
          },
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create time block");
      }

      setBlockTitle("");
      setBlockStart("");
      setBlockEnd("");
      setBlockCategory("Deep Work");
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      setBlockError(errorMessage(err, "An error occurred."));
    } finally {
      setBlockSubmitting(false);
    }
  }

  async function handleDeleteTimeBlock(id: string) {
    if (!confirm("Are you sure you want to delete this time block?")) return;
    try {
      const res = await fetch("/api/daily", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: scheduleDate, type: "time_block", id }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to delete time block");
      }
      setSelectedBlock(null);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      alert(errorMessage(err, "Failed to delete time block."));
    }
  }

  const blocks = useMemo(() => dayData?.blocks ?? [], [dayData?.blocks]);
  const selectedId = selectedBlock ? blockKey(selectedBlock) : undefined;
  const labelDate = format(new Date(`${scheduleDate}T12:00:00`), "EEEE, MMMM d, yyyy");
  const scheduledMinutes = useMemo(
    () => blocks.reduce((sum, block) => sum + Math.max(0, toMinutesSafe(block.end) - toMinutesSafe(block.start)), 0),
    [blocks]
  );

  if (!data) return <LoadingPage />;

  return (
    <div style={pageStyle}>
      <PageHeader active="tasksCalendar" data={data} />

      <main style={mainStyle}>
        <section className="grid-card" style={scheduleCardStyle}>
          <div className="zine-paperclip" />
          <div style={scheduleHeaderStyle}>
            <div style={{ minWidth: 0 }}>
              <div className="zine-eyebrow blue">
                <span>↳ schedule</span>
                <span>01</span>
              </div>
              <h1 style={titleStyle}>{labelDate}</h1>
            </div>
            <div style={scheduleCalendarStyle}>
              {isScheduleToday && <span className="mono uc" style={todayStyle}>today</span>}
              <DateNavigator selectedDate={scheduleDate} onChange={setScheduleDate} compact />
            </div>
          </div>

          <div style={timelineMetaStyle}>
            <span>15 min grid</span>
            <span>{blocks.length} events · {scheduledMinutes} min planned</span>
            <span>scroll day</span>
          </div>

          <div data-calendar-timeline-scroll style={timelineScrollStyle}>
            {dayData ? (
              <DayTimeline
                blocks={blocks}
                tasks={[]}
                nowMin={nowMinutes()}
                isToday={isScheduleToday}
                onBlockClick={setSelectedBlock}
                selectedBlockId={selectedId}
              />
            ) : (
              <div className="mono uc" style={loadingStyle}>Loading schedule</div>
            )}
          </div>

          {selectedBlock && (
            <div style={detailCardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
                <div style={{ minWidth: 0 }}>
                  <div className="mono uc" style={detailKickerStyle}>selected block</div>
                  <h2 style={detailTitleStyle}>{selectedBlock.label}</h2>
                </div>
                <button type="button" onClick={() => setSelectedBlock(null)} style={plainIconButtonStyle}>×</button>
              </div>
              <div className="mono" style={detailMetaStyle}>
                {selectedBlock.start} - {selectedBlock.end}
                {selectedBlock.cat ? ` · ${selectedBlock.cat}` : ""}
                {selectedBlock.loc ? ` · ${selectedBlock.loc}` : ""}
              </div>
              {selectedBlock.id && (
                <button type="button" onClick={() => handleDeleteTimeBlock(selectedBlock.id!)} style={smallDangerButtonStyle}>
                  Delete Block
                </button>
              )}
            </div>
          )}
        </section>

        <aside style={rightRailStyle}>
          <section className="grid-card" style={tasksCardStyle}>
            <div className="zine-paperclip" />
            <div style={tasksTopStyle}>
              <div style={{ minWidth: 0 }}>
                <div className="zine-eyebrow blue" style={{ marginBottom: 6 }}>
                  <span>↳ tasks</span>
                  <span>02</span>
                </div>
                <div className="mono uc" style={dateSubheadStyle}>
                  {format(new Date(`${taskDate}T12:00:00`), "EEE, MMM d")} · {localTasks.filter((t) => !t.done).length} open
                </div>
              </div>
              <DateNavigator selectedDate={taskDate} onChange={setTaskDate} compact />
            </div>
            <div style={tasksDividerStyle} />
            <div style={tasksListStyle}>
              {localTasks.map((task) => (
                <TaskRow key={task.id} t={task} onToggle={toggleTask} onDelete={deleteTask} />
              ))}
              {localTasks.length === 0 && (
                <div className="mono uc" style={emptyStyle}>No tasks logged</div>
              )}
            </div>
          </section>

          <form onSubmit={handleAddTimeBlock} className="grid-card" style={formCardStyle}>
            <div className="zine-paperclip" />
            <div className="zine-eyebrow blue">
              <span>↳ add schedule</span>
              <span>04</span>
            </div>
            <input
              type="text"
              placeholder="Block Activity Title"
              value={blockTitle}
              onChange={(e) => setBlockTitle(e.target.value)}
              required
              style={inputStyle(false)}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label style={labelStyle}>Start Time</label>
                <input type="time" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} required style={inputStyle(false)} />
              </div>
              <div>
                <label style={labelStyle}>End Time</label>
                <input type="time" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} required style={inputStyle(false)} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              <select value={blockCategory} onChange={(e) => setBlockCategory(e.target.value)} style={inputStyle(false)}>
                <option value="Deep Work">Deep Work</option>
                <option value="Meetings">Meetings</option>
                <option value="Admin">Admin</option>
                <option value="Learning">Learning</option>
                <option value="Health">Health</option>
                <option value="Personal">Personal</option>
                <option value="Other">Other</option>
              </select>
            </div>
            {blockError && <div style={errorStyle}>{blockError}</div>}
            <button type="submit" disabled={blockSubmitting} style={submitButtonStyle(false, blockSubmitting)}>
              {blockSubmitting ? "Adding..." : "Add Schedule"}
            </button>
          </form>

          <form onSubmit={handleAddTask} className="grid-card" style={formCardStyle}>
            <div className="zine-paperclip" />
            <div className="zine-eyebrow">
              <span>↳ add task</span>
              <span>05</span>
            </div>
            {taskError && <div style={errorStyle}>{taskError}</div>}
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
            <button
              type="submit"
              disabled={isSubmittingTask}
              onMouseOver={() => setBtnTaskHover(true)}
              onMouseOut={() => setBtnTaskHover(false)}
              style={submitButtonStyle(btnTaskHover, isSubmittingTask)}
            >
              {isSubmittingTask ? "Adding..." : "Add Task"}
            </button>
          </form>
        </aside>
      </main>
    </div>
  );
}

function toMinutesSafe(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

const pageStyle: React.CSSProperties = {
  height: "100vh",
  background: "var(--bg)",
  color: "var(--text)",
  display: "flex",
  flexDirection: "column",
  fontFamily: "var(--sans)",
  overflow: "hidden",
};

const mainStyle: React.CSSProperties = {
  padding: "24px 30px 30px",
  flex: 1,
  minHeight: 0,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(360px, 0.82fr)",
  gap: 24,
  overflow: "hidden",
};

const scheduleCardStyle: React.CSSProperties = {
  padding: "22px 26px",
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  gap: 14,
  overflow: "hidden",
};

const scheduleHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
  flexShrink: 0,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 24,
  fontWeight: 900,
  letterSpacing: 0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const todayStyle: React.CSSProperties = {
  fontSize: 9,
  color: "var(--blue)",
  letterSpacing: "0.15em",
  paddingTop: 5,
};

const scheduleCalendarStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 6,
  flexShrink: 0,
};

const timelineMetaStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexShrink: 0,
  borderTop: "2px solid #000",
  borderBottom: "1px dashed #000",
  padding: "8px 0",
  color: "var(--muted)",
  fontFamily: "var(--mono)",
  fontSize: 10,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const timelineScrollStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  overflowX: "hidden",
  padding: "12px 8px 28px 0",
  scrollbarGutter: "stable",
};

const detailCardStyle: React.CSSProperties = {
  position: "absolute",
  right: 28,
  top: 112,
  width: "min(300px, calc(100% - 56px))",
  background: "var(--bg)",
  border: "2px solid #000",
  boxShadow: "4px 4px 0 #000",
  padding: "12px 14px",
  zIndex: 10,
};

const detailKickerStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 8.5,
  letterSpacing: "0.14em",
};

const detailTitleStyle: React.CSSProperties = {
  margin: "2px 0 0",
  fontSize: 16,
  fontWeight: 900,
  letterSpacing: 0,
  lineHeight: 1.15,
};

const detailMetaStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 11,
  marginTop: 8,
};

const plainIconButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: 18,
  lineHeight: 1,
  padding: 0,
};

const smallDangerButtonStyle: React.CSSProperties = {
  marginTop: 10,
  background: "none",
  border: "1px solid var(--rose)",
  color: "var(--rose)",
  cursor: "pointer",
  fontFamily: "var(--mono)",
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  padding: "5px 8px",
};

const rightRailStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateRows: "minmax(220px, 1fr) auto auto",
  gap: 14,
  minHeight: 0,
  overflowY: "auto",
  overflowX: "hidden",
  paddingRight: 6,
};

const dateSubheadStyle: React.CSSProperties = {
  fontSize: 9,
  color: "var(--muted)",
  letterSpacing: "0.14em",
};

const tasksCardStyle: React.CSSProperties = {
  padding: "16px 18px",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  minHeight: 0,
};

const tasksTopStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexShrink: 0,
};

const tasksDividerStyle: React.CSSProperties = {
  borderTop: "1px dashed #000",
  flexShrink: 0,
};

const tasksListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  overflowY: "auto",
  flex: 1,
  minHeight: 0,
};

const formCardStyle: React.CSSProperties = {
  padding: "14px 16px",
  display: "flex",
  flexDirection: "column",
  gap: 9,
  flexShrink: 0,
};

const inputStyle = (isFocused: boolean): React.CSSProperties => ({
  background: "#ffffff",
  border: "2px solid #000000",
  borderRadius: 0,
  padding: "7px 9px",
  color: "var(--text)",
  fontSize: 13,
  width: "100%",
  outline: "none",
  transition: "box-shadow 0.2s",
  boxShadow: isFocused ? "3px 3px 0 #000000" : "none",
  fontFamily: "inherit",
});

const labelStyle: React.CSSProperties = {
  fontSize: 9,
  color: "var(--muted)",
  letterSpacing: "0.14em",
  fontWeight: 600,
  textTransform: "uppercase",
  marginBottom: 3,
  display: "block",
};

const submitButtonStyle = (isHovered: boolean, isDisabled: boolean): React.CSSProperties => ({
  background: isDisabled ? "#66666a" : "#0c0c0e",
  color: "#faf9f6",
  border: "none",
  borderRadius: 0,
  padding: "8px 12px",
  fontSize: 10.5,
  fontFamily: "var(--mono)",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  fontWeight: 600,
  cursor: isDisabled ? "not-allowed" : "pointer",
  alignSelf: "flex-end",
  opacity: isHovered && !isDisabled ? 0.9 : 1,
  transform: isHovered && !isDisabled ? "translate(-1px, -1px)" : "none",
});

const errorStyle: React.CSSProperties = {
  color: "var(--rose)",
  fontSize: 11,
  fontFamily: "var(--mono)",
};

const emptyStyle: React.CSSProperties = {
  fontSize: 10.5,
  color: "var(--dim)",
  padding: "16px 0",
  letterSpacing: "0.14em",
};

const loadingStyle: React.CSSProperties = {
  color: "var(--dim)",
  padding: "40px 0",
  fontSize: 11,
  letterSpacing: "0.14em",
};
