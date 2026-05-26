"use client";

import { useState } from "react";
import type { SpendEntry } from "@/lib/types";

const CATEGORIES = ["Food", "Transport", "Health", "Entertainment", "Shopping", "Other"];

export default function SpendLog({
  entries,
  date,
  onAdd,
  onDelete,
}: {
  entries: SpendEntry[];
  date: string;
  onAdd: (e: SpendEntry) => void;
  onDelete: (index: number) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Partial<SpendEntry>>({ category: "Food" });

  const total = entries.reduce((s, e) => s + (e.amount ?? 0), 0);

  const handleAdd = async () => {
    if (!form.item || !form.amount) return;
    const entry: SpendEntry = {
      item: form.item ?? "",
      amount: form.amount ?? 0,
      category: form.category ?? "Other",
      time: form.time ?? new Date().toTimeString().slice(0, 5),
    };
    const res = await fetch("/api/daily", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, type: "spending", data: entry }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.spending) {
        onAdd({
          id: json.spending.id,
          item: json.spending.item,
          amount: Number(json.spending.amount),
          category: json.spending.category,
          time: json.spending.time_local,
        });
      } else {
        onAdd(entry);
      }
    } else {
      onAdd(entry);
    }
    setAdding(false);
    setForm({ category: "Food" });
  };

  const handleDelete = async (index: number) => {
    if (!window.confirm("Delete this spending entry?")) return;
    const entry = entries[index];
    await fetch("/api/daily", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, type: "spending", id: entry?.id }),
    });
    onDelete(index);
  };

  return (
    <div className="dash-panel p-5 sm:p-6">
      <div className="dash-eyebrow">
        <span>Spending today</span>
        <span className="ml-auto">{entries.length} items</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <span className="mono text-[24px]" style={{ color: "var(--text)" }}>
          ${total.toFixed(2)}<span className="ml-2 text-[11px]" style={{ color: "var(--muted-ink)" }}>spent</span>
        </span>
        <button type="button" onClick={() => setAdding((a) => !a)} className="dash-action px-3 py-2">
          Add
        </button>
      </div>

      {adding && (
        <div className="mb-4 p-4 border space-y-3" style={{ background: "var(--muted)", borderColor: "var(--line)" }}>
          <div className="flex flex-wrap gap-2">
            <input
              placeholder="What did you buy?"
              value={form.item ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, item: e.target.value }))}
              className="dash-input flex-1 min-w-[10rem] px-3 py-2.5 text-base"
            />
            <input
              type="number"
              placeholder="$"
              value={form.amount ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, amount: +e.target.value }))}
              className="dash-input w-28 px-3 py-2.5 text-base tabular-nums"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={form.category ?? "Food"}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="dash-input flex-1 min-w-[8rem] px-3 py-2.5 text-base"
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAdd}
              className="dash-action px-5 py-2.5"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {entries.length === 0 && !adding && (
        <p className="text-base leading-relaxed" style={{ color: "var(--muted-ink)" }}>
          No spending logged yet.
        </p>
      )}

      <div>
        {entries.map((e, i) => (
          <div
            key={i}
            className="dash-row grid grid-cols-[56px_1fr_86px_76px_auto] gap-3 py-3 items-baseline text-sm"
          >
            <span className="mono text-[11px]" style={{ color: "var(--dim)" }}>{e.time}</span>
            <span className="truncate" style={{ color: "var(--text)" }}>{e.item}</span>
            <span className="mono uc text-[9px]" style={{ color: "var(--muted-ink)", letterSpacing: "0.16em" }}>{e.category}</span>
            <span className="mono text-right" style={{ color: "var(--text)" }}>${e.amount.toFixed(2)}</span>
            <button type="button" onClick={() => handleDelete(i)} className="mono text-[10px]" style={{ color: "var(--rose)" }}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
