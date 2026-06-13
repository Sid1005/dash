import { getCalendarEvents } from "@/lib/composio";
import { replaceCalendarEventsForDate } from "@/lib/calendar-events-supabase";
import { type DbScope } from "@/lib/owner-scope";

export type CalendarSyncResult = {
  date: string;
  fetched: number;
  upserted: number;
  removed: number;
};

function parseDate(date: string): Date {
  return new Date(`${date}T00:00:00+05:30`);
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export async function syncGoogleCalendarEventsForDate(
  date: string,
  scope: DbScope
): Promise<CalendarSyncResult> {
  const events = await getCalendarEvents(date);
  const { upserted, removed } = await replaceCalendarEventsForDate(date, events, scope);
  return { date, fetched: events.length, upserted, removed };
}

export async function syncGoogleCalendarEventsForRange(
  startDate: string,
  endDate: string,
  scope: DbScope
): Promise<CalendarSyncResult[]> {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const dayCount = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1);

  return Promise.all(
    Array.from({ length: dayCount }, (_, index) =>
      syncGoogleCalendarEventsForDate(formatDate(addDays(start, index)), scope)
    )
  );
}
