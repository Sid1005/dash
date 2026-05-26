import { NextRequest, NextResponse } from "next/server";
import { getCalendarEvents, createCalendarEvent, deleteCalendarEvent } from "@/lib/composio";

export async function GET(req: NextRequest) {
  const date =
    req.nextUrl.searchParams.get("date") ??
    new Date().toISOString().slice(0, 10);
  const events = await getCalendarEvents(date);
  return NextResponse.json({ date, events });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, start, end, description, location } = body;
    if (!title || !start || !end) {
      return NextResponse.json(
        { error: "title, start, and end are required" },
        { status: 400 }
      );
    }
    const ok = await createCalendarEvent({ title, start, end, description, location });
    return NextResponse.json({ ok });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    let id = req.nextUrl.searchParams.get("id");
    if (!id) {
      const body = await req.json();
      id = body.id;
    }
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const ok = await deleteCalendarEvent(id);
    return NextResponse.json({ ok });
  } catch (error: any) {
    // If JSON parsing fails but id is in searchParams, we can still succeed
    let id = req.nextUrl.searchParams.get("id");
    if (id) {
      const ok = await deleteCalendarEvent(id);
      return NextResponse.json({ ok });
    }
    return NextResponse.json({ error: error?.message || "Invalid request" }, { status: 400 });
  }
}

