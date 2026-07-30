export const WORKOUT_CATEGORIES = ["Chest", "Back", "Shoulders", "Leg", "Bicep"] as const;
export type WorkoutCategory = (typeof WORKOUT_CATEGORIES)[number];

export const SPENDING_CATEGORIES = [
  "Travel",
  "Food",
  "Family",
  "Shopping",
  "Transport",
  "Health",
  "Sports & Fitness",
  "Entertainment",
  "Subscriptions",
  "Giving",
  "Investments",
  "Education & Work",
  "Other",
] as const;
export type SpendingCategory = string;

export type SpendingCategoryRow = {
  id: string;
  name: string;
  created_at: string;
};

export type WorkoutSetInput = {
  id?: string;
  reps?: number | string | null;
  weight_kg?: number | string | null;
  notes?: string | null;
};

export type WorkoutExerciseInput = {
  name: string;
  sets?: WorkoutSetInput[];
  reps?: number | string | null;
  weight_kg?: number | string | null;
  notes?: string | null;
};

export type WorkoutSet = {
  id: string;
  exercise_name: string;
  set_number: number;
  reps: number;
  weight_kg: number;
  notes: string;
  created_at?: string;
};

export type WorkoutSession = {
  id: string;
  title: string;
  title_confirmed: boolean;
  session_category: WorkoutCategory;
  occurred_date: string;
  session_started_at: string;
  session_last_logged_at: string;
  created_at: string;
  workout_exercises: WorkoutSet[];
};

export type SpendingRow = {
  id: string;
  occurred_date: string;
  item: string;
  amount: number;
  category: SpendingCategory;
  time_local: string;
  created_at: string;
};

export type TaskRow = {
  id: string;
  title: string;
  due_at: string;
  done: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ShortcutIntent =
  | "query_workout"
  | "query_spending"
  | "query_tasks"
  | "log_workout"
  | "log_spending"
  | "log_task"
  | "unknown";

export type ShortcutPlan = {
  intent: ShortcutIntent;
  workout_category?: WorkoutCategory;
  start_date?: string;
  end_date?: string;
  latest?: boolean;
  task_status?: "open" | "done" | "all";
  logged_at?: string;
  spending_category?: SpendingCategory;
  session_title?: string;
  exercises?: WorkoutExerciseInput[];
  expenses?: Array<{
    item: string;
    amount: number;
    category?: SpendingCategory;
    date?: string;
    time?: string;
  }>;
  tasks?: Array<{
    title: string;
    due_at?: string;
  }>;
};

export type ShortcutResponse = {
  ok: boolean;
  intent?: ShortcutIntent | "title_workout";
  message: string;
  needs_follow_up?: boolean;
  follow_up?: {
    type: "workout_title";
    prompt: string;
    session_id: string;
  };
  data?: unknown;
};

export type ShortcutQueryDomain = "spending" | "workout" | "tasks";
