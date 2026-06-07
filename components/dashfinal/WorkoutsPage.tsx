"use client";

import { useEffect, useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { PageHeader, LoadingPage, Eyebrow, localIsoDate, BROWN_LINE, DateNavigator } from "./DashFinal";

type ExerciseSet = {
  id: string;
  exercise_name: string;
  set_number: number;
  reps: number;
  weight_kg: number;
  notes: string;
};

type Workout = {
  id: string;
  occurred_date: string;
  created_at: string;
  workout_exercises: ExerciseSet[];
};

type ExerciseGroup = {
  name: string;
  sets: ExerciseSet[];
};

function groupExercises(sets: ExerciseSet[]): ExerciseGroup[] {
  const order: string[] = [];
  const map: Record<string, ExerciseSet[]> = {};
  for (const s of [...sets].sort((a, b) => a.set_number - b.set_number)) {
    if (!map[s.exercise_name]) {
      map[s.exercise_name] = [];
      order.push(s.exercise_name);
    }
    map[s.exercise_name].push(s);
  }
  return order.map((name) => ({ name, sets: map[name] }));
}

export default function WorkoutsPage() {
  const [date, setDate] = useState(() => localIsoDate());
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [viewDate, setViewDate] = useState(() => new Date(date));
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);

  // Form State for logging new workout
  const [configuredExercises, setConfiguredExercises] = useState<{
    name: string;
    sets: { reps: number; weight_kg: number }[];
  }[]>([]);
  const [currentExerciseName, setCurrentExerciseName] = useState("");
  const [currentSets, setCurrentSets] = useState<{ reps: number; weight_kg: number }[]>([]);
  const [repsInput, setRepsInput] = useState("10");
  const [weightInput, setWeightInput] = useState("60");

  // Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [editExercises, setEditExercises] = useState<{
    name: string;
    sets: { reps: number; weight_kg: number }[];
  }[]>([]);

  // Reset editing mode on change
  useEffect(() => {
    setIsEditing(false);
  }, [selectedWorkoutId, date]);

  const startEditing = () => {
    if (!selectedWorkout) return;
    const groups = groupExercises(selectedWorkout.workout_exercises);
    const initialEdit = groups.map((g) => ({
      name: g.name,
      sets: g.sets.map((s) => ({ reps: s.reps, weight_kg: s.weight_kg })),
    }));
    setEditExercises(initialEdit);
    setEditDate(selectedWorkout.occurred_date);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (editExercises.length === 0) {
      showNotice("error", "Workout must have at least one exercise.");
      return;
    }
    for (let i = 0; i < editExercises.length; i++) {
      const ex = editExercises[i];
      if (!ex.name.trim()) {
        showNotice("error", `Exercise #${i + 1} must have a name.`);
        return;
      }
      if (ex.sets.length === 0) {
        showNotice("error", `Exercise "${ex.name}" must have at least one set.`);
        return;
      }
      for (let j = 0; j < ex.sets.length; j++) {
        const s = ex.sets[j];
        if (isNaN(s.reps) || s.reps <= 0) {
          showNotice("error", `Reps for set #${j + 1} in exercise "${ex.name}" must be a positive integer.`);
          return;
        }
        if (isNaN(s.weight_kg) || s.weight_kg < 0) {
          showNotice("error", `Weight for set #${j + 1} in exercise "${ex.name}" must be 0 or greater.`);
          return;
        }
      }
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/workouts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedWorkoutId,
          exercises: editExercises,
          date: editDate,
        }),
      });

      if (res.ok) {
        showNotice("success", "Workout session updated successfully!");
        setIsEditing(false);
        setDate(editDate);
        await loadWorkouts();
      } else {
        const err = await res.json();
        showNotice("error", err.error || "Failed to update workout session.");
      }
    } catch (err) {
      console.error(err);
      showNotice("error", "Failed to update workout session.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCombineWorkouts = async () => {
    const workoutIds = dayWorkouts.map((w) => w.id);
    if (!confirm(`Are you sure you want to combine all ${dayWorkouts.length} workout sessions for today into one?`)) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch("/api/workouts/combine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workoutIds }),
      });

      if (res.ok) {
        const resData = await res.json();
        showNotice("success", "Workouts successfully combined!");
        await loadWorkouts();
        if (resData.primary_workout_id) {
          setSelectedWorkoutId(resData.primary_workout_id);
        }
      } else {
        const err = await res.json();
        showNotice("error", err.error || "Failed to combine workout sessions.");
      }
    } catch (err) {
      console.error(err);
      showNotice("error", "Failed to combine workout sessions.");
    } finally {
      setActionLoading(false);
    }
  };

  // Sync calendar view when date changes
  useEffect(() => {
    setViewDate(new Date(date));
  }, [date]);


  // Load workouts
  const loadWorkouts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/workouts");
      if (res.ok) {
        const data = await res.json();
        setWorkouts(data.workouts || []);
      }
    } catch (err) {
      console.error("Failed to load workouts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkouts();
  }, []);

  // Sync selectedWorkoutId when date, workouts, or selectedWorkoutId changes
  useEffect(() => {
    if (workouts.length === 0) {
      setSelectedWorkoutId(null);
      return;
    }

    const currentSelected = workouts.find((w) => w.id === selectedWorkoutId);
    if (currentSelected && currentSelected.occurred_date === date) {
      return;
    }

    const dayWorkoutsForDate = workouts.filter((w) => w.occurred_date === date);
    if (dayWorkoutsForDate.length > 0) {
      setSelectedWorkoutId(dayWorkoutsForDate[0].id);
    } else {
      setSelectedWorkoutId(null);
    }
  }, [date, workouts, selectedWorkoutId]);

  // Show temporary notification helper
  const showNotice = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Find workouts for the selected date
  const dayWorkouts = useMemo(() => {
    return workouts.filter((w) => w.occurred_date === date);
  }, [workouts, date]);

  // Find workout by selected ID
  const selectedWorkout = useMemo(() => {
    if (!selectedWorkoutId) return null;
    return workouts.find((w) => w.id === selectedWorkoutId) || null;
  }, [workouts, selectedWorkoutId]);

  // Set of workout dates for the calendar dots
  const workoutDates = useMemo(() => {
    return new Set(workouts.map((w) => w.occurred_date));
  }, [workouts]);

  // Recent 5 workouts
  const recentWorkouts = useMemo(() => {
    return [...workouts]
      .sort((a, b) => b.occurred_date.localeCompare(a.occurred_date))
      .slice(0, 5);
  }, [workouts]);

  // Calendar logic
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = firstDay.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const result: { isoStr: string; isCurrentMonth: boolean; dayNum: number }[] = [];

    // Prepend previous month days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      result.push({
        isoStr: localIsoDate(d),
        isCurrentMonth: false,
        dayNum: daysInPrevMonth - i,
      });
    }

    // Add current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      result.push({
        isoStr: localIsoDate(d),
        isCurrentMonth: true,
        dayNum: i,
      });
    }

    // Pad next month days to multiples of 7
    const totalCells = Math.ceil(result.length / 7) * 7;
    const padDays = totalCells - result.length;
    for (let i = 1; i <= padDays; i++) {
      const d = new Date(year, month + 1, i);
      result.push({
        isoStr: localIsoDate(d),
        isCurrentMonth: false,
        dayNum: i,
      });
    }

    // Keep grid height stable at exactly 6 rows (42 cells)
    while (result.length < 42) {
      const nextDayIdx = result.length - startDayOfWeek - daysInMonth + 1;
      const d = new Date(year, month + 1, nextDayIdx);
      result.push({
        isoStr: localIsoDate(d),
        isCurrentMonth: false,
        dayNum: nextDayIdx,
      });
    }

    return result;
  }, [year, month]);

  // Handlers
  const handleAddSet = (e: React.FormEvent) => {
    e.preventDefault();
    const reps = parseInt(repsInput, 10);
    const weight = parseFloat(weightInput);

    if (isNaN(reps) || reps <= 0) {
      showNotice("error", "Reps must be a positive integer.");
      return;
    }
    if (isNaN(weight) || weight < 0) {
      showNotice("error", "Weight must be 0 or greater.");
      return;
    }

    setCurrentSets((prev) => [...prev, { reps, weight_kg: weight }]);
    showNotice("success", `Added set: ${reps} × ${weight} kg`);
  };

  const handleAddExercise = () => {
    if (!currentExerciseName.trim()) {
      showNotice("error", "Please enter an exercise name.");
      return;
    }
    if (currentSets.length === 0) {
      showNotice("error", "Please add at least one set before adding the exercise.");
      return;
    }

    setConfiguredExercises((prev) => [
      ...prev,
      { name: currentExerciseName.trim(), sets: currentSets },
    ]);
    setCurrentExerciseName("");
    setCurrentSets([]);
    showNotice("success", `Added ${currentExerciseName} to current workout checklist.`);
  };

  const handleRemoveConfiguredExercise = (index: number) => {
    setConfiguredExercises((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveCurrentSet = (index: number) => {
    setCurrentSets((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveWorkout = async () => {
    setActionLoading(true);
    let finalExercises = [...configuredExercises];

    // If there is an exercise in progress, auto-include it to prevent data loss
    if (currentExerciseName.trim() && currentSets.length > 0) {
      finalExercises.push({ name: currentExerciseName.trim(), sets: currentSets });
    }

    if (finalExercises.length === 0) {
      showNotice("error", "Add at least one exercise and set before saving.");
      setActionLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: date,
          exercises: finalExercises,
        }),
      });

      if (res.ok) {
        const resData = await res.json();
        showNotice("success", "Workout session saved successfully!");
        setConfiguredExercises([]);
        setCurrentExerciseName("");
        setCurrentSets([]);
        await loadWorkouts();
        if (resData.workout_id) {
          setSelectedWorkoutId(resData.workout_id);
        }
      } else {
        const err = await res.json();
        showNotice("error", err.error || "Failed to save workout session.");
      }
    } catch (err) {
      console.error(err);
      showNotice("error", "Failed to save workout session.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteWorkout = async (workoutId: string) => {
    if (!confirm("Are you sure you want to delete this workout session? This cannot be undone.")) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch("/api/workouts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: workoutId }),
      });

      if (res.ok) {
        setSelectedWorkoutId(null);
        showNotice("success", "Workout session deleted.");
        await loadWorkouts();
      } else {
        const err = await res.json();
        showNotice("error", err.error || "Failed to delete workout session.");
      }
    } catch (err) {
      console.error(err);
      showNotice("error", "Failed to delete workout session.");
    } finally {
      setActionLoading(false);
    }
  };

  const formattedSelectedDate = useMemo(() => {
    try {
      return format(new Date(`${date}T12:00:00`), "EEEE, MMMM d, yyyy");
    } catch (e) {
      return date;
    }
  }, [date]);

  if (loading && workouts.length === 0) {
    return <LoadingPage />;
  }

  return (
    <div style={{ height: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <PageHeader active="workouts" data={null} />

      {/* Notification Toast */}
      {notification && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: notification.type === "success" ? "var(--bg-2)" : "#fdf2f2",
            border: `1px solid ${notification.type === "success" ? "var(--blue)" : "var(--rose)"}`,
            borderRadius: 8,
            padding: "12px 20px",
            color: notification.type === "success" ? "var(--text)" : "var(--rose)",
            zIndex: 1000,
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
            fontFamily: "var(--mono)",
            fontSize: 12.5,
            display: "flex",
            alignItems: "center",
            gap: 10,
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: notification.type === "success" ? "var(--blue)" : "var(--rose)",
            }}
          />
          {notification.message}
        </div>
      )}

      <main style={{ padding: "32px", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 360px", gap: 28, height: "100%", maxWidth: 1180, margin: "0 auto" }}>
        {/* Left Panel: Workout Details or Log Form */}
        <div
          className="grid-card"
          style={{
            padding: "24px 28px",
            display: "flex",
            flexDirection: "column",
            gap: 22,
            minHeight: 0,
            overflowY: "auto",
          }}
        >
          <div className="zine-paperclip" />
          {/* Section Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 18,
            }}
          >
            <div>
              <div className="zine-eyebrow blue">
                <span>↳ workouts</span>
                <span>01</span>
              </div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "var(--text)" }}>
                {formattedSelectedDate}
              </h1>
              <div
                className="mono uc"
                style={{
                  fontSize: 10,
                  color: selectedWorkout ? "var(--blue)" : "var(--muted)",
                  letterSpacing: "0.18em",
                  marginTop: 4,
                }}
              >
                {selectedWorkout ? "WORKOUT RECORDED" : "NO WORKOUT LOGGED"}
              </div>

              {/* Session Selector Tabs */}
              {dayWorkouts.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                  {dayWorkouts.map((w, index) => {
                    const isActive = w.id === selectedWorkoutId;
                    let timeLabel = `Session ${dayWorkouts.length - index}`;
                    if (w.created_at) {
                      try {
                        timeLabel = format(parseISO(w.created_at), "h:mm a");
                      } catch (e) {}
                    }
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => setSelectedWorkoutId(w.id)}
                        style={{
                          background: isActive ? "var(--blue)" : "var(--bg-2)",
                          color: isActive ? "#fffaf0" : "var(--text)",
                          border: `1px solid ${isActive ? "var(--blue)" : "var(--line)"}`,
                          borderRadius: 6,
                          padding: "6px 12px",
                          fontSize: 11,
                          fontFamily: "var(--mono)",
                          cursor: "pointer",
                          transition: "background 0.2s, color 0.2s",
                        }}
                      >
                        {timeLabel}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setSelectedWorkoutId(null)}
                    style={{
                      background: !selectedWorkoutId ? "var(--blue)" : "transparent",
                      color: !selectedWorkoutId ? "#fffaf0" : "var(--blue)",
                      border: `1px dashed var(--blue)`,
                      borderRadius: 6,
                      padding: "6px 12px",
                      fontSize: 11,
                      fontFamily: "var(--mono)",
                      cursor: "pointer",
                      transition: "background 0.2s, color 0.2s",
                    }}
                  >
                    + Log New Session
                  </button>

                  {dayWorkouts.length > 1 && (
                    <button
                      type="button"
                      onClick={handleCombineWorkouts}
                      style={{
                        background: "transparent",
                        color: "var(--rose)",
                        border: `1px dashed var(--rose)`,
                        borderRadius: 6,
                        padding: "6px 12px",
                        fontSize: 11,
                        fontFamily: "var(--mono)",
                        cursor: "pointer",
                        transition: "background 0.2s, color 0.2s",
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = "rgba(178, 68, 68, 0.05)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      ⧉ Combine {dayWorkouts.length} Sessions
                    </button>
                  )}
                </div>
              )}
            </div>
            <DateNavigator selectedDate={date} onChange={setDate} compact />
          </div>

          {actionLoading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "40px 0", color: "var(--muted)" }}>
              <span className="mono" style={{ fontSize: 13 }}>Processing...</span>
            </div>
          ) : selectedWorkout ? (
            isEditing ? (
              /* EDIT WORKOUT DETAILS */
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div>
                  <Eyebrow label="Edit Workout Playlist" color="var(--blue)" />
                  
                  {/* Workout Date input */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
                    <label className="mono uc" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em" }}>
                      Workout Date
                    </label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 6,
                        border: "1px solid var(--line-strong)",
                        background: "var(--card)",
                        color: "var(--text)",
                        fontSize: 14,
                        outline: "none",
                        fontFamily: "var(--mono)",
                        width: "100%",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 12 }}>
                    {editExercises.map((ex, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: "20px",
                          background: "var(--bg-2)",
                          border: "1px solid var(--line)",
                          borderRadius: 8,
                          display: "flex",
                          flexDirection: "column",
                          gap: 16,
                          position: "relative",
                        }}
                      >
                        {/* Exercise Header */}
                        <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
                          <input
                            type="text"
                            placeholder="Exercise Name"
                            value={ex.name}
                            onChange={(e) => {
                              const updated = [...editExercises];
                              updated[idx].name = e.target.value;
                              setEditExercises(updated);
                            }}
                            style={{
                              padding: "8px 12px",
                              borderRadius: 6,
                              border: "1px solid var(--line-strong)",
                              background: "var(--card)",
                              color: "var(--text)",
                              fontSize: 15,
                              fontWeight: 500,
                              fontFamily: "var(--sans)",
                              outline: "none",
                              flex: 1,
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setEditExercises(editExercises.filter((_, i) => i !== idx));
                            }}
                            style={{
                              background: "none",
                              border: "1px solid var(--rose)",
                              color: "var(--rose)",
                              borderRadius: 6,
                              padding: "6px 12px",
                              fontSize: 11,
                              fontFamily: "var(--mono)",
                              cursor: "pointer",
                              textTransform: "uppercase",
                              letterSpacing: "0.08em",
                              transition: "background 0.2s",
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.background = "rgba(178, 68, 68, 0.08)";
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.background = "none";
                            }}
                          >
                            Delete
                          </button>
                        </div>

                        {/* Sets List */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {ex.sets.map((set, setIdx) => (
                            <div key={setIdx} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <span className="mono uc" style={{ fontSize: 9, color: "var(--muted)", width: 44, flexShrink: 0 }}>
                                Set {setIdx + 1}
                              </span>

                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <input
                                  type="number"
                                  placeholder="Reps"
                                  value={set.reps}
                                  onChange={(e) => {
                                    const updated = [...editExercises];
                                    updated[idx].sets[setIdx].reps = parseInt(e.target.value, 10) || 0;
                                    setEditExercises(updated);
                                  }}
                                  style={{
                                    width: 60,
                                    padding: "6px 8px",
                                    borderRadius: 4,
                                    border: "1px solid var(--line-strong)",
                                    background: "var(--card)",
                                    color: "var(--text)",
                                    fontSize: 13,
                                    fontFamily: "var(--mono)",
                                    outline: "none",
                                    textAlign: "center",
                                  }}
                                />
                                <span style={{ fontSize: 11, color: "var(--dim)" }}>reps</span>
                              </div>

                              <span style={{ fontSize: 11, color: "var(--dim)" }}>×</span>

                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <input
                                  type="number"
                                  step="0.5"
                                  placeholder="Weight"
                                  value={set.weight_kg}
                                  onChange={(e) => {
                                    const updated = [...editExercises];
                                    updated[idx].sets[setIdx].weight_kg = parseFloat(e.target.value) || 0;
                                    setEditExercises(updated);
                                  }}
                                  style={{
                                    width: 70,
                                    padding: "6px 8px",
                                    borderRadius: 4,
                                    border: "1px solid var(--line-strong)",
                                    background: "var(--card)",
                                    color: "var(--text)",
                                    fontSize: 13,
                                    fontFamily: "var(--mono)",
                                    outline: "none",
                                    textAlign: "center",
                                  }}
                                />
                                <span style={{ fontSize: 11, color: "var(--dim)" }}>kg</span>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...editExercises];
                                  updated[idx].sets = updated[idx].sets.filter((_, sIdx) => sIdx !== setIdx);
                                  setEditExercises(updated);
                                }}
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  color: "var(--rose)",
                                  fontSize: 18,
                                  padding: "0 6px",
                                }}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Add Set Button */}
                        <div>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...editExercises];
                              const lastSet = ex.sets[ex.sets.length - 1] || { reps: 10, weight_kg: 60 };
                              updated[idx].sets.push({ reps: lastSet.reps, weight_kg: lastSet.weight_kg });
                              setEditExercises(updated);
                            }}
                            style={{
                              background: "none",
                              border: "1px solid var(--blue)",
                              color: "var(--blue)",
                              borderRadius: 6,
                              padding: "4px 10px",
                              fontSize: 10,
                              fontFamily: "var(--mono)",
                              cursor: "pointer",
                              textTransform: "uppercase",
                              letterSpacing: "0.08em",
                            }}
                          >
                            + Add Set
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add New Exercise Button */}
                  <div style={{ marginTop: 16 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditExercises([...editExercises, { name: "", sets: [{ reps: 10, weight_kg: 60 }] }]);
                      }}
                      style={{
                        width: "100%",
                        background: "transparent",
                        color: "var(--blue)",
                        border: "1px dashed var(--blue)",
                        borderRadius: 8,
                        padding: "12px",
                        cursor: "pointer",
                        fontSize: 12,
                        fontFamily: "var(--mono)",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}
                    >
                      + Add New Exercise
                    </button>
                  </div>
                </div>

                {/* Save / Cancel Controls */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12, borderTop: `1px solid ${BROWN_LINE}`, paddingTop: 20 }}>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    style={{
                      background: "var(--blue)",
                      color: "#fffaf0",
                      border: "none",
                      padding: "12px 20px",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: "var(--mono)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      textAlign: "center",
                    }}
                  >
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    style={{
                      background: "transparent",
                      border: "1px solid var(--line-strong)",
                      color: "var(--muted)",
                      padding: "12px 20px",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: "var(--mono)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      textAlign: "center",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* VIEW WORKOUT DETAILS */
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div>
                  <Eyebrow label="Logged Exercises" color="var(--blue)" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 12 }}>
                    {groupExercises(selectedWorkout.workout_exercises).map((group, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: "16px 20px",
                          background: "var(--bg-2)",
                          border: "1px solid var(--line)",
                          borderRadius: 8,
                        }}
                      >
                        <h3
                          style={{
                            margin: "0 0 12px 0",
                            fontSize: 16,
                            fontWeight: 500,
                            color: "var(--text)",
                            fontFamily: "var(--sans)",
                            letterSpacing: "0.02em",
                          }}
                        >
                          {group.name}
                        </h3>

                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {group.sets.map((set) => (
                            <div
                              key={set.id}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "6px 12px",
                                border: "1px solid var(--line-strong)",
                                background: "var(--card)",
                                borderRadius: 6,
                                fontSize: 12.5,
                                fontFamily: "var(--mono)",
                                color: "var(--text)",
                              }}
                            >
                              <span style={{ color: "var(--muted)", fontSize: 10 }}>SET {set.set_number}</span>
                              <span style={{ fontWeight: 600, color: "var(--blue)" }}>{set.reps}</span>
                              <span style={{ color: "var(--dim)" }}>×</span>
                              <span>{set.weight_kg > 0 ? `${set.weight_kg} kg` : "BW"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12, marginTop: 12, borderTop: `1px solid ${BROWN_LINE}`, paddingTop: 20 }}>
                  <button
                    type="button"
                    onClick={startEditing}
                    style={{
                      background: "var(--blue)",
                      color: "#fffaf0",
                      border: "none",
                      padding: "10px 18px",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontFamily: "var(--mono)",
                      fontSize: 12,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      fontWeight: 500,
                      transition: "background 0.2s, color 0.2s",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.filter = "brightness(1.1)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.filter = "none";
                    }}
                  >
                    Edit Workout
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteWorkout(selectedWorkout.id)}
                    style={{
                      background: "transparent",
                      border: "1px solid var(--rose)",
                      color: "var(--rose)",
                      padding: "10px 18px",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontFamily: "var(--mono)",
                      fontSize: 12,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      fontWeight: 500,
                      transition: "background 0.2s, color 0.2s",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = "rgba(178, 68, 68, 0.08)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    Delete Workout Session
                  </button>
                </div>
              </div>
            )
          ) : (
            /* LOG WORKOUT FORM */
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {/* Form Configured So Far */}
              {configuredExercises.length > 0 && (
                <div>
                  <Eyebrow label="Workout Playlist" color="var(--blue)" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                    {configuredExercises.map((ex, index) => (
                      <div
                        key={index}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 16px",
                          background: "var(--bg-2)",
                          border: "1px dashed var(--line-strong)",
                          borderRadius: 8,
                        }}
                      >
                        <div>
                          <span style={{ fontFamily: "var(--sans)", fontWeight: 500, color: "var(--text)", marginRight: 12 }}>
                            {ex.name}
                          </span>
                          <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>
                            {ex.sets.length} {ex.sets.length === 1 ? "set" : "sets"}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveConfiguredExercise(index)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--rose)",
                            fontSize: 16,
                            padding: "4px 8px",
                          }}
                          title="Remove Exercise"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Configure Active Exercise Form */}
              <div
                style={{
                  border: "1px solid var(--line-strong)",
                  borderRadius: 12,
                  padding: 24,
                  background: "linear-gradient(180deg, rgba(36,84,214,0.02), transparent)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 18,
                }}
              >
                <div className="mono uc" style={{ fontSize: 11, color: "var(--blue)", letterSpacing: "0.14em", fontWeight: 600 }}>
                  Add Exercise Detail
                </div>

                {/* Exercise Name Input */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label className="mono uc" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em" }}>
                    Exercise Name
                  </label>
                  <input
                    type="text"
                    value={currentExerciseName}
                    onChange={(e) => setCurrentExerciseName(e.target.value)}
                    placeholder="e.g., Bench Press, Squats, Pullups"
                    style={{
                      padding: "10px 14px",
                      borderRadius: 6,
                      border: "1px solid var(--line-strong)",
                      background: "var(--card)",
                      color: "var(--text)",
                      fontSize: 14,
                      outline: "none",
                    }}
                  />
                </div>

                {/* Reps & Weight Inputs */}
                <form onSubmit={handleAddSet} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "flex-end" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label className="mono uc" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em" }}>
                      Reps
                    </label>
                    <input
                      type="number"
                      value={repsInput}
                      onChange={(e) => setRepsInput(e.target.value)}
                      min="1"
                      style={{
                        padding: "10px 14px",
                        borderRadius: 6,
                        border: "1px solid var(--line-strong)",
                        background: "var(--card)",
                        color: "var(--text)",
                        fontSize: 14,
                        outline: "none",
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label className="mono uc" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em" }}>
                      Weight (kg)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={weightInput}
                      onChange={(e) => setWeightInput(e.target.value)}
                      min="0"
                      style={{
                        padding: "10px 14px",
                        borderRadius: 6,
                        border: "1px solid var(--line-strong)",
                        background: "var(--card)",
                        color: "var(--text)",
                        fontSize: 14,
                        outline: "none",
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    style={{
                      background: "var(--text)",
                      color: "var(--bg)",
                      border: "none",
                      padding: "11px 18px",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: "var(--mono)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      height: 42,
                    }}
                  >
                    Add Set
                  </button>
                </form>

                {/* Active Sets Checklist */}
                {currentSets.length > 0 && (
                  <div style={{ borderTop: "1px dashed var(--line)", paddingTop: 14 }}>
                    <div className="mono uc" style={{ fontSize: 9.5, color: "var(--muted)", letterSpacing: "0.1em", marginBottom: 8 }}>
                      Sets added to this exercise ({currentExerciseName || "Unnamed"}):
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {currentSets.map((s, i) => (
                        <div
                          key={i}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            background: "var(--bg-2)",
                            border: "1px solid var(--line)",
                            borderRadius: 6,
                            padding: "4px 8px",
                            fontSize: 11.5,
                            fontFamily: "var(--mono)",
                            color: "var(--text)",
                          }}
                        >
                          <span>{s.reps} × {s.weight_kg}kg</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCurrentSet(i)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "var(--rose)",
                              fontSize: 12,
                              padding: "0 2px",
                              lineHeight: 1,
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: 14 }}>
                      <button
                        type="button"
                        onClick={handleAddExercise}
                        style={{
                          background: "transparent",
                          border: "1px solid var(--blue)",
                          color: "var(--blue)",
                          padding: "6px 12px",
                          borderRadius: 6,
                          cursor: "pointer",
                          fontSize: 11,
                          fontWeight: 600,
                          fontFamily: "var(--mono)",
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        Add Exercise to Playlist
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Save Button */}
              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  onClick={handleSaveWorkout}
                  style={{
                    width: "100%",
                    background: "var(--blue)",
                    color: "#fffaf0",
                    border: "none",
                    padding: "14px 20px",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: "var(--mono)",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    boxShadow: "0 2px 8px rgba(36,84,214,0.15)",
                    transition: "transform 0.1s, opacity 0.1s",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.opacity = "0.9";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.opacity = "1";
                  }}
                >
                  Save Workout Session
                </button>
                {(configuredExercises.length > 0 || (currentExerciseName.trim() && currentSets.length > 0)) && (
                  <div className="mono" style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", marginTop: 8 }}>
                    Will save {configuredExercises.length + (currentExerciseName.trim() && currentSets.length > 0 ? 1 : 0)} exercise(s)
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Calendar Picker & Log Summaries */}
        <div
          className="grid-card"
          style={{
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: 18,
            minHeight: 0,
          }}
        >
          <div className="zine-paperclip" />

          {/* Recent Workouts List */}
          <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div className="zine-eyebrow blue">
              <span>↳ recent sessions</span>
              <span>02</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 2, overflowY: "auto", minHeight: 0 }}>
              {recentWorkouts.length > 0 ? (
                recentWorkouts.map((w) => {
                  const isSelected = w.id === selectedWorkoutId;
                  const dateString = format(parseISO(w.occurred_date), "MMM d, yyyy");
                  const numExercises = groupExercises(w.workout_exercises).length;
                  const numSets = w.workout_exercises.length;

                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => {
                        setDate(w.occurred_date);
                        setSelectedWorkoutId(w.id);
                      }}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        width: "100%",
                        padding: "12px 14px",
                        background: isSelected ? "var(--bg-2)" : "transparent",
                        border: `2px solid ${isSelected ? "#000" : "var(--line)"}`,
                        borderRadius: 0,
                        cursor: "pointer",
                        textAlign: "left",
                        gap: 4,
                        transition: "background 0.2s, border-color 0.2s",
                      }}
                      onMouseOver={(e) => {
                        if (!isSelected) e.currentTarget.style.background = "var(--bg-2)";
                      }}
                      onMouseOut={(e) => {
                        if (!isSelected) e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "var(--sans)",
                          fontSize: 13.5,
                          fontWeight: 500,
                          color: "var(--text)",
                          display: "flex",
                          justifyContent: "space-between",
                          width: "100%",
                        }}
                      >
                        <span>{dateString}</span>
                        {w.occurred_date === localIsoDate() && (
                          <span
                            className="mono uc"
                            style={{
                              fontSize: 9,
                              color: "var(--blue)",
                              fontWeight: 600,
                              letterSpacing: "0.08em",
                            }}
                          >
                            TODAY
                          </span>
                        )}
                      </div>
                      <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
                        {numExercises} {numExercises === 1 ? "exercise" : "exercises"} · {numSets} {numSets === 1 ? "set" : "sets"}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="mono uc" style={{ fontSize: 10.5, color: "var(--dim)", padding: "12px 0", letterSpacing: "0.14em" }}>
                  No recent workouts logged
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
