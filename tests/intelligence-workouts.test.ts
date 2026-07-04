import { describe, expect, it } from "vitest";
import {
  extractWorkoutFocus,
  scoreWorkoutRelevance,
  selectWorkoutsForQuestion,
  type WorkoutRow,
  workoutHistoryDateRange,
} from "../lib/intelligence";

function workout(
  id: string,
  title: string,
  occurredDate: string,
  exerciseNames: string[],
  notes = ""
): WorkoutRow {
  return {
    id,
    title,
    occurred_date: occurredDate,
    created_at: `${occurredDate}T10:00:00+05:30`,
    workout_exercises: exerciseNames.map((exerciseName, index) => ({
      id: `${id}-${index}`,
      exercise_name: exerciseName,
      set_number: index + 1,
      reps: 10,
      weight_kg: 10,
      notes,
    })),
  };
}

describe("workout question relevance", () => {
  const workouts = [
    workout("latest", "Legs", "2026-07-02", ["Squats"]),
    workout("shoulders", "Shoulders", "2026-07-01", ["Shoulder side raises", "Face Pull"]),
    workout("chest", "Chest Day", "2026-06-29", ["Bench Press"]),
    workout("back", "Pull Day", "2026-06-28", ["Lat Pulldown", "Cable Row"]),
  ];

  it("extracts a generic workout focus from body part and split wording", () => {
    expect(extractWorkoutFocus("last shoulder workout")).toBe("shoulder");
    expect(extractWorkoutFocus("last back day")).toBe("back");
    expect(extractWorkoutFocus("my latest push workout")).toBe("push");
    expect(extractWorkoutFocus("show my workouts")).toBeUndefined();
  });

  it("selects the shoulder session for last shoulder workout", () => {
    const selection = selectWorkoutsForQuestion(workouts, "last shoulder workout");
    expect(selection.focus).toBe("shoulder");
    expect(selection.workouts.map((entry) => entry.id)).toEqual(["shoulders"]);
  });

  it("keeps last chest workout working through the generic scorer", () => {
    const selection = selectWorkoutsForQuestion(workouts, "last chest workout");
    expect(selection.focus).toBe("chest");
    expect(selection.workouts.map((entry) => entry.id)).toEqual(["chest"]);
  });

  it("matches back-focused titles and exercise names", () => {
    const selection = selectWorkoutsForQuestion(workouts, "last back workout");
    expect(selection.focus).toBe("back");
    expect(selection.workouts.map((entry) => entry.id)).toEqual(["back"]);
  });

  it("returns latest workouts without body-part bias for broad workout questions", () => {
    const selection = selectWorkoutsForQuestion(workouts, "show my workouts");
    expect(selection.focus).toBeUndefined();
    expect(selection.workouts.map((entry) => entry.id)).toEqual(["latest", "shoulders", "chest", "back"]);
  });

  it("widens undated workout lookups but lets explicit dates win", () => {
    expect(workoutHistoryDateRange("last shoulder workout", "2026-07-03")).toEqual({
      startDate: "1970-01-01",
      endDate: "2026-07-02",
    });
    expect(workoutHistoryDateRange("last shoulder workout on 2026-06-01", "2026-07-03")).toBeNull();
  });

  it("uses title relevance above conflicting exercise names", () => {
    const mixed = [
      workout("recent-press", "Push Day", "2026-07-03", ["Bench Press"]),
      workout("older-title", "Chest Day", "2026-07-01", ["Shoulder side raises"]),
    ];

    expect(scoreWorkoutRelevance(mixed[1], "chest")).toBeGreaterThan(
      scoreWorkoutRelevance(mixed[0], "chest")
    );
    expect(selectWorkoutsForQuestion(mixed, "last chest workout").workouts[0].id).toBe("older-title");
  });
});
