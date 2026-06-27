"use client";

import React, { useCallback, useEffect, useState } from "react";
import { formatINR } from "@/lib/currency";
import {
  DateNavigator,
  Eyebrow,
  LedgerHeader,
  LoadingPage,
  MealRow,
  PageHeader,
  SpendRow,
  localIsoDate,
  useDashData,
} from "./DashFinal";
import type { DashData } from "./types";

export function FoodSpendingPage() {
  const [date, setDate] = useState(() => localIsoDate());
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const data = useDashData(date, refreshTrigger, {
    includeTasks: false,
    includeProblems: false,
    includeQuotes: false,
  });
  const [showAllSpend, setShowAllSpend] = useState(false);
  const [showAllFood, setShowAllFood] = useState(false);

  // Spending form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [item, setItem] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Other");
  const [time, setTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAddFoodForm, setShowAddFoodForm] = useState(false);
  const [foodLabel, setFoodLabel] = useState("");
  const [foodKcal, setFoodKcal] = useState("");
  const [foodProtein, setFoodProtein] = useState("");
  const [foodCost, setFoodCost] = useState("");
  const [foodMeal, setFoodMeal] = useState("lunch");
  const [foodLoading, setFoodLoading] = useState(false);

  // Set default current time when opening the form
  useEffect(() => {
    if (showAddForm || showAddFoodForm) {
      try {
        const timeStr = new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date());
        setTime(timeStr);
      } catch {
        setTime("12:00");
      }
    }
  }, [showAddForm, showAddFoodForm]);

  const handleAddSpend = useCallback(async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!item.trim() || !amount) return;

    setLoading(true);
    try {
      const res = await fetch("/api/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          type: "spending",
          data: {
            item: item.trim(),
            amount: parseFloat(amount),
            category,
            time: time || "00:00",
          },
        }),
      });

      if (res.ok) {
        setItem("");
        setAmount("");
        setCategory("Other");
        setShowAddForm(false);
        setRefreshTrigger((prev) => prev + 1);
      } else {
        const errorText = await res.text();
        alert(`Error adding spending: ${errorText}`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to add spending entry");
    } finally {
      setLoading(false);
    }
  }, [date, item, amount, category, time, setRefreshTrigger]);

  const handleAddFood = useCallback(async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!foodLabel.trim()) return;

    setFoodLoading(true);
    try {
      const res = await fetch("/api/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          type: "food",
          data: {
            name: foodLabel.trim(),
            calories: foodKcal ? parseFloat(foodKcal) : 0,
            protein_g: foodProtein ? parseFloat(foodProtein) : 0,
            cost: foodCost ? parseFloat(foodCost) : 0,
            meal: foodMeal,
            estimated: false,
            time: time || new Date().toTimeString().slice(0, 5),
          },
        }),
      });

      if (res.ok) {
        setFoodLabel("");
        setFoodKcal("");
        setFoodProtein("");
        setFoodCost("");
        setFoodMeal("lunch");
        setShowAddFoodForm(false);
        setRefreshTrigger((prev) => prev + 1);
      } else {
        const errorText = await res.text();
        alert(`Error adding food: ${errorText}`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to add food entry");
    } finally {
      setFoodLoading(false);
    }
  }, [date, foodCost, foodKcal, foodLabel, foodMeal, foodProtein, time, setRefreshTrigger]);

  const deleteMeal = useCallback(async (m: DashData["MEALS"][number]) => {
    await fetch("/api/daily", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "food", id: m.id }),
    });
    setRefreshTrigger((prev) => prev + 1);
  }, [setRefreshTrigger]);

  const deleteSpend = useCallback(async (s: DashData["SPEND"][number]) => {
    await fetch("/api/daily", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "spending", id: s.id }),
    });
    setRefreshTrigger((prev) => prev + 1);
  }, [setRefreshTrigger]);

    const compactInputStyle: React.CSSProperties = {
    padding: "8px 10px",
    border: "2px solid #000",
    borderRadius: 0,
    background: "var(--bg)",
    color: "var(--text)",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
    width: "100%",
  };

  const compactButtonStyle: React.CSSProperties = {
    background: "#0c0c0e",
    color: "#fff",
    border: "2px solid #000",
    borderRadius: 0,
    padding: "8px 14px",
    cursor: foodLoading ? "not-allowed" : "pointer",
    fontFamily: "var(--mono)",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    opacity: foodLoading ? 0.7 : 1,
  };

  if (!data) return <LoadingPage />;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <PageHeader active="food" data={data} />

      <main style={{ padding: "32px", flex: 1, display: "flex", justifyContent: "center", overflow: "hidden" }}>
        <div style={{ width: "100%", maxWidth: 1180, display: "flex", flexDirection: "column", gap: 18, minHeight: 0 }}>
          {/* Header showing selected date & DateNavigator */}
          <div className="grid-card" style={{ padding: "14px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexShrink: 0 }}>
            <div className="zine-paperclip" />
            <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
              <div className="zine-eyebrow blue" style={{ marginBottom: 0, flexShrink: 0 }}>
                <span>↳ food & spend</span>
                <span>01</span>
              </div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {data.TODAY.dateLong}
              </h1>
            </div>
            <DateNavigator selectedDate={date} onChange={setDate} compact />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 28, flex: 1, minHeight: 0 }}>
          {/* Spending Section (placed above food) */}
          <div className="grid-card" style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 14, minHeight: 0 }}>
            <div className="zine-paperclip" />
            <Eyebrow
              label="Spending"
              right={
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span>{data.SPEND.length} items</span>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(!showAddForm)}
                    style={{
                      background: showAddForm ? "var(--rose)" : "var(--blue)",
                      color: "#fffaf0",
                      border: "2px solid #000",
                      padding: "4px 9px",
                      cursor: "pointer",
                      fontFamily: "var(--mono)",
                      fontSize: 10,
                      borderRadius: 0,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      fontWeight: 600,
                      transition: "background 0.15s ease, transform 0.1s ease",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.filter = "brightness(1.15)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.filter = "none";
                    }}
                  >
                    {showAddForm ? "Cancel" : "+ Add"}
                  </button>
                </div>
              }
            />
            <LedgerHeader items={[{ label: "spent", value: formatINR(data.VITALS.spend.today), of: formatINR(data.VITALS.spend.target, 0) }]} />

            {showAddForm && (
              <form
                onSubmit={handleAddSpend}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  padding: "16px 20px",
                  background: "var(--bg)",
                  border: "2px solid #000",
                  borderRadius: 0,
                  marginBottom: 8,
                  animation: "fadeIn 0.2s ease-out",
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label className="mono uc" style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.1em" }}>Item Name</label>
                    <input
                      type="text"
                      required
                      placeholder="What did you buy?"
                      value={item}
                      onChange={(e) => setItem(e.target.value)}
                      style={{
                        padding: "8px 12px",
                        border: "2px solid #000",
                        borderRadius: 0,
                        background: "var(--bg)",
                        color: "var(--text)",
                        fontSize: 14,
                        fontFamily: "inherit",
                        outline: "none",
                        transition: "border-color 0.15s",
                      }}
                      onFocus={(e) => e.target.style.borderColor = "var(--blue)"}
                      onBlur={(e) => e.target.style.borderColor = "var(--line)"}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label className="mono uc" style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.1em" }}>Amount (₹)</label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="any"
                      placeholder="Amount"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      style={{
                        padding: "8px 12px",
                        border: "2px solid #000",
                        borderRadius: 0,
                        background: "var(--bg)",
                        color: "var(--text)",
                        fontSize: 14,
                        fontFamily: "var(--mono)",
                        outline: "none",
                        transition: "border-color 0.15s",
                      }}
                      onFocus={(e) => e.target.style.borderColor = "var(--blue)"}
                      onBlur={(e) => e.target.style.borderColor = "var(--line)"}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label className="mono uc" style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.1em" }}>Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      style={{
                        padding: "8px 12px",
                        border: "2px solid #000",
                        borderRadius: 0,
                        background: "var(--bg)",
                        color: "var(--text)",
                        fontSize: 14,
                        fontFamily: "inherit",
                        outline: "none",
                        cursor: "pointer",
                        transition: "border-color 0.15s",
                      }}
                      onFocus={(e) => e.target.style.borderColor = "var(--blue)"}
                      onBlur={(e) => e.target.style.borderColor = "var(--line)"}
                    >
                      <option value="Food">Food</option>
                      <option value="Transport">Transport</option>
                      <option value="Health">Health</option>
                      <option value="Entertainment">Entertainment</option>
                      <option value="Shopping">Shopping</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label className="mono uc" style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.1em" }}>Time (HH:MM)</label>
                    <input
                      type="text"
                      placeholder="HH:MM"
                      pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$"
                      title="Please enter time in HH:MM format (24-hour clock)"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      style={{
                        padding: "8px 12px",
                        border: "2px solid #000",
                        borderRadius: 0,
                        background: "var(--bg)",
                        color: "var(--text)",
                        fontSize: 14,
                        fontFamily: "var(--mono)",
                        outline: "none",
                        transition: "border-color 0.15s",
                      }}
                      onFocus={(e) => e.target.style.borderColor = "var(--blue)"}
                      onBlur={(e) => e.target.style.borderColor = "var(--line)"}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: "var(--blue)",
                    color: "#fffaf0",
                    border: "2px solid #000",
                    padding: "10px",
                    cursor: loading ? "not-allowed" : "pointer",
                    fontFamily: "var(--mono)",
                    fontSize: 12,
                    borderRadius: 0,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    fontWeight: 600,
                    opacity: loading ? 0.7 : 1,
                    transition: "filter 0.15s ease",
                  }}
                  onMouseOver={(e) => {
                    if (!loading) e.currentTarget.style.filter = "brightness(1.1)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.filter = "none";
                  }}
                >
                  {loading ? "Saving..." : "Save Spending"}
                </button>
              </form>
            )}

            {data.SPEND.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {data.SPEND.slice(0, showAllSpend ? 10 : 3).map((s, i) => (
                  <SpendRow key={s.id || i} s={s} onDelete={deleteSpend} />
                ))}

                {data.SPEND.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setShowAllSpend(!showAllSpend)}
                    style={{
                      marginTop: 10,
                      background: "none",
                      border: "none",
                      color: "var(--blue)",
                      cursor: "pointer",
                      fontSize: 11,
                      fontFamily: "var(--mono)",
                      alignSelf: "flex-start",
                      padding: "4px 0",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      fontWeight: 600,
                    }}
                  >
                    {showAllSpend ? "See less" : `See more (last ${Math.min(data.SPEND.length, 10)})`}
                  </button>
                )}
              </div>
            ) : (
              <div className="mono uc" style={{ fontSize: 10.5, color: "var(--dim)", padding: "16px 0", letterSpacing: "0.14em" }}>
                No spending logged for this day
              </div>
            )}
          </div>

          {/* Food Section */}
          <div className="grid-card" style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 14, minHeight: 0 }}>
            <div className="zine-paperclip" />
            <Eyebrow
              label="Food"
              right={
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span>{data.MEALS.length} logged</span>
                  <button
                    type="button"
                    onClick={() => setShowAddFoodForm(!showAddFoodForm)}
                    style={{
                      background: showAddFoodForm ? "var(--rose)" : "var(--blue)",
                      color: "#fffaf0",
                      border: "2px solid #000",
                      padding: "4px 9px",
                      cursor: "pointer",
                      fontFamily: "var(--mono)",
                      fontSize: 10,
                      borderRadius: 0,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      fontWeight: 600,
                    }}
                  >
                    {showAddFoodForm ? "Cancel" : "+ Add"}
                  </button>
                </div>
              }
            />
            <LedgerHeader items={[
              { label: "kcal", value: data.VITALS.kcal.today, of: data.VITALS.kcal.target },
              { label: "protein", value: data.VITALS.protein.today, of: data.VITALS.protein.target, unit: "g" },
            ]} />

            {showAddFoodForm && (
              <form
                onSubmit={handleAddFood}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  padding: "16px 20px",
                  background: "var(--bg)",
                  border: "2px solid #000",
                  marginBottom: 8,
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 92px 92px", gap: 10 }}>
                  <input type="text" required placeholder="Food" value={foodLabel} onChange={(e) => setFoodLabel(e.target.value)} style={compactInputStyle} />
                  <input type="number" placeholder="kcal" value={foodKcal} onChange={(e) => setFoodKcal(e.target.value)} style={compactInputStyle} />
                  <input type="number" placeholder="protein" value={foodProtein} onChange={(e) => setFoodProtein(e.target.value)} style={compactInputStyle} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 90px auto", gap: 10 }}>
                  <select value={foodMeal} onChange={(e) => setFoodMeal(e.target.value)} style={compactInputStyle}>
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="dinner">Dinner</option>
                    <option value="snack">Snack</option>
                  </select>
                  <input type="number" placeholder="cost" value={foodCost} onChange={(e) => setFoodCost(e.target.value)} style={compactInputStyle} />
                  <button type="submit" disabled={foodLoading} style={compactButtonStyle}>
                    {foodLoading ? "Saving" : "Save"}
                  </button>
                </div>
              </form>
            )}

            {data.MEALS.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {data.MEALS.slice(0, showAllFood ? 10 : 3).map((m, i) => (
                  <MealRow key={m.id || i} m={m} onDelete={deleteMeal} />
                ))}

                {data.MEALS.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setShowAllFood(!showAllFood)}
                    style={{
                      marginTop: 10,
                      background: "none",
                      border: "none",
                      color: "var(--blue)",
                      cursor: "pointer",
                      fontSize: 11,
                      fontFamily: "var(--mono)",
                      alignSelf: "flex-start",
                      padding: "4px 0",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      fontWeight: 600,
                    }}
                  >
                    {showAllFood ? "See less" : `See more (last ${Math.min(data.MEALS.length, 10)})`}
                  </button>
                )}
              </div>
            ) : (
              <div className="mono uc" style={{ fontSize: 10.5, color: "var(--dim)", padding: "16px 0", letterSpacing: "0.14em" }}>
                No food logged for this day
              </div>
            )}
          </div>
          </div>
        </div>
      </main>
    </div>
  );
}
