const PARTIAL_TIME_RANGE_RE = /\b(\d{1,2}(?::\d{2})?)(?!\s*(?:am|pm))\s*(-|–|—|\bto\b)\s*(\d{1,2}(?::\d{2})?)\s*(am|pm)\b/gi;
const TIME_RANGE_HINT_RE = /\b\d{1,2}(?::\d{2})?\s*(?:-|–|—|\bto\b)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i;

export function normalizeStandaloneCalendarInput(input: string): string {
  return input.replace(
    PARTIAL_TIME_RANGE_RE,
    (_match, startTime: string, separator: string, endTime: string, meridiem: string) => {
      const normalizedMeridiem = meridiem.toLowerCase();
      return `${startTime}${normalizedMeridiem} ${separator} ${endTime}${normalizedMeridiem}`;
    }
  );
}

export function hasStandaloneCalendarEventHint(input: string): boolean {
  return TIME_RANGE_HINT_RE.test(input) || /\b(calendar|schedule|event|meeting|appointment|reservation|reminder)\b/i.test(input);
}
