export type TicketAgent = "codex" | "claude" | "hermes" | "openclaw" | "ideas";
export type TicketImportance = "p0" | "p1" | "p2";
export type TicketStatus = "backlog" | "now" | "done" | "archived";
export type TicketSubtaskStatus = "backlog" | "now";
export type TicketSubtaskDetails = Record<string, { details?: string; status?: TicketSubtaskStatus }>;

export type TicketAgentRunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type TicketAgentRunRow = {
  id: string;
  owner_user_id: string;
  ticket_id: string;
  agent: TicketAgent;
  status: TicketAgentRunStatus;
  input_prompt: string;
  generated_prompt: string;
  artifact_dir: string;
  md_path: string | null;
  html_path: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TicketAgentRunSummary = Pick<
  TicketAgentRunRow,
  "id" | "agent" | "status" | "artifact_dir" | "md_path" | "html_path" | "created_at" | "completed_at"
>;

export type TicketRow = {
  id: string;
  owner_user_id: string;
  task_id: string | null;
  title: string;
  due_at: string | null;
  due_label: string;
  horizon?: string | null;
  importance: TicketImportance | null;
  subtasks: string[];
  subtask_details: TicketSubtaskDetails;
  agent: TicketAgent | null;
  source_text: string;
  status: TicketStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
  latest_agent_run?: TicketAgentRunSummary | null;
};
