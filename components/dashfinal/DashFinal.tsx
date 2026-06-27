"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { format, parseISO } from "date-fns";
import { Pencil, ChevronLeft, ChevronRight, Calendar as CalendarIcon, X, Check, Plus, Trash2, GripVertical, Lightbulb, Archive } from "lucide-react";
import { formatINR } from "@/lib/currency";
import type { TicketRow, TicketSubtaskDetails } from "@/lib/tickets-types";
import type {
  CockpitPostcard,
  DashBlock,
  DashData,
  DashFeed,
  DashTask,
  FoodApiRow,
  SpendApiRow,
  TaskApiRow,
  TimeBlockApiRow,
  WorkoutApiRow,
} from "./types";

export type { DashBlock, DashData, DashTask } from "./types";

// ── Day timeline ──────────────────────────────────────────────────────────────
const TL_START = 4 * 60 + 30;  // 4:30 AM
const TL_END   = 22 * 60 + 30; // 10:30 PM
const TL_SPAN  = TL_END - TL_START;

// Category accent colors — vibrant left-border + translucent fill pairs
const CAT_ACCENT: Record<string, { border: string; bg: string; text: string }> = {
  "Deep Work": { border: "#6366f1", bg: "rgba(99,102,241,0.10)",  text: "#818cf8" },
  Meetings:    { border: "#14b8a6", bg: "rgba(20,184,166,0.10)",  text: "#5eead4" },
  Admin:       { border: "#94a3b8", bg: "rgba(148,163,184,0.08)", text: "#cbd5e1" },
  Learning:    { border: "#a78bfa", bg: "rgba(167,139,250,0.10)", text: "#c4b5fd" },
  Health:      { border: "#34d399", bg: "rgba(52,211,153,0.10)",  text: "#6ee7b7" },
  Body:        { border: "#34d399", bg: "rgba(52,211,153,0.10)",  text: "#6ee7b7" },
  Personal:    { border: "#fbbf24", bg: "rgba(251,191,36,0.10)",  text: "#fcd34d" },
  Other:       { border: "#78716c", bg: "rgba(120,113,108,0.08)", text: "#a8a29e" },
};
const CAT_ACCENT_DEFAULT = CAT_ACCENT.Other;
const CAL_ACCENT = { border: "#3b82f6", bg: "rgba(59,130,246,0.10)", text: "#93c5fd" };

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
    includeTasks?: boolean;
    includeProblems?: boolean;
    includeQuotes?: boolean;
    includeWorkouts?: boolean;
  }
): DashData | null {
  const [data, setData] = useState<DashData | null>(null);

  const includeTasks = options?.includeTasks ?? true;
  const includeProblems = options?.includeProblems ?? true;
  const includeQuotes = options?.includeQuotes ?? true;
  const includeWorkouts = options?.includeWorkouts ?? false;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const today = dateOverride || localIsoDate();

      const dailyResPromise = fetch(`/api/daily?date=${today}`).then((r) => r.json());

      const tasksResPromise = includeTasks
        ? fetch("/api/tasks").then((r) => r.json()).catch(() => ({ tasks: [] }))
        : Promise.resolve({ tasks: [] });

      const problemsResPromise = includeProblems
        ? fetch("/api/problems").then((r) => r.json()).catch(() => ({ problems: [] }))
        : Promise.resolve({ problems: [] });

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
        quotesRes,
        workoutsRes,
      ] = await Promise.all([
        dailyResPromise,
        tasksResPromise,
        problemsResPromise,
        quotesResPromise,
        workoutsResPromise,
      ]);

      if (cancelled) return;

      const now = nowMinutes();
      const food = (dailyRes.food ?? []) as FoodApiRow[];
      const spending = (dailyRes.spending ?? []) as SpendApiRow[];
      const timeBlocks = (dailyRes.time_blocks ?? []) as TimeBlockApiRow[];
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
          obj: `${s.item} · ${formatINR(s.amount)}`,
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
  }, [dateOverride, refreshTrigger, includeTasks, includeProblems, includeQuotes, includeWorkouts]);

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
  { id: "tasksCalendar", label: "tasks & calendar", href: "/tasks" },
  { id: "food", label: "food & spend", href: "/food" },
  { id: "workouts", label: "workouts", href: "/workouts" },
];

type NavItemId = "cockpit" | "tasksCalendar" | "food" | "workouts";

function Nav({ active }: { active: NavItemId }) {
  return (
    <nav style={{ display: "flex", alignItems: "center", gap: 26, flexShrink: 0 }}>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={`mono nav-link ${item.id === active ? "nav-link-active" : ""}`}
          style={{
            fontSize: 15,
            letterSpacing: "0.04em",
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
        padding: "18px 30px",
        borderBottom: "2px solid var(--line)",
        backgroundColor: "var(--bg)",
        flexShrink: 0,
        zIndex: 100
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 30,
            height: 30,
            background: "var(--text)",
            borderRadius: 4,
            display: "grid",
            placeItems: "center",
            fontFamily: "var(--sans)",
            fontSize: 16,
            fontWeight: 700,
            color: "#ffffff"
          }}
        >
          D
        </div>
        <span className="mono" style={{ fontSize: 15, letterSpacing: "0.18em", fontWeight: 700, color: "var(--text)" }}>
          DASH
        </span>
      </div>

      <Nav active={active} />

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
          {t}
        </span>
        <span className="mono" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6B675E", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#2FBF71" }} />
          SYNCED
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
      <span className="mono" style={{ color: "var(--text)", textAlign: "right" }}>{formatINR(s.amount)}</span>
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

export function DayTimeline({
  blocks,
  tasks,
  nowMin,
  isToday,
  onBlockClick,
  selectedBlockId,
}: {
  blocks: DashBlock[];
  tasks: DashTask[];
  nowMin: number;
  isToday: boolean;
  onBlockClick?: (block: DashBlock) => void;
  selectedBlockId?: string;
}) {
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
      {blocks.map((b) => {
        const top = minuteToPx(toMinutes(b.start));
        const h = Math.max(minuteToPx(toMinutes(b.end)) - top, SLOT_HEIGHT - 2);
        const isCal = b.kind === "cal";
        const accent = isCal ? CAL_ACCENT : (CAT_ACCENT[b.cat || "Other"] ?? CAT_ACCENT_DEFAULT);
        const compact = h <= SLOT_HEIGHT + 2;
        const blockKey = b.id ?? `${b.kind}-${b.start}-${b.end}-${b.label}`;
        const isSelected = selectedBlockId === blockKey;
        return (
          <div
            key={blockKey}
            role={onBlockClick ? "button" : undefined}
            tabIndex={onBlockClick ? 0 : undefined}
            onClick={() => onBlockClick?.(b)}
            onKeyDown={(event) => {
              if (!onBlockClick) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onBlockClick(b);
              }
            }}
            style={{
              position: "absolute",
              top,
              height: h,
              left: LABEL_W + 18,
              right: 0,
              background: accent.bg,
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              border: "1px solid rgba(0,0,0,0.06)",
              borderLeft: `3px solid ${accent.border}`,
              borderRadius: 10,
              padding: compact ? "5px 12px" : "8px 14px",
              overflow: "hidden",
              boxShadow: isSelected
                ? `0 0 0 2px ${accent.border}, 0 4px 16px ${accent.border}33`
                : `0 1px 4px rgba(0,0,0,0.06)`,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              cursor: onBlockClick ? "pointer" : "default",
              outline: "none",
              zIndex: isSelected ? 4 : 1,
              transition: "box-shadow 0.2s, border-color 0.2s",
            }}
          >
            <div style={{ fontSize: compact ? 12 : 13.5, color: "var(--text)", fontWeight: 700, lineHeight: 1.2, letterSpacing: "0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.label}</div>
            <div className="mono" style={{ fontSize: compact ? 9.5 : 10.5, color: accent.text, opacity: 0.85, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
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

type CockpitAgent = "codex" | "claude" | "hermes" | "openclaw";
type CockpitImportance = "low" | "medium" | "high" | "urgent";

type CockpitTicketDraft = {
  title: string;
  dueDate: string;
  dueAt: string;
  importance: CockpitImportance | "";
  subtasks: string[];
  agent: CockpitAgent | null;
};

const AGENT_LABELS: Record<CockpitAgent, string> = {
  codex: "Codex",
  claude: "Claude",
  hermes: "Hermes",
  openclaw: "OpenClaw",
};

const COCKPIT_BLUE = "#7dd3fc";

const AGENT_COLORS: Record<CockpitAgent, string> = {
  codex: COCKPIT_BLUE,
  claude: COCKPIT_BLUE,
  hermes: COCKPIT_BLUE,
  openclaw: COCKPIT_BLUE,
};

const IMPORTANCE_LABELS: Record<CockpitImportance, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

function titleCaseText(value: string) {
  return value
    .trim()
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function ticketDueText(ticket: TicketRow) {
  if (ticket.due_label) return ticket.due_label;
  if (ticket.due_at) return dueLabel(ticket.due_at);
  return "No due date";
}

function ticketImportanceText(ticket: TicketRow) {
  return ticket.importance ? IMPORTANCE_LABELS[ticket.importance] : "No priority";
}

function ticketSubtaskDetails(ticket: TicketRow): TicketSubtaskDetails {
  return ticket.subtask_details ?? {};
}

function localDueAt(daysFromToday: number) {
  const [year, month, day] = localIsoDate().split("-").map(Number);
  const due = new Date(year, month - 1, day + daysFromToday, 18, 0, 0, 0);
  return due.toISOString();
}

function localDueAtHour(daysFromToday: number, hour: number) {
  const [year, month, day] = localIsoDate().split("-").map(Number);
  const due = new Date(year, month - 1, day + daysFromToday, hour, 0, 0, 0);
  return due.toISOString();
}

function stripFieldLines(value: string) {
  return value
    .split(/\n+/)
    .filter((line) => {
      if (/^\s*(due|deadline|by|importance|priority|subtasks?|steps?)\b/i.test(line)) return false;
      if (/^\s*(urgent|high|medium|low|important|very important|low priority)\s*$/i.test(line)) return false;
      return true;
    })
    .join(" ")
    .trim();
}

function parseCockpitTicket(text: string, selectedAgent: CockpitAgent | null): CockpitTicketDraft {
  const lower = text.toLowerCase();
  const agentMatch = text.match(/@(codex|claude|hermes|open\s*claw|openclaw|open\s*floor)/i);
  const agent = agentMatch
    ? agentMatch[1].toLowerCase().replace(/\s+/g, "") === "openfloor"
      ? "openclaw"
      : agentMatch[1].toLowerCase().replace(/\s+/g, "") as CockpitAgent
    : selectedAgent;
  const cleaned = text.replace(/@(codex|claude|hermes|open\s*claw|openclaw|open\s*floor)/ig, "").trim();
  const beforeSubtasks = stripFieldLines(cleaned).split(/\bsubtasks?\b/i)[0] ?? "";
  const firstTitleChunk = beforeSubtasks.split(/[.!?]/).find((chunk) => chunk.trim()) ?? "";
  const title = titleCaseText(firstTitleChunk.replace(/\b(by|before|due|deadline)\b.*$/i, ""));

  let dueDate = "";
  let dueAt = "";
  if (lower.includes("tonight")) {
    dueDate = "Tonight";
    dueAt = localDueAtHour(0, 22);
  } else if (lower.includes("today")) {
    dueDate = "Today";
    dueAt = localDueAt(0);
  } else if (lower.includes("eod") || lower.includes("end of day")) {
    dueDate = "Today";
    dueAt = localDueAtHour(0, 18);
  } else if (lower.includes("tomorrow")) {
    dueDate = "Tomorrow";
    dueAt = localDueAt(1);
  } else if (lower.includes("this week") || lower.includes("next week")) {
    dueDate = "This week";
    dueAt = localDueAt(5);
  } else if (lower.includes("month")) {
    dueDate = "This month";
    dueAt = localDueAt(21);
  }

  let importance: CockpitImportance | "" = "";
  if (lower.includes("urgent") || lower.includes("asap")) importance = "urgent";
  else if (lower.includes("very important") || lower.includes("must")) importance = "high";
  else if (lower.includes("important")) importance = "medium";
  else if (lower.includes("low priority")) importance = "low";
  const subtaskMatch = cleaned.match(/\b(?:subtasks?|steps?)\b\s*(?::|->|-)?\s*([\s\S]*)/i);
  const subtasks = subtaskMatch
    ? subtaskMatch[1]
        .split(/,|\n|;|\s+-\s+/)
        .map((item) => titleCaseText(item.replace(/^[-*]\s*/, "").replace(/[.!?]+$/g, "")))
        .filter(Boolean)
    : [];

  return { title, dueDate, dueAt, importance, subtasks, agent };
}

function CockpitCard({
  eyebrow,
  tone = "#ffffff",
  className = "",
  headerMeta,
  style,
  children,
}: {
  eyebrow: string;
  tone?: string;
  className?: string;
  headerMeta?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <section className={`cockpit-card ${className}`.trim()} style={style}>
      <span className="zine-paperclip" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: 12 }}>
        <div className="zine-eyebrow" style={{ background: tone, marginBottom: 0 }}>{eyebrow}</div>
        {headerMeta && (
          <span className="mono" style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", marginRight: 36 }}>
            {headerMeta}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function MiniPill({
  children,
  tone = "#ffffff",
  filled = true,
}: {
  children: React.ReactNode;
  tone?: string;
  filled?: boolean;
}) {
  return (
    <span
      className="mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: 22,
        border: "1.5px solid #000000",
        background: filled ? tone : "transparent",
        padding: "2px 7px",
        fontSize: 10,
        fontWeight: 900,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function RequiredFieldChips({ draft }: { draft: CockpitTicketDraft }) {
  const fields = [
    ["TITLE", draft.title],
    ["DUE", draft.dueDate ? draft.dueDate.toLowerCase() : ""],
    ["IMPORTANCE", draft.importance ? IMPORTANCE_LABELS[draft.importance].toLowerCase() : ""],
    ["SUBTASKS", draft.subtasks.length ? String(draft.subtasks.length) : ""],
  ] as const;

  return (
    <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 8, margin: "14px 0 16px" }}>
      {fields.map(([label, value]) => {
        const complete = Boolean(value);
        return (
          <span key={label} className={`required-chip ${complete ? "complete" : ""}`}>
            <b>{label}</b>
            {complete ? (
              <>
                <span style={{ margin: "0 2px" }}>·</span>
                <span>{value}</span>
              </>
            ) : (
              <span style={{ marginLeft: 6 }}>waiting</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

function AgentQuickTags({
  selectedAgent,
  onSelect,
}: {
  selectedAgent: CockpitAgent | null;
  onSelect: (agent: CockpitAgent | null) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`agent-quick-tag mono ${selectedAgent === null ? "active" : ""}`}
        style={{ background: selectedAgent === null ? COCKPIT_BLUE : "#ffffff" }}
      >
        No agent
      </button>
      {(Object.keys(AGENT_LABELS) as CockpitAgent[])
        .filter((agent) => agent !== "openclaw")
        .map((agent) => (
          <button
            key={agent}
            type="button"
            onClick={() => onSelect(agent)}
            className={`agent-quick-tag mono ${selectedAgent === agent ? "active" : ""}`}
            style={{ background: selectedAgent === agent ? COCKPIT_BLUE : "#ffffff" }}
          >
            @{AGENT_LABELS[agent].toUpperCase()}
          </button>
        ))}
    </div>
  );
}

function subtaskStatus(ticket: TicketRow, subtask: string) {
  return ticketSubtaskDetails(ticket)[subtask]?.status ?? "backlog";
}

function subtaskDetailText(ticket: TicketRow, subtask: string) {
  return ticketSubtaskDetails(ticket)[subtask]?.details?.trim() ?? "";
}

function SubtaskMiniCard({
  ticket,
  subtask,
  compact = false,
  onMoveSubtask,
  onUpdateSubtask,
  onDeleteSubtask,
}: {
  ticket: TicketRow;
  subtask: string;
  compact?: boolean;
  onMoveSubtask: (id: string, subtask: string, status: "backlog" | "now") => Promise<void>;
  onUpdateSubtask: (id: string, oldSubtask: string, nextSubtask: string, details: string) => Promise<void>;
  onDeleteSubtask: (id: string, subtask: string) => Promise<void>;
}) {
  const [titleDraft, setTitleDraft] = useState(subtask);
  const [detailDraft, setDetailDraft] = useState(subtaskDetailText(ticket, subtask));
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const status = subtaskStatus(ticket, subtask);
  const details = subtaskDetailText(ticket, subtask);

  useEffect(() => {
    setTitleDraft(subtask);
    setDetailDraft(subtaskDetailText(ticket, subtask));
  }, [ticket, subtask]);

  const saveSubtask = async () => {
    const nextTitle = titleCaseText(titleDraft);
    if (!nextTitle) return;
    setBusy(true);
    try {
      await onUpdateSubtask(ticket.id, subtask, nextTitle, detailDraft.trim());
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6, background: "#FFFCE8", border: "1.5px solid #16130F", padding: "10px 10px", boxShadow: "2px 2px 0 rgba(20,17,12,.14)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 2.5px)", gap: "2.5px", flex: "none", opacity: 0.3 }}>
            <span style={{ width: "2.5px", height: "2.5px", borderRadius: "50%", background: "#16130F", display: "block" }}></span>
            <span style={{ width: "2.5px", height: "2.5px", borderRadius: "50%", background: "#16130F", display: "block" }}></span>
            <span style={{ width: "2.5px", height: "2.5px", borderRadius: "50%", background: "#16130F", display: "block" }}></span>
            <span style={{ width: "2.5px", height: "2.5px", borderRadius: "50%", background: "#16130F", display: "block" }}></span>
            <span style={{ width: "2.5px", height: "2.5px", borderRadius: "50%", background: "#16130F", display: "block" }}></span>
            <span style={{ width: "2.5px", height: "2.5px", borderRadius: "50%", background: "#16130F", display: "block" }}></span>
          </div>
          <input
            value={titleDraft}
            autoFocus
            onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void saveSubtask();
              if (e.key === "Escape") setEditing(false);
            }}
            placeholder="Subtask title"
            style={{
              flex: 1,
              border: "1.5px solid #16130F",
              background: "#ffffff",
              padding: "5px 7px",
              fontFamily: "var(--sans)",
              fontSize: "15px",
              color: "#16130F",
              outline: "none"
            }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            value={detailDraft}
            onChange={(e) => setDetailDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void saveSubtask();
              if (e.key === "Escape") setEditing(false);
            }}
            placeholder="Add details / description..."
            style={{
              flex: 1,
              border: "1.5px solid #16130F",
              background: "#ffffff",
              padding: "5px 7px",
              fontFamily: "var(--mono)",
              fontSize: "10px",
              color: "#16130F",
              outline: "none"
            }}
          />
          <button
            type="button"
            onClick={() => void saveSubtask()}
            title="Save"
            style={{
              flex: "none",
              border: "1.5px solid #16130F",
              background: "#8BD4F0",
              padding: "5px 9px",
              fontFamily: "var(--mono)",
              fontSize: "9.5px",
              fontWeight: 600,
              letterSpacing: ".08em",
              cursor: "pointer",
              color: "#16130F"
            }}
          >
            SAVE
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("application/dash-subtask", JSON.stringify({ ticketId: ticket.id, subtask }));
        event.dataTransfer.setData("text/plain", `subtask:${ticket.id}:${subtask}`);
      }}
      onDoubleClick={() => setEditing(true)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        background: "#FBFBF8",
        border: "1.5px solid #16130F",
        padding: "8px 10px",
        boxShadow: "2px 2px 0 rgba(20,17,12,.14)",
        cursor: "grab",
        userSelect: "none"
      }}
      title={details ? `Description: ${details}` : "Drag to focus · double-click to edit"}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 2.5px)", gap: "2.5px", flex: "none", cursor: "grab" }}>
        <span style={{ width: "2.5px", height: "2.5px", borderRadius: "50%", background: "#16130F", display: "block" }}></span>
        <span style={{ width: "2.5px", height: "2.5px", borderRadius: "50%", background: "#16130F", display: "block" }}></span>
        <span style={{ width: "2.5px", height: "2.5px", borderRadius: "50%", background: "#16130F", display: "block" }}></span>
        <span style={{ width: "2.5px", height: "2.5px", borderRadius: "50%", background: "#16130F", display: "block" }}></span>
        <span style={{ width: "2.5px", height: "2.5px", borderRadius: "50%", background: "#16130F", display: "block" }}></span>
        <span style={{ width: "2.5px", height: "2.5px", borderRadius: "50%", background: "#16130F", display: "block" }}></span>
      </div>
      <span style={{ fontFamily: "var(--sans)", fontWeight: 600, fontSize: "15px", color: "#16130F", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {subtask}
      </span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        draggable={false}
        title="Edit subtask"
        style={{
          flex: "none",
          border: "1px solid #16130F",
          background: "#ffffff",
          width: 20,
          height: 20,
          lineHeight: 1,
          fontSize: 10,
          cursor: "pointer",
          color: "#16130F",
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        ✎
      </button>
      {!compact && (
        <span
          onClick={() => void onMoveSubtask(ticket.id, subtask, "now")}
          title="Drag to focus · double-click to edit"
          style={{
            fontFamily: "var(--mono)",
            fontSize: "13px",
            color: "#c0bdb2",
            flex: "none",
            cursor: "pointer",
            userSelect: "none"
          }}
        >
          ↑
        </span>
      )}
    </div>
  );
}

function NowSubtaskCard({
  ticket,
  subtask,
  onMoveSubtask,
  onDeleteSubtask,
}: {
  ticket: TicketRow;
  subtask: string;
  onMoveSubtask: (id: string, subtask: string, status: "backlog" | "now") => Promise<void>;
  onDeleteSubtask: (id: string, subtask: string) => Promise<void>;
}) {
  const detailsMap = ticketSubtaskDetails(ticket);
  const details = detailsMap[subtask]?.details;

  return (
    <div style={{ display: "flex", alignItems: "stretch", background: "#ffffff", border: "1.5px solid #16130F", boxShadow: "3px 3px 0 rgba(20,17,12,.13)" }}>
      <div style={{ width: 6, alignSelf: "stretch", flex: "none", background: "#F3E15E" }}></div>
      <div style={{ flex: 1, padding: "12px 13px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 11, letterSpacing: ".1em", background: "#16130F", color: "#ffffff", padding: "3px 5px" }}>
              SUBTASK
            </span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".08em", color: "#8a877d", textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {ticket.title}
            </span>
          </div>
          <div style={{ fontFamily: "var(--sans)", fontWeight: 600, fontSize: 15, color: "#16130F", marginTop: 6 }}>
            {subtask}
          </div>
          {details && (
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px dashed #cfccc2", fontFamily: "var(--mono)", fontSize: 11, color: "#5a574e", lineHeight: 1.4 }}>
              {details}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => void onMoveSubtask(ticket.id, subtask, "backlog")}
          style={{
            flex: "none",
            width: 27,
            height: 27,
            border: "1.5px solid #16130F",
            background: "#ffffff",
            cursor: "pointer",
            fontSize: 15,
            color: "#16130F",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0
          }}
          title="Send back to its ticket"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function TicketCard({
  ticket,
  placement = "saved",
  index = 0,
  onMove,
  onEdit,
  onAddSubtask,
  onMoveSubtask,
  onUpdateSubtask,
  onDeleteSubtask,
  onDelete,
}: {
  ticket: TicketRow;
  placement?: "saved" | "now";
  index?: number;
  onMove: (id: string, status: "backlog" | "now") => void;
  onEdit: (id: string, title: string) => Promise<void>;
  onAddSubtask: (id: string, subtask: string) => Promise<void>;
  onMoveSubtask: (id: string, subtask: string, status: "backlog" | "now") => Promise<void>;
  onUpdateSubtask: (id: string, oldSubtask: string, nextSubtask: string, details: string) => Promise<void>;
  onDeleteSubtask: (id: string, subtask: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(ticket.title);
  const [newSubtask, setNewSubtask] = useState("");
  const [busy, setBusy] = useState(false);
  const visibleSubtasks = ticket.subtasks.filter((subtask) => subtaskStatus(ticket, subtask) === "backlog");

  const accent = index % 2 === 0 ? "#8BD4F0" : "#F3E15E";

  const saveTitle = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await onEdit(ticket.id, title.trim());
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const addSubtask = async () => {
    const nextSubtask = titleCaseText(newSubtask);
    if (!nextSubtask) return;
    setBusy(true);
    try {
      await onAddSubtask(ticket.id, nextSubtask);
      setNewSubtask("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article
      className={`saved-ticket-card ${placement === "now" ? "now-ticket-card" : ""}`.trim()}
      draggable={placement === "saved"}
      onDragStart={(event) => event.dataTransfer.setData("text/plain", ticket.id)}
    >
      <div
        className="ticket-title-strip"
        onDoubleClick={() => setEditing(true)}
        style={{
          cursor: "pointer",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          paddingRight: 44,
          background: accent
        }}
      >
        <div className="saved-ticket-header-copy">
          <span style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 16, color: "#16130F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textAlign: "center" }}>
            {ticket.title}
          </span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".08em", color: "#16130F", flexShrink: 0, textAlign: "center" }}>
            {`${ticketDueText(ticket).toUpperCase()} · ${ticketImportanceText(ticket).toUpperCase()}`}
          </span>
        </div>
        <button
          type="button"
          className="saved-ticket-close"
          onClick={() => void onDelete(ticket.id)}
          title="Delete ticket"
          aria-label={`Delete ticket ${ticket.title}`}
          style={{ position: "absolute", right: 0, top: 0, bottom: 0, margin: "auto 0" }}
        >
          ×
        </button>
      </div>
      {editing ? (
        <div className="saved-ticket-edit" style={{ padding: "14px 16px", display: "grid", gap: 8 }}>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void saveTitle();
              if (event.key === "Escape") {
                setTitle(ticket.title);
                setEditing(false);
              }
            }}
            autoFocus
            style={{ width: "100%", border: "1.5px solid #16130F", background: "#ffffff", padding: "6px 7px", fontSize: 13 }}
          />
          <div style={{ display: "flex", gap: 5 }}>
            <button type="button" className="ticket-move-button mono" disabled={busy || !title.trim()} onClick={() => void saveTitle()}>
              Save
            </button>
            <button type="button" className="ticket-move-button mono" disabled={busy} onClick={() => { setTitle(ticket.title); setEditing(false); }}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      <div className="saved-ticket-subtasks" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {visibleSubtasks.length === 0 ? (
          <div style={{ padding: 14, textAlign: "center", fontFamily: "var(--mono)", fontSize: 12, letterSpacing: ".1em", color: "#9a978d", border: "1.5px dashed #cfccc2" }}>
            ALL IN FOCUS ✓
          </div>
        ) : (
          visibleSubtasks.map((subtask) => (
            <SubtaskMiniCard
              key={subtask}
              ticket={ticket}
              subtask={subtask}
              compact={placement === "now"}
              onMoveSubtask={onMoveSubtask}
              onUpdateSubtask={onUpdateSubtask}
              onDeleteSubtask={onDeleteSubtask}
            />
          ))
        )}
        {placement === "saved" && (
          <input
            value={newSubtask}
            onChange={(event) => setNewSubtask(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void addSubtask();
              }
            }}
            placeholder="+ ADD SUBTASK"
            style={{
              width: "100%",
              border: "1.5px dashed #b4b1a7",
              background: "transparent",
              padding: "8px 10px",
              fontFamily: "var(--mono)",
              fontSize: 12,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "#7a776e",
              outline: "none",
              marginTop: 2
            }}
          />
        )}
      </div>
      {placement !== "saved" && (
        <>
          <div className="saved-ticket-add-subtask">
            <input
              value={newSubtask}
              onChange={(event) => setNewSubtask(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void addSubtask();
              }}
              placeholder="Add subtask"
            />
            <button
              type="button"
              className="ticket-move-button mono"
              disabled={busy || !newSubtask.trim()}
              onClick={() => void addSubtask()}
            >
              Add
            </button>
          </div>
          <div className="saved-ticket-footer">
            <MiniPill tone="#ffffff">{ticket.status}</MiniPill>
            <div className="saved-ticket-actions">
              <button
                type="button"
                className="ticket-move-button mono"
                onClick={() => onMove(ticket.id, ticket.status === "now" ? "backlog" : "now")}
              >
                {ticket.status === "now" ? "Backlog" : "To now"}
              </button>
              <button type="button" className="ticket-move-button mono" onClick={() => setEditing(true)}>
                Edit
              </button>
            </div>
          </div>
        </>
      )}
    </article>
  );
}

export function CockpitPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [ticketText, setTicketText] = useState("@Codex build GitHub by tomorrow. Very important. Subtasks: clean profile, pin Dash, write README, add capstone repo.");
  const [selectedAgent, setSelectedAgent] = useState<CockpitAgent | null>(null);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketError, setTicketError] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [serverDraft, setServerDraft] = useState<CockpitTicketDraft | null>(null);
  const data = useDashData(undefined, refreshTrigger, { includeQuotes: false, includeWorkouts: true });

  const localDraft = useMemo(() => parseCockpitTicket(ticketText, selectedAgent), [selectedAgent, ticketText]);
  const draft = useMemo<CockpitTicketDraft>(() => {
    if (!serverDraft) return localDraft;
    return {
      title: serverDraft.title || localDraft.title,
      dueDate: serverDraft.dueDate || localDraft.dueDate,
      dueAt: serverDraft.dueAt || localDraft.dueAt,
      importance: serverDraft.importance || localDraft.importance,
      subtasks: serverDraft.subtasks.length ? serverDraft.subtasks : localDraft.subtasks,
      agent: serverDraft.agent ?? localDraft.agent,
    };
  }, [localDraft, serverDraft]);

  const loadTickets = useCallback(async () => {
    setTicketsLoading(true);
    setTicketError("");
    try {
      const response = await fetch("/api/tickets");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load tickets");
      setTickets((payload.tickets ?? []) as TicketRow[]);
    } catch (error) {
      setTicketError(error instanceof Error ? error.message : "Could not load tickets");
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets, refreshTrigger]);

  useEffect(() => {
    setServerDraft(null);
    if (!ticketText.trim()) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/tickets/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: ticketText, selectedAgent }),
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = await response.json();
        if (!controller.signal.aborted && payload.draft) {
          setServerDraft(payload.draft as CockpitTicketDraft);
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setServerDraft(null);
        }
      }
    }, 650);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [selectedAgent, ticketText]);

  if (!data) return <LoadingPage />;

  const activeTask = data.TASKS.find((task) => !task.done);
  const nowTickets = tickets.filter((ticket) => ticket.status === "now");
  const backlogTickets = tickets.filter((ticket) => ticket.status === "backlog");
  const nowSubtasks = tickets.flatMap((ticket) => (
    ticket.subtasks
      .filter((subtask) => subtaskStatus(ticket, subtask) === "now")
      .map((subtask) => ({ ticket, subtask }))
  ));

  const selectAgent = (agent: CockpitAgent | null) => {
    setSelectedAgent(agent);
    const nextText = ticketText.replace(/@(codex|claude|hermes|open\s*claw|openclaw|open\s*floor)\s*/ig, "").trim();
    setTicketText(agent ? `@${AGENT_LABELS[agent]} ${nextText}`.trim() : nextText);
  };

  const moveTicket = async (id: string, status: "backlog" | "now") => {
    const previous = tickets;
    setTickets((current) => current.map((ticket) => {
      if (status === "now" && ticket.status === "now" && ticket.id !== id) {
        return { ...ticket, status: "backlog", sort_order: 0 };
      }
      return ticket.id === id ? { ...ticket, status, sort_order: status === "now" ? 1 : 0 } : ticket;
    }));
    try {
      const response = await fetch("/api/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, sort_order: status === "now" ? 1 : 0 }),
      });
      if (!response.ok) throw new Error("Could not move ticket");
      void loadTickets();
    } catch {
      setTickets(previous);
    }
  };

  const editTicket = async (id: string, title: string) => {
    const previous = tickets;
    setTickets((current) => current.map((ticket) => ticket.id === id ? { ...ticket, title } : ticket));
    try {
      const response = await fetch("/api/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, title }),
      });
      if (!response.ok) throw new Error("Could not edit ticket");
      void loadTickets();
    } catch {
      setTickets(previous);
      throw new Error("Could not edit ticket");
    }
  };

  const addTicketSubtask = async (id: string, subtask: string) => {
    const previous = tickets;
    const target = tickets.find((ticket) => ticket.id === id);
    if (!target) return;
    const subtasks = [...target.subtasks, subtask];
    setTickets((current) => current.map((ticket) => ticket.id === id ? { ...ticket, subtasks } : ticket));
    try {
      const response = await fetch("/api/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, subtasks }),
      });
      if (!response.ok) throw new Error("Could not add subtask");
      void loadTickets();
    } catch {
      setTickets(previous);
      throw new Error("Could not add subtask");
    }
  };

  const updateTicketSubtaskDetails = async (id: string, subtaskDetails: TicketSubtaskDetails) => {
    const previous = tickets;
    setTickets((current) => current.map((ticket) => ticket.id === id ? { ...ticket, subtask_details: subtaskDetails } : ticket));
    try {
      const response = await fetch("/api/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, subtask_details: subtaskDetails }),
      });
      if (!response.ok) throw new Error("Could not update subtask details");
      void loadTickets();
    } catch {
      setTickets(previous);
      throw new Error("Could not update subtask details");
    }
  };

  const updateTicketSubtasks = async (id: string, subtasks: string[], subtaskDetails: TicketSubtaskDetails) => {
    const previous = tickets;
    setTickets((current) => current.map((ticket) => ticket.id === id ? { ...ticket, subtasks, subtask_details: subtaskDetails } : ticket));
    try {
      const response = await fetch("/api/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, subtasks, subtask_details: subtaskDetails }),
      });
      if (!response.ok) throw new Error("Could not update subtasks");
      void loadTickets();
    } catch {
      setTickets(previous);
      throw new Error("Could not update subtasks");
    }
  };

  const moveTicketSubtask = async (id: string, subtask: string, status: "backlog" | "now") => {
    const target = tickets.find((ticket) => ticket.id === id);
    if (!target || !target.subtasks.includes(subtask)) return;
    const details = ticketSubtaskDetails(target);
    await updateTicketSubtaskDetails(id, {
      ...details,
      [subtask]: { ...details[subtask], status },
    });
  };

  const editTicketSubtask = async (id: string, oldSubtask: string, nextSubtask: string, details: string) => {
    const target = tickets.find((ticket) => ticket.id === id);
    if (!target) return;
    const cleanTitle = titleCaseText(nextSubtask);
    if (!cleanTitle) return;
    const currentDetails = ticketSubtaskDetails(target);
    const renamedDetails = { ...currentDetails };
    const existing = renamedDetails[oldSubtask] ?? {};
    delete renamedDetails[oldSubtask];
    renamedDetails[cleanTitle] = { ...existing, details: details.trim() };
    const subtasks = target.subtasks.map((subtask) => subtask === oldSubtask ? cleanTitle : subtask);
    await updateTicketSubtasks(id, subtasks, renamedDetails);
  };

  const deleteTicketSubtask = async (id: string, subtask: string) => {
    const target = tickets.find((ticket) => ticket.id === id);
    if (!target) return;
    const details = { ...ticketSubtaskDetails(target) };
    delete details[subtask];
    await updateTicketSubtasks(id, target.subtasks.filter((item) => item !== subtask), details);
  };

  const deleteTicket = async (id: string) => {
    const previous = tickets;
    setTickets((current) => current.filter((ticket) => ticket.id !== id));
    try {
      const response = await fetch(`/api/tickets?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Could not delete ticket");
      setRefreshTrigger((current) => current + 1);
      void loadTickets();
    } catch {
      setTickets(previous);
    }
  };

  const persistTicket = async (withAgent: boolean) => {
    if (!ticketText.trim() && !draft.title) return;
    setSaveState("saving");
    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          due_at: draft.dueAt,
          due_label: draft.dueDate,
          importance: draft.importance,
          subtasks: draft.subtasks,
          subtask_details: {},
          agent: withAgent ? draft.agent ?? null : null,
          source_text: ticketText,
        }),
      });
      if (!response.ok) throw new Error("Ticket save failed");
      setRefreshTrigger((current) => current + 1);
      setSaveState("saved");
      void loadTickets();
    } catch {
      setSaveState("error");
    }
  };

  const canSave = Boolean(ticketText.trim() || draft.title);

  return (
    <div className="cockpit-page">
      <PageHeader active="cockpit" data={data} />

      <main className="cockpit-demo-shell">
        <div className="cockpit-demo-grid">
          <CockpitCard eyebrow="↳ NOW · FOCUS 02" tone={COCKPIT_BLUE} className="cockpit-now-card cockpit-primary-card">
            <div className="now-scroll-list">
              {nowSubtasks.map(({ ticket, subtask }) => (
                <NowSubtaskCard
                  key={`${ticket.id}:${subtask}`}
                  ticket={ticket}
                  subtask={subtask}
                  onMoveSubtask={moveTicketSubtask}
                  onDeleteSubtask={deleteTicketSubtask}
                />
              ))}

              <div
                className="now-drop-zone"
                aria-label="Drop ticket or subtask into now"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  const subtaskPayload = event.dataTransfer.getData("application/dash-subtask");
                  if (subtaskPayload) {
                    try {
                      const payload = JSON.parse(subtaskPayload) as { ticketId?: string; subtask?: string };
                      if (payload.ticketId && payload.subtask) void moveTicketSubtask(payload.ticketId, payload.subtask, "now");
                    } catch {
                      // Ignore malformed drag payloads from outside the cockpit.
                    }
                    return;
                  }
                  const id = event.dataTransfer.getData("text/plain");
                  if (id && !id.startsWith("subtask:")) void moveTicket(id, "now");
                }}
              >
                ↓ DRAG A SUBTASK HERE TO FOCUS
              </div>
            </div>
          </CockpitCard>

          <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 960, width: "100%" }}>
            <CockpitCard eyebrow="↳ CREATE TICKET 03" tone={COCKPIT_BLUE} className="cockpit-ticket-card cockpit-primary-card" headerMeta="BRAIN-DUMP · WE PARSE IT">
              <div className="ticket-compose-stack">
                <AgentQuickTags selectedAgent={draft.agent} onSelect={selectAgent} />

                <textarea
                  value={ticketText}
                  onChange={(event) => {
                    setTicketText(event.target.value);
                    setSaveState("idle");
                  }}
                  className="ticket-composer"
                  aria-label="Ticket composer"
                />

                <RequiredFieldChips draft={draft} />

                <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 8 }}>
                  <button
                    type="button"
                    className="cockpit-action-button mono"
                    disabled={!canSave || !draft.agent || saveState === "saving"}
                    onClick={() => void persistTicket(true)}
                  >
                    {saveState === "saving" ? "Saving..." : "Create ticket + start agent"}
                  </button>
                  <button
                    type="button"
                    className="cockpit-action-button secondary mono"
                    disabled={!canSave || saveState === "saving"}
                    onClick={() => void persistTicket(false)}
                  >
                    {saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : "Save ticket only"}
                  </button>
                </div>
              </div>
            </CockpitCard>

            <CockpitCard eyebrow="↳ TICKET BOARD 04" tone={COCKPIT_BLUE} className="saved-tickets-board" headerMeta="⠿ DRAG SUBTASKS → FOCUS RAIL">
              <div className="saved-ticket-header" style={{ display: "none" }}>
                <div>
                  <h1 className="cockpit-card-title">Ticket board</h1>
                </div>
                <MiniPill tone="#ffffff">{ticketsLoading ? "loading" : `${backlogTickets.length} saved`}</MiniPill>
              </div>
              {ticketError ? (
                <div className="saved-ticket-empty">{ticketError}</div>
              ) : backlogTickets.length === 0 ? (
                <div className="saved-ticket-empty">No saved tickets yet.</div>
              ) : (
                <div className="saved-ticket-grid">
                  {backlogTickets.map((ticket, idx) => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      index={idx}
                      onMove={moveTicket}
                      onEdit={editTicket}
                      onAddSubtask={addTicketSubtask}
                      onMoveSubtask={moveTicketSubtask}
                      onUpdateSubtask={editTicketSubtask}
                      onDeleteSubtask={deleteTicketSubtask}
                      onDelete={deleteTicket}
                    />
                  ))}
                </div>
              )}
            </CockpitCard>
          </div>
        </div>
      </main>
    </div>
  );
}
