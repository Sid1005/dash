import { NextResponse } from "next/server";
import { deleteWorkoutSession, titleWorkoutSession, updateWorkoutSession } from "../../../../lib/workouts-data";
import { normalizeWorkoutCategory } from "../../../../lib/workout-normalization";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    if (Array.isArray(body.exercises)) {
      const category = normalizeWorkoutCategory(body.workout_category);
      if (!category) throw new Error("Choose a workout category.");
      const session = await updateWorkoutSession(id, {
        title: String(body.title ?? ""),
        occurredDate: String(body.date ?? ""),
        category,
        exercises: body.exercises,
      });
      return NextResponse.json({ session });
    }
    const session = await titleWorkoutSession(id, String(body.title ?? ""));
    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    await deleteWorkoutSession(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
