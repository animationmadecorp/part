/**
 * Pure booking rules for Animation Made.
 *
 * This module deliberately has no browser, storage, framework or database
 * dependency. The local adapter and a future Convex adapter can both call the
 * same functions before accepting a booking.
 */
import { bookingPriceKey, defaultPrice, formatPriceLabel } from "../../../lib/pricing-core.mjs";

export const BOOKING_TIMEZONE = "Europe/Paris";
export const DAY_MS = 24 * 60 * 60 * 1000;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const DEFAULT_BOOKING_CONFIG = Object.freeze({
  timezone: BOOKING_TIMEZONE,
  minimumNoticeMinutes: 24 * 60,
  horizonDays: 35,
  slotIntervalMinutes: 20,
  // ISO weekdays: 1 = Monday … 7 = Sunday. An explicit date exception wins
  // over this pattern, including an empty array which closes that date.
  weeklyAvailability: {
    2: [{ start: "09:00", end: "12:00" }],
    3: [{ start: "09:00", end: "12:00" }],
    4: [{ start: "09:00", end: "12:00" }],
  },
  dateExceptions: {},
});

export const BOOKING_OFFERS = Object.freeze({
  anglais: Object.freeze({
    key: "anglais",
    category: "ANGLAIS POUR L’ANIMATION",
    title: "Cours d’anglais",
    description:
      "Une heure de cours sur mesure pour comprendre et parler de ton métier.",
    returnHref: "/nouveau/anglais",
    modes: {
      solo: Object.freeze({
        mode: "solo",
        modeLabel: "Cours particulier",
        durationMinutes: 60,
        durationLabel: "1 heure",
        slotIntervalMinutes: 60,
        price: defaultPrice(bookingPriceKey("anglais", "solo")).priceCents / 100,
        priceLabel: formatPriceLabel(defaultPrice(bookingPriceKey("anglais", "solo")).priceCents, bookingPriceKey("anglais", "solo")),
      }),
      "solo-4h": Object.freeze({
        mode: "solo-4h",
        modeLabel: "Pack individuel · 4 cours d’une heure",
        durationMinutes: 60,
        durationLabel: "1 heure",
        slotIntervalMinutes: 60,
        sessionCount: 4,
        validityMonths: 3,
        price: defaultPrice(bookingPriceKey("anglais", "solo-4h")).priceCents / 100,
        priceLabel: formatPriceLabel(defaultPrice(bookingPriceKey("anglais", "solo-4h")).priceCents, bookingPriceKey("anglais", "solo-4h")),
      }),
      "solo-8h": Object.freeze({
        mode: "solo-8h",
        modeLabel: "Pack individuel · 8 cours d’une heure",
        durationMinutes: 60,
        durationLabel: "1 heure",
        slotIntervalMinutes: 60,
        sessionCount: 8,
        validityMonths: 6,
        price: defaultPrice(bookingPriceKey("anglais", "solo-8h")).priceCents / 100,
        priceLabel: formatPriceLabel(defaultPrice(bookingPriceKey("anglais", "solo-8h")).priceCents, bookingPriceKey("anglais", "solo-8h")),
      }),
      duo: Object.freeze({
        mode: "duo",
        modeLabel: "Cours en duo",
        durationMinutes: 60,
        durationLabel: "1 heure",
        slotIntervalMinutes: 60,
        price: defaultPrice(bookingPriceKey("anglais", "duo")).priceCents / 100,
        priceLabel: formatPriceLabel(defaultPrice(bookingPriceKey("anglais", "duo")).priceCents, bookingPriceKey("anglais", "duo")),
        payerNote: "Le tarif affiché est le total pour deux personnes. Un seul paiement et un seul compte pour la réservation.",
      }),
    },
  }),
});

const OFFER_ALIASES = Object.freeze({
  // Keep old shared links readable while exposing one canonical key in the
  // booking payload and in the future payment/order records.
  visibilite: "contenu",
});

function pad2(value) {
  return String(value).padStart(2, "0");
}

function parseDateKey(dateStr) {
  if (typeof dateStr !== "string" || !DATE_RE.test(dateStr)) {
    throw new RangeError(`Invalid date: ${dateStr}`);
  }
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new RangeError(`Invalid date: ${dateStr}`);
  }
  return date;
}

export function isValidDateKey(dateStr) {
  try {
    parseDateKey(dateStr);
    return true;
  } catch {
    return false;
  }
}

function dateKey(date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(
    date.getUTCDate(),
  )}`;
}

export function addDays(dateStr, amount) {
  const date = parseDateKey(dateStr);
  date.setUTCDate(date.getUTCDate() + amount);
  return dateKey(date);
}

export function timeToMinutes(time) {
  if (typeof time !== "string" || !TIME_RE.test(time)) return Number.NaN;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes) {
  if (
    !Number.isInteger(minutes) ||
    minutes < 0 ||
    minutes > 23 * 60 + 59
  ) {
    throw new RangeError(`Invalid minute value: ${minutes}`);
  }
  return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;
}

export function weekdayISO(dateOrKey) {
  const date =
    typeof dateOrKey === "string" ? parseDateKey(dateOrKey) : dateOrKey;
  const weekday = date.getUTCDay();
  return weekday === 0 ? 7 : weekday;
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
    .reduce((parts, part) => {
      if (part.type !== "literal") parts[part.type] = part.value;
      return parts;
    }, {});
}

export function parisDateKey(at) {
  const parts = parisParts(at);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function parisOffsetMinutes(at) {
  const parts = parisParts(at, true);
  const hour = parts.hour === "24" ? 0 : Number(parts.hour);
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second),
  );
  return (asUTC - at.getTime()) / 60000;
}

function parisWallClockKey(at) {
  const parts = parisParts(at);
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day} ${hour}:${parts.minute}`;
}

/** Convert a Paris wall-clock date/time to its exact UTC instant, including DST. */
export function parisInstant(dateStr, timeStr) {
  parseDateKey(dateStr);
  if (typeof timeStr !== "string" || !TIME_RE.test(timeStr)) {
    throw new RangeError(`Invalid time: ${timeStr}`);
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

  // If a wall-clock hour repeats in autumn, choose the first occurrence. This
  // deterministic policy avoids booking two different instants for one label.
  if (candidates.length) {
    return candidates.sort((a, b) => a.getTime() - b.getTime())[0];
  }

  // The configured windows are daytime windows, but returning the closest
  // resolved instant keeps the function total around a DST gap as well.
  const offset = parisOffsetMinutes(new Date(guess));
  return new Date(guess - offset * 60000);
}

/** False for a wall-clock time skipped by a Europe/Paris DST transition. */
export function isValidParisWallClock(dateStr, timeStr) {
  try {
    parseDateKey(dateStr);
    if (typeof timeStr !== "string" || !TIME_RE.test(timeStr)) return false;
    return parisWallClockKey(parisInstant(dateStr, timeStr)) === `${dateStr} ${timeStr}`;
  } catch {
    return false;
  }
}

function cloneRanges(ranges) {
  if (!Array.isArray(ranges)) return [];
  return ranges
    .filter((range) => range && typeof range === "object")
    .map((range) => ({ start: range.start, end: range.end }));
}

export function resolveRanges(dateExceptions, dateStr, config = DEFAULT_BOOKING_CONFIG) {
  parseDateKey(dateStr);
  const exceptions = dateExceptions ?? config.dateExceptions ?? {};
  if (Object.prototype.hasOwnProperty.call(exceptions, dateStr)) {
    return cloneRanges(exceptions[dateStr]);
  }
  return cloneRanges(config.weeklyAvailability?.[weekdayISO(dateStr)]);
}

/** Generate starts whose complete duration fits inside one availability range. */
export function generateSlots(
  ranges,
  durationMinutes,
  intervalMinutes = durationMinutes,
) {
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes <= 0 ||
    !Number.isInteger(intervalMinutes) ||
    intervalMinutes <= 0
  ) {
    return [];
  }

  const starts = new Set();
  for (const range of Array.isArray(ranges) ? ranges : []) {
    if (!range || typeof range !== "object") continue;
    const start = timeToMinutes(range.start);
    const end = timeToMinutes(range.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) continue;
    for (
      let minute = start;
      minute + durationMinutes <= end;
      minute += intervalMinutes
    ) {
      starts.add(minutesToTime(minute));
    }
  }
  return [...starts].sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
}

export function getBookingOffer(offerKey, mode) {
  const requestedKey = typeof offerKey === "string" ? offerKey : "";
  const canonicalKey = Object.prototype.hasOwnProperty.call(OFFER_ALIASES, requestedKey)
    ? OFFER_ALIASES[requestedKey]
    : requestedKey;
  const base = Object.prototype.hasOwnProperty.call(BOOKING_OFFERS, canonicalKey)
    ? BOOKING_OFFERS[canonicalKey]
    : null;
  if (!base) return null;
  if (!base.modes) return { ...base };

  const selectedMode = typeof mode === "string" ? mode : "solo";
  const variant = Object.prototype.hasOwnProperty.call(base.modes, selectedMode)
    ? base.modes[selectedMode]
    : null;
  if (!variant) return null;
  return { ...base, ...variant };
}

export function getBookingWindow(now = new Date(), config = DEFAULT_BOOKING_CONFIG) {
  const minInstant = new Date(
    now.getTime() + config.minimumNoticeMinutes * 60 * 1000,
  );
  const maxInstant = new Date(
    now.getTime() + config.horizonDays * DAY_MS,
  );
  return {
    minInstant,
    maxInstant,
    minDate: parisDateKey(minInstant),
    maxDate: parisDateKey(maxInstant),
  };
}

export function isDateWithinWindow(dateStr, now = new Date(), config = DEFAULT_BOOKING_CONFIG) {
  try {
    const window = getBookingWindow(now, config);
    const dayStart = parisInstant(dateStr, "00:00");
    const dayEnd = parisInstant(dateStr, "23:59");
    return dayEnd >= window.minInstant && dayStart <= window.maxInstant;
  } catch {
    return false;
  }
}

function bookingStartInstant(booking) {
  try {
    if (booking?.startISO) {
      const instant = new Date(booking.startISO);
      if (!Number.isNaN(instant.getTime())) return instant;
    }
    if (booking?.date && booking?.time) {
      return parisInstant(booking.date, booking.time);
    }
  } catch {
    return null;
  }
  return null;
}

export function isSlotTaken({
  dateStr,
  time,
  durationMinutes,
  bookings = [],
  now = new Date(),
}) {
  const duration = Number(durationMinutes);
  if (!Number.isInteger(duration) || duration <= 0) return false;
  let start;
  try {
    start = parisInstant(dateStr, time).getTime();
  } catch {
    return false;
  }
  const end = start + duration * 60 * 1000;
  return (Array.isArray(bookings) ? bookings : []).some((booking) => {
    if (booking?.status === "cancelled" || booking?.status === "expired") return false;
    if (
      booking?.status === "pending" &&
      Number.isFinite(Number(booking.holdExpiresAt)) &&
      Number(booking.holdExpiresAt) <= now.getTime()
    ) {
      return false;
    }
    const bookedStart = bookingStartInstant(booking);
    if (!bookedStart) return false;
    const bookedDuration = Number(booking.durationMinutes);
    if (!Number.isInteger(bookedDuration) || bookedDuration <= 0) return false;
    const bookedEnd = bookedStart.getTime() + bookedDuration * 60 * 1000;
    return start < bookedEnd && bookedStart.getTime() < end;
  });
}

export function isBookableSlot({
  dateStr,
  time,
  durationMinutes,
  intervalMinutes,
  dateExceptions,
  bookings,
  now = new Date(),
  config = DEFAULT_BOOKING_CONFIG,
}) {
  const duration = Number(durationMinutes);
  if (!Number.isInteger(duration) || duration <= 0) return false;
  if (!isValidParisWallClock(dateStr, time)) return false;
  let ranges;
  try {
    ranges = resolveRanges(dateExceptions, dateStr, config);
  } catch {
    return false;
  }
  const slots = generateSlots(
    ranges,
    duration,
    intervalMinutes ?? config.slotIntervalMinutes ?? duration,
  );
  if (!slots.includes(time) || isSlotTaken({ dateStr, time, durationMinutes: duration, bookings, now })) {
    return false;
  }

  let window;
  let start;
  try {
    window = getBookingWindow(now, config);
    start = parisInstant(dateStr, time);
  } catch {
    return false;
  }
  const end = new Date(start.getTime() + duration * 60 * 1000);
  const startMinutes = timeToMinutes(time);
  const fitsRealRange = ranges.some((range) => {
    const rangeStart = timeToMinutes(range.start);
    const rangeEnd = timeToMinutes(range.end);
    if (
      !Number.isFinite(rangeStart) ||
      !Number.isFinite(rangeEnd) ||
      startMinutes < rangeStart ||
      startMinutes + duration > rangeEnd ||
      !isValidParisWallClock(dateStr, range.end)
    ) {
      return false;
    }
    return end <= parisInstant(dateStr, range.end);
  });
  if (!fitsRealRange) return false;
  return start >= window.minInstant && end <= window.maxInstant;
}

export function getBookableSlots({
  dateStr,
  offer,
  dateExceptions,
  bookings,
  now = new Date(),
  config = DEFAULT_BOOKING_CONFIG,
}) {
  if (!offer?.durationMinutes || !isDateWithinWindow(dateStr, now, config)) return [];
  const ranges = resolveRanges(dateExceptions, dateStr, config);
  return generateSlots(
    ranges,
    offer.durationMinutes,
    offer.slotIntervalMinutes ?? config.slotIntervalMinutes ?? offer.durationMinutes,
  ).filter((time) =>
    isBookableSlot({
      dateStr,
      time,
      durationMinutes: offer.durationMinutes,
      intervalMinutes: offer.slotIntervalMinutes,
      dateExceptions,
      bookings,
      now,
      config,
    }),
  );
}
