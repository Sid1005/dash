import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TaskRow } from "@/lib/tasks-types";
import { rolloverOverdueTasks } from "@/lib/tasks-rollover";

export async function GET() {
  try {
    await rolloverOverdueTasks();

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
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

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("tasks")
      .insert({ title, due_at, done: false })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ task: data as TaskRow }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
