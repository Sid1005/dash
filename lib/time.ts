const IST_TIME_ZONE = "Asia/Kolkata";
export const IST_OFFSET = "+05:30";

function istParts(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});
}

export function currentIstDate(date = new Date()) {
  const parts = istParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function currentIstTime(date = new Date()) {
  const parts = istParts(date);
  return `${parts.hour}:${parts.minute}`;
}

export function currentIstWeekday(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: IST_TIME_ZONE,
    weekday: "long",
  }).format(date);
}
