"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  ArrowDown, 
  Layers, 
  Play, 
  Pause, 
  Plus, 
  Check, 
  Sparkles,
  Info
} from "lucide-react";

// Mock Data matching the Cockpit page
const INITIAL_PROBLEMS = [
  { id: "1", text: "Telegram calendar time-blocking ignores Saturday confirmation date clarification", solved: false },
  { id: "2", text: "Dashboard spending changes trigger full-page reloads and reset calendars", solved: false },
  { id: "3", text: "Index font weight feels slightly illegible in light-colored subheadings", solved: false },
];

const INITIAL_QUOTES = [
  { id: "q1", text: "Build tools that make one person feel like a team of ten, with absolute styling elegance.", author: "Antigravity" },
  { id: "q2", text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { id: "q3", text: "You do not rise to the level of your goals. You fall to the level of your systems.", author: "James Clear" },
  { id: "q4", text: "Make it simple, but significant.", author: "Don Draper" },
  { id: "q5", text: "Focus is a matter of deciding what things you're not going to do.", author: "John Carmack" }
];

const TODAY_BLOCKS = [
  { start: "07:00", end: "08:00", label: "Gym & Fitness Routine", cat: "Health" },
  { start: "09:00", end: "10:30", label: "Design System Revamp Implementation", cat: "Deep Work" },
  { start: "11:00", end: "12:00", label: "Sync with Team on Next.js Upgrades", cat: "Meetings" },
  { start: "13:00", end: "13:30", label: "High-protein Lunch Log", cat: "Body" },
  { start: "14:00", end: "17:00", label: "Code refactoring & unit testing", cat: "Deep Work" }
];

export default function CockpitDemoPage() {
  const [selectedTheme, setSelectedTheme] = useState<"blueprint" | "zine">("zine");
  const [selectedLayout, setSelectedLayout] = useState<"standard" | "collage" | "footnote">("standard");
  
  // Interactive States
  const [problems, setProblems] = useState(INITIAL_PROBLEMS);
  const [newProblem, setNewProblem] = useState("");
  const [quotes, setQuotes] = useState(INITIAL_QUOTES);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [newQuoteText, setNewQuoteText] = useState("");
  const [newQuoteAuthor, setNewQuoteAuthor] = useState("");
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [focusDone, setFocusDone] = useState(false);

  // Breathing Widget States
  const breathePhases = useMemo(() => [
    { name: "Inhale (nose)", duration: 4, color: "#22d3ee" },
    { name: "Top up (hold)", duration: 2, color: "#f59e0b" },
    { name: "Release (mouth)", duration: 4, color: "#ec4899" }
  ], []);

  const [breathePhaseIdx, setBreathePhaseIdx] = useState(0);
  const [breatheTimeLeft, setBreatheTimeLeft] = useState(4);
  const [breatheIsPlaying, setBreatheIsPlaying] = useState(true);

  // Synchronize timer for breathing
  useEffect(() => {
    if (!breatheIsPlaying) return;
    
    const interval = setInterval(() => {
      setBreatheTimeLeft((prev) => {
        if (prev <= 1) {
          const nextIdx = (breathePhaseIdx + 1) % breathePhases.length;
          setBreathePhaseIdx(nextIdx);
          return breathePhases[nextIdx].duration;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [breatheIsPlaying, breathePhaseIdx, breathePhases]);

  // Current phase details
  const currentPhase = breathePhases[breathePhaseIdx];
  const maxDuration = currentPhase.duration;
  const progressRatio = (maxDuration - breatheTimeLeft) / maxDuration;

  // Add Problem Action
  const handleAddProblem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProblem.trim()) return;
    setProblems((prev) => [
      ...prev,
      { id: Date.now().toString(), text: newProblem.trim(), solved: false }
    ]);
    setNewProblem("");
  };

  // Solve Problem Action
  const handleSolveProblem = (id: string) => {
    setProblems((prev) =>
      prev.map((p) => (p.id === id ? { ...p, solved: true } : p))
    );
    setTimeout(() => {
      setProblems((prev) => prev.filter((p) => p.id !== id || !p.solved));
    }, 800);
  };

  // Cycle Quote Action
  const handleCycleQuote = () => {
    setQuoteIndex((prev) => (prev + 1) % quotes.length);
  };

  // Add Quote Action
  const handleAddQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuoteText.trim()) return;
    setQuotes((prev) => [
      { id: Date.now().toString(), text: newQuoteText.trim(), author: newQuoteAuthor.trim() || "Anon" },
      ...prev
    ]);
    setNewQuoteText("");
    setNewQuoteAuthor("");
    setShowQuoteForm(false);
    setQuoteIndex(0);
  };

  // Get active focus task
  const activeFocusTitle = focusDone 
    ? "All primary tasks completed!" 
    : "Implement the standalone design revamp dashboard UI route";

  const renderHeading = (text: string, indexStr: string) => {
    if (selectedLayout === "footnote") {
      // Heading is placed at the bottom, no top heading rendered here
      return null;
    }
    const isBlue = indexStr === "02" || indexStr === "03" || indexStr === "06";
    return (
      <div className={`eyebrow ${isBlue ? "blue" : ""}`}>
        <span>↳ {text}</span>
        <span className="mono index-label">{indexStr}</span>
      </div>
    );
  };

  const renderFootnoteHeading = (text: string, indexStr: string) => {
    if (selectedLayout !== "footnote") return null;
    return (
      <div className="footnote-title mono">
        <span>[{indexStr} // {text.toUpperCase()}]</span>
      </div>
    );
  };

  // 1. VISION CARD
  const renderVisionCard = () => (
    <section className="card card-vision">
      <div className="card-tape" />
      {renderHeading("my vision statement", "01")}
      <h2 className="vision-quote">
        "Build tools that make one person feel like a team of ten, with absolute styling elegance."
      </h2>
      
      <div className="vision-quads">
        <div className="quad-item">
          <div className="quad-title">✦ MONEY</div>
          <p className="quad-text">Nothing too expensive. Enough to never think about cost.</p>
        </div>
        <div className="quad-item">
          <div className="quad-title">✦ WORK</div>
          <p className="quad-text">Exciting work. Excited on a Monday morning.</p>
        </div>
        <div className="quad-item">
          <div className="quad-title">✦ PEOPLE</div>
          <p className="quad-text">People I admire, grow with. A small, tight circle.</p>
        </div>
        <div className="quad-item">
          <div className="quad-title">✦ LIFE</div>
          <p className="quad-text">Travel. Rich experiences, and absolute freedom.</p>
        </div>
      </div>
      {renderFootnoteHeading("vision statement", "01")}
    </section>
  );

  // 2. FOCUS TARGET CARD
  const renderFocusCard = () => (
    <div className="card card-focus" onClick={() => setFocusDone(!focusDone)}>
      <div className="card-tape" />
      <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
        <div className={`focus-icon-circle ${focusDone ? 'done' : ''}`}>
          {focusDone ? <Check size={14} /> : <ArrowDown size={14} />}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          {renderHeading("focus target", "02")}
          <div className={`focus-title ${focusDone ? 'done' : ''}`}>{activeFocusTitle}</div>
          <div className="mono focus-meta">
            weight: <span className="bold-meta">L</span> · due today 12:00
          </div>
        </div>
      </div>
      {renderFootnoteHeading("focus target", "02")}
    </div>
  );

  // 3. TODAY'S SCHEDULE
  const renderScheduleCard = () => (
    <div className="card card-schedule">
      <div className="card-tape" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        {renderHeading("today's schedule", "03")}
        <span className="mono full-view-link">full view →</span>
      </div>

      <div className="timeline-container">
        <div className="timeline-line">
          <div className="timeline-now-dot" style={{ top: "35%" }} />
        </div>

        <div className="timeline-list">
          {TODAY_BLOCKS.map((block, idx) => {
            const isCurrent = idx === 1;
            return (
              <div key={idx} className={`timeline-item ${isCurrent ? 'current' : ''}`}>
                <div className="timeline-time mono">{block.start}</div>
                <div className="timeline-content">
                  <div className="timeline-label">{block.label}</div>
                  <span className="timeline-cat mono">{block.cat}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {renderFootnoteHeading("schedule timeline", "03")}
    </div>
  );

  // 4. BREATHE WIDGET
  const renderBreatheCard = () => (
    <section className="card card-breathe">
      <div className="card-tape" />
      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
          {renderHeading("breathe & execute", "04")}
          <div className="breathe-state mono">{currentPhase.name}</div>
          <div className="mono breathe-meta">
            {breatheTimeLeft}s left · Inhale 4s · Hold 2s · Out 4s
          </div>
        </div>

        <div style={{ position: "relative", width: 60, height: 60, display: "grid", placeItems: "center", flexShrink: 0 }}>
          <div
            className="breathe-indicator"
            style={{
              width: 50,
              height: 50,
              borderRadius: 999,
              border: "1.5px solid var(--line-color)",
              position: "absolute",
              background: "radial-gradient(circle, rgba(0, 0, 0, 0.08) 0%, transparent 70%)"
            }}
          />
          <div style={{ width: 4, height: 4, borderRadius: 999, background: "var(--line-color)" }} />
        </div>
      </div>
      {renderFootnoteHeading("breathing guide", "04")}
    </section>
  );

  // 5. PROBLEM SPACE
  const renderProblemsCard = () => (
    <section className="card card-problems">
      <div className="card-tape" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        {renderHeading("open problem space", "05")}
        <span className="mono problem-count">{problems.length} items</span>
      </div>

      <form onSubmit={handleAddProblem} className="problem-form">
        <input
          type="text"
          placeholder="Log new bottleneck + Hit Enter..."
          value={newProblem}
          onChange={(e) => setNewProblem(e.target.value)}
          className="problem-input"
        />
      </form>

      <div className="problems-list">
        {problems.length === 0 ? (
          <div className="empty-state mono">all problems solved</div>
        ) : (
          problems.map((p) => (
            <div key={p.id} className={`problem-row ${p.solved ? 'solved' : ''}`}>
              <button onClick={() => handleSolveProblem(p.id)} className="solve-checkbox">
                {p.solved && <Check size={10} />}
              </button>
              <div className="problem-text">{p.text}</div>
            </div>
          ))
        )}
      </div>
      {renderFootnoteHeading("open problems list", "05")}
    </section>
  );

  // 6. QUOTES DECK
  const renderQuotesCard = () => (
    <section className="card card-quotes">
      <div className="card-tape" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        {renderHeading("mind space / quotes", "06")}
        <span className="mono quotes-count">{quotes.length} items</span>
      </div>

      {!showQuoteForm ? (
        <>
          <div className="deck-container" onClick={handleCycleQuote}>
            {quotes.map((q, idx) => {
              const len = quotes.length;
              const relativePos = (idx - quoteIndex + len) % len;
              
              let className = "deck-slide hidden";
              if (relativePos === 0) className = "deck-slide active";
              else if (relativePos === 1) className = "deck-slide next-1";
              else if (relativePos === 2) className = "deck-slide next-2";

              return (
                <div key={q.id} className={className}>
                  <div className="quote-text">“{q.text}”</div>
                  <div className="quote-author mono">— {q.author}</div>
                </div>
              );
            })}
          </div>

          <div className="quote-actions">
            <button onClick={handleCycleQuote} className="btn-action primary-btn mono">
              Next Quote
            </button>
            <button onClick={() => setShowQuoteForm(true)} className="btn-action outline-btn mono">
              + Add
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={handleAddQuote} className="quote-form">
          <textarea
            placeholder="Capture transient thought..."
            value={newQuoteText}
            onChange={(e) => setNewQuoteText(e.target.value)}
            required
            rows={3}
            className="form-textarea"
          />
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <input
              type="text"
              placeholder="Author (Optional)"
              value={newQuoteAuthor}
              onChange={(e) => setNewQuoteAuthor(e.target.value)}
              className="form-input-author"
            />
            <button type="submit" className="btn-action primary-btn mono">
              save
            </button>
            <button type="button" onClick={() => setShowQuoteForm(false)} className="btn-action outline-btn mono">
              ✖
            </button>
          </div>
        </form>
      )}
      {renderFootnoteHeading("thoughts & quotes", "06")}
    </section>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      
      {/* STYLE CONFIGURATOR TOOLBAR */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 40px",
        backgroundColor: "#16161a",
        color: "#ffffff",
        borderBottom: "1px solid #2d2d34",
        zIndex: 1000,
        flexShrink: 0
      }}>
        {/* Style Selection */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={14} style={{ color: "#f472b6" }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Theme:</span>
          </div>
          
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setSelectedTheme("zine")}
              style={{
                backgroundColor: selectedTheme === "zine" ? "#ec4899" : "transparent",
                color: selectedTheme === "zine" ? "#ffffff" : "#f472b6",
                border: "1px solid " + (selectedTheme === "zine" ? "#ec4899" : "#831843"),
                borderRadius: "4px",
                padding: "4px 10px",
                fontSize: "10px",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Ink-Splatter Zine
            </button>
            <button
              onClick={() => setSelectedTheme("blueprint")}
              style={{
                backgroundColor: selectedTheme === "blueprint" ? "#ffffff" : "transparent",
                color: selectedTheme === "blueprint" ? "#16161a" : "#e4e4e7",
                border: "1px solid " + (selectedTheme === "blueprint" ? "#ffffff" : "#52525b"),
                borderRadius: "4px",
                padding: "4px 10px",
                fontSize: "10px",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Blueprint B&W
            </button>
          </div>
        </div>

        {/* Layout Selection */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <span style={{ fontSize: 10, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.08em" }}>Layout Experiment:</span>
          
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { id: "standard", label: "A. Standard Columns" },
              { id: "collage", label: "B. Asymmetric Collage (Vertical Titles)" },
              { id: "footnote", label: "C. Split Matrix (Footnote Titles)" }
            ].map((layout) => (
              <button
                key={layout.id}
                onClick={() => setSelectedLayout(layout.id as any)}
                style={{
                  backgroundColor: selectedLayout === layout.id ? "#3b82f6" : "transparent",
                  color: selectedLayout === layout.id ? "#ffffff" : "#60a5fa",
                  border: "1px solid " + (selectedLayout === layout.id ? "#3b82f6" : "#1d4ed8"),
                  borderRadius: "4px",
                  padding: "4px 10px",
                  fontSize: "10px",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                {layout.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* THEME STYLE SHEET INJECTION */}
      <ThemeStyles theme={selectedTheme} layout={selectedLayout} />

      {/* THEME ROOT CONTAINER */}
      <div className={`theme-root layout-${selectedLayout}`} style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        
        {/* HEADER */}
        <header className="theme-header">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div className="logo-box">D</div>
            <span className="mono text-logo">DASH // COCKPIT REVAMP</span>
          </div>

          <nav className="theme-nav">
            <span className="nav-item active">cockpit</span>
            <span className="nav-item">scratchpad</span>
            <span className="nav-item">tasks & learning</span>
            <span className="nav-item">activities</span>
            <span className="nav-item">calendar</span>
            <span className="nav-item">food & spend</span>
            <span className="nav-item">workouts</span>
            <span className="nav-item">ideas</span>
          </nav>

          <div className="header-meta" style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <span className="mono clock">22:04</span>
            <span className="mono status-indicator">SYNCED</span>
          </div>
        </header>

        {/* DYNAMIC CONTENT LAYOUTS */}
        <main className="theme-main">
          
          {/* LAYOUT A: STANDARD COLUMNS */}
          {selectedLayout === "standard" && (
            <div className="grid-container standard-grid">
              <div className="column col-left">
                {renderVisionCard()}
                <div className="sub-stack">
                  {renderFocusCard()}
                  {renderBreatheCard()}
                </div>
              </div>
              <div className="column col-middle">
                {renderScheduleCard()}
                {renderProblemsCard()}
              </div>
              <div className="column col-right">
                {renderQuotesCard()}
              </div>
            </div>
          )}

          {/* LAYOUT B: COLLAGE OFFSET (OVERLAPPING & VERTICAL TITLES) */}
          {selectedLayout === "collage" && (
            <div className="grid-container collage-grid">
              <div className="collage-left-wide">
                {renderVisionCard()}
                <div style={{ display: "flex", gap: 20, marginTop: 20 }}>
                  <div style={{ flex: 1 }}>{renderFocusCard()}</div>
                  <div style={{ flex: 1 }}>{renderBreatheCard()}</div>
                </div>
                <div style={{ marginTop: 20 }}>{renderProblemsCard()}</div>
              </div>
              
              <div className="collage-right-narrow">
                {renderScheduleCard()}
                <div style={{ marginTop: 24 }}>{renderQuotesCard()}</div>
              </div>
            </div>
          )}

          {/* LAYOUT C: FOOTNOTE SPLIT MATRIX (BOTTOM TITLES) */}
          {selectedLayout === "footnote" && (
            <div className="grid-container footnote-grid">
              <div className="footnote-row-top">
                {renderVisionCard()}
                {renderScheduleCard()}
              </div>
              <div className="footnote-row-bottom">
                {renderFocusCard()}
                {renderBreatheCard()}
                {renderProblemsCard()}
                {renderQuotesCard()}
              </div>
            </div>
          )}

        </main>
      </div>

    </div>
  );
}

// THEMED CSS RULE INJECTOR COMPONENT
function ThemeStyles({ theme, layout }: { theme: "blueprint" | "zine"; layout: "standard" | "collage" | "footnote" }) {
  const css = useMemo(() => {
    
    // BASE THEME SETTINGS
    let themeVars = "";
    if (theme === "zine") {
      themeVars = `
        --bg-color: #dfdfd7; /* newsprint */
        --text-color: #000000;
        --line-color: #000000;
        --card-bg: #e4e4df;
        --muted-text: #55554e;
        --accent-highlighter: #fbcfe8; /* pink highlighter */
        
        background-color: var(--bg-color);
        background-image: 
          linear-gradient(rgba(0, 0, 0, 0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 0, 0, 0.04) 1px, transparent 1px);
        background-size: 30px 30px;
        color: var(--text-color);
        transition: all 0.25s ease;
      `;
    } else {
      // BLUEPRINT BLACK AND WHITE
      themeVars = `
        --bg-color: #0c0c0e; /* dark charcoal */
        --text-color: #ffffff;
        --line-color: rgba(255, 255, 255, 0.2);
        --card-bg: #121214;
        --muted-text: #a1a1aa;
        --accent-highlighter: rgba(255, 255, 255, 0.05);

        background-color: var(--bg-color);
        background-image: 
          linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
        background-size: 24px 24px;
        color: var(--text-color);
        transition: all 0.25s ease;
      `;
    }

    // THEME-SPECIFIC CARD STYLING
    let cardStyle = "";
    if (theme === "zine") {
      cardStyle = `
        .card {
          border: 3px solid #000000;
          background-color: var(--card-bg);
          box-shadow: 6px 6px 0px #000000;
          border-radius: 0px;
          padding: 22px;
          display: flex;
          flex-direction: column;
          position: relative;
        }
        .card:hover {
          transform: translate(-2px, -2px);
          box-shadow: 8px 8px 0px #000000;
        }
        .eyebrow {
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          background: #fef08a; /* highlighter yellow */
          align-self: flex-start;
          padding: 1px 6px;
          margin-bottom: 12px;
          border: 1px solid #000;
          display: flex;
          justify-content: space-between;
          width: fit-content;
          gap: 12px;
        }
        .eyebrow.blue {
          background: #7dd3fc; /* blue highlighter */
        }
        /* Ink splat staples */
        .card-tape {
          display: block;
          position: absolute;
          top: -8px;
          right: 20px;
          width: 8px;
          height: 24px;
          border: 2px solid #000000;
          background: #cccccc;
          border-radius: 4px;
          transform: rotate(15deg);
          box-shadow: 1px 1px 2px rgba(0,0,0,0.2);
          pointer-events: none;
          z-index: 100;
        }
        .vision-quote {
          font-size: 17px;
          font-weight: 900;
          text-transform: uppercase;
          border-left: 5px solid #000000;
          padding-left: 10px;
          margin-top: 0;
          letter-spacing: -0.02em;
        }
        .solve-checkbox {
          width: 16px;
          height: 16px;
          border: 2px solid #000000;
          background: none;
          cursor: pointer;
        }
        .problem-form {
          border: 2px solid #000000;
          background: #ffffff;
          padding: 6px 10px;
          margin-bottom: 12px;
        }
        .progress-track {
          fill: none;
          stroke: #000000;
          stroke-width: 4px;
          opacity: 0.15;
        }
        .progress-bar {
          fill: none;
          stroke: #000000;
          stroke-width: 4px;
        }
        .breathe-core {
          width: 24px;
          height: 24px;
          border: 2px solid #000000;
        }
      `;
    } else {
      // BLUEPRINT BLACK AND WHITE CARD STYLING
      cardStyle = `
        .card {
          position: relative;
          background-color: var(--card-bg);
          padding: 24px;
          display: flex;
          flex-direction: column;
          border: none;
        }
        /* Blueprint crossing architectural margins */
        .card::before {
          content: '';
          position: absolute;
          top: 0; left: -14px; right: -14px;
          height: 1px; background-color: rgba(255, 255, 255, 0.4);
        }
        .card::after {
          content: '';
          position: absolute;
          top: -14px; bottom: -14px; left: 0;
          width: 1px; background-color: rgba(255, 255, 255, 0.4);
        }
        .card-tape::before {
          content: '';
          position: absolute;
          bottom: 0; left: -14px; right: -14px;
          height: 1px; background-color: rgba(255, 255, 255, 0.4);
        }
        .card-tape::after {
          content: '';
          position: absolute;
          top: -14px; bottom: -14px; right: 0;
          width: 1px; background-color: rgba(255, 255, 255, 0.4);
        }
        .eyebrow {
          font-size: 9px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #ffffff;
          margin-bottom: 12px;
          font-weight: 700;
          display: flex;
          justify-content: space-between;
          width: 100%;
        }
        .vision-quote {
          font-size: 16px;
          line-height: 1.4;
          font-weight: 300;
          color: #ffffff;
          margin-top: 0;
        }
        .solve-checkbox {
          width: 14px;
          height: 14px;
          border: 1px solid rgba(255, 255, 255, 0.5);
          background: none;
          cursor: pointer;
          color: #ffffff;
        }
        .problem-form {
          border: 1px solid rgba(255, 255, 255, 0.3);
          padding: 6px 10px;
          margin-bottom: 12px;
          background: rgba(255,255,255,0.02);
        }
        .progress-track {
          fill: none;
          stroke: rgba(255, 255, 255, 0.1);
          stroke-width: 2px;
        }
        .progress-bar {
          fill: none;
          stroke-width: 2px;
        }
        .breathe-core {
          width: 20px;
          height: 20px;
        }
      `;
    }

    // LAYOUT-SPECIFIC POSITIONS
    let layoutStyle = "";
    if (layout === "standard") {
      layoutStyle = `
        .theme-main {
          padding: 30px 40px;
          flex: 1;
          display: flex;
          min-height: 0;
          overflow: hidden;
        }
        .grid-container {
          display: grid;
          grid-template-columns: 1.25fr 1fr 0.9fr;
          gap: 28px;
          width: 100%;
          height: 100%;
          min-height: 0;
        }
        .column {
          display: flex;
          flex-direction: column;
          gap: 28px;
          min-height: 0;
        }
        .col-right {
          justify-content: center;
        }
      `;
    } else if (layout === "collage") {
      // LAYOUT B: COLLAGE OFFSET (OVERLAPPING & VERTICAL HEADING MARGINS)
      layoutStyle = `
        .theme-main {
          padding: 30px 40px;
          flex: 1;
          display: flex;
          min-height: 0;
          overflow-y: auto;
        }
        .grid-container.collage-grid {
          display: grid;
          grid-template-columns: 1.6fr 1fr;
          gap: 32px;
          width: 100%;
        }
        /* Rotated Headings placed on left side of cards */
        .collage-grid .card {
          padding-left: 54px !important;
          margin-top: -8px; /* overlapping effect */
          transform: rotate(0.5deg);
        }
        .collage-grid .card:nth-child(even) {
          transform: rotate(-0.5deg);
          margin-left: -12px;
        }
        .collage-grid .eyebrow {
          position: absolute;
          left: 12px;
          top: 36px;
          transform: rotate(-90deg);
          transform-origin: left top;
          white-space: nowrap;
          margin: 0;
          font-size: 8.5px;
          letter-spacing: 0.12em;
        }
        /* Ensure layout handles vertical height well */
        .collage-left-wide {
          display: flex;
          flex-direction: column;
        }
        .collage-right-narrow {
          display: flex;
          flex-direction: column;
        }
      `;
    } else if (layout === "footnote") {
      // LAYOUT C: FOOTNOTE SPLIT MATRIX (TITLES ON BOTTOM)
      layoutStyle = `
        .theme-main {
          padding: 24px 40px;
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow: hidden;
        }
        .grid-container.footnote-grid {
          display: flex;
          flex-direction: column;
          gap: 24px;
          height: 100%;
          min-height: 0;
        }
        .footnote-row-top {
          display: grid;
          grid-template-columns: 1.4fr 1fr;
          gap: 24px;
          height: 52%;
          min-height: 0;
        }
        .footnote-row-bottom {
          display: grid;
          grid-template-columns: 0.8fr 0.9fr 1.1fr 1fr;
          gap: 24px;
          height: 44%;
          min-height: 0;
        }
        /* Footnote Headings at the bottom of the card */
        .footnote-title {
          font-size: 8px;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: var(--muted-text);
          margin-top: 14px;
          border-top: 1px dashed var(--line-color);
          padding-top: 8px;
          display: flex;
          justify-content: space-between;
        }
      `;
    }

    return `
      .theme-root {
        ${themeVars}
      }

      .theme-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 40px;
        border-bottom: 2px solid var(--line-color);
        background-color: var(--bg-color);
        flex-shrink: 0;
      }

      .logo-box {
        font-family: var(--font-label), monospace;
        font-weight: 900;
        font-size: 15px;
        border: 2px solid var(--line-color);
        padding: 1px 6px;
      }

      .text-logo {
        font-size: 11px;
        letter-spacing: 0.15em;
        font-weight: 800;
        text-transform: uppercase;
      }

      .theme-nav {
        display: flex;
        gap: 20px;
      }

      .theme-nav .nav-item {
        font-size: 11px;
        text-transform: lowercase;
        cursor: pointer;
        color: var(--muted-text);
        position: relative;
        padding: 2px 0;
      }

      .theme-nav .nav-item.active {
        color: var(--text-color);
        font-weight: 700;
      }

      .theme-nav .nav-item.active::after {
        content: "";
        position: absolute;
        width: 100%;
        height: 2px;
        background: var(--text-color);
        bottom: -4px;
        left: 0;
      }

      .clock {
        font-size: 15px;
        font-weight: 600;
      }

      .status-indicator {
        font-size: 9px;
        letter-spacing: 0.12em;
        border: 1px solid var(--line-color);
        padding: 2px 6px;
      }

      ${cardStyle}
      ${layoutStyle}

      /* Global Inner styles */
      .vision-quads {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
        margin-top: 12px;
      }
      .quad-item {
        display: flex;
        flex-direction: column;
      }
      .quad-title {
        font-size: 9px;
        font-weight: bold;
        margin-bottom: 2px;
      }
      .quad-text {
        font-size: 11.5px;
        color: var(--muted-text);
        margin: 0;
        line-height: 1.3;
      }

      .sub-stack {
        display: flex;
        flex-direction: column;
        gap: 20px;
        flex: 1;
        min-height: 0;
      }

      .focus-icon-circle {
        width: 32px;
        height: 32px;
        border: 1.5px solid var(--line-color);
        border-radius: 50%;
        display: grid;
        place-items: center;
        flex-shrink: 0;
      }
      .focus-icon-circle.done {
        background: var(--text-color);
        color: var(--bg-color);
      }
      .focus-title {
        font-size: 13px;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .focus-title.done {
        text-decoration: line-through;
        opacity: 0.5;
      }
      .focus-meta {
        font-size: 8.5px;
        color: var(--muted-text);
      }
      .hover-hint {
        font-size: 8.5px;
        color: var(--muted-text);
        opacity: 0;
        transition: opacity 0.2s;
      }
      .card-focus:hover .hover-hint {
        opacity: 0.8;
      }

      .timeline-container {
        position: relative;
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding-left: 14px;
      }
      .timeline-line {
        position: absolute;
        left: 4px;
        top: 4px;
        bottom: 4px;
        width: 1px;
        border-left: 1px dashed var(--line-color);
      }
      .timeline-now-dot {
        position: absolute;
        left: -4px;
        width: 8px;
        height: 8px;
        background-color: var(--text-color);
        border-radius: 50%;
      }
      .timeline-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .timeline-item {
        display: flex;
        gap: 12px;
        font-size: 12px;
      }
      .timeline-item.current {
        font-weight: 700;
        color: var(--text-color);
      }
      .timeline-time {
        font-size: 10px;
        color: var(--muted-text);
        width: 38px;
        flex-shrink: 0;
      }
      .timeline-content {
        flex: 1;
        display: flex;
        justify-content: space-between;
        align-items: baseline;
      }
      .timeline-label {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .timeline-cat {
        font-size: 8px;
        padding: 1px 4px;
        border: 1px solid var(--line-color);
        color: var(--muted-text);
      }

      .breathe-state {
        font-size: 14px;
        font-weight: bold;
        text-transform: uppercase;
      }
      .breathe-meta {
        font-size: 8.5px;
        color: var(--muted-text);
      }
      .breathe-visual {
        width: 54px;
        height: 54px;
        position: relative;
        display: grid;
        place-items: center;
        flex-shrink: 0;
      }
      .progress-svg {
        position: absolute;
        width: 100%;
        height: 100%;
        transform: rotate(-90deg);
      }
      .breathe-core {
        border-radius: 50%;
        transition: transform 1s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .breathe-toggle {
        position: absolute;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--text-color);
        color: var(--bg-color);
        border: none;
        cursor: pointer;
        display: grid;
        place-items: center;
      }

      .problem-form {
        display: flex;
        align-items: center;
        border-radius: 2px;
      }
      .problem-input {
        border: none;
        outline: none;
        font-size: 12px;
        flex: 1;
        background: transparent;
        color: var(--text-color);
        font-family: inherit;
      }
      .problems-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        overflow-y: auto;
        flex: 1;
      }
      .problem-row {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 12px;
        padding: 6px 0;
        border-bottom: 1px dashed var(--line-color);
      }
      .problem-row.solved {
        opacity: 0.3;
        text-decoration: line-through;
      }
      .solve-checkbox {
        display: grid;
        place-items: center;
        padding: 0;
        border-radius: 2px;
      }

      .card-quotes {
        height: auto;
        justify-content: flex-start;
        gap: 16px;
      }
      .deck-container {
        position: relative;
        width: 100%;
        height: 150px;
        margin: 12px 0;
        cursor: pointer;
      }
      .deck-slide {
        position: absolute;
        inset: 0 10px 10px 0;
        border: 1px solid var(--line-color);
        background: var(--card-bg);
        padding: 16px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        transition: all 0.3s cubic-bezier(0.19, 1, 0.22, 1);
      }
      .deck-slide.active {
        transform: translate3d(0, 0, 0) scale(1) rotate(0deg);
        opacity: 1;
        z-index: 10;
        box-shadow: 4px 4px 0px var(--line-color);
      }
      .deck-slide.next-1 {
        transform: translate3d(6px, 8px, 0) scale(0.97) rotate(1.5deg);
        opacity: 0.8;
        z-index: 9;
        box-shadow: 2px 2px 0px var(--line-color);
      }
      .deck-slide.next-2 {
        transform: translate3d(12px, 16px, 0) scale(0.94) rotate(-2deg);
        opacity: 0.4;
        z-index: 8;
      }
      .deck-slide.hidden {
        transform: translate3d(18px, 24px, 0) scale(0.9) rotate(0deg);
        opacity: 0;
        z-index: 1;
      }
      .quote-text {
        font-size: 13.5px;
        font-style: italic;
        line-height: 1.35;
      }
      .quote-author {
        font-size: 9px;
        color: var(--muted-text);
      }
      .quote-actions {
        display: flex;
        gap: 8px;
      }
      .btn-action {
        padding: 6px 12px;
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        cursor: pointer;
        border-radius: 2px;
        font-family: inherit;
      }
      .primary-btn {
        background: var(--text-color);
        color: var(--bg-color);
        border: none;
      }
      .outline-btn {
        background: none;
        border: 1px solid var(--line-color);
        color: var(--text-color);
      }
      .quote-form {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .form-textarea {
        border: 1px solid var(--line-color);
        background: var(--bg-color);
        color: var(--text-color);
        padding: 6px;
        font-size: 12px;
        resize: none;
        outline: none;
        font-family: inherit;
      }
      .form-input-author {
        border: 1px solid var(--line-color);
        background: var(--bg-color);
        color: var(--text-color);
        padding: 6px;
        font-size: 12px;
        outline: none;
        font-family: inherit;
        flex: 1;
      }
    `;
  }, [theme, layout]);

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
