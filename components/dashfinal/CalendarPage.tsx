"use client";

import { useState, useMemo, FormEvent } from "react";
import { format } from "date-fns";
import {
  PageHeader,
  useDayView,
  localIsoDate,
  nowMinutes,
  DayTimeline,
  DateNavigator,
} from "./DashFinal";

export function CalendarPage() {
  const [date, setDate] = useState(localIsoDate());
  const today = localIsoDate();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const dayData = useDayView(date, refreshTrigger);
  const now = nowMinutes();
  const isToday = date === today;

  // Time Block form state
  const [blockTitle, setBlockTitle] = useState("");
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockCategory, setBlockCategory] = useState("Deep Work");
  const [blockSubmitting, setBlockSubmitting] = useState(false);
  const [blockError, setBlockError] = useState("");

  const timeBlocks = useMemo(() => {
    return dayData?.blocks.filter((b) => b.kind === "blk") ?? [];
  }, [dayData]);

  // Handler for adding Time Block
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
          date,
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
    } catch (err: any) {
      setBlockError(err.message || "An error occurred.");
    } finally {
      setBlockSubmitting(false);
    }
  }

  // Handler for deleting Time Block
  async function handleDeleteTimeBlock(id: string) {
    if (!confirm("Are you sure you want to delete this time block?")) return;
    try {
      const res = await fetch("/api/daily", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          type: "time_block",
          id,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to delete time block");
      }
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      alert(err.message || "Failed to delete time block.");
    }
  }

  const labelDate = format(new Date(`${date}T12:00:00`), "EEEE, MMMM d, yyyy");

  return (
    <div style={{ height: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", color: "var(--text)" }}>
      <PageHeader active="calendar" data={null} />

      <main style={{ padding: "32px", flex: 1, minHeight: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(340px, 430px)", gap: 28, height: "100%", maxWidth: 1180, margin: "0 auto" }}>
          <section className="grid-card" style={{ padding: "24px 28px", minHeight: 0, display: "flex", flexDirection: "column", gap: 16, overflow: "hidden" }}>
            <div className="zine-paperclip" />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexShrink: 0 }}>
              <div>
                <div className="zine-eyebrow blue">
                  <span>↳ schedule</span>
                  <span>01</span>
                </div>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: 0 }}>{labelDate}</h1>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                {isToday && <span className="mono uc" style={{ fontSize: 9, color: "var(--blue)", letterSpacing: "0.15em" }}>today</span>}
                <DateNavigator selectedDate={date} onChange={setDate} compact />
              </div>
            </div>
            <div style={timelineMetaStyle}>
              <span>15 min grid</span>
              <span>{dayData?.blocks.length ?? 0} events</span>
              <span>scroll day</span>
            </div>
            <div data-calendar-timeline-scroll style={timelineScrollStyle}>
              {dayData ? (
                <DayTimeline blocks={dayData.blocks} tasks={[]} nowMin={now} isToday={isToday} />
              ) : (
                <div className="mono uc" style={{ color: "var(--dim)", padding: "40px 0", fontSize: 11, letterSpacing: "0.14em" }}>Loading schedule</div>
              )}
            </div>
          </section>

          <aside style={{ display: "flex", flexDirection: "column", gap: 18, minHeight: 0 }}>
            <form onSubmit={handleAddTimeBlock} className="grid-card" style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="zine-paperclip" />
              <div className="zine-eyebrow blue">
                <span>↳ add schedule block</span>
                <span>02</span>
              </div>
              <input
                type="text"
                placeholder="Block Activity Title"
                value={blockTitle}
                onChange={(e) => setBlockTitle(e.target.value)}
                required
                style={inputStyle}
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={labelStyle}>Start Time</label>
                  <input
                    type="time"
                    value={blockStart}
                    onChange={(e) => setBlockStart(e.target.value)}
                    required
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={labelStyle}>End Time</label>
                  <input
                    type="time"
                    value={blockEnd}
                    onChange={(e) => setBlockEnd(e.target.value)}
                    required
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={labelStyle}>Category</label>
                <select
                  value={blockCategory}
                  onChange={(e) => setBlockCategory(e.target.value)}
                  style={inputStyle}
                >
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

              <button
                type="submit"
                disabled={blockSubmitting}
                style={buttonStyle}
              >
                {blockSubmitting ? "Adding..." : "Add Schedule Block"}
              </button>
            </form>

            <div className="grid-card" style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14, flex: 1, minHeight: 0 }}>
              <div className="zine-paperclip" />
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                <div className="zine-eyebrow">
                  <span>↳ schedule blocks</span>
                  <span>03</span>
                </div>
                <span className="mono" style={{ fontSize: 15 }}>{timeBlocks.length} blocks</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", minHeight: 0 }}>
              {timeBlocks.length === 0 ? (
                <div style={emptyListStyle}>No schedule blocks today.</div>
              ) : (
                timeBlocks.map((block) => (
                  <div key={block.id} style={listItemStyle}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={listItemTitleStyle}>{block.label}</span>
                        {block.cat && (
                          <span style={categoryBadgeStyle(block.cat)}>
                            {block.cat}
                          </span>
                        )}
                      </div>
                      <div style={listItemMetaStyle}>
                        {block.start} - {block.end}
                      </div>
                    </div>
                    {block.id && (
                      <button
                        type="button"
                        onClick={() => handleDeleteTimeBlock(block.id!)}
                        style={deleteButtonStyle}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(244, 63, 94, 0.1)";
                          e.currentTarget.style.borderColor = "var(--rose)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "none";
                          e.currentTarget.style.borderColor = "rgba(244, 63, 94, 0.3)";
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                ))
              )}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

// Inline styles aligned with warm light beige theme
const inputStyle = {
  background: "var(--bg)",
  border: "2px solid #000",
  borderRadius: 0,
  color: "var(--text)",
  fontSize: "13px",
  padding: "9px 11px",
  outline: "none",
  width: "100%",
  fontFamily: "inherit",
  transition: "border-color 0.2s, box-shadow 0.2s",
};

const labelStyle = {
  fontSize: "9px",
  fontFamily: "var(--mono)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.1em",
  color: "var(--muted)",
};

const buttonStyle = {
  background: "#0c0c0e",
  border: "2px solid #000",
  borderRadius: 0,
  color: "#fff",
  cursor: "pointer",
  fontSize: "11px",
  fontFamily: "var(--mono)",
  fontWeight: 800,
  letterSpacing: "0.12em",
  padding: "9px 12px",
  textTransform: "uppercase" as const,
  transition: "opacity 0.2s, transform 0.1s active",
};

const errorStyle = {
  color: "var(--rose)",
  fontSize: "11.5px",
  fontFamily: "var(--mono)",
};

const timelineMetaStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  flexShrink: 0,
  borderTop: "2px solid #000",
  borderBottom: "1px dashed #000",
  padding: "8px 0",
  color: "var(--muted)",
  fontFamily: "var(--mono)",
  fontSize: "10px",
  letterSpacing: "0.12em",
  textTransform: "uppercase" as const,
};

const timelineScrollStyle = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto" as const,
  overflowX: "hidden" as const,
  padding: "12px 8px 28px 0",
  scrollbarGutter: "stable" as const,
};

const listHeaderStyle = {
  fontSize: "10px",
  fontFamily: "var(--mono)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.12em",
  color: "var(--muted)",
  marginBottom: "3px",
};

const emptyListStyle = {
  fontSize: "12.5px",
  color: "var(--dim)",
  fontFamily: "var(--mono)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.12em",
  padding: "10px 0",
};

const listItemStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 0",
  background: "transparent",
  borderBottom: "1px dashed #000",
  borderRadius: 0,
  gap: "10px",
};

const listItemTitleStyle = {
  fontSize: "13px",
  color: "var(--text)",
  fontWeight: 400,
  whiteSpace: "nowrap" as const,
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const listItemMetaStyle = {
  fontSize: "11px",
  color: "var(--muted)",
  fontFamily: "var(--mono)",
  marginTop: "1px",
};

const deleteButtonStyle = {
  background: "none",
  border: "none",
  borderRadius: 0,
  color: "var(--rose)",
  cursor: "pointer",
  fontSize: "10.5px",
  fontFamily: "var(--mono)",
  padding: "3px 6px",
  transition: "background 0.2s, border-color 0.2s, color 0.2s",
};

const categoryBadgeStyle = (category: string) => {
  const colors: Record<string, { bg: string; text: string }> = {
    "Deep Work": { bg: "rgba(36,84,214,0.1)", text: "var(--blue)" },
    Meetings: { bg: "rgba(36,84,214,0.07)", text: "var(--blue)" },
    Admin: { bg: "rgba(118,108,91,0.1)", text: "var(--muted)" },
    Learning: { bg: "rgba(168,85,247,0.1)", text: "rgba(107,33,168,1)" },
    Health: { bg: "rgba(34,197,94,0.1)", text: "rgba(21,128,61,1)" },
    Personal: { bg: "rgba(234,179,8,0.15)", text: "rgba(161,98,7,1)" },
    Other: { bg: "rgba(118,108,91,0.07)", text: "var(--muted)" },
  };
  const color = colors[category] || colors["Other"];
  return {
    fontSize: "9px",
    fontFamily: "var(--mono)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    padding: "2px 6px",
    borderRadius: "4px",
    background: color.bg,
    color: color.text,
  };
};
