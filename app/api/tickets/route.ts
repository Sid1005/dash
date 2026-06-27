import { NextResponse } from "next/server";
import { getUserScopedDb, isUnauthorizedError } from "@/lib/owner-scope";
import type { TaskRow } from "@/lib/tasks-types";
import type { TicketAgent, TicketImportance, TicketRow, TicketStatus } from "@/lib/tickets-types";

const AGENTS = new Set<TicketAgent>(["codex", "claude", "hermes", "openclaw"]);
const IMPORTANCE = new Set<TicketImportance>(["low", "medium", "high", "urgent"]);
const STATUSES = new Set<TicketStatus>(["backlog", "now", "done", "archived"]);

export async function GET() {
  try {
    const scope = await getUserScopedDb();
    const { data, error } = await scope.supabase
      .from("tickets")
      .select("*")
      .eq("owner_user_id", scope.ownerUserId)
      .neq("status", "archived")
      .order("status", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ tickets: data as TicketRow[] });
  } catch (error) {
    const status = isUnauthorizedError(error) ? 401 : 500;
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const dueAt = typeof body.due_at === "string" ? body.due_at : "";
    const dueLabel = typeof body.due_label === "string" ? body.due_label.trim() : "";
    const importance = typeof body.importance === "string" ? body.importance : "";
    const sourceText = typeof body.source_text === "string" ? body.source_text : "";
    const agent = typeof body.agent === "string" && AGENTS.has(body.agent as TicketAgent)
      ? body.agent as TicketAgent
      : null;
    const subtasks = Array.isArray(body.subtasks)
      ? body.subtasks.map((item: unknown) => String(item).trim()).filter(Boolean)
      : [];

    if (!title || !dueAt || !IMPORTANCE.has(importance as TicketImportance) || subtasks.length === 0) {
      return NextResponse.json(
        { error: "title, due_at, importance, and subtasks are required" },
        { status: 400 }
      );
    }

    const scope = await getUserScopedDb();
    const { data: task, error: taskError } = await scope.supabase
      .from("tasks")
      .insert({ owner_user_id: scope.ownerUserId, title, due_at: dueAt, done: false })
      .select("*")
      .single();

    if (taskError) return NextResponse.json({ error: taskError.message }, { status: 500 });

    const { data: ticket, error: ticketError } = await scope.supabase
      .from("tickets")
      .insert({
        owner_user_id: scope.ownerUserId,
        task_id: (task as TaskRow).id,
        title,
        due_at: dueAt,
        due_label: dueLabel,
        horizon: "today",
        importance,
        subtasks,
        agent,
        source_text: sourceText,
        status: "backlog",
        sort_order: 0,
        mission_status: agent ? "queued" : "none",
      })
      .select("*")
      .single();

    if (ticketError) return NextResponse.json({ error: ticketError.message }, { status: 500 });
    return NextResponse.json({ ticket: ticket as TicketRow, task: task as TaskRow }, { status: 201 });
  } catch (error) {
    const status = isUnauthorizedError(error) ? 401 : 500;
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const id = typeof body.id === "string" ? body.id : "";
    const status = typeof body.status === "string" ? body.status : null;
    const title = typeof body.title === "string" ? body.title.trim() : null;
    const subtasks = Array.isArray(body.subtasks)
      ? body.subtasks.map((item: unknown) => String(item).trim()).filter(Boolean)
      : null;
    const sortOrder = typeof body.sort_order === "number" && Number.isFinite(body.sort_order)
      ? Math.trunc(body.sort_order)
      : 0;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    if (status !== null && !STATUSES.has(status as TicketStatus)) {
      return NextResponse.json({ error: "valid status is required" }, { status: 400 });
    }
    if (title !== null && !title) {
      return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
    }

    const scope = await getUserScopedDb();

    if (status === "now") {
      const { error: clearError } = await scope.supabase
        .from("tickets")
        .update({ status: "backlog", sort_order: 0 })
        .eq("owner_user_id", scope.ownerUserId)
        .eq("status", "now")
        .neq("id", id);

      if (clearError) return NextResponse.json({ error: clearError.message }, { status: 500 });
    }

    const update: Record<string, string | number | string[]> = {};
    if (status !== null) {
      update.status = status;
      update.sort_order = sortOrder;
    }
    if (title !== null) update.title = title;
    if (subtasks !== null) update.subtasks = subtasks;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "no changes provided" }, { status: 400 });
    }

    const { data, error } = await scope.supabase
      .from("tickets")
      .update(update)
      .eq("owner_user_id", scope.ownerUserId)
      .eq("id", id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const ticket = data as TicketRow;
    if (title !== null && ticket.task_id) {
      const { error: taskError } = await scope.supabase
        .from("tasks")
        .update({ title })
        .eq("owner_user_id", scope.ownerUserId)
        .eq("id", ticket.task_id);

      if (taskError) return NextResponse.json({ error: taskError.message }, { status: 500 });
    }

    return NextResponse.json({ ticket: data as TicketRow });
  } catch (error) {
    const status = isUnauthorizedError(error) ? 401 : 500;
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id") ?? "";
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const scope = await getUserScopedDb();
    const { data: ticket, error: fetchError } = await scope.supabase
      .from("tickets")
      .select("*")
      .eq("owner_user_id", scope.ownerUserId)
      .eq("id", id)
      .single();

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

    const { error: archiveError } = await scope.supabase
      .from("tickets")
      .update({ status: "archived", sort_order: 0 })
      .eq("owner_user_id", scope.ownerUserId)
      .eq("id", id);

    if (archiveError) return NextResponse.json({ error: archiveError.message }, { status: 500 });

    const taskId = (ticket as TicketRow).task_id;
    if (taskId) {
      const { error: taskError } = await scope.supabase
        .from("tasks")
        .delete()
        .eq("owner_user_id", scope.ownerUserId)
        .eq("id", taskId);

      if (taskError) return NextResponse.json({ error: taskError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = isUnauthorizedError(error) ? 401 : 500;
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status });
  }
}
