type RawWorkoutSet = {
  reps?: number | string | null;
  weight_kg?: number | string | null;
  notes?: string | null;
};

export type RawWorkoutExercise = {
  name?: string | null;
  sets?: RawWorkoutSet[] | null;
  reps?: number | string | null;
  weight_kg?: number | string | null;
  notes?: string | null;
};

export type NormalizedWorkoutSet = {
  exercise_name: string;
  set_number: number;
  reps: number;
  weight_kg: number;
  notes: string;
};

export type WorkoutExerciseSummary = {
  name: string;
  setCount: number;
  hasSpecifiedReps: boolean;
};

function toNumber(value: number | string | null | undefined, fallback = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export function normalizeWorkoutExercises(exercises: RawWorkoutExercise[]): NormalizedWorkoutSet[] {
  return exercises.flatMap((exercise) => {
    const name = exercise.name?.trim();
    if (!name) return [];

    const sourceSets = Array.isArray(exercise.sets) && exercise.sets.length > 0
      ? exercise.sets
      : [
          {
            reps: exercise.reps,
            weight_kg: exercise.weight_kg,
            notes: exercise.notes,
          },
        ];

    return sourceSets.map((set, index) => ({
      exercise_name: name,
      set_number: index + 1,
      reps: Math.max(0, Math.trunc(toNumber(set.reps))),
      weight_kg: Math.max(0, toNumber(set.weight_kg)),
      notes: set.notes?.trim() || exercise.notes?.trim() || "",
    }));
  });
}

export function summarizeWorkoutExercises(exercises: RawWorkoutExercise[]): string {
  const summaries = exercises
    .map((exercise): WorkoutExerciseSummary | null => {
      const name = exercise.name?.trim();
      if (!name) return null;
      const rows = normalizeWorkoutExercises([exercise]);
      if (rows.length === 0) return null;
      return {
        name,
        setCount: rows.length,
        hasSpecifiedReps: rows.some((row) => row.reps > 0),
      };
    })
    .filter((summary): summary is WorkoutExerciseSummary => summary !== null);

  return summaries
    .map((summary) => {
      if (!summary.hasSpecifiedReps) return `${summary.name} (no reps recorded)`;
      return `${summary.name} (${summary.setCount} ${summary.setCount === 1 ? "set" : "sets"})`;
    })
    .join(", ");
}
