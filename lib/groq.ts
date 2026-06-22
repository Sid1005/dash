import OpenAI from "openai";

export const GROQ_MODEL = "openai/gpt-oss-120b";

let groqClient: OpenAI | undefined;

export function getGroqClient(): OpenAI {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("Missing GROQ_API_KEY.");

    groqClient = new OpenAI({
      apiKey,
      baseURL: "https://api.groq.com/openai/v1",
    });
  }

  return groqClient;
}
