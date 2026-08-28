const TZ = "Asia/Shanghai";

function formatParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: get("weekday"),
  };
}

/** YYYY-MM-DD in Asia/Shanghai */
export function toDateKey(date: Date = new Date()): string {
  const { year, month, day } = formatParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatDateLabel(key: string): string {
  const date = parseDateKey(key);
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: TZ,
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

export function formatDateRange(startKey: string, endKey: string): string {
  const start = parseDateKey(startKey);
  const end = parseDateKey(endKey);
  const fmt = new Intl.DateTimeFormat("zh-CN", {
    timeZone: TZ,
    month: "numeric",
    day: "numeric",
  });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

/** Monday of the week containing `date` (Asia/Shanghai) */
export function getWeekStartKey(date: Date = new Date()): string {
  const key = toDateKey(date);
  const d = parseDateKey(key);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
  }).format(date);

  const dayMap: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  const offset = dayMap[weekday] ?? 0;
  d.setUTCDate(d.getUTCDate() - offset);
  return toDateKey(d);
}

export function getWeekEndKey(weekStartKey: string): string {
  const d = parseDateKey(weekStartKey);
  d.setUTCDate(d.getUTCDate() + 6);
  return toDateKey(d);
}

export function getWeekdayKeys(weekStartKey: string): string[] {
  const keys: string[] = [];
  const start = parseDateKey(weekStartKey);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    keys.push(toDateKey(d));
  }
  return keys;
}

export function isWeekday(dateKey: string): boolean {
  const date = parseDateKey(dateKey);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
  }).format(date);
  return !["Sat", "Sun"].includes(weekday);
}

export function countWeekdaysUpToToday(weekStartKey: string): number {
  const today = toDateKey();
  const keys = getWeekdayKeys(weekStartKey).filter(isWeekday);
  return keys.filter((k) => k <= today).length;
}
