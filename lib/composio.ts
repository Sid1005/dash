export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
}

export async function getCalendarEvents(date: string): Promise<CalendarEvent[]> {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) return [];

  // Use Asia/Kolkata offset +05:30
  const timeMin = `${date}T00:00:00+05:30`;
  const timeMax = `${date}T23:59:59+05:30`;

  try {
    const res = await fetch(
      "https://backend.composio.dev/api/v3/tools/execute/GOOGLECALENDAR_FIND_EVENT",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          user_id: process.env.COMPOSIO_ENTITY_ID ?? "default",
          arguments: {
            calendar_id: "primary",
            time_min: timeMin,
            time_max: timeMax,
          },
        }),
      }
    );

    if (!res.ok) return [];
    const json = await res.json();
    const events: Record<string, unknown>[] =
      json?.data?.event_data?.event_data ?? [];

    return events.map((e) => {
      const start = e.start as Record<string, string>;
      const end = e.end as Record<string, string>;
      return {
        id: e.id as string,
        title: (e.summary as string) ?? "Untitled",
        start: start?.dateTime ?? start?.date ?? "",
        end: end?.dateTime ?? end?.date ?? "",
        location: e.location as string | undefined,
        description: e.description as string | undefined,
      };
    });
  } catch {
    return [];
  }
}

export async function createCalendarEvent(params: {
  title: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
}): Promise<boolean> {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) return false;

  const startDate = new Date(params.start);
  const endDate = new Date(params.end);
  const diffMs = endDate.getTime() - startDate.getTime();
  const totalMinutes = Math.max(0, Math.floor(diffMs / 60000));
  const event_duration_hour = Math.floor(totalMinutes / 60);
  const event_duration_minutes = totalMinutes % 60;

  try {
    const res = await fetch(
      "https://backend.composio.dev/api/v3/tools/execute/GOOGLECALENDAR_CREATE_EVENT",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          user_id: process.env.COMPOSIO_ENTITY_ID ?? "default",
          arguments: {
            calendar_id: "primary",
            summary: params.title,
            start_datetime: params.start,
            event_duration_hour,
            event_duration_minutes,
            description: params.description ?? "",
            location: params.location ?? "",
            timezone: "Asia/Kolkata",
          },
        }),
      }
    );

    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteCalendarEvent(eventId: string): Promise<boolean> {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) return false;

  try {
    const res = await fetch(
      "https://backend.composio.dev/api/v3/tools/execute/GOOGLECALENDAR_DELETE_EVENT",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          user_id: process.env.COMPOSIO_ENTITY_ID ?? "default",
          arguments: {
            calendar_id: "primary",
            event_id: eventId,
          },
        }),
      }
    );

    return res.ok;
  } catch {
    return false;
  }
}

