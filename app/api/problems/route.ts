import { NextRequest, NextResponse } from "next/server";
import { listActiveProblems, listAllProblems, insertProblem } from "@/lib/problems-supabase";
import { getUserScopedDb } from "@/lib/owner-scope";

export async function GET(req: NextRequest) {
  try {
    const showAll = req.nextUrl.searchParams.get("all") === "true";
    const scope = await getUserScopedDb();
    const problems = showAll ? await listAllProblems(scope) : await listActiveProblems(scope);
    return NextResponse.json({ problems });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Problem text is required" }, { status: 400 });
    }
    const problem = await insertProblem(text.trim(), await getUserScopedDb());
    return NextResponse.json({ problem });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
