"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { format, parseISO, subDays } from "date-fns";
import { Pencil, ChevronLeft, ChevronRight, Calendar as CalendarIcon, X, Check, Plus, Trash2, GripVertical, Lightbulb, Archive } from "lucide-react";
import type {
  ActivityApiRow,
  CockpitPostcard,
  DashBlock,
  DashData,
  DashFeed,
  DashLearning,
  DashTask,
  FoodApiRow,
  Idea,
  SpendApiRow,
  SystemPostcardId,
  SystemPostcardPositions,
  TaskApiRow,
  TimeBlockApiRow,
  WorkoutApiRow,
} from "./types";

export type { ActivityApiRow, DashBlock, DashData, DashLearning, DashTask } from "./types";

// ── Day timeline ──────────────────────────────────────────────────────────────
const TL_START = 6 * 60;   // 6:00 AM
const TL_END   = 23 * 60;  // 11:00 PM
const TL_SPAN  = TL_END - TL_START;

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

function sortBlocks(blocks: DashBlock[]) {
  return [...blocks].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
}

export function useDashData(
  dateOverride?: string,
  refreshTrigger?: number,
  options?: {
    includeLearnings?: boolean;
    includeTasks?: boolean;
    includeProblems?: boolean;
    includeQuotes?: boolean;
    includeWorkouts?: boolean;
  }
): DashData | null {
  const [data, setData] = useState<DashData | null>(null);

  const includeLearnings = options?.includeLearnings ?? true;
  const includeTasks = options?.includeTasks ?? true;
  const includeProblems = options?.includeProblems ?? true;
  const includeQuotes = options?.includeQuotes ?? true;
  const includeWorkouts = options?.includeWorkouts ?? false;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const today = dateOverride || localIsoDate();
      const learningDates = Array.from({ length: 14 }, (_, i) => localIsoDate(subDays(new Date(today), i)));

      const dailyResPromise = fetch(`/api/daily?date=${today}`).then((r) => r.json());

      const tasksResPromise = includeTasks
        ? fetch("/api/tasks").then((r) => r.json()).catch(() => ({ tasks: [] }))
        : Promise.resolve({ tasks: [] });

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

      const workoutsResPromise = includeWorkouts
        ? fetch("/api/workouts").then((r) => r.json()).catch(() => ({ workouts: [] }))
        : Promise.resolve({ workouts: [] });

      const [
        dailyRes,
        tasksRes,
        problemsRes,
        learningsRes,
        quotesRes,
        workoutsRes,
      ] = await Promise.all([
        dailyResPromise,
        tasksResPromise,
        problemsResPromise,
        learningsResPromise,
        quotesResPromise,
        workoutsResPromise,
      ]);

      if (cancelled) return;

      const now = nowMinutes();
      const food = (dailyRes.food ?? []) as FoodApiRow[];
      const spending = (dailyRes.spending ?? []) as SpendApiRow[];
      const timeBlocks = (dailyRes.time_blocks ?? []) as TimeBlockApiRow[];
      const activities = (dailyRes.activities ?? []) as ActivityApiRow[];
      const allTasks = (tasksRes.tasks ?? []) as TaskApiRow[];
      const todayWorkouts = ((workoutsRes.workouts ?? []) as WorkoutApiRow[])
        .filter((workout) => workout.occurred_date === today);
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

      const blocks = sortBlocks([...blockRows, ...mealRows]).map((b) => ({
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

      const workoutSets = todayWorkouts.flatMap((workout) => workout.workout_exercises ?? []);
      const workoutExerciseNames = new Set(workoutSets.map((set) => set.exercise_name));

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
        WORKOUT_SUMMARY: {
          sessions: todayWorkouts.length,
          exercises: workoutExerciseNames.size,
          sets: workoutSets.length,
          volume: workoutSets.reduce((sum, set) => sum + (set.reps * set.weight_kg), 0),
          label: workoutExerciseNames.size > 0
            ? Array.from(workoutExerciseNames).slice(0, 2).join(" + ")
            : "Rest day",
        },
      });
    }

    load().catch((error) => {
      console.error(error);
      if (!cancelled) setData(null);
    });

    return () => {
      cancelled = true;
    };
  }, [dateOverride, refreshTrigger, includeLearnings, includeTasks, includeProblems, includeQuotes, includeWorkouts]);

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
      const [dailyRes, tasksRes] = await Promise.all([
        fetch(`/api/daily?date=${date}`).then((r) => r.json()).catch(() => ({})),
        fetch("/api/tasks").then((r) => r.json()).catch(() => ({ tasks: [] })),
      ]);
      if (cancelled) return;

      const timeBlocks = (dailyRes.time_blocks ?? []) as TimeBlockApiRow[];
      const allTasks = ((tasksRes.tasks ?? []) as TaskApiRow[]).filter((t) => !t.done);

      const blockRows: DashBlock[] = timeBlocks.map((b) => ({
        kind: "blk", id: b.id, start: b.start, end: b.end, label: b.activity, cat: b.category,
      }));

      const blocks = sortBlocks(blockRows);
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
  { id: "tasks", label: "tasks", href: "/tasks" },
  { id: "calendar", label: "calendar", href: "/calendar" },
  { id: "food", label: "food & spend", href: "/food" },
  { id: "workouts", label: "workouts", href: "/workouts" },
  { id: "activities", label: "activities", href: "/activities" },
];

type NavItemId = "cockpit" | "calendar" | "tasks" | "food" | "activities" | "workouts";

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
  const [clientNow, setClientNow] = useState<number | null>(null);

  useEffect(() => {
    setClientNow(nowMinutes());
  }, []);

  const now = data?.NOW_MIN ?? clientNow;
  const t = now === null ? "--:--" : `${String(Math.floor(now / 60)).padStart(2, "0")}:${String(now % 60).padStart(2, "0")}`;
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

export function MealRow({ m, onDelete }: { m: DashData["MEALS"][number]; onDelete?: (m: DashData["MEALS"][number]) => void }) {
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

export function SpendRow({ s, onDelete }: { s: DashData["SPEND"][number]; onDelete?: (s: DashData["SPEND"][number]) => void }) {
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

export function LedgerHeader({ items }: { items: { label: string; value: string | number; of?: string | number; unit?: string }[] }) {
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
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>Send time blocks via Telegram, e.g. &quot;6-7 gym&quot;</div>
        </div>
      )}
    </div>
  );
}

function createDefaultCockpitCards(): CockpitPostcard[] {
  return [
    {
      id: "doing",
      title: "What I am doing",
      x: 42,
      y: 42,
      items: [
        { id: "doing-1", text: "Keep the current work visible", done: false },
      ],
    },
    {
      id: "thinking",
      title: "Thinking space",
      x: 370,
      y: 176,
      items: [
        { id: "thinking-1", text: "Capture the next useful move", done: false },
      ],
    },
  ];
}

function createDefaultSystemPostcardPositions(): SystemPostcardPositions {
  return {
    problems: { x: 698, y: 42 },
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

function TodayTile({
  href,
  label,
  value,
  detail,
  progress,
}: {
  href: string;
  label: string;
  value: string;
  detail: string;
  progress?: number;
}) {
  return (
    <Link href={href} className="today-tile">
      <div className="eyebrow-tag" style={{ marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value}
      </div>
      <div className="mono" style={{ marginTop: 5, fontSize: 9.5, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {detail}
      </div>
      {progress !== undefined && (
        <div style={{ height: 4, marginTop: 10, overflow: "hidden", background: "var(--card-2)", border: "1px solid #000000" }}>
          <div style={{ width: `${Math.min(100, Math.max(0, progress))}%`, height: "100%", background: "#000000" }} />
        </div>
      )}
    </Link>
  );
}

function estimatedIdeaNoteHeight(text: string) {
  const estimatedLines = Math.max(1, Math.ceil(text.length / 28));
  const bodyHeight = Math.max(38, estimatedLines * 18 + 20);
  return 30 + bodyHeight + 31;
}

export function CockpitPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [newProblem, setNewProblem] = useState("");
  const [newCardTitle, setNewCardTitle] = useState("");
  const [newIdeaText, setNewIdeaText] = useState("");
  const [cards, setCards] = useState<CockpitPostcard[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [ideaPositions, setIdeaPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [ideasVisible, setIdeasVisible] = useState(false);
  const [problemsVisible, setProblemsVisible] = useState(false);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null);
  const [editingIdeaText, setEditingIdeaText] = useState("");
  const [cardsLoaded, setCardsLoaded] = useState(false);
  const [systemPositions, setSystemPositions] = useState<SystemPostcardPositions>(createDefaultSystemPostcardPositions);
  const [systemPositionsLoaded, setSystemPositionsLoaded] = useState(false);
  const [dragState, setDragState] = useState<{
    id: string;
    kind: "user" | "system" | "idea";
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    itemWidth: number;
    itemHeight: number;
  } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const data = useDashData(undefined, refreshTrigger, { includeLearnings: false, includeQuotes: false, includeWorkouts: true });

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
      const savedPositions = window.localStorage.getItem("dash_cockpit_ideas_v1");
      const savedVisibility = window.localStorage.getItem("dash_cockpit_ideas_visible_v1");
      const savedProblemsVisibility = window.localStorage.getItem("dash_cockpit_problems_visible_v1");
      setIdeaPositions(savedPositions ? JSON.parse(savedPositions) : {});
      setIdeasVisible(savedVisibility === "true");
      setProblemsVisible(savedProblemsVisibility === "true");
    } catch {
      setIdeaPositions({});
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

  useEffect(() => {
    window.localStorage.setItem("dash_cockpit_ideas_v1", JSON.stringify(ideaPositions));
  }, [ideaPositions]);

  useEffect(() => {
    window.localStorage.setItem("dash_cockpit_ideas_visible_v1", String(ideasVisible));
  }, [ideasVisible]);

  useEffect(() => {
    window.localStorage.setItem("dash_cockpit_problems_visible_v1", String(problemsVisible));
  }, [problemsVisible]);

  const loadIdeas = useCallback(async () => {
    setIdeasLoading(true);
    try {
      const response = await fetch("/api/ideas?all=true");
      const payload = await response.json();
      setIdeas(((payload.ideas ?? []) as Idea[]).filter((idea) => !idea.archived));
    } finally {
      setIdeasLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ideasVisible) void loadIdeas();
  }, [ideasVisible, loadIdeas]);

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

  const addIdea = useCallback(async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!newIdeaText.trim()) return;
    const response = await fetch("/api/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: newIdeaText.trim() }),
    });
    if (response.ok) {
      setNewIdeaText("");
      await loadIdeas();
    }
  }, [loadIdeas, newIdeaText]);

  const archiveIdea = useCallback(async (id: string) => {
    const response = await fetch(`/api/ideas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    if (response.ok) setIdeas((current) => current.filter((idea) => idea.id !== id));
  }, []);

  const deleteIdea = useCallback(async (id: string) => {
    const response = await fetch(`/api/ideas/${id}`, { method: "DELETE" });
    if (response.ok) setIdeas((current) => current.filter((idea) => idea.id !== id));
  }, []);

  const saveIdea = useCallback(async (id: string) => {
    if (!editingIdeaText.trim()) return;
    const response = await fetch(`/api/ideas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: editingIdeaText.trim() }),
    });
    if (response.ok) {
      setIdeas((current) => current.map((idea) => idea.id === id ? { ...idea, text: editingIdeaText.trim() } : idea));
      setEditingIdeaId(null);
      setEditingIdeaText("");
    }
  }, [editingIdeaText]);

  const createCard = useCallback((e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!newCardTitle.trim()) return;
    const offset = cards.length % 5;
    const card: CockpitPostcard = {
      id: Math.random().toString(36).slice(2, 10),
      title: newCardTitle.trim(),
      x: 42 + offset * 38,
      y: 360 + offset * 28,
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
    kind: "user" | "system" | "idea",
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, input, textarea, a")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const cardElement = event.currentTarget.closest<HTMLElement>(".idea-note, .grid-card");
    const cardRect = cardElement?.getBoundingClientRect();
    setDragState({
      id: item.id,
      kind,
      startX: event.clientX,
      startY: event.clientY,
      originX: item.x,
      originY: item.y,
      itemWidth: (cardRect?.width ?? (kind === "idea" ? 220 : 292)) + 12,
      itemHeight: (cardRect?.height ?? (kind === "idea" ? 112 : 220)) + 36,
    });
  }, []);

  const moveDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragState || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const nextX = Math.max(12, Math.min(rect.width - dragState.itemWidth, dragState.originX + event.clientX - dragState.startX));
    const nextY = Math.max(12, Math.min(rect.height - dragState.itemHeight, dragState.originY + event.clientY - dragState.startY));
    if (dragState.kind === "system") {
      const systemId = dragState.id as SystemPostcardId;
      setSystemPositions((current) => ({
        ...current,
        [systemId]: { x: nextX, y: nextY },
      }));
      return;
    }

    if (dragState.kind === "idea") {
      setIdeaPositions((current) => ({
        ...current,
        [dragState.id]: { x: nextX, y: nextY },
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
  const spendByCategory = data.SPEND.reduce<Record<string, number>>((totals, item) => {
    totals[item.cat] = (totals[item.cat] ?? 0) + item.amount;
    return totals;
  }, {});
  const topSpendCategory = Object.entries(spendByCategory).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "No spending logged";

  return (
    <div style={{ height: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <PageHeader active="cockpit" data={data} />

      <main className="cockpit-layout">
        <section className="today-strip" aria-label="Today at a glance">
          <TodayTile
            href="/tasks"
            label="Next task"
            value={activeTask?.title ?? "All clear"}
            detail={activeTask ? `${activeTask.weight} · due ${activeTask.due || "today"}` : "Nothing waiting"}
          />
          <TodayTile
            href="/calendar"
            label="Next event"
            value={upcomingEvent?.label ?? "Free"}
            detail={upcomingEvent ? `${upcomingEvent.start}–${upcomingEvent.end}` : "No upcoming event"}
          />
          <TodayTile
            href="/food"
            label="Food"
            value={data.MEALS.length ? `${data.VITALS.kcal.today} kcal · ${data.VITALS.protein.today}g` : "Not logged"}
            detail={`${data.VITALS.kcal.target} kcal · ${data.VITALS.protein.target}g target`}
            progress={(data.VITALS.kcal.today / data.VITALS.kcal.target) * 100}
          />
          <TodayTile
            href="/food"
            label="Spending"
            value={`₹${data.VITALS.spend.today.toFixed(0)}`}
            detail={data.SPEND.length ? `${topSpendCategory} · ₹${data.VITALS.spend.target} target` : "₹0 today"}
            progress={(data.VITALS.spend.today / data.VITALS.spend.target) * 100}
          />
          <TodayTile
            href="/workouts"
            label="Workout"
            value={data.WORKOUT_SUMMARY.label}
            detail={data.WORKOUT_SUMMARY.sessions ? `${data.WORKOUT_SUMMARY.exercises} exercises · ${data.WORKOUT_SUMMARY.sets} sets` : "Recovery is training too"}
          />
        </section>

        <div className="cockpit-workspace">
        <div className="cockpit-toolbar">
          <form onSubmit={createCard} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 280, flex: "1 1 360px" }}>
            <input
              className="clean-input"
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              placeholder="New postcard..."
              style={{ flex: 1, minWidth: 0, height: 38, padding: "0 12px", fontSize: 12 }}
            />
            <button className="clean-button primary" type="submit" disabled={!newCardTitle.trim()} title="Add postcard">
              <Plus size={14} /> Add
            </button>
          </form>

          {ideasVisible && (
            <form onSubmit={addIdea} style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 300px" }}>
              <input
                className="clean-input"
                value={newIdeaText}
                onChange={(e) => setNewIdeaText(e.target.value)}
                placeholder="Add an idea..."
                style={{ flex: 1, minWidth: 0, height: 38, padding: "0 12px", fontSize: 12 }}
              />
              <button className="clean-button" type="submit" disabled={!newIdeaText.trim()}>Save</button>
            </form>
          )}

          <button type="button" className={`clean-button ${ideasVisible ? "active" : ""}`} onClick={() => setIdeasVisible((visible) => !visible)}>
            <Lightbulb size={14} /> Ideas {ideasLoading ? "…" : ideasVisible ? ideas.length : ""}
          </button>
          <button type="button" className={`clean-button ${problemsVisible ? "active" : ""}`} onClick={() => setProblemsVisible((visible) => !visible)}>
            Problems {activeProblems.length}
          </button>
        </div>

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
            border: "2px solid #000000",
            backgroundImage: "radial-gradient(rgba(12, 12, 14, 0.12) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            backgroundColor: "rgba(252, 251, 247, 0.32)",
          }}
        >
          <div style={{ position: "relative", minWidth: 1120, minHeight: 760 }}>
            {problemsVisible && <CockpitPostcardShell
              title="Problem space"
              eyebrow="open loops"
              x={systemPositions.problems.x}
              y={systemPositions.problems.y}
              count={`${activeProblems.length} items`}
              onPointerDown={(event) => startDrag({ id: "problems", ...systemPositions.problems }, "system", event)}
            >
              <div style={{ display: "flex", flexDirection: "column", flex: 1, background: "#ffffff" }}>
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
                          style={{ width: 16, height: 16, border: "1px solid var(--line-strong)", borderRadius: 4, background: "transparent", cursor: "pointer", flexShrink: 0, padding: 0 }}
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
            </CockpitPostcardShell>}

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
                <div style={{ display: "flex", flexDirection: "column", flex: 1, background: "#ffffff" }}>
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
                              border: "1px solid var(--line-strong)",
                              borderRadius: 4,
                              background: item.done ? "#ffedd5" : "transparent",
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

            {ideasVisible && ideas.map((idea, index) => {
              const column = index % 4;
              const precedingColumnIdeas = ideas.filter((_, precedingIndex) => (
                precedingIndex < index && precedingIndex % 4 === column
              ));
              const position = ideaPositions[idea.id] ?? {
                x: 42 + column * 240,
                y: 420 + precedingColumnIdeas.reduce(
                  (offset, precedingIdea) => offset + estimatedIdeaNoteHeight(precedingIdea.text) + 14,
                  0
                ),
              };
              return (
                <div
                  key={idea.id}
                  className="idea-note"
                  style={{ left: position.x, top: position.y }}
                >
                  <div
                    className="idea-note-header"
                    onPointerDown={(event) => startDrag({ id: idea.id, ...position }, "idea", event)}
                  >
                    <span className="mono" style={{ fontSize: 8.5, fontWeight: 900, textTransform: "uppercase" }}>↳ {idea.category || "idea"}</span>
                    <GripVertical size={12} />
                  </div>
                  <div className="idea-note-body">
                    {editingIdeaId === idea.id ? (
                      <textarea
                        autoFocus
                        className="clean-input"
                        value={editingIdeaText}
                        onChange={(event) => setEditingIdeaText(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void saveIdea(idea.id);
                          }
                          if (event.key === "Escape") setEditingIdeaId(null);
                        }}
                        style={{ width: "100%", minHeight: 60, padding: 7, resize: "none", fontSize: 12, lineHeight: 1.4 }}
                      />
                    ) : (
                      <p className="idea-note-text" title={idea.text}>{idea.text}</p>
                    )}
                  </div>
                  <div className="idea-note-footer">
                    <button type="button" title="Edit idea" onClick={() => { setEditingIdeaId(idea.id); setEditingIdeaText(idea.text); }} style={{ border: 0, background: "transparent", padding: 4, cursor: "pointer", color: "var(--muted)" }}>
                      <Pencil size={12} />
                    </button>
                    <button type="button" title="Archive idea" onClick={() => void archiveIdea(idea.id)} style={{ border: 0, background: "transparent", padding: 4, cursor: "pointer", color: "var(--muted)" }}>
                      <Archive size={12} />
                    </button>
                    <button type="button" title="Delete idea" onClick={() => void deleteIdea(idea.id)} style={{ border: 0, background: "transparent", padding: 4, cursor: "pointer", color: "var(--rose)" }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </div>
      </main>
    </div>
  );
}
