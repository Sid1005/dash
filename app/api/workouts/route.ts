import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();
    // Fetch workouts with their exercises (sets) in one query
    const { data, error } = await supabase
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
      .order("occurred_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ workouts: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { date, exercises } = await req.json() as {
      date: string;
      exercises: { name: string; sets: { reps: number; weight_kg: number }[]; notes?: string }[];
    };
    const supabase = createAdminClient();

    let wk = null;
    let wkErr = null;

    // Try inserting with 'text' to satisfy the constraint on remote database (unmigrated)
    const insertRes = await supabase
      .from("workouts")
      .insert({ occurred_date: date, text: "Workout Session" })
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
          .insert({ occurred_date: date })
          .select("id")
          .single();
        wk = retryRes.data;
        wkErr = retryRes.error;
      } else {
        wkErr = insertRes.error;
      }
    } else {
      wk = insertRes.data;
    }

    if (wkErr || !wk) return NextResponse.json({ error: wkErr?.message || "Failed to create workout" }, { status: 500 });

    const setRows = exercises.flatMap((ex) =>
      ex.sets.map((s, si) => ({
        workout_id: wk.id,
        exercise_name: ex.name,
        set_number: si + 1,
        reps: s.reps,
        weight_kg: s.weight_kg,
        notes: ex.notes ?? "",
      }))
    );

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
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("workouts")
      .delete()
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, exercises, date } = await req.json() as {
      id: string;
      exercises: { name: string; sets: { reps: number; weight_kg: number }[]; notes?: string }[];
      date?: string;
    };
    if (!id) {
      return NextResponse.json({ error: "Missing workout ID" }, { status: 400 });
    }
    const supabase = createAdminClient();

    if (date) {
      const { error: dateErr } = await supabase
        .from("workouts")
        .update({ occurred_date: date })
        .eq("id", id);
      if (dateErr) return NextResponse.json({ error: dateErr.message }, { status: 500 });
    }

    // 1. Delete all existing exercises for this workout session
    const { error: delErr } = await supabase
      .from("workout_exercises")
      .delete()
      .eq("workout_id", id);

    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

    // 2. Prepare new rows
    const setRows = exercises.flatMap((ex) =>
      ex.sets.map((s, si) => ({
        workout_id: id,
        exercise_name: ex.name,
        set_number: si + 1,
        reps: s.reps,
        weight_kg: s.weight_kg,
        notes: ex.notes ?? "",
      }))
    );

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


