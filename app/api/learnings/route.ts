import { NextRequest, NextResponse } from "next/server";
import { listLearningsForDate, insertLearning, deleteLearning } from "@/lib/learnings-supabase";
import { currentIstDate } from "@/lib/time";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") ?? currentIstDate();
  const rows = await listLearningsForDate(date);
  return NextResponse.json({
    date,
    items: rows.map((r) => ({ id: r.id, text: r.text })),
  });
}

export async function POST(req: NextRequest) {
  const { date, text } = await req.json();
  const d = date ?? currentIstDate();
  await insertLearning(d, text);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteLearning(id);
  return NextResponse.json({ ok: true });
}
