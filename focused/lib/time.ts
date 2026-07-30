const IST_TIME_ZONE = "Asia/Kolkata";

function parts(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
}

function partValue(dateParts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return dateParts.find((part) => part.type === type)?.value ?? "";
}

export function currentIstDate(date = new Date()): string {
  const dateParts = parts(date);
  return `${partValue(dateParts, "year")}-${partValue(dateParts, "month")}-${partValue(dateParts, "day")}`;
}

export function currentIstTime(date = new Date()): string {
  const dateParts = parts(date);
  return `${partValue(dateParts, "hour")}:${partValue(dateParts, "minute")}`;
}

export function currentIstIso(date = new Date()): string {
  return `${currentIstDate(date)}T${currentIstTime(date)}:00+05:30`;
}

export function endOfIstDayIso(date: string): string {
  return `${date}T23:59:00+05:30`;
}

export function startOfIstDayIso(date: string): string {
  return `${date}T00:00:00+05:30`;
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || value.length !== 10) return false;
  const pieces = value.split("-");
  if (pieces.length !== 3 || pieces[0].length !== 4 || pieces[1].length !== 2 || pieces[2].length !== 2) return false;
  if (pieces.some((piece) => !piece || Array.from(piece).some((character) => character < "0" || character > "9"))) return false;
  const parsed = new Date(`${value}T12:00:00+05:30`);
  return !Number.isNaN(parsed.getTime()) && currentIstDate(parsed) === value;
}

export function isLocalTime(value: unknown): value is string {
  if (typeof value !== "string" || value.length !== 5 || value[2] !== ":") return false;
  const [hoursText, minutesText] = value.split(":");
  if ([...hoursText, ...minutesText].some((character) => character < "0" || character > "9")) return false;
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

export function formatDateLong(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00+05:30`));
}

export function formatDateRange(start: string, end: string): string {
  if (start === end) return formatDateLong(start);
  const formatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${formatter.format(new Date(`${start}T12:00:00+05:30`))} – ${formatter.format(new Date(`${end}T12:00:00+05:30`))}`;
}

export function istDateFromIso(value: string): string {
  return currentIstDate(new Date(value));
}
