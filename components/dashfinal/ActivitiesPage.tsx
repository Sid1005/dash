"use client";

import { useCallback, useState } from "react";
import {
  PageHeader,
  LoadingPage,
  useDashData,
  localIsoDate,
  DateNavigator,
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
        gap: 20,
        alignItems: "start",
        padding: "18px 0",
        borderBottom: "1px dashed #000000",
        textTransform: "uppercase",
      }}
    >
      <div>
        <div
          className="mono"
          style={{
            fontSize: 26,
            fontWeight: 900,
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
            letterSpacing: 0,
            fontWeight: 400,
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
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const data = useDashData(date, refreshTrigger, {
    includeLearnings: false,
    includeTasks: false,
    includeProblems: false,
    includeQuotes: false,
  });
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

  const deleteActivity = useCallback(async (activity: ActivityApiRow) => {
    await fetch("/api/activities", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: activity.id }),
    });
    setRefreshTrigger((prev) => prev + 1);
  }, [setRefreshTrigger]);

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
          setRefreshTrigger((prev) => prev + 1);
        }
      } catch (err) {
        console.error("Failed to add activity:", err);
      }
    },
    [date, body, time, kind, actor, setRefreshTrigger]
  );

  if (!data) return <LoadingPage />;

  return (
    <div
      style={{
        height: "100vh",
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <PageHeader active="activities" data={data} />

      <main style={{ padding: "32px 32px 40px", flex: 1, minHeight: 0, display: "flex", justifyContent: "center", overflow: "hidden" }}>
        <div style={{ width: "100%", maxWidth: 1060, display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.85fr)", gap: 28, minHeight: 0 }}>
          <section style={{ display: "flex", flexDirection: "column", gap: 22, minHeight: 0 }}>
          {/* Date Selector Header in Activities list */}
          <div
            className="grid-card"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "stretch",
              padding: "22px 28px",
              gap: 14,
              flexShrink: 0,
            }}
          >
            <div className="zine-paperclip" />
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 14 }}>
              <div>
                <div className="zine-eyebrow blue">
                  <span>↳ activity stream</span>
                  <span>01</span>
                </div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 24,
                    fontWeight: 900,
                    color: "var(--text)",
                    letterSpacing: 0,
                  }}
                >
                  {date === localIsoDate() ? "Today's Signals" : data.TODAY.dateLong}
                </h2>
              </div>
              <span className="mono" style={{ fontSize: 15, color: "#0c0c0e", whiteSpace: "nowrap" }}>
                {data.ACTIVITIES.length} saved
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", maxWidth: "100%" }}>
              <DateNavigator selectedDate={date} onChange={setDate} compact />
            </div>
          </div>

          <section
            className="grid-card"
            style={{
              width: "100%",
              padding: "24px 28px",
              display: "flex",
              flexDirection: "column",
              flex: 1,
              minHeight: 0,
            }}
          >
            <div className="zine-paperclip" />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 14, flexShrink: 0 }}>
              <div className="zine-eyebrow">
                <span>↳ saved signals</span>
                <span>02</span>
              </div>
              <span className="mono" style={{ fontSize: 15, color: "#0c0c0e", whiteSpace: "nowrap" }}>{data.ACTIVITIES.length} items</span>
            </div>
            <div style={{ overflowY: "auto", minHeight: 0, flex: 1 }}>
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
            </div>
          </section>
          </section>

          {/* Form to manually create activities */}
          <div
            className="grid-card"
            style={{
              alignSelf: "center",
              padding: "24px 28px",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div className="zine-paperclip" />
            <div className="zine-eyebrow blue">
              <span>↳ log new signal</span>
              <span>03</span>
            </div>
            <form
              onSubmit={handleSubmit}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 18,
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
                    background: "#ffffff",
                    border: "2px solid #000000",
                    borderRadius: 0,
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
                      background: "#ffffff",
                      border: "2px solid #000000",
                      borderRadius: 0,
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
                      background: "#ffffff",
                      border: "2px solid #000000",
                      borderRadius: 0,
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
                      background: "#ffffff",
                      border: "2px solid #000000",
                      borderRadius: 0,
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
                  background: "#0c0c0e",
                  color: "#faf9f6",
                  border: "none",
                  borderRadius: 0,
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
      </main>
    </div>
  );
}
