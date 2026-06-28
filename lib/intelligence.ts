import { type DbScope } from "@/lib/owner-scope";
import { fallbackDateRange } from "@/lib/date-range";
import { getGroqClient, GROQ_MODEL } from "@/lib/groq";

type TelegramIntent = "log" | "question";
type Domain = "workouts" | "food" | "spending" | "calendar" | "ideas";

type IntentClassification = {
  intent: TelegramIntent;
  confidence: number;
  reason?: string;
};

type QuestionPlan = {
  domains: Domain[];
  startDate: string;
  endDate: string;
  focus?: string;
};

type WorkoutSet = {
  id: string;
  exercise_name: string;
  set_number: number;
  reps: number;
  weight_kg: number | string;
  notes: string;
};

type WorkoutRow = {
  id: string;
  title: string;
  occurred_date: string;
  created_at: string;
  workout_exercises: WorkoutSet[];
};

type FoodRow = {
  id: string;
  logged_date: string;
  name: string;
  calories: number;
  protein_g: number | string;
  estimated: boolean;
  cost: number | string;
  time_local: string;
  meal: string;
};

type SpendingRow = {
  id: string;
  occurred_date: string;
  item: string;
  amount: number | string;
  category: string;
  time_local: string;
};

type TimeBlockRow = {
  id: string;
  occurred_date: string;
  start_local: string;
  end_local: string;
  activity: string;
  category: string;
};

type IdeaRow = {
  id: string;
  text: string;
  category: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

type PersonalDataBundle = {
  dateRange: {
    start: string;
    end: string;
  };
  domains: Domain[];
  retrievalNote?: string;
  workouts?: WorkoutRow[];
  food?: FoodRow[];
  spending?: SpendingRow[];
  timeBlocks?: TimeBlockRow[];
  ideas?: IdeaRow[];
};

const MAX_RECORDS_PER_DOMAIN = 120;
const MAX_WORKOUT_RECORDS = 300;
const ALL_STORED_DATA_START = "1970-01-01";
const ALL_DOMAINS: Domain[] = ["workouts", "food", "spending", "calendar", "ideas"];

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      const parsed = JSON.parse(text.slice(start, end + 1));
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
}

function isValidDateString(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function fallbackDomains(input: string): Domain[] {
  const lower = input.toLowerCase();
  const domains = new Set<Domain>();
  if (/\b(workout|exercise|gym|sets?|reps?|back|chest|legs?|shoulders?|biceps?|triceps?)\b/.test(lower)) {
    domains.add("workouts");
  }
  if (/\b(food|ate|eat|calories|protein|meal|breakfast|lunch|dinner)\b/.test(lower)) {
    domains.add("food");
  }
  if (/\b(spend|spent|expense|money|cost|paid|bought|purchase|₹|rs\.?|inr)\b/.test(lower)) {
    domains.add("spending");
  }
  if (/\b(calendar|schedule|meeting|event|time block|time-block|plan|planned)\b/.test(lower)) {
    domains.add("calendar");
  }
  if (/\b(idea|ideas|build|brainstorm)\b/.test(lower)) {
    domains.add("ideas");
  }
  return domains.size > 0 ? Array.from(domains) : ALL_DOMAINS;
}

function fallbackIntent(input: string): IntentClassification {
  const lower = input.trim().toLowerCase();
  const saveRequest = /^(can|could|please)\s+(you\s+)?(log|save|add|note|record)\b/.test(lower);
  if (saveRequest) {
    return {
      intent: "log",
      confidence: 0.7,
      reason: "heuristic fallback save request",
    };
  }

  const questionStart = /^(what|when|where|who|why|how|did|do|does|can|could|show|tell|list|summari[sz]e|give)\b/.test(lower);
  const question = lower.includes("?") || questionStart;
  return {
    intent: question ? "question" : "log",
    confidence: question ? 0.7 : 0.6,
    reason: "heuristic fallback",
  };
}

function normalizeDomains(value: unknown, input: string): Domain[] {
  if (!Array.isArray(value)) return fallbackDomains(input);
  const domains = value.filter((domain): domain is Domain =>
    ALL_DOMAINS.includes(domain as Domain)
  );
  return domains.length > 0 ? Array.from(new Set(domains)) : fallbackDomains(input);
}

function normalizePlan(raw: Record<string, unknown> | null, input: string, today: string): QuestionPlan {
  const fallbackRange = fallbackDateRange(input, today);
  const shouldSearchFullWorkoutHistory = shouldUseFullWorkoutHistory(input);
  if (!raw) {
    return {
      domains: fallbackDomains(input),
      ...(shouldSearchFullWorkoutHistory
        ? { startDate: ALL_STORED_DATA_START, endDate: today }
        : fallbackRange),
      focus: input,
    };
  }

  const startDate = shouldSearchFullWorkoutHistory
    ? ALL_STORED_DATA_START
    : isValidDateString(raw.startDate)
      ? raw.startDate
      : fallbackRange.startDate;
  const endDate = shouldSearchFullWorkoutHistory
    ? today
    : isValidDateString(raw.endDate)
      ? raw.endDate
      : fallbackRange.endDate;
  const domains = normalizeDomains(raw.domains, input);
  const planDomains =
    shouldSearchFullWorkoutHistory && !domains.includes("workouts")
      ? Array.from(new Set<Domain>(["workouts", ...domains]))
      : domains;

  return {
    domains: planDomains,
    startDate: startDate <= endDate ? startDate : endDate,
    endDate: startDate <= endDate ? endDate : startDate,
    focus: typeof raw.focus === "string" ? raw.focus : input,
  };
}

function hasExplicitDateRange(input: string): boolean {
  const lower = input.toLowerCase();
  return (
    /\b\d{4}-\d{2}-\d{2}\b/.test(input) ||
    /\b(today|yesterday|last week|this week|last month|this month)\b/.test(lower)
  );
}

function shouldUseFullWorkoutHistory(input: string): boolean {
  const lower = input.toLowerCase();
  const asksAboutWorkouts =
    /\b(workout|workouts|exercise|gym|sets?|reps?|chest|pecs?|pectorals?)\b/.test(lower);
  const asksForSingleLatest = /\b(last|latest|most recent|previous)\b/.test(lower);
  const asksForBodyPartHistory =
    /\b(chest|pecs?|pectorals?)\b/.test(lower) &&
    (asksForSingleLatest || /\b(show|tell|list|history|when)\b/.test(lower));
  const asksForBroadHistory = /\b(show|tell|list|history|when)\b/.test(lower);

  return asksAboutWorkouts &&
    (asksForBodyPartHistory || (asksForBroadHistory && !asksForSingleLatest)) &&
    !hasExplicitDateRange(input);
}

function isChestWorkoutQuestion(input: string): boolean {
  return /\b(chest|pecs?|pectorals?)\b/i.test(input);
}

function isChestWorkoutTitle(title: string): boolean {
  return /\b(chest|pecs?|pectorals?)\b/i.test(title);
}

function latestChestWorkouts(workouts: WorkoutRow[], count: number): WorkoutRow[] {
  return workouts
    .filter((workout) => isChestWorkoutTitle(workout.title))
    .slice(0, count);
}

function compactJson(value: unknown): string {
  return JSON.stringify(value, null, 2).slice(0, 18_000);
}

function sanitizeTelegramMarkdown(text: string): string {
  return text
    .replace(/[_`[\]]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 3800);
}

async function askGroqForJson(system: string, user: string): Promise<Record<string, unknown> | null> {
  const response = await getGroqClient().chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0,
    max_tokens: 800,
  });

  const content = response.choices[0]?.message?.content?.trim() ?? "";
  return parseJsonObject(content);
}

export async function classifyTelegramIntent(input: string, nowContext: string): Promise<IntentClassification> {
  if (!input.trim()) return { intent: "log", confidence: 1, reason: "empty input" };

  try {
    const raw = await askGroqForJson(
      `Classify a Telegram message for a personal dashboard bot.
Return only JSON: {"intent":"question"|"log","confidence":0..1,"reason":"short"}.
Use "question" only when the user is asking to retrieve, summarize, compare, inspect, or reason about stored past/current personal data.
Use "log" for statements that should be saved, including spending, food, workouts, tasks, calendar blocks, notes, and ideas.
If ambiguous, choose "log".
Current time: ${nowContext}`,
      input
    );
    const intent = raw?.intent === "question" ? "question" : "log";
    const confidence = typeof raw?.confidence === "number" ? raw.confidence : 0.5;
    return {
      intent,
      confidence,
      reason: typeof raw?.reason === "string" ? raw.reason : undefined,
    };
  } catch (error) {
    console.error("[Intelligence] Intent classification failed:", error);
    return fallbackIntent(input);
  }
}

async function planQuestion(
  input: string,
  nowContext: string,
  today: string,
  deterministicInput = input
): Promise<QuestionPlan> {
  try {
    const raw = await askGroqForJson(
      `Plan read-only data access for a personal dashboard question.
Return only JSON with:
{"domains":["workouts"|"food"|"spending"|"calendar"|"ideas"],"startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD","focus":"short search/filter intent"}.
Use Asia/Kolkata dates. "last week" means the previous Monday through Sunday calendar week. If no date is stated, use the last 30 days for time-series data. For idea questions without a date, still use the last 30 days unless the wording asks for all ideas.
For undated workout history questions such as "last chest workout", "tell me my chest workouts", or "show my workouts", use startDate "${ALL_STORED_DATA_START}" and retrieve the user's full stored workout history.
For workout questions, "last workout", "latest workout", and "most recent workout" mean the previous workout before today's already logged workout records, unless the user explicitly asks for today or a specific date/range. In that case, end the range on the day before the current date.
Never include domains outside the enum.
Current time: ${nowContext}`,
      input
    );
    return normalizePlan(raw, deterministicInput, today);
  } catch (error) {
    console.error("[Intelligence] Question planning failed:", error);
    return normalizePlan(null, deterministicInput, today);
  }
}

async function fetchWorkouts(scope: DbScope, startDate: string, endDate: string): Promise<WorkoutRow[]> {
  const { data, error } = await scope.supabase
    .from("workouts")
    .select(`
      id,
      title,
      occurred_date,
      created_at,
      workout_exercises (
        id,
        exercise_name,
        set_number,
        reps,
        weight_kg,
        notes
      )
    `)
    .eq("owner_user_id", scope.ownerUserId)
    .gte("occurred_date", startDate)
    .lte("occurred_date", endDate)
    .order("occurred_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(MAX_WORKOUT_RECORDS);

  if (error) throw new Error(error.message);
  return (data ?? []) as WorkoutRow[];
}

async function fetchFood(scope: DbScope, startDate: string, endDate: string): Promise<FoodRow[]> {
  const { data, error } = await scope.supabase
    .from("food_entries")
    .select("id, logged_date, name, calories, protein_g, estimated, cost, time_local, meal")
    .eq("owner_user_id", scope.ownerUserId)
    .gte("logged_date", startDate)
    .lte("logged_date", endDate)
    .order("logged_date", { ascending: false })
    .order("time_local", { ascending: true })
    .limit(MAX_RECORDS_PER_DOMAIN);

  if (error) throw new Error(error.message);
  return (data ?? []) as FoodRow[];
}

async function fetchSpending(scope: DbScope, startDate: string, endDate: string): Promise<SpendingRow[]> {
  const { data, error } = await scope.supabase
    .from("spending")
    .select("id, occurred_date, item, amount, category, time_local")
    .eq("owner_user_id", scope.ownerUserId)
    .gte("occurred_date", startDate)
    .lte("occurred_date", endDate)
    .order("occurred_date", { ascending: false })
    .order("time_local", { ascending: true })
    .limit(MAX_RECORDS_PER_DOMAIN);

  if (error) throw new Error(error.message);
  return (data ?? []) as SpendingRow[];
}

async function fetchTimeBlocks(scope: DbScope, startDate: string, endDate: string): Promise<TimeBlockRow[]> {
  const { data, error } = await scope.supabase
    .from("time_blocks")
    .select("id, occurred_date, start_local, end_local, activity, category")
    .eq("owner_user_id", scope.ownerUserId)
    .gte("occurred_date", startDate)
    .lte("occurred_date", endDate)
    .order("occurred_date", { ascending: false })
    .order("start_local", { ascending: true })
    .limit(MAX_RECORDS_PER_DOMAIN);

  if (error) throw new Error(error.message);
  return (data ?? []) as TimeBlockRow[];
}

async function fetchIdeas(scope: DbScope, startDate: string, endDate: string): Promise<IdeaRow[]> {
  const { data, error } = await scope.supabase
    .from("ideas")
    .select("id, text, category, archived, created_at, updated_at")
    .eq("owner_user_id", scope.ownerUserId)
    .gte("created_at", `${startDate}T00:00:00+05:30`)
    .lte("created_at", `${endDate}T23:59:59+05:30`)
    .order("created_at", { ascending: false })
    .limit(MAX_RECORDS_PER_DOMAIN);

  if (error) throw new Error(error.message);
  return (data ?? []) as IdeaRow[];
}

async function fetchPersonalData(scope: DbScope, plan: QuestionPlan, input: string): Promise<PersonalDataBundle> {
  const bundle: PersonalDataBundle = {
    dateRange: { start: plan.startDate, end: plan.endDate },
    domains: plan.domains,
  };

  await Promise.all(
    plan.domains.map(async (domain) => {
      if (domain === "workouts") {
        bundle.workouts = await fetchWorkouts(scope, plan.startDate, plan.endDate);
        if (bundle.workouts.length >= MAX_WORKOUT_RECORDS) {
          bundle.retrievalNote =
            `Workout retrieval limited to the latest ${MAX_WORKOUT_RECORDS} records in the requested date range.`;
        }
      }
      if (domain === "food") bundle.food = await fetchFood(scope, plan.startDate, plan.endDate);
      if (domain === "spending") bundle.spending = await fetchSpending(scope, plan.startDate, plan.endDate);
      if (domain === "calendar") {
        bundle.timeBlocks = await fetchTimeBlocks(scope, plan.startDate, plan.endDate);
      }
      if (domain === "ideas") bundle.ideas = await fetchIdeas(scope, plan.startDate, plan.endDate);
    })
  );

  if (bundle.workouts && isChestWorkoutQuestion(input)) {
    bundle.workouts = latestChestWorkouts(bundle.workouts, 2);
    bundle.retrievalNote = [
      bundle.retrievalNote,
      "Chest workout question: searched retrieved workout history and included only sessions whose workout title matches chest/pecs/pectorals.",
    ].filter(Boolean).join(" ");
  }

  return bundle;
}

export async function answerPersonalQuestion(
  input: string,
  nowContext: string,
  today: string,
  scope: DbScope,
  conversationContext?: string
): Promise<string> {
  const contextualQuestion = conversationContext
    ? `Recent conversation:\n${conversationContext}\n\nCurrent message: ${input}`
    : input;
  const plan = await planQuestion(contextualQuestion, nowContext, today, input);
  const data = await fetchPersonalData(scope, plan, input);

  const system = `You answer questions about the user's personal dashboard data.
Only use the provided JSON data. Do not invent missing records, dates, exercises, amounts, or calendar events.
If the JSON has no relevant records, say that clearly and mention the date range checked.
For spending, include totals when useful. For workouts, infer the user's requested focus from the question, session title, and exercise names, then include session title, date, exercise, sets, reps, weights, and notes when present.
For food, include calories/protein when useful. For calendar, include Dash schedule blocks when present.
Use the recent conversation only to resolve follow-ups like "from last week", "that one", or omitted subjects. Answer the current message.
Telegram formatting rules:
- Never use Markdown tables; Telegram renders them badly.
- Write a compact answer card: bold title, date/range line, then grouped bullets.
- For workouts, group by exercise name and put every set on its own line. Never collapse repeated sets into one bullet. Even if weight, reps, and notes are identical, list each set separately so mobile readers can scan them easily. If reps are 0, say "no reps recorded" instead of "0 reps". Use "bodyweight" when weight is 0 or clearly bodyweight.
- When a workout has multiple exercises, keep the exercise name on its own line and then list the sets underneath it as separate bullets or separate lines.
- If the question asks for last/latest/most recent workout, answer with the single latest relevant record before today's already logged workout records unless the user explicitly asked for today or is asking for chest workouts. Mention if you skipped today or another excluded period.
- If the question asks for chest workouts or the last chest workout, show the latest two chest workout records from the retrieved data. Do not impose a one-week, 30-day, or other recent-window limit unless the user explicitly gave that date range.
- If the user asks for chest/pecs/pectorals, decide relevance only from the workout session title, not exercise names.
- If multiple records matter, show the most relevant 2-4 records and summarize the rest.
- Keep lines short and skimmable on mobile.
- Use only simple Markdown bold for headings.
Keep Telegram replies concise, plain Markdown-safe text, under 3500 characters.`;

  try {
    const response = await getGroqClient().chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Current time: ${nowContext}
Question: ${input}
${conversationContext ? `Recent conversation:\n${conversationContext}\n` : ""}
Question plan: ${compactJson(plan)}
Retrieved data: ${compactJson(data)}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 900,
    });

    const answer = response.choices[0]?.message?.content?.trim();
    if (answer) return sanitizeTelegramMarkdown(answer);
  } catch (error) {
    console.error("[Intelligence] Answer synthesis failed:", error);
  }

  return sanitizeTelegramMarkdown(
    `I checked ${plan.domains.join(", ")} from ${plan.startDate} to ${plan.endDate}, but I could not generate a reliable answer from the retrieved data.`
  );
}
