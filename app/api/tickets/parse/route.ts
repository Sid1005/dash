import { NextResponse } from "next/server";
import { GROQ_MODEL, getGroqClient } from "@/lib/groq";
import { currentIstDate, currentIstTime, currentIstWeekday } from "@/lib/time";
import type { TicketAgent, TicketImportance } from "@/lib/tickets-types";

const AGENTS = new Set<TicketAgent>(["codex", "claude", "hermes", "openclaw"]);
const IMPORTANCE = new Set<TicketImportance>(["p0", "p1", "p2"]);

type ParsedTicket = {
  title: string;
  dueDate: string;
  dueAt: string;
  importance: TicketImportance | "";
  subtasks: string[];
  agent: TicketAgent | null;
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanSubtasks(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanString(item)).filter(Boolean).slice(0, 12);
}

function normalizeAgent(value: unknown) {
  const agent = cleanString(value).toLowerCase().replace(/\s+/g, "");
  if (agent === "openfloor") return "openclaw";
  return AGENTS.has(agent as TicketAgent) ? agent as TicketAgent : null;
}

function normalizeImportance(value: unknown) {
  const importance = cleanString(value).toLowerCase();
  return IMPORTANCE.has(importance as TicketImportance) ? importance as TicketImportance : "";
}

function normalizeParsedTicket(value: unknown, selectedAgent: TicketAgent | null): ParsedTicket {
  const object = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    title: cleanString(object.title),
    dueDate: cleanString(object.dueDate),
    dueAt: cleanString(object.dueAt),
    importance: normalizeImportance(object.importance),
    subtasks: cleanSubtasks(object.subtasks),
    agent: normalizeAgent(object.agent) ?? selectedAgent,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = cleanString(body.input);
    const selectedAgent = normalizeAgent(body.selectedAgent);
    if (!input) {
      return NextResponse.json({ error: "input is required" }, { status: 400 });
    }

    const today = currentIstDate();
    const time = currentIstTime();
    const weekday = currentIstWeekday();
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
            "importance: one of p0, p1, p2, or empty. P0 is most critical, P1 is important, P2 is normal/lower priority.",
            "Treat explicit P0/P1/P2 as the only priority vocabulary; do not infer urgent/high/low labels.",
            "subtasks: array of short action strings. Split comma/newline/arrow lists.",
            "agent: codex, claude, hermes, openclaw, or null.",
            "Only choose an agent if the text explicitly mentions one or selectedAgent is provided.",
            "Treat Open Floor as OpenClaw.",
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify({
            now: { date: today, time, weekday, timezone: "Asia/Kolkata" },
            selectedAgent,
            input,
          }),
        },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as unknown;
    return NextResponse.json({ draft: normalizeParsedTicket(parsed, selectedAgent) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not parse ticket";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
