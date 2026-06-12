import { NextRequest, NextResponse } from "next/server";
import { listAllQuotes, insertQuote, deleteQuote } from "@/lib/quotes-supabase";
import { getUserScopedDb } from "@/lib/owner-scope";

export async function GET() {
  try {
    const quotes = await listAllQuotes(await getUserScopedDb());
    return NextResponse.json({ quotes });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { text, author } = await req.json();
    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Quote text is required" }, { status: 400 });
    }
    const quote = await insertQuote(text.trim(), author?.trim(), await getUserScopedDb());
    return NextResponse.json({ quote });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Quote ID is required" }, { status: 400 });
    }
    await deleteQuote(id, await getUserScopedDb());
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
