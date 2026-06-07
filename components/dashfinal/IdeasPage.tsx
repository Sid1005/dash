"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  Archive,
  Plus,
  Search,
  Edit2,
  Tag,
  Lightbulb,
  X,
} from "lucide-react";

interface Idea {
  id: string;
  text: string;
  category: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export function IdeasPage() {
  const data = useDashData(undefined, 0, {
    includeLearnings: false,
    includeTasks: false,
    includeCalendar: false,
    includeProblems: false,
    includeQuotes: false,
  });
  
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [newIdeaText, setNewIdeaText] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Selection states
  const [activeTab, setActiveTab] = useState<string>("all_active"); // "all_active", "archived", or a specific category name
  
  // Editing states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingCategory, setEditingCategory] = useState("");
  const [isEditingCategory, setIsEditingCategory] = useState<string | null>(null); // idea ID when manual category edit is active
  
  // Form focus states
  const [isInputFocused, setIsInputFocused] = useState(false);

  // Load ideas from database
  const loadIdeas = useCallback(async () => {
    try {
      const res = await fetch("/api/ideas?all=true");
      const d = await res.json();
      setIdeas(d.ideas ?? []);
    } catch (e) {
      console.error("Failed to load ideas:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIdeas();
  }, [loadIdeas]);

  // Extract unique active categories from the database
  const activeCategories = useMemo(() => {
    const cats = new Set<string>();
    ideas.forEach((idea) => {
      if (!idea.archived && idea.category) {
        cats.add(idea.category.trim());
      }
    });
    return Array.from(cats).sort();
  }, [ideas]);

  // Handle adding a new idea
  const handleAddIdea = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIdeaText.trim() || isAdding) return;

    setIsAdding(true);
    try {
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newIdeaText.trim() }),
      });
      if (res.ok) {
        setNewIdeaText("");
        await loadIdeas();
      }
    } catch (err) {
      console.error("Failed to add idea:", err);
    } finally {
      setIsAdding(false);
    }
  }, [newIdeaText, isAdding, loadIdeas]);

  // Handle toggling archived state
  const handleToggleArchive = async (id: string, currentlyArchived: boolean) => {
    try {
      const res = await fetch(`/api/ideas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !currentlyArchived }),
      });
      if (res.ok) {
        await loadIdeas();
        // If we archived a category's last active idea, reset active tab
        if (!currentlyArchived && activeTab !== "all_active" && activeTab !== "archived") {
          const updatedIdeas = ideas.map((i) => i.id === id ? { ...i, archived: true } : i);
          const hasRemaining = updatedIdeas.some((i) => !i.archived && i.category === activeTab);
          if (!hasRemaining) {
            setActiveTab("all_active");
          }
        }
      }
    } catch (err) {
      console.error("Failed to archive/unarchive idea:", err);
    }
  };

  // Handle deleting an idea
  const handleDeleteIdea = async (id: string) => {
    if (!confirm("Are you sure you want to delete this idea forever?")) return;
    try {
      const res = await fetch(`/api/ideas/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await loadIdeas();
      }
    } catch (err) {
      console.error("Failed to delete idea:", err);
    }
  };

  // Handle saving inline edits
  const handleSaveEdit = async (id: string) => {
    if (!editingText.trim()) return;
    try {
      const res = await fetch(`/api/ideas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editingText.trim() }),
      });
      if (res.ok) {
        setEditingId(null);
        await loadIdeas();
      }
    } catch (err) {
      console.error("Failed to save idea edit:", err);
    }
  };

  // Handle manual category re-tagging
  const handleSaveCategoryEdit = async (id: string) => {
    const newCat = editingCategory.trim() || "General";
    try {
      const res = await fetch(`/api/ideas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: newCat }),
      });
      if (res.ok) {
        setIsEditingCategory(null);
        await loadIdeas();
      }
    } catch (err) {
      console.error("Failed to update idea category:", err);
    }
  };

  // Start editing idea text
  const startEditing = (idea: Idea) => {
    setEditingId(idea.id);
    setEditingText(idea.text);
  };

  // Start editing category
  const startEditingCategory = (idea: Idea) => {
    setIsEditingCategory(idea.id);
    setEditingCategory(idea.category);
  };

  // Filter ideas based on active tab and search query
  const filteredIdeas = useMemo(() => {
    return ideas.filter((idea) => {
      // 1. Tab filter
      if (activeTab === "all_active") {
        if (idea.archived) return false;
      } else if (activeTab === "archived") {
        if (!idea.archived) return false;
      } else {
        // Specific category
        if (idea.archived || idea.category !== activeTab) return false;
      }

      // 2. Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          idea.text.toLowerCase().includes(query) ||
          idea.category.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [ideas, activeTab, searchQuery]);

  // Counts for sidebar tabs
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all_active: 0,
      archived: 0,
    };
    
    ideas.forEach((idea) => {
      if (idea.archived) {
        counts.archived++;
      } else {
        counts.all_active++;
        counts[idea.category] = (counts[idea.category] || 0) + 1;
      }
    });
    
    return counts;
  }, [ideas]);

  if (!data) return <LoadingPage />;

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
      <PageHeader active="ideas" data={data} />



      <div
        style={{
          display: "grid",
          gridTemplateColumns: "300px minmax(0, 1fr)",
          flex: 1,
          gap: 28,
          padding: "32px",
          minHeight: 0,
        }}
      >
        {/* Left Column: Sidebar with tabs list */}
        <div
          className="grid-card"
          style={{
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
            minHeight: 0,
          }}
        >
          <div className="zine-paperclip" />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="zine-eyebrow blue">
              <span>↳ idea filters</span>
              <span>01</span>
            </div>
            
            {/* Search Input */}
            <div style={{ position: "relative", marginBottom: 12 }}>
              <Search
                size={14}
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--dim)",
                }}
              />
              <input
                type="text"
                placeholder="Search ideas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  background: "var(--bg)",
                  border: "2px solid #000",
                  borderRadius: 0,
                  padding: "8px 12px 8px 32px",
                  fontSize: "12px",
                  color: "var(--text)",
                  outline: "none",
                  fontFamily: "var(--mono)",
                  textTransform: "none",
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--muted)",
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {/* All Active Tab */}
              <button
                type="button"
                onClick={() => setActiveTab("all_active")}
                style={{
                  textAlign: "left",
                  padding: "10px 14px",
                  borderRadius: 0,
                  border: activeTab === "all_active" ? "2px solid #000" : "1px dashed #000",
                  background: activeTab === "all_active" ? "#fef08a" : "transparent",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  color: activeTab === "all_active" ? "var(--text)" : "var(--muted)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span className="mono uc" style={{ fontSize: "11px", fontWeight: activeTab === "all_active" ? 600 : 400 }}>
                  All Active
                </span>
                <span className="mono" style={{ fontSize: "10px", opacity: 0.6 }}>
                  {tabCounts.all_active}
                </span>
              </button>

              {/* Dynamic Categories */}
              {activeCategories.length > 0 && (
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 4 }}>
                  <div className="mono uc" style={{ fontSize: 9, color: "var(--dim)", letterSpacing: "0.15em", paddingLeft: 14, marginBottom: 4 }}>
                    AI Categories
                  </div>
                  {activeCategories.map((cat) => {
                    const isSelected = activeTab === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setActiveTab(cat)}
                        style={{
                          textAlign: "left",
                          padding: "8px 14px",
                          borderRadius: 0,
                          border: isSelected ? "2px solid #000" : "1px dashed #000",
                          background: isSelected ? "#7dd3fc" : "transparent",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                          color: isSelected ? "var(--text)" : "var(--muted)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ fontSize: "12px", textTransform: "none", fontWeight: isSelected ? 500 : 300, display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 4, height: 4, borderRadius: 99, background: isSelected ? "var(--blue)" : "var(--dim)" }} />
                          {cat}
                        </span>
                        <span className="mono" style={{ fontSize: "10px", opacity: 0.6 }}>
                          {tabCounts[cat] ?? 0}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Archived Tab */}
              <button
                type="button"
                onClick={() => setActiveTab("archived")}
                style={{
                  textAlign: "left",
                  padding: "10px 14px",
                  borderRadius: 0,
                  border: activeTab === "archived" ? "2px solid #000" : "1px dashed #000",
                  background: activeTab === "archived" ? "#fef08a" : "transparent",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  color: activeTab === "archived" ? "var(--text)" : "var(--muted)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 14,
                }}
              >
                <span className="mono uc" style={{ fontSize: "11px", fontWeight: activeTab === "archived" ? 600 : 400 }}>
                  Archived
                </span>
                <span className="mono" style={{ fontSize: "10px", opacity: 0.6 }}>
                  {tabCounts.archived}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Active View content */}
        <div
          className="grid-card"
          style={{
            padding: "24px 28px",
            display: "flex",
            flexDirection: "column",
            gap: 24,
            minHeight: 0,
          }}
        >
          <div className="zine-paperclip" />
          {/* Section Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div className="zine-eyebrow blue">
              <span>
                {activeTab === "all_active"
                  ? "↳ active ideas"
                  : activeTab === "archived"
                  ? "↳ archived ideas"
                  : `↳ ${activeTab}`}
              </span>
              <span>02</span>
            </div>
          </div>

          {/* Add Idea Form */}
          {activeTab !== "archived" && (
            <form onSubmit={handleAddIdea} style={{ display: "flex", gap: 10 }}>
              <input
                type="text"
                value={newIdeaText}
                onChange={(e) => setNewIdeaText(e.target.value)}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                disabled={isAdding}
                placeholder={isAdding ? "Classifying idea via AI..." : "Jot down a problem, project concept, or initiative..."}
                style={{
                  flex: 1,
                  background: "var(--bg)",
                  border: isInputFocused ? "2px solid #000" : "2px solid #000",
                  borderRadius: 0,
                  padding: "12px 14px",
                  color: "var(--text)",
                  fontSize: "14px",
                  outline: "none",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                  boxShadow: isInputFocused ? "0 0 0 2px rgba(36, 84, 214, 0.15)" : "none",
                  fontFamily: "var(--sans)",
                  textTransform: "none",
                }}
                required
              />
              <button
                type="submit"
                disabled={!newIdeaText.trim() || isAdding}
                style={{
                  background: !newIdeaText.trim() || isAdding ? "var(--dim)" : "var(--blue)",
                  color: "#fffaf0",
                  border: "2px solid #000",
                  borderRadius: 0,
                  padding: "0 22px",
                  fontSize: "11px",
                  fontFamily: "var(--mono)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  cursor: !newIdeaText.trim() || isAdding ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Plus size={14} />
                <span>{isAdding ? "Tagging..." : "Add"}</span>
              </button>
            </form>
          )}

          {/* Ideas List */}
          {loading ? (
            <div className="mono uc text-center" style={{ fontSize: 11, color: "var(--dim)", padding: "40px 0" }}>
              Loading ideas...
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", minHeight: 0 }}>
              {filteredIdeas.length > 0 ? (
                filteredIdeas.map((idea) => {
                  const isEditing = editingId === idea.id;
                  const isEditingCat = isEditingCategory === idea.id;
                  
                  return (
                    <div
                      key={idea.id}
                      style={{
                        padding: "16px 20px",
                        border: "1px dashed #000",
                        borderRadius: 0,
                        background: "transparent",
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                        transition: "transform 0.15s, box-shadow 0.15s",
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = "translateY(-1px)";
                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(23,20,17,0.03)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      {/* Top row: Category tag & Action buttons */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        {isEditingCat ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <input
                              type="text"
                              value={editingCategory}
                              onChange={(e) => setEditingCategory(e.target.value)}
                              placeholder="Category name"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveCategoryEdit(idea.id);
                                if (e.key === "Escape") setIsEditingCategory(null);
                              }}
                              style={{
                                background: "var(--bg)",
                                border: "1px solid var(--blue)",
                                borderRadius: "4px",
                                padding: "2px 8px",
                                fontSize: "11px",
                                color: "var(--text)",
                                fontFamily: "var(--mono)",
                                outline: "none",
                                textTransform: "none",
                              }}
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveCategoryEdit(idea.id)}
                              style={{ background: "none", border: "none", color: "var(--blue)", cursor: "pointer", display: "grid", placeItems: "center" }}
                            >
                              <Check size={12} />
                            </button>
                            <button
                              onClick={() => setIsEditingCategory(null)}
                              style={{ background: "none", border: "none", color: "var(--rose)", cursor: "pointer", display: "grid", placeItems: "center" }}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditingCategory(idea)}
                            style={{
                              background: "none",
                              border: "none",
                              padding: 0,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              color: "var(--blue)",
                              textAlign: "left",
                            }}
                            title="Click to rename category"
                          >
                            <Tag size={10} />
                            <span
                              className="mono uc"
                              style={{
                                fontSize: "9px",
                                fontWeight: 600,
                                letterSpacing: "0.12em",
                                borderBottom: "1px dashed rgba(36, 84, 214, 0.4)",
                                paddingBottom: 1,
                              }}
                            >
                              {idea.category}
                            </span>
                          </button>
                        )}

                        {/* Action buttons */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {!isEditing && (
                            <button
                              onClick={() => startEditing(idea)}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: "var(--muted)",
                                display: "grid",
                                placeItems: "center",
                                padding: 4,
                                borderRadius: 4,
                                transition: "all 0.15s",
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.background = "rgba(36,84,214,0.06)";
                                e.currentTarget.style.color = "var(--blue)";
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.background = "none";
                                e.currentTarget.style.color = "var(--muted)";
                              }}
                              title="Edit text"
                            >
                              <Edit2 size={13} />
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleArchive(idea.id, idea.archived)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "var(--muted)",
                              display: "grid",
                              placeItems: "center",
                              padding: 4,
                              borderRadius: 4,
                              transition: "all 0.15s",
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.background = "rgba(36,84,214,0.06)";
                              e.currentTarget.style.color = "var(--blue)";
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.background = "none";
                              e.currentTarget.style.color = "var(--muted)";
                            }}
                            title={idea.archived ? "Restore idea" : "Archive idea"}
                          >
                            {idea.archived ? <RotateCcw size={13} /> : <Archive size={13} />}
                          </button>
                          <button
                            onClick={() => handleDeleteIdea(idea.id)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "var(--muted)",
                              display: "grid",
                              placeItems: "center",
                              padding: 4,
                              borderRadius: 4,
                              transition: "all 0.15s",
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.background = "rgba(178,68,68,0.08)";
                              e.currentTarget.style.color = "var(--rose)";
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.background = "none";
                              e.currentTarget.style.color = "var(--muted)";
                            }}
                            title="Delete permanently"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Main text block */}
                      <div style={{ flex: 1 }}>
                        {isEditing ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <textarea
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              onKeyDown={(e) => {
                                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                                  e.preventDefault();
                                  handleSaveEdit(idea.id);
                                }
                                if (e.key === "Escape") setEditingId(null);
                              }}
                              style={{
                                width: "100%",
                                minHeight: "60px",
                                background: "var(--bg)",
                                border: "1px solid var(--blue)",
                                borderRadius: "6px",
                                padding: "10px",
                                color: "var(--text)",
                                fontSize: "14.5px",
                                lineHeight: 1.5,
                                fontFamily: "var(--sans)",
                                outline: "none",
                                resize: "vertical",
                                textTransform: "none",
                              }}
                              autoFocus
                            />
                            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(idea.id)}
                                style={{
                                  padding: "4px 12px",
                                  fontSize: "10px",
                                  fontFamily: "var(--mono)",
                                  textTransform: "uppercase",
                                  background: "var(--blue)",
                                  color: "#fffaf0",
                                  border: "none",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                  fontWeight: 600,
                                }}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                style={{
                                  padding: "4px 12px",
                                  fontSize: "10px",
                                  fontFamily: "var(--mono)",
                                  textTransform: "uppercase",
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
                            onDoubleClick={() => startEditing(idea)}
                            style={{
                              fontSize: "14.5px",
                              lineHeight: 1.55,
                              color: "var(--text)",
                              textTransform: "none",
                              whiteSpace: "pre-wrap",
                              letterSpacing: "0.01em",
                            }}
                            title="Double-click to edit text"
                          >
                            {idea.text}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div
                  className="mono uc text-center"
                  style={{
                    fontSize: 11,
                    color: "var(--dim)",
                    padding: "60px 0",
                    border: "1px dashed var(--line)",
                    borderRadius: "8px",
                  }}
                >
                  {searchQuery ? "No ideas match your search." : "No ideas captured here yet. Add one above!"}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
