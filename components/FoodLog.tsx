"use client";

import { useState } from "react";
import type { FoodEntry } from "@/lib/types";

export default function FoodLog({
  entries,
  date,
  onAdd,
  onDelete,
}: {
  entries: FoodEntry[];
  date: string;
  onAdd: (e: FoodEntry) => void;
  onDelete: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Partial<FoodEntry>>({ meal: "lunch", estimated: false });

  const totals = entries.reduce(
    (acc, e) => ({
      cal: acc.cal + (e.calories ?? 0),
      protein: acc.protein + (e.protein_g ?? 0),
      cost: acc.cost + (e.cost ?? 0),
    }),
    { cal: 0, protein: 0, cost: 0 }
  );

  const handleAdd = async () => {
    if (!form.name) return;
    const entry: FoodEntry = {
      name: form.name ?? "",
      calories: form.calories ?? 0,
      protein_g: form.protein_g ?? 0,
      estimated: form.estimated ?? false,
      cost: form.cost ?? 0,
      time: form.time ?? new Date().toTimeString().slice(0, 5),
      meal: form.meal ?? "other",
    };
    const res = await fetch("/api/daily", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, type: "food", data: entry }),
    });
    const json = await res.json();
    if (!res.ok || !json.food?.id) {
      console.error(json);
      return;
    }
    onAdd(json.food as FoodEntry);
    setAdding(false);
    setForm({ meal: "lunch", estimated: false });
  };

  const handleDelete = async (id: string) => {
    if (!id) return;
    if (!window.confirm("Delete this food entry?")) return;
    await fetch("/api/daily", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, type: "food", id }),
    });
    onDelete(id);
  };

  return (
    <div className="dash-panel p-5 sm:p-6">
      <div className="dash-eyebrow">
        <span>Food today</span>
        <span className="ml-auto">{entries.length} logged</span>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div className="flex items-center flex-wrap gap-4">
          <span className="mono text-[24px]" style={{ color: "var(--text)" }}>
            {totals.cal}<span className="ml-1 text-[11px]" style={{ color: "var(--muted-ink)" }}>kcal</span>
          </span>
          <span className="mono text-[24px]" style={{ color: "var(--text)" }}>
            {totals.protein}<span className="ml-1 text-[11px]" style={{ color: "var(--muted-ink)" }}>g protein</span>
          </span>
        </div>
        <button type="button" onClick={() => setAdding((a) => !a)} className="dash-action px-3 py-2">
          Add
        </button>
      </div>

      {adding && (
        <div className="mb-4 p-4 border space-y-3" style={{ background: "var(--muted)", borderColor: "var(--line)" }}>
          <input
            placeholder="Food name"
            value={form.name ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="dash-input w-full px-3 py-2.5 text-base"
          />
          <div className="flex flex-wrap gap-2">
            <input
              type="number"
              placeholder="Calories"
              value={form.calories ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, calories: +e.target.value }))}
              className="dash-input flex-1 min-w-[7rem] px-3 py-2.5 text-base"
            />
            <input
              type="number"
              placeholder="Protein (g)"
              value={form.protein_g ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, protein_g: +e.target.value }))}
              className="dash-input flex-1 min-w-[7rem] px-3 py-2.5 text-base"
            />
            <input
              type="number"
              placeholder="Cost $"
              value={form.cost ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, cost: +e.target.value }))}
              className="dash-input flex-1 min-w-[7rem] px-3 py-2.5 text-base"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={form.meal ?? "lunch"}
              onChange={(e) => setForm((f) => ({ ...f, meal: e.target.value }))}
              className="dash-input flex-1 min-w-[8rem] px-3 py-2.5 text-base"
            >
              {["breakfast", "lunch", "dinner", "snack"].map((m) => (
                <option key={m}>{m}</option>
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
          No food logged yet. Use Cmd K or Add.
        </p>
      )}

      <div>
        {entries.map((e) => (
          <div
            key={e.id ?? e.name + e.time}
            className="dash-row grid grid-cols-[56px_1fr_70px_58px_auto] gap-3 py-3 items-baseline text-sm"
          >
            <span className="mono text-[11px]" style={{ color: "var(--dim)" }}>{e.time}</span>
            <span className="min-w-0 truncate" style={{ color: "var(--text)" }}>
              {e.name}
              {e.estimated && <span className="mono ml-2 text-[9px]" style={{ color: "var(--blue)" }}>~est</span>}
            </span>
            <span className="mono text-right" style={{ color: "var(--text)" }}>{e.calories}<span className="ml-1 text-[10px]" style={{ color: "var(--dim)" }}>kcal</span></span>
            <span className="mono text-right" style={{ color: "var(--blue)" }}>{e.protein_g}<span className="ml-1 text-[10px]" style={{ color: "var(--dim)" }}>g</span></span>
            <button
              type="button"
              onClick={() => handleDelete(e.id!)}
              disabled={!e.id}
              className="mono text-[10px]"
              style={{ color: "var(--rose)" }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
