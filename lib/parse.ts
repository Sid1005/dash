import OpenAI from "openai";
import { getGroqClient, GROQ_MODEL } from "@/lib/groq";
import { SPEND_CATEGORIES } from "@/lib/spending";
import { normalizeStandaloneCalendarInput } from "./calendar-input";

let openCodeClient: OpenAI | undefined;

function getOpenCodeClient(): OpenAI {
  if (!openCodeClient) {
    const apiKey = process.env.OPENCODE_API_KEY;
    if (!apiKey) {
      throw new Error("Missing OPENCODE_API_KEY. Add it in env for image parsing.");
    }
    openCodeClient = new OpenAI({
      apiKey,
      baseURL: "https://opencode.ai/zen/go/v1",
    });
  }
  return openCodeClient;
}


const PARSER_SYSTEM_PROMPT = `You are a personal dashboard assistant. Your task is to classify and parse the user's natural language input by calling the appropriate tool.
Current time: {now}

Classification rules (read the entire message before choosing a tool):
- Choose based on the user's intent and the structure of the whole message, not individual topic words.
- For diet / food logs:
  - Use food tools when the message clearly reports food that was eaten or consumed. A meal label by itself does not establish a food log.
  - Be conservative when guessing calories and protein_g. Single casual meal protein rarely exceeds 35-40g. Lean meat portions: 22-28g protein. Bowl of oatmeal: 8-14g protein.
  - If the user lists several foods for one meal, use log_food for the combined meal.
  - Use log_multiple_food only when the message clearly separates multiple meals, such as breakfast/lunch/dinner/snack labels or separate time-based meal sections.
  - When using log_multiple_food, keep one entry per meal section and give each entry the meal title as its name when available.
  - Use log_food only for a single food item or single combined meal.
- For workout logs:
  - Use log_workout when the message records a workout that happened and contains one or more exercises. A workout does not have to include sets or reps.
  - If an exercise has a bare number but no reps, weight unit, or set count, treat that number as reps with weight_kg: 0.
  - If an exercise has no reps, set count, or weight, still log it with reps: 0 and weight_kg: 0.
  - Only treat a number as weight when the user includes a weight unit or wording such as kg, kilos, lbs, pounds, weighted, or at.
  - Examples: "Bench press 3 sets of 10 at 50kg", "Squats 5x5 at 80kg", or "Squats 150".
- For unsupported notes / journals:
  - Do not save generic notes or journal entries. Use chat_response to say the message was not saved and ask for a supported log type if needed.
- For calendar events:
  - Use create_calendar_event for a scheduled commitment, appointment, reservation, meeting, or other event.
  - An activity expressed with an explicit start-to-end time span or duration is a scheduled event unless the full message clearly reports a completed record in another supported category.
  - If an event has a start time but no end time or duration, omit the end; it will be scheduled for 30 minutes.
  - Use update_calendar_event only when the user asks to move, rename, reschedule, or otherwise edit an existing event.
  - Use delete_calendar_event only when the user asks to cancel, remove, or delete an existing event.
- For tasks / to-do items:
  - If the user provides a list of multiple tasks/to-do items (e.g., multiple lines, a bulleted/numbered list, or multiple distinct actions to be done in the future), use add_tasks.
  - If the user provides a single task, use add_task.
  - Examples: "Pick up Mom at 5pm" or "Gym at 8pm".
- For combined food and spending (e.g., "spent 200 on chicken rice"):
  - Use log_food_and_spending.
`;

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "log_workout",
      description: "Record a completed workout containing at least one exercise. Sets and reps are optional; for bare-number entries like 'Squats 150', use one set with reps 150 and weight_kg 0. For exercise-only entries, use reps 0 and weight_kg 0.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD format if specified, otherwise omit." },
          muscle_group: { type: "string", description: "Target muscle group if specified." },
          exercises: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Name of the exercise (e.g. Bench Press)." },
                sets: {
                  type: "array",
                  minItems: 1,
                  items: {
                    type: "object",
                    properties: {
                      reps: { type: "integer", description: "Reps completed. Use 0 when reps were not specified." },
                      weight_kg: { type: "number", description: "Weight in kg. If bodyweight or the user provides a bare number without a weight unit, use 0." }
                    },
                    required: ["reps", "weight_kg"]
                  }
                },
                notes: { type: "string" }
              },
              required: ["name", "sets"]
            }
          }
        },
        required: ["exercises"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "log_multiple_food",
      description: "Log multiple foods or meals eaten from a single message.",
      parameters: {
        type: "object",
        properties: {
          entries: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Name of the food item, dish, or meal component." },
                calories: { type: "number", description: "Calories in kcal." },
                protein_g: { type: "number", description: "Protein in grams." },
                estimated: { type: "boolean", description: "Set to true if macros are estimated from dish name/portion, false if exact values provided." },
                cost: { type: "number", description: "Cost of the food if specified." },
                time: { type: "string", description: "Time when food was eaten in 24-hour HH:MM format." },
                meal: { type: "string", description: "breakfast, lunch, dinner, snack, etc." }
              },
              required: ["name", "calories", "protein_g", "estimated"]
            }
          },
          date: { type: "string", description: "YYYY-MM-DD format if specified, otherwise omit." }
        },
        required: ["entries"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "log_food",
      description: "Log food eaten with estimated or exact calories and protein.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name of the food item or dish." },
          calories: { type: "number", description: "Calories in kcal." },
          protein_g: { type: "number", description: "Protein in grams." },
          estimated: { type: "boolean", description: "Set to true if macros are estimated from dish name only, false if exact values provided." },
          cost: { type: "number", description: "Cost of the food if specified." },
          time: { type: "string", description: "Time when food was eaten in 24-hour HH:MM format." },
          meal: { type: "string", description: "breakfast, lunch, dinner, snack, etc." },
          date: { type: "string", description: "YYYY-MM-DD format if specified, otherwise omit." }
        },
        required: ["name", "calories", "protein_g", "estimated"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "log_spending",
      description: "Log money spent / purchases.",
      parameters: {
        type: "object",
        properties: {
          item: { type: "string", description: "Description of what was purchased." },
          amount: { type: "number", description: "Amount spent." },
          category: { type: "string", enum: [...SPEND_CATEGORIES], description: "Category of the spend (Food, Transport, Health, Entertainment, Shopping, Other)." },
          time: { type: "string", description: "Time when spent in 24-hour HH:MM format." },
          date: { type: "string", description: "YYYY-MM-DD format if specified, otherwise omit." }
        },
        required: ["item", "amount", "category"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "log_multiple_spending",
      description: "Log multiple spending entries / expenses from a single message.",
      parameters: {
        type: "object",
        properties: {
          expenses: {
            type: "array",
            items: {
              type: "object",
              properties: {
                item: { type: "string", description: "Description of what was purchased." },
                amount: { type: "number", description: "Amount spent." },
                category: { type: "string", enum: [...SPEND_CATEGORIES], description: "Category of the spend (Food, Transport, Health, Entertainment, Shopping, Other)." },
                time: { type: "string", description: "Time when spent in 24-hour HH:MM format." }
              },
              required: ["item", "amount", "category"]
            }
          },
          date: { type: "string", description: "YYYY-MM-DD format if specified, otherwise omit." }
        },
        required: ["expenses"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "log_food_and_spending",
      description: "Log a food item and the money spent on it at the same time.",
      parameters: {
        type: "object",
        properties: {
          food: {
            type: "object",
            properties: {
              name: { type: "string" },
              calories: { type: "number" },
              protein_g: { type: "number" },
              estimated: { type: "boolean", description: "Set to true if macros are estimated, false if exact values provided." },
              time: { type: "string", description: "Time in 24-hour HH:MM format." },
              meal: { type: "string" }
            },
            required: ["name", "calories", "protein_g", "estimated"]
          },
          spending: {
            type: "object",
            properties: {
              item: { type: "string" },
              amount: { type: "number" },
              category: { type: "string", enum: [...SPEND_CATEGORIES], description: "Category of the spend." },
              time: { type: "string", description: "Time in 24-hour HH:MM format." }
            },
            required: ["item", "amount", "category"]
          },
          date: { type: "string", description: "YYYY-MM-DD format if specified, otherwise omit." }
        },
        required: ["food", "spending"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_calendar_event",
      description: "Create a new Dash calendar event for a scheduled commitment, appointment, reservation, or meeting. When no end time is supplied, the event defaults to 30 minutes.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Concise event title, excluding the location and times." },
          date: { type: "string", description: "Event date in YYYY-MM-DD format, resolved from the current-time context." },
          start: { type: "string", description: "Start time in 24-hour HH:MM format." },
          end: { type: "string", description: "End time in 24-hour HH:MM format when stated. Omit to use the 30-minute default." },
          end_date: { type: "string", description: "End date in YYYY-MM-DD format only when the event ends on a different day." },
          location: { type: "string", description: "Event location when stated." },
          description: { type: "string", description: "Optional event notes when stated." }
        },
        required: ["title", "date", "start"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_calendar_event",
      description: "Edit an existing Dash calendar event. Identify the existing event by its current title and date, and include only fields the user wants changed.",
      parameters: {
        type: "object",
        properties: {
          event_title: { type: "string", description: "Current title, or distinctive words from the current title, used to find the event." },
          event_date: { type: "string", description: "Current event date in YYYY-MM-DD format, resolved from context." },
          new_title: { type: "string", description: "Replacement title, only if requested." },
          new_date: { type: "string", description: "Replacement date in YYYY-MM-DD format, only if requested." },
          new_start: { type: "string", description: "Replacement start time in 24-hour HH:MM format, only if requested." },
          new_end: { type: "string", description: "Replacement end time in 24-hour HH:MM format, only if requested." },
          new_location: { type: "string", description: "Replacement location, only if requested." },
          new_description: { type: "string", description: "Replacement description, only if requested." }
        },
        required: ["event_title", "event_date"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_calendar_event",
      description: "Delete or cancel an existing Dash calendar event. Identify it by its current title and date. Never use this to mark a task complete.",
      parameters: {
        type: "object",
        properties: {
          event_title: { type: "string", description: "Current title, or distinctive words from the current title, used to find the event." },
          event_date: { type: "string", description: "Current event date in YYYY-MM-DD format, resolved from context." }
        },
        required: ["event_title", "event_date"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "add_task",
      description: "Add something the user intends to do, optionally with a due or reminder time. Examples include 'Pick up Mom at 5pm' and 'Gym at 8pm'.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Title of the task." },
          due_date: { type: "string", description: "When the task is due. Can be 'today', 'tomorrow', or 'YYYY-MM-DD' format." },
          due_time: { type: "string", description: "Specific time when task is due in 24-hour HH:MM format." },
          due_in_minutes: { type: "integer", description: "Positive integer representing relative time in minutes from now (e.g. 'in 2 hours' -> 120). Use this for relative offsets." }
        },
        required: ["title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "add_tasks",
      description: "Add multiple tasks / to-do items from a single message.",
      parameters: {
        type: "object",
        properties: {
          tasks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string", description: "Title of the task." },
                due_date: { type: "string", description: "When the task is due. Can be 'today', 'tomorrow', or 'YYYY-MM-DD' format." },
                due_time: { type: "string", description: "Specific time when task is due in 24-hour HH:MM format." },
                due_in_minutes: { type: "integer", description: "Positive integer representing relative time in minutes from now (e.g. 'in 2 hours' -> 120). Use this for relative offsets." }
              },
              required: ["title"]
            }
          }
        },
        required: ["tasks"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "log_idea",
      description: "Log a new idea (a problem to work on, something interesting to build, change in company, or something to work on).",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "Description of the idea." }
        },
        required: ["text"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "log_problem",
      description: "Log a new active problem / bottleneck / issue the user is trying to solve.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "Description of the problem." }
        },
        required: ["text"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "chat_response",
      description: "Generate a conversational response when the user is chatting, asking a question, or providing conversational input.",
      parameters: {
        type: "object",
        properties: {
          response: { type: "string", description: "Helpful, concise assistant response." }
        },
        required: ["response"]
      }
    }
  }
];

export interface ParsedAction {
  type:
    | "food"
    | "multiple_food"
    | "spending"
    | "multiple_spending"
    | "food_and_spending"
    | "calendar_event_create"
    | "calendar_event_update"
    | "calendar_event_delete"
    | "task"
    | "tasks"
    | "idea"
    | "workout"
    | "chat"
    | "problem";
  data: Record<string, unknown>;
}

type ParsedFoodEntry = {
  name: string;
  meal_title?: string;
  calories: number;
  protein_g: number;
  estimated: boolean;
  cost?: number;
  time?: string;
  meal?: string;
};

const MEAL_LABELS = new Set(["breakfast", "lunch", "dinner", "snack", "snacks", "brunch", "supper"]);

function normalizeMealLabel(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const label = value.trim().toLowerCase();
  if (!label) return undefined;
  if (label === "snacks") return "snack";
  return MEAL_LABELS.has(label) ? label : undefined;
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function isMealOnlyEntry(entry: ParsedFoodEntry): boolean {
  const meal = normalizeMealLabel(entry.meal);
  if (!meal) return false;
  const name = entry.name.trim().toLowerCase();
  return name === meal || name === `${meal} meal` || name === `${meal} plate`;
}

function combineFoodEntries(entries: ParsedFoodEntry[]): ParsedFoodEntry {
  const meal = normalizeMealLabel(entries[0]?.meal) ?? (isMealOnlyEntry(entries[0]) ? normalizeMealLabel(entries[0].name) : undefined);
  const joinedName = entries
    .map((entry) => entry.name.trim())
    .filter(Boolean)
    .join(", ");
  return {
    name: meal ? titleCase(meal) : joinedName.slice(0, 200),
    meal_title: meal ? titleCase(meal) : undefined,
    calories: entries.reduce((sum, entry) => sum + (Number(entry.calories) || 0), 0),
    protein_g: entries.reduce((sum, entry) => sum + (Number(entry.protein_g) || 0), 0),
    estimated: entries.some((entry) => entry.estimated),
    cost: entries.reduce((sum, entry) => sum + (Number(entry.cost) || 0), 0),
    time: entries.find((entry) => entry.time)?.time,
    meal,
  };
}

function normalizeParsedFoodAction(action: ParsedAction): ParsedAction {
  if (action.type === "food") {
    const entry = action.data as unknown as ParsedFoodEntry;
    const meal = normalizeMealLabel(entry.meal) ?? (isMealOnlyEntry(entry) ? normalizeMealLabel(entry.name) : undefined);
    return {
      ...action,
      data: {
        ...action.data,
        meal,
        name: meal ? titleCase(meal) : entry.name,
        meal_title: meal ? titleCase(meal) : undefined,
      },
    };
  }

  if (action.type !== "multiple_food") return action;

  const entries = ((action.data.entries ?? []) as ParsedFoodEntry[]).filter((entry) => entry && typeof entry.name === "string");
  if (entries.length === 0) return action;

  const labeledMeals = entries.map((entry) => normalizeMealLabel(entry.meal)).filter(Boolean) as string[];
  const uniqueMeals = new Set(labeledMeals);
  const hasClearMealSections = uniqueMeals.size > 1;
  const allEntriesShareOneMeal = uniqueMeals.size === 1;
  const allEntriesAreMealOnly = entries.every(isMealOnlyEntry);

  if (hasClearMealSections) {
    const grouped = new Map<string, ParsedFoodEntry[]>();
    const unlabeled: ParsedFoodEntry[] = [];
    for (const entry of entries) {
      const meal = normalizeMealLabel(entry.meal);
      if (meal) {
        const list = grouped.get(meal) ?? [];
        list.push({ ...entry, meal });
        grouped.set(meal, list);
      } else {
        unlabeled.push(entry);
      }
    }

    const normalizedEntries = [
      ...Array.from(grouped.entries()).map(([meal, mealEntries]) => combineFoodEntries(mealEntries.map((entry) => ({ ...entry, meal })))),
      ...(unlabeled.length > 0 ? [combineFoodEntries(unlabeled)] : []),
    ];

    return { ...action, type: "multiple_food", data: { ...action.data, entries: normalizedEntries } };
  }

  if (allEntriesShareOneMeal || allEntriesAreMealOnly) {
    return {
      ...action,
      type: "food",
      data: combineFoodEntries(entries),
    };
  }

  return {
    ...action,
    type: "food",
    data: combineFoodEntries(entries),
  };
}

export async function parseInput(
  input: string,
  now: string,
  pendingAction?: ParsedAction,
  base64Image?: string
): Promise<ParsedAction> {
  const isVision = !!base64Image;
  const client = isVision ? getOpenCodeClient() : getGroqClient();
  const modelName = isVision ? "kimi-k2.6" : GROQ_MODEL;
  const normalizedInput = normalizeStandaloneCalendarInput(input);

  try {
    let response;
    const maxAttempts = 3;
    let delayMs = 500;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: PARSER_SYSTEM_PROMPT.replace("{now}", now) },
    ];

    if (pendingAction) {
      messages.push({
        role: "system",
        content: `Active Pending Action (awaiting user confirmation):
${JSON.stringify(pendingAction, null, 2)}

The user's input might be a correction, refinement, or modification to the fields of this active pending action (e.g., changing the amount, description/item/title, category, time, etc.).
If the user's input is correcting or adjusting the pending action, you MUST output an updated version of the action (call the appropriate tool with the updated fields, preserving any unchanged fields from the pending action).
If the user's input is a completely new command, ignore the pending action and parse the input as a new action normally.`,
      });
    }

    if (isVision) {
      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: `Current time: ${now}\n\nInput: ${normalizedInput || "Analyze the attached image."}`
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`
            }
          }
        ]
      });
    } else {
      messages.push({ role: "user", content: `Current time: ${now}\n\nInput: ${normalizedInput}` });
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        response = await client.chat.completions.create({
          model: modelName,

          messages,
          tools: TOOLS,
          tool_choice: "auto",
          max_tokens: 1024,
        });
        break; // Success! Break the retry loop
      } catch (err: unknown) {
        console.error(`[Parser] LLM attempt ${attempt} failed:`, err);
        
        // Do not retry on permanent client errors (4xx other than 429)
        const maybeError = err as { status?: number; statusCode?: number };
        const status = maybeError.status || maybeError.statusCode;
        if (status && status >= 400 && status < 500 && status !== 429) {
          throw err;
        }

        if (attempt === maxAttempts) {
          throw err; // Out of attempts, propagate error to fallback handler
        }

        const jitter = Math.random() * 200;
        console.log(`[Parser] Retrying in ${Math.round(delayMs + jitter)}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs + jitter));
        delayMs *= 2; // Exponential backoff
      }
    }

    if (!response) {
      throw new Error("No response received from LLM client");
    }

    const choice = response.choices[0];
    const toolCalls = choice?.message?.tool_calls;

    if (!toolCalls || toolCalls.length === 0) {
      const text = choice?.message?.content?.trim() || "";
      if (text) {
        return { type: "chat", data: { response: text } };
      }
      return { type: "chat", data: { response: "I could not classify that as a supported log, so I did not save it." } };
    }

    const toolCall = toolCalls[0];
    if (toolCall.type !== "function") {
      return { type: "chat", data: { response: "I could not classify that as a supported log, so I did not save it." } };
    }
    const name = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments || "{}");

    console.log(`[Parser] Input: "${input}" resolved to tool call: ${name} with args:`, args);

    let parsedAction: ParsedAction;
    switch (name) {
      case "log_workout":
        parsedAction = { type: "workout", data: args };
        break;
      case "log_food":
        parsedAction = { type: "food", data: args };
        break;
      case "log_multiple_food":
        parsedAction = { type: "multiple_food", data: args };
        break;
      case "log_spending":
        parsedAction = { type: "spending", data: args };
        break;
      case "log_multiple_spending":
        parsedAction = { type: "multiple_spending", data: args };
        break;
      case "log_food_and_spending":
        parsedAction = { type: "food_and_spending", data: args };
        break;
      case "create_calendar_event":
        parsedAction = { type: "calendar_event_create", data: args };
        break;
      case "update_calendar_event":
        parsedAction = { type: "calendar_event_update", data: args };
        break;
      case "delete_calendar_event":
        parsedAction = { type: "calendar_event_delete", data: args };
        break;
      case "add_task":
        parsedAction = { type: "task", data: args };
        break;
      case "add_tasks":
        parsedAction = { type: "tasks", data: args };
        break;
      case "log_idea":
        parsedAction = { type: "idea", data: args };
        break;
      case "log_problem":
        parsedAction = { type: "problem", data: args };
        break;
      case "chat_response":
      default:
        parsedAction = { type: "chat", data: args };
        break;
    }
    return normalizeParsedFoodAction(parsedAction);
  } catch (err) {
    console.error("[Parser] Tool calling parsing failed, not saving input:", err);
    return { type: "chat", data: { response: "I could not classify that as a supported log, so I did not save it." } };
  }
}
