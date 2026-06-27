export type TaskApiRow = {
  id: string;
  title: string;
  due_at: string;
  done: boolean;
  completed_at: string | null;
};

export type FoodApiRow = {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  estimated: boolean;
  cost: number;
  time: string;
  meal: string;
};

export type SpendApiRow = {
  id: string;
  item: string;
  amount: number;
  category: string;
  time: string;
};

export type TimeBlockApiRow = {
  id?: string;
  start: string;
  end: string;
  activity: string;
  category: string;
};

export type WorkoutExerciseApiRow = {
  exercise_name: string;
  reps: number;
  weight_kg: number;
};

export type WorkoutApiRow = {
  id: string;
  title: string;
  occurred_date: string;
  workout_exercises: WorkoutExerciseApiRow[];
};

export type ActivityApiRow = {
  id: string;
  date: string;
  time: string;
  actor: "telegram" | "agent" | "calendar" | "system" | "user";
  kind: "note" | "activity" | "agent_event";
  verb: string;
  body: string;
};

export type DashBlock = {
  id?: string;
  kind: "blk" | "cal" | "meal";
  start: string;
  end: string;
  label: string;
  cat?: string;
  loc?: string;
  kcal?: number;
  p?: number;
  est?: boolean;
  current?: boolean;
};


export type DashTask = {
  id: string;
  title: string;
  due: string;
  weight: "S" | "M" | "L";
  context: string;
  done: boolean;
  due_at: string;
};

export type DashLearning = {
  id: string;
  isoDate: string;
  date: string;
  text: string;
  tag: string;
};

export type QuoteRow = {
  id: string;
  text: string;
  author: string | null;
  created_at: string;
};

export type DashFeed = {
  t: string;
  who: "telegram" | "agent" | "calendar" | "system" | "user";
  verb: string;
  obj: string;
  est?: boolean;
};

export type DashData = {
  NOW_MIN: number;
  TODAY: { dateLong: string; dateIso: string };
  FOCUS: { title: string };
  VISION_LINE: string;
  PROBLEMS: { id: string; text: string; solved: boolean; created_at: string }[];
  BLOCKS: DashBlock[];
  TASKS: DashTask[];
  DONE_TASKS: DashTask[];
  ACTIVITIES: ActivityApiRow[];
  LEARNINGS: DashLearning[];
  FEED: DashFeed[];
  MEALS: { id: string; t: string; label: string; kcal: number; p: number; cost: number; est?: boolean; planned?: boolean }[];
  SPEND: { id: string; t: string; label: string; amount: number; cat: string; est?: boolean }[];
  VITALS: {
    kcal: { today: number; target: number };
    protein: { today: number; target: number };
    spend: { today: number; target: number };
  };
  SCHEDULE_FOLLOWED_MIN: number;
  SCHEDULE_ELAPSED_MIN: number;
  QUOTES: QuoteRow[];
  WORKOUT_SUMMARY: {
    sessions: number;
    exercises: number;
    sets: number;
    volume: number;
    label: string;
  };
};

export type CockpitCardItem = {
  id: string;
  text: string;
  done: boolean;
};

export type CockpitPostcard = {
  id: string;
  title: string;
  x: number;
  y: number;
  items: CockpitCardItem[];
};

export type Idea = {
  id: string;
  text: string;
  category: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export type SystemPostcardId = "problems";

export type SystemPostcardPositions = Record<SystemPostcardId, { x: number; y: number }>;
