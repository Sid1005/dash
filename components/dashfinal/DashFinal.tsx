"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO, subDays } from "date-fns";
import { Pencil, Sun, Moon } from "lucide-react";

type TaskApiRow = {
  id: string;
  title: string;
  due_at: string;
  done: boolean;
  completed_at: string | null;
};

type FoodApiRow = {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  estimated: boolean;
  cost: number;
  time: string;
  meal: string;
};

type SpendApiRow = {
  id: string;
  item: string;
  amount: number;
  category: string;
  time: string;
};

type TimeBlockApiRow = {
  id?: string;
  start: string;
  end: string;
  activity: string;
  category: string;
};

type CalendarApiRow = {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
};

export type ActivityApiRow = {
  id: string;
  date: string;
  time: string;
  actor: "telegram" | "agent" | "calendar" | "system" | "user";
  kind: "note" | "activity" | "agent_event";
  verb: string;
  body: string;
};

export type DashBlock = {
  id?: string;
  kind: "blk" | "cal" | "meal";
  start: string;
  end: string;
  label: string;
  cat?: string;
  loc?: string;
  kcal?: number;
  p?: number;
  est?: boolean;
  current?: boolean;
};


export type DashTask = {
  id: string;
  title: string;
  due: string;
  weight: "S" | "M" | "L";
  context: string;
  done: boolean;
  due_at: string;
};

export type DashLearning = {
  id: string;
  isoDate: string;
  date: string;
  text: string;
  tag: string;
};

type DashFeed = {
  t: string;
  who: "telegram" | "agent" | "calendar" | "system" | "user";
  verb: string;
  obj: string;
  est?: boolean;
};

export type DashData = {
  NOW_MIN: number;
  TODAY: { dateLong: string; dateIso: string };
  FOCUS: { title: string };
  VISION_LINE: string;
  PROBLEMS: { id: string; text: string; solved: boolean; created_at: string }[];
  BLOCKS: DashBlock[];
  TASKS: DashTask[];
  DONE_TASKS: DashTask[];
  ACTIVITIES: ActivityApiRow[];
  LEARNINGS: DashLearning[];
  FEED: DashFeed[];
  MEALS: { id: string; t: string; label: string; kcal: number; p: number; cost: number; est?: boolean; planned?: boolean }[];
  SPEND: { id: string; t: string; label: string; amount: number; cat: string; est?: boolean }[];
  VITALS: {
    kcal: { today: number; target: number };
    protein: { today: number; target: number };
    spend: { today: number; target: number };
  };
  SCHEDULE_FOLLOWED_MIN: number;
  SCHEDULE_ELAPSED_MIN: number;
};

// ── Day timeline ──────────────────────────────────────────────────────────────
const TL_START = 6 * 60;   // 6:00 AM
const TL_END   = 23 * 60;  // 11:00 PM
const TL_SPAN  = TL_END - TL_START;

function tlPct(min: number): number {
  return Math.min(100, Math.max(0, ((min - TL_START) / TL_SPAN) * 100));
}

// Background colors for time block categories — solid, readable on warm beige
const CAT_COLOR: Record<string, string> = {
  "Deep Work": "#1a3a8f",   // deep navy
  Meetings:    "#2c6e8a",   // teal
  Admin:       "#5a5a7a",   // slate
  Learning:    "#6b3fa0",   // purple
  Health:      "#2d7a55",   // forest green
  Body:        "#2d7a55",   // forest green
  Personal:    "#8a4a1a",   // warm brown
  Other:       "#666255",   // warm grey
};

export const BROWN_LINE = "rgba(205,187,159,0.62)";
export const BLUE_LINE = "rgba(36,84,214,0.34)";

export function localIsoDate(d = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(d);
  const year = parts.find(p => p.type === "year")?.value;
  const month = parts.find(p => p.type === "month")?.value;
  const day = parts.find(p => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function nowMinutes() {
  const d = new Date();
  const timeStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

export function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function fromMinutes(min: number) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function isoToTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "00:00";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function dueLabel(iso: string) {
  const d = parseISO(iso);
  if (isNaN(d.getTime())) return "";
  const today = localIsoDate();
  const tomorrow = localIsoDate(new Date(Date.now() + 86400000));
  const date = localIsoDate(d);
  if (date === today) {
    const timeStr = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
    return `today ${timeStr}`;
  }
  if (date === tomorrow) return "tomorrow";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    month: "short",
    day: "numeric",
  }).format(d);
}

function weightForTask(title: string): "S" | "M" | "L" {
  if (title.length > 80) return "L";
  if (title.length > 42) return "M";
  return "S";
}

function firstUsefulLine(content: string, fallback: string) {
  const line = content
    .split("\n")
    .map((l) => l.replace(/^[-#*\s]+/, "").trim())
    .find(Boolean);
  return line ?? fallback;
}

function sortBlocks(blocks: DashBlock[]) {
  return [...blocks].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
}

export function useDashData(dateOverride?: string): DashData | null {
  const [data, setData] = useState<DashData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const today = dateOverride || localIsoDate();
      const learningDates = Array.from({ length: 14 }, (_, i) => localIsoDate(subDays(new Date(today), i)));
      const [
        dailyRes,
        tasksRes,
        calendarRes,
        visionRes,
        goalsRes,
        problemsRes,
        learningsRes,
      ] = await Promise.all([
        fetch(`/api/daily?date=${today}`).then((r) => r.json()),
        fetch("/api/tasks").then((r) => r.json()).catch(() => ({ tasks: [] })),
        fetch(`/api/calendar?date=${today}`).then((r) => r.json()).catch(() => ({ events: [] })),
        fetch("/api/lifeswork/vision").then((r) => r.json()).catch(() => ({ content: "" })),
        fetch("/api/lifeswork/goals").then((r) => r.json()).catch(() => ({ content: "" })),
        fetch("/api/problems").then((r) => r.json()).catch(() => ({ problems: [] })),
        Promise.all(
          learningDates.map((date) =>
            fetch(`/api/learnings?date=${date}`)
              .then((r) => r.json())
              .then((j) => ({ date, items: j.items ?? [] }))
              .catch(() => ({ date, items: [] }))
          )
        ),
      ]);

      if (cancelled) return;

      const now = nowMinutes();
      const food = (dailyRes.food ?? []) as FoodApiRow[];
      const spending = (dailyRes.spending ?? []) as SpendApiRow[];
      const timeBlocks = (dailyRes.time_blocks ?? []) as TimeBlockApiRow[];
      const activities = (dailyRes.activities ?? []) as ActivityApiRow[];
      const calendar = (calendarRes.events ?? []) as CalendarApiRow[];
      const allTasks = (tasksRes.tasks ?? []) as TaskApiRow[];
      const tasks = allTasks.filter((t) => {
        if (!t.done) {
          if (dateOverride) {
            return localIsoDate(new Date(t.due_at)) === today;
          }
          return true;
        }
        return false;
      });
      const doneTasks = allTasks.filter((t) => {
        if (t.done) {
          return localIsoDate(new Date(t.due_at)) === today;
        }
        return false;
      });

      const blockRows: DashBlock[] = timeBlocks.map((b) => ({
        kind: "blk",
        id: b.id,
        start: b.start,
        end: b.end,
        label: b.activity,
        cat: b.category,
      }));

      const calendarRows: DashBlock[] = calendar.map((event) => ({
        kind: "cal",
        id: event.id,
        start: isoToTime(event.start),
        end: isoToTime(event.end),
        label: event.title,
        loc: event.location,
      }));

      const mealRows: DashBlock[] = food.map((f) => {
        const start = f.time || "12:00";
        return {
          kind: "meal",
          start,
          end: fromMinutes(toMinutes(start) + 30),
          label: f.name,
          kcal: f.calories,
          p: f.protein_g,
          est: f.estimated,
        };
      });

      const blocks = sortBlocks([...blockRows, ...calendarRows, ...mealRows]).map((b) => ({
        ...b,
        current: toMinutes(b.start) <= now && toMinutes(b.end) > now,
      }));

      const scheduled = blocks.reduce((sum, b) => sum + Math.max(0, toMinutes(b.end) - toMinutes(b.start)), 0);
      const elapsed = blocks.reduce((sum, b) => {
        const start = toMinutes(b.start);
        const end = toMinutes(b.end);
        if (start >= now) return sum;
        return sum + Math.max(0, Math.min(now, end) - start);
      }, 0);

      const taskRows: DashTask[] = tasks.map((task) => ({
        id: task.id,
        title: task.title,
        due: dueLabel(task.due_at),
        weight: weightForTask(task.title),
        context: "tasks",
        done: task.done,
        due_at: task.due_at,
      }));

      const doneTasksSorted = [...doneTasks].sort((a, b) => {
        const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0;
        const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0;
        return bTime - aTime;
      });

      const doneTaskRows: DashTask[] = doneTasksSorted.map((task) => ({
        id: task.id,
        title: task.title,
        due: dueLabel(task.due_at),
        weight: weightForTask(task.title),
        context: "tasks",
        done: task.done,
        due_at: task.due_at,
      }));

      const learningRows: DashLearning[] = learningsRes
        .flatMap((day: { date: string; items: { id: string; text: string }[] }) =>
          day.items.map((item) => ({
            id: item.id,
            isoDate: day.date,
            date: day.date === today ? "today" : format(new Date(`${day.date}T12:00:00`), "MMM d"),
            text: item.text,
            tag: "note",
          }))
        )
        .slice(0, 5);

      const meals = food.map((f) => ({
        id: f.id,
        t: f.time,
        label: f.name,
        kcal: f.calories,
        p: f.protein_g,
        cost: f.cost,
        est: f.estimated,
      }));

      const spend = spending.map((s) => ({
        id: s.id,
        t: s.time,
        label: s.item,
        amount: s.amount,
        cat: s.category,
      }));

      const feed = [
        ...food.map<DashFeed>((f) => ({
          t: f.time,
          who: "telegram",
          verb: "logged",
          obj: `${f.name} · ${f.calories} kcal · ${f.protein_g}g`,
          est: f.estimated,
        })),
        ...timeBlocks.map<DashFeed>((b) => ({
          t: b.start,
          who: "telegram",
          verb: "logged",
          obj: `${b.activity} ${b.start}-${b.end} (${b.category})`,
        })),
        ...calendar.map<DashFeed>((e) => ({
          t: isoToTime(e.start),
          who: "calendar",
          verb: "synced",
          obj: e.title,
        })),
        ...spending.map<DashFeed>((s) => ({
          t: s.time,
          who: "telegram",
          verb: "logged",
          obj: `${s.item} · ₹${s.amount.toFixed(2)}`,
        })),
        ...activities.map<DashFeed>((a) => ({
          t: a.time,
          who: a.actor,
          verb: a.verb,
          obj: a.body,
        })),
      ].sort((a, b) => toMinutes(b.t) - toMinutes(a.t));

      setData({
        NOW_MIN: now,
        TODAY: {
          dateIso: today,
          dateLong: format(new Date(`${today}T12:00:00`), "EEEE, MMMM d, yyyy"),
        },
        FOCUS: { title: taskRows[0]?.title ?? firstUsefulLine(goalsRes.content ?? "", "Choose the next important task.") },
        VISION_LINE: firstUsefulLine(
          visionRes.content ?? "",
          "Build tools that make one person feel like a team of ten."
        ),
        PROBLEMS: problemsRes.problems ?? [],
        BLOCKS: blocks,
        TASKS: taskRows,
        DONE_TASKS: doneTaskRows,
        ACTIVITIES: activities.sort((a, b) => toMinutes(b.time) - toMinutes(a.time)),
        LEARNINGS: learningRows,
        FEED: feed,
        MEALS: meals,
        SPEND: spend,
        VITALS: {
          kcal: { today: meals.reduce((sum, m) => sum + m.kcal, 0), target: 2400 },
          protein: { today: meals.reduce((sum, m) => sum + m.p, 0), target: 165 },
          spend: { today: spend.reduce((sum, s) => sum + s.amount, 0), target: 80 },
        },
        SCHEDULE_FOLLOWED_MIN: elapsed,
        SCHEDULE_ELAPSED_MIN: Math.max(1, elapsed || Math.min(scheduled, now - 6 * 60)),
      });
    }

    load().catch((error) => {
      console.error(error);
      if (!cancelled) setData(null);
    });

    return () => {
      cancelled = true;
    };
  }, [dateOverride]);

  return data;
}

type DayViewData = {
  blocks: DashBlock[];
  tasks: DashTask[];
};

export function useDayView(date: string, refreshTrigger?: number): DayViewData | null {
  const [data, setData] = useState<DayViewData | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [dailyRes, calendarRes, tasksRes] = await Promise.all([
        fetch(`/api/daily?date=${date}`).then((r) => r.json()).catch(() => ({})),
        fetch(`/api/calendar?date=${date}`).then((r) => r.json()).catch(() => ({ events: [] })),
        fetch("/api/tasks").then((r) => r.json()).catch(() => ({ tasks: [] })),
      ]);
      if (cancelled) return;

      const timeBlocks = (dailyRes.time_blocks ?? []) as TimeBlockApiRow[];
      const calendar = (calendarRes.events ?? []) as CalendarApiRow[];
      const allTasks = ((tasksRes.tasks ?? []) as TaskApiRow[]).filter((t) => !t.done);

      const blockRows: DashBlock[] = timeBlocks.map((b) => ({
        kind: "blk", id: b.id, start: b.start, end: b.end, label: b.activity, cat: b.category,
      }));

      const dayStart = new Date(`${date}T00:00:00`);
      const dayEnd = new Date(`${date}T23:59:59`);

      const calRows: DashBlock[] = [];
      for (const e of calendar) {
        if (!e.start || !e.end) continue;

        let evStart = e.start.length === 10 ? new Date(`${e.start}T00:00:00`) : new Date(e.start);
        let evEnd = e.end.length === 10 ? new Date(`${e.end}T00:00:00`) : new Date(e.end);

        // Adjust all-day events exclusive end date
        if (e.end.length === 10) {
          evEnd = new Date(evEnd.getTime() - 1000);
        }

        // Check if event overlaps with this day
        if (evStart <= dayEnd && evEnd >= dayStart) {
          // Clip event to this day
          const clippedStart = new Date(Math.max(evStart.getTime(), dayStart.getTime()));
          const clippedEnd = new Date(Math.min(evEnd.getTime(), dayEnd.getTime()));

          const formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
          const startStr = formatter.format(clippedStart);
          const endStr = formatter.format(clippedEnd);

          calRows.push({
            kind: "cal",
            id: e.id,
            start: startStr,
            end: endStr,
            label: e.title,
            loc: e.location,
          });
        }
      }

      const blocks = sortBlocks([...blockRows, ...calRows]);
      const taskRows: DashTask[] = allTasks
        .filter((t) => localIsoDate(parseISO(t.due_at)) === date)
        .map((t) => ({
          id: t.id, title: t.title, due: dueLabel(t.due_at),
          weight: weightForTask(t.title), context: "tasks", done: t.done,
          due_at: t.due_at,
        }));

      setData({ blocks, tasks: taskRows });
    }
    load().catch(console.error);
    return () => { cancelled = true; };
  }, [date, refreshTrigger]);
  return data;
}

export function LoadingPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <PageHeader active="cockpit" data={null} />
      <div style={{ padding: "40px", color: "var(--muted)" }}>Loading...</div>
    </div>
  );
}

export function Eyebrow({
  label,
  right,
  color = "var(--blue)",
  compact,
}: { label: string; right?: React.ReactNode; color?: string; compact?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontFamily: "var(--mono)",
        fontSize: 11,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: "var(--muted)",
        paddingBottom: compact ? 6 : 10,
        marginBottom: compact ? 10 : 14,
        borderBottom: `1px solid ${BROWN_LINE}`,
      }}
    >
      <span style={{ width: 6, height: 6, background: color, borderRadius: 1, transform: "rotate(45deg)" }} />
      <span style={{ color: "var(--text)" }}>{label}</span>
      {right && <span style={{ marginLeft: "auto", color: "var(--muted)" }}>{right}</span>}
    </div>
  );
}

const NAV_ITEMS = [
  { id: "cockpit", label: "Cockpit", href: "/" },
  { id: "scratchpad", label: "Scratchpad", href: "/scratchpad" },
  { id: "tasks", label: "Tasks & Learning", href: "/tasks" },
  { id: "activities", label: "Activities", href: "/activities" },
  { id: "calendar", label: "Calendar", href: "/calendar" },
  { id: "food", label: "Food & Spending", href: "/food" },
  { id: "workouts", label: "Workouts", href: "/workouts" },
  { id: "lifeswork", label: "Life's Work", href: "/lifeswork" },
];

function Nav({ active }: { active: "cockpit" | "calendar" | "tasks" | "food" | "activities" | "workouts" | "lifeswork" | "scratchpad" }) {
  return (
    <nav style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
      {NAV_ITEMS.map((item, idx) => (
        <div key={item.id} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          {idx > 0 && (
            <span
              style={{
                display: "inline-block",
                width: 1,
                height: 16,
                background: "var(--line-strong)",
                margin: "0 10px",
                opacity: 0.6,
                flexShrink: 0,
              }}
            />
          )}
          <Link
            href={item.href}
            className="mono uc"
            style={{
              fontSize: 10,
              letterSpacing: "0.18em",
              textDecoration: "none",
              padding: "5px 10px",
              borderRadius: 5,
              transition: "background 0.15s, color 0.15s",
              color: item.id === active ? "#fffaf0" : "var(--muted)",
              background: item.id === active ? "var(--blue)" : "transparent",
              fontWeight: item.id === active ? 600 : 400,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {item.label}
          </Link>
        </div>
      ))}
    </nav>
  );
}

export function PageHeader({ active, data }: { active: "cockpit" | "calendar" | "tasks" | "food" | "activities" | "workouts" | "lifeswork" | "scratchpad"; data: DashData | null }) {
  const now = data?.NOW_MIN ?? nowMinutes();
  const t = `${String(Math.floor(now / 60)).padStart(2, "0")}:${String(now % 60).padStart(2, "0")}`;
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "18px 24px",
        borderBottom: `1px solid ${BROWN_LINE}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 4,
            background: "var(--blue)",
            display: "grid",
            placeItems: "center",
            fontFamily: "var(--mono)",
            fontSize: 11,
            fontWeight: 700,
            color: "#fffaf0",
          }}
        >
          D
        </div>
        <div className="mono uc" style={{ fontSize: 11, color: "var(--text)", letterSpacing: "0.28em", fontWeight: 500 }}>
          DASH
        </div>
      </div>

      <span
        style={{
          display: "inline-block",
          width: 1,
          height: 16,
          background: "var(--line-strong)",
          opacity: 0.6,
          flexShrink: 0,
          margin: "0 4px",
        }}
      />

      <Nav active={active} />

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 18, flexShrink: 0 }}>
        <span className="mono" style={{ fontSize: 21, color: "var(--text)", fontWeight: 300, letterSpacing: "0", lineHeight: 1 }}>
          {t}
        </span>
        <span style={{ fontSize: 15.5, color: "var(--muted)", letterSpacing: "0.08em", lineHeight: 1.2, fontWeight: 300 }}>{data?.TODAY.dateLong ?? ""}</span>
        <span className="mono uc" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--blue)", letterSpacing: "0.2em", flexShrink: 0 }}>
          <span style={{ width: 5, height: 5, borderRadius: 999, background: "var(--blue)" }} />
          synced
        </span>
      </div>
    </header>
  );
}

function NextTaskCard({ data, onToggleTask }: { data: DashData; onToggleTask: (task: DashTask) => void }) {
  const nowMs = Date.now();
  const nextTask = data.TASKS.find((t) => new Date(t.due_at).getTime() >= nowMs) ?? data.TASKS[0];

  return (
    <div
      style={{
        padding: "22px 24px",
        borderRadius: 14,
        background: "linear-gradient(180deg, rgba(36,84,214,0.04), rgba(36,84,214,0.0))",
        border: "1px solid rgba(223,208,184,0.35)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 10,
      }}
    >
      <div className="mono uc" style={{ fontSize: 10, color: "var(--rose)", letterSpacing: "0.22em" }}>
        Next Task Focus
      </div>
      {nextTask ? (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <button
            type="button"
            onClick={() => onToggleTask(nextTask)}
            style={{
              width: 18,
              height: 18,
              border: "2px solid var(--blue)",
              borderRadius: 4,
              background: "transparent",
              cursor: "pointer",
              marginTop: 4,
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
            }}
            title="Complete Task"
          />
          <div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 400,
                color: "var(--text)",
                lineHeight: 1.3,
                letterSpacing: "0.01em",
              }}
            >
              {nextTask.title}
            </div>
            <div
              className="mono"
              style={{
                fontSize: 12,
                color: "var(--blue)",
                marginTop: 4,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span style={{ textTransform: "uppercase", border: "1px solid var(--blue)", padding: "1px 6px", borderRadius: 3, fontSize: 10 }}>
                {nextTask.weight}
              </span>
              <span>due {nextTask.due}</span>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 16, color: "var(--muted)", fontStyle: "italic" }}>
          No active tasks. Complete!
        </div>
      )}
    </div>
  );
}

function NextEventCard({ data }: { data: DashData }) {
  const nextEvent = data.BLOCKS.find((b) => toMinutes(b.start) > data.NOW_MIN || (toMinutes(b.start) <= data.NOW_MIN && toMinutes(b.end) > data.NOW_MIN));

  return (
    <div
      style={{
        padding: "22px 24px",
        borderRadius: 14,
        background: "linear-gradient(180deg, rgba(36,84,214,0.04), rgba(36,84,214,0.0))",
        border: "1px solid rgba(223,208,184,0.35)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 10,
      }}
    >
      <div className="mono uc" style={{ fontSize: 10, color: "var(--blue)", letterSpacing: "0.22em" }}>
        Next / Current Event
      </div>
      {nextEvent ? (
        <div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 400,
              color: "var(--text)",
              lineHeight: 1.3,
              letterSpacing: "0.01em",
            }}
          >
            {nextEvent.label}
          </div>
          <div
            className="mono"
            style={{
              fontSize: 12,
              color: "var(--muted)",
              marginTop: 4,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span
              style={{
                textTransform: "uppercase",
                background: toMinutes(nextEvent.start) <= data.NOW_MIN ? "rgba(36,84,214,0.15)" : "transparent",
                border: `1px solid ${toMinutes(nextEvent.start) <= data.NOW_MIN ? "var(--blue)" : "var(--muted)"}`,
                color: toMinutes(nextEvent.start) <= data.NOW_MIN ? "var(--blue)" : "var(--muted)",
                padding: "1px 6px",
                borderRadius: 3,
                fontSize: 10,
              }}
            >
              {toMinutes(nextEvent.start) <= data.NOW_MIN ? "NOW ACTIVE" : "UPCOMING"}
            </span>
            <span>
              {nextEvent.start} - {nextEvent.end}
              {toMinutes(nextEvent.start) <= data.NOW_MIN && ` (${toMinutes(nextEvent.end) - data.NOW_MIN}m left)`}
            </span>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 16, color: "var(--muted)", fontStyle: "italic" }}>
          No more events scheduled today.
        </div>
      )}
    </div>
  );
}

function VisionMoment({ data }: { data: DashData }) {
  const [isEditing, setIsEditing] = useState(false);
  const [visionText, setVisionText] = useState(data.VISION_LINE);
  const [isSaving, setIsSaving] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/lifeswork/vision", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: visionText }),
      });
      if (res.ok) {
        setIsEditing(false);
        window.location.reload();
      }
    } catch (e) {
      console.error("Failed to save vision:", e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: "18px 40px 22px",
        background: "radial-gradient(ellipse at 50% 45%, rgba(36,84,214,0.06), transparent 58%)",
        textAlign: "center",
      }}
    >
      <div 
        className="mono uc" 
        style={{ 
          fontSize: 11, 
          color: "var(--rose)", 
          letterSpacing: "0.28em", 
          marginBottom: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <span>Vision · long arc</span>
        {!isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--rose)",
              opacity: isHovered ? 0.7 : 0,
              transition: "opacity 0.15s, color 0.15s",
              padding: 2,
              display: "flex",
              alignItems: "center",
            }}
            onMouseOver={(e) => (e.currentTarget.style.color = "var(--blue)")}
            onMouseOut={(e) => (e.currentTarget.style.color = "var(--rose)")}
            title="Edit Vision"
          >
            <Pencil size={11} />
          </button>
        )}
      </div>
      
      {isEditing ? (
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          <textarea
            value={visionText}
            onChange={(e) => setVisionText(e.target.value)}
            disabled={isSaving}
            style={{
              width: "100%",
              minHeight: "60px",
              padding: "10px 14px",
              background: "var(--bg)",
              border: "1px solid var(--blue)",
              borderRadius: "6px",
              color: "var(--text)",
              fontSize: "20px",
              fontFamily: "var(--mono)",
              textAlign: "center",
              outline: "none",
              resize: "vertical",
              boxShadow: "0 0 0 2px rgba(36, 84, 214, 0.15)",
              margin: "6px auto 10px",
              display: "block",
            }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                handleSave();
              }
            }}
          />
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              style={{
                padding: "4px 14px",
                fontSize: "10px",
                fontFamily: "var(--mono)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                background: "var(--blue)",
                color: "#fffaf0",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setVisionText(data.VISION_LINE);
                setIsEditing(false);
              }}
              disabled={isSaving}
              style={{
                padding: "4px 14px",
                fontSize: "10px",
                fontFamily: "var(--mono)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                background: "transparent",
                color: "var(--muted)",
                border: "1px solid var(--line)",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div 
          className="mono" 
          onDoubleClick={() => setIsEditing(true)}
          style={{ 
            fontSize: 22, 
            lineHeight: 1.45, 
            color: "var(--text)", 
            fontWeight: 300, 
            letterSpacing: "0.02em", 
            textWrap: "balance", 
            maxWidth: 880, 
            margin: "0 auto",
            cursor: "pointer",
          }}
          title="Double click to edit"
        >
          &quot;{data.VISION_LINE}&quot;
        </div>
      )}
    </div>
  );
}

function ShapeOfDay({ data }: { data: DashData }) {
  const buckets = useMemo(() => {
    const result: Record<string, number> = {};
    let total = 0;
    data.BLOCKS.forEach((b) => {
      const key = b.kind === "cal" ? "Meetings" : b.kind === "meal" ? "Body" : b.cat || "Other";
      const dur = Math.max(0, toMinutes(b.end) - toMinutes(b.start));
      result[key] = (result[key] || 0) + dur;
      total += dur;
    });
    return { result, total };
  }, [data.BLOCKS]);

  const order = ["Deep Work", "Admin", "Learning", "Meetings", "Body", "Personal", "Other"].filter((k) => buckets.result[k]);
  const scheduledH = (buckets.total / 60).toFixed(1);
  const followedH = (data.SCHEDULE_FOLLOWED_MIN / 60).toFixed(1);
  const elapsedH = (data.SCHEDULE_ELAPSED_MIN / 60).toFixed(1);
  const adherence = Math.round((data.SCHEDULE_FOLLOWED_MIN / data.SCHEDULE_ELAPSED_MIN) * 100);

  return (
    <div>
      <Eyebrow label="Shape of today" compact />
      <div style={{ display: "flex", gap: 28, marginBottom: 12, alignItems: "baseline" }}>
        <div>
          <div className="mono" style={{ fontSize: 22, color: "var(--text)", fontWeight: 300 }}>
            {scheduledH}
            <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 3 }}>h</span>
          </div>
          <div className="mono uc" style={{ fontSize: 9, color: "var(--dim)", letterSpacing: "0.2em", marginTop: 4 }}>
            scheduled
          </div>
        </div>
        <div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 300 }}>
            <span style={{ color: "var(--text)" }}>{followedH}</span>
            <span style={{ color: "var(--dim)", fontSize: 14, fontWeight: 300 }}> / {elapsedH}</span>
            <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 3 }}>h</span>
          </div>
          <div className="mono uc" style={{ fontSize: 9, color: "var(--dim)", letterSpacing: "0.2em", marginTop: 4 }}>
            followed · <span style={{ color: adherence >= 80 ? "var(--blue)" : "var(--muted)" }}>{Number.isFinite(adherence) ? adherence : 0}%</span>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", height: 8, borderRadius: 2, overflow: "hidden", background: "var(--card-2)" }}>
        {order.map((k) => (
          <div key={k} style={{ width: `${(buckets.result[k] / buckets.total) * 100}%`, background: CAT_COLOR[k] ?? CAT_COLOR.Other }} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 10 }}>
        {order.map((k) => (
          <div key={k} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 1, background: CAT_COLOR[k] ?? CAT_COLOR.Other }} />
            <span style={{ fontSize: 12, color: "var(--text)" }}>{k}</span>
            <span className="mono" style={{ fontSize: 11, color: "var(--dim)" }}>
              {(buckets.result[k] / 60).toFixed(1)}h
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NowCard({ data }: { data: DashData }) {
  const current = data.BLOCKS.find((b) => toMinutes(b.start) <= data.NOW_MIN && toMinutes(b.end) > data.NOW_MIN);
  const next = data.BLOCKS.find((b) => toMinutes(b.start) > data.NOW_MIN);
  const remaining = current ? toMinutes(current.end) - data.NOW_MIN : 0;

  return (
    <div
      style={{
        padding: "28px 26px",
        background: "linear-gradient(180deg, rgba(36,84,214,0.07), rgba(36,84,214,0.0))",
        border: "1px solid var(--line-strong)",
        borderTop: "1px solid var(--blue)",
        borderRadius: 12,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <div className="mono uc" style={{ fontSize: 11.5, color: "var(--blue-soft)", letterSpacing: "0.22em", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--blue-soft)" }} />
        Now · {fromMinutes(data.NOW_MIN)}
      </div>
      {current ? (
        <div>
          <div style={{ fontSize: 24, fontWeight: 300, lineHeight: 1.25, color: "var(--text)", letterSpacing: "0.04em" }}>{current.label}</div>
          <div className="mono" style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 8 }}>
            {current.start}-{current.end} · {current.cat || current.kind}
          </div>
          <div className="mono" style={{ fontSize: 13.5, color: "var(--blue-soft)", marginTop: 6 }}>
            {remaining}m left
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 20, color: "var(--muted)", lineHeight: 1.3, letterSpacing: "0.06em" }}>Unstructured.</div>
      )}
      {next && (
        <div style={{ marginTop: "auto", paddingTop: 18, borderTop: "1px dashed var(--line)" }}>
          <div className="mono uc" style={{ fontSize: 10, color: "var(--dim)", letterSpacing: "0.2em", marginBottom: 6 }}>
            Up next · {next.start}
          </div>
          <div style={{ fontSize: 16, color: "var(--text)", lineHeight: 1.3 }}>{next.label}</div>
        </div>
      )}
    </div>
  );
}

function Breathe({ style }: { style?: React.CSSProperties }) {
  return (
    <div
      style={{
        padding: "16px 18px",
        border: "1px solid rgba(223,208,184,0.35)",
        borderRadius: 14,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        background: "linear-gradient(180deg, rgba(36,84,214,0.04), transparent)",
        ...style,
      }}
    >
      <style>{`
        @keyframes sigh { 0% { transform: scale(0.45); opacity: 0.55; } 35% { transform: scale(0.82); opacity: 0.92; } 42% { transform: scale(0.82); opacity: 0.92; } 55% { transform: scale(1); opacity: 1; } 95%,100% { transform: scale(0.45); opacity: 0.55; } }
        .breath-dot { animation: sigh 10s cubic-bezier(.5,.05,.5,.95) infinite; transform-origin: center; }
        @keyframes ph-in1 { 0%,35% { opacity: 1; } 40%,100% { opacity: 0; } }
        @keyframes ph-in2 { 0%,42% { opacity: 0; } 47%,55% { opacity: 1; } 60%,100% { opacity: 0; } }
        @keyframes ph-out { 0%,57% { opacity: 0; } 62%,95% { opacity: 1; } 100% { opacity: 0; } }
        .ph { position: absolute; inset: 0; display: grid; place-items: center; }
        .ph-1 { animation: ph-in1 10s cubic-bezier(.5,.05,.5,.95) infinite; }
        .ph-2 { animation: ph-in2 10s cubic-bezier(.5,.05,.5,.95) infinite; }
        .ph-3 { animation: ph-out 10s cubic-bezier(.5,.05,.5,.95) infinite; }
      `}</style>
      <div className="mono uc" style={{ fontSize: 10, color: "var(--blue)", letterSpacing: "0.28em" }}>Breathe</div>
      <div style={{ width: 60, height: 60, display: "grid", placeItems: "center" }}>
        <div className="breath-dot" style={{ width: 48, height: 48, borderRadius: 999, background: "radial-gradient(circle, rgba(36,84,214,0.40), rgba(36,84,214,0.04) 70%)", boxShadow: "0 0 20px rgba(36,84,214,0.12)" }} />
      </div>
      <div style={{ position: "relative", height: 18, width: "100%" }}>
        <div className="ph ph-1 mono uc" style={{ fontSize: 10, color: "var(--text)", letterSpacing: "0.18em" }}>Inhale ·····</div>
        <div className="ph ph-2 mono uc" style={{ fontSize: 10, color: "var(--text)", letterSpacing: "0.18em" }}>Top up</div>
        <div className="ph ph-3 mono uc" style={{ fontSize: 10, color: "var(--text)", letterSpacing: "0.18em" }}>Release ··········</div>
      </div>
      <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.04em", textAlign: "center", lineHeight: 1.35 }}>
        2 in (nose) · 1 long out (mouth) · 3x
      </div>
    </div>
  );
}

export function DeleteBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--dim)", fontSize: 16, padding: "0 2px", lineHeight: 1, flexShrink: 0 }}
    >
      ×
    </button>
  );
}

export function TaskRow({ t, onToggle, onDelete }: { t: DashTask; onToggle?: (task: DashTask) => void; onDelete?: (task: DashTask) => void }) {
  const weightColor = { S: "rgba(36,84,214,0.45)", M: "rgba(36,84,214,0.75)", L: "rgba(36,84,214,1)" }[t.weight];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "16px 1fr auto", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: "1px dashed var(--line)" }}>
      <button
        type="button"
        onClick={() => onToggle?.(t)}
        aria-label={t.done ? `Mark ${t.title} incomplete` : `Complete ${t.title}`}
        style={{
          width: 14,
          height: 14,
          border: "1px solid var(--line-strong)",
          borderRadius: 3,
          background: t.done ? "var(--blue)" : "transparent",
          padding: 0,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {t.done && (
          <span style={{ fontSize: 9, color: "#fffaf0", lineHeight: 1, fontWeight: "bold" }}>✓</span>
        )}
      </button>
      <div style={{ minWidth: 0, textDecoration: t.done ? "line-through" : "none", opacity: t.done ? 0.5 : 1 }}>
        <div style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.3 }}>{t.title}</div>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--dim)", marginTop: 2, letterSpacing: "0.04em" }}>{t.context}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: t.done ? 0.6 : 1 }}>
        <span className="mono" style={{ fontSize: 10, color: weightColor, padding: "2px 6px", border: `1px solid ${weightColor}`, borderRadius: 3 }}>{t.weight}</span>
        <span className="mono" style={{ fontSize: 11, color: "var(--blue)", minWidth: 88, textAlign: "right" }}>{t.due}</span>
        {onDelete && <DeleteBtn onClick={() => onDelete(t)} label="Delete task" />}
      </div>
    </div>
  );
}

function FeedRow({ f }: { f: DashFeed }) {
  const whoColor = {
    telegram: "var(--blue)",
    agent: "var(--blue-soft)",
    calendar: "var(--muted)",
    system: "var(--muted)",
    user: "var(--text)",
  }[f.who];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "54px 86px 1fr", gap: 12, alignItems: "baseline", padding: "10px 0", fontSize: 12, color: "var(--text)", borderBottom: `1px solid rgba(205,187,159,0.34)`, textTransform: "uppercase" }}>
      <span className="mono" style={{ color: "var(--dim)", fontSize: 11 }}>{f.t}</span>
      <span className="mono uc" style={{ color: whoColor, fontSize: 9, letterSpacing: "0.16em" }}>{f.who}</span>
      <span style={{ color: "var(--muted)", lineHeight: 1.45, letterSpacing: "0.06em" }}>
        <span style={{ color: "var(--text)" }}>{f.verb}</span> {f.obj}
        {f.est && <span className="mono" style={{ marginLeft: 6, fontSize: 9, color: "var(--blue)", border: "1px solid rgba(36,84,214,0.35)", padding: "1px 4px", borderRadius: 2 }}>~est</span>}
      </span>
    </div>
  );
}

function ActivityCard({ activity, onDelete }: { activity: ActivityApiRow; onDelete?: (activity: ActivityApiRow) => void }) {
  const actorColor = {
    telegram: "var(--blue)",
    agent: "var(--blue-soft)",
    calendar: "var(--muted)",
    system: "var(--muted)",
    user: "var(--text)",
  }[activity.actor];

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
        <div className="mono" style={{ fontSize: 26, fontWeight: 300, lineHeight: 1, color: "var(--text)", letterSpacing: "0.02em" }}>
          {activity.time}
        </div>
        <div className="mono uc" style={{ marginTop: 8, fontSize: 9, color: "var(--dim)", letterSpacing: "0.22em" }}>
          IST
        </div>
      </div>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: actorColor }} />
          <span className="mono uc" style={{ fontSize: 10, color: actorColor, letterSpacing: "0.22em" }}>
            {activity.actor}
          </span>
          <span className="mono uc" style={{ fontSize: 10, color: "var(--dim)", letterSpacing: "0.22em" }}>
            {activity.kind}
          </span>
        </div>
        <div style={{ fontSize: 17, lineHeight: 1.45, color: "var(--text)", letterSpacing: "0.08em", fontWeight: 300, textWrap: "pretty" }}>
          {activity.body}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
        <div className="mono uc" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.18em", whiteSpace: "nowrap" }}>
          {activity.verb}
        </div>
        {onDelete && <DeleteBtn onClick={() => onDelete(activity)} label="Delete activity" />}
      </div>
    </article>
  );
}

export function LearningRow({ l, onDelete }: { l: DashLearning; onDelete?: (l: DashLearning) => void }) {
  return (
    <div style={{ padding: "10px 0", borderBottom: "1px dashed var(--line)" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
        <span className="mono uc" style={{ fontSize: 9, color: "var(--dim)", letterSpacing: "0.16em", minWidth: 64 }}>{l.date}</span>
        <span className="mono uc" style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.16em" }}>{l.tag}</span>
        {onDelete && <span style={{ marginLeft: "auto" }}><DeleteBtn onClick={() => onDelete(l)} label="Delete learning" /></span>}
      </div>
      <div style={{ fontSize: 13, color: "var(--text)", marginTop: 4, lineHeight: 1.45, textWrap: "pretty" }}>{l.text}</div>
    </div>
  );
}

function MealRow({ m, onDelete }: { m: DashData["MEALS"][number]; onDelete?: (m: DashData["MEALS"][number]) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "56px 1fr 64px 50px 24px", gap: 14, alignItems: "center", padding: "12px 0", borderBottom: "1px dashed var(--line)", fontSize: 14 }}>
      <span className="mono" style={{ color: "var(--dim)", fontSize: 11 }}>{m.t}</span>
      <span style={{ color: m.planned ? "var(--muted)" : "var(--text)" }}>
        {m.label}
        {m.planned && <span className="mono uc" style={{ marginLeft: 8, fontSize: 9, color: "var(--dim)", letterSpacing: "0.16em" }}>· planned</span>}
        {m.est && <span className="mono" style={{ marginLeft: 8, fontSize: 9, color: "var(--blue)", border: "1px solid rgba(36,84,214,0.35)", padding: "1px 4px", borderRadius: 2 }}>~est</span>}
      </span>
      <span className="mono" style={{ color: "var(--text)", textAlign: "right" }}>{m.kcal}<span style={{ color: "var(--dim)", fontSize: 10, marginLeft: 2 }}>kcal</span></span>
      <span className="mono" style={{ color: "var(--blue)", textAlign: "right" }}>{m.p}<span style={{ color: "var(--dim)", fontSize: 10, marginLeft: 2 }}>g</span></span>
      <span>{onDelete && <DeleteBtn onClick={() => onDelete(m)} label="Delete meal" />}</span>
    </div>
  );
}

function SpendRow({ s, onDelete }: { s: DashData["SPEND"][number]; onDelete?: (s: DashData["SPEND"][number]) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "56px 1fr 70px 70px 24px", gap: 12, alignItems: "center", padding: "12px 0", borderBottom: "1px dashed var(--line)", fontSize: 14 }}>
      <span className="mono" style={{ color: "var(--dim)", fontSize: 11 }}>{s.t}</span>
      <span style={{ color: "var(--text)" }}>{s.label}</span>
      <span className="mono uc" style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.16em" }}>{s.cat}</span>
      <span className="mono" style={{ color: "var(--text)", textAlign: "right" }}>₹{s.amount.toFixed(2)}</span>
      <span>{onDelete && <DeleteBtn onClick={() => onDelete(s)} label="Delete spend" />}</span>
    </div>
  );
}

function LedgerHeader({ items }: { items: { label: string; value: string | number; of?: string | number; unit?: string }[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 28, alignItems: "baseline", marginBottom: 22 }}>
      {items.map((it) => (
        <div key={it.label} style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span className="mono" style={{ fontSize: 24, color: "var(--text)", fontWeight: 300 }}>{it.value}</span>
          {it.unit && <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{it.unit}</span>}
          {it.of != null && <span className="mono" style={{ fontSize: 11, color: "var(--dim)", marginLeft: 2 }}>/ {it.of}{it.unit ? ` ${it.unit}` : ""}</span>}
          <span className="mono uc" style={{ fontSize: 9, color: "var(--dim)", letterSpacing: "0.2em", marginLeft: 8 }}>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

function PageIntro({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "40px 40px 32px", borderBottom: "1px solid var(--line)", display: "grid", gridTemplateColumns: "180px 1fr", columnGap: 32, alignItems: "baseline" }}>
      <div className="mono uc" style={{ fontSize: 12, color: "var(--rose)", letterSpacing: "0.28em" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 300, color: "var(--text)", lineHeight: 1.25, letterSpacing: "0.04em", maxWidth: 720, textWrap: "balance" }}>{children}</div>
    </div>
  );
}

function MiniDayTimeline({ blocks, nowMin }: { blocks: DashBlock[]; nowMin: number }) {
  const HOUR_MARKS = [8, 10, 12, 14, 16, 18, 20, 22];
  const LABEL_W = 28;
  return (
    <div>
      <Eyebrow label="Today" right={<Link href="/calendar" style={{ color: "var(--blue)", fontSize: 10, fontFamily: "var(--mono)", letterSpacing: "0.12em", textDecoration: "none" }}>full →</Link>} />
      <div style={{ position: "relative", height: 220 }}>
        {HOUR_MARKS.map((h) => (
          <div key={h} style={{ position: "absolute", top: `${tlPct(h * 60)}%`, left: 0, right: 0, display: "flex", alignItems: "center", gap: 6, pointerEvents: "none" }}>
            <span className="mono" style={{ fontSize: 9, color: "var(--dim)", width: LABEL_W, textAlign: "right", flexShrink: 0, lineHeight: 1 }}>{h}</span>
            <div style={{ flex: 1, borderTop: "1px solid var(--line)" }} />
          </div>
        ))}
        {blocks.map((b, i) => {
          const top = tlPct(toMinutes(b.start));
          const h = Math.max(tlPct(toMinutes(b.end)) - top, 1.2);
          const bgColor = b.kind === "cal" ? "#1e5a8f" : (CAT_COLOR[b.cat || "Other"] ?? CAT_COLOR.Other);
          return (
            <div key={i} title={`${b.start}–${b.end} ${b.label}`} style={{ position: "absolute", top: `${top}%`, height: `${h}%`, left: LABEL_W + 10, right: 2, background: bgColor, borderRadius: 2, padding: "1px 4px", overflow: "hidden" }}>
              <span style={{ fontSize: 9, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block", lineHeight: 1.3 }}>{b.label}</span>
            </div>
          );
        })}
        {blocks.length === 0 && (
          <div style={{ position: "absolute", top: "50%", left: LABEL_W + 10, right: 0, transform: "translateY(-50%)", textAlign: "center" }}>
            <span className="mono uc" style={{ fontSize: 9, color: "var(--dim)", letterSpacing: "0.14em" }}>No events yet</span>
          </div>
        )}
        {nowMin >= TL_START && nowMin <= TL_END && (
          <div style={{ position: "absolute", top: `${tlPct(nowMin)}%`, left: LABEL_W + 6, right: 0, zIndex: 2, display: "flex", alignItems: "center", pointerEvents: "none" }}>
            <div style={{ width: 5, height: 5, borderRadius: 999, background: "var(--rose)", flexShrink: 0 }} />
            <div style={{ flex: 1, height: 1, background: "var(--rose)" }} />
          </div>
        )}
      </div>
    </div>
  );
}

export function DayTimeline({ blocks, tasks, nowMin, isToday }: { blocks: DashBlock[]; tasks: DashTask[]; nowMin: number; isToday: boolean }) {
  const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
  const LABEL_W = 36;
  return (
    <div style={{ position: "relative", height: 560, userSelect: "none" }}>
      {HOURS.map((h) => (
        <div key={h} style={{ position: "absolute", top: `${tlPct(h * 60)}%`, left: 0, right: 0, display: "flex", alignItems: "flex-start", gap: 10, pointerEvents: "none" }}>
          <span className="mono" style={{ fontSize: 10, color: "var(--dim)", width: LABEL_W, textAlign: "right", flexShrink: 0, lineHeight: 1, marginTop: -7 }}>{h < 10 ? `0${h}` : h}:00</span>
          <div style={{ flex: 1, borderTop: "1px solid var(--line)" }} />
        </div>
      ))}
      {blocks.map((b, i) => {
        const top = tlPct(toMinutes(b.start));
        const h = Math.max(tlPct(toMinutes(b.end)) - top, 1.5);
        const isCal = b.kind === "cal";
        // Calendar events: distinct teal-blue solid; time blocks: category color
        const bgColor = isCal ? "#1e5a8f" : (CAT_COLOR[b.cat || "Other"] ?? CAT_COLOR.Other);
        return (
          <div key={i} style={{ position: "absolute", top: `${top}%`, height: `${h}%`, left: LABEL_W + 14, right: 0, background: bgColor, borderRadius: 4, padding: "5px 10px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.18)" }}>
            <div style={{ fontSize: 13, color: "#fff", fontWeight: 600, lineHeight: 1.25, letterSpacing: "0.01em", textTransform: "uppercase" }}>{b.label}</div>
            <div className="mono" style={{ fontSize: 10, color: "rgba(255,255,255,0.78)", marginTop: 2 }}>
              {b.start}–{b.end}{b.cat && !isCal ? ` · ${b.cat}` : ""}{b.loc ? ` · ${b.loc}` : ""}
            </div>
          </div>
        );
      })}
      {tasks.map((t, i) => (
        <div key={i} style={{ position: "absolute", left: LABEL_W + 14, zIndex: 3, top: `${tlPct(toMinutes(t.due.includes(":") ? t.due.split(" ").pop()! : "23:59"))}%` }}>
          <span className="mono uc" style={{ fontSize: 9, color: "var(--rose)", border: "1px solid rgba(205,92,92,0.5)", borderRadius: 2, padding: "1px 5px", background: "var(--bg)", display: "inline-block", whiteSpace: "nowrap", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }}>
            ✓ {t.title}
          </span>
        </div>
      ))}
      {isToday && nowMin >= TL_START && nowMin <= TL_END && (
        <div style={{ position: "absolute", top: `${tlPct(nowMin)}%`, left: LABEL_W + 10, right: 0, zIndex: 2, display: "flex", alignItems: "center", pointerEvents: "none" }}>
          <div style={{ width: 7, height: 7, borderRadius: 999, background: "var(--rose)", flexShrink: 0, marginTop: -3 }} />
          <div style={{ flex: 1, height: 1, background: "var(--rose)" }} />
        </div>
      )}
      {blocks.length === 0 && (
        <div style={{ position: "absolute", top: "40%", left: LABEL_W + 14, right: 0, textAlign: "center" }}>
          <div className="mono uc" style={{ fontSize: 11, color: "var(--dim)", letterSpacing: "0.2em" }}>No events</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>Send time blocks via Telegram, e.g. "6-7 gym"</div>
        </div>
      )}
    </div>
  );
}

function parseBulletPoints(content: string): string[] {
  if (!content) return [];
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
}

function ProblemRow({ id, text, onSolve }: { id: string; text: string; onSolve?: (id: string) => void }) {
  const [hovered, setHovered] = useState(false);
  const [solving, setSolving] = useState(false);

  const handleSolve = () => {
    if (!onSolve) return;
    setSolving(true);
    setTimeout(() => {
      onSolve(id);
    }, 200);
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 0",
        transition: "transform 0.15s, opacity 0.2s",
        transform: hovered ? "translateX(4px)" : "none",
        opacity: solving ? 0 : 1,
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "start", flex: 1 }}>
        <span className="mono" style={{ color: hovered ? "var(--rose)" : "var(--blue)", fontSize: 15, marginTop: 1, lineHeight: 1.25, transition: "color 0.15s" }}>↳</span>
        <span style={{ fontSize: 16, color: hovered ? "var(--text)" : "var(--muted)", lineHeight: 1.45, letterSpacing: "0.02em", transition: "color 0.15s", textTransform: "none" }}>
          {text}
        </span>
      </div>
      {onSolve && hovered && (
        <button
          onClick={handleSolve}
          className="mono uc"
          style={{
            fontSize: 9,
            background: "transparent",
            border: "1px solid var(--rose)",
            color: "var(--rose)",
            padding: "2px 6px",
            borderRadius: 4,
            cursor: "pointer",
            transition: "background 0.15s, color 0.15s",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = "var(--rose)";
            e.currentTarget.style.color = "#fff";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--rose)";
          }}
        >
          solve
        </button>
      )}
    </div>
  );
}

function ActiveProblems({ data, onSolve }: { data: DashData; onSolve: (id: string) => void }) {
  const problems = data.PROBLEMS;

  return (
    <div
      style={{
        padding: "22px 24px",
        border: "1px solid rgba(223,208,184,0.35)",
        borderRadius: 14,
        background: "linear-gradient(180deg, rgba(36,84,214,0.04), transparent)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="mono uc" style={{ fontSize: 11, color: "var(--blue)", letterSpacing: "0.22em", fontWeight: 600 }}>
          Active Problems
        </span>
        <Link
          href="/lifeswork?section=problems"
          className="mono uc"
          style={{
            fontSize: 9.5,
            color: "var(--dim)",
            letterSpacing: "0.12em",
            textDecoration: "none",
            transition: "color 0.15s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.color = "var(--blue)")}
          onMouseOut={(e) => (e.currentTarget.style.color = "var(--dim)")}
        >
          edit →
        </Link>
      </div>
      
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {problems.length > 0 ? (
          problems.map((p) => (
            <ProblemRow key={p.id} id={p.id} text={p.text} onSolve={onSolve} />
          ))
        ) : (
          <div className="mono uc" style={{ fontSize: 10.5, color: "var(--dim)", letterSpacing: "0.14em", padding: "8px 0" }}>
            No active problems
          </div>
        )}
      </div>
    </div>
  );
}

export function CockpitPage() {
  const data = useDashData();

  const toggleTask = useCallback(async (task: DashTask) => {
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !task.done }),
    });
    window.location.reload();
  }, []);

  const solveProblem = useCallback(async (id: string) => {
    await fetch(`/api/problems/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ solved: true }),
    });
    window.location.reload();
  }, []);

  const deleteTask = useCallback(async (task: DashTask) => {
    await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    window.location.reload();
  }, []);

  if (!data) return <LoadingPage />;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <PageHeader active="cockpit" data={data} />
      <VisionMoment data={data} />

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20, padding: "20px 40px 40px", flex: 1, alignContent: "start" }}>
        {/* Left Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <NextTaskCard data={data} onToggleTask={toggleTask} />
          <ActiveProblems data={data} onSolve={solveProblem} />
        </div>

        {/* Right Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <NextEventCard data={data} />
          <Breathe />
        </div>
      </div>
    </div>
  );
}

export function ActivitiesPage() {
  const data = useDashData();
  const deleteActivity = useCallback(async (activity: ActivityApiRow) => {
    await fetch("/api/activities", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: activity.id }),
    });
    window.location.reload();
  }, []);

  if (!data) return <LoadingPage />;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <PageHeader active="activities" data={data} />
      <main style={{ padding: "34px 40px 48px", flex: 1 }}>
        <section
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            borderTop: `2px solid ${BLUE_LINE}`,
            borderBottom: `1px solid ${BROWN_LINE}`,
          }}
        >
          {data.ACTIVITIES.length ? (
            data.ACTIVITIES.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} onDelete={deleteActivity} />
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
              No activity saved today
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export function FoodSpendingPage() {
  const [date, setDate] = useState(() => localIsoDate());
  const data = useDashData(date);
  const [showAllSpend, setShowAllSpend] = useState(false);
  const [showAllFood, setShowAllFood] = useState(false);
  const [viewDate, setViewDate] = useState(() => new Date(date));

  // Spending form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [item, setItem] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Other");
  const [time, setTime] = useState("");
  const [loading, setLoading] = useState(false);

  // Sync calendar view when date changes
  useEffect(() => {
    setViewDate(new Date(date));
  }, [date]);

  // Set default current time when opening the form
  useEffect(() => {
    if (showAddForm) {
      try {
        const timeStr = new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date());
        setTime(timeStr);
      } catch (e) {
        setTime("12:00");
      }
    }
  }, [showAddForm]);

  const handleAddSpend = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item.trim() || !amount) return;

    setLoading(true);
    try {
      const res = await fetch("/api/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          type: "spending",
          data: {
            item: item.trim(),
            amount: parseFloat(amount),
            category,
            time: time || "00:00",
          },
        }),
      });

      if (res.ok) {
        setItem("");
        setAmount("");
        setCategory("Other");
        setShowAddForm(false);
        window.location.reload();
      } else {
        const errorText = await res.text();
        alert(`Error adding spending: ${errorText}`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to add spending entry");
    } finally {
      setLoading(false);
    }
  }, [date, item, amount, category, time]);

  const deleteMeal = useCallback(async (m: DashData["MEALS"][number]) => {
    await fetch("/api/daily", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "food", id: m.id }),
    });
    window.location.reload();
  }, []);

  const deleteSpend = useCallback(async (s: DashData["SPEND"][number]) => {
    await fetch("/api/daily", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "spending", id: s.id }),
    });
    window.location.reload();
  }, []);

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
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <PageHeader active="food" data={data} />
      
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", flex: 1 }}>
        {/* Left Panel: Spending and Food */}
        <div style={{ padding: "32px 40px", display: "flex", flexDirection: "column", gap: 38, borderRight: `1px solid ${BROWN_LINE}` }}>
          {/* Header showing selected date */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${BROWN_LINE}`, paddingBottom: 16 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 300, color: "var(--text)" }}>
              {data.TODAY.dateLong}
            </h1>
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

          {/* Spending Section (placed above food) */}
          <div>
            <Eyebrow
              label="Spending"
              right={
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span>{data.SPEND.length} items</span>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(!showAddForm)}
                    style={{
                      background: showAddForm ? "var(--rose)" : "var(--blue)",
                      color: "#fffaf0",
                      border: "none",
                      padding: "4px 10px",
                      cursor: "pointer",
                      fontFamily: "var(--mono)",
                      fontSize: 10,
                      borderRadius: 4,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      fontWeight: 600,
                      transition: "background 0.15s ease, transform 0.1s ease",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.filter = "brightness(1.15)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.filter = "none";
                    }}
                  >
                    {showAddForm ? "Cancel" : "+ Add"}
                  </button>
                </div>
              }
            />
            <LedgerHeader items={[{ label: "spent", value: `₹${data.VITALS.spend.today.toFixed(2)}`, of: `₹${data.VITALS.spend.target}` }]} />

            {showAddForm && (
              <form
                onSubmit={handleAddSpend}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  padding: "16px 20px",
                  background: "linear-gradient(180deg, rgba(36,84,214,0.06), transparent)",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  marginBottom: 24,
                  animation: "fadeIn 0.2s ease-out",
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label className="mono uc" style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.1em" }}>Item Name</label>
                    <input
                      type="text"
                      required
                      placeholder="What did you buy?"
                      value={item}
                      onChange={(e) => setItem(e.target.value)}
                      style={{
                        padding: "8px 12px",
                        border: "1px solid var(--line)",
                        borderRadius: 6,
                        background: "var(--bg)",
                        color: "var(--text)",
                        fontSize: 14,
                        fontFamily: "inherit",
                        outline: "none",
                        transition: "border-color 0.15s",
                      }}
                      onFocus={(e) => e.target.style.borderColor = "var(--blue)"}
                      onBlur={(e) => e.target.style.borderColor = "var(--line)"}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label className="mono uc" style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.1em" }}>Amount (₹)</label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="any"
                      placeholder="Amount"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      style={{
                        padding: "8px 12px",
                        border: "1px solid var(--line)",
                        borderRadius: 6,
                        background: "var(--bg)",
                        color: "var(--text)",
                        fontSize: 14,
                        fontFamily: "var(--mono)",
                        outline: "none",
                        transition: "border-color 0.15s",
                      }}
                      onFocus={(e) => e.target.style.borderColor = "var(--blue)"}
                      onBlur={(e) => e.target.style.borderColor = "var(--line)"}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label className="mono uc" style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.1em" }}>Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      style={{
                        padding: "8px 12px",
                        border: "1px solid var(--line)",
                        borderRadius: 6,
                        background: "var(--bg)",
                        color: "var(--text)",
                        fontSize: 14,
                        fontFamily: "inherit",
                        outline: "none",
                        cursor: "pointer",
                        transition: "border-color 0.15s",
                      }}
                      onFocus={(e) => e.target.style.borderColor = "var(--blue)"}
                      onBlur={(e) => e.target.style.borderColor = "var(--line)"}
                    >
                      <option value="Food">Food</option>
                      <option value="Transport">Transport</option>
                      <option value="Health">Health</option>
                      <option value="Entertainment">Entertainment</option>
                      <option value="Shopping">Shopping</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label className="mono uc" style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.1em" }}>Time (HH:MM)</label>
                    <input
                      type="text"
                      placeholder="HH:MM"
                      pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$"
                      title="Please enter time in HH:MM format (24-hour clock)"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      style={{
                        padding: "8px 12px",
                        border: "1px solid var(--line)",
                        borderRadius: 6,
                        background: "var(--bg)",
                        color: "var(--text)",
                        fontSize: 14,
                        fontFamily: "var(--mono)",
                        outline: "none",
                        transition: "border-color 0.15s",
                      }}
                      onFocus={(e) => e.target.style.borderColor = "var(--blue)"}
                      onBlur={(e) => e.target.style.borderColor = "var(--line)"}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: "var(--blue)",
                    color: "#fffaf0",
                    border: "none",
                    padding: "10px",
                    cursor: loading ? "not-allowed" : "pointer",
                    fontFamily: "var(--mono)",
                    fontSize: 12,
                    borderRadius: 6,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    fontWeight: 600,
                    opacity: loading ? 0.7 : 1,
                    transition: "filter 0.15s ease",
                  }}
                  onMouseOver={(e) => {
                    if (!loading) e.currentTarget.style.filter = "brightness(1.1)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.filter = "none";
                  }}
                >
                  {loading ? "Saving..." : "Save Spending"}
                </button>
              </form>
            )}

            {data.SPEND.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {data.SPEND.slice(0, showAllSpend ? 10 : 3).map((s, i) => (
                  <SpendRow key={s.id || i} s={s} onDelete={deleteSpend} />
                ))}

                {data.SPEND.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setShowAllSpend(!showAllSpend)}
                    style={{
                      marginTop: 10,
                      background: "none",
                      border: "none",
                      color: "var(--blue)",
                      cursor: "pointer",
                      fontSize: 11,
                      fontFamily: "var(--mono)",
                      alignSelf: "flex-start",
                      padding: "4px 0",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      fontWeight: 600,
                    }}
                  >
                    {showAllSpend ? "See less" : `See more (last ${Math.min(data.SPEND.length, 10)})`}
                  </button>
                )}
              </div>
            ) : (
              <div className="mono uc" style={{ fontSize: 10.5, color: "var(--dim)", padding: "16px 0", letterSpacing: "0.14em" }}>
                No spending logged for this day
              </div>
            )}
          </div>

          {/* Food Section (placed below spending) */}
          <div>
            <Eyebrow label="Food" right={`${data.MEALS.length} logged`} />
            <LedgerHeader items={[
              { label: "kcal", value: data.VITALS.kcal.today, of: data.VITALS.kcal.target },
              { label: "protein", value: data.VITALS.protein.today, of: data.VITALS.protein.target, unit: "g" },
            ]} />
            
            {data.MEALS.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {data.MEALS.slice(0, showAllFood ? 10 : 3).map((m, i) => (
                  <MealRow key={m.id || i} m={m} onDelete={deleteMeal} />
                ))}
                
                {data.MEALS.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setShowAllFood(!showAllFood)}
                    style={{
                      marginTop: 10,
                      background: "none",
                      border: "none",
                      color: "var(--blue)",
                      cursor: "pointer",
                      fontSize: 11,
                      fontFamily: "var(--mono)",
                      alignSelf: "flex-start",
                      padding: "4px 0",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      fontWeight: 600,
                    }}
                  >
                    {showAllFood ? "See less" : `See more (last ${Math.min(data.MEALS.length, 10)})`}
                  </button>
                )}
              </div>
            ) : (
              <div className="mono uc" style={{ fontSize: 10.5, color: "var(--dim)", padding: "16px 0", letterSpacing: "0.14em" }}>
                No food logged for this day
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Calendar picker */}
        <div style={{ padding: "32px 36px", display: "flex", flexDirection: "column", gap: 24 }}>
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
                const isToday = day.isoStr === localIsoDate();
                
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
                      border: isToday && !isSelected ? "1px solid var(--blue)" : "none",
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

          {/* Vitals Summary Card */}
          <div
            style={{
              marginTop: 8,
              padding: "16px 20px",
              background: "linear-gradient(180deg, rgba(36,84,214,0.06), transparent)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div className="mono uc" style={{ fontSize: 10.5, color: "var(--blue)", letterSpacing: "0.18em", fontWeight: 600 }}>
              Day Summary
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 12.5, color: "var(--muted)", textTransform: "uppercase" }}>Spending</span>
                <span className="mono" style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>
                  ₹{data.VITALS.spend.today.toFixed(0)} <span style={{ color: "var(--dim)", fontSize: 10 }}>/ ₹{data.VITALS.spend.target}</span>
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 12.5, color: "var(--muted)", textTransform: "uppercase" }}>Calories</span>
                <span className="mono" style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>
                  {data.VITALS.kcal.today} <span style={{ color: "var(--dim)", fontSize: 10 }}>/ {data.VITALS.kcal.target} kcal</span>
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 12.5, color: "var(--muted)", textTransform: "uppercase" }}>Protein</span>
                <span className="mono" style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>
                  {data.VITALS.protein.today}g <span style={{ color: "var(--dim)", fontSize: 10 }}>/ {data.VITALS.protein.target}g</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CalendarPage() {
  const [date, setDate] = useState(localIsoDate());
  const today = localIsoDate();
  const dayData = useDayView(date);
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

  function shiftDate(delta: number) {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + delta);
    setDate(localIsoDate(d));
  }

  const labelDate = format(new Date(`${date}T12:00:00`), "EEEE, MMMM d, yyyy");

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <PageHeader active="calendar" data={null} />

      {/* Date nav */}
      <div style={{ padding: "22px 40px", borderBottom: `1px solid ${BROWN_LINE}`, display: "flex", alignItems: "center", gap: 24 }}>
        <button type="button" onClick={() => shiftDate(-1)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 18, padding: "0 4px", lineHeight: 1 }}>‹</button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 300, color: "var(--text)", letterSpacing: "0.04em" }}>{labelDate}</div>
          {isToday && <div className="mono uc" style={{ fontSize: 10, color: "var(--blue)", letterSpacing: "0.22em", marginTop: 4 }}>today</div>}
        </div>
        <button type="button" onClick={() => shiftDate(1)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 18, padding: "0 4px", lineHeight: 1 }}>›</button>
        {!isToday && (
          <button type="button" onClick={() => setDate(today)} style={{ background: "none", border: "1px solid var(--line)", borderRadius: 4, cursor: "pointer", color: "var(--muted)", fontSize: 11, padding: "4px 10px", fontFamily: "var(--mono)", letterSpacing: "0.1em" }}>today</button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr minmax(280px, 340px)", flex: 1 }}>
        {/* Timeline */}
        <div style={{ padding: "32px 40px", overflowY: "auto" }}>
          <Eyebrow label="Events & Schedule" right={`${dayData?.blocks.length ?? 0} blocks`} />
          {dayData ? (
            <DayTimeline blocks={dayData.blocks} tasks={[]} nowMin={now} isToday={isToday} />
          ) : (
            <div style={{ color: "var(--muted)", padding: "40px 0" }}>Loading…</div>
          )}
        </div>

        {/* Right Panel: Calendar picker */}
        <div style={{ padding: "32px 36px", display: "flex", flexDirection: "column", gap: 24, borderLeft: `1px solid ${BROWN_LINE}` }}>
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
                const isToday = day.isoStr === localIsoDate();
                
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
                      border: isToday && !isSelected ? "1px solid var(--blue)" : "none",
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
