"use client";

import { useState, useEffect } from "react";
import { subDays, format } from "date-fns";

interface DayLearnings {
  date: string;
  items: string[];
}

export default function LearningsLog() {
  const [days, setDays] = useState<DayLearnings[]>([]);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [newLearning, setNewLearning] = useState("");

  useEffect(() => {
    const promises = Array.from({ length: 14 }, (_, i) => {
      const d = subDays(new Date(), i).toISOString().slice(0, 10);
      return fetch(`/api/learnings?date=${d}`)
        .then((r) => r.json())
        .then((data) => ({ date: d, items: data.items ?? [] }));
    });
    Promise.all(promises).then(setDays);
  }, []);

  const handleAdd = async () => {
    if (!newLearning.trim()) return;
    const today = new Date().toISOString().slice(0, 10);
    await fetch("/api/learnings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: newLearning.trim() }),
    });
    setDays((prev) =>
      prev.map((d) =>
        d.date === today ? { ...d, items: [...d.items, newLearning.trim()] } : d
      )
    );
    setNewLearning("");
    setAdding(false);
  };

  const filtered = days
    .map((d) => ({
      ...d,
      items: search
        ? d.items.filter((i) => i.toLowerCase().includes(search.toLowerCase()))
        : d.items,
    }))
    .filter((d) => d.items.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          placeholder="Search learnings…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="dash-input flex-1 px-3 py-2 text-sm"
        />
        <button
          onClick={() => setAdding((a) => !a)}
          className="dash-action px-3 py-2"
        >
          Add
        </button>
      </div>

      {adding && (
        <div
          className="border p-4"
          style={{ background: "var(--muted)", borderColor: "var(--line)" }}
        >
          <textarea
            placeholder="What did you learn today?"
            value={newLearning}
            onChange={(e) => setNewLearning(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAdd();
            }}
            rows={3}
            className="dash-input w-full px-3 py-2 text-sm resize-none"
          />
          <div className="flex justify-end gap-2 mt-2">
            <span className="mono text-[10px] self-center" style={{ color: "var(--muted-ink)" }}>Cmd Enter to save</span>
            <button
              onClick={handleAdd}
              className="dash-action px-3 py-1.5"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <p className="text-sm" style={{ color: "var(--muted-ink)" }}>
          {search ? "No learnings match your search." : "No learnings logged yet. Use Cmd K or Add."}
        </p>
      )}

      {filtered.map((d) => (
        <div
          key={d.date}
          className="dash-panel p-4"
        >
          <h3 className="dash-eyebrow mb-3">
            {format(new Date(d.date + "T12:00:00"), "EEEE, MMMM d")}
          </h3>
          <ul>
            {d.items.map((item, i) => (
              <li key={i} className="dash-row flex items-start gap-3 py-2 text-sm">
                <span className="mt-1 size-1.5 shrink-0 rotate-45" style={{ background: "var(--blue)" }} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
