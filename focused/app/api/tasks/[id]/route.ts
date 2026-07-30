import { NextResponse } from "next/server";
import { after } from "next/server";
import { notifyHermesTaskCancel, notifyHermesTaskUpsert } from "@/lib/hermes-reminders";
import { deleteTask, updateTask } from "@/lib/tasks-data";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const task = await updateTask(id, { title: body.title, due_at: body.due_at, done: body.done });
    after(() => notifyHermesTaskUpsert(task));
    return NextResponse.json({ task });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    await deleteTask(id);
    after(() => notifyHermesTaskCancel(id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
