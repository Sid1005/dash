"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Plus_Jakarta_Sans, IBM_Plex_Mono } from "next/font/google";
import {
  ArrowDown,
  ArrowRight,
  Plus,
  Check,
  Tag,
  Archive,
  Trash2,
  Layers,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  X,
  Play,
  RotateCcw
} from "lucide-react";

// Load fonts locally in this demo page
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-demo-sans",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-demo-mono",
});

// Mock Database Data with dates for testing navigation
const MOCK_DATA = {
  NOW_MIN: 580, // 09:40
  VISION: [
    { title: "✦ Money", text: "Nothing too expensive. Enough to never have to think about cost when it matters." },
    { title: "✦ Work", text: "Exciting work. Excited on a Monday morning." },
    { title: "✦ People", text: "People I admire, grow with, and learn from. A small, tight circle." },
    { title: "✦ Life", text: "Travel. Rich experiences and fine art." },
  ],
  PROBLEMS: [
    { id: "1", text: "Telegram calendar time-blocking ignores Saturday confirmation date clarification", dateIso: "2026-05-28" },
    { id: "2", text: "Dashboard spending changes trigger full-page reloads and reset calendars", dateIso: "2026-05-28" },
    { id: "3", text: "Index font weight feels slightly illegible in light-colored subheadings", dateIso: "2026-05-28" },
    { id: "4", text: "Legacy CSS classes polluting parallel routes in nested Next.js folders", dateIso: "2026-05-27" },
  ],
  BLOCKS: [
    // May 28
    { start: "07:00", end: "08:00", label: "Gym & Fitness Routine", cat: "Health", kind: "blk", dateIso: "2026-05-28" },
    { start: "09:00", end: "10:30", label: "Design System Revamp Implementation", cat: "Deep Work", kind: "blk", current: true, dateIso: "2026-05-28" },
    { start: "11:00", end: "12:00", label: "Sync with Team on Next.js Upgrades", cat: "Meetings", kind: "cal", dateIso: "2026-05-28" },
    { start: "13:00", end: "13:30", label: "High-protein Lunch Log", cat: "Body", kind: "meal", dateIso: "2026-05-28" },
    { start: "14:00", end: "17:00", label: "Code refactoring & unit testing", cat: "Deep Work", kind: "blk", dateIso: "2026-05-28" },
    // May 27
    { start: "08:00", end: "09:00", label: "Morning Standup Meeting", cat: "Meetings", kind: "cal", dateIso: "2026-05-27" },
    { start: "10:00", end: "13:00", label: "Write parsing algorithms for text blocks", cat: "Deep Work", kind: "blk", dateIso: "2026-05-27" },
    { start: "15:00", end: "16:00", label: "Review database transaction locks", cat: "Deep Work", kind: "blk", dateIso: "2026-05-27" },
    // May 29
    { start: "09:00", end: "11:00", label: "Deploy first build to production environment", cat: "Deep Work", kind: "blk", dateIso: "2026-05-29" },
    { start: "14:00", end: "15:00", label: "Weekly retro & demo presentation", cat: "Meetings", kind: "cal", dateIso: "2026-05-29" },
  ],
  TASKS: [
    // May 28
    { id: "t1", title: "Complete design mockup review and gather user feedback", weight: "L", due: "today 12:00", done: false, context: "design", dateIso: "2026-05-28" },
    { id: "t2", title: "Write helper scripts for parsing multi-line Telegram notes", weight: "M", due: "today 18:00", done: false, context: "coding", dateIso: "2026-05-28" },
    { id: "t4", title: "Verify calorie target calculations in Food log page", weight: "S", due: "today 19:00", done: true, context: "fitness", dateIso: "2026-05-28" },
    // May 27
    { id: "t3", title: "Analyze database session locks and audit Postgres RLS policies", weight: "L", due: "yesterday", done: false, context: "ops", dateIso: "2026-05-27" },
    { id: "t5", title: "Set up Vercel CLI deploy script integration", weight: "S", due: "yesterday", done: true, context: "deploy", dateIso: "2026-05-27" },
    // May 29
    { id: "t6", title: "Run final verification and cross-browser visual checks", weight: "M", due: "tomorrow", done: false, context: "design", dateIso: "2026-05-29" },
  ],
  LEARNINGS: [
    // May 28
    { id: "l1", date: "May 28", tag: "Postgres", text: "Explored composite indexes for high-frequency queries containing overlapping date-ranges.", dateIso: "2026-05-28" },
    { id: "l2", date: "May 28", tag: "NextJS", text: "Next.js dynamic routing constraints in parallel folders can cause hydration mismatches when server values diverge.", dateIso: "2026-05-28" },
    // May 27
    { id: "l3", date: "May 27", tag: "Design", text: "High contrast sans-serif letters require generous letter-spacing to feel premium and light.", dateIso: "2026-05-27" },
    // May 29
    { id: "l4", date: "May 29", tag: "Security", text: "Reviewed row-level security (RLS) constraints for multi-tenant isolation schemas.", dateIso: "2026-05-29" }
  ],
  MEALS: [
    // May 28
    { id: "m1", t: "08:30", label: "Oatmeal & Protein Shake", kcal: 540, p: 48, cost: 120, dateIso: "2026-05-28" },
    { id: "m2", t: "13:00", label: "Chicken Rice & Broccoli", kcal: 720, p: 62, cost: 240, dateIso: "2026-05-28" },
    { id: "m3", t: "17:30", label: "Almonds & Banana snack", kcal: 310, p: 8, cost: 80, dateIso: "2026-05-28" },
    // May 27
    { id: "m4", t: "09:00", label: "Eggs & Avocado Toast", kcal: 620, p: 28, cost: 150, dateIso: "2026-05-27" },
    { id: "m5", t: "14:00", label: "Salmon Quinoa Bowl", kcal: 810, p: 54, cost: 350, dateIso: "2026-05-27" },
    // May 29
    { id: "m6", t: "08:00", label: "Greek Yogurt & Granola", kcal: 450, p: 32, cost: 110, dateIso: "2026-05-29" },
  ],
  SPEND: [
    // May 28
    { id: "s1", t: "09:10", label: "Coffee roast beans", cat: "Food", amount: 450, dateIso: "2026-05-28" },
    { id: "s2", t: "11:45", label: "Postgres ebook purchase", cat: "Learning", amount: 1200, dateIso: "2026-05-28" },
    { id: "s3", t: "15:20", label: "Metro rail pass", cat: "Travel", amount: 150, dateIso: "2026-05-28" },
    // May 27
    { id: "s4", t: "10:30", label: "Gym membership renewal", cat: "Health", amount: 2500, dateIso: "2026-05-27" },
    // May 29
    { id: "s5", t: "12:15", label: "Organic grocery haul", cat: "Food", amount: 1800, dateIso: "2026-05-29" },
  ],
  QUOTES: [
    { id: "q1", text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
    { id: "q2", text: "You do not rise to the level of your goals. You fall to the level of your systems.", author: "James Clear" },
    { id: "q3", text: "Make it simple, but significant.", author: "Don Draper" },
    { id: "q4", text: "Focus is a matter of deciding what things you're not going to do.", author: "John Carmack" },
    { id: "q5", text: "Strive not to be a success, but rather to be of value.", author: "Albert Einstein" },
  ],
  ACTIVITIES: [
    // May 28
    { time: "09:10", actor: "user", verb: "logged spend", body: "₹450.00 for Coffee roast beans under Category Food", dateIso: "2026-05-28" },
    { time: "08:30", actor: "telegram", verb: "logged food", body: "Oatmeal & Protein Shake · 540 kcal · 48g Protein", dateIso: "2026-05-28" },
    { time: "07:05", actor: "agent", verb: "synced", body: "Completed morning fitness sync check", dateIso: "2026-05-28" },
    // May 27
    { time: "18:00", actor: "telegram", verb: "logged note", body: "Finished draft of parser architecture", dateIso: "2026-05-27" },
    { time: "10:30", actor: "user", verb: "logged spend", body: "₹2500.00 for Gym membership renewal", dateIso: "2026-05-27" },
    // May 29
    { time: "06:00", actor: "system", verb: "deferred", body: "Deferred 1 uncompleted task to tomorrow", dateIso: "2026-05-29" }
  ],
  WORKOUTS: [
    { id: "w1", dateIso: "2026-05-28", type: "Strength", details: "Bench press (3x8 @ 80kg), Squats (3x5 @ 100kg), Pull-ups (4x10)" },
    { id: "w2", dateIso: "2026-05-27", type: "Cardio", details: "5km morning road run · Duration 24:18 · Avg HR 152 bpm" },
    { id: "w3", dateIso: "2026-05-29", type: "Recovery", details: "Active stretching, yoga, and 20-minute sauna session" },
  ],
  IDEAS: [
    { id: "i1", text: "AI-driven automated calorie parsing from photo attachments in Telegram", category: "AI Tools", archived: false },
    { id: "i2", text: "Personal operating system offline-first database replication to local storage", category: "Infrastructure", archived: false },
    { id: "i3", text: "A widget showing keyboard shortcuts cheat-sheet based on the active tab", category: "General", archived: false },
  ],
  FOCUS: {
    title: "Implement the standalone design revamp dashboard UI route",
  }
};

export default function DemoPage() {
  const [activeTab, setActiveTab] = useState<string>("cockpit");
  const [selectedDate, setSelectedDate] = useState<string>("2026-05-28");
  const [breatheState, setBreatheState] = useState<string>("Inhale (nose)");
  const [currentTime, setCurrentTime] = useState<string>("09:40");
  
  // Tasks list state (interactive completion)
  const [tasksList, setTasksList] = useState(MOCK_DATA.TASKS);
  
  // Scratchpad items (interactive completion)
  const [scratchItems, setScratchItems] = useState([
    { id: "s1", text: "Buy high-protein snacks for the afternoon code session", done: false },
    { id: "s2", text: "Double-check Supabase schema backup locks", done: false },
    { id: "s3", text: "Read Next.js breaking changes document in node_modules", done: true },
  ]);
  const [newScratchText, setNewScratchText] = useState("");
  
  // Problems state (interactive solve)
  const [problemsList, setProblemsList] = useState(MOCK_DATA.PROBLEMS);
  
  // Ideas tab
  const [ideasTab, setIdeasTab] = useState("all_active");
  const [newIdeaText, setNewIdeaText] = useState("");
  const [ideasList, setIdeasList] = useState(MOCK_DATA.IDEAS);

  // Stacked Quotes Deck state
  const [quoteIndex, setQuoteIndex] = useState(0);

  // Month-grid Calendar Dialog display state
  const [showMonthGrid, setShowMonthGrid] = useState(false);

  // Ref for month dialog container for outside click handling
  const calendarDialogRef = useRef<HTMLDivElement>(null);

  // Close month calendar when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (calendarDialogRef.current && !calendarDialogRef.current.contains(event.target as Node)) {
        setShowMonthGrid(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Time ticking simulation
  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      setCurrentTime(`${h}:${m}`);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Breathe animation text sync
  useEffect(() => {
    const interval = setInterval(() => {
      setBreatheState((prev) => {
        if (prev.startsWith("Inhale")) return "Top up (hold)";
        if (prev.startsWith("Top up")) return "Release (mouth)";
        return "Inhale (nose)";
      });
    }, 3333);
    return () => clearInterval(interval);
  }, []);

  // Filtered mock data based on active selectedDate
  const activeTasks = useMemo(() => {
    return tasksList.filter(t => t.dateIso === selectedDate);
  }, [tasksList, selectedDate]);

  const activeBlocks = useMemo(() => {
    return MOCK_DATA.BLOCKS.filter(b => b.dateIso === selectedDate);
  }, [selectedDate]);

  const activeMeals = useMemo(() => {
    return MOCK_DATA.MEALS.filter(m => m.dateIso === selectedDate);
  }, [selectedDate]);

  const activeSpend = useMemo(() => {
    return MOCK_DATA.SPEND.filter(s => s.dateIso === selectedDate);
  }, [selectedDate]);

  const activeActivities = useMemo(() => {
    return MOCK_DATA.ACTIVITIES.filter(a => a.dateIso === selectedDate);
  }, [selectedDate]);

  const activeWorkouts = useMemo(() => {
    return MOCK_DATA.WORKOUTS.filter(w => w.dateIso === selectedDate);
  }, [selectedDate]);

  const activeLearnings = useMemo(() => {
    return MOCK_DATA.LEARNINGS.filter(l => l.dateIso === selectedDate);
  }, [selectedDate]);

  const activeProblems = useMemo(() => {
    return problemsList.filter(p => p.dateIso === selectedDate || !p.dateIso);
  }, [problemsList, selectedDate]);

  // Date utilities
  const formattedSelectedDate = useMemo(() => {
    const d = new Date(`${selectedDate}T12:00:00`);
    return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }, [selectedDate]);

  // Generate 7 days strip around the selectedDate
  const weekStrip = useMemo(() => {
    const centerDate = new Date(`${selectedDate}T12:00:00`);
    const list = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date(centerDate.getTime());
      d.setDate(centerDate.getDate() + i);
      const iso = d.toISOString().split("T")[0];
      const dayNum = d.getDate();
      const dayName = d.toLocaleDateString("en-US", { weekday: "short" }).substring(0, 2).toUpperCase();
      list.push({ iso, dayNum, dayName });
    }
    return list;
  }, [selectedDate]);

  // Simple Month Grid Calculator for May 2026 (Demo fixed)
  const monthDaysGrid = useMemo(() => {
    const list = [];
    // May 2026 starts on Friday (5), 31 days
    // Pad previous month (April: 30 days)
    for (let i = 26; i <= 30; i++) {
      list.push({ dayNum: i, monthOffset: -1, iso: `2026-04-${i}` });
    }
    // May days
    for (let i = 1; i <= 31; i++) {
      const dayStr = String(i).padStart(2, "0");
      list.push({ dayNum: i, monthOffset: 0, iso: `2026-05-${dayStr}` });
    }
    // Pad next month (June)
    const padding = 42 - list.length;
    for (let i = 1; i <= padding; i++) {
      const dayStr = String(i).padStart(2, "0");
      list.push({ dayNum: i, monthOffset: 1, iso: `2026-06-${dayStr}` });
    }
    return list;
  }, []);

  const changeDateByOffset = (offset: number) => {
    const curr = new Date(`${selectedDate}T12:00:00`);
    curr.setDate(curr.getDate() + offset);
    setSelectedDate(curr.toISOString().split("T")[0]);
  };

  // Toggle tasks list
  const handleToggleTask = (id: string) => {
    setTasksList(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const handleSolveProblem = (id: string) => {
    setProblemsList(prev => prev.filter(p => p.id !== id));
  };

  // Add scratch task
  const handleAddScratch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScratchText.trim()) return;
    setScratchItems([
      { id: Math.random().toString(), text: newScratchText.trim(), done: false },
      ...scratchItems
    ]);
    setNewScratchText("");
  };

  // Toggle scratch task
  const handleToggleScratch = (id: string) => {
    setScratchItems(prev => prev.map(item => item.id === id ? { ...item, done: !item.done } : item));
  };

  // Delete scratch task
  const handleDeleteScratch = (id: string) => {
    setScratchItems(prev => prev.filter(item => item.id !== id));
  };

  // Add idea
  const handleAddIdea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIdeaText.trim()) return;
    setIdeasList([
      { id: Math.random().toString(), text: newIdeaText.trim(), category: "General", archived: false },
      ...ideasList
    ]);
    setNewIdeaText("");
  };

  // Cycle Quote Deck
  const handleCycleQuote = () => {
    setQuoteIndex((prev) => (prev + 1) % MOCK_DATA.QUOTES.length);
  };

  return (
    <div
      className={`${plusJakarta.variable} ${ibmPlexMono.variable}`}
      style={{
        height: "100vh",
        background: "#faf9f6", // warm minimal off-white
        color: "#0c0c0e", // rich charcoal
        fontFamily: "var(--font-demo-sans), sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
        boxSizing: "border-box"
      }}
    >
      {/* Global CSS overrides */}
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --sans: var(--font-demo-sans), sans-serif;
          --mono: var(--font-demo-mono), monospace;
        }
        
        .sans-bold {
          font-family: var(--font-demo-sans), sans-serif;
          font-weight: 800;
        }

        .mono {
          font-family: var(--font-demo-mono), monospace;
        }

        .nav-link {
          position: relative;
          text-decoration: none;
          color: #66666a;
          transition: color 0.18s;
        }
        .nav-link:hover {
          color: #0c0c0e;
        }
        .nav-link::after {
          content: '';
          position: absolute;
          width: 100%;
          transform: scaleX(0);
          height: 1.5px;
          bottom: -4px;
          left: 0;
          background-color: #0c0c0e;
          transform-origin: bottom right;
          transition: transform 0.2s ease-out;
        }
        .nav-link:hover::after, .nav-link-active::after {
          transform: scaleX(1);
          transform-origin: bottom left;
        }
        .nav-link-active {
          color: #0c0c0e !important;
          font-weight: 600;
        }

        .grid-card {
          border: 1px solid #0c0c0e;
          background-color: transparent;
          position: relative;
        }

        /* Breathe indicator keyframes */
        @keyframes breathe-pulse {
          0%, 100% { transform: scale(0.68); opacity: 0.35; }
          45% { transform: scale(1.02); opacity: 0.9; }
          55% { transform: scale(1.02); opacity: 0.9; }
        }
        .breathe-indicator {
          animation: breathe-pulse 10s cubic-bezier(.4, 0, .2, 1) infinite;
          transform-origin: center;
        }

        /* Custom minimal scrollbar */
        ::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        ::-webkit-scrollbar-track {
          background: #faf9f6;
        }
        ::-webkit-scrollbar-thumb {
          background: #0c0c0e;
        }

        /* Deck Card Stack animations */
        .deck-card {
          transition: transform 0.3s cubic-bezier(0.19, 1, 0.22, 1), opacity 0.3s ease, z-index 0.3s;
        }
      `}} />

      {/* HEADER SECTION */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 40px",
          borderBottom: "1px solid #e2e2e0",
          backgroundColor: "#faf9f6",
          flexShrink: 0,
          zIndex: 100
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 22,
              height: 22,
              border: "2px solid #0c0c0e",
              display: "grid",
              placeItems: "center",
              fontSize: 12,
              fontWeight: 800,
              fontFamily: "var(--font-demo-mono)"
            }}
          >
            D
          </div>
          <span className="mono" style={{ fontSize: 12, letterSpacing: "0.15em", fontWeight: 600 }}>
            DASH // REVAMP
          </span>
        </div>

        {/* Global Navigation */}
        <nav style={{ display: "flex", gap: 20 }}>
          {[
            { id: "cockpit", label: "cockpit" },
            { id: "scratchpad", label: "scratchpad" },
            { id: "tasks", label: "tasks & learning" },
            { id: "activities", label: "activities" },
            { id: "calendar", label: "calendar" },
            { id: "food", label: "food & spend" },
            { id: "workouts", label: "workouts" },
            { id: "ideas", label: "ideas" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`mono nav-link ${activeTab === item.id ? "nav-link-active" : ""}`}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                fontSize: 11,
                letterSpacing: "0.05em",
                textTransform: "lowercase",
                cursor: "pointer",
                outline: "none",
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Clock & Status */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div className="mono" style={{ fontSize: 16, fontWeight: 500 }}>
            {currentTime}
          </div>
          <div
            className="mono"
            style={{
              fontSize: 9,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "#66666a"
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: 99, background: "#0c0c0e" }} />
            demo-mode
          </div>
        </div>
      </header>

      {/* CORE HERO TITLE */}
      <div style={{ padding: "32px 40px 8px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexShrink: 0 }}>
        <div>
          <div className="mono" style={{ fontSize: 10, color: "#66666a", letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 4 }}>
            * OPERATING SYSTEM // VIEWPORT ENGINE
          </div>
          <div
            className="sans-bold"
            style={{
              fontSize: 54,
              lineHeight: 1.0,
              letterSpacing: "-0.03em",
              textTransform: "uppercase",
              display: "flex",
              alignItems: "baseline",
              gap: 16
            }}
          >
            <span>↓ {activeTab}</span>
          </div>
        </div>

        {/* DYNAMIC DATE NAVIGATOR FOR DETAILS PAGES */}
        {activeTab !== "cockpit" && activeTab !== "ideas" && activeTab !== "scratchpad" && (
          <div style={{ display: "flex", alignItems: "center", gap: 16, position: "relative" }}>
            {/* Week selector strip */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #0c0c0e", padding: "4px 8px", backgroundColor: "#ffffff" }}>
              <button
                onClick={() => changeDateByOffset(-1)}
                style={{ background: "none", border: "none", cursor: "pointer", display: "grid", placeItems: "center", padding: 2 }}
              >
                <ChevronLeft size={14} />
              </button>
              
              {weekStrip.map((day) => {
                const isSelected = day.iso === selectedDate;
                return (
                  <button
                    key={day.iso}
                    onClick={() => setSelectedDate(day.iso)}
                    style={{
                      background: "none",
                      border: isSelected ? "1px solid #0c0c0e" : "1px solid transparent",
                      cursor: "pointer",
                      padding: "2px 6px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      minWidth: 32,
                      fontWeight: isSelected ? "bold" : "normal",
                      color: isSelected ? "#0c0c0e" : "#66666a"
                    }}
                  >
                    <span className="mono" style={{ fontSize: 8 }}>{day.dayName}</span>
                    <span style={{ fontSize: 12 }}>{day.dayNum}</span>
                  </button>
                );
              })}

              <button
                onClick={() => changeDateByOffset(1)}
                style={{ background: "none", border: "none", cursor: "pointer", display: "grid", placeItems: "center", padding: 2 }}
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Calendar icon trigger */}
            <button
              onClick={() => setShowMonthGrid(!showMonthGrid)}
              style={{
                width: 38,
                height: 38,
                border: "1px solid #0c0c0e",
                background: showMonthGrid ? "#0c0c0e" : "#ffffff",
                color: showMonthGrid ? "#faf9f6" : "#0c0c0e",
                cursor: "pointer",
                display: "grid",
                placeItems: "center"
              }}
              title="Select specific date"
            >
              <CalendarIcon size={16} />
            </button>

            {/* Monthly grid calendar dialog dropdown */}
            {showMonthGrid && (
              <div
                ref={calendarDialogRef}
                style={{
                  position: "absolute",
                  top: "46px",
                  right: 0,
                  width: 250,
                  border: "1px solid #0c0c0e",
                  backgroundColor: "#ffffff",
                  padding: 16,
                  boxShadow: "4px 4px 0px #0c0c0e",
                  zIndex: 200
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span className="mono" style={{ fontSize: 11, fontWeight: "bold" }}>MAY 2026</span>
                  <button
                    onClick={() => setShowMonthGrid(false)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    <X size={14} />
                  </button>
                </div>
                
                {/* 7 columns grid header */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, textAlign: "center", marginBottom: 6 }}>
                  {["S", "M", "T", "W", "T", "F", "S"].map((d, idx) => (
                    <span key={idx} className="mono" style={{ fontSize: 8.5, color: "#66666a", fontWeight: "bold" }}>{d}</span>
                  ))}
                </div>

                {/* Days cells */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                  {monthDaysGrid.map((cell, idx) => {
                    const isSelected = cell.iso === selectedDate;
                    const isCurrentMonth = cell.monthOffset === 0;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedDate(cell.iso);
                          setShowMonthGrid(false);
                        }}
                        style={{
                          background: isSelected ? "#0c0c0e" : "none",
                          color: isSelected ? "#ffffff" : isCurrentMonth ? "#0c0c0e" : "#d1d1d4",
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
              </div>
            )}
          </div>
        )}
      </div>

      {/* CORE VIEWPORT CONTENT PANELS */}
      <main
        style={{
          padding: "16px 40px 24px",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#faf9f6"
        }}
      >
        
        {/* COCKPIT VIEW - VIEWPORT LOCKED (NO OVERALL SCROLLING) */}
        {activeTab === "cockpit" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1fr 0.9fr",
              gap: 24,
              height: "100%",
              minHeight: 0,
              overflow: "hidden"
            }}
          >
            
            {/* COLUMN 1: VISION & CHECKS */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20, height: "100%", minHeight: 0 }}>
              
              {/* Vision board (scrollable internally if needed) */}
              <div
                className="grid-card"
                style={{
                  padding: 24,
                  flex: 1.1,
                  minHeight: 0,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <div className="mono" style={{ fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "#66666a" }}>
                  ↳ my vision statement
                </div>
                <div style={{ fontSize: 18, lineHeight: 1.35, letterSpacing: "-0.01em", fontWeight: 400 }}>
                  "Build tools that make one person feel like a team of ten, with absolute styling elegance."
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 4 }}>
                  {MOCK_DATA.VISION.map((v, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span className="mono" style={{ fontSize: 9.5, color: "#0c0c0e", fontWeight: 600 }}>{v.title}</span>
                      <span style={{ fontSize: 12, color: "#66666a", lineHeight: 1.35 }}>{v.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status stack: Focus Task & Up Next */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 0.9, minHeight: 0 }}>
                {/* Active Focus Card */}
                <div
                  className="grid-card"
                  style={{
                    padding: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    flex: 1
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      border: "1px solid #0c0c0e",
                      borderRadius: 999,
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0
                    }}
                  >
                    <ArrowDown size={16} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="mono" style={{ fontSize: 8.5, color: "#66666a", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                      ↳ focus target
                    </div>
                    <div style={{ fontSize: 14.5, fontWeight: 500, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {MOCK_DATA.FOCUS.title}
                    </div>
                    <div className="mono" style={{ fontSize: 9, color: "#66666a", marginTop: 1 }}>
                      weight: <span style={{ fontWeight: 600, color: "#0c0c0e" }}>L</span> · due today 12:00
                    </div>
                  </div>
                </div>

                {/* Up Next Card */}
                <div
                  className="grid-card"
                  style={{
                    padding: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    flex: 1
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      border: "1px solid #0c0c0e",
                      borderRadius: 999,
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0
                    }}
                  >
                    <Layers size={15} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="mono" style={{ fontSize: 8.5, color: "#66666a", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                      ↳ next calendar block
                    </div>
                    <div style={{ fontSize: 14.5, fontWeight: 500, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      Sync with Team on Next.js Upgrades
                    </div>
                    <div className="mono" style={{ fontSize: 9, color: "#66666a", marginTop: 1 }}>
                      time: <span style={{ fontWeight: 600, color: "#0c0c0e" }}>11:00 - 12:00</span> · location: Google Meet
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* COLUMN 2: BREATHE & PROBLEMS */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20, height: "100%", minHeight: 0 }}>
              
              {/* Breathe widget */}
              <div
                className="grid-card"
                style={{
                  padding: 24,
                  flex: 1.1,
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div className="mono" style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase" }}>
                  Breathe & Execute
                </div>
                
                <div style={{ position: "relative", width: 100, height: 100, display: "grid", placeItems: "center", margin: "10px 0" }}>
                  <div
                    className="breathe-indicator"
                    style={{
                      width: 90,
                      height: 90,
                      borderRadius: 999,
                      border: "1.5px solid #0c0c0e",
                      position: "absolute"
                    }}
                  />
                  <div style={{ width: 5, height: 5, borderRadius: 999, background: "#0c0c0e" }} />
                </div>

                <div style={{ textAlign: "center" }}>
                  <div className="mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    {breatheState}
                  </div>
                  <div className="mono" style={{ fontSize: 8.5, color: "#66666a", marginTop: 2 }}>
                    4s Inhale · 2s Hold · 4s Out
                  </div>
                </div>
              </div>

              {/* Open problems (scrollable internally) */}
              <div
                className="grid-card"
                style={{
                  padding: 20,
                  flex: 0.9,
                  minHeight: 0,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span className="mono" style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>
                    ↳ open problem space
                  </span>
                  <span className="mono" style={{ fontSize: 8.5, color: "#66666a" }}>{problemsList.length} items</span>
                </div>
                
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {problemsList.map((p) => (
                    <div key={p.id} style={{ display: "flex", gap: 8, alignItems: "start", fontSize: 13 }}>
                      <span className="mono" style={{ color: "#66666a", userSelect: "none" }}>↳</span>
                      <div style={{ flex: 1, lineHeight: 1.35 }}>{p.text}</div>
                      <button
                        onClick={() => handleSolveProblem(p.id)}
                        className="mono"
                        style={{
                          background: "none",
                          border: "1px solid #0c0c0e",
                          color: "#0c0c0e",
                          fontSize: 8,
                          padding: "1px 4px",
                          cursor: "pointer",
                          transition: "all 0.15s"
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = "#0c0c0e";
                          e.currentTarget.style.color = "#faf9f6";
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = "none";
                          e.currentTarget.style.color = "#0c0c0e";
                        }}
                      >
                        solve
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* COLUMN 3: INTERACTIVE STACKED QUOTES DECK */}
            <div
              className="grid-card"
              style={{
                padding: 24,
                display: "flex",
                flexDirection: "column",
                gap: 16,
                height: "100%",
                minHeight: 0,
                justifyContent: "space-between"
              }}
            >
              <div>
                <div className="mono" style={{ fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "#66666a" }}>
                  ↳ stacked quote deck
                </div>
                <div className="mono" style={{ fontSize: 8, color: "#66666a", marginTop: 4 }}>
                  (Click the stack to cycle cards)
                </div>
              </div>

              {/* Stack container */}
              <div
                onClick={handleCycleQuote}
                style={{
                  position: "relative",
                  width: "100%",
                  height: 220,
                  cursor: "pointer",
                  margin: "20px 0"
                }}
              >
                {MOCK_DATA.QUOTES.map((q, idx) => {
                  const len = MOCK_DATA.QUOTES.length;
                  // Compute positions relative to quoteIndex
                  const relativePos = (idx - quoteIndex + len) % len;
                  
                  // Style configurations for layout offsets
                  let transform = "";
                  let opacity = 0;
                  let zIndex = 0;

                  if (relativePos === 0) {
                    transform = "translate3d(0px, 0px, 0px) scale(1) rotate(0deg)";
                    opacity = 1;
                    zIndex = 10;
                  } else if (relativePos === 1) {
                    transform = "translate3d(8px, 12px, -10px) scale(0.96) rotate(1.5deg)";
                    opacity = 0.8;
                    zIndex = 9;
                  } else if (relativePos === 2) {
                    transform = "translate3d(16px, 24px, -20px) scale(0.92) rotate(-2deg)";
                    opacity = 0.5;
                    zIndex = 8;
                  } else {
                    // hidden cards behind
                    transform = "translate3d(24px, 36px, -30px) scale(0.88) rotate(0deg)";
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
                        right: 20,
                        bottom: 30,
                        border: "1px solid #0c0c0e",
                        backgroundColor: "#ffffff",
                        padding: 20,
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
                          fontSize: 14.5,
                          fontStyle: "italic",
                          lineHeight: 1.4,
                          color: "#0c0c0e",
                          textWrap: "pretty"
                        }}
                      >
                        “{q.text}”
                      </div>
                      
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 12 }}>
                        <span className="mono" style={{ fontSize: 9.5, color: "#66666a" }}>
                          — {q.author}
                        </span>
                        <span className="mono" style={{ fontSize: 8.5, color: "#d1d1d4" }}>
                          {idx + 1}/{len}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom deck actions helper */}
              <button
                onClick={handleCycleQuote}
                className="mono"
                style={{
                  background: "#0c0c0e",
                  color: "#faf9f6",
                  border: "none",
                  padding: "8px 12px",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6
                }}
              >
                <RotateCcw size={11} />
                <span>Next Quote</span>
              </button>
            </div>

          </div>
        )}

        {/* TAB 2: SCRATCHPAD */}
        {activeTab === "scratchpad" && (
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24, height: "100%", minHeight: 0 }}>
            
            {/* Checklist Section */}
            <div style={{ display: "flex", flexDirection: "column", gap: 24, height: "100%", minHeight: 0 }}>
              
              {/* Quick Add Form */}
              <div className="grid-card" style={{ padding: 20, flexShrink: 0 }}>
                <div className="mono" style={{ fontSize: 9, textTransform: "uppercase", color: "#66666a", marginBottom: 10 }}>
                  ↳ quick add task
                </div>
                <form onSubmit={handleAddScratch} style={{ display: "flex", gap: 12 }}>
                  <input
                    type="text"
                    value={newScratchText}
                    onChange={(e) => setNewScratchText(e.target.value)}
                    placeholder="Enter item text..."
                    required
                    style={{
                      flex: 1,
                      background: "none",
                      border: "1px solid #0c0c0e",
                      padding: "8px 12px",
                      fontSize: 13,
                      outline: "none",
                      fontFamily: "var(--font-demo-sans)"
                    }}
                  />
                  <button
                    type="submit"
                    className="mono"
                    style={{
                      background: "#0c0c0e",
                      color: "#faf9f6",
                      border: "none",
                      padding: "0 16px",
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      cursor: "pointer"
                    }}
                  >
                    + Add
                  </button>
                </form>
              </div>

              {/* Tasks Checklist */}
              <div className="grid-card" style={{ padding: 24, flex: 1, minHeight: 0, overflowY: "auto" }}>
                <div className="mono" style={{ fontSize: 9, textTransform: "uppercase", color: "#66666a", marginBottom: 12 }}>
                  ↳ scratch checklist
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {scratchItems.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 0",
                        borderBottom: "1px solid #e2e2e0"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <button
                          onClick={() => handleToggleScratch(item.id)}
                          style={{
                            width: 15,
                            height: 15,
                            border: "1.5px solid #0c0c0e",
                            background: item.done ? "#0c0c0e" : "transparent",
                            cursor: "pointer",
                            display: "grid",
                            placeItems: "center",
                            padding: 0
                          }}
                        >
                          {item.done && <Check size={10} style={{ color: "#faf9f6" }} />}
                        </button>
                        <span style={{
                          fontSize: 13.5,
                          textDecoration: item.done ? "line-through" : "none",
                          color: item.done ? "#66666a" : "#0c0c0e"
                        }}>
                          {item.text}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteScratch(item.id)}
                        className="mono"
                        style={{
                          background: "none",
                          border: "none",
                          color: "#66666a",
                          cursor: "pointer",
                          fontSize: 10.5
                        }}
                        onMouseOver={(e) => e.currentTarget.style.color = "#0c0c0e"}
                        onMouseOut={(e) => e.currentTarget.style.color = "#66666a"}
                      >
                        [delete]
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Sidebar Context */}
            <div className="grid-card" style={{ padding: 24, height: "fit-content" }}>
              <div className="mono" style={{ fontSize: 9, textTransform: "uppercase", color: "#66666a", marginBottom: 12 }}>
                ↳ focus parameters
              </div>
              <div style={{ fontSize: 13.5, lineHeight: 1.45, display: "flex", flexDirection: "column", gap: 12 }}>
                <p>"The scratchpad is local-only storage. Capture fast ideas and cross them out as you execute."</p>
                <div style={{ borderTop: "1px dashed #e2e2e0", paddingTop: 12 }}>
                  <div className="mono" style={{ fontSize: 9, color: "#66666a", marginBottom: 2 }}>pending items</div>
                  <div style={{ fontSize: 20, fontWeight: 500 }}>{scratchItems.filter(i => !i.done).length}</div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 3: TASKS & LEARNING */}
        {activeTab === "tasks" && (
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 24, height: "100%", minHeight: 0 }}>
            
            {/* Left: Tasks List */}
            <div className="grid-card" style={{ padding: 24, height: "100%", minHeight: 0, overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
                <span className="mono" style={{ fontSize: 9, textTransform: "uppercase", color: "#66666a" }}>↳ core todo logs</span>
                <span className="mono" style={{ fontSize: 9, color: "#66666a" }}>
                  {activeTasks.length} tasks scheduled on this day
                </span>
              </div>
              
              <div style={{ display: "flex", flexDirection: "column" }}>
                {activeTasks.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 0",
                      borderBottom: "1px solid #e2e2e0"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                      <button
                        onClick={() => handleToggleTask(t.id)}
                        style={{
                          width: 15,
                          height: 15,
                          border: "1.5px solid #0c0c0e",
                          background: t.done ? "#0c0c0e" : "transparent",
                          cursor: "pointer",
                          display: "grid",
                          placeItems: "center",
                          padding: 0
                        }}
                      >
                        {t.done && <Check size={10} style={{ color: "#faf9f6" }} />}
                      </button>
                      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        <span style={{
                          fontSize: 13.8,
                          textDecoration: t.done ? "line-through" : "none",
                          color: t.done ? "#66666a" : "#0c0c0e",
                          lineHeight: 1.3
                        }}>
                          {t.title}
                        </span>
                        <span className="mono" style={{ fontSize: 9, color: "#66666a" }}>
                          context: {t.context}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span
                        className="mono"
                        style={{
                          fontSize: 8.5,
                          border: "1px solid #0c0c0e",
                          padding: "1px 5px",
                          fontWeight: 600,
                          backgroundColor: t.done ? "#e2e2e0" : "transparent"
                        }}
                      >
                        {t.weight}
                      </span>
                      <span className="mono" style={{ fontSize: 9.5, color: t.done ? "#66666a" : "#0c0c0e", minWidth: 88, textAlign: "right" }}>
                        {t.due}
                      </span>
                    </div>
                  </div>
                ))}
                {activeTasks.length === 0 && (
                  <div className="mono" style={{ fontSize: 11, color: "#66666a", padding: "32px 0", textAlign: "center" }}>
                    No tasks registered for this date.
                  </div>
                )}
              </div>
            </div>

            {/* Right: Learnings log */}
            <div className="grid-card" style={{ padding: 24, height: "100%", minHeight: 0, overflowY: "auto" }}>
              <div className="mono" style={{ fontSize: 9, textTransform: "uppercase", color: "#66666a", marginBottom: 16 }}>
                ↳ learnings on this day
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {activeLearnings.map((l, i) => (
                  <div key={i} style={{ display: "flex", gap: 12 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div className="mono" style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", whiteSpace: "nowrap" }}>
                        {l.date.split(" ")[0]}
                      </div>
                      <div className="mono" style={{ fontSize: 16, fontWeight: 700 }}>
                        {l.date.split(" ")[1]}
                      </div>
                    </div>
                    <div style={{ flex: 1, borderLeft: "1px solid #e2e2e0", paddingLeft: 12 }}>
                      <span className="mono" style={{ fontSize: 8.5, textTransform: "uppercase", background: "#0c0c0e", color: "#faf9f6", padding: "1px 4px" }}>
                        {l.tag}
                      </span>
                      <p style={{ fontSize: 13, lineHeight: 1.4, marginTop: 4, color: "#333336" }}>
                        {l.text}
                      </p>
                    </div>
                  </div>
                ))}
                {activeLearnings.length === 0 && (
                  <div className="mono" style={{ fontSize: 11, color: "#66666a", padding: "32px 0", textAlign: "center" }}>
                    No learnings logged for this date.
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* TAB 4: ACTIVITIES */}
        {activeTab === "activities" && (
          <div className="grid-card" style={{ padding: 24, height: "100%", minHeight: 0, overflowY: "auto" }}>
            <div className="mono" style={{ fontSize: 9, textTransform: "uppercase", color: "#66666a", marginBottom: 16 }}>
              ↳ system activity logs (selected day)
            </div>
            
            <div style={{ display: "flex", flexDirection: "column" }}>
              {activeActivities.map((act, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "80px 100px 1fr",
                    gap: 20,
                    padding: "14px 0",
                    borderTop: i === 0 ? "none" : "1px solid #e2e2e0",
                    alignItems: "baseline"
                  }}
                >
                  <div className="sans-bold" style={{ fontSize: 20, letterSpacing: "-0.02em" }}>
                    {act.time}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{
                      width: 5,
                      height: 5,
                      borderRadius: 999,
                      background: act.actor === "telegram" ? "#0c0c0e" : act.actor === "agent" ? "#66666a" : "#d1d1d4"
                    }} />
                    <span className="mono" style={{ fontSize: 9.5, textTransform: "uppercase", fontWeight: 600 }}>
                      {act.actor}
                    </span>
                  </div>
                  <div>
                    <span className="mono" style={{ fontSize: 9, textTransform: "uppercase", color: "#66666a", marginRight: 6 }}>
                      [{act.verb}]
                    </span>
                    <span style={{ fontSize: 14, color: "#0c0c0e", lineHeight: 1.35 }}>
                      {act.body}
                    </span>
                  </div>
                </div>
              ))}
              {activeActivities.length === 0 && (
                <div className="mono" style={{ fontSize: 11, color: "#66666a", padding: "48px 0", textAlign: "center" }}>
                  No activities recorded on {formattedSelectedDate}.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: CALENDAR */}
        {activeTab === "calendar" && (
          <div className="grid-card" style={{ padding: 24, height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #0c0c0e", paddingBottom: 12, marginBottom: 16, flexShrink: 0 }}>
              <div className="mono" style={{ fontSize: 11, fontWeight: 600 }}>
                {formattedSelectedDate}
              </div>
              <div className="mono" style={{ fontSize: 9.5, color: "#66666a" }}>
                timezone: Asia/Kolkata
              </div>
            </div>

            <div style={{ position: "relative", flex: 1, minHeight: 0, overflowY: "auto", borderLeft: "1px solid #e2e2e0" }}>
              <div style={{ height: 420, position: "relative" }}>
                {/* Hour Lines */}
                {[6, 8, 10, 12, 14, 16, 18, 20, 22].map((hour) => {
                  const topPct = ((hour - 6) / 16) * 100;
                  return (
                    <div
                      key={hour}
                      style={{
                        position: "absolute",
                        top: `${topPct}%`,
                        left: 0,
                        right: 0,
                        borderTop: "1px dashed #e2e2e0",
                        display: "flex",
                        alignItems: "baseline",
                        pointerEvents: "none"
                      }}
                    >
                      <span
                        className="mono"
                        style={{
                          fontSize: 9,
                          color: "#66666a",
                          backgroundColor: "#faf9f6",
                          paddingRight: 6,
                          transform: "translateY(-50%)"
                        }}
                      >
                        {String(hour).padStart(2, "0")}:00
                      </span>
                    </div>
                  );
                })}

                {/* Event Blocks */}
                {activeBlocks.map((block, index) => {
                  const parseToMin = (t: string) => {
                    const [h, m] = t.split(":").map(Number);
                    return h * 60 + m;
                  };
                  const startMin = parseToMin(block.start);
                  const endMin = parseToMin(block.end);
                  
                  const top = ((startMin - 360) / 960) * 100;
                  const height = ((endMin - startMin) / 960) * 100;
                  
                  return (
                    <div
                      key={index}
                      style={{
                        position: "absolute",
                        top: `${top}%`,
                        height: `${height}%`,
                        left: 54,
                        right: 0,
                        border: "1px solid #0c0c0e",
                        backgroundColor: block.current && selectedDate === "2026-05-28" ? "#0c0c0e" : "#ffffff",
                        color: block.current && selectedDate === "2026-05-28" ? "#faf9f6" : "#0c0c0e",
                        padding: "6px 10px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        overflow: "hidden"
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.02em" }}>
                        {block.label}
                      </div>
                      <div className="mono" style={{ fontSize: 9, opacity: 0.8, marginTop: 1 }}>
                        {block.start} - {block.end} · {block.cat}
                      </div>
                    </div>
                  );
                })}

                {/* Current Time Indicator (only on mock center date) */}
                {selectedDate === "2026-05-28" && (
                  <div
                    style={{
                      position: "absolute",
                      top: "23%", // static mock for 09:40
                      left: 0,
                      right: 0,
                      display: "flex",
                      alignItems: "center",
                      pointerEvents: "none"
                    }}
                  >
                    <div style={{ width: 5, height: 5, borderRadius: 99, background: "#ef4444" }} />
                    <div style={{ flex: 1, height: 1, background: "#ef4444" }} />
                    <span className="mono" style={{ fontSize: 8.5, color: "#ef4444", paddingLeft: 4, background: "#faf9f6" }}>
                      09:40
                    </span>
                  </div>
                )}
                
                {activeBlocks.length === 0 && (
                  <div className="mono" style={{ fontSize: 11, color: "#66666a", padding: "64px 0", textAlign: "center" }}>
                    No timeline blocks scheduled for this date.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: FOOD & SPEND */}
        {activeTab === "food" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, height: "100%", minHeight: 0 }}>
            
            {/* Food Ledger */}
            <div className="grid-card" style={{ padding: 24, height: "100%", minHeight: 0, overflowY: "auto" }}>
              <div className="mono" style={{ fontSize: 9, textTransform: "uppercase", color: "#66666a", marginBottom: 12 }}>
                ↳ meal ledger ({selectedDate})
              </div>
              
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #0c0c0e", textAlign: "left" }}>
                    <th className="mono" style={{ fontSize: 9.5, padding: "6px 0", color: "#66666a" }}>TIME</th>
                    <th className="mono" style={{ fontSize: 9.5, padding: "6px 0", color: "#66666a" }}>ITEM</th>
                    <th className="mono" style={{ fontSize: 9.5, padding: "6px 0", color: "#66666a", textAlign: "right" }}>KCAL</th>
                    <th className="mono" style={{ fontSize: 9.5, padding: "6px 0", color: "#66666a", textAlign: "right" }}>PROT</th>
                    <th className="mono" style={{ fontSize: 9.5, padding: "6px 0", color: "#66666a", textAlign: "right" }}>COST</th>
                  </tr>
                </thead>
                <tbody>
                  {activeMeals.map((meal) => (
                    <tr key={meal.id} style={{ borderBottom: "1px solid #e2e2e0" }}>
                      <td className="mono" style={{ padding: "8px 0", fontSize: 10.5 }}>{meal.t}</td>
                      <td style={{ padding: "8px 0" }}>{meal.label}</td>
                      <td className="mono" style={{ padding: "8px 0", textAlign: "right" }}>{meal.kcal}</td>
                      <td className="mono" style={{ padding: "8px 0", textAlign: "right" }}>{meal.p}g</td>
                      <td className="mono" style={{ padding: "8px 0", textAlign: "right" }}>₹{meal.cost}</td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  {activeMeals.length > 0 ? (
                    <tr style={{ fontWeight: 600 }}>
                      <td style={{ padding: "12px 0" }}></td>
                      <td className="mono" style={{ fontSize: 10.5, padding: "12px 0" }}>TOTAL</td>
                      <td className="mono" style={{ padding: "12px 0", textAlign: "right", borderBottom: "3px double #0c0c0e" }}>
                        {activeMeals.reduce((acc, m) => acc + m.kcal, 0)}
                      </td>
                      <td className="mono" style={{ padding: "12px 0", textAlign: "right", borderBottom: "3px double #0c0c0e" }}>
                        {activeMeals.reduce((acc, m) => acc + m.p, 0)}g
                      </td>
                      <td className="mono" style={{ padding: "12px 0", textAlign: "right", borderBottom: "3px double #0c0c0e" }}>
                        ₹{activeMeals.reduce((acc, m) => acc + m.cost, 0)}
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan={5} className="mono" style={{ padding: "32px 0", textAlign: "center", color: "#66666a" }}>
                        No meals logged.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Spending Ledger */}
            <div className="grid-card" style={{ padding: 24, height: "100%", minHeight: 0, overflowY: "auto" }}>
              <div className="mono" style={{ fontSize: 9, textTransform: "uppercase", color: "#66666a", marginBottom: 12 }}>
                ↳ spending ledger ({selectedDate})
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #0c0c0e", textAlign: "left" }}>
                    <th className="mono" style={{ fontSize: 9.5, padding: "6px 0", color: "#66666a" }}>TIME</th>
                    <th className="mono" style={{ fontSize: 9.5, padding: "6px 0", color: "#66666a" }}>ITEM</th>
                    <th className="mono" style={{ fontSize: 9.5, padding: "6px 0", color: "#66666a" }}>CAT</th>
                    <th className="mono" style={{ fontSize: 9.5, padding: "6px 0", color: "#66666a", textAlign: "right" }}>AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSpend.map((spend) => (
                    <tr key={spend.id} style={{ borderBottom: "1px solid #e2e2e0" }}>
                      <td className="mono" style={{ padding: "8px 0", fontSize: 10.5 }}>{spend.t}</td>
                      <td style={{ padding: "8px 0" }}>{spend.label}</td>
                      <td className="mono" style={{ padding: "8px 0", fontSize: 9.5, textTransform: "uppercase" }}>{spend.cat}</td>
                      <td className="mono" style={{ padding: "8px 0", textAlign: "right" }}>₹{spend.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  {activeSpend.length > 0 ? (
                    <tr style={{ fontWeight: 600 }}>
                      <td style={{ padding: "12px 0" }}></td>
                      <td className="mono" style={{ fontSize: 10.5, padding: "12px 0" }}>TOTAL</td>
                      <td style={{ padding: "12px 0" }}></td>
                      <td className="mono" style={{ padding: "12px 0", textAlign: "right", borderBottom: "3px double #0c0c0e" }}>
                        ₹{activeSpend.reduce((acc, s) => acc + s.amount, 0).toFixed(2)}
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan={4} className="mono" style={{ padding: "32px 0", textAlign: "center", color: "#66666a" }}>
                        No spending items logged.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* TAB 7: WORKOUTS */}
        {activeTab === "workouts" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%", minHeight: 0 }}>
            <div className="mono" style={{ fontSize: 9, textTransform: "uppercase", color: "#66666a" }}>
              ↳ logged workout routines on this day
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, overflowY: "auto" }}>
              {activeWorkouts.map((w) => (
                <div
                  key={w.id}
                  className="grid-card"
                  style={{
                    padding: 20,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    height: "fit-content"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span className="mono" style={{ fontSize: 10, fontWeight: 600, background: "#0c0c0e", color: "#faf9f6", padding: "1px 5px" }}>
                      {w.type}
                    </span>
                    <span className="mono" style={{ fontSize: 9.5, color: "#66666a" }}>
                      {w.dateIso}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.45, color: "#0c0c0e", marginTop: 4 }}>
                    {w.details}
                  </div>
                </div>
              ))}
              {activeWorkouts.length === 0 && (
                <div className="mono" style={{ fontSize: 11, color: "#66666a", padding: "48px 0", gridColumn: "1 / -1", textAlign: "center" }}>
                  No workouts logged for {formattedSelectedDate}.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 8: IDEAS */}
        {activeTab === "ideas" && (
          <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 24, height: "100%", minHeight: 0 }}>
            
            {/* Left: Idea Category Tabs */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, borderRight: "1px solid #e2e2e0", paddingRight: 20 }}>
              <div className="mono" style={{ fontSize: 9, textTransform: "uppercase", color: "#66666a", marginBottom: 6 }}>
                ↳ filter categories
              </div>
              {[
                { id: "all_active", label: "all active ideas", count: ideasList.length },
                { id: "AI Tools", label: "→ AI Tools", count: ideasList.filter(i => i.category === "AI Tools").length },
                { id: "Infrastructure", label: "→ Infrastructure", count: ideasList.filter(i => i.category === "Infrastructure").length },
                { id: "General", label: "→ General", count: ideasList.filter(i => i.category === "General").length },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setIdeasTab(item.id)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: "6px 10px",
                    textAlign: "left",
                    cursor: "pointer",
                    fontSize: 11.5,
                    display: "flex",
                    justifyContent: "space-between",
                    backgroundColor: ideasTab === item.id ? "#0c0c0e" : "transparent",
                    color: ideasTab === item.id ? "#faf9f6" : "#66666a",
                    fontWeight: ideasTab === item.id ? 600 : 400
                  }}
                >
                  <span className={item.id === "all_active" ? "mono uc" : ""}>{item.label}</span>
                  <span className="mono" style={{ fontSize: 9 }}>{item.count}</span>
                </button>
              ))}
            </div>

            {/* Right: Ideas listing & add form */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%", minHeight: 0 }}>
              
              {/* Add form */}
              <form onSubmit={handleAddIdea} style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                <input
                  type="text"
                  value={newIdeaText}
                  onChange={(e) => setNewIdeaText(e.target.value)}
                  placeholder="Draft a new product idea, process optimization, or thought..."
                  style={{
                    flex: 1,
                    background: "none",
                    border: "1px solid #0c0c0e",
                    padding: "8px 12px",
                    fontSize: 13,
                    outline: "none"
                  }}
                />
                <button
                  type="submit"
                  className="mono"
                  style={{
                    background: "#0c0c0e",
                    color: "#faf9f6",
                    border: "none",
                    padding: "0 18px",
                    fontSize: 11,
                    textTransform: "uppercase",
                    cursor: "pointer"
                  }}
                >
                  + Add
                </button>
              </form>

              {/* Ideas Display (scrollable internally) */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, minHeight: 0, overflowY: "auto" }}>
                {ideasList
                  .filter((idea) => ideasTab === "all_active" || idea.category === ideasTab)
                  .map((idea) => (
                    <div
                      key={idea.id}
                      className="grid-card"
                      style={{
                        padding: 16,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        flexShrink: 0
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span className="mono" style={{ fontSize: 9, background: "#0c0c0e", color: "#faf9f6", padding: "1px 5px" }}>
                          {idea.category}
                        </span>
                        <div style={{ display: "flex", gap: 8 }}>
                          <span className="mono" style={{ fontSize: 9.5, color: "#66666a", cursor: "pointer" }}>[archive]</span>
                          <span className="mono" style={{ fontSize: 9.5, color: "#ef4444", cursor: "pointer" }}>[delete]</span>
                        </div>
                      </div>
                      <p style={{ fontSize: 13.8, lineHeight: 1.45, color: "#0c0c0e", textTransform: "none" }}>
                        {idea.text}
                      </p>
                    </div>
                  ))}
              </div>
            </div>

          </div>
        )}

      </main>

      {/* FOOTER SECTION */}
      <footer
        style={{
          borderTop: "1px solid #e2e2e0",
          padding: "12px 40px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 10,
          color: "#66666a",
          backgroundColor: "#faf9f6",
          flexShrink: 0
        }}
      >
        <span className="mono">© 2026 DASH PERSONAL OS. NO-SCROLL VIEWPORT ENGINE ACTIVE.</span>
        <span className="mono" style={{ textTransform: "lowercase" }}>
          press navigation links to toggle views
        </span>
      </footer>
    </div>
  );
}
