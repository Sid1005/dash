import { NextRequest, NextResponse } from "next/server";
import { getUserScopedDb } from "@/lib/owner-scope";

interface ExerciseSet {
  id: string;
  exercise_name: string;
  set_number: number;
  reps: number;
  weight_kg: number;
  notes: string;
}

interface WorkoutWithExercises {
  id: string;
  occurred_date: string;
  created_at: string;
  workout_exercises: ExerciseSet[];
}

export async function POST(req: NextRequest) {
  try {
    const { workoutIds } = await req.json() as { workoutIds: string[] };

    if (!workoutIds || workoutIds.length < 2) {
      return NextResponse.json({ error: "At least two workout IDs are required to combine." }, { status: 400 });
    }

    const { supabase, ownerUserId } = await getUserScopedDb();

    // 1. Fetch the workouts and their exercises to combine
    const { data: workouts, error: fetchErr } = await supabase
      .from("workouts")
      .select(`
        id,
        occurred_date,
        created_at,
        workout_exercises (
          id,
          exercise_name,
          set_number,
          reps,
          weight_kg,
          notes
        )
      `)
      .eq("owner_user_id", ownerUserId)
      .in("id", workoutIds) as { data: WorkoutWithExercises[] | null; error: any };

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    if (!workouts || workouts.length === 0) {
      return NextResponse.json({ error: "No workouts found matching the provided IDs." }, { status: 400 });
    }

    // Sort workouts in chronological order (earliest created_at first) so we preserve sequence
    workouts.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // Keep the first workout ID as the "primary" workout
    const primaryWorkoutId = workouts[0].id;
    const otherWorkoutIds = workouts.slice(1).map(w => w.id);

    // 2. Merge all exercises
    // We'll keep exercise names grouped case-insensitively, but preserve the exact case of the first occurrence
    const mergedExercises: { name: string; sets: { reps: number; weight_kg: number; notes?: string }[] }[] = [];

    for (const w of workouts) {
      // Sort exercises by set_number to preserve original set order
      const sortedSets = [...w.workout_exercises].sort((a, b) => a.set_number - b.set_number);
      
      for (const s of sortedSets) {
        let existing = mergedExercises.find(
          ex => ex.name.toLowerCase() === s.exercise_name.toLowerCase()
        );
        if (!existing) {
          existing = { name: s.exercise_name, sets: [] };
          mergedExercises.push(existing);
        }
        existing.sets.push({
          reps: s.reps,
          weight_kg: Number(s.weight_kg),
          notes: s.notes
        });
      }
    }

    // 3. Perform database operations
    // A. Delete exercises of the primary workout (they will be replaced by the merged list)
    const { error: delPrimaryErr } = await supabase
      .from("workout_exercises")
      .delete()
      .eq("workout_id", primaryWorkoutId)
      .eq("owner_user_id", ownerUserId);

    if (delPrimaryErr) return NextResponse.json({ error: delPrimaryErr.message }, { status: 500 });

    // B. Insert merged exercises into primary workout
    const setRows = mergedExercises.flatMap((ex) =>
      ex.sets.map((s, si) => ({
        workout_id: primaryWorkoutId,
        owner_user_id: ownerUserId,
        exercise_name: ex.name,
        set_number: si + 1,
        reps: s.reps,
        weight_kg: s.weight_kg,
        notes: s.notes ?? "",
      }))
    );

    if (setRows.length > 0) {
      const { error: insErr } = await supabase.from("workout_exercises").insert(setRows);
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    // C. Delete the other workouts (their workout_exercises will delete due to cascade references)
    const { error: delOthersErr } = await supabase
      .from("workouts")
      .delete()
      .eq("owner_user_id", ownerUserId)
      .in("id", otherWorkoutIds);

    if (delOthersErr) return NextResponse.json({ error: delOthersErr.message }, { status: 500 });

    return NextResponse.json({ success: true, primary_workout_id: primaryWorkoutId });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
