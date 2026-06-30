import path from "node:path";
import { randomUUID } from "node:crypto";
import type { DbScope } from "@/lib/owner-scope";
import type {
  TicketAgent,
  TicketAgentRunRow,
  TicketAgentRunStatus,
  TicketAgentRunSummary,
  TicketRow,
} from "@/lib/tickets-types";

const AGENT_LABELS: Record<TicketAgent, string> = {
  codex: "Codex",
  claude: "Claude",
  hermes: "Hermes",
  openclaw: "OpenClaw",
  ideas: "Ideas",
};

export const AGENT_ARTIFACT_FILES = {
  md: "idea.md",
  html: "idea.html",
} as const;

const AGENT_ARTIFACT_DIR_PATTERN = /^agent-artifacts\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/i;

export function agentLabel(agent: TicketAgent) {
  return AGENT_LABELS[agent];
}

export function agentRunArtifactDir(ticketId: string, runId: string) {
  return path.posix.join("agent-artifacts", ticketId, runId);
}

export function agentRunArtifactUrls(runId: string) {
  return {
    md: `/api/agent-runs/${runId}/artifact?kind=md`,
    html: `/api/agent-runs/${runId}/artifact?kind=html`,
  };
}

export function agentRunArtifactPath(artifactDir: string, kind: keyof typeof AGENT_ARTIFACT_FILES) {
  const normalizedArtifactDir = artifactDir.replace(/\\/g, "/");
  if (!AGENT_ARTIFACT_DIR_PATTERN.test(normalizedArtifactDir)) {
    throw new Error("Invalid agent artifact path");
  }
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd());
  const resolved = path.resolve(root, normalizedArtifactDir, AGENT_ARTIFACT_FILES[kind]);
  const rootPrefix = `${root}${path.sep}`;
  if (resolved !== root && !resolved.startsWith(rootPrefix)) {
    throw new Error("Invalid agent artifact path");
  }
  return resolved;
}

export function buildAgentPrompt(ticket: Pick<TicketRow, "id" | "title" | "source_text" | "subtasks" | "agent">, artifactDir: string) {
  const sourceText = ticket.source_text.trim();
  const subtasks = ticket.subtasks.map((subtask) => subtask.trim()).filter(Boolean);

  return [
    "You are Dash's local agent runner.",
    `This job is for the ${agentLabel(ticket.agent ?? "ideas")} agent.`,
    "Turn the user's idea into the requested deliverable.",
    "Write only these files in the current working directory:",
    `- ${AGENT_ARTIFACT_FILES.md}`,
    `- ${AGENT_ARTIFACT_FILES.html}`,
    "Do not edit any existing Dash code or any files outside the current working directory.",
    "Do not create code files, package manifests, or extra artifacts.",
    "The HTML must be self-contained and open directly in a browser.",
    "The HTML is the user-facing deliverable. It should contain only the requested website/app content, not a description of the prompt or the agent flow.",
    "The markdown should be a short companion note describing the finished deliverable in plain language.",
    "Do not mention ticket IDs, artifact directories, due dates, priorities, queue state, setup steps, Dash internals, or the exact raw prompt unless the user explicitly asks for them.",
    "Do not include sections like 'Setup Needed', 'Dash Implementation Approach', or 'User prompt'.",
    "For simple website requests, keep both files simple and literal. If the user asks for a website saying a phrase, the HTML should primarily show that phrase and the markdown should state that the website shows that phrase.",
    "Use a clean, practical product style rather than a marketing page.",
    "",
    `Ticket ID: ${ticket.id}`,
    `Ticket title: ${ticket.title}`,
    sourceText ? `User prompt: ${sourceText}` : "User prompt: (empty)",
    subtasks.length ? `Subtasks: ${subtasks.join(" | ")}` : "Subtasks: none",
    `Artifact directory: ${artifactDir}`,
    "",
    "If the prompt is about a personal website, the first pass should include a homepage, about section, projects, writing, and contact area.",
    "If the prompt is about another idea, adapt the structure to that idea while keeping the output to the same two files.",
  ].join("\n");
}

export async function createAgentRun(scope: DbScope, ticket: Pick<TicketRow, "id" | "title" | "source_text" | "subtasks" | "agent">) {
  if (!ticket.agent) {
    throw new Error("ticket.agent is required to create an agent run");
  }

  const runId = randomUUID();
  const artifactDir = agentRunArtifactDir(ticket.id, runId);
  const generatedPrompt = buildAgentPrompt(ticket, artifactDir);
  const { data, error } = await scope.supabase
    .from("agent_runs")
    .insert({
      id: runId,
      owner_user_id: scope.ownerUserId,
      ticket_id: ticket.id,
      agent: ticket.agent,
      status: "queued" as TicketAgentRunStatus,
      input_prompt: ticket.source_text || ticket.title,
      generated_prompt: generatedPrompt,
      artifact_dir: artifactDir,
      md_path: path.posix.join(artifactDir, AGENT_ARTIFACT_FILES.md),
      html_path: path.posix.join(artifactDir, AGENT_ARTIFACT_FILES.html),
      error_message: null,
      started_at: null,
      completed_at: null,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as TicketAgentRunRow;
}

export async function listLatestAgentRunsByTicket(scope: DbScope, ticketIds: string[]) {
  if (ticketIds.length === 0) return new Map<string, TicketAgentRunSummary>();

  const { data, error } = await scope.supabase
    .from("agent_runs")
    .select("id, agent, status, artifact_dir, md_path, html_path, created_at, completed_at, ticket_id")
    .eq("owner_user_id", scope.ownerUserId)
    .in("ticket_id", ticketIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const latestByTicket = new Map<string, TicketAgentRunSummary>();
  for (const row of (data ?? []) as Array<TicketAgentRunSummary & { ticket_id: string }>) {
    if (!latestByTicket.has(row.ticket_id)) {
      latestByTicket.set(row.ticket_id, {
        id: row.id,
        agent: row.agent,
        status: row.status,
        artifact_dir: row.artifact_dir,
        md_path: row.md_path,
        html_path: row.html_path,
        created_at: row.created_at,
        completed_at: row.completed_at,
      });
    }
  }

  return latestByTicket;
}

export async function loadAgentRun(scope: DbScope, runId: string) {
  const { data, error } = await scope.supabase
    .from("agent_runs")
    .select("*")
    .eq("id", runId)
    .eq("owner_user_id", scope.ownerUserId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as TicketAgentRunRow;
}
