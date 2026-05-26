"use client";

import { useEffect, useState, useMemo, FormEvent } from "react";
import { format, parseISO } from "date-fns";
import {
  PageHeader,
  LoadingPage,
  Eyebrow,
  useDayView,
  localIsoDate,
  nowMinutes,
  DayTimeline,
  BROWN_LINE,
} from "./DashFinal";

export function CalendarPage() {
  const [date, setDate] = useState(localIsoDate());
  const today = localIsoDate();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const dayData = useDayView(date, refreshTrigger);
  const now = nowMinutes();
  const isToday = date === today;

  const [viewDate, setViewDate] = useState(() => new Date(date));

  // Sync calendar view when date changes
  useEffect(() => {
    setViewDate(new Date(date));
  }, [date]);

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

  function shiftDate(delta: number) {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + delta);
    setDate(localIsoDate(d));
  }

  // Google Calendar Event form state
  const [calTitle, setCalTitle] = useState("");
  const [calStart, setCalStart] = useState("");
  const [calEnd, setCalEnd] = useState("");
  const [calLocation, setCalLocation] = useState("");
  const [calDescription, setCalDescription] = useState("");
  const [calSubmitting, setCalSubmitting] = useState(false);
  const [calError, setCalError] = useState("");

  // Time Block form state
  const [blockTitle, setBlockTitle] = useState("");
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockCategory, setBlockCategory] = useState("Deep Work");
  const [blockSubmitting, setBlockSubmitting] = useState(false);
  const [blockError, setBlockError] = useState("");

  // Filter blocks from dayData
  const calendarEvents = useMemo(() => {
    return dayData?.blocks.filter((b) => b.kind === "cal") ?? [];
  }, [dayData]);

  const timeBlocks = useMemo(() => {
    return dayData?.blocks.filter((b) => b.kind === "blk") ?? [];
  }, [dayData]);

  // Handler for adding Google Calendar Event
  async function handleAddCalEvent(e: FormEvent) {
    e.preventDefault();
    if (!calTitle || !calStart || !calEnd) {
      setCalError("Title, start time, and end time are required.");
      return;
    }
    if (calEnd <= calStart) {
      setCalError("End time must be after start time.");
      return;
    }
    setCalError("");
    setCalSubmitting(true);

    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: calTitle,
          start: `${date}T${calStart}:00+05:30`,
          end: `${date}T${calEnd}:00+05:30`,
          location: calLocation,
          description: calDescription,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create calendar event");
      }

      setCalTitle("");
      setCalStart("");
      setCalEnd("");
      setCalLocation("");
      setCalDescription("");
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      setCalError(err.message || "An error occurred.");
    } finally {
      setCalSubmitting(false);
    }
  }

  // Handler for deleting Google Calendar Event
  async function handleDeleteCalEvent(id: string) {
    if (!confirm("Are you sure you want to delete this Google Calendar event?")) return;
    try {
      const res = await fetch("/api/calendar", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to delete event");
      }
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      alert(err.message || "Failed to delete event.");
    }
  }

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
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <PageHeader active="calendar" data={null} />

      {/* Date Navigation */}
      <div style={{ padding: "14px 40px", borderBottom: `1px solid ${BROWN_LINE}`, display: "flex", alignItems: "center", gap: 24 }}>
        <button
          type="button"
          onClick={() => shiftDate(-1)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 18, padding: "0 4px", lineHeight: 1 }}
        >
          ‹
        </button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 300, color: "var(--text)", letterSpacing: "0.04em" }}>{labelDate}</div>
          {isToday && <div className="mono uc" style={{ fontSize: 10, color: "var(--blue)", letterSpacing: "0.22em", marginTop: 2 }}>today</div>}
        </div>
        <button
          type="button"
          onClick={() => shiftDate(1)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 18, padding: "0 4px", lineHeight: 1 }}
        >
          ›
        </button>
        {!isToday && (
          <button
            type="button"
            onClick={() => setDate(today)}
            style={{ background: "none", border: "1px solid var(--line)", borderRadius: 4, cursor: "pointer", color: "var(--muted)", fontSize: 11, padding: "4px 10px", fontFamily: "var(--mono)", letterSpacing: "0.1em" }}
          >
            today
          </button>
        )}
      </div>

      {/* Split Layout Container */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr minmax(380px, 460px)", flex: 1, maxHeight: "calc(100vh - 120px)", overflow: "hidden" }}>
        
        {/* Left Panel: Scrollable Timeline */}
        <div style={{ padding: "32px 40px", overflowY: "auto" }}>
          <Eyebrow label="Events & Schedule" right={`${dayData?.blocks.length ?? 0} blocks`} />
          {dayData ? (
            <DayTimeline blocks={dayData.blocks} tasks={[]} nowMin={now} isToday={isToday} />
          ) : (
            <div style={{ color: "var(--muted)", padding: "40px 0" }}>Loading…</div>
          )}
        </div>

        {/* Right Panel: Calendar picker + forms & lists */}
        <div
          style={{
            padding: "32px 36px",
            display: "flex",
            flexDirection: "column",
            gap: 36,
            borderLeft: `1px solid ${BROWN_LINE}`,
            overflowY: "auto",
            background: "rgba(255, 255, 255, 0.01)",
          }}
        >
          {/* Calendar month picker */}
          <div>
            <Eyebrow label="Calendar Selection" color="var(--blue)" />
            
            {/* Calendar Month Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
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
              
              <div className="mono uc" style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", letterSpacing: "0.14em" }}>
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

            {/* Calendar Weekday Names */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, textAlign: "center", marginBottom: 8 }}>
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                <div key={day} className="mono uc" style={{ fontSize: 9.5, color: "var(--dim)", fontWeight: 500 }}>
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid Cells */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
              {calendarDays.map((day, idx) => {
                const isSelected = day.isoStr === date;
                const isDayToday = day.isoStr === today;
                
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
                      color: isSelected ? "#fffaf0" : day.isCurrentMonth ? "var(--text)" : "var(--dim)",
                      border: isDayToday && !isSelected ? "1px solid var(--blue)" : "none",
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

          <hr style={{ border: "none", borderTop: `1px solid ${BROWN_LINE}`, margin: 0 }} />

          {/* Google Calendar Section */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <Eyebrow label="Google Calendar" color="var(--rose)" />
            
            {/* Form */}
            <form onSubmit={handleAddCalEvent} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                type="text"
                placeholder="Event Title"
                value={calTitle}
                onChange={(e) => setCalTitle(e.target.value)}
                required
                style={inputStyle}
              />
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={labelStyle}>Start Time</label>
                  <input
                    type="time"
                    value={calStart}
                    onChange={(e) => setCalStart(e.target.value)}
                    required
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={labelStyle}>End Time</label>
                  <input
                    type="time"
                    value={calEnd}
                    onChange={(e) => setCalEnd(e.target.value)}
                    required
                    style={inputStyle}
                  />
                </div>
              </div>

              <input
                type="text"
                placeholder="Location (Optional)"
                value={calLocation}
                onChange={(e) => setCalLocation(e.target.value)}
                style={inputStyle}
              />

              <textarea
                placeholder="Description (Optional)"
                value={calDescription}
                onChange={(e) => setCalDescription(e.target.value)}
                rows={2}
                style={{ ...inputStyle, resize: "none" }}
              />

              {calError && <div style={errorStyle}>{calError}</div>}

              <button
                type="submit"
                disabled={calSubmitting}
                style={{
                  ...buttonStyle,
                  background: "var(--blue)",
                }}
              >
                {calSubmitting ? "Adding to Google Calendar..." : "Add Google Calendar Event"}
              </button>
            </form>

            {/* List */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              <div style={listHeaderStyle}>Today's Calendar Events ({calendarEvents.length})</div>
              {calendarEvents.length === 0 ? (
                <div style={emptyListStyle}>No calendar events today.</div>
              ) : (
                calendarEvents.map((event) => (
                  <div key={event.id} style={listItemStyle}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={listItemTitleStyle}>{event.label}</div>
                      <div style={listItemMetaStyle}>
                        <span>{event.start} - {event.end}</span>
                        {event.loc && <span style={{ marginLeft: 8 }}>· {event.loc}</span>}
                      </div>
                    </div>
                    {event.id && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCalEvent(event.id!)}
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

          <hr style={{ border: "none", borderTop: `1px solid ${BROWN_LINE}`, margin: 0 }} />

          {/* Local Time Blocks Section */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <Eyebrow label="Daily Schedule Blocks" color="var(--blue)" />
            
            {/* Form */}
            <form onSubmit={handleAddTimeBlock} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                type="text"
                placeholder="Block Activity Title"
                value={blockTitle}
                onChange={(e) => setBlockTitle(e.target.value)}
                required
                style={inputStyle}
              />
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
                style={{
                  ...buttonStyle,
                  background: "rgba(36, 84, 214, 0.1)",
                  border: "1px solid var(--blue)",
                  color: "var(--blue)",
                }}
              >
                {blockSubmitting ? "Adding Schedule Block..." : "Add Schedule Block"}
              </button>
            </form>

            {/* List */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              <div style={listHeaderStyle}>Today's Schedule Blocks ({timeBlocks.length})</div>
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

        </div>
      </div>
    </div>
  );
}

// Inline styles aligned with warm light beige theme
const inputStyle = {
  background: "var(--bg-2)",
  border: "1px solid var(--line)",
  borderRadius: "6px",
  color: "var(--text)",
  fontSize: "13px",
  padding: "10px 14px",
  outline: "none",
  width: "100%",
  fontFamily: "inherit",
  transition: "border-color 0.2s, box-shadow 0.2s",
};

const labelStyle = {
  fontSize: "10px",
  fontFamily: "var(--mono)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.1em",
  color: "var(--muted)",
};

const buttonStyle = {
  border: "none",
  borderRadius: "6px",
  color: "#fffaf0",
  cursor: "pointer",
  fontSize: "13px",
  fontWeight: 500,
  padding: "12px 16px",
  transition: "opacity 0.2s, transform 0.1s active",
};

const errorStyle = {
  color: "var(--rose)",
  fontSize: "12px",
  fontFamily: "var(--mono)",
};

const listHeaderStyle = {
  fontSize: "11px",
  fontFamily: "var(--mono)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.12em",
  color: "var(--muted)",
  marginBottom: "4px",
};

const emptyListStyle = {
  fontSize: "13px",
  color: "var(--dim)",
  fontStyle: "italic",
  padding: "8px 0",
};

const listItemStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 12px",
  background: "var(--bg-2)",
  border: "1px solid var(--line)",
  borderRadius: "6px",
  gap: "12px",
};

const listItemTitleStyle = {
  fontSize: "13.5px",
  color: "var(--text)",
  fontWeight: 400,
  whiteSpace: "nowrap" as const,
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const listItemMetaStyle = {
  fontSize: "11.5px",
  color: "var(--muted)",
  fontFamily: "var(--mono)",
  marginTop: "2px",
};

const deleteButtonStyle = {
  background: "none",
  border: "1px solid rgba(244, 63, 94, 0.3)",
  borderRadius: "4px",
  color: "var(--rose)",
  cursor: "pointer",
  fontSize: "11px",
  fontFamily: "var(--mono)",
  padding: "4px 8px",
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
