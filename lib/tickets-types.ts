export type TicketAgent = "codex" | "claude" | "hermes" | "openclaw";
export type TicketImportance = "low" | "medium" | "high" | "urgent";
export type TicketMissionStatus = "none" | "queued" | "created" | "failed";
export type TicketStatus = "backlog" | "now" | "done" | "archived";
export type TicketSubtaskStatus = "backlog" | "now";
export type TicketSubtaskDetails = Record<string, { details?: string; status?: TicketSubtaskStatus }>;

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
  mission_status: TicketMissionStatus;
  created_at: string;
  updated_at: string;
};
