"use client";

import React, { useState, useEffect, useRef } from "react";
import { PageHeader, LoadingPage, useDashData } from "./DashFinal";
import { Check, Plus, Trash2, Pencil } from "lucide-react";

interface ScratchItem {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
  parentId?: string | null; // null/undefined for card topic, card.id for subtask
}

export function ScratchpadPage() {
  const data = useDashData(undefined, 0, {
    includeLearnings: false,
    includeTasks: false,
    includeCalendar: false,
    includeProblems: false,
    includeQuotes: false,
  });

  const [items, setItems] = useState<ScratchItem[]>([]);
  const [newCardTitle, setNewCardTitle] = useState("");

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // Load from localStorage
  useEffect(() => {
    try {
      const savedItems = localStorage.getItem("dash_scratchpad_items");
      if (savedItems) {
        const loaded = JSON.parse(savedItems);
        // If the loaded items are not in index card parent/child layout structure,
        // or if it's empty, we seed the cards data
        const hasCards = loaded.some((i: ScratchItem) => i.parentId === null);
        if (loaded.length === 0 || !hasCards) {
          seedDefaultCards();
        } else {
          setItems(loaded);
        }
      } else {
        seedDefaultCards();
      }
    } catch (e) {
      console.error("Failed to load scratchpad items from localStorage:", e);
    }
  }, []);

  const saveItems = (newItems: ScratchItem[]) => {
    setItems(newItems);
    try {
      localStorage.setItem("dash_scratchpad_items", JSON.stringify(newItems));
    } catch (e) {
      console.error("Failed to save scratchpad items to localStorage:", e);
    }
  };

  const seedDefaultCards = () => {
    const now = Date.now();
    const defaultSeed: ScratchItem[] = [
      { id: "c1", text: "💡 App Ideas & Brainstorms", done: false, createdAt: now - 3600000 * 4, parentId: null },
      { id: "c1_1", text: "Brutalist dashboard layout for productivity", done: false, createdAt: now - 3600000 * 3.8, parentId: "c1" },
      { id: "c1_2", text: "Websocket synced breathing exercise widget", done: true, createdAt: now - 3600000 * 3.7, parentId: "c1" },

      { id: "c2", text: "🏋️ Daily Workouts", done: false, createdAt: now - 3600000 * 3, parentId: null },
      { id: "c2_1", text: "5k outdoor trail run (morning)", done: false, createdAt: now - 3600000 * 2.8, parentId: "c2" },
      { id: "c2_2", text: "15-minute core strength routine", done: false, createdAt: now - 3600000 * 2.5, parentId: "c2" },

      { id: "c3", text: "🧹 Home Chores", done: false, createdAt: now - 3600000 * 2, parentId: null },
      { id: "c3_1", text: "Water the indoor fiddle-leaf figs", done: true, createdAt: now - 3600000 * 1.8, parentId: "c3" },
      { id: "c3_2", text: "Organize the bookshelf by topic", done: false, createdAt: now - 3600000 * 1.5, parentId: "c3" }
    ];
    saveItems(defaultSeed);
  };

  const handleToggleItem = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    const newDone = !item.done;

    // If we clicked a card header (parent card topic)
    if (item.parentId === null || !item.parentId) {
      const updated = items.map((i) => {
        if (i.id === id) return { ...i, done: newDone };
        if (i.parentId === id) return { ...i, done: newDone };
        return i;
      });
      saveItems(updated);
    } else {
      // If we clicked a subtask child
      const updated = items.map((i) => (i.id === id ? { ...i, done: newDone } : i));

      // Auto-complete parent card if all its subtasks are done
      const parentId = item.parentId;
      const subtasks = updated.filter((i) => i.parentId === parentId);
      const allDone = subtasks.length > 0 && subtasks.every((i) => i.done);

      const nextUpdated = updated.map((i) => {
        if (i.id === parentId) return { ...i, done: allDone };
        return i;
      });
      saveItems(nextUpdated);
    }
  };

  const isParentPartiallyDone = (parentId: string) => {
    const children = items.filter((i) => i.parentId === parentId);
    if (children.length === 0) return false;
    const doneCount = children.filter((i) => i.done).length;
    return doneCount > 0 && doneCount < children.length;
  };

  const handleDeleteItem = (id: string) => {
    // Delete item, and delete subtasks as well if this was a card
    const updated = items.filter((item) => item.id !== id && item.parentId !== id);
    saveItems(updated);
  };

  const handleStartEdit = (item: ScratchItem) => {
    setEditingId(item.id);
    setEditingText(item.text);
    setTimeout(() => {
      editInputRef.current?.focus();
    }, 50);
  };

  const handleSaveEdit = (id: string) => {
    if (!editingText.trim()) return;
    const updated = items.map((item) =>
      item.id === id ? { ...item, text: editingText.trim() } : item
    );
    saveItems(updated);
    setEditingId(null);
  };

  const handleCreateCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardTitle.trim()) return;

    const newCard: ScratchItem = {
      id: Math.random().toString(36).substring(2, 9),
      text: newCardTitle.trim(),
      done: false,
      createdAt: Date.now(),
      parentId: null,
    };

    saveItems([...items, newCard]);
    setNewCardTitle("");
  };

  const handleAddTaskToCard = (cardId: string, text: string) => {
    if (!text.trim()) return;
    const newItem: ScratchItem = {
      id: Math.random().toString(36).substring(2, 9),
      text: text.trim(),
      done: false,
      createdAt: Date.now(),
      parentId: cardId,
    };
    saveItems([...items, newItem]);
  };

  if (!data) return <LoadingPage />;

  const openCount = items.filter((item) => !item.done).length;
  const cards = items.filter((i) => i.parentId === null || !i.parentId);

  return (
    <div style={pageStyle}>
      <PageHeader active="scratchpad" data={data} />

      <main style={mainContainerStyle}>
        <div style={{ width: "100%", maxWidth: 960, display: "flex", flexDirection: "column", gap: 24, height: "100%", minHeight: 0 }}>

          {/* Card Creation form - Vintage Academic Input */}
          <form onSubmit={handleCreateCard} className="grid-card" style={captureCardStyle}>
            <div className="zine-paperclip" />
            <div className="zine-eyebrow blue">
              <span>↳ Create New Topic Card</span>
              <span>01</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={roundIconStyle}>
                <Plus size={16} />
              </div>
              <input
                type="text"
                value={newCardTitle}
                onChange={(e) => setNewCardTitle(e.target.value)}
                placeholder="Name your next card topic (e.g. Work, Workout, Coding)..."
                required
                style={{ ...inputStyle, flex: 1 }}
              />
              <button type="submit" disabled={!newCardTitle.trim()} style={buttonStyle}>
                Add Card
              </button>
            </div>
          </form>

          {/* Cards Board View */}
          <div className="grid-card" style={activeCardStyle}>
            <div className="zine-paperclip" />
            <div style={cardHeaderStyle}>
              <div className="zine-eyebrow">
                <span>↳ Scratchpad Cards Deck</span>
                <span>02</span>
              </div>
              <span className="mono" style={countStyle}>{openCount} open tasks</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", overflowY: "auto", minHeight: 0, flex: 1, paddingRight: 4 }}>
              <div style={cardsGridStyle}>
                {cards.length > 0 ? (
                  cards.map((card) => {
                    const cardTasks = items.filter((i) => i.parentId === card.id);
                    const isPartial = isParentPartiallyDone(card.id);

                    return (
                      <div key={card.id} className="grid-card deck-card" style={indexCardStyle}>
                        <div className="zine-paperclip" />

                        {/* Card Title Header */}
                        <div style={{
                          ...cardTitleHeaderStyle,
                          background: card.done ? "#d1d1ca" : "#fef08a" // yellow header when active, gray when done
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                            <button
                              type="button"
                              onClick={() => handleToggleItem(card.id)}
                              style={{
                                ...checkboxStyle(card.done || isPartial),
                                width: 14,
                                height: 14,
                                background: card.done ? "#7dd3fc" : isPartial ? "#fef08a" : "transparent"
                              }}
                            >
                              {card.done && <Check size={10} style={{ color: "#0c0c0e" }} />}
                              {isPartial && <div style={{ width: 6, height: 6, background: "#0c0c0e" }} />}
                            </button>

                            <div style={{ minWidth: 0, flex: 1 }}>
                              {editingId === card.id ? (
                                <input
                                  ref={editInputRef}
                                  type="text"
                                  value={editingText}
                                  onChange={(e) => setEditingText(e.target.value)}
                                  onBlur={() => handleSaveEdit(card.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveEdit(card.id);
                                    if (e.key === "Escape") setEditingId(null);
                                  }}
                                  style={inlineEditInputStyle}
                                />
                              ) : (
                                <span
                                  onDoubleClick={() => handleStartEdit(card)}
                                  style={{
                                    fontWeight: 800,
                                    fontSize: 14,
                                    cursor: "pointer",
                                    textDecoration: card.done ? "line-through" : "none",
                                    color: card.done ? "#55554e" : "inherit"
                                  }}
                                  title="Double click to edit topic"
                                >
                                  {card.text}
                                </span>
                              )}
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(card)}
                              style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}
                              title="Rename Card"
                            >
                              <Pencil size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(card.id)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--rose)", padding: 2 }}
                              title="Delete Card Stack"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>

                        {/* Card Content list - notebook lined papers */}
                        <div style={cardContentWrapperStyle}>
                          {cardTasks.length > 0 ? (
                            cardTasks.map((task) => (
                              <div key={task.id} style={cardLinedRowStyle}>
                                <button
                                  type="button"
                                  onClick={() => handleToggleItem(task.id)}
                                  style={{ ...checkboxStyle(task.done), width: 14, height: 14 }}
                                >
                                  {task.done && <Check size={9} style={{ color: "#0c0c0e" }} />}
                                </button>

                                <div style={{ minWidth: 0, flex: 1, padding: "0 2px" }}>
                                  {editingId === task.id ? (
                                    <input
                                      ref={editInputRef}
                                      type="text"
                                      value={editingText}
                                      onChange={(e) => setEditingText(e.target.value)}
                                      onBlur={() => handleSaveEdit(task.id)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") handleSaveEdit(task.id);
                                        if (e.key === "Escape") setEditingId(null);
                                      }}
                                      style={{ ...inlineEditInputStyle, fontSize: 13, padding: "2px 4px" }}
                                    />
                                  ) : (
                                    <span
                                      onDoubleClick={() => handleStartEdit(task)}
                                      style={{
                                        fontSize: 13,
                                        cursor: "pointer",
                                        textDecoration: task.done ? "line-through" : "none",
                                        color: task.done ? "#777770" : "inherit",
                                        display: "block",
                                        lineHeight: 1.2
                                      }}
                                      title="Double click to edit subtask"
                                    >
                                      {task.text}
                                    </span>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteItem(task.id)}
                                  style={{ background: "none", border: "none", cursor: "pointer", color: "#b24444", opacity: 0.7 }}
                                  title="Delete subtask"
                                >
                                  ✕
                                </button>
                              </div>
                            ))
                          ) : (
                            <div className="mono" style={{ fontSize: 10, color: "#888", textAlign: "center", padding: "20px 0" }}>
                              Card is empty. Add tasks below.
                            </div>
                          )}
                        </div>

                        {/* Card Add Input */}
                        <div style={{ marginTop: "auto", borderTop: "2px solid #000000", background: "#ffffff" }}>
                          <input
                            type="text"
                            placeholder="+ Add subtask..."
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const input = e.currentTarget;
                                handleAddTaskToCard(card.id, input.value);
                                input.value = "";
                              }
                            }}
                            style={cardInputStyle}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="mono" style={{ ...emptyStateStyle, gridColumn: "1/-1", padding: "48px 0" }}>
                    Your deck is empty. Create your first card topic above!
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

// Vintage Academic styling parameters
const pageStyle: React.CSSProperties = {
  height: "100vh",
  background: "var(--bg)",
  color: "var(--text)",
  display: "flex",
  flexDirection: "column",
  fontFamily: "var(--sans)",
  overflow: "hidden",
};

const mainContainerStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  padding: "32px 32px 40px",
  boxSizing: "border-box",
  overflowY: "auto",
  display: "flex",
  justifyContent: "center",
};

const captureCardStyle: React.CSSProperties = {
  padding: "22px 26px",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  flexShrink: 0,
};

const activeCardStyle: React.CSSProperties = {
  padding: "26px 30px",
  display: "flex",
  flexDirection: "column",
  gap: 18,
  minHeight: 400,
  flex: 1,
};

const inputStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "2px solid #000000",
  borderRadius: 0,
  padding: "12px 14px",
  color: "var(--text)",
  fontSize: "14px",
  outline: "none",
  textTransform: "none",
  fontFamily: "inherit",
};

const inlineEditInputStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1.5px solid #000000",
  borderRadius: 0,
  padding: "4px 6px",
  color: "var(--text)",
  fontSize: "14px",
  outline: "none",
  width: "100%",
  textTransform: "none",
};

const buttonStyle: React.CSSProperties = {
  background: "#0c0c0e",
  color: "#faf9f6",
  border: "none",
  borderRadius: 0,
  padding: "0 18px",
  fontSize: "10px",
  fontFamily: "var(--mono)",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  fontWeight: 600,
  cursor: "pointer",
  height: "46px",
};

const checkboxStyle = (isDone: boolean): React.CSSProperties => ({
  border: "2px solid #000000",
  borderRadius: 0,
  background: isDone ? "#7dd3fc" : "transparent",
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
});

const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 14,
  flexShrink: 0,
};

const countStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#0c0c0e",
  whiteSpace: "nowrap",
};

const emptyStateStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--muted)",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  textAlign: "center",
};

// Index Cards Styles
const cardsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))",
  gap: 24,
  paddingBottom: 20,
};

const indexCardStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minHeight: 300,
  background: "#fcfbf7",
  overflow: "hidden",
  padding: "0",
  position: "relative",
};

const cardTitleHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderBottom: "2px solid #000000",
  padding: "10px 14px",
};

const cardContentWrapperStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  flex: 1,
  background: "#fefeff", // ruled pad body
  backgroundImage: "repeating-linear-gradient(#fcfbf7, #fcfbf7 27px, #e2e8f0 28px)",
  padding: "6px 8px 16px 8px",
};

const cardLinedRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minHeight: 28,
  padding: "4px 0",
  borderBottom: "1px dashed #e2e8f0",
};

const cardInputStyle: React.CSSProperties = {
  width: "100%",
  border: "none",
  outline: "none",
  padding: "10px 12px",
  fontSize: "13px",
  background: "#ffffff",
  fontFamily: "var(--sans)",
};

const roundIconStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  border: "1.5px solid #0c0c0e",
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
};
