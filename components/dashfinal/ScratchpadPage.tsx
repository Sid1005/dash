"use client";

import React, { useState, useEffect, useRef } from "react";
import { PageHeader, LoadingPage, useDashData } from "./DashFinal";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";

interface ScratchItem {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
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
  const [inputText, setInputText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // Load items from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("dash_scratchpad_items");
      if (saved) {
        setItems(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load scratchpad items from localStorage:", e);
    }
  }, []);

  // Save items to localStorage whenever they change
  const saveItems = (newItems: ScratchItem[]) => {
    setItems(newItems);
    try {
      localStorage.setItem("dash_scratchpad_items", JSON.stringify(newItems));
    } catch (e) {
      console.error("Failed to save scratchpad items to localStorage:", e);
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newItem: ScratchItem = {
      id: Math.random().toString(36).substring(2, 9),
      text: inputText.trim(),
      done: false,
      createdAt: Date.now(),
    };

    saveItems([newItem, ...items]);
    setInputText("");
  };

  const handleToggleItem = (id: string) => {
    const updated = items.map((item) =>
      item.id === id ? { ...item, done: !item.done } : item
    );
    saveItems(updated);
  };

  const handleDeleteItem = (id: string) => {
    const updated = items.filter((item) => item.id !== id);
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

  if (!data) return <LoadingPage />;

  const openCount = items.filter((item) => !item.done).length;

  return (
    <div style={pageStyle}>
      <PageHeader active="scratchpad" data={data} />

      <main style={{ flex: 1, minHeight: 0, padding: "32px 32px 40px", boxSizing: "border-box", overflow: "hidden", display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 820, height: "100%", minHeight: 0 }}>
          <section style={{ display: "flex", flexDirection: "column", gap: 22, height: "100%", minHeight: 0 }}>
            <form onSubmit={handleAddItem} className="grid-card" style={captureCardStyle}>
              <div className="zine-paperclip" />
              <div className="zine-eyebrow blue">
                <span>↳ scratch capture</span>
                <span>01</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={roundIconStyle}>
                  <Plus size={16} />
                </div>
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Drop the next loose thread..."
                  required
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  style={buttonStyle}
                >
                  Add
                </button>
              </div>
            </form>

            <div className="grid-card" style={activeCardStyle}>
              <div className="zine-paperclip" />
              <div style={cardHeaderStyle}>
                <div className="zine-eyebrow">
                  <span>↳ active scratch list</span>
                  <span>02</span>
                </div>
                <span className="mono" style={countStyle}>{openCount} open</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", overflowY: "auto", minHeight: 0, flex: 1 }}>
                {items.length > 0 ? (
                  items.map((item) => (
                    <div key={item.id} style={{ ...itemRowStyle, opacity: item.done ? 0.62 : 1 }}>
                      <button
                        type="button"
                        onClick={() => handleToggleItem(item.id)}
                        style={checkboxStyle(item.done)}
                        aria-label={item.done ? "Mark task incomplete" : "Complete task"}
                      >
                        {item.done && <Check size={12} style={{ color: "#0c0c0e" }} />}
                      </button>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        {editingId === item.id ? (
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onBlur={() => handleSaveEdit(item.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveEdit(item.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            style={inlineEditInputStyle}
                          />
                        ) : (
                          <span
                            onDoubleClick={() => handleStartEdit(item)}
                            style={{
                              ...itemTextStyle,
                              textDecoration: item.done ? "line-through" : "none",
                            }}
                            title="Double click to edit"
                          >
                            {item.text}
                          </span>
                        )}
                        <div className="mono" style={metaStyle}>
                          logged {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(item)}
                          style={iconBtnStyle}
                          title="Edit"
                          aria-label="Edit task"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id)}
                          style={{ ...iconBtnStyle, color: "var(--rose)" }}
                          title="Delete"
                          aria-label="Delete task"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="mono" style={emptyStateStyle}>
                    No scratch tasks yet.
                  </div>
                )}
              </div>
            </div>
          </section>
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

const captureCardStyle: React.CSSProperties = {
  padding: "26px 30px",
  display: "flex",
  flexDirection: "column",
  gap: 16,
  flexShrink: 0,
};

const activeCardStyle: React.CSSProperties = {
  padding: "28px 34px",
  display: "flex",
  flexDirection: "column",
  gap: 18,
  minHeight: 0,
  flex: 1,
};

const inputStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "2px solid #000000",
  borderRadius: 0,
  padding: "12px 14px",
  color: "var(--text)",
  fontSize: "15px",
  outline: "none",
  textTransform: "none",
  fontFamily: "inherit",
};

const inlineEditInputStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "2px solid #000000",
  borderRadius: 0,
  padding: "7px 9px",
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
};

const itemRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  padding: "14px 0",
  borderBottom: "1px dashed #000000",
};

const checkboxStyle = (isDone: boolean): React.CSSProperties => ({
  width: 18,
  height: 18,
  border: "2px solid #000000",
  borderRadius: 0,
  background: isDone ? "#7dd3fc" : "transparent",
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  marginTop: 2,
});

const iconBtnStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid #000000",
  cursor: "pointer",
  color: "#0c0c0e",
  width: 26,
  height: 26,
  display: "grid",
  placeItems: "center",
  padding: 0,
  flexShrink: 0,
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

const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 14,
  flexShrink: 0,
};

const countStyle: React.CSSProperties = {
  fontSize: 15,
  color: "#0c0c0e",
  whiteSpace: "nowrap",
};

const itemTextStyle: React.CSSProperties = {
  display: "block",
  fontSize: 15,
  color: "var(--text)",
  lineHeight: 1.35,
  cursor: "pointer",
  textTransform: "none",
  letterSpacing: "normal",
  overflowWrap: "anywhere",
};

const metaStyle: React.CSSProperties = {
  fontSize: 8.5,
  color: "#66666a",
  marginTop: 4,
};

const emptyStateStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--muted)",
  padding: "24px 0",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};
