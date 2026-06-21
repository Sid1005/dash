import { after, NextResponse } from "next/server";
import type { TaskRow } from "@/lib/tasks-types";
import { rolloverOverdueTasks } from "@/lib/tasks-rollover";
import { getUserScopedDb } from "@/lib/owner-scope";
import { notifyHermesTaskUpsert } from "@/lib/hermes-reminders";

export async function GET() {
  try {
    const scope = await getUserScopedDb();
    await rolloverOverdueTasks(scope);

    const { data, error } = await scope.supabase
      .from("tasks")
      .select("*")
      .eq("owner_user_id", scope.ownerUserId)
      .order("due_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ tasks: data as TaskRow[] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const due_at = typeof body.due_at === "string" ? body.due_at : "";

    if (!title || !due_at) {
      return NextResponse.json(
        { error: "title and due_at (ISO 8601) are required" },
        { status: 400 }
      );
    }

    const scope = await getUserScopedDb();
    const { data, error } = await scope.supabase
      .from("tasks")
      .insert({ owner_user_id: scope.ownerUserId, title, due_at, done: false })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    after(() => notifyHermesTaskUpsert(data as TaskRow));
    return NextResponse.json({ task: data as TaskRow }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
