import { WORKOUT_CATEGORIES, type WorkoutCategory, type WorkoutExerciseInput } from "@/lib/types";

export type NormalizedWorkoutSet = {
  id?: string;
  exercise_name: string;
  set_number: number;
  reps: number;
  weight_kg: number;
  notes: string;
};

function numberValue(value: number | string | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function normalizeWorkoutExercises(exercises: WorkoutExerciseInput[]): NormalizedWorkoutSet[] {
  return exercises.flatMap((exercise) => {
    const name = exercise.name?.trim();
    if (!name) return [];
    const sourceSets = Array.isArray(exercise.sets) && exercise.sets.length > 0
      ? exercise.sets
      : [{ reps: exercise.reps, weight_kg: exercise.weight_kg, notes: exercise.notes }];

    return sourceSets.map((set, index) => ({
      id: typeof set.id === "string" ? set.id : undefined,
      exercise_name: name.slice(0, 200),
      set_number: index + 1,
      reps: Math.max(0, Math.trunc(numberValue(set.reps))),
      weight_kg: Math.max(0, numberValue(set.weight_kg)),
      notes: (set.notes || exercise.notes || "").trim().slice(0, 500),
    }));
  });
}

export function isWorkoutCategory(value: unknown): value is WorkoutCategory {
  return typeof value === "string" && (WORKOUT_CATEGORIES as readonly string[]).includes(value);
}

export function normalizeWorkoutCategory(value: unknown): WorkoutCategory | undefined {
  if (isWorkoutCategory(value)) return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLocaleLowerCase("en");
  return WORKOUT_CATEGORIES.find((category) => category.toLocaleLowerCase("en") === normalized);
}

export function exerciseKey(value: string): string {
  return value.trim().toLocaleLowerCase("en").split(" ").filter(Boolean).join(" ");
}
