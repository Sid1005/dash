import { describe, expect, it } from "vitest";
import { normalizeWorkoutExercises, summarizeWorkoutExercises } from "../lib/workout-normalization";

describe("workout normalization", () => {
  it("keeps setless bare-number exercises when provided as reps", () => {
    expect(normalizeWorkoutExercises([{ name: "Squats", reps: 150 }])).toEqual([
      {
        exercise_name: "Squats",
        set_number: 1,
        reps: 150,
        weight_kg: 0,
        notes: "",
      },
    ]);
  });

  it("preserves setless weight-only exercises as weight with no reps", () => {
    expect(normalizeWorkoutExercises([{ name: "Squats", weight_kg: 150 }])).toEqual([
      {
        exercise_name: "Squats",
        set_number: 1,
        reps: 0,
        weight_kg: 150,
        notes: "",
      },
    ]);
  });

  it("summarizes setless bare-number exercises as normal sets", () => {
    expect(summarizeWorkoutExercises([{ name: "Squats", reps: 150 }])).toBe("Squats (1 set)");
  });

  it("keeps exercise-only workouts", () => {
    expect(normalizeWorkoutExercises([{ name: "Squats" }])).toEqual([
      {
        exercise_name: "Squats",
        set_number: 1,
        reps: 0,
        weight_kg: 0,
        notes: "",
      },
    ]);
  });

  it("preserves structured sets when reps are provided", () => {
    expect(summarizeWorkoutExercises([{ name: "Bench Press", sets: [{ reps: 8, weight_kg: 60 }] }])).toBe(
      "Bench Press (1 set)"
    );
  });
});
