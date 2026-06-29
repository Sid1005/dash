import { NextResponse } from "next/server";
import { GROQ_MODEL, getGroqClient } from "@/lib/groq";
import { getUserScopedDb, isUnauthorizedError } from "@/lib/owner-scope";
import { currentIstDate, currentIstTime, currentIstWeekday } from "@/lib/time";
import type { TicketAgent, TicketImportance, TicketRow, TicketStatus, TicketSubtaskDetails } from "@/lib/tickets-types";

const AGENTS = new Set<TicketAgent>(["codex", "claude", "hermes", "openclaw", "ideas"]);
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

function normalizeDateLabel(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function startOfIstDay(date = new Date()) {
  const ist = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  ist.setHours(0, 0, 0, 0);
  return ist;
}

function weekdayDueAt(label: string) {
  const normalized = normalizeDateLabel(label);
  const weekdays = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const target = weekdays.findIndex((day) => normalized.startsWith(day));
  if (target === -1) return null;

  const now = startOfIstDay();
  const currentName = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "long" }).format(now).toLowerCase();
  const currentDay = weekdays.indexOf(currentName);
  if (currentDay === -1) return null;

  const daysAhead = (target - currentDay + 7) % 7;
  now.setDate(now.getDate() + daysAhead);
  now.setHours(18, 0, 0, 0);
  return now.toISOString();
}

function inferredDueAt(body: Record<string, unknown>, sourceText: string) {
  const candidates = [
    typeof body.due_at === "string" ? body.due_at : "",
    typeof body.due_label === "string" ? body.due_label : "",
    sourceText,
  ];

  for (const candidate of candidates) {
    const direct = dueAtOrNull(candidate);
    if (direct) return direct;
  }

  for (const candidate of candidates) {
    const weekday = weekdayDueAt(candidate);
    if (weekday) return weekday;
  }

  return null;
}

function fallbackTitle(sourceText: string) {
  const title = sourceText
    .replace(/@(codex|claude|hermes|open\s*claw|openclaw|open\s*floor)/ig, "")
    .split(/\n|[.!?]/)
    .find((chunk) => chunk.trim())
    ?.trim();
  return title ? title.slice(0, 2000) : "Untitled ticket";
}

type GroqTicketDraft = {
  title?: string;
  dueDate?: string;
  dueAt?: string;
  importance?: string;
  subtasks?: string[];
  agent?: string | null;
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanGroqSubtasks(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => cleanString(item)).filter(Boolean).slice(0, 12)
    : [];
}

function normalizeAgent(value: unknown) {
  const agent = cleanString(value).toLowerCase().replace(/\s+/g, "");
  if (agent === "openfloor") return "openclaw";
  return AGENTS.has(agent as TicketAgent) ? agent as TicketAgent : null;
}

function normalizeImportance(value: unknown) {
  const importance = cleanString(value).toLowerCase();
  return IMPORTANCE.has(importance as TicketImportance) ? importance as TicketImportance : null;
}

function normalizeGroqDraft(value: unknown): GroqTicketDraft {
  const object = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    title: cleanString(object.title),
    dueDate: cleanString(object.dueDate),
    dueAt: cleanString(object.dueAt),
    importance: cleanString(object.importance),
    subtasks: cleanGroqSubtasks(object.subtasks),
    agent: normalizeAgent(object.agent),
  };
}

async function enrichWithGroq(input: {
  sourceText: string;
  title: string;
  dueLabel: string;
  dueAt: string | null;
  importance: TicketImportance | null;
  subtasks: string[];
  agent: TicketAgent | null;
}) {
  const promptInput = input.sourceText || input.title || input.dueLabel;
  if (!promptInput) return null;

  try {
    const client = getGroqClient();
    const completion = await client.chat.completions.create({
      model: GROQ_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "Extract a laptop-work ticket from messy user text.",
            "Return only JSON with keys: title, dueDate, dueAt, importance, subtasks, agent.",
            "title: concise task title, no due date words and no priority words such as P0, P1, P2, urgent, important, high, or low.",
            "dueDate: short human label like Today, Tonight, Tomorrow, Jun 30, or empty.",
            "dueAt: ISO 8601 timestamp in Asia/Kolkata if inferable, otherwise empty.",
            "If the input includes an explicit weekday such as Wednesday, set dueDate to that weekday and set dueAt to the next matching date/time in Asia/Kolkata if you can infer it.",
            "importance: one of p0, p1, p2, or empty.",
            "subtasks: array of short action strings. Split comma/newline/arrow lists.",
            "agent: codex, claude, hermes, openclaw, ideas, or null.",
            "Only choose an agent if the text explicitly mentions one or selectedAgent is provided.",
            "Treat Open Floor as OpenClaw.",
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify({
            now: {
              date: currentIstDate(),
              time: currentIstTime(),
              weekday: currentIstWeekday(),
              timezone: "Asia/Kolkata",
            },
            selectedAgent: input.agent,
            input: promptInput,
          }),
        },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    return normalizeGroqDraft(JSON.parse(content) as unknown);
  } catch {
    return null;
  }
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
    const clientTitle = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "";
    const clientDueLabel = typeof body.due_label === "string" ? body.due_label.trim() : "";
    const clientDueAt = inferredDueAt(body, sourceText);
    const clientImportance = typeof body.importance === "string" && IMPORTANCE.has(body.importance as TicketImportance)
      ? body.importance as TicketImportance
      : null;
    const clientAgent = typeof body.agent === "string" && AGENTS.has(body.agent as TicketAgent)
      ? body.agent as TicketAgent
      : null;
    const clientSubtasks = cleanSubtasks(body.subtasks);
    const subtaskDetails = cleanSubtaskDetails(body.subtask_details);

    const groqDraft = await enrichWithGroq({
      sourceText,
      title: clientTitle,
      dueLabel: clientDueLabel,
      dueAt: clientDueAt,
      importance: clientImportance,
      subtasks: clientSubtasks,
      agent: clientAgent,
    });

    const title = groqDraft?.title?.trim() || clientTitle || fallbackTitle(sourceText);
    const dueLabel = groqDraft?.dueDate?.trim() || clientDueLabel;
    const dueAt = inferredDueAt(
      {
        due_at: groqDraft?.dueAt || clientDueAt || "",
        due_label: groqDraft?.dueDate || clientDueLabel || "",
      },
      sourceText,
    );
    const importance = (groqDraft?.importance && IMPORTANCE.has(groqDraft.importance as TicketImportance)
      ? groqDraft.importance as TicketImportance
      : clientImportance);
    const agent = groqDraft?.agent ?? clientAgent;
    const subtasks = groqDraft?.subtasks?.length ? groqDraft.subtasks : clientSubtasks;

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
