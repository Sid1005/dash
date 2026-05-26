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

General guidelines:
- For diet / food logs:
  - Be conservative when guessing calories and protein_g. Single casual meal protein rarely exceeds 35-40g. Lean meat portions: 22-28g protein. Bowl of oatmeal: 8-14g protein.
- For notes / journals:
  - Use log_journal_note for completed actions without duration (e.g., "10 pushups done", "wrote diary"). Set kind to "activity".
- For calendar time blocks:
  - If a time range is vague, use current time context to guess.
- For combined food and spending (e.g., "spent 200 on chicken rice"):
  - Use log_food_and_spending.
`;

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "log_workout",
      description: "Log workout exercises, sets, reps, and weights.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD format if specified, otherwise omit." },
          muscle_group: { type: "string", description: "Target muscle group if specified." },
          exercises: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Name of the exercise (e.g. Bench Press)." },
                sets: {
                  type: "array",
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
      name: "log_time_block",
      description: "Log a single calendar time block.",
      parameters: {
        type: "object",
        properties: {
          start: { type: "string", description: "Start time in 24-hour HH:MM format." },
          end: { type: "string", description: "End time in 24-hour HH:MM format." },
          activity: { type: "string", description: "Description of the activity." },
          category: { type: "string", enum: ["Deep Work", "Admin", "Meetings", "Personal", "Health", "Learning", "Other"], description: "Category of activity (Deep Work, Admin, Meetings, Personal, Health, Learning, Other)." },
          date: { type: "string", description: "YYYY-MM-DD format if specified, otherwise omit." }
        },
        required: ["start", "end", "activity", "category"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "log_time_blocks",
      description: "Log multiple calendar time blocks from a single message.",
      parameters: {
        type: "object",
        properties: {
          blocks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                start: { type: "string", description: "Start time in 24-hour HH:MM format." },
                end: { type: "string", description: "End time in 24-hour HH:MM format." },
                activity: { type: "string" },
                category: { type: "string", enum: ["Deep Work", "Admin", "Meetings", "Personal", "Health", "Learning", "Other"], description: "Category of activity." }
              },
              required: ["start", "end", "activity", "category"]
            }
          },
          date: { type: "string", description: "YYYY-MM-DD format if specified, otherwise omit." }
        },
        required: ["blocks"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "add_task",
      description: "Add a task / to-do item with due date or time.",
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
      name: "log_goal",
      description: "Log a new goal.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "Description of the goal." }
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
      name: "log_journal_note",
      description: "Log a general note or activity.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "Content of the note." },
          time: { type: "string", description: "Time in 24-hour HH:MM format if specified." },
          kind: { type: "string", enum: ["note", "activity", "agent_event"], description: "Default is 'note'. Use 'activity' for completed actions without duration (e.g., '10 pushups done', 'meditated 10 mins')." },
          date: { type: "string", description: "YYYY-MM-DD format if specified, otherwise omit." }
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
    | "spending"
    | "multiple_spending"
    | "food_and_spending"
    | "time_block"
    | "time_blocks"
    | "task"
    | "learning"
    | "goal"
    | "note"
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
      } catch (err: any) {
        console.error(`[Parser] LLM attempt ${attempt} failed:`, err);
        
        // Do not retry on permanent client errors (4xx other than 429)
        const status = err?.status || err?.statusCode;
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
      return { type: "note", data: { text: input } };
    }

    const toolCall = toolCalls[0];
    if (toolCall.type !== "function") {
      return { type: "note", data: { text: input } };
    }
    const name = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments || "{}");

    console.log(`[Parser] Input: "${input}" resolved to tool call: ${name} with args:`, args);

    switch (name) {
      case "log_workout":
        return { type: "workout", data: args };
      case "log_food":
        return { type: "food", data: args };
      case "log_spending":
        return { type: "spending", data: args };
      case "log_multiple_spending":
        return { type: "multiple_spending", data: args };
      case "log_food_and_spending":
        return { type: "food_and_spending", data: args };
      case "log_time_block":
        return { type: "time_block", data: args };
      case "log_time_blocks":
        return { type: "time_blocks", data: args };
      case "add_task":
        return { type: "task", data: args };
      case "log_learning":
        return { type: "learning", data: args };
      case "log_goal":
        return { type: "goal", data: args };
      case "log_problem":
        return { type: "problem", data: args };
      case "log_journal_note":
        return { type: "note", data: args };
      case "chat_response":
      default:
        return { type: "chat", data: args };
    }
  } catch (err) {
    console.error("[Parser] Tool calling parsing failed, returning raw input as note:", err);
    return { type: "note", data: { text: input } };
  }
}
