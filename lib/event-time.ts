const DEFAULT_EVENT_TIME = "00:00";
const DEFAULT_EVENT_TIME_ZONE = "America/Asuncion";

export function getEventStartDate(date: string, time?: string | null) {
  const eventTime = normalizeTime(time);
  const timeZone = process.env.NEXT_PUBLIC_EVENT_TIME_ZONE || DEFAULT_EVENT_TIME_ZONE;
  return zonedDateTimeToDate(date, eventTime, timeZone);
}

export function hasEventStarted(date: string, time?: string | null, now = new Date()) {
  return now.getTime() >= getEventStartDate(date, time).getTime();
}

export function canUploadEventPhotos(event: { event_date: string; event_time?: string | null }, now = new Date()) {
  return hasEventStarted(event.event_date, event.event_time, now);
}

export function getRemainingToEvent(date: string, time?: string | null, now = Date.now()) {
  const diff = Math.max(0, getEventStartDate(date, time).getTime() - now);
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    totalMs: diff
  };
}

export function formatRemainingSentence(remaining: ReturnType<typeof getRemainingToEvent>) {
  return `${remaining.days} dias, ${remaining.hours} horas, ${remaining.minutes} minutos y ${remaining.seconds} segundos`;
}

function normalizeTime(time?: string | null) {
  const value = String(time || DEFAULT_EVENT_TIME).trim();
  const [hours = "00", minutes = "00"] = value.split(":");
  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
}

function zonedDateTimeToDate(date: string, time: string, timeZone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wallTimeUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let utc = wallTimeUtc;

  for (let i = 0; i < 2; i += 1) {
    utc = wallTimeUtc - getTimeZoneOffsetMs(new Date(utc), timeZone);
  }

  return new Date(utc);
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const zonedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  return zonedAsUtc - date.getTime();
}
