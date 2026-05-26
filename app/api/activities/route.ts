import { NextRequest, NextResponse } from "next/server";
import { deleteActivity, insertActivity, listActivitiesForDate } from "@/lib/activities-supabase";
import { currentIstDate } from "@/lib/time";

export async function GET(req: NextRequest) {
  const date =
    req.nextUrl.searchParams.get("date") ??
    currentIstDate();
  const activities = await listActivitiesForDate(date);
  return NextResponse.json({ activities });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const date = body.date ?? currentIstDate();
  const activity = await insertActivity(date, body);
  return NextResponse.json({ ok: true, activity });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteActivity(id);
  return NextResponse.json({ ok: true });
}
