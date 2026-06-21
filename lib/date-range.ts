export type DateRange = {
  startDate: string;
  endDate: string;
};

function parseCalendarDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function formatCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addCalendarDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function startOfWeek(date: Date): Date {
  const day = date.getUTCDay();
  return addCalendarDays(date, day === 0 ? -6 : 1 - day);
}

export function fallbackDateRange(input: string, today: string): DateRange {
  const lower = input.toLowerCase();
  const todayDate = parseCalendarDate(today);

  if (lower.includes("all ideas") || lower.includes("every idea")) {
    return { startDate: "1970-01-01", endDate: today };
  }

  if (lower.includes("yesterday")) {
    const yesterday = formatCalendarDate(addCalendarDays(todayDate, -1));
    return { startDate: yesterday, endDate: yesterday };
  }

  if (lower.includes("today")) return { startDate: today, endDate: today };

  if (lower.includes("last week")) {
    const thisMonday = startOfWeek(todayDate);
    return {
      startDate: formatCalendarDate(addCalendarDays(thisMonday, -7)),
      endDate: formatCalendarDate(addCalendarDays(thisMonday, -1)),
    };
  }

  if (lower.includes("this week")) {
    return { startDate: formatCalendarDate(startOfWeek(todayDate)), endDate: today };
  }

  if (lower.includes("last month")) {
    const year = todayDate.getUTCFullYear();
    const month = todayDate.getUTCMonth();
    const firstOfThisMonth = new Date(Date.UTC(year, month, 1));
    return {
      startDate: formatCalendarDate(new Date(Date.UTC(year, month - 1, 1))),
      endDate: formatCalendarDate(addCalendarDays(firstOfThisMonth, -1)),
    };
  }

  if (lower.includes("this month")) {
    const firstOfThisMonth = new Date(Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth(), 1));
    return { startDate: formatCalendarDate(firstOfThisMonth), endDate: today };
  }

  const explicitDate = input.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
  if (explicitDate) return { startDate: explicitDate, endDate: explicitDate };

  return {
    startDate: formatCalendarDate(addCalendarDays(todayDate, -30)),
    endDate: today,
  };
}
