import { NextResponse } from "next/server";
import { appendWorkoutLog, listWorkoutSessions } from "../../../lib/workouts-data";
import { currentIstIso } from "../../../lib/time";
import { normalizeWorkoutCategory } from "../../../lib/workout-normalization";

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const sessions = await listWorkoutSessions({
      category: normalizeWorkoutCategory(url.searchParams.get("category")),
      startDate: url.searchParams.get("start") ?? undefined,
      endDate: url.searchParams.get("end") ?? undefined,
      limit: Number(url.searchParams.get("limit")) || 100,
    });
    return NextResponse.json({ sessions });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const category = normalizeWorkoutCategory(body.workout_category);
    if (!category) throw new Error("Choose a workout category.");
    const result = await appendWorkoutLog({
      exercises: Array.isArray(body.exercises) ? body.exercises : [],
      loggedAt: typeof body.logged_at === "string" ? body.logged_at : currentIstIso(),
      category,
      title: typeof body.title === "string" ? body.title : undefined,
      forceNew: body.force_new === true,
    });
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}
