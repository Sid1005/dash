import { getGroqClient, GROQ_MODEL } from "@/lib/groq";

/**
 * Dynamically classifies a new idea. It either maps it to an existing category
 * if it is similar, or invents a new concise category.
 */
export async function classifyIdea(text: string, existingCategories: string[]): Promise<string> {
  // If there's no GROQ_API_KEY, just fallback to General without crashing
  if (!process.env.GROQ_API_KEY) {
    console.warn("GROQ_API_KEY is not defined. Defaulting category to General.");
    return "General";
  }

  const client = getGroqClient();
  const categoriesList = existingCategories.length > 0 ? existingCategories.join(", ") : "None";
  
  const systemPrompt = `You are an AI idea organizer. Your task is to dynamically assign a category to a new idea.
Existing categories: [${categoriesList}]

Rules:
1. If the new idea is similar to an existing category, you MUST return that exact category name from the list. Matching should be semantically smart (e.g. "Do what Nutanix is doing but agentic" and "Podcast in Nutanix" should both map to a category like "Nutanix" or "Startup Ideas" if that exists).
2. If it is a new type of idea that doesn't fit any existing category, suggest a new, concise, capitalized category name (1-3 words, e.g. "Startup Ideas", "Agentic AI", "Creator Tools", "Life Hacks", "Internal Process").
3. Return ONLY the category name as plain text. Do not include quotes, periods, explanation, or markdown formatting. Keep the response to just the category name.`;

  try {
    const response = await client.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Idea: "${text}"` }
      ],
      max_tokens: 30,
      temperature: 0.1,
    });
    
    const category = response.choices[0]?.message?.content?.trim();
    if (category) {
      // Clean up the category name (remove trailing/leading quotes/whitespace/punctuation)
      let cleaned = category.replace(/^['"“`]|['"”`]$/g, "").trim();
      // Remove trailing period if LLM put one
      if (cleaned.endsWith(".")) {
        cleaned = cleaned.slice(0, -1);
      }
      return cleaned || "General";
    }
    return "General";
  } catch (error) {
    console.error("Failed to classify idea via LLM:", error);
    return "General"; // Fallback to General
  }
}
