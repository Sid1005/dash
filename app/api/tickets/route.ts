import { NextResponse } from "next/server";
import { getUserScopedDb, isUnauthorizedError } from "@/lib/owner-scope";
import type { TicketAgent, TicketImportance, TicketRow, TicketStatus, TicketSubtaskDetails } from "@/lib/tickets-types";

const AGENTS = new Set<TicketAgent>(["codex", "claude", "hermes", "openclaw"]);
const IMPORTANCE = new Set<TicketImportance>(["p0", "p1", "p2"]);
const STATUSES = new Set<TicketStatus>(["backlog", "now", "done", "archived"]);
const SUBTASK_STATUSES = new Set(["backlog", "now"]);

function cleanSubtasks(value: unknown) {
  return Array.isArray(value)
    ? value.map((item: unknown) => String(item).trim()).filter(Boolean)
    : [];
}

function cleanSubtaskDetails(value: unknown): TicketSubtaskDetails {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.entries(value as Record<string, unknown>).reduce<TicketSubtaskDetails>((acc, [key, item]) => {
    if (!key.trim()) return acc;
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const details = typeof (item as { details?: unknown }).details === "string"
        ? (item as { details: string }).details.trim()
        : "";
      const status = typeof (item as { status?: unknown }).status === "string" && SUBTASK_STATUSES.has((item as { status: string }).status)
        ? (item as { status: "backlog" | "now" }).status
        : undefined;
      acc[key] = {
        ...(details ? { details } : {}),
        ...(status ? { status } : {}),
      };
    }
    return acc;
  }, {});
}

function dueAtOrNull(value: string) {
  return value && !Number.isNaN(new Date(value).getTime()) ? value : null;
}

function fallbackTitle(sourceText: string) {
  const title = sourceText
    .replace(/@(codex|claude|hermes|open\s*claw|openclaw|open\s*floor)/ig, "")
    .split(/\n|[.!?]/)
    .find((chunk) => chunk.trim())
    ?.trim();
  return title ? title.slice(0, 2000) : "Untitled ticket";
}

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
    const sourceText = typeof body.source_text === "string" ? body.source_text : "";
    const title = typeof body.title === "string" && body.title.trim()
      ? body.title.trim()
      : fallbackTitle(sourceText);
    const dueAt = dueAtOrNull(typeof body.due_at === "string" ? body.due_at : "");
    const dueLabel = typeof body.due_label === "string" ? body.due_label.trim() : "";
    const importance = typeof body.importance === "string" && IMPORTANCE.has(body.importance as TicketImportance)
      ? body.importance as TicketImportance
      : null;
    const agent = typeof body.agent === "string" && AGENTS.has(body.agent as TicketAgent)
      ? body.agent as TicketAgent
      : null;
    const subtasks = cleanSubtasks(body.subtasks);
    const subtaskDetails = cleanSubtaskDetails(body.subtask_details);

    const scope = await getUserScopedDb();
    const { data: ticket, error: ticketError } = await scope.supabase
      .from("tickets")
      .insert({
        owner_user_id: scope.ownerUserId,
        task_id: null,
        title,
        due_at: dueAt,
        due_label: dueLabel,
        horizon: "today",
        importance,
        subtasks,
        subtask_details: subtaskDetails,
        agent,
        source_text: sourceText,
        status: "backlog",
        sort_order: 0,
        mission_status: agent ? "queued" : "none",
      })
      .select("*")
      .single();

    if (ticketError) return NextResponse.json({ error: ticketError.message }, { status: 500 });
    return NextResponse.json({ ticket: ticket as TicketRow }, { status: 201 });
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
    const subtasks = Array.isArray(body.subtasks) ? cleanSubtasks(body.subtasks) : null;
    const subtaskDetails = body.subtask_details !== undefined ? cleanSubtaskDetails(body.subtask_details) : null;
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

    const update: Record<string, string | number | string[] | TicketSubtaskDetails> = {};
    if (status !== null) {
      update.status = status;
      update.sort_order = sortOrder;
    }
    if (title !== null) update.title = title;
    if (subtasks !== null) update.subtasks = subtasks;
    if (subtaskDetails !== null) update.subtask_details = subtaskDetails;

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
    const { error: archiveError } = await scope.supabase
      .from("tickets")
      .update({ status: "archived", sort_order: 0 })
      .eq("owner_user_id", scope.ownerUserId)
      .eq("id", id);

    if (archiveError) return NextResponse.json({ error: archiveError.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = isUnauthorizedError(error) ? 401 : 500;
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status });
  }
}
