import { NextResponse } from "next/server";
import { after } from "next/server";
import { notifyHermesTaskUpsert } from "@/lib/hermes-reminders";
import { insertTask, listTasks } from "@/lib/tasks-data";
import { currentIstDate, endOfIstDayIso } from "@/lib/time";

export async function GET() {
  try {
    return NextResponse.json({ tasks: await listTasks() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const dueAt = typeof body.due_at === "string" ? body.due_at : endOfIstDayIso(currentIstDate());
    const task = await insertTask(String(body.title ?? ""), dueAt);
    after(() => notifyHermesTaskUpsert(task));
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}
