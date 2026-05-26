"use client";

import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, Plus, Check, RotateCcw, Trash2, ChevronDown, ChevronUp } from "lucide-react";

interface ProblemRow {
  id: string;
  text: string;
  solved: boolean;
  created_at: string;
  updated_at: string;
}

export default function LifeWorkEditor({ section }: { section: string }) {
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  // States for interactive problems view
  const [problems, setProblems] = useState<ProblemRow[]>([]);
  const [newProblemText, setNewProblemText] = useState("");
  const [loadingProblems, setLoadingProblems] = useState(false);
  const [showSolved, setShowSolved] = useState(false);

  useEffect(() => {
    if (section === "problems") {
      loadProblems();
    } else {
      fetch(`/api/lifeswork/${section}`)
        .then((r) => r.json())
        .then((d) => setContent(d.content ?? ""))
        .catch(() => setContent(""));
    }
  }, [section]);

  const loadProblems = async () => {
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
  };

  const handleAddProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProblemText.trim()) return;
    const text = newProblemText.trim();
    setNewProblemText("");

    try {
      const res = await fetch("/api/problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
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
      console.error("Failed to toggle solved status:", err);
    }
  };

  const handleDeleteProblem = async (id: string) => {
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

  const save = async () => {
    await fetch(`/api/lifeswork/${section}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setSaved(true);
    setDirty(false);
    setTimeout(() => setSaved(false), 2000);
  };

  if (section === "problems") {
    const activeProblems = problems.filter((p) => !p.solved);
    const solvedProblems = problems.filter((p) => p.solved);

    return (
      <div className="flex flex-col gap-6">
        {/* Add Problem Form */}
        <form onSubmit={handleAddProblem} className="flex gap-2">
          <input
            type="text"
            value={newProblemText}
            onChange={(e) => setNewProblemText(e.target.value)}
            placeholder="What bottleneck or problem are you actively solving?"
            className="flex-1 px-4 py-2.5 text-sm bg-black/40 border border-[var(--line)] rounded-lg focus:outline-none focus:border-[var(--blue)] transition-colors text-white"
            style={{ fontFamily: "var(--font-label)" }}
          />
          <button
            type="submit"
            disabled={!newProblemText.trim()}
            className="px-4 py-2 bg-[var(--blue)] hover:bg-[var(--blue)]/80 text-white rounded-lg flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Plus size={16} />
          </button>
        </form>

        {loadingProblems && problems.length === 0 ? (
          <div className="mono uc text-center text-xs text-[var(--dim)] py-8">
            Loading problems...
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Active Problems Section */}
            <div className="flex flex-col gap-2">
              <div className="mono uc text-[10px] text-[var(--blue)] tracking-widest font-semibold mb-1">
                Active ({activeProblems.length})
              </div>
              <div className="flex flex-col gap-2">
                {activeProblems.length > 0 ? (
                  activeProblems.map((p) => (
                    <div
                      key={p.id}
                      className="group flex items-center justify-between p-3.5 bg-white/[0.02] hover:bg-white/[0.04] border border-[var(--line)] rounded-lg transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <span className="mono text-[var(--blue)] mt-0.5">↳</span>
                        <span className="text-sm text-white font-medium leading-relaxed">
                          {p.text}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleToggleSolved(p.id, p.solved)}
                          className="p-1.5 hover:bg-white/10 rounded text-[var(--blue)] transition-colors cursor-pointer"
                          title="Mark as solved"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteProblem(p.id)}
                          className="p-1.5 hover:bg-rose-500/20 rounded text-[var(--rose)] transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-[var(--dim)] italic py-2">
                    No active problems. Add one above!
                  </div>
                )}
              </div>
            </div>

            {/* Solved Problems Section */}
            {solvedProblems.length > 0 && (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setShowSolved(!showSolved)}
                  className="flex items-center justify-between mono uc text-[10px] text-[var(--dim)] hover:text-white transition-colors tracking-widest font-semibold w-full text-left"
                >
                  <span>Solved ({solvedProblems.length})</span>
                  {showSolved ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                {showSolved && (
                  <div className="flex flex-col gap-2 mt-1">
                    {solvedProblems.map((p) => (
                      <div
                        key={p.id}
                        className="group flex items-center justify-between p-3.5 bg-white/[0.01] hover:bg-white/[0.02] border border-[var(--line)]/50 rounded-lg transition-all"
                      >
                        <div className="flex items-start gap-3 opacity-60">
                          <span className="mono text-[var(--dim)] mt-0.5">✓</span>
                          <span className="text-sm text-[var(--dim)] line-through leading-relaxed">
                            {p.text}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleToggleSolved(p.id, p.solved)}
                            className="p-1.5 hover:bg-white/10 rounded text-[var(--dim)] transition-colors cursor-pointer"
                            title="Reopen problem"
                          >
                            <RotateCcw size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteProblem(p.id)}
                            className="p-1.5 hover:bg-rose-500/20 rounded text-[var(--rose)] transition-colors cursor-pointer"
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
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          setDirty(true);
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "s") {
            e.preventDefault();
            save();
          }
        }}
        placeholder={`Write your ${section} here…`}
        className="dash-input min-h-64 text-sm resize-none"
        style={{
          fontFamily: "var(--font-label)",
        }}
      />
      <div className="flex items-center justify-between">
        <span className="mono text-[10px]" style={{ color: "var(--muted-ink)" }}>
          Cmd S to save
        </span>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="mono text-[10px] flex items-center gap-1" style={{ color: "var(--blue)" }}>
              <CheckCircle size={12} /> Saved to Obsidian
            </span>
          )}
          <button
            onClick={save}
            disabled={!dirty}
            className="dash-action px-3 py-1.5 transition-opacity disabled:opacity-50"
            style={{
              cursor: dirty ? "pointer" : "default",
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
