"use client";

import { useEffect, useState } from "react";

interface CalEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  } catch {
    return iso;
  }
}

export default function CalendarPanel({ date }: { date: string }) {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/calendar?date=${date}`)
      .then((r) => r.json())
      .then((d) => setEvents(d.events ?? []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [date]);

  return (
    <div className="dash-panel p-5 sm:p-6">
      <div className="dash-eyebrow">Calendar</div>

      {loading && (
        <p className="text-base" style={{ color: "var(--muted-ink)" }}>Loading...</p>
      )}

      {!loading && events.length === 0 && (
        <p className="text-base leading-relaxed" style={{ color: "var(--muted-ink)" }}>
          No events today.{" "}
          {!process.env.NEXT_PUBLIC_COMPOSIO_CONNECTED && (
            <span>Connect Google Calendar via Composio to see events.</span>
          )}
        </p>
      )}

      <div>
        {events.map((e) => (
          <div
            key={e.id}
            className="dash-row grid grid-cols-[92px_1fr] gap-4 py-3"
          >
            <span className="mono text-[11px]" style={{ color: "var(--dim)" }}>
              {formatTime(e.start)}
            </span>
            <div className="min-w-0">
              <p className="truncate" style={{ color: "var(--text)" }}>{e.title}</p>
              <div className="mono mt-1 flex flex-wrap gap-x-3 text-[11px]" style={{ color: "var(--muted-ink)" }}>
                <span>{formatTime(e.start)}-{formatTime(e.end)}</span>
                {e.location && <span className="truncate">{e.location}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
