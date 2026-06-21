import { NextRequest, NextResponse } from "next/server";
import { createCalendarEvent, deleteCalendarEvent, updateCalendarEvent } from "@/lib/composio";
import {
  deleteCalendarEventByExternalId,
  listCalendarEventsForDate,
} from "@/lib/calendar-events-supabase";
import { syncGoogleCalendarEventsForDate } from "@/lib/calendar-sync";
import { getUserScopedDb } from "@/lib/owner-scope";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Invalid request";
}

export async function GET(req: NextRequest) {
  const date =
    req.nextUrl.searchParams.get("date") ??
    new Date().toISOString().slice(0, 10);
  const scope = await getUserScopedDb();
  const shouldSync = req.nextUrl.searchParams.get("sync") === "true";

  if (shouldSync) {
    await syncGoogleCalendarEventsForDate(date, scope);
  }

  const events = await listCalendarEventsForDate(date, scope);
  return NextResponse.json({ date, events });
}

export async function POST(req: NextRequest) {
  try {
    const scope = await getUserScopedDb();
    const body = await req.json();
    const { title, start, end, description, location } = body;
    if (!title || !start || !end) {
      return NextResponse.json(
        { error: "title, start, and end are required" },
        { status: 400 }
      );
    }
    const ok = await createCalendarEvent({ title, start, end, description, location });
    if (ok) {
      const syncDate = String(start).slice(0, 10);
      await syncGoogleCalendarEventsForDate(syncDate, scope);
    }
    return NextResponse.json({ ok });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const scope = await getUserScopedDb();
    const body = await req.json();
    const { id, title, start, end, description, location } = body;
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    if (start && end && new Date(end) <= new Date(start)) {
      return NextResponse.json({ error: "end must be after start" }, { status: 400 });
    }

    const ok = await updateCalendarEvent({
      eventId: id,
      title,
      start,
      end,
      description,
      location,
    });
    if (!ok) {
      return NextResponse.json({ error: "Calendar provider update failed" }, { status: 502 });
    }

    const dates = new Set<string>();
    if (start) dates.add(String(start).slice(0, 10));
    if (end) dates.add(String(end).slice(0, 10));
    await Promise.all(Array.from(dates, (date) => syncGoogleCalendarEventsForDate(date, scope)));
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const scope = await getUserScopedDb();
    let id = req.nextUrl.searchParams.get("id");
    if (!id) {
      const body = await req.json();
      id = body.id;
    }
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const ok = await deleteCalendarEvent(id);
    if (ok) await deleteCalendarEventByExternalId(id, scope);
    return NextResponse.json({ ok });
  } catch (error: unknown) {
    // If JSON parsing fails but id is in searchParams, we can still succeed
    const id = req.nextUrl.searchParams.get("id");
    if (id) {
      const ok = await deleteCalendarEvent(id);
      if (ok) {
        const scope = await getUserScopedDb();
        await deleteCalendarEventByExternalId(id, scope);
      }
      return NextResponse.json({ ok });
    }
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}
