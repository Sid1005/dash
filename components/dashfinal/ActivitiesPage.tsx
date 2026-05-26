"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  PageHeader,
  LoadingPage,
  Eyebrow,
  useDashData,
  localIsoDate,
  BROWN_LINE,
  BLUE_LINE,
} from "./DashFinal";
import type { ActivityApiRow } from "./DashFinal";

function DeleteBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        color: "var(--dim)",
        fontSize: 16,
        padding: "0 2px",
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      ×
    </button>
  );
}

function ActivityCard({
  activity,
  onDelete,
}: {
  activity: ActivityApiRow;
  onDelete?: (activity: ActivityApiRow) => void;
}) {
  const actorColor = {
    telegram: "var(--blue)",
    agent: "var(--blue-soft)",
    calendar: "var(--muted)",
    system: "var(--muted)",
    user: "var(--text)",
  }[activity.actor] || "var(--text)";

  return (
    <article
      style={{
        display: "grid",
        gridTemplateColumns: "108px 1fr auto",
        gap: 24,
        alignItems: "start",
        padding: "22px 0",
        borderTop: `1px solid ${BROWN_LINE}`,
        textTransform: "uppercase",
      }}
    >
      <div>
        <div
          className="mono"
          style={{
            fontSize: 26,
            fontWeight: 300,
            lineHeight: 1,
            color: "var(--text)",
            letterSpacing: "0.02em",
          }}
        >
          {activity.time}
        </div>
        <div
          className="mono uc"
          style={{
            marginTop: 8,
            fontSize: 9,
            color: "var(--dim)",
            letterSpacing: "0.22em",
          }}
        >
          IST
        </div>
      </div>
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: actorColor,
            }}
          />
          <span
            className="mono uc"
            style={{
              fontSize: 10,
              color: actorColor,
              letterSpacing: "0.22em",
            }}
          >
            {activity.actor}
          </span>
          <span
            className="mono uc"
            style={{
              fontSize: 10,
              color: "var(--dim)",
              letterSpacing: "0.22em",
            }}
          >
            {activity.kind}
          </span>
        </div>
        <div
          style={{
            fontSize: 17,
            lineHeight: 1.45,
            color: "var(--text)",
            letterSpacing: "0.08em",
            fontWeight: 300,
            textWrap: "pretty",
          }}
        >
          {activity.body}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 8,
        }}
      >
        <div
          className="mono uc"
          style={{
            fontSize: 10,
            color: "var(--muted)",
            letterSpacing: "0.18em",
            whiteSpace: "nowrap",
          }}
        >
          {activity.verb}
        </div>
        {onDelete && (
          <DeleteBtn onClick={() => onDelete(activity)} label="Delete activity" />
        )}
      </div>
    </article>
  );
}

export function ActivitiesPage() {
  const [date, setDate] = useState(() => localIsoDate());
  const data = useDashData(date);
  const [viewDate, setViewDate] = useState(() => new Date(date));

  // Form states
  const [body, setBody] = useState("");
  const [time, setTime] = useState(() => {
    const now = new Date();
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now);
  });
  const [kind, setKind] = useState<"note" | "activity" | "agent_event">("note");
  const [actor, setActor] = useState<
    "user" | "telegram" | "agent" | "calendar" | "system"
  >("user");

  // Sync calendar view when date changes
  useEffect(() => {
    setViewDate(new Date(date));
  }, [date]);

  const deleteActivity = useCallback(async (activity: ActivityApiRow) => {
    await fetch("/api/activities", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: activity.id }),
    });
    window.location.reload();
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!body.trim()) return;

      // Map kind to a reasonable default verb if not provided
      const verbMap = {
        note: "noted",
        activity: "did",
        agent_event: "ran",
      };

      const payload = {
        date,
        body: body.trim(),
        time,
        kind,
        actor,
        verb: verbMap[kind] || "noted",
      };

      try {
        const res = await fetch("/api/activities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          setBody("");
          window.location.reload();
        }
      } catch (err) {
        console.error("Failed to add activity:", err);
      }
    },
    [date, body, time, kind, actor]
  );

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Generate calendar days for monthly grid (copied from FoodSpendingPage grid logic)
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
      const nextDayIdx: number = result.length - startDayOfWeek - daysInMonth + 1;
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

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <PageHeader active="activities" data={data} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          flex: 1,
        }}
      >
        {/* Left Column: Activities List and Manual Form */}
        <div
          style={{
            padding: "34px 40px 48px",
            borderRight: `1px solid ${BROWN_LINE}`,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Date Selector Header in Activities list */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: `1px solid ${BROWN_LINE}`,
              paddingBottom: 16,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 300,
                  color: "var(--text)",
                }}
              >
                {date === localIsoDate() ? "Today's Signals" : data.TODAY.dateLong}
              </h2>
              <span
                className="mono uc"
                style={{
                  fontSize: 10,
                  color: "var(--dim)",
                  letterSpacing: "0.14em",
                }}
              >
                {data.ACTIVITIES.length} saved
              </span>
            </div>

            {date !== localIsoDate() && (
              <button
                type="button"
                onClick={() => setDate(localIsoDate())}
                style={{
                  background: "none",
                  border: "1px solid var(--blue)",
                  color: "var(--blue)",
                  padding: "4px 10px",
                  cursor: "pointer",
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  borderRadius: 4,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontWeight: 600,
                }}
              >
                Today
              </button>
            )}
          </div>

          <section
            style={{
              width: "100%",
              maxWidth: 820,
              borderBottom: `1px solid ${BROWN_LINE}`,
            }}
          >
            {data.ACTIVITIES.length ? (
              data.ACTIVITIES.map((activity) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  onDelete={deleteActivity}
                />
              ))
            ) : (
              <div
                className="mono uc"
                style={{
                  padding: "42px 0",
                  color: "var(--muted)",
                  letterSpacing: "0.18em",
                  fontSize: 12,
                  textAlign: "center",
                }}
              >
                No activity saved for this date
              </div>
            )}
          </section>

          {/* Form to manually create activities */}
          <div
            style={{
              marginTop: 48,
              padding: "28px 32px 32px",
              background: "linear-gradient(180deg, rgba(205,187,159,0.12), transparent)",
              border: `1px solid ${BROWN_LINE}`,
              borderRadius: 8,
              maxWidth: 820,
              width: "100%",
            }}
          >
            <Eyebrow label="Log New Signal" color="var(--blue)" />
            <form
              onSubmit={handleSubmit}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 20,
                marginTop: 16,
              }}
            >
              {/* Body Input */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label
                  htmlFor="body-input"
                  className="mono uc"
                  style={{
                    fontSize: 10,
                    color: "var(--muted)",
                    letterSpacing: "0.14em",
                  }}
                >
                  Body
                </label>
                <textarea
                  id="body-input"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="What happened? E.g., Finished designing the activities page."
                  rows={3}
                  required
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    background: "var(--bg)",
                    border: `1px solid ${BROWN_LINE}`,
                    borderRadius: 6,
                    fontSize: 14,
                    fontFamily: "var(--sans)",
                    color: "var(--text)",
                    resize: "vertical",
                    outline: "none",
                  }}
                />
              </div>

              {/* Row: Time, Kind, Actor */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 16,
                }}
              >
                {/* Time Input */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label
                    htmlFor="time-input"
                    className="mono uc"
                    style={{
                      fontSize: 10,
                      color: "var(--muted)",
                      letterSpacing: "0.14em",
                    }}
                  >
                    Time (IST)
                  </label>
                  <input
                    id="time-input"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    required
                    style={{
                      padding: "10px 12px",
                      background: "var(--bg)",
                      border: `1px solid ${BROWN_LINE}`,
                      borderRadius: 6,
                      fontSize: 13,
                      fontFamily: "var(--mono)",
                      color: "var(--text)",
                      outline: "none",
                    }}
                  />
                </div>

                {/* Kind Selection */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label
                    htmlFor="kind-select"
                    className="mono uc"
                    style={{
                      fontSize: 10,
                      color: "var(--muted)",
                      letterSpacing: "0.14em",
                    }}
                  >
                    Kind
                  </label>
                  <select
                    id="kind-select"
                    value={kind}
                    onChange={(e) => setKind(e.target.value as any)}
                    style={{
                      padding: "10px 12px",
                      background: "var(--bg)",
                      border: `1px solid ${BROWN_LINE}`,
                      borderRadius: 6,
                      fontSize: 13,
                      color: "var(--text)",
                      outline: "none",
                    }}
                  >
                    <option value="note">Note</option>
                    <option value="activity">Activity</option>
                    <option value="agent_event">Agent Event</option>
                  </select>
                </div>

                {/* Actor Selection */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label
                    htmlFor="actor-select"
                    className="mono uc"
                    style={{
                      fontSize: 10,
                      color: "var(--muted)",
                      letterSpacing: "0.14em",
                    }}
                  >
                    Actor
                  </label>
                  <select
                    id="actor-select"
                    value={actor}
                    onChange={(e) => setActor(e.target.value as any)}
                    style={{
                      padding: "10px 12px",
                      background: "var(--bg)",
                      border: `1px solid ${BROWN_LINE}`,
                      borderRadius: 6,
                      fontSize: 13,
                      color: "var(--text)",
                      outline: "none",
                    }}
                  >
                    <option value="user">User</option>
                    <option value="telegram">Telegram</option>
                    <option value="agent">Agent</option>
                    <option value="calendar">Calendar</option>
                    <option value="system">System</option>
                  </select>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                style={{
                  alignSelf: "flex-start",
                  padding: "12px 28px",
                  background: "var(--blue)",
                  color: "#fffaf0",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 12,
                  fontFamily: "var(--mono)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  cursor: "pointer",
                  transition: "opacity 0.2s, transform 0.1s",
                }}
                onMouseOver={(e) => (e.currentTarget.style.opacity = "0.9")}
                onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
                onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
                onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                Add Signal
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Month Picker Calendar */}
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
