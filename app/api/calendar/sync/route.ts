import { NextRequest, NextResponse } from "next/server";
import { syncGoogleCalendarEventsForRange } from "@/lib/calendar-sync";
import { getDefaultOwnerDb, getUserScopedDb } from "@/lib/owner-scope";
import { currentIstDate } from "@/lib/time";

const MAX_SYNC_DAYS = 31;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Invalid request";
}

function parseDate(date: string): Date {
  return new Date(`${date}T00:00:00+05:30`);
}

function validateDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function countDays(startDate: string, endDate: string): number {
  const start = parseDate(startDate).getTime();
  const end = parseDate(endDate).getTime();
  return Math.max(0, Math.floor((end - start) / 86_400_000) + 1);
}

async function resolveSyncScope(req: NextRequest) {
  const secret = process.env.CALENDAR_SYNC_SECRET;
  const providedSecret = req.headers.get("x-calendar-sync-secret");
  if (secret && providedSecret === secret) {
    return getDefaultOwnerDb();
  }
  return getUserScopedDb();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const today = currentIstDate();
    const startDate = validateDate(body.startDate) ? body.startDate : today;
    const endDate = validateDate(body.endDate) ? body.endDate : startDate;
    const days = countDays(startDate, endDate);

    if (days < 1 || days > MAX_SYNC_DAYS) {
      return NextResponse.json(
        { error: `Calendar sync range must be between 1 and ${MAX_SYNC_DAYS} days.` },
        { status: 400 }
      );
    }

    const scope = await resolveSyncScope(req);
    const results = await syncGoogleCalendarEventsForRange(startDate, endDate, scope);
    return NextResponse.json({ ok: true, startDate, endDate, results });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}
