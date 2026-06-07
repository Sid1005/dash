import { NextRequest, NextResponse } from "next/server";
import { listActiveIdeas, listAllIdeas, insertIdea, listUniqueCategories } from "@/lib/ideas-supabase";
import { classifyIdea } from "@/lib/classify-idea";

export async function GET(req: NextRequest) {
  try {
    const showAll = req.nextUrl.searchParams.get("all") === "true";
    const ideas = showAll ? await listAllIdeas() : await listActiveIdeas();
    return NextResponse.json({ ideas });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Idea text is required" }, { status: 400 });
    }

    // Fetch existing categories to let LLM decide if it fits any of them
    const existingCategories = await listUniqueCategories();
    
    // Classify the idea text dynamically
    const category = await classifyIdea(text.trim(), existingCategories);
    
    const idea = await insertIdea(text.trim(), category);
    return NextResponse.json({ idea });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
