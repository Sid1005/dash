"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function dateFromValue(value: string): Date {
  return new Date(`${value}T12:00:00+05:30`);
}

function dateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function DateCalendar({ selectedDate, onChange, activeDates = [] }: {
  selectedDate: string;
  onChange: (date: string) => void;
  activeDates?: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);
  const selected = dateFromValue(selectedDate);
  const active = useMemo(() => new Set(activeDates), [activeDates]);

  useEffect(() => {
    function close(event: PointerEvent) {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) setExpanded(false);
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const strip = useMemo(() => Array.from({ length: 5 }, (_, index) => {
    const date = dateFromValue(selectedDate);
    date.setDate(date.getDate() + index - 2);
    return {
      value: dateValue(date),
      day: date.getDate(),
      weekday: date.toLocaleDateString("en-IN", { weekday: "short" }).slice(0, 2).toUpperCase(),
    };
  }), [selectedDate]);

  const monthCells = useMemo(() => {
    const calendarDate = dateFromValue(selectedDate);
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const first = new Date(year, month, 1, 12);
    const start = new Date(year, month, 1 - first.getDay(), 12);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return { value: dateValue(date), day: date.getDate(), currentMonth: date.getMonth() === month };
    });
  }, [selectedDate]);

  function shiftDay(amount: number) {
    const date = dateFromValue(selectedDate);
    date.setDate(date.getDate() + amount);
    onChange(dateValue(date));
  }

  function shiftMonth(amount: number) {
    const date = dateFromValue(selectedDate);
    date.setDate(1);
    date.setMonth(date.getMonth() + amount);
    onChange(dateValue(date));
  }

  return (
    <div className="date-navigator" ref={calendarRef}>
      <div className="date-strip">
        <button type="button" className="date-arrow" onClick={() => shiftDay(-1)} aria-label="Previous day">‹</button>
        {strip.map((date) => (
          <button
            type="button"
            key={date.value}
            className={date.value === selectedDate ? "date-chip selected" : "date-chip"}
            onClick={() => onChange(date.value)}
            aria-label={dateFromValue(date.value).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          >
            <span>{date.weekday}</span>
            <b>{date.day}</b>
            {active.has(date.value) && <i aria-hidden="true" />}
          </button>
        ))}
        <button type="button" className="date-arrow" onClick={() => shiftDay(1)} aria-label="Next day">›</button>
      </div>
      <button type="button" className={expanded ? "calendar-toggle active" : "calendar-toggle"} onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>CAL</button>

      {expanded && (
        <div className="month-popover">
          <div className="month-popover-head">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month">‹</button>
            <strong>{selected.toLocaleDateString("en-IN", { month: "long", year: "numeric" }).toUpperCase()}</strong>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month">›</button>
          </div>
          <div className="month-weekdays">{WEEKDAYS.map((day, index) => <span key={`weekday-${index}`}>{day}</span>)}</div>
          <div className="month-grid">
            {monthCells.map((cell) => (
              <button
                type="button"
                key={cell.value}
                className={`${cell.value === selectedDate ? "selected" : ""} ${cell.currentMonth ? "" : "outside"}`}
                onClick={() => { onChange(cell.value); setExpanded(false); }}
                aria-label={dateFromValue(cell.value).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              >
                {cell.day}
                {active.has(cell.value) && <i aria-hidden="true" />}
              </button>
            ))}
          </div>
          <button type="button" className="today-button" onClick={() => { onChange(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })); setExpanded(false); }}>Today</button>
        </div>
      )}
    </div>
  );
}
