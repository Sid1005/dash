"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  PageHeader,
  LoadingPage,
  Eyebrow,
  useDashData,
  BROWN_LINE,
} from "./DashFinal";
import {
  Check,
  RotateCcw,
  Trash2,
  ChevronDown,
  ChevronUp,
  Plus,
} from "lucide-react";

interface ProblemRow {
  id: string;
  text: string;
  solved: boolean;
  created_at: string;
  updated_at: string;
}

const SECTIONS = [
  {
    key: "anti-vision",
    label: "Anti-Vision",
    desc: "Experiences, work, and arguments you never want to repeat. Your positive-fear mechanism.",
  },
  {
    key: "vision",
    label: "Vision",
    desc: "What you want out of life. Filter every decision through this. Iterate often.",
  },
  {
    key: "mission",
    label: "Mission",
    desc: "The bridge between what you want and don't want. Your life's work. The path you're forging.",
  },
  {
    key: "standards",
    label: "Standards",
    desc: "What you're okay with — make the unconscious conscious. Your environment shapes these.",
  },
  {
    key: "problems",
    label: "Problems",
    desc: "Problems you are actively solving. The core hurdles, questions, or bottlenecks currently on your plate.",
  },
  {
    key: "goals",
    label: "Goals",
    desc: "Decade → year → month → week → day. Stubborn with vision, loose with details.",
  },
  {
    key: "projects",
    label: "Projects",
    desc: "How you turn problems into solutions. Each one with milestones, deadlines, research areas.",
  },
  {
    key: "constraints",
    label: "Constraints",
    desc: "What you are NOT willing to sacrifice. The creative challenge: achieve goals without betraying vision.",
  },
  {
    key: "levers",
    label: "Levers",
    desc: "Daily priority tasks that move toward your projects, goals, and vision. The boring fundamentals.",
  },
];

export function LifesWorkPage() {
  const data = useDashData();
  const [active, setActive] = useState("anti-vision");

  // Section editor states
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTextareaFocused, setIsTextareaFocused] = useState(false);

  // Problems section states
  const [problems, setProblems] = useState<ProblemRow[]>([]);
  const [newProblemText, setNewProblemText] = useState("");
  const [loadingProblems, setLoadingProblems] = useState(false);
  const [showSolved, setShowSolved] = useState(false);
  const [isAddFocused, setIsAddFocused] = useState(false);
  const [addButtonHover, setAddButtonHover] = useState(false);

  // Parse initial section from query parameter on client-side mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const sec = params.get("section");
      if (sec && SECTIONS.some((s) => s.key === sec)) {
        setActive(sec);
      }
    }
  }, []);

  // Update query parameter when section changes (without hard reload)
  const handleSectionChange = (key: string) => {
    setActive(key);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("section", key);
      window.history.pushState({}, "", url.toString());
    }
  };

  // Load section content for markdown sections
  useEffect(() => {
    if (active !== "problems") {
      setContent("");
      setDirty(false);
      setSaved(false);
      fetch(`/api/lifeswork/${active}`)
        .then((r) => r.json())
        .then((d) => setContent(d.content ?? ""))
        .catch(() => setContent(""));
    }
  }, [active]);

  // Load problems for the problems section
  const loadProblems = useCallback(async () => {
    setLoadingProblems(true);
    try {
      const res = await fetch("/api/problems?all=true");
      const d = await res.json();
      setProblems(d.problems ?? []);
    } catch (e) {
      console.error("Failed to load problems:", e);
    } finally {
      setLoadingProblems(false);
    }
  }, []);

  useEffect(() => {
    if (active === "problems") {
      loadProblems();
    }
  }, [active, loadProblems]);

  const handleSaveContent = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/lifeswork/${active}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        setSaved(true);
        setDirty(false);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (e) {
      console.error("Failed to save section content:", e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProblemText.trim()) return;
    try {
      const res = await fetch("/api/problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newProblemText.trim() }),
      });
      if (res.ok) {
        setNewProblemText("");
        loadProblems();
      }
    } catch (err) {
      console.error("Failed to add problem:", err);
    }
  };

  const handleToggleSolved = async (id: string, currentlySolved: boolean) => {
    try {
      const res = await fetch(`/api/problems/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solved: !currentlySolved }),
      });
      if (res.ok) {
        loadProblems();
      }
    } catch (err) {
      console.error("Failed to toggle solve status:", err);
    }
  };

  const handleDeleteProblem = async (id: string) => {
    if (!confirm("Are you sure you want to delete this problem?")) return;
    try {
      const res = await fetch(`/api/problems/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        loadProblems();
      }
    } catch (err) {
      console.error("Failed to delete problem:", err);
    }
  };

  if (!data) return <LoadingPage />;

  const sectionDetails = SECTIONS.find((s) => s.key === active) ?? SECTIONS[0];
  const activeProblems = problems.filter((p) => !p.solved);
  const solvedProblems = problems.filter((p) => p.solved);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--text)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--sans)",
      }}
    >
      <PageHeader active="lifeswork" data={data} />

      {/* Hero Header */}
      <div
        style={{
          padding: "38px 40px 30px",
          borderBottom: `1px solid ${BROWN_LINE}`,
          textTransform: "uppercase",
        }}
      >
        <div
          className="mono uc"
          style={{
            fontSize: 11,
            color: "var(--blue)",
            letterSpacing: "0.24em",
            marginBottom: 16,
          }}
        >
          Life&apos;s Work
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "end",
            justifyContent: "space-between",
            gap: 30,
            flexWrap: "wrap",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 46,
              lineHeight: 1,
              fontWeight: 300,
              color: "var(--text)",
              letterSpacing: "0.04em",
            }}
          >
            Purpose & OS
          </h1>
          <div
            className="mono uc"
            style={{
              fontSize: 11,
              color: "var(--muted)",
              letterSpacing: "0.22em",
              textAlign: "right",
            }}
          >
            Aligning purpose, vision, and execution
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "300px 1fr",
          flex: 1,
        }}
      >
        {/* Left Column: Sidebar with tabs list */}
        <div
          style={{
            padding: "34px 24px 48px 40px",
            borderRight: `1px solid ${BROWN_LINE}`,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <Eyebrow label="Sections" color="var(--blue)" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {SECTIONS.map((s) => {
              const isActive = s.key === active;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => handleSectionChange(s.key)}
                  style={{
                    textAlign: "left",
                    padding: "14px 18px",
                    borderRadius: "8px",
                    border: isActive ? "1px solid var(--blue)" : "1px solid transparent",
                    background: isActive
                      ? "linear-gradient(180deg, rgba(36,84,214,0.06), transparent)"
                      : "transparent",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    color: isActive ? "var(--text)" : "var(--muted)",
                  }}
                  onMouseOver={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "rgba(205,187,159,0.1)";
                      e.currentTarget.style.color = "var(--text)";
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "var(--muted)";
                    }
                  }}
                >
                  <div
                    className="mono uc"
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      letterSpacing: "0.14em",
                      color: isActive ? "var(--blue)" : "inherit",
                    }}
                  >
                    {s.label}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      marginTop: "4px",
                      lineHeight: 1.35,
                      opacity: 0.8,
                      textTransform: "none",
                      letterSpacing: "normal",
                    }}
                  >
                    {s.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active View content */}
        <div
          style={{
            padding: "34px 40px 48px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div
              className="mono uc"
              style={{
                fontSize: 14,
                color: "var(--blue)",
                letterSpacing: "0.2em",
                fontWeight: 600,
              }}
            >
              {sectionDetails.label}
            </div>
            {active !== "problems" && (
              <span className="mono" style={{ fontSize: 10.5, color: "var(--dim)" }}>
                OBSIDIAN SYNCED
              </span>
            )}
          </div>

          {active === "problems" ? (
            // PROBLEMS SECTION CONTENT
            <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: "800px" }}>
              {/* Add Problem Form */}
              <form onSubmit={handleAddProblem} style={{ display: "flex", gap: 10 }}>
                <input
                  type="text"
                  value={newProblemText}
                  onChange={(e) => setNewProblemText(e.target.value)}
                  onFocus={() => setIsAddFocused(true)}
                  onBlur={() => setIsAddFocused(false)}
                  placeholder="What bottleneck or problem are you actively solving?"
                  style={{
                    flex: 1,
                    background: "var(--bg)",
                    border: isAddFocused ? "1px solid var(--blue)" : "1px solid var(--line)",
                    borderRadius: "6px",
                    padding: "10px 14px",
                    color: "var(--text)",
                    fontSize: "14px",
                    outline: "none",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                    boxShadow: isAddFocused ? "0 0 0 2px rgba(36, 84, 214, 0.15)" : "none",
                    fontFamily: "var(--mono)",
                    textTransform: "none",
                  }}
                  required
                />
                <button
                  type="submit"
                  disabled={!newProblemText.trim()}
                  onMouseOver={() => setAddButtonHover(true)}
                  onMouseOut={() => setAddButtonHover(false)}
                  style={{
                    background: !newProblemText.trim() ? "var(--dim)" : "var(--blue)",
                    color: "#fffaf0",
                    border: "none",
                    borderRadius: "6px",
                    padding: "10px 18px",
                    fontSize: "11px",
                    fontFamily: "var(--mono)",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    fontWeight: 600,
                    cursor: !newProblemText.trim() ? "not-allowed" : "pointer",
                    transition: "background-color 0.2s, opacity 0.2s, transform 0.1s",
                    opacity: addButtonHover && newProblemText.trim() ? 0.9 : 1,
                    transform: addButtonHover && newProblemText.trim() ? "scale(1.02)" : "scale(1)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Plus size={14} />
                  <span>Add</span>
                </button>
              </form>

              {loadingProblems && problems.length === 0 ? (
                <div className="mono uc text-center" style={{ fontSize: 11, color: "var(--dim)", padding: "40px 0" }}>
                  Loading problems...
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  {/* Active Problems */}
                  <div>
                    <Eyebrow label={`Active Problems (${activeProblems.length})`} color="var(--rose)" />
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {activeProblems.length > 0 ? (
                        activeProblems.map((p) => (
                          <div
                            key={p.id}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr auto",
                              gap: 16,
                              alignItems: "center",
                              padding: "12px 0",
                              borderBottom: "1px dashed var(--line)",
                            }}
                          >
                            <div style={{ display: "flex", gap: 12, alignItems: "start" }}>
                              <span className="mono" style={{ color: "var(--blue)", fontSize: 13, marginTop: 1 }}>↳</span>
                              <span style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.45, textTransform: "none" }}>
                                {p.text}
                              </span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => handleToggleSolved(p.id, p.solved)}
                                style={{
                                  background: "none",
                                  border: "1px solid var(--line-strong)",
                                  borderRadius: 4,
                                  color: "var(--muted)",
                                  width: 26,
                                  height: 26,
                                  display: "grid",
                                  placeItems: "center",
                                  cursor: "pointer",
                                  transition: "all 0.15s",
                                }}
                                onMouseOver={(e) => {
                                  e.currentTarget.style.background = "var(--blue)";
                                  e.currentTarget.style.color = "#fff";
                                  e.currentTarget.style.borderColor = "var(--blue)";
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.style.background = "none";
                                  e.currentTarget.style.color = "var(--muted)";
                                  e.currentTarget.style.borderColor = "var(--line-strong)";
                                }}
                                title="Mark solved"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteProblem(p.id)}
                                style={{
                                  background: "none",
                                  border: "1px solid var(--line-strong)",
                                  borderRadius: 4,
                                  color: "var(--muted)",
                                  width: 26,
                                  height: 26,
                                  display: "grid",
                                  placeItems: "center",
                                  cursor: "pointer",
                                  transition: "all 0.15s",
                                }}
                                onMouseOver={(e) => {
                                  e.currentTarget.style.background = "var(--rose)";
                                  e.currentTarget.style.color = "#fff";
                                  e.currentTarget.style.borderColor = "var(--rose)";
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.style.background = "none";
                                  e.currentTarget.style.color = "var(--muted)";
                                  e.currentTarget.style.borderColor = "var(--line-strong)";
                                }}
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="mono uc" style={{ fontSize: 11, color: "var(--dim)", padding: "16px 0" }}>
                          No active bottlenecks. All clear!
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Solved Problems */}
                  {solvedProblems.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setShowSolved(!showSolved)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          width: "100%",
                          textAlign: "left",
                          padding: "8px 0",
                          borderBottom: `1px solid ${BROWN_LINE}`,
                        }}
                      >
                        <span className="mono uc" style={{ fontSize: 11, color: "var(--dim)", letterSpacing: "0.15em", fontWeight: 600 }}>
                          Solved Problems ({solvedProblems.length})
                        </span>
                        <span style={{ color: "var(--dim)" }}>
                          {showSolved ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </span>
                      </button>
                      {showSolved && (
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          {solvedProblems.map((p) => (
                            <div
                              key={p.id}
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr auto",
                                gap: 16,
                                alignItems: "center",
                                padding: "10px 0",
                                borderBottom: "1px dashed var(--line)",
                                opacity: 0.6,
                              }}
                            >
                              <div style={{ display: "flex", gap: 12, alignItems: "start" }}>
                                <span className="mono" style={{ color: "var(--dim)", fontSize: 13, marginTop: 1 }}>✓</span>
                                <span style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.45, textDecoration: "line-through", textTransform: "none" }}>
                                  {p.text}
                                </span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <button
                                  type="button"
                                  onClick={() => handleToggleSolved(p.id, p.solved)}
                                  style={{
                                    background: "none",
                                    border: "1px solid var(--line-strong)",
                                    borderRadius: 4,
                                    color: "var(--muted)",
                                    width: 26,
                                    height: 26,
                                    display: "grid",
                                    placeItems: "center",
                                    cursor: "pointer",
                                    transition: "all 0.15s",
                                  }}
                                  onMouseOver={(e) => {
                                    e.currentTarget.style.background = "var(--blue)";
                                    e.currentTarget.style.color = "#fff";
                                    e.currentTarget.style.borderColor = "var(--blue)";
                                  }}
                                  onMouseOut={(e) => {
                                    e.currentTarget.style.background = "none";
                                    e.currentTarget.style.color = "var(--muted)";
                                    e.currentTarget.style.borderColor = "var(--line-strong)";
                                  }}
                                  title="Reopen problem"
                                >
                                  <RotateCcw size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteProblem(p.id)}
                                  style={{
                                    background: "none",
                                    border: "1px solid var(--line-strong)",
                                    borderRadius: 4,
                                    color: "var(--muted)",
                                    width: 26,
                                    height: 26,
                                    display: "grid",
                                    placeItems: "center",
                                    cursor: "pointer",
                                    transition: "all 0.15s",
                                  }}
                                  onMouseOver={(e) => {
                                    e.currentTarget.style.background = "var(--rose)";
                                    e.currentTarget.style.color = "#fff";
                                    e.currentTarget.style.borderColor = "var(--rose)";
                                  }}
                                  onMouseOut={(e) => {
                                    e.currentTarget.style.background = "none";
                                    e.currentTarget.style.color = "var(--muted)";
                                    e.currentTarget.style.borderColor = "var(--line-strong)";
                                  }}
                                  title="Delete"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            // OTHER MARKDOWN SECTIONS (Obsidian File Editor)
            <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1, maxWidth: "900px" }}>
              <textarea
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setDirty(true);
                }}
                onFocus={() => setIsTextareaFocused(true)}
                onBlur={() => setIsTextareaFocused(false)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                    e.preventDefault();
                    handleSaveContent();
                  }
                }}
                placeholder={`Write your ${sectionDetails.label} content here...`}
                style={{
                  width: "100%",
                  flex: 1,
                  minHeight: "420px",
                  padding: "20px",
                  background: "var(--bg)",
                  border: isTextareaFocused ? "1px solid var(--blue)" : "1px solid var(--line)",
                  borderRadius: "8px",
                  color: "var(--text)",
                  fontSize: "16.5px",
                  lineHeight: 1.6,
                  fontFamily: "var(--sans)",
                  textTransform: "none",
                  outline: "none",
                  resize: "vertical",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                  boxShadow: isTextareaFocused ? "0 0 0 2px rgba(36, 84, 214, 0.15)" : "none",
                }}
              />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="mono" style={{ fontSize: "10.5px", color: "var(--muted)", letterSpacing: "0.06em" }}>
                  Cmd + S to save
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {saved && (
                    <span className="mono" style={{ fontSize: "11px", color: "var(--blue)", display: "flex", alignItems: "center", gap: 4 }}>
                      ✓ Saved to Obsidian
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveContent}
                    disabled={!dirty || isSaving}
                    style={{
                      padding: "8px 20px",
                      fontSize: "11px",
                      fontFamily: "var(--mono)",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      background: !dirty || isSaving ? "var(--dim)" : "var(--blue)",
                      color: "#fffaf0",
                      border: "none",
                      borderRadius: "6px",
                      cursor: !dirty || isSaving ? "not-allowed" : "pointer",
                      transition: "background-color 0.2s, opacity 0.2s",
                    }}
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
