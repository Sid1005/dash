"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { PageHeader, LoadingPage, Eyebrow, useDashData, BROWN_LINE } from "./DashFinal";
import { Check } from "lucide-react";

interface ScratchItem {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
}

export function ScratchpadPage() {
  const data = useDashData();
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

  const handleClearCompleted = () => {
    const updated = items.filter((item) => !item.done);
    saveItems(updated);
  };

  if (!data) return <LoadingPage />;

  const activeItems = items.filter((item) => !item.done);
  const completedItems = items.filter((item) => item.done);

  return (
    <div style={pageStyle}>
      <PageHeader active="scratchpad" data={data} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", flex: 1 }}>
        {/* Left main area: Scratchpad checklist */}
        <div style={{ padding: "34px 40px 48px", borderRight: `1px solid ${BROWN_LINE}` }}>
          {/* Quick Add Form */}
          <Eyebrow label="Add Scratch Task" color="var(--blue)" />
          <form onSubmit={handleAddItem} style={cardStyle}>
            <div style={{ display: "flex", gap: 12 }}>
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="What needs to be done next?"
                required
                style={{
                  ...inputStyle,
                  flex: 1,
                }}
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                style={buttonStyle}
              >
                Add Task
              </button>
            </div>
          </form>

          {/* Active Items */}
          <Eyebrow label={`Active Checklist (${activeItems.length})`} color="var(--blue)" />
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 40 }}>
            {activeItems.length > 0 ? (
              activeItems.map((item) => (
                <div key={item.id} style={itemRowStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                    <button
                      type="button"
                      onClick={() => handleToggleItem(item.id)}
                      style={checkboxStyle(false)}
                      aria-label="Complete task"
                    />
                    
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
                        style={{ fontSize: 14.5, color: "var(--text)", cursor: "pointer", textTransform: "none", letterSpacing: "normal" }}
                        title="Double click to edit"
                      >
                        {item.text}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button
                      type="button"
                      onClick={() => handleStartEdit(item)}
                      style={actionBtnStyle}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item.id)}
                      style={{ ...actionBtnStyle, color: "var(--rose)" }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="mono uc" style={{ fontSize: 11, color: "var(--dim)", padding: "20px 0", letterSpacing: "0.14em" }}>
                No active tasks logged. Add above!
              </div>
            )}
          </div>

          {/* Completed Items */}
          {completedItems.length > 0 && (
            <div>
              <Eyebrow
                label={`Completed Items (${completedItems.length})`}
                color="var(--dim)"
                right={
                  <button
                    type="button"
                    onClick={handleClearCompleted}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--rose)",
                      fontFamily: "var(--mono)",
                      fontSize: 10.5,
                      cursor: "pointer",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    Clear Completed
                  </button>
                }
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {completedItems.map((item) => (
                  <div key={item.id} style={{ ...itemRowStyle, opacity: 0.6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                      <button
                        type="button"
                        onClick={() => handleToggleItem(item.id)}
                        style={checkboxStyle(true)}
                        aria-label="Mark task incomplete"
                      >
                        <Check size={12} style={{ color: "var(--blue)" }} />
                      </button>
                      <span
                        style={{
                          fontSize: 14.5,
                          color: "var(--text)",
                          textDecoration: "line-through",
                          textTransform: "none",
                          letterSpacing: "normal",
                        }}
                      >
                        {item.text}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item.id)}
                      style={{ ...actionBtnStyle, color: "var(--rose)" }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column sidebar */}
        <div style={{ padding: "32px 36px", display: "flex", flexDirection: "column", gap: 24 }}>
          <div>
            <Eyebrow label="Focus Target" color="var(--blue)" />
            <div style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.55, fontStyle: "italic", textTransform: "none", letterSpacing: "normal" }}>
              "Keep your head down and execute the plan. Single tasking is your superpower."
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Vintage Academic styling parameters
const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "var(--bg)",
  color: "var(--text)",
  display: "flex",
  flexDirection: "column",
  fontFamily: "var(--sans)",
};

const cardStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(205,187,159,0.12), transparent)",
  border: "1px solid var(--line)",
  borderRadius: "12px",
  padding: "20px",
  marginBottom: "28px",
};

const inputStyle: React.CSSProperties = {
  background: "var(--bg)",
  border: "1px solid var(--line)",
  borderRadius: "6px",
  padding: "10px 14px",
  color: "var(--text)",
  fontSize: "14px",
  outline: "none",
  textTransform: "none",
};

const inlineEditInputStyle: React.CSSProperties = {
  background: "var(--bg)",
  border: "1px solid var(--blue)",
  borderRadius: "4px",
  padding: "4px 8px",
  color: "var(--text)",
  fontSize: "14px",
  outline: "none",
  flex: 1,
  textTransform: "none",
};

const buttonStyle: React.CSSProperties = {
  background: "var(--blue)",
  color: "#fffaf0",
  border: "none",
  borderRadius: "6px",
  padding: "10px 18px",
  fontSize: "11px",
  fontFamily: "var(--mono)",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  fontWeight: 600,
  cursor: "pointer",
};

const itemRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 0",
  borderBottom: "1px dashed var(--line)",
};

const checkboxStyle = (isDone: boolean): React.CSSProperties => ({
  width: 18,
  height: 18,
  border: "2px solid var(--blue)",
  borderRadius: 4,
  background: isDone ? "rgba(36,84,214,0.08)" : "transparent",
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
});

const actionBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--muted)",
  fontSize: "11px",
  fontFamily: "var(--mono)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};
