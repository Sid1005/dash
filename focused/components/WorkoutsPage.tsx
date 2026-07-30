"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DateCalendar } from "@/components/DateCalendar";
import { QueryBox } from "@/components/QueryBox";
import { formatDateLong } from "@/lib/time";
import { WORKOUT_CATEGORIES, type WorkoutCategory, type WorkoutSession, type WorkoutSet } from "@/lib/types";

type DraftSet = { key: string; id?: string; reps: string; weight: string; notes: string };
type DraftExercise = { key: string; name: string; sets: DraftSet[] };

function today() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function emptyExercise(exerciseKey = "exercise-0", setKey = "set-0"): DraftExercise {
  return { key: exerciseKey, name: "", sets: [{ key: setKey, reps: "", weight: "", notes: "" }] };
}

function groupSets(sets: WorkoutSet[]) {
  const groups = new Map<string, WorkoutSet[]>();
  for (const set of sets) groups.set(set.exercise_name, [...(groups.get(set.exercise_name) ?? []), set]);
  return Array.from(groups, ([name, values]) => ({ name, sets: values.sort((left, right) => left.set_number - right.set_number) }));
}

function setText(set: WorkoutSet) {
  if (set.reps > 0 && set.weight_kg > 0) return `${set.reps} × ${set.weight_kg} kg`;
  if (set.reps > 0) return `${set.reps} reps`;
  if (set.weight_kg > 0) return `${set.weight_kg} kg`;
  return "recorded";
}

const WORKOUT_QUERY_EXAMPLES = ["last bicep workout", "chest workout from 23rd to 30th June"];

export function WorkoutsPage() {
  const draftSequence = useRef(1);
  const initialDateResolved = useRef(false);
  const [selectedDate, setSelectedDate] = useState(today);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<WorkoutCategory>("Chest");
  const [exercises, setExercises] = useState<DraftExercise[]>([emptyExercise()]);
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/workouts?limit=500");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Workouts could not be loaded.");
      const nextSessions = body.sessions ?? [];
      setSessions(nextSessions);
      if (!initialDateResolved.current) {
        const todayValue = today();
        if (!nextSessions.some((session: WorkoutSession) => session.occurred_date === todayValue) && nextSessions[0]?.occurred_date) {
          setSelectedDate(nextSessions[0].occurred_date);
        }
        initialDateResolved.current = true;
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Workouts could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const daySessions = useMemo(() => sessions.filter((session) => session.occurred_date === selectedDate), [sessions, selectedDate]);
  const daySetCount = daySessions.reduce((total, session) => total + session.workout_exercises.length, 0);
  const activeDates = useMemo(() => Array.from(new Set(sessions.map((session) => session.occurred_date))), [sessions]);
  const viewingToday = selectedDate === today();

  function nextDraftKey(prefix: string) {
    const value = draftSequence.current;
    draftSequence.current += 1;
    return `${prefix}-${value}`;
  }

  function clearForm() {
    setEditingId(null);
    setTitle("");
    setCategory("Chest");
    setExercises([emptyExercise(nextDraftKey("exercise"), nextDraftKey("set"))]);
    setNotice("");
  }

  function beginEdit(session: WorkoutSession) {
    setEditingId(session.id);
    setSelectedDate(session.occurred_date);
    setTitle(session.title);
    setCategory(session.session_category);
    setExercises(groupSets(session.workout_exercises).map((exercise, exerciseIndex) => ({
      key: `edit-exercise-${session.id}-${exerciseIndex}`,
      name: exercise.name,
      sets: exercise.sets.map((set) => ({ key: set.id, id: set.id, reps: String(set.reps), weight: String(set.weight_kg), notes: set.notes })),
    })));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateExercise(index: number, patch: Partial<DraftExercise>) {
    setExercises((current) => current.map((exercise, exerciseIndex) => exerciseIndex === index ? { ...exercise, ...patch } : exercise));
  }

  function updateSet(exerciseIndex: number, setIndex: number, patch: Partial<DraftSet>) {
    setExercises((current) => current.map((exercise, currentExerciseIndex) => currentExerciseIndex === exerciseIndex
      ? { ...exercise, sets: exercise.sets.map((set, currentSetIndex) => currentSetIndex === setIndex ? { ...set, ...patch } : set) }
      : exercise));
  }

  async function saveWorkout(event: React.FormEvent) {
    event.preventDefault();
    setNotice("");
    const prepared = exercises
      .filter((exercise) => exercise.name.trim())
      .map((exercise) => ({
        name: exercise.name,
        sets: exercise.sets.map((set) => ({
          id: set.id,
          reps: Number(set.reps) || 0,
          weight_kg: Number(set.weight) || 0,
          notes: set.notes,
        })),
      }));
    const response = await fetch(editingId ? `/api/workouts/${editingId}` : "/api/workouts", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        date: selectedDate,
        logged_at: `${selectedDate}T12:00:00+05:30`,
        workout_category: category,
        exercises: prepared,
        force_new: true,
      }),
    });
    const body = await response.json();
    if (!response.ok) return setNotice(body.error ?? "Could not save workout.");
    clearForm();
    await load();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this workout and all of its sets?")) return;
    await fetch(`/api/workouts/${id}`, { method: "DELETE" });
    if (editingId === id) clearForm();
    await load();
  }

  return (
    <AppShell title="Workouts">
      <section className="ledger-header">
        <div className="ledger-heading">
          <span className="section-kicker">Daily ledger</span>
          <div className="day-heading">
            <h1>{formatDateLong(selectedDate)}</h1>
            <div className="heading-metrics" aria-label="Workout summary">
              <div><strong>{daySessions.length}</strong><span>sessions</span></div>
              <div><strong>{daySetCount}</strong><span>{viewingToday ? "sets today" : "sets this day"}</span></div>
            </div>
          </div>
        </div>
        <DateCalendar selectedDate={selectedDate} onChange={setSelectedDate} activeDates={activeDates} />
      </section>

      <div className="workspace-grid workout-grid workout-workspace">
        <section className="panel primary-panel">
          <span className="paperclip" aria-hidden="true" />
          <div className="panel-title-row">
            <div className="panel-label"><span>{viewingToday ? "Workout today" : "Workout on this day"}</span><span>{daySessions.length} sessions</span></div>
          </div>
          <div className="record-list workout-list">
            {loadError && <p className="load-error" role="alert">{loadError}</p>}
            {loading && <p className="empty">Loading…</p>}
            {!loading && daySessions.map((session) => (
              <article className={`workout-card category-${session.session_category.toLocaleLowerCase("en")}`} key={session.id}>
                <div className="workout-card-head">
                  <div><span>{session.session_category}</span><h3>{session.title}</h3></div>
                  <div className="row-actions"><button type="button" onClick={() => beginEdit(session)}>Edit</button><button type="button" onClick={() => void remove(session.id)}>Delete</button></div>
                </div>
                <div className="exercise-list">
                  {groupSets(session.workout_exercises).map((exercise) => <div key={exercise.name}><strong>{exercise.name}</strong><span>{exercise.sets.map(setText).join(" · ")}</span></div>)}
                </div>
              </article>
            ))}
            {!loading && !loadError && daySessions.length === 0 && <p className="empty">No workout on this date. Dates with saved sessions are marked above.</p>}
          </div>
        </section>

        <aside className="side-stack">
          <form className="panel compact-form workout-form" onSubmit={saveWorkout}>
            <span className="paperclip" aria-hidden="true" />
            <div className="panel-label blue"><span>{editingId ? "Edit workout" : "Add workout"}</span><span>+</span></div>
            {editingId && <button type="button" className="text-button cancel-button" onClick={clearForm}>Cancel edit</button>}
            <div className="form-grid two"><label>Title<input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Chest strength" /></label><label>Category<select value={category} onChange={(event) => setCategory(event.target.value as WorkoutCategory)}>{WORKOUT_CATEGORIES.map((value) => <option key={value}>{value}</option>)}</select></label></div>
            <div className="exercise-editor">
              {exercises.map((exercise, exerciseIndex) => (
                <div className="exercise-editor-card" key={exercise.key}>
                  <div className="exercise-name-row"><input required value={exercise.name} onChange={(event) => updateExercise(exerciseIndex, { name: event.target.value })} placeholder="Exercise" /><button type="button" onClick={() => setExercises((current) => current.filter((_, index) => index !== exerciseIndex))}>×</button></div>
                  {exercise.sets.map((set, setIndex) => (
                    <div className="set-editor-row" key={set.key}>
                      <span>{setIndex + 1}</span>
                      <input type="number" min="0" value={set.reps} onChange={(event) => updateSet(exerciseIndex, setIndex, { reps: event.target.value })} placeholder="reps" aria-label={`Set ${setIndex + 1} reps`} />
                      <input type="number" min="0" step="0.25" value={set.weight} onChange={(event) => updateSet(exerciseIndex, setIndex, { weight: event.target.value })} placeholder="kg" aria-label={`Set ${setIndex + 1} kilograms`} />
                      <button type="button" onClick={() => updateExercise(exerciseIndex, { sets: exercise.sets.filter((_, index) => index !== setIndex) })}>×</button>
                    </div>
                  ))}
                  <button type="button" className="add-line-button" onClick={() => updateExercise(exerciseIndex, { sets: [...exercise.sets, { key: nextDraftKey("set"), reps: "", weight: "", notes: "" }] })}>+ Set</button>
                </div>
              ))}
            </div>
            <button type="button" className="secondary-button" onClick={() => setExercises((current) => [...current, emptyExercise(nextDraftKey("exercise"), nextDraftKey("set"))])}>+ Exercise</button>
            <button className="primary-button">{editingId ? "Save changes" : "Add workout"}</button>
            {notice && <p className="form-notice">{notice}</p>}
          </form>
          <QueryBox domain="workout" placeholder="Query a workout" examples={WORKOUT_QUERY_EXAMPLES} />
        </aside>
      </div>
    </AppShell>
  );
}
