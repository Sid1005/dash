import { NextRequest, NextResponse } from "next/server";
import { handleNaturalLanguage } from "@/lib/actions";
import { getDefaultOwnerDb } from "@/lib/owner-scope";
import { insertFoodEntry } from "@/lib/food-supabase";
import { currentIstDate, currentIstTime } from "@/lib/time";

/** Reuse the LLM parser (categorization, macro estimation) — allow it time to run. */
export const maxDuration = 30;

/**
 * Token-authed food ingress for one-tap clients (iOS Shortcut, widgets).
 *
 * Auth: `x-api-key: <QUICK_LOG_SECRET>` (same header the proxy uses to admit
 * system/cron callers).
 *
 * Body — either freeform (LLM-parsed + calorie/protein estimation):
 *   { "input": "3 eggs and toast for breakfast" }
 * or structured (instant, no LLM):
 *   { "name": "Eggs and toast", "calories": 350, "protein_g": 18, "meal": "breakfast" }
 *
 * `date`/`now` are optional ISO/IST overrides; default to current IST.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.QUICK_LOG_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "QUICK_LOG_SECRET not configured" }, { status: 500 });
  }

  const token = (req.headers.get("x-api-key") ?? "").trim();
  if (token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const date = typeof body.date === "string" && body.date ? body.date : currentIstDate();
  const time = typeof body.now === "string" && body.now ? body.now : currentIstTime();
  const scope = await getDefaultOwnerDb();

  try {
    // Freeform path: reuse the natural language parser (identifies calories/protein + estimates them).
    if (typeof body.input === "string" && body.input.trim()) {
      const { message } = await handleNaturalLanguage(body.input.trim(), date, time, scope);
      return NextResponse.json({ ok: true, message });
    }

    // Structured path: instant insert, no LLM round-trip.
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 200) : "Food Log";
    const calories = typeof body.calories === "number" ? body.calories : Number(body.calories ?? 0);
    const protein_g = typeof body.protein_g === "number" ? body.protein_g : Number(body.protein_g ?? 0);
    const cost = typeof body.cost === "number" ? body.cost : Number(body.cost ?? 0);
    const meal = typeof body.meal === "string" && body.meal ? body.meal : "other";
    const estimated = typeof body.estimated === "boolean" ? body.estimated : false;

    const row = await insertFoodEntry(
      date,
      {
        name,
        calories,
        protein_g,
        cost,
        time,
        meal,
        estimated,
      },
      scope
    );

    const estLabel = row.estimated ? " (estimated)" : "";
    return NextResponse.json({
      ok: true,
      message: `Logged ${row.name}: ${row.calories} cal, ${row.protein_g}g protein${estLabel}`,
      id: row.id,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
