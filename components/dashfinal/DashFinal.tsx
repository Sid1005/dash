"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { format, parseISO, subDays } from "date-fns";
import { Pencil, Sun, Moon, ChevronLeft, ChevronRight, Calendar as CalendarIcon, X, ArrowDown, Layers, RotateCcw, Check, Plus, Trash2, GripVertical } from "lucide-react";

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

export type QuoteRow = {
  id: string;
  text: string;
  author: string | null;
  created_at: string;
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
  QUOTES: QuoteRow[];
};

type CockpitCardItem = {
  id: string;
  text: string;
  done: boolean;
};

type CockpitPostcard = {
  id: string;
  title: string;
  x: number;
  y: number;
  items: CockpitCardItem[];
};

type SystemPostcardId = "next" | "problems";

type SystemPostcardPositions = Record<SystemPostcardId, { x: number; y: number }>;

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

export function dueLabel(iso: string) {
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

export function weightForTask(title: string): "S" | "M" | "L" {
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

export function useDashData(
  dateOverride?: string,
  refreshTrigger?: number,
  options?: {
    includeLearnings?: boolean;
    includeTasks?: boolean;
    includeCalendar?: boolean;
    includeProblems?: boolean;
    includeQuotes?: boolean;
  }
): DashData | null {
  const [data, setData] = useState<DashData | null>(null);

  const includeLearnings = options?.includeLearnings ?? true;
  const includeTasks = options?.includeTasks ?? true;
  const includeCalendar = options?.includeCalendar ?? true;
  const includeProblems = options?.includeProblems ?? true;
  const includeQuotes = options?.includeQuotes ?? true;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const today = dateOverride || localIsoDate();
      const learningDates = Array.from({ length: 14 }, (_, i) => localIsoDate(subDays(new Date(today), i)));

      const dailyResPromise = fetch(`/api/daily?date=${today}`).then((r) => r.json());

      const tasksResPromise = includeTasks
        ? fetch("/api/tasks").then((r) => r.json()).catch(() => ({ tasks: [] }))
        : Promise.resolve({ tasks: [] });

      const calendarResPromise = includeCalendar
        ? fetch(`/api/calendar?date=${today}`).then((r) => r.json()).catch(() => ({ events: [] }))
        : Promise.resolve({ events: [] });

      const problemsResPromise = includeProblems
        ? fetch("/api/problems").then((r) => r.json()).catch(() => ({ problems: [] }))
        : Promise.resolve({ problems: [] });

      const learningsResPromise = includeLearnings
        ? fetch(`/api/learnings?startDate=${learningDates[13]}&endDate=${today}`)
            .then((r) => r.json())
            .then((j) => {
              const items = (j.items ?? []) as { id: string; text: string; date: string }[];
              return learningDates.map((d) => ({
                date: d,
                items: items.filter((item) => item.date === d),
              }));
            })
            .catch(() => learningDates.map((d) => ({ date: d, items: [] })))
        : Promise.resolve([]);

      const quotesResPromise = includeQuotes
        ? fetch("/api/quotes").then((r) => r.json()).catch(() => ({ quotes: [] }))
        : Promise.resolve({ quotes: [] });

      const [
        dailyRes,
        tasksRes,
        calendarRes,
        problemsRes,
        learningsRes,
        quotesRes,
      ] = await Promise.all([
        dailyResPromise,
        tasksResPromise,
        calendarResPromise,
        problemsResPromise,
        learningsResPromise,
        quotesResPromise,
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
        FOCUS: { title: taskRows[0]?.title ?? "Choose the next important task." },
        VISION_LINE: "Do what I truly want and be who I am meant to be.",
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
        QUOTES: quotesRes.quotes ?? [],
      });
    }

    load().catch((error) => {
      console.error(error);
      if (!cancelled) setData(null);
    });

    return () => {
      cancelled = true;
    };
  }, [dateOverride, refreshTrigger, includeLearnings, includeTasks, includeCalendar, includeProblems, includeQuotes]);

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
  { id: "cockpit", label: "cockpit", href: "/" },
  { id: "tasks", label: "tasks & learning", href: "/tasks" },
  { id: "activities", label: "activities", href: "/activities" },
  { id: "calendar", label: "calendar", href: "/calendar" },
  { id: "food", label: "food & spend", href: "/food" },
  { id: "workouts", label: "workouts", href: "/workouts" },
  { id: "ideas", label: "ideas", href: "/ideas" },
];

type NavItemId = "cockpit" | "calendar" | "tasks" | "food" | "activities" | "workouts" | "ideas";

function Nav({ active }: { active: NavItemId }) {
  return (
    <nav style={{ display: "flex", alignItems: "center", gap: 20, flexShrink: 0 }}>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={`mono nav-link ${item.id === active ? "nav-link-active" : ""}`}
          style={{
            fontSize: 11,
            letterSpacing: "0.05em",
            textTransform: "lowercase",
            outline: "none",
          }}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function PageHeader({ active, data }: { active: NavItemId; data: DashData | null }) {
  const now = data?.NOW_MIN ?? nowMinutes();
  const t = `${String(Math.floor(now / 60)).padStart(2, "0")}:${String(now % 60).padStart(2, "0")}`;
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 40px",
        borderBottom: "1px solid var(--line)",
        backgroundColor: "var(--bg)",
        flexShrink: 0,
        zIndex: 100
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 22,
            height: 22,
            border: "2px solid var(--text)",
            display: "grid",
            placeItems: "center",
            fontFamily: "var(--mono)",
            fontSize: 12,
            fontWeight: 800,
            color: "var(--text)"
          }}
        >
          D
        </div>
        <span className="mono" style={{ fontSize: 12, letterSpacing: "0.15em", fontWeight: 600 }}>
          DASH
        </span>
      </div>

      <Nav active={active} />

      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <span className="mono" style={{ fontSize: 16, fontWeight: 500 }}>
          {t}
        </span>
        <span className="mono" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: "var(--muted)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
          <span style={{ width: 5, height: 5, borderRadius: 999, background: "var(--text)" }} />
          synced
        </span>
      </div>
    </header>
  );
}

export function DateNavigator({
  selectedDate,
  onChange,
  compact = false,
}: {
  selectedDate: string;
  onChange: (date: string) => void;
  compact?: boolean;
}) {
  const [showMonthGrid, setShowMonthGrid] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [calendarPosition, setCalendarPosition] = useState<{ top: number; left: number } | null>(null);
  const calendarDialogRef = useRef<HTMLDivElement>(null);
  const calendarButtonRef = useRef<HTMLButtonElement>(null);

  // Close month calendar when clicking outside
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        calendarDialogRef.current &&
        !calendarDialogRef.current.contains(event.target as Node) &&
        calendarButtonRef.current &&
        !calendarButtonRef.current.contains(event.target as Node)
      ) {
        setShowMonthGrid(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const weekStrip = useMemo(() => {
    const centerDate = new Date(`${selectedDate}T12:00:00`);
    const list = [];
    const radius = compact ? 2 : 3;
    for (let i = -radius; i <= radius; i++) {
      const d = new Date(centerDate.getTime());
      d.setDate(centerDate.getDate() + i);
      const iso = localIsoDate(d);
      const dayNum = d.getDate();
      const dayName = d.toLocaleDateString("en-US", { weekday: "short" }).substring(0, 2).toUpperCase();
      list.push({ iso, dayNum, dayName });
    }
    return list;
  }, [compact, selectedDate]);

  const year = useMemo(() => new Date(`${selectedDate}T12:00:00`).getFullYear(), [selectedDate]);
  const month = useMemo(() => new Date(`${selectedDate}T12:00:00`).getMonth(), [selectedDate]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const result = [];

    // Prepend previous month days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      result.push({ isoStr: localIsoDate(d), isCurrentMonth: false, dayNum: daysInPrevMonth - i });
    }

    // Add current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      result.push({ isoStr: localIsoDate(d), isCurrentMonth: true, dayNum: i });
    }

    // Pad next month days to 42 cells
    const padding = 42 - result.length;
    for (let i = 1; i <= padding; i++) {
      const d = new Date(year, month + 1, i);
      result.push({ isoStr: localIsoDate(d), isCurrentMonth: false, dayNum: i });
    }

    return result;
  }, [year, month]);

  const shiftDate = (delta: number) => {
    const d = new Date(`${selectedDate}T12:00:00`);
    d.setDate(d.getDate() + delta);
    onChange(localIsoDate(d));
  };

  const toggleMonthGrid = () => {
    if (!calendarButtonRef.current) {
      setShowMonthGrid((show) => !show);
      return;
    }

    const rect = calendarButtonRef.current.getBoundingClientRect();
    const dropdownWidth = 250;
    setCalendarPosition({
      top: rect.bottom + 8,
      left: Math.min(window.innerWidth - dropdownWidth - 12, Math.max(12, rect.right - dropdownWidth)),
    });
    setShowMonthGrid((show) => !show);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: compact ? 8 : 16, position: "relative", maxWidth: "100%" }}>
      {/* Week selector strip */}
      <div style={{ display: "flex", alignItems: "center", gap: compact ? 4 : 8, border: "1px solid var(--text)", padding: compact ? "3px 6px" : "4px 8px", backgroundColor: "var(--bg)" }}>
        <button
          type="button"
          onClick={() => shiftDate(-1)}
          style={{ background: "none", border: "none", cursor: "pointer", display: "grid", placeItems: "center", padding: compact ? 1 : 2 }}
        >
          <ChevronLeft size={compact ? 12 : 14} />
        </button>
        
        {weekStrip.map((day) => {
          const isSelected = day.iso === selectedDate;
          return (
            <button
              key={day.iso}
              type="button"
              onClick={() => onChange(day.iso)}
              style={{
                background: "none",
                border: isSelected ? "1px solid var(--text)" : "1px solid transparent",
                cursor: "pointer",
                padding: compact ? "2px 4px" : "2px 6px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                minWidth: compact ? 28 : 32,
                fontWeight: isSelected ? "bold" : "normal",
                color: isSelected ? "var(--text)" : "var(--muted)",
              }}
            >
              <span className="mono" style={{ fontSize: compact ? 7.5 : 8 }}>{day.dayName}</span>
              <span style={{ fontSize: compact ? 11 : 12 }}>{day.dayNum}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => shiftDate(1)}
          style={{ background: "none", border: "none", cursor: "pointer", display: "grid", placeItems: "center", padding: compact ? 1 : 2 }}
        >
          <ChevronRight size={compact ? 12 : 14} />
        </button>
      </div>

      {/* Calendar icon trigger */}
      <button
        ref={calendarButtonRef}
        type="button"
        onClick={toggleMonthGrid}
        style={{
          width: compact ? 34 : 38,
          height: compact ? 34 : 38,
          border: "1px solid var(--text)",
          background: showMonthGrid ? "var(--text)" : "var(--bg)",
          color: showMonthGrid ? "var(--bg)" : "var(--text)",
          cursor: "pointer",
          display: "grid",
          placeItems: "center"
        }}
        title="Select specific date"
      >
        <CalendarIcon size={compact ? 14 : 16} />
      </button>

      {/* Monthly grid calendar dropdown */}
      {mounted && showMonthGrid && calendarPosition && createPortal(
        <div
          ref={calendarDialogRef}
          style={{
            position: "fixed",
            top: calendarPosition.top,
            left: calendarPosition.left,
            width: 250,
            border: "1px solid var(--text)",
            backgroundColor: "var(--bg)",
            padding: 16,
            boxShadow: "4px 4px 0px var(--text)",
            zIndex: 10000
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span className="mono" style={{ fontSize: 11, fontWeight: "bold" }}>
              {new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase()}
            </span>
            <button
              type="button"
              onClick={() => setShowMonthGrid(false)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              <X size={14} />
            </button>
          </div>
          
          {/* Week headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, textAlign: "center", marginBottom: 6 }}>
            {["S", "M", "T", "W", "T", "F", "S"].map((d, idx) => (
              <span key={idx} className="mono" style={{ fontSize: 8.5, color: "var(--muted)", fontWeight: "bold" }}>{d}</span>
            ))}
          </div>

          {/* Grid cells */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {calendarDays.map((cell, idx) => {
              const isSelected = cell.isoStr === selectedDate;
              const isCurrentMonth = cell.isCurrentMonth;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    onChange(cell.isoStr);
                    setShowMonthGrid(false);
                  }}
                  style={{
                    background: isSelected ? "var(--text)" : "none",
                    color: isSelected ? "var(--bg)" : isCurrentMonth ? "var(--text)" : "var(--dim)",
                    border: "none",
                    cursor: "pointer",
                    height: 24,
                    fontSize: 11,
                    display: "grid",
                    placeItems: "center",
                    fontWeight: isSelected ? "bold" : "normal"
                  }}
                >
                  {cell.dayNum}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function NextTaskCard({ data, onToggleTask }: { data: DashData; onToggleTask: (task: DashTask) => void }) {
  const nowMs = Date.now();
  const nextTask = data.TASKS.find((t) => new Date(t.due_at).getTime() >= nowMs) ?? data.TASKS[0];

  return (
    <div
      style={{
        padding: "22px 24px",
        borderRadius: 20,
        background: "linear-gradient(145deg, rgba(180,100,100,0.07), rgba(255,250,240,0))",
        border: "1.5px solid rgba(178,68,68,0.12)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 10,
      }}
    >
      <div className="mono" style={{ fontSize: 10, color: "var(--rose)", letterSpacing: "0.08em", textTransform: "none", opacity: 0.8 }}>
        ↳ focus
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
        borderRadius: 20,
        background: "linear-gradient(145deg, rgba(36,84,214,0.06), rgba(255,250,240,0))",
        border: "1.5px solid rgba(36,84,214,0.1)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 10,
      }}
    >
      <div className="mono" style={{ fontSize: 10, color: "var(--blue)", letterSpacing: "0.08em", textTransform: "none", opacity: 0.8 }}>
        ↳ up next
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
  const [time, setTime] = useState<number>(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTime((prev) => (prev + 100) % 12000);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Determine state name and subtitle
  let breatheState = "Inhale (Inner)";
  if (time >= 4000 && time < 5000) {
    breatheState = "Hold (Stop)";
  } else if (time >= 5000 && time < 8000) {
    breatheState = "Inhale (Outer)";
  } else if (time >= 8000) {
    breatheState = "Release";
  }

  let innerFill = 0;
  let outerFill = 0;

  if (time < 4000) {
    innerFill = time / 4000;
    outerFill = 0;
  } else if (time >= 4000 && time < 5000) {
    innerFill = 1;
    outerFill = 0;
  } else if (time >= 5000 && time < 8000) {
    innerFill = 1;
    outerFill = (time - 5000) / 3000;
  } else {
    const releaseProgress = (time - 8000) / 4000;
    innerFill = 1 - releaseProgress;
    outerFill = 1 - releaseProgress;
  }

  const outerFillScale = 0.46 + outerFill * 0.54;
  const orbGlow = 0.08 + Math.max(innerFill, outerFill) * 0.18;

  return (
    <div
      className="grid-card"
      style={{
        padding: "26px 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        width: "100%",
        minHeight: 150,
        ...style,
      }}
    >
      <div className="zine-paperclip" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div className="zine-eyebrow">
          <span>↳ breathe & execute</span>
          <span>04</span>
        </div>
        <div className="mono" style={{ fontSize: 13, fontWeight: 900, textTransform: "uppercase", marginTop: 4 }}>
          {breatheState}
        </div>
        <div className="mono" style={{ fontSize: 7.5, color: "var(--muted)", whiteSpace: "nowrap" }}>
          4s Inhale · 1s Hold · 3s Inhale · 4s Out
        </div>
      </div>

      <div style={{ position: "relative", width: 68, height: 68, display: "grid", placeItems: "center", flexShrink: 0 }}>
        <div
          style={{
            position: "absolute",
            width: 56,
            height: 14,
            bottom: 5,
            left: 6,
            borderRadius: 999,
            background: "rgba(0,0,0,0.14)",
            filter: "blur(8px)",
            transform: `scale(${0.84 + outerFill * 0.12})`,
            opacity: 0.34,
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 58,
            height: 58,
            borderRadius: 999,
            border: "1.5px solid rgba(12,12,14,0.9)",
            background: "radial-gradient(circle at 34% 28%, #ffffff 0%, #edf8ff 18%, #d7edf8 44%, #a7c6d8 100%)",
            boxShadow: `inset 8px 9px 12px rgba(255,255,255,0.86), inset -10px -12px 16px rgba(18,52,70,0.24), 4px 6px 0 rgba(0,0,0,0.86), 0 0 18px rgba(125,211,252,${orbGlow})`,
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 58,
              height: 58,
              borderRadius: 999,
              background: "radial-gradient(circle at 36% 30%, rgba(255,255,255,0.95), rgba(125,211,252,0.72) 34%, rgba(29,78,116,0.72) 100%)",
              opacity: 0.2 + outerFill * 0.78,
              transform: `scale(${outerFillScale})`,
              transformOrigin: "center",
              transition: "opacity 0.1s linear, transform 0.1s linear",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 7,
              borderRadius: 999,
              border: "1px dashed rgba(12,12,14,0.32)",
              pointerEvents: "none",
              zIndex: 2,
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 28,
              height: 28,
              borderRadius: 999,
              border: "1.25px solid rgba(12,12,14,0.72)",
              background: "radial-gradient(circle at 35% 28%, #ffffff 0%, #f8fdff 32%, #d8e8f0 100%)",
              boxShadow: "inset 4px 5px 7px rgba(255,255,255,0.84), inset -5px -7px 9px rgba(18,52,70,0.22), 0 2px 6px rgba(0,0,0,0.18)",
              display: "grid",
              placeItems: "center",
              zIndex: 3,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                width: 28,
                height: 28,
                borderRadius: 999,
                background: "radial-gradient(circle at 34% 28%, #ffffff 0%, #8ed8ff 38%, #1f5d8e 100%)",
                opacity: 0.18 + innerFill * 0.82,
                transform: `scale(${innerFill})`,
                transformOrigin: "center",
                transition: "opacity 0.1s linear, transform 0.1s linear",
              }}
            />
          </div>
          <div
            style={{
              position: "absolute",
              width: 14,
              height: 14,
              top: 11,
              left: 14,
              borderRadius: 999,
              background: "rgba(255,255,255,0.7)",
              filter: "blur(3px)",
              opacity: 0.54,
              pointerEvents: "none",
              zIndex: 4,
            }}
          />
        </div>
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
  const SLOT_MINUTES = 15;
  const SLOT_HEIGHT = 44;
  const ROWS = Array.from({ length: Math.floor(TL_SPAN / SLOT_MINUTES) + 1 }, (_, i) => TL_START + i * SLOT_MINUTES);
  const LABEL_W = 58;
  const timelineHeight = (ROWS.length - 1) * SLOT_HEIGHT;
  const minuteToPx = (min: number) => ((Math.min(TL_END, Math.max(TL_START, min)) - TL_START) / SLOT_MINUTES) * SLOT_HEIGHT;
  return (
    <div data-day-timeline="15-min" style={{ position: "relative", height: timelineHeight, minHeight: timelineHeight, userSelect: "none", paddingRight: 2 }}>
      {ROWS.map((minutes) => {
        const isHour = minutes % 60 === 0;
        const hour = Math.floor(minutes / 60);
        const minute = minutes % 60;
        return (
          <div key={minutes} style={{ position: "absolute", top: minuteToPx(minutes), left: 0, right: 0, display: "flex", alignItems: "flex-start", gap: 14, pointerEvents: "none" }}>
            <span data-slot-label className="mono" style={{ fontSize: isHour ? 13 : 10, color: isHour ? "var(--dim)" : "var(--muted)", width: LABEL_W, textAlign: "right", flexShrink: 0, lineHeight: 1, marginTop: isHour ? -8 : -5, opacity: isHour ? 1 : 0.7 }}>
              {`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`}
            </span>
            <div style={{ flex: 1, borderTop: `${isHour ? 2 : 1}px ${isHour ? "solid" : "dashed"} ${isHour ? "var(--line)" : "rgba(0,0,0,0.18)"}` }} />
          </div>
        );
      })}
      {blocks.map((b, i) => {
        const top = minuteToPx(toMinutes(b.start));
        const h = Math.max(minuteToPx(toMinutes(b.end)) - top, SLOT_HEIGHT - 2);
        const isCal = b.kind === "cal";
        const bgColor = isCal ? "#1e5a8f" : (CAT_COLOR[b.cat || "Other"] ?? CAT_COLOR.Other);
        const compact = h <= SLOT_HEIGHT + 2;
        return (
          <div key={i} style={{ position: "absolute", top, height: h, left: LABEL_W + 18, right: 0, background: bgColor, border: "2px solid #000", borderRadius: 7, padding: compact ? "5px 10px" : "7px 12px", overflow: "hidden", boxShadow: "2px 2px 0 #000", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontSize: compact ? 12 : 13, color: "#fff", fontWeight: 800, lineHeight: 1.12, letterSpacing: 0, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.label}</div>
            <div className="mono" style={{ fontSize: compact ? 10 : 11, color: "rgba(255,255,255,0.82)", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {b.start}–{b.end}{b.cat && !isCal ? ` · ${b.cat}` : ""}{b.loc ? ` · ${b.loc}` : ""}
            </div>
          </div>
        );
      })}
      {tasks.map((t, i) => (
        <div key={i} style={{ position: "absolute", left: LABEL_W + 18, zIndex: 3, top: minuteToPx(toMinutes(t.due.includes(":") ? t.due.split(" ").pop()! : "23:59")) }}>
          <span className="mono uc" style={{ fontSize: 9, color: "var(--rose)", border: "1px solid rgba(205,92,92,0.5)", borderRadius: 2, padding: "1px 5px", background: "var(--bg)", display: "inline-block", whiteSpace: "nowrap", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }}>
            ✓ {t.title}
          </span>
        </div>
      ))}
      {isToday && nowMin >= TL_START && nowMin <= TL_END && (
        <div style={{ position: "absolute", top: minuteToPx(nowMin), left: LABEL_W + 14, right: 0, zIndex: 2, display: "flex", alignItems: "center", pointerEvents: "none" }}>
          <div style={{ width: 7, height: 7, borderRadius: 999, background: "var(--rose)", flexShrink: 0, marginTop: -3 }} />
          <div style={{ flex: 1, height: 1, background: "var(--rose)" }} />
        </div>
      )}
      {blocks.length === 0 && (
        <div style={{ position: "absolute", top: 280, left: LABEL_W + 18, right: 0, textAlign: "center" }}>
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
        border: "1.5px solid rgba(194,120,50,0.13)",
        borderRadius: 20,
        background: "linear-gradient(145deg, rgba(196,126,34,0.06), transparent)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="mono" style={{ fontSize: 11, color: "var(--amber)", letterSpacing: "0.06em", fontWeight: 600 }}>
          open problems
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

function VisionBoard({ line }: { line: string }) {
  return (
    <div
      className="grid-card"
      style={{
        padding: "30px 32px 34px",
        height: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 24,
        overflow: "visible",
      }}
    >
      <div className="zine-paperclip" />
      <div className="zine-eyebrow">
        <span>↳ my vision statement</span>
        <span>01</span>
      </div>
      <div
        style={{
          borderLeft: "6px solid #000000",
          paddingLeft: 16,
          fontSize: 26,
          lineHeight: 1.18,
          fontWeight: 900,
          letterSpacing: 0,
          maxWidth: 660,
          textTransform: "none",
        }}
      >
        {line}
      </div>
    </div>
  );
}

function TodayScheduleCard({ data }: { data: DashData }) {
  const todayBlocks = useMemo(() => {
    return [...data.BLOCKS].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  }, [data.BLOCKS]);

  return (
    <div
      className="grid-card"
      style={{
        padding: "24px 28px",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <div className="zine-paperclip" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexShrink: 0 }}>
        <div className="zine-eyebrow blue">
          <span>↳ today's schedule</span>
          <span>03</span>
        </div>
        <Link
          href="/calendar"
          className="mono"
          style={{
            fontSize: 15,
            color: "var(--text)",
            textDecoration: "underline",
            fontWeight: 500,
            whiteSpace: "nowrap",
            display: "inline-block"
          }}
        >
          full view →
        </Link>
      </div>

      <div className="timeline-container" style={{ position: "relative", paddingLeft: 14, flex: 1, display: "flex", flexDirection: "column", justifyContent: todayBlocks.length === 0 ? "center" : "flex-start" }}>
        <div className="timeline-line" style={{ position: "absolute", left: 4, top: 4, bottom: 4, width: 1, borderLeft: "1px dashed var(--line)" }} />

        <div className="timeline-list" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {todayBlocks.length === 0 ? (
            <div className="mono" style={{ fontSize: 10, color: "var(--muted)", padding: "8px 0", textAlign: "center" }}>
              no events scheduled
            </div>
          ) : (
            todayBlocks.map((b, idx) => {
              const startMin = toMinutes(b.start);
              const endMin = toMinutes(b.end);
              const isCurrent = data.NOW_MIN >= startMin && data.NOW_MIN <= endMin;

              return (
                <div 
                  key={idx} 
                  style={{ 
                    display: "flex", 
                    gap: 12, 
                    fontSize: 12,
                    padding: isCurrent ? "2px 6px" : "0",
                    background: isCurrent ? "#ccfbf1" : "transparent",
                    border: isCurrent ? "1px solid #000000" : "none",
                    fontWeight: isCurrent ? 700 : 400
                  }}
                >
                  <div className="mono" style={{ fontSize: 10, color: isCurrent ? "var(--text)" : "var(--muted)", width: 38, flexShrink: 0 }}>
                    {b.start}
                  </div>
                  <div style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "baseline", minWidth: 0 }}>
                    <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                      {b.label}
                    </span>
                    {b.cat && (
                      <span 
                        className="mono" 
                        style={{ 
                          fontSize: 8, 
                          padding: "1px 4px", 
                          border: "1px solid var(--line)",
                          color: "var(--muted)",
                          flexShrink: 0,
                          background: "#ffffff",
                          marginLeft: 8
                        }}
                      >
                        {b.cat}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function QuotesDeck({ 
  quotes, 
  onAddQuote, 
  onDeleteQuote 
}: { 
  quotes: QuoteRow[]; 
  onAddQuote: (text: string, author?: string) => Promise<void>; 
  onDeleteQuote: (id: string) => Promise<void>; 
}) {
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form styles locally scoped for clean minimalist input fields
  const localInputStyle = {
    background: "var(--bg-2)",
    border: "1px solid var(--line)",
    borderRadius: "6px",
    color: "var(--text)",
    fontSize: "13px",
    padding: "8px 12px",
    outline: "none",
    width: "100%",
    fontFamily: "inherit",
  };

  const handleCycleQuote = () => {
    if (quotes.length === 0) return;
    setQuoteIndex((prev) => (prev + 1) % quotes.length);
  };

  const handleDeleteActive = async () => {
    if (quotes.length === 0) return;
    const activeQuote = quotes[quoteIndex];
    if (confirm("Are you sure you want to delete this quote?")) {
      await onDeleteQuote(activeQuote.id);
      setQuoteIndex((prev) => (quotes.length <= 1 ? 0 : prev % (quotes.length - 1)));
    }
  };

  const handleAddSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!text.trim() || adding) return;
    setAdding(true);
    try {
      await onAddQuote(text.trim(), author.trim() || undefined);
      setText("");
      setAuthor("");
      setShowForm(false);
      setQuoteIndex(0);
    } catch (err) {
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  if (quotes.length === 0) {
    return (
      <div className="grid-card" style={{ padding: "24px 24px", display: "flex", flexDirection: "column", gap: 24, width: "100%", minHeight: 340, justifyContent: "flex-start" }}>
        <div className="zine-paperclip" />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <div className="zine-eyebrow blue">
            <span>↳ mind space / quotes</span>
            <span>06</span>
          </div>
          <span className="mono" style={{ fontSize: 15, color: "#0c0c0e", whiteSpace: "nowrap" }}>{quotes.length} items</span>
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", padding: "44px 0" }}>
          No thoughts saved.
        </div>
        {showForm ? (
          <form onSubmit={handleAddSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              type="text"
              placeholder="Thought/Quote"
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
              style={localInputStyle}
            />
            <input
              type="text"
              placeholder="Author (Optional)"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              style={localInputStyle}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" disabled={adding} className="mono" style={{ flex: 1, background: "#0c0c0e", color: "#faf9f6", fontSize: 9, padding: "6px 10px", border: "none", cursor: "pointer" }}>
                {adding ? "saving..." : "save"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="mono" style={{ background: "none", border: "1px solid #0c0c0e", color: "#0c0c0e", fontSize: 9, padding: "6px 10px", cursor: "pointer" }}>
                cancel
              </button>
            </div>
          </form>
        ) : (
          <button onClick={() => setShowForm(true)} className="mono" style={{ background: "#0c0c0e", color: "#faf9f6", border: "none", padding: "8px 12px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", cursor: "pointer" }}>
            + Add Thought
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="grid-card"
      style={{
        padding: "24px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
        width: "100%",
        minHeight: 390,
        justifyContent: "flex-start"
      }}
    >
      <div className="zine-paperclip" />
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <div className="zine-eyebrow blue">
            <span>↳ mind space / quotes</span>
            <span>06</span>
          </div>
          <span className="mono" style={{ fontSize: 15, color: "#0c0c0e", whiteSpace: "nowrap" }}>{quotes.length} items</span>
        </div>
      </div>

      {!showForm ? (
        <>
          {/* Stack container */}
          <div
            onClick={handleCycleQuote}
            style={{
              position: "relative",
              width: "100%",
              height: 190,
              cursor: "pointer",
              margin: "4px 0 8px"
            }}
          >
            {quotes.map((q, idx) => {
              const len = quotes.length;
              const relativePos = (idx - quoteIndex + len) % len;

              let transform = "";
              let opacity = 0;
              let zIndex = 0;

              if (relativePos === 0) {
                transform = "translate3d(0px, 0px, 0px) scale(1) rotate(0deg)";
                opacity = 1;
                zIndex = 10;
              } else if (relativePos === 1) {
                transform = "translate3d(6px, 8px, -10px) scale(0.97) rotate(1deg)";
                opacity = 0.8;
                zIndex = 9;
              } else if (relativePos === 2) {
                transform = "translate3d(12px, 16px, -20px) scale(0.94) rotate(-1.5deg)";
                opacity = 0.5;
                zIndex = 8;
              } else {
                transform = "translate3d(18px, 24px, -30px) scale(0.91) rotate(0deg)";
                opacity = 0;
                zIndex = 1;
              }

              return (
                <div
                  key={q.id}
                  className="deck-card"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 14,
                    bottom: 20,
                    border: "1px solid #0c0c0e",
                    backgroundColor: "#ffffff",
                    padding: "24px 26px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    transform,
                    opacity,
                    zIndex,
                    pointerEvents: relativePos === 0 ? "auto" : "none"
                  }}
                >
                  <div
                    style={{
                      fontSize: 18,
                      fontStyle: "italic",
                      lineHeight: 1.35,
                      color: "#0c0c0e",
                      textWrap: "pretty"
                    }}
                  >
                    “{q.text}”
                  </div>
                  
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 8 }}>
                    <span className="mono" style={{ fontSize: 9, color: "#66666a" }}>
                      — {q.author || "anon"}
                    </span>
                    <span className="mono" style={{ fontSize: 8, color: "#d1d1d4" }}>
                      {idx + 1}/{len}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom deck actions helper */}
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={handleCycleQuote}
              className="mono"
              style={{
                flex: 1,
                background: "#0c0c0e",
                color: "#faf9f6",
                border: "none",
                padding: "8px 12px",
                fontSize: 9,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4
              }}
            >
              <span>Next Quote</span>
            </button>
            <button
              onClick={handleDeleteActive}
              className="mono"
              style={{
                background: "none",
                border: "1px solid #ef4444",
                color: "#ef4444",
                padding: "8px 12px",
                fontSize: 9,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                cursor: "pointer"
              }}
            >
              delete
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="mono"
              style={{
                background: "none",
                border: "1px solid #0c0c0e",
                color: "#0c0c0e",
                padding: "8px 12px",
                fontSize: 9,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                cursor: "pointer"
              }}
            >
              + add
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={handleAddSubmit} style={{ display: "flex", flexDirection: "column", gap: 10, margin: "10px 0" }}>
          <div className="mono" style={{ fontSize: 9.5, color: "#0c0c0e" }}>New Thought</div>
          <textarea
            placeholder="What is on your mind?"
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
            rows={3}
            style={{ ...localInputStyle, resize: "none", fontSize: "13px", padding: "8px" }}
          />
          <input
            type="text"
            placeholder="Author (Optional)"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            style={{ ...localInputStyle, fontSize: "13px", padding: "8px" }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" disabled={adding} className="mono" style={{ flex: 1, background: "#0c0c0e", color: "#faf9f6", fontSize: 9, padding: "8px 12px", border: "none", cursor: "pointer" }}>
              {adding ? "saving..." : "save"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="mono" style={{ background: "none", border: "1px solid #0c0c0e", color: "#0c0c0e", fontSize: 9, padding: "8px 12px", cursor: "pointer" }}>
              cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function createDefaultCockpitCards(): CockpitPostcard[] {
  return [
    {
      id: "doing",
      title: "What I am doing",
      x: 420,
      y: 118,
      items: [
        { id: "doing-1", text: "Keep the current work visible", done: false },
      ],
    },
    {
      id: "thinking",
      title: "Thinking space",
      x: 760,
      y: 248,
      items: [
        { id: "thinking-1", text: "Capture the next useful move", done: false },
      ],
    },
  ];
}

function createDefaultSystemPostcardPositions(): SystemPostcardPositions {
  return {
    next: { x: 38, y: 34 },
    problems: { x: 38, y: 324 },
  };
}

function CockpitPostcardShell({
  title,
  eyebrow,
  count,
  x,
  y,
  children,
  onPointerDown,
}: {
  title: string;
  eyebrow: string;
  count?: string;
  x: number;
  y: number;
  children: React.ReactNode;
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      className="grid-card deck-card"
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 292,
        minHeight: 220,
        padding: 0,
        overflow: "hidden",
        background: "#fffdf5",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        onPointerDown={onPointerDown}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          borderBottom: "2px solid #000000",
          background: "#fef08a",
          padding: "12px 14px",
          cursor: onPointerDown ? "grab" : "default",
          touchAction: "none",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div className="mono" style={{ fontSize: 8.5, fontWeight: 900, textTransform: "uppercase", color: "#0c0c0e", marginBottom: 3 }}>
            ↳ {eyebrow}
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {title}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {count && <span className="mono" style={{ fontSize: 11 }}>{count}</span>}
          {onPointerDown && <GripVertical size={15} />}
        </div>
      </div>
      {children}
    </div>
  );
}

export function CockpitPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [newProblem, setNewProblem] = useState("");
  const [newCardTitle, setNewCardTitle] = useState("");
  const [cards, setCards] = useState<CockpitPostcard[]>([]);
  const [cardsLoaded, setCardsLoaded] = useState(false);
  const [systemPositions, setSystemPositions] = useState<SystemPostcardPositions>(createDefaultSystemPostcardPositions);
  const [systemPositionsLoaded, setSystemPositionsLoaded] = useState(false);
  const [dragState, setDragState] = useState<{
    id: string;
    kind: "user" | "system";
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const data = useDashData(undefined, refreshTrigger, { includeLearnings: false });

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("dash_cockpit_postcards_v1");
      const parsed = saved ? JSON.parse(saved) as CockpitPostcard[] : null;
      setCards(Array.isArray(parsed) && parsed.length > 0 ? parsed : createDefaultCockpitCards());
    } catch {
      setCards(createDefaultCockpitCards());
    } finally {
      setCardsLoaded(true);
    }
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("dash_cockpit_system_postcards_v1");
      const parsed = saved ? JSON.parse(saved) as Partial<SystemPostcardPositions> : null;
      setSystemPositions({ ...createDefaultSystemPostcardPositions(), ...parsed });
    } catch {
      setSystemPositions(createDefaultSystemPostcardPositions());
    } finally {
      setSystemPositionsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!cardsLoaded) return;
    window.localStorage.setItem("dash_cockpit_postcards_v1", JSON.stringify(cards));
  }, [cards, cardsLoaded]);

  useEffect(() => {
    if (!systemPositionsLoaded) return;
    window.localStorage.setItem("dash_cockpit_system_postcards_v1", JSON.stringify(systemPositions));
  }, [systemPositions, systemPositionsLoaded]);

  const solveProblem = useCallback(async (id: string) => {
    await fetch(`/api/problems/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ solved: true }),
    });
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const addProblem = useCallback(async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!newProblem.trim()) return;
    await fetch("/api/problems", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: newProblem.trim() }),
    });
    setNewProblem("");
    setRefreshTrigger((prev) => prev + 1);
  }, [newProblem]);

  const createCard = useCallback((e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!newCardTitle.trim()) return;
    const offset = cards.length % 5;
    const card: CockpitPostcard = {
      id: Math.random().toString(36).slice(2, 10),
      title: newCardTitle.trim(),
      x: 410 + offset * 38,
      y: 410 + offset * 28,
      items: [],
    };
    setCards((current) => [...current, card]);
    setNewCardTitle("");
  }, [cards.length, newCardTitle]);

  const addCardItem = useCallback((cardId: string, text: string) => {
    if (!text.trim()) return;
    setCards((current) => current.map((card) => (
      card.id === cardId
        ? { ...card, items: [...card.items, { id: Math.random().toString(36).slice(2, 10), text: text.trim(), done: false }] }
        : card
    )));
  }, []);

  const toggleCardItem = useCallback((cardId: string, itemId: string) => {
    setCards((current) => current.map((card) => (
      card.id === cardId
        ? { ...card, items: card.items.map((item) => item.id === itemId ? { ...item, done: !item.done } : item) }
        : card
    )));
  }, []);

  const deleteCardItem = useCallback((cardId: string, itemId: string) => {
    setCards((current) => current.map((card) => (
      card.id === cardId
        ? { ...card, items: card.items.filter((item) => item.id !== itemId) }
        : card
    )));
  }, []);

  const deleteCard = useCallback((cardId: string) => {
    setCards((current) => current.filter((card) => card.id !== cardId));
  }, []);

  const startDrag = useCallback((
    item: { id: string; x: number; y: number },
    kind: "user" | "system",
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, input, textarea, a")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      id: item.id,
      kind,
      startX: event.clientX,
      startY: event.clientY,
      originX: item.x,
      originY: item.y,
    });
  }, []);

  const moveDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragState || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const nextX = Math.max(12, Math.min(rect.width - 312, dragState.originX + event.clientX - dragState.startX));
    const nextY = Math.max(12, Math.min(rect.height - 256, dragState.originY + event.clientY - dragState.startY));
    if (dragState.kind === "system") {
      const systemId = dragState.id as SystemPostcardId;
      setSystemPositions((current) => ({
        ...current,
        [systemId]: { x: nextX, y: nextY },
      }));
      return;
    }

    setCards((current) => current.map((card) => card.id === dragState.id ? { ...card, x: nextX, y: nextY } : card));
  }, [dragState]);

  const endDrag = useCallback(() => {
    setDragState(null);
  }, []);

  if (!data) return <LoadingPage />;

  const activeTask = data.TASKS.find(t => !t.done);
  const activeProblems = data.PROBLEMS.filter(p => !p.solved);
  const upcomingEvent = [...data.BLOCKS]
    .filter((block) => block.kind === "cal" && toMinutes(block.end) >= data.NOW_MIN)
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))[0];

  return (
    <div style={{ height: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <PageHeader active="cockpit" data={data} />

      <main style={{ flex: 1, minHeight: 0, padding: "18px 28px 28px", boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
        <div
          ref={boardRef}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{
            position: "relative",
            flex: 1,
            minHeight: 0,
            overflow: "auto",
            border: "1px solid rgba(12, 12, 14, 0.16)",
            backgroundImage: "radial-gradient(rgba(12, 12, 14, 0.12) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            backgroundColor: "rgba(252, 251, 247, 0.32)",
          }}
        >
          <div style={{ position: "relative", minWidth: 1120, minHeight: 840 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "170px minmax(280px, 1fr) 380px",
                alignItems: "center",
                gap: 24,
                padding: "24px 32px 20px",
              }}
            >
              <div className="zine-eyebrow blue" style={{ width: "fit-content" }}>
                <span>↳ cockpit board</span>
                <span>01</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.05, textAlign: "center", maxWidth: 460, justifySelf: "center" }}>
                {data.VISION_LINE}
              </div>
              <form onSubmit={createCard} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", justifySelf: "end" }}>
                <input
                  value={newCardTitle}
                  onChange={(e) => setNewCardTitle(e.target.value)}
                  placeholder="New postcard"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    background: "#ffffff",
                    border: "2px solid #000000",
                    padding: "12px 14px",
                    fontSize: 14,
                    fontFamily: "inherit",
                    outline: "none",
                  }}
                />
                <button
                  type="submit"
                  disabled={!newCardTitle.trim()}
                  title="Add postcard"
                  style={{
                    width: 44,
                    height: 44,
                    background: "#0c0c0e",
                    color: "#faf9f6",
                    border: "none",
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                  }}
                >
                  <Plus size={18} />
                </button>
              </form>
            </div>

            <div style={{ position: "relative", minHeight: 720 }}>
            <CockpitPostcardShell
              title="Next up"
              eyebrow="task / event"
              x={systemPositions.next.x}
              y={systemPositions.next.y}
              count="move"
              onPointerDown={(event) => startDrag({ id: "next", ...systemPositions.next }, "system", event)}
            >
              <div style={{ padding: "16px 16px 14px", display: "flex", flexDirection: "column", gap: 16, background: "#fffdf8", flex: 1 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <ArrowDown size={16} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div className="mono" style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", marginBottom: 3 }}>next task</div>
                    <div style={{ fontSize: 17, fontWeight: 900, lineHeight: 1.18 }}>
                      {activeTask ? activeTask.title : "No active focus task"}
                    </div>
                    {activeTask && (
                      <div className="mono" style={{ fontSize: 9, color: "#66666a", marginTop: 4 }}>
                        weight: {weightForTask(activeTask.title)} · due {activeTask.due || "today"}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ borderTop: "1px solid rgba(12, 12, 14, 0.12)", paddingTop: 14 }}>
                  <div className="mono" style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", marginBottom: 3 }}>next event</div>
                  <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.22 }}>
                    {upcomingEvent ? upcomingEvent.label : "No upcoming event"}
                  </div>
                  {upcomingEvent && (
                    <div className="mono" style={{ fontSize: 9, color: "#66666a", marginTop: 4 }}>
                      {upcomingEvent.start} - {upcomingEvent.end}
                    </div>
                  )}
                </div>
              </div>
            </CockpitPostcardShell>

            <CockpitPostcardShell
              title="Problem space"
              eyebrow="open loops"
              x={systemPositions.problems.x}
              y={systemPositions.problems.y}
              count={`${activeProblems.length} items`}
              onPointerDown={(event) => startDrag({ id: "problems", ...systemPositions.problems }, "system", event)}
            >
              <div style={{ display: "flex", flexDirection: "column", flex: 1, background: "#fffdf8" }}>
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  padding: "10px 12px 12px",
                }}>
                  {activeProblems.length === 0 ? (
                    <div className="mono" style={{ fontSize: 10, color: "var(--muted)", padding: "22px 0", textAlign: "center" }}>
                      all problems solved
                    </div>
                  ) : (
                    activeProblems.map((problem) => (
                      <div key={problem.id} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 30, borderBottom: "1px solid rgba(12, 12, 14, 0.08)", fontSize: 13, lineHeight: 1.25 }}>
                        <button
                          onClick={() => solveProblem(problem.id)}
                          title="Mark solved"
                          style={{ width: 16, height: 16, border: "2px solid #000000", background: "transparent", cursor: "pointer", flexShrink: 0, padding: 0 }}
                        />
                        <span>{problem.text}</span>
                      </div>
                    ))
                  )}
                </div>
                <form onSubmit={addProblem} style={{ borderTop: "1px solid rgba(12, 12, 14, 0.18)", background: "#ffffff" }}>
                  <input
                    value={newProblem}
                    onChange={(e) => setNewProblem(e.target.value)}
                    placeholder="+ Add problem..."
                    style={{ width: "100%", border: "none", outline: "none", padding: "12px 14px", fontSize: 13, background: "#ffffff", fontFamily: "inherit" }}
                  />
                </form>
              </div>
            </CockpitPostcardShell>

            {cards.map((card) => (
              <CockpitPostcardShell
                key={card.id}
                title={card.title}
                eyebrow="postcard"
                x={card.x}
                y={card.y}
                count={`${card.items.filter((item) => !item.done).length} open`}
                onPointerDown={(event) => startDrag(card, "user", event)}
              >
                <div style={{ display: "flex", flexDirection: "column", flex: 1, background: "#fffdf8" }}>
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    minHeight: 130,
                    padding: "10px 12px 12px",
                  }}>
                    {card.items.length === 0 ? (
                      <div className="mono" style={{ fontSize: 10, color: "#888", textAlign: "center", padding: "20px 0" }}>
                        Add what belongs here.
                      </div>
                    ) : (
                      card.items.map((item) => (
                        <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 30, borderBottom: "1px solid rgba(12, 12, 14, 0.08)" }}>
                          <button
                            type="button"
                            onClick={() => toggleCardItem(card.id, item.id)}
                            style={{
                              width: 16,
                              height: 16,
                              border: "2px solid #000000",
                              background: item.done ? "#7dd3fc" : "transparent",
                              cursor: "pointer",
                              display: "grid",
                              placeItems: "center",
                              padding: 0,
                              flexShrink: 0,
                            }}
                          >
                            {item.done && <Check size={9} />}
                          </button>
                          <span style={{ flex: 1, fontSize: 13, lineHeight: 1.2, textDecoration: item.done ? "line-through" : "none", color: item.done ? "#777770" : "inherit" }}>
                            {item.text}
                          </span>
                          <button
                            type="button"
                            onClick={() => deleteCardItem(card.id, item.id)}
                            title="Delete item"
                            style={{ border: "none", background: "transparent", color: "#b24444", cursor: "pointer", padding: 2 }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", borderTop: "1px solid rgba(12, 12, 14, 0.18)", background: "#ffffff" }}>
                    <input
                      placeholder="+ Add item..."
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          addCardItem(card.id, event.currentTarget.value);
                          event.currentTarget.value = "";
                        }
                      }}
                      style={{ width: "100%", border: "none", outline: "none", padding: "12px 14px", fontSize: 13, background: "#ffffff", fontFamily: "inherit" }}
                    />
                    <button
                      type="button"
                      onClick={() => deleteCard(card.id)}
                      title="Delete postcard"
                      style={{ border: "none", background: "#ffffff", color: "#b24444", padding: "0 12px", cursor: "pointer" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </CockpitPostcardShell>
            ))}
            </div>
          </div>
        </div>
      </main>
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
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const data = useDashData(date, refreshTrigger, {
    includeLearnings: false,
    includeTasks: false,
    includeCalendar: false,
    includeProblems: false,
    includeQuotes: false,
  });
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
  const [showAddFoodForm, setShowAddFoodForm] = useState(false);
  const [foodLabel, setFoodLabel] = useState("");
  const [foodKcal, setFoodKcal] = useState("");
  const [foodProtein, setFoodProtein] = useState("");
  const [foodCost, setFoodCost] = useState("");
  const [foodMeal, setFoodMeal] = useState("lunch");
  const [foodLoading, setFoodLoading] = useState(false);

  // Sync calendar view when date changes
  useEffect(() => {
    setViewDate(new Date(date));
  }, [date]);

  // Set default current time when opening the form
  useEffect(() => {
    if (showAddForm || showAddFoodForm) {
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
  }, [showAddForm, showAddFoodForm]);

  const handleAddSpend = useCallback(async (e: React.SyntheticEvent) => {
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
        setRefreshTrigger((prev) => prev + 1);
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
  }, [date, item, amount, category, time, setRefreshTrigger]);

  const handleAddFood = useCallback(async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!foodLabel.trim()) return;

    setFoodLoading(true);
    try {
      const res = await fetch("/api/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          type: "food",
          data: {
            name: foodLabel.trim(),
            calories: foodKcal ? parseFloat(foodKcal) : 0,
            protein_g: foodProtein ? parseFloat(foodProtein) : 0,
            cost: foodCost ? parseFloat(foodCost) : 0,
            meal: foodMeal,
            estimated: false,
            time: time || new Date().toTimeString().slice(0, 5),
          },
        }),
      });

      if (res.ok) {
        setFoodLabel("");
        setFoodKcal("");
        setFoodProtein("");
        setFoodCost("");
        setFoodMeal("lunch");
        setShowAddFoodForm(false);
        setRefreshTrigger((prev) => prev + 1);
      } else {
        const errorText = await res.text();
        alert(`Error adding food: ${errorText}`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to add food entry");
    } finally {
      setFoodLoading(false);
    }
  }, [date, foodCost, foodKcal, foodLabel, foodMeal, foodProtein, time, setRefreshTrigger]);

  const deleteMeal = useCallback(async (m: DashData["MEALS"][number]) => {
    await fetch("/api/daily", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "food", id: m.id }),
    });
    setRefreshTrigger((prev) => prev + 1);
  }, [setRefreshTrigger]);

  const deleteSpend = useCallback(async (s: DashData["SPEND"][number]) => {
    await fetch("/api/daily", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "spending", id: s.id }),
    });
    setRefreshTrigger((prev) => prev + 1);
  }, [setRefreshTrigger]);

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

  const compactInputStyle: React.CSSProperties = {
    padding: "8px 10px",
    border: "2px solid #000",
    borderRadius: 0,
    background: "var(--bg)",
    color: "var(--text)",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
    width: "100%",
  };

  const compactButtonStyle: React.CSSProperties = {
    background: "#0c0c0e",
    color: "#fff",
    border: "2px solid #000",
    borderRadius: 0,
    padding: "8px 14px",
    cursor: foodLoading ? "not-allowed" : "pointer",
    fontFamily: "var(--mono)",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    opacity: foodLoading ? 0.7 : 1,
  };

  if (!data) return <LoadingPage />;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <PageHeader active="food" data={data} />
      
      <main style={{ padding: "32px", flex: 1, display: "flex", justifyContent: "center", overflow: "hidden" }}>
        <div style={{ width: "100%", maxWidth: 1180, display: "flex", flexDirection: "column", gap: 18, minHeight: 0 }}>
          {/* Header showing selected date & DateNavigator */}
          <div className="grid-card" style={{ padding: "14px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexShrink: 0 }}>
            <div className="zine-paperclip" />
            <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
              <div className="zine-eyebrow blue" style={{ marginBottom: 0, flexShrink: 0 }}>
                <span>↳ food & spend</span>
                <span>01</span>
              </div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {data.TODAY.dateLong}
              </h1>
            </div>
            <DateNavigator selectedDate={date} onChange={setDate} compact />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 28, flex: 1, minHeight: 0 }}>
          {/* Spending Section (placed above food) */}
          <div className="grid-card" style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 14, minHeight: 0 }}>
            <div className="zine-paperclip" />
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
                      border: "2px solid #000",
                      padding: "4px 9px",
                      cursor: "pointer",
                      fontFamily: "var(--mono)",
                      fontSize: 10,
                      borderRadius: 0,
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
                  background: "var(--bg)",
                  border: "2px solid #000",
                  borderRadius: 0,
                  marginBottom: 8,
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
                        border: "2px solid #000",
                        borderRadius: 0,
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
                        border: "2px solid #000",
                        borderRadius: 0,
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
                        border: "2px solid #000",
                        borderRadius: 0,
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
                        border: "2px solid #000",
                        borderRadius: 0,
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
                    border: "2px solid #000",
                    padding: "10px",
                    cursor: loading ? "not-allowed" : "pointer",
                    fontFamily: "var(--mono)",
                    fontSize: 12,
                    borderRadius: 0,
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

          {/* Food Section */}
          <div className="grid-card" style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 14, minHeight: 0 }}>
            <div className="zine-paperclip" />
            <Eyebrow
              label="Food"
              right={
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span>{data.MEALS.length} logged</span>
                  <button
                    type="button"
                    onClick={() => setShowAddFoodForm(!showAddFoodForm)}
                    style={{
                      background: showAddFoodForm ? "var(--rose)" : "var(--blue)",
                      color: "#fffaf0",
                      border: "2px solid #000",
                      padding: "4px 9px",
                      cursor: "pointer",
                      fontFamily: "var(--mono)",
                      fontSize: 10,
                      borderRadius: 0,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      fontWeight: 600,
                    }}
                  >
                    {showAddFoodForm ? "Cancel" : "+ Add"}
                  </button>
                </div>
              }
            />
            <LedgerHeader items={[
              { label: "kcal", value: data.VITALS.kcal.today, of: data.VITALS.kcal.target },
              { label: "protein", value: data.VITALS.protein.today, of: data.VITALS.protein.target, unit: "g" },
            ]} />

            {showAddFoodForm && (
              <form
                onSubmit={handleAddFood}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  padding: "16px 20px",
                  background: "var(--bg)",
                  border: "2px solid #000",
                  marginBottom: 8,
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 92px 92px", gap: 10 }}>
                  <input type="text" required placeholder="Food" value={foodLabel} onChange={(e) => setFoodLabel(e.target.value)} style={compactInputStyle} />
                  <input type="number" placeholder="kcal" value={foodKcal} onChange={(e) => setFoodKcal(e.target.value)} style={compactInputStyle} />
                  <input type="number" placeholder="protein" value={foodProtein} onChange={(e) => setFoodProtein(e.target.value)} style={compactInputStyle} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 90px auto", gap: 10 }}>
                  <select value={foodMeal} onChange={(e) => setFoodMeal(e.target.value)} style={compactInputStyle}>
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="dinner">Dinner</option>
                    <option value="snack">Snack</option>
                  </select>
                  <input type="number" placeholder="cost" value={foodCost} onChange={(e) => setFoodCost(e.target.value)} style={compactInputStyle} />
                  <button type="submit" disabled={foodLoading} style={compactButtonStyle}>
                    {foodLoading ? "Saving" : "Save"}
                  </button>
                </div>
              </form>
            )}
            
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
        </div>
      </main>
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
