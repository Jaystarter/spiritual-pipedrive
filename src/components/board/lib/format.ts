import { daysSince } from "@/lib/follow-ups";

export const WEEKDAY_LABELS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

export function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function daysInPipeline(createdAt: string) {
  const timestamp = Date.parse(createdAt);

  if (Number.isNaN(timestamp)) {
    return 1;
  }

  const elapsedDays = Math.floor((Date.now() - timestamp) / 86_400_000);

  return Math.max(1, elapsedDays);
}

export function daysSinceDate(value: string) {
  return daysSince(value);
}

export function addDays(value: string, days: number) {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return value;
  }

  const date = new Date(timestamp);
  date.setDate(date.getDate() + days);

  return date.toISOString();
}

export function getDateValue(value: string | null | undefined) {
  const datePart = value?.slice(0, 10);

  if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return datePart;
  }

  return new Date().toISOString().slice(0, 10);
}

export function dateValueToUtcDate(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function utcDateToDateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function shiftDateValue(dateValue: string, offsetDays: number) {
  const date = dateValueToUtcDate(dateValue);
  date.setUTCDate(date.getUTCDate() + offsetDays);

  return utcDateToDateValue(date);
}

export function getWeekStartDateValue(dateValue: string) {
  const date = dateValueToUtcDate(dateValue);
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());

  return utcDateToDateValue(date);
}

export function getDateRangeValues(startDateValue: string, dayCount: number) {
  const startDate = dateValueToUtcDate(startDateValue);

  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(startDate);
    date.setUTCDate(startDate.getUTCDate() + index);

    return utcDateToDateValue(date);
  });
}

export function formatCalendarTitle(dateValue: string) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(dateValueToUtcDate(dateValue));
}

export function monthKey(value: string) {
  return value.slice(0, 7);
}

export function formatMonthLabel(value: string) {
  const date = new Date(`${value}-01T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
  }).format(date);
}
