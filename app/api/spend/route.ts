import { NextRequest, NextResponse } from "next/server";
import { handleNaturalLanguage } from "@/lib/actions";
import { getDefaultOwnerDb } from "@/lib/owner-scope";
import { insertSpending } from "@/lib/spending-supabase";
import { matchSpendCategory } from "@/lib/spending";
import { currentIstDate, currentIstTime } from "@/lib/time";

/** Reuse the LLM parser (categorization, multi-item) — allow it time to run. */
export const maxDuration = 30;

/**
 * Token-authed spend ingress for one-tap clients (iOS Shortcut, widgets).
 *
 * Auth: `x-api-key: <QUICK_LOG_SECRET>` (same header the proxy uses to admit
 * system/cron callers).
 *
 * Body — either freeform (LLM-parsed + auto-categorized):
 *   { "input": "320 zomato" }
 * or structured (instant, no LLM):
 *   { "amount": 320, "item": "Zomato", "category": "Food" }
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
    // Freeform path: reuse the same parser the web app and Telegram bot use.
    if (typeof body.input === "string" && body.input.trim()) {
      const { message } = await handleNaturalLanguage(body.input.trim(), date, time, scope);
      return NextResponse.json({ ok: true, message });
    }

    // Structured path: instant insert, no LLM round-trip.
    // Tolerate strings with currency symbols / commas / spaces, e.g. "₹1,250.00".
    const rawAmount = body.amount;
    const amount =
      typeof rawAmount === "number"
        ? rawAmount
        : Number(String(rawAmount ?? "").replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        {
          error: "amount must be a non-negative number",
          hint: "Send either {\"input\":\"spent 50 on coffee\"} or {\"amount\":50,\"item\":\"coffee\"}.",
        },
        { status: 400 }
      );
    }
    const item = typeof body.item === "string" && body.item.trim() ? body.item.trim().slice(0, 200) : "Spend";
    const category = matchSpendCategory(body.category);

    const row = await insertSpending(date, { item, amount, category, time }, scope);
    return NextResponse.json({
      ok: true,
      message: `Logged ${item}: ₹${amount} (${category})`,
      id: row.id,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
