import type { CalendarEvent } from "@/lib/composio";
import { type DbScope, resolveDbScope } from "@/lib/owner-scope";

type CalendarEventRow = {
  id: string;
  external_event_id: string;
  title: string;
  start_at: string;
  end_at: string;
  location: string | null;
  description: string | null;
};

type CalendarEventIdentityRow = {
  id: string;
  external_event_id: string;
};

type CalendarEventPayload = {
  owner_user_id: string;
  provider: "google";
  calendar_id: string;
  external_event_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  start_date: string;
  end_date: string;
  all_day: boolean;
  raw_event: CalendarEvent;
  last_synced_at: string;
  updated_at: string;
};

const IST_OFFSET = "+05:30";

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function normalizeDateTime(value: string): string {
  if (isDateOnly(value)) return `${value}T00:00:00${IST_OFFSET}`;
  return value;
}

function localDateFromEventValue(value: string): string {
  if (isDateOnly(value)) return value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function eventEndDate(event: CalendarEvent): string {
  if (isDateOnly(event.end)) {
    return toDateOnly(addDays(new Date(`${event.end}T00:00:00.000Z`), -1));
  }
  return localDateFromEventValue(event.end);
}

function rowToEvent(row: CalendarEventRow): CalendarEvent {
  return {
    id: row.external_event_id,
    title: row.title,
    start: row.start_at,
    end: row.end_at,
    location: row.location ?? undefined,
    description: row.description ?? undefined,
  };
}

function eventToPayload(event: CalendarEvent, ownerUserId: string): CalendarEventPayload | null {
  if (!event.id || !event.start || !event.end) return null;

  const allDay = isDateOnly(event.start) || isDateOnly(event.end);
  const now = new Date().toISOString();

  return {
    owner_user_id: ownerUserId,
    provider: "google",
    calendar_id: "primary",
    external_event_id: event.id,
    title: event.title?.trim() || "Untitled",
    description: event.description ?? null,
    location: event.location ?? null,
    start_at: normalizeDateTime(event.start),
    end_at: normalizeDateTime(event.end),
    start_date: localDateFromEventValue(event.start),
    end_date: eventEndDate(event),
    all_day: allDay,
    raw_event: event,
    last_synced_at: now,
    updated_at: now,
  };
}

export async function listCalendarEventsForDate(
  date: string,
  scope?: DbScope
): Promise<CalendarEvent[]> {
  const { supabase, ownerUserId } = await resolveDbScope(scope);
  const { data, error } = await supabase
    .from("calendar_events")
    .select("id, external_event_id, title, start_at, end_at, location, description")
    .eq("owner_user_id", ownerUserId)
    .lte("start_date", date)
    .gte("end_date", date)
    .order("start_at", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as CalendarEventRow[]).map(rowToEvent);
}

export async function upsertCalendarEvents(
  events: CalendarEvent[],
  scope?: DbScope
): Promise<number> {
  const { supabase, ownerUserId } = await resolveDbScope(scope);
  const payload = events
    .map((event) => eventToPayload(event, ownerUserId))
    .filter((event): event is CalendarEventPayload => event !== null);

  if (payload.length === 0) return 0;

  const { error } = await supabase
    .from("calendar_events")
    .upsert(payload, {
      onConflict: "owner_user_id,provider,calendar_id,external_event_id",
    });

  if (error) throw new Error(error.message);
  return payload.length;
}

export async function replaceCalendarEventsForDate(
  date: string,
  events: CalendarEvent[],
  scope?: DbScope
): Promise<{ upserted: number; removed: number }> {
  const { supabase, ownerUserId } = await resolveDbScope(scope);
  const upserted = await upsertCalendarEvents(events, { supabase, ownerUserId });
  const upstreamIds = new Set(events.map((event) => event.id).filter(Boolean));

  const { data, error } = await supabase
    .from("calendar_events")
    .select("id, external_event_id")
    .eq("owner_user_id", ownerUserId)
    .eq("provider", "google")
    .eq("calendar_id", "primary")
    .lte("start_date", date)
    .gte("end_date", date);

  if (error) throw new Error(error.message);

  const staleIds = ((data ?? []) as CalendarEventIdentityRow[])
    .filter((row) => !upstreamIds.has(row.external_event_id))
    .map((row) => row.id);

  if (staleIds.length === 0) return { upserted, removed: 0 };

  const { error: deleteError } = await supabase
    .from("calendar_events")
    .delete()
    .eq("owner_user_id", ownerUserId)
    .in("id", staleIds);

  if (deleteError) throw new Error(deleteError.message);
  return { upserted, removed: staleIds.length };
}

export async function deleteCalendarEventByExternalId(
  externalEventId: string,
  scope?: DbScope
): Promise<void> {
  const { supabase, ownerUserId } = await resolveDbScope(scope);
  const { error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("owner_user_id", ownerUserId)
    .eq("provider", "google")
    .eq("calendar_id", "primary")
    .eq("external_event_id", externalEventId);

  if (error) throw new Error(error.message);
}
