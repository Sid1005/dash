import OpenAI from "openai";

let groqClient: OpenAI | undefined;
let openCodeClient: OpenAI | undefined;

function getGroqClient(): OpenAI {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GROQ_API_KEY. Add it in env for natural-language parsing.");
    }
    groqClient = new OpenAI({
      apiKey,
      baseURL: "https://api.groq.com/openai/v1",
    });
  }
  return groqClient;
}

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
  - If the user sends a list of foods eaten across the day or multiple meals/items, use log_multiple_food. Estimate each item separately.
  - Use log_food only for a single food item or single combined meal.
- For workout logs:
  - Use log_workout only when the message records a workout that happened and contains one or more exercises with concrete set details such as reps and weights.
  - Examples: "Bench press 3 sets of 10 at 50kg" or "Squats 5x5 at 80kg".
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
      description: "Record a completed structured workout containing at least one exercise with concrete set details. Examples include 'Bench press 3 sets of 10 at 50kg' and 'Squats 5x5 at 80kg'.",
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
                      reps: { type: "integer" },
                      weight_kg: { type: "number", description: "Weight in kg. If bodyweight, use 0." }
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
          category: { type: "string", enum: ["Food", "Transport", "Health", "Entertainment", "Shopping", "Other"], description: "Category of the spend (Food, Transport, Health, Entertainment, Shopping, Other)." },
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
                category: { type: "string", enum: ["Food", "Transport", "Health", "Entertainment", "Shopping", "Other"], description: "Category of the spend (Food, Transport, Health, Entertainment, Shopping, Other)." },
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
              category: { type: "string", enum: ["Food", "Transport", "Health", "Entertainment", "Shopping", "Other"], description: "Category of the spend." },
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
      description: "Create a new Google Calendar event for a scheduled commitment, appointment, reservation, or meeting. When no end time is supplied, the event defaults to 30 minutes.",
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
      description: "Edit an existing Google Calendar event. Identify the existing event by its current title and date, and include only fields the user wants changed.",
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
      description: "Delete or cancel an existing Google Calendar event. Identify it by its current title and date. Never use this to mark a task complete.",
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
      name: "log_learning",
      description: "Log a newly learned lesson or fact.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "What was learned." },
          date: { type: "string", description: "YYYY-MM-DD format if specified, otherwise omit." }
        },
        required: ["text"]
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
    | "learning"
    | "idea"
    | "workout"
    | "chat"
    | "problem";
  data: Record<string, unknown>;
}

export async function parseInput(
  input: string,
  now: string,
  pendingAction?: ParsedAction,
  base64Image?: string
): Promise<ParsedAction> {
  const isVision = !!base64Image;
  const client = isVision ? getOpenCodeClient() : getGroqClient();
  const modelName = isVision ? "kimi-k2.6" : "openai/gpt-oss-120b";

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
            text: `Current time: ${now}\n\nInput: ${input || "Analyze the attached image."}`
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
      messages.push({ role: "user", content: `Current time: ${now}\n\nInput: ${input}` });
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

    switch (name) {
      case "log_workout":
        return { type: "workout", data: args };
      case "log_food":
        return { type: "food", data: args };
      case "log_multiple_food":
        return { type: "multiple_food", data: args };
      case "log_spending":
        return { type: "spending", data: args };
      case "log_multiple_spending":
        return { type: "multiple_spending", data: args };
      case "log_food_and_spending":
        return { type: "food_and_spending", data: args };
      case "create_calendar_event":
        return { type: "calendar_event_create", data: args };
      case "update_calendar_event":
        return { type: "calendar_event_update", data: args };
      case "delete_calendar_event":
        return { type: "calendar_event_delete", data: args };
      case "add_task":
        return { type: "task", data: args };
      case "add_tasks":
        return { type: "tasks", data: args };
      case "log_learning":
        return { type: "learning", data: args };
      case "log_idea":
        return { type: "idea", data: args };
      case "log_problem":
        return { type: "problem", data: args };
      case "chat_response":
      default:
        return { type: "chat", data: args };
    }
  } catch (err) {
    console.error("[Parser] Tool calling parsing failed, not saving input:", err);
    return { type: "chat", data: { response: "I could not classify that as a supported log, so I did not save it." } };
  }
}
