import { NextRequest, NextResponse } from "next/server";
import { getUserScopedDb } from "@/lib/owner-scope";
import { normalizeWorkoutExercises, type RawWorkoutExercise } from "@/lib/workout-normalization";

export async function GET() {
  try {
    const { supabase, ownerUserId } = await getUserScopedDb();
    // Fetch workouts with their exercises (sets) in one query
    const fetchWorkoutsWithTitle = () => supabase
      .from("workouts")
      .select(`
        id,
        title,
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
      .order("occurred_date", { ascending: false })
      .order("created_at", { ascending: false });

    const fetchWorkoutsWithoutTitle = () => supabase
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
      .order("occurred_date", { ascending: false })
      .order("created_at", { ascending: false });

    let { data, error } = await fetchWorkoutsWithTitle();
    if (error && (error.code === "42703" || error.message.includes("schema cache") || error.message.includes("column"))) {
      const fallback = await fetchWorkoutsWithoutTitle();
      data = (fallback.data ?? []).map((workout) => ({ ...workout, title: "Workout Session" }));
      error = fallback.error;
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ workouts: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { date, exercises = [], title } = await req.json() as {
      date: string;
      title?: string;
      exercises?: RawWorkoutExercise[];
    };
    const { supabase, ownerUserId } = await getUserScopedDb();
    const workoutTitle = normalizeWorkoutTitle(title, exercises);

    let wk = null;
    let wkErr = null;

    // Try inserting with 'text' to satisfy the constraint on older databases that still have it.
    const insertRes = await supabase
      .from("workouts")
      .insert({ owner_user_id: ownerUserId, occurred_date: date, title: workoutTitle, text: workoutTitle })
      .select("id")
      .single();

    if (insertRes.error) {
      const isSchemaError =
        insertRes.error.code === "42703" ||
        insertRes.error.message.includes("schema cache") ||
        insertRes.error.message.includes("column");

      if (isSchemaError) {
        const retryRes = await supabase
          .from("workouts")
          .insert({ owner_user_id: ownerUserId, occurred_date: date, title: workoutTitle })
          .select("id")
          .single();
        if (retryRes.error) {
          const legacyRetryRes = await supabase
            .from("workouts")
            .insert({ owner_user_id: ownerUserId, occurred_date: date })
            .select("id")
            .single();
          wk = legacyRetryRes.data;
          wkErr = legacyRetryRes.error;
        } else {
          wk = retryRes.data;
          wkErr = retryRes.error;
        }
      } else {
        wkErr = insertRes.error;
      }
    } else {
      wk = insertRes.data;
    }

    if (wkErr || !wk) return NextResponse.json({ error: wkErr?.message || "Failed to create workout" }, { status: 500 });

    const setRows = normalizeWorkoutExercises(exercises).map((s) => ({
        workout_id: wk.id,
        owner_user_id: ownerUserId,
        exercise_name: s.exercise_name,
        set_number: s.set_number,
        reps: s.reps,
        weight_kg: s.weight_kg,
        notes: s.notes,
      }));

    if (setRows.length > 0) {
      const { error: exErr } = await supabase.from("workout_exercises").insert(setRows);
      if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, workout_id: wk.id });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json() as { id: string };
    if (!id) {
      return NextResponse.json({ error: "Missing workout ID" }, { status: 400 });
    }
    const { supabase, ownerUserId } = await getUserScopedDb();
    const { error } = await supabase
      .from("workouts")
      .delete()
      .eq("id", id)
      .eq("owner_user_id", ownerUserId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, exercises = [], date, title } = await req.json() as {
      id: string;
      exercises?: RawWorkoutExercise[];
      date?: string;
      title?: string;
    };
    if (!id) {
      return NextResponse.json({ error: "Missing workout ID" }, { status: 400 });
    }
    const { supabase, ownerUserId } = await getUserScopedDb();

    const updatePayload: { occurred_date?: string; title?: string } = {};
    if (date) updatePayload.occurred_date = date;
    if (title !== undefined) updatePayload.title = normalizeWorkoutTitle(title, exercises);

    if (Object.keys(updatePayload).length > 0) {
      const { error: dateErr } = await supabase
        .from("workouts")
        .update(updatePayload)
        .eq("id", id)
        .eq("owner_user_id", ownerUserId);
      if (dateErr) return NextResponse.json({ error: dateErr.message }, { status: 500 });
    }

    // 1. Delete all existing exercises for this workout session
    const { error: delErr } = await supabase
      .from("workout_exercises")
      .delete()
      .eq("workout_id", id)
      .eq("owner_user_id", ownerUserId);

    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

    // 2. Prepare new rows
    const setRows = normalizeWorkoutExercises(exercises).map((s) => ({
        workout_id: id,
        owner_user_id: ownerUserId,
        exercise_name: s.exercise_name,
        set_number: s.set_number,
        reps: s.reps,
        weight_kg: s.weight_kg,
        notes: s.notes,
      }));

    // 3. Insert new rows
    if (setRows.length > 0) {
      const { error: insErr } = await supabase.from("workout_exercises").insert(setRows);
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

function normalizeWorkoutTitle(
  title: string | undefined,
  exercises: RawWorkoutExercise[]
) {
  const trimmedTitle = title?.trim();
  if (trimmedTitle) return trimmedTitle.slice(0, 120);

  const exerciseNames = exercises
    .map((exercise) => exercise.name?.trim() ?? "")
    .filter(Boolean)
    .slice(0, 2);

  return exerciseNames.length > 0 ? exerciseNames.join(" + ") : "Workout Session";
}
