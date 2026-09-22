// Server-side booking rules. Keep this module framework-free so every Convex
// mutation applies the same commercial and calendar invariants as the UI.

export const BOOKING_TIMEZONE = "Europe/Paris";
export const MINIMUM_NOTICE_MINUTES = 24 * 60;
export const BOOKING_HORIZON_DAYS = 35;
export const HOLD_DURATION_MINUTES = 30;

export const DEFAULT_WEEKLY_AVAILABILITY = Object.freeze(
  Array.from({ length: 7 }, (_, index) => ({
    weekday: index + 1,
    ranges:
      index + 1 >= 2 && index + 1 <= 4
        ? [{ start: "09:00", end: "12:00" }]
        : [],
  })),
);

export const DEFAULT_BOOKING_SETTINGS = Object.freeze({
  key: "default",
  weeklyAvailability: DEFAULT_WEEKLY_AVAILABILITY,
  dateExceptions: [],
});

export const BOOKING_OFFERS = Object.freeze({
  anglais: Object.freeze({
    key: "anglais",
    title: "Cours d’anglais",
    modes: Object.freeze({
      solo: Object.freeze({
        mode: "solo",
        modeLabel: "Cours particulier",
        durationMinutes: 60,
        priceCents: 5500,
        priceLabel: "55 €",
        sessionCount: 1,
        validityMonths: 1,
      }),
      "solo-4h": Object.freeze({
        mode: "solo-4h",
        modeLabel: "Pack individuel · 4 cours d’une heure",
        durationMinutes: 60,
        priceCents: 20000,
        priceLabel: "200 € le pack",
        sessionCount: 4,
        validityMonths: 3,
      }),
      "solo-8h": Object.freeze({
        mode: "solo-8h",
        modeLabel: "Pack individuel · 8 cours d’une heure",
        durationMinutes: 60,
        priceCents: 36000,
        priceLabel: "360 € le pack",
        sessionCount: 8,
        validityMonths: 6,
      }),
      duo: Object.freeze({
        mode: "duo",
        modeLabel: "Cours en duo",
        durationMinutes: 60,
        priceCents: 6800,
        priceLabel: "68 €",
        sessionCount: 1,
        validityMonths: 1,
      }),
    }),
  }),
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function pad2(value) {
  return String(value).padStart(2, "0");
}

function parseDateKey(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) {
    throw new Error("Invalid date");
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Invalid date");
  }
  return date;
}

function timeToMinutes(value) {
  if (typeof value !== "string" || !TIME_RE.test(value)) return Number.NaN;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function parisParts(at, withSeconds = false) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BOOKING_TIMEZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
  })
    .formatToParts(at)
    .reduce((result, part) => {
      if (part.type !== "literal") result[part.type] = part.value;
      return result;
    }, {});
}

function parisOffsetMinutes(at) {
  const parts = parisParts(at, true);
  const hour = parts.hour === "24" ? 0 : Number(parts.hour);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second),
  );
  return (asUtc - at.getTime()) / 60000;
}

function parisWallClockKey(at) {
  const parts = parisParts(at);
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day} ${hour}:${parts.minute}`;
}

export function parisDateKey(at) {
  const parts = parisParts(at);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function parisInstant(dateStr, timeStr) {
  parseDateKey(dateStr);
  if (typeof timeStr !== "string" || !TIME_RE.test(timeStr)) {
    throw new Error("Invalid time");
  }
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);
  const guess = Date.UTC(year, month - 1, day, hours, minutes);
  const target = `${dateStr} ${timeStr}`;
  const offsets = new Set(
    [
      guess,
      guess - 3 * 60 * 60 * 1000,
      guess + 3 * 60 * 60 * 1000,
      guess - 12 * 60 * 60 * 1000,
      guess + 12 * 60 * 60 * 1000,
    ].map((instant) => parisOffsetMinutes(new Date(instant))),
  );
  const candidates = [];
  for (const offset of offsets) {
    const candidate = new Date(guess - offset * 60000);
    if (parisWallClockKey(candidate) === target) candidates.push(candidate);
  }
  if (candidates.length) {
    return candidates.sort((left, right) => left.getTime() - right.getTime())[0];
  }
  const offset = parisOffsetMinutes(new Date(guess));
  return new Date(guess - offset * 60000);
}

export function isValidParisWallClock(dateStr, timeStr) {
  try {
    return parisWallClockKey(parisInstant(dateStr, timeStr)) === `${dateStr} ${timeStr}`;
  } catch {
    return false;
  }
}

export function weekdayISO(dateStr) {
  const day = parseDateKey(dateStr).getUTCDay();
  return day === 0 ? 7 : day;
}

function normalizeRanges(ranges, { rejectInvalid = false } = {}) {
  if (!Array.isArray(ranges)) {
    if (rejectInvalid) throw new Error("Invalid availability ranges");
    return [];
  }
  const normalized = [];
  for (const range of ranges) {
    const start = timeToMinutes(range?.start);
    const end = timeToMinutes(range?.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
      if (rejectInvalid) throw new Error("Invalid availability range");
      continue;
    }
    normalized.push({ start: range.start, end: range.end });
  }
  return normalized.sort((left, right) => timeToMinutes(left.start) - timeToMinutes(right.start));
}

export function normalizeAvailability(value, { rejectInvalid = false } = {}) {
  if (!value || typeof value !== "object") throw new Error("Invalid availability");
  const weeklySource = Array.isArray(value.weeklyAvailability)
    ? value.weeklyAvailability
    : Object.entries(value.weeklyAvailability || {}).map(([weekday, ranges]) => ({
        weekday: Number(weekday),
        ranges,
      }));
  const weeklyByDay = new Map();
  for (const day of weeklySource) {
    const weekday = Number(day?.weekday);
    if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
      if (rejectInvalid) throw new Error("Invalid weekday");
      continue;
    }
    weeklyByDay.set(weekday, normalizeRanges(day.ranges, { rejectInvalid }));
  }
  const weeklyAvailability = Array.from({ length: 7 }, (_, index) => ({
    weekday: index + 1,
    ranges: weeklyByDay.get(index + 1) || [],
  }));

  const exceptionsSource = Array.isArray(value.dateExceptions)
    ? value.dateExceptions
    : Object.entries(value.dateExceptions || {}).map(([date, ranges]) => ({ date, ranges }));
  const seenDates = new Set();
  const dateExceptions = [];
  for (const exception of exceptionsSource) {
    const date = exception?.date;
    try {
      parseDateKey(date);
    } catch {
      if (rejectInvalid) throw new Error("Invalid exception date");
      continue;
    }
    if (seenDates.has(date)) {
      if (rejectInvalid) throw new Error("Duplicate exception date");
      continue;
    }
    seenDates.add(date);
    dateExceptions.push({
      date,
      ranges: normalizeRanges(exception.ranges, { rejectInvalid }),
    });
  }
  dateExceptions.sort((left, right) => left.date.localeCompare(right.date));
  return { weeklyAvailability, dateExceptions };
}

export function resolveRanges(settings, dateStr) {
  parseDateKey(dateStr);
  const exception = settings.dateExceptions.find((item) => item.date === dateStr);
  if (exception) return exception.ranges;
  return settings.weeklyAvailability.find((item) => item.weekday === weekdayISO(dateStr))?.ranges || [];
}

export function getBookingOffer(offerKey, mode) {
  const base = BOOKING_OFFERS[offerKey];
  if (!base) return null;
  const selectedMode = mode || "solo";
  const variant = base.modes[selectedMode];
  return variant ? { ...base, ...variant } : null;
}

function generateSlots(ranges, durationMinutes, intervalMinutes = durationMinutes) {
  const starts = [];
  for (const range of ranges) {
    const start = timeToMinutes(range.start);
    const end = timeToMinutes(range.end);
    for (let minute = start; minute + durationMinutes <= end; minute += intervalMinutes) {
      starts.push(`${pad2(Math.floor(minute / 60))}:${pad2(minute % 60)}`);
    }
  }
  return starts;
}

export function isBookingActive(booking, now = Date.now()) {
  if (!booking || ["cancelled", "expired", "refunded"].includes(booking.status)) return false;
  if (booking.status === "pending") {
    return Number(booking.holdExpiresAt) > now;
  }
  return booking.status === "confirmed";
}

export function bookingOverlaps(candidateStartAt, candidateEndAt, booking, now = Date.now()) {
  if (!isBookingActive(booking, now)) return false;
  const start = Number(booking.startAt);
  const end = Number(booking.endAt);
  return Number.isFinite(start) && Number.isFinite(end) && candidateStartAt < end && start < candidateEndAt;
}

export function isSlotBookable({ date, time, offer, settings, bookings, now = Date.now() }) {
  if (!offer || !settings) return false;
  if (!isValidParisWallClock(date, time)) return false;
  const start = parisInstant(date, time).getTime();
  const end = start + offer.durationMinutes * 60 * 1000;
  const minimum = now + MINIMUM_NOTICE_MINUTES * 60 * 1000;
  const maximum = now + BOOKING_HORIZON_DAYS * 24 * 60 * 60 * 1000;
  if (start < minimum || end > maximum) return false;
  const ranges = resolveRanges(settings, date);
  const startMinutes = timeToMinutes(time);
  const fitsRange = ranges.some((range) => {
    const rangeStart = timeToMinutes(range.start);
    const rangeEnd = timeToMinutes(range.end);
    return (
      startMinutes >= rangeStart &&
      startMinutes + offer.durationMinutes <= rangeEnd &&
      isValidParisWallClock(date, range.end) &&
      end <= parisInstant(date, range.end).getTime()
    );
  });
  if (!fitsRange) return false;
  const interval = offer.slotIntervalMinutes || offer.durationMinutes;
  const slotStarts = generateSlots(ranges, offer.durationMinutes, interval);
  if (!slotStarts.includes(time)) return false;
  return !(bookings || []).some((booking) => bookingOverlaps(start, end, booking, now));
}

export function effectiveBookingStatus(booking, now = Date.now()) {
  if (!booking) return null;
  if (booking.status === "pending" && Number(booking.holdExpiresAt) <= now) return "expired";
  return booking.status;
}

export function addValidityMonths(now, months) {
  const date = new Date(now);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.getTime();
}

export function safeMeetUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "meet.google.com" &&
      /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}\/?$/i.test(url.pathname) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export function validEmail(value) {
  return typeof value === "string" && value.length <= 320 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}
