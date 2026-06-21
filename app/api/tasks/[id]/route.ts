import { after, NextResponse } from "next/server";
import type { TaskRow } from "@/lib/tasks-types";
import { getUserScopedDb } from "@/lib/owner-scope";
import { notifyHermesTaskCancel, notifyHermesTaskUpsert } from "@/lib/hermes-reminders";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Params) {
  try {
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const body = await req.json();
    const patch: Record<string, unknown> = {};

    if (typeof body.done === "boolean") {
      patch.done = body.done;
      patch.completed_at = body.done ? new Date().toISOString() : null;
    }
    if (typeof body.title === "string") {
      const t = body.title.trim();
      if (t) patch.title = t;
    }
    if (typeof body.due_at === "string" && body.due_at) {
      patch.due_at = body.due_at;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "Provide done, title, and/or due_at" },
        { status: 400 }
      );
    }

    const scope = await getUserScopedDb();
    const { data, error } = await scope.supabase
      .from("tasks")
      .update(patch)
      .eq("id", id)
      .eq("owner_user_id", scope.ownerUserId)
      .select("*")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    after(() => notifyHermesTaskUpsert(data as TaskRow));
    return NextResponse.json({ task: data as TaskRow });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Params) {
  try {
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const scope = await getUserScopedDb();
    const { error } = await scope.supabase
      .from("tasks")
      .delete()
      .eq("id", id)
      .eq("owner_user_id", scope.ownerUserId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    after(() => notifyHermesTaskCancel(id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
