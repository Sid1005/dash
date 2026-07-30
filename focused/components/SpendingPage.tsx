"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "./AppShell";
import { DateCalendar } from "./DateCalendar";
import { QueryBox } from "./QueryBox";
import { formatINR } from "../lib/money";
import { formatDateLong } from "../lib/time";
import type { SpendingCategoryRow, SpendingRow } from "../lib/types";

function today() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function nowTime() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hour = parts.find((part) => part.type === "hour")?.value ?? "12";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

const SPENDING_QUERY_EXAMPLES = ["spending this month", "travel spending in June"];

export function SpendingPage() {
  const initialDateResolved = useRef(false);
  const [selectedDate, setSelectedDate] = useState(today);
  const [rows, setRows] = useState<SpendingRow[]>([]);
  const [categories, setCategories] = useState<SpendingCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [item, setItem] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [time, setTime] = useState(nowTime);
  const [newCategory, setNewCategory] = useState("");
  const [renameId, setRenameId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [mergeSource, setMergeSource] = useState("");
  const [mergeTarget, setMergeTarget] = useState("");
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [spendingResponse, categoriesResponse] = await Promise.all([
        fetch("/api/spending?limit=1000"),
        fetch("/api/spending/categories"),
      ]);
      const [spendingBody, categoriesBody] = await Promise.all([spendingResponse.json(), categoriesResponse.json()]);
      const errors: string[] = [];
      if (spendingResponse.ok) {
        const nextRows = spendingBody.spending ?? [];
        setRows(nextRows);
        if (!initialDateResolved.current) {
          const todayValue = today();
          if (!nextRows.some((row: SpendingRow) => row.occurred_date === todayValue) && nextRows[0]?.occurred_date) {
            setSelectedDate(nextRows[0].occurred_date);
          }
          initialDateResolved.current = true;
        }
      } else {
        errors.push(spendingBody.error ?? "Spending could not be loaded.");
      }
      if (categoriesResponse.ok) {
        const nextCategories = categoriesBody.categories ?? [];
        setCategories(nextCategories);
        setCategory((current) => current || nextCategories[0]?.name || "");
      } else {
        errors.push(categoriesBody.error ?? "Spending categories could not be loaded.");
      }
      setLoadError(errors.join(" "));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Spending could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const dayRows = useMemo(() => rows.filter((row) => row.occurred_date === selectedDate), [rows, selectedDate]);
  const monthPrefix = selectedDate.slice(0, 7);
  const monthRows = useMemo(() => rows.filter((row) => row.occurred_date.startsWith(monthPrefix)), [rows, monthPrefix]);
  const monthTotal = monthRows.reduce((sum, row) => sum + row.amount, 0);
  const breakdown = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of monthRows) totals.set(row.category, (totals.get(row.category) ?? 0) + row.amount);
    return Array.from(totals).sort((left, right) => right[1] - left[1]);
  }, [monthRows]);
  const activeDates = useMemo(() => Array.from(new Set(rows.map((row) => row.occurred_date))), [rows]);
  const viewingToday = selectedDate === today();

  function resetForm() {
    setEditingId(null);
    setItem("");
    setAmount("");
    setTime(nowTime());
  }

  function closeForm() {
    resetForm();
    setShowForm(false);
  }

  function beginEdit(row: SpendingRow) {
    setEditingId(row.id);
    setSelectedDate(row.occurred_date);
    setItem(row.item);
    setAmount(String(row.amount));
    setCategory(row.category);
    setTime(row.time_local);
    setShowForm(true);
  }

  async function saveSpending(event: React.FormEvent) {
    event.preventDefault();
    setNotice("");
    const response = await fetch("/api/spending", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingId, item, amount: Number(amount), category, date: selectedDate, time }),
    });
    const body = await response.json();
    if (!response.ok) return setNotice(body.error ?? "Could not save spending.");
    resetForm();
    await load();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this spending entry?")) return;
    await fetch("/api/spending", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (editingId === id) resetForm();
    await load();
  }

  async function createCategory(event: React.FormEvent) {
    event.preventDefault();
    setNotice("");
    const response = await fetch("/api/spending/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCategory }),
    });
    const body = await response.json();
    if (!response.ok) return setNotice(body.error ?? "Could not add category.");
    setNewCategory("");
    setCategory(body.category.name);
    await load();
  }

  async function renameCategory(event: React.FormEvent) {
    event.preventDefault();
    setNotice("");
    const response = await fetch("/api/spending/categories", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: renameId, name: renameValue }),
    });
    const body = await response.json();
    if (!response.ok) return setNotice(body.error ?? "Could not rename category.");
    setRenameId("");
    setRenameValue("");
    await load();
  }

  async function mergeCategories(event: React.FormEvent) {
    event.preventDefault();
    setNotice("");
    const response = await fetch("/api/spending/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_id: mergeSource, target_id: mergeTarget }),
    });
    const body = await response.json();
    if (!response.ok) return setNotice(body.error ?? "Could not merge categories.");
    setMergeSource("");
    setMergeTarget("");
    await load();
  }

  return (
    <AppShell title="Spending">
      <section className="ledger-header">
        <div className="ledger-heading">
          <span className="section-kicker">Daily ledger</span>
          <div className="day-heading">
            <h1>{formatDateLong(selectedDate)}</h1>
            <div className="heading-metrics" aria-label="Spending summary">
              <div><strong>{formatINR(dayRows.reduce((sum, row) => sum + row.amount, 0))}</strong><span>{viewingToday ? "today" : "this day"}</span></div>
              <div><strong>{formatINR(monthTotal)}</strong><span>{new Date(`${selectedDate}T12:00:00+05:30`).toLocaleDateString("en-IN", { month: "short" })}</span></div>
            </div>
          </div>
        </div>
        <DateCalendar selectedDate={selectedDate} onChange={setSelectedDate} activeDates={activeDates} />
      </section>

      <div className="workspace-grid spending-workspace">
        <section className="panel primary-panel">
          <span className="paperclip" aria-hidden="true" />
          <div className="panel-title-row">
            <div className="panel-label"><span>{viewingToday ? "Spending today" : "Spending on this day"}</span><span>{dayRows.length} entries</span></div>
            <button type="button" className="small-add-button" onClick={() => showForm ? closeForm() : setShowForm(true)}>{showForm ? "Close form" : "+ Add spending"}</button>
          </div>

          <div className="record-list">
            {loadError && <p className="load-error" role="alert">{loadError}</p>}
            {loading && <p className="empty">Loading…</p>}
            {!loading && dayRows.map((row) => (
              <article className="record-row spending-row" key={row.id}>
                <div><strong>{row.item}</strong><span>{row.category} · {row.time_local}</span></div>
                <b>{formatINR(row.amount)}</b>
                <div className="row-actions">
                  <button type="button" onClick={() => beginEdit(row)}>Edit</button>
                  <button type="button" onClick={() => void remove(row.id)}>Delete</button>
                </div>
              </article>
            ))}
            {!loading && !loadError && dayRows.length === 0 && <p className="empty">Nothing spent on this date. Dates with saved entries are marked above.</p>}
          </div>
        </section>

        <aside className="side-stack">
          {showForm && (
            <form className="panel compact-form spending-form" onSubmit={saveSpending}>
              <span className="paperclip" aria-hidden="true" />
              <div className="panel-label blue"><span>{editingId ? "Edit spending" : "Add spending"}</span><span>{editingId ? "Edit" : "+"}</span></div>
              {editingId && <button type="button" className="text-button cancel-button" onClick={resetForm}>Cancel edit</button>}
              <div className="form-grid two"><label>Item<input required value={item} onChange={(event) => setItem(event.target.value)} placeholder="What was it?" /></label><label>Amount<input required type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="₹" /></label></div>
              <div className="form-grid two"><label>Category<select required value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((entry) => <option key={entry.id} value={entry.name}>{entry.name}</option>)}</select></label><label>Time<input required type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label></div>
              <button className="primary-button">{editingId ? "Save changes" : "Add spending"}</button>
              {notice && <p className="form-notice">{notice}</p>}
            </form>
          )}

          <section className="panel category-panel">
            <span className="paperclip" aria-hidden="true" />
            <div className="panel-label"><span>Month by category</span><span>{monthRows.length} entries</span></div>
            <div className="breakdown-list">{breakdown.map(([name, value]) => <div key={name}><span>{name}</span><strong>{formatINR(value)}</strong></div>)}</div>
            <details>
              <summary>Manage categories</summary>
              <div className="category-tools">
                <form onSubmit={createCategory}><input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="New category" required /><button>Add</button></form>
                <form onSubmit={renameCategory}><select value={renameId} onChange={(event) => setRenameId(event.target.value)} required><option value="">Rename…</option>{categories.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select><input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} placeholder="New name" required /><button>Rename</button></form>
                <form onSubmit={mergeCategories}><select value={mergeSource} onChange={(event) => setMergeSource(event.target.value)} required><option value="">Merge…</option>{categories.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select><select value={mergeTarget} onChange={(event) => setMergeTarget(event.target.value)} required><option value="">Into…</option>{categories.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select><button>Merge</button></form>
              </div>
            </details>
            {notice && <p className="form-notice">{notice}</p>}
          </section>
          <QueryBox domain="spending" placeholder="Query past spending" examples={SPENDING_QUERY_EXAMPLES} />
        </aside>
      </div>
    </AppShell>
  );
}
