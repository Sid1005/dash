"use client";

import { useState } from "react";
import type { TimeBlock } from "@/lib/types";

const CATEGORIES: Record<string, string> = {
  "Deep Work": "rgba(36,84,214,1)",
  Admin: "rgba(36,84,214,0.6)",
  Meetings: "rgba(36,84,214,0.78)",
  Personal: "rgba(36,84,214,0.24)",
  Health: "rgba(36,84,214,0.34)",
  Learning: "rgba(36,84,214,0.46)",
  Other: "rgba(36,84,214,0.16)",
};

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function slotLabel(minutesFromStart: number, startHour: number): string {
  const total = startHour * 60 + minutesFromStart;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const START_HOUR = 6;
const END_HOUR = 23;
const TOTAL_SLOTS = (END_HOUR - START_HOUR) * 4; // 15-min slots

export default function TimeBlockGrid({
  blocks,
  date,
  onAdd,
  onDelete,
}: {
  blocks: TimeBlock[];
  date: string;
  onAdd: (block: TimeBlock) => void;
  onDelete: (index: number) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Partial<TimeBlock>>({ category: "Deep Work" });

  const slots = Array.from({ length: TOTAL_SLOTS }, (_, i) => {
    const slotStart = slotLabel(i * 15, START_HOUR);
    const slotEnd = slotLabel((i + 1) * 15, START_HOUR);
    const block = blocks.find(
      (b) =>
        toMinutes(b.start) <= toMinutes(slotStart) &&
        toMinutes(b.end) > toMinutes(slotStart)
    );
    return { slotStart, slotEnd, block };
  });

  const handleAdd = async () => {
    if (!form.start || !form.end || !form.activity) return;
    const block: TimeBlock = {
      start: form.start,
      end: form.end,
      activity: form.activity,
      category: form.category ?? "Other",
    };
    await fetch("/api/daily", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, type: "time_block", data: block }),
    });
    onAdd(block);
    setAdding(false);
    setForm({ category: "Deep Work" });
  };

  const handleDelete = async (index: number) => {
    if (!window.confirm("Delete this time block?")) return;
    await fetch("/api/daily", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, type: "time_block", index }),
    });
    onDelete(index);
  };

  const hourLabels = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  return (
    <div className="dash-panel p-5 sm:p-6">
      <div className="dash-eyebrow">
        <span>Time blocks</span>
        <span className="ml-auto">15-min</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <span className="mono text-[22px]" style={{ color: "var(--text)" }}>
          {blocks.length}<span className="ml-2 text-[11px]" style={{ color: "var(--muted-ink)" }}>logged</span>
        </span>
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          className="dash-action px-3 py-2"
        >
          Add
        </button>
      </div>

      {adding && (
        <div
          className="mb-4 p-4 border space-y-3"
          style={{ background: "var(--muted)", borderColor: "var(--line)" }}
        >
          <div className="flex flex-wrap gap-2">
            <input
              type="time"
              value={form.start ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
              className="dash-input flex-1 min-w-[7rem] px-3 py-2.5 text-base"
            />
            <input
              type="time"
              value={form.end ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))}
              className="dash-input flex-1 min-w-[7rem] px-3 py-2.5 text-base"
            />
          </div>
          <input
            placeholder="What were you doing?"
            value={form.activity ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, activity: e.target.value }))}
            className="dash-input w-full px-3 py-2.5 text-base"
          />
          <div className="flex flex-wrap gap-2">
            <select
              value={form.category ?? "Deep Work"}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="dash-input flex-1 min-w-[8rem] px-3 py-2.5 text-base"
            >
              {Object.keys(CATEGORIES).map((c) => (
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

      <div className="overflow-y-auto max-h-72 text-sm">
        <div className="flex">
          <div className="w-12 flex-shrink-0" />
          <div className="flex-1 grid" style={{ gridTemplateColumns: "1fr" }}>
            {hourLabels.map((h) => (
              <div key={h} className="flex items-center gap-1" style={{ height: "22px" }}>
                <span className="mono text-xs min-w-[2.25rem] tabular-nums" style={{ color: "var(--dim)" }}>
                  {String(h).padStart(2, "0")}:00
                </span>
                <div className="flex-1 border-t" style={{ borderColor: "var(--line)" }} />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-1 space-y-px">
          {slots.map(({ slotStart, block }, i) => {
            const showHour = i % 4 === 0;
            return (
              <div key={slotStart} className="flex items-center gap-2" style={{ height: "18px" }}>
                <span
                  className="w-12 flex-shrink-0 text-right text-xs tabular-nums"
                  style={{ color: showHour ? "var(--dim)" : "transparent", fontFamily: "var(--font-label)" }}
                >
                  {showHour ? slotStart : "·"}
                </span>
                <div
                  className="flex-1 rounded-sm px-1.5 flex items-center min-h-[16px]"
                  style={{
                    background: block ? CATEGORIES[block.category] : "var(--muted)",
                    borderLeft: block ? `3px solid ${CATEGORIES[block.category]}` : "3px solid transparent",
                    height: "16px",
                  }}
                >
                  {block && (
                    <span className="truncate text-[11px] leading-none" style={{ color: "var(--text)" }}>
                      {block.activity}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
        {Object.entries(CATEGORIES).map(([cat, color]) => (
          <div key={cat} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-[1px]" style={{ background: color }} />
            <span className="text-sm" style={{ color: "var(--muted-ink)" }}>
              {cat}
            </span>
          </div>
        ))}
      </div>

      {blocks.length > 0 && (
        <div className="mt-5 space-y-2">
          <h4 className="dash-eyebrow mb-1">Logged blocks</h4>
          {blocks.map((b, i) => (
            <div
              key={`${b.start}-${b.end}-${b.activity}-${i}`}
              className="dash-row flex items-center justify-between py-2"
            >
              <div className="min-w-0">
                <p className="text-sm truncate" style={{ color: "var(--text)" }}>
                  {b.start}-{b.end} · {b.activity}
                </p>
                <p className="mono text-[10px]" style={{ color: "var(--muted-ink)" }}>{b.category}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(i)}
                className="mono text-[10px]"
                style={{ color: "var(--rose)" }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
