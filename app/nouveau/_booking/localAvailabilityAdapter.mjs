import {
  DEFAULT_BOOKING_CONFIG,
  isValidDateKey,
  timeToMinutes,
} from "./bookingLogic.mjs";

export const LOCAL_AVAILABILITY_STORAGE_KEY = "animation-made:availability:v1";
export const LOCAL_AVAILABILITY_SCHEMA_VERSION = 1;
export const WEEKDAY_KEYS = Object.freeze([1, 2, 3, 4, 5, 6, 7]);

const DEFAULT_WEEKLY_AVAILABILITY = Object.freeze(
  Object.fromEntries(
    WEEKDAY_KEYS.map((weekday) => [
      weekday,
      (DEFAULT_BOOKING_CONFIG.weeklyAvailability[weekday] ?? []).map((range) => ({
        start: range.start,
        end: range.end,
      })),
    ]),
  ),
);

export const DEFAULT_AVAILABILITY = Object.freeze({
  weeklyAvailability: DEFAULT_WEEKLY_AVAILABILITY,
  dateExceptions: Object.freeze({}),
});

/**
 * AvailabilityAdapter is the seam for the local demo and the production data
 * source. It exposes the weekly pattern and date exceptions independently of
 * the booking form. A Convex implementation keeps getAvailability() and
 * saveAvailability() with this same snapshot shape; the calendar does not
 * need to know which persistence layer is behind it.
 *
 * @typedef {Object} AvailabilityAdapter
 * @property {() => Promise<AvailabilitySnapshot>} getAvailability
 * @property {(availability: AvailabilitySnapshot) => Promise<AvailabilitySnapshot>} saveAvailability
 * @property {() => Promise<AvailabilitySnapshot>} resetAvailability
 *
 * @typedef {Object} AvailabilitySnapshot
 * @property {Object<string, Array<{start: string, end: string}>>} weeklyAvailability
 * @property {Object<string, Array<{start: string, end: string}>>} dateExceptions
 */

function cloneRanges(ranges) {
  return (Array.isArray(ranges) ? ranges : []).map((range) => ({
    start: range.start,
    end: range.end,
  }));
}

function isValidRange(range) {
  if (!range || typeof range !== "object") return false;
  const start = timeToMinutes(range.start);
  const end = timeToMinutes(range.end);
  return Number.isFinite(start) && Number.isFinite(end) && start < end;
}

function normalizeRanges(ranges) {
  return (Array.isArray(ranges) ? ranges : [])
    .filter(isValidRange)
    .map((range) => ({ start: range.start, end: range.end }))
    .sort((left, right) => timeToMinutes(left.start) - timeToMinutes(right.start));
}

export function cloneAvailability(availability) {
  const source = availability && typeof availability === "object" ? availability : {};
  const rawWeekly =
    source.weeklyAvailability && typeof source.weeklyAvailability === "object"
      ? source.weeklyAvailability
      : DEFAULT_AVAILABILITY.weeklyAvailability;
  const weeklyAvailability = {};

  for (const weekday of WEEKDAY_KEYS) {
    const key = String(weekday);
    const ranges = Object.prototype.hasOwnProperty.call(rawWeekly, key)
      ? rawWeekly[key]
      : DEFAULT_AVAILABILITY.weeklyAvailability[weekday];
    weeklyAvailability[key] = normalizeRanges(ranges);
  }

  const rawExceptions =
    source.dateExceptions && typeof source.dateExceptions === "object"
      ? source.dateExceptions
      : {};
  const dateExceptions = {};
  for (const [dateKey, ranges] of Object.entries(rawExceptions)) {
    if (!isValidDateKey(dateKey) || !Array.isArray(ranges)) continue;
    dateExceptions[dateKey] = normalizeRanges(ranges);
  }

  return { weeklyAvailability, dateExceptions };
}

export function validateAvailability(availability) {
  if (!availability || typeof availability !== "object") {
    throw new Error("Les disponibilités sont invalides.");
  }
  if (!availability.weeklyAvailability || typeof availability.weeklyAvailability !== "object") {
    throw new Error("Les horaires hebdomadaires sont invalides.");
  }
  if (!availability.dateExceptions || typeof availability.dateExceptions !== "object") {
    throw new Error("Les exceptions sont invalides.");
  }

  for (const weekday of WEEKDAY_KEYS) {
    const ranges = availability.weeklyAvailability[String(weekday)];
    if (!Array.isArray(ranges) || ranges.some((range) => !isValidRange(range))) {
      throw new Error("Vérifie les horaires hebdomadaires.");
    }
  }
  for (const [dateKey, ranges] of Object.entries(availability.dateExceptions)) {
    if (!isValidDateKey(dateKey) || !Array.isArray(ranges) || ranges.some((range) => !isValidRange(range))) {
      throw new Error("Vérifie les exceptions par date.");
    }
  }

  return cloneAvailability(availability);
}

function getDefaultStorage(storage) {
  if (storage !== undefined) return storage;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readStoredAvailability(storage) {
  if (!storage) return null;
  try {
    const stored = JSON.parse(storage.getItem(LOCAL_AVAILABILITY_STORAGE_KEY) ?? "null");
    if (stored?.version !== LOCAL_AVAILABILITY_SCHEMA_VERSION) return null;
    return cloneAvailability(stored.availability);
  } catch {
    return null;
  }
}

function writeStoredAvailability(storage, availability) {
  storage.setItem(
    LOCAL_AVAILABILITY_STORAGE_KEY,
    JSON.stringify({
      version: LOCAL_AVAILABILITY_SCHEMA_VERSION,
      availability,
    }),
  );
}

/** @returns {AvailabilityAdapter} */
export function createLocalAvailabilityAdapter({ storage } = {}) {
  const browserStorage = getDefaultStorage(storage);
  let memoryAvailability = cloneAvailability(DEFAULT_AVAILABILITY);
  let storageWriteFailed = !browserStorage;

  function currentAvailability() {
    if (!storageWriteFailed) {
      const stored = readStoredAvailability(browserStorage);
      if (stored) memoryAvailability = stored;
    }
    return cloneAvailability(memoryAvailability);
  }

  return {
    async getAvailability() {
      return currentAvailability();
    },

    async saveAvailability(nextAvailability) {
      const normalized = validateAvailability(nextAvailability);
      if (storageWriteFailed) {
        throw new Error("Les disponibilités ne peuvent pas être enregistrées dans ce navigateur.");
      }
      try {
        writeStoredAvailability(browserStorage, normalized);
      } catch {
        // Availability changes must not look saved when the local demo storage
        // is blocked or full; Convex will replace this boundary in production.
        storageWriteFailed = true;
        throw new Error("Les disponibilités ne peuvent pas être enregistrées dans ce navigateur.");
      }
      memoryAvailability = normalized;
      return cloneAvailability(memoryAvailability);
    },

    async resetAvailability() {
      return this.saveAvailability(DEFAULT_AVAILABILITY);
    },
  };
}

// The public booking adapter composes this local availability adapter with the
// local bookings store. A future Convex adapter can preserve both contracts.
export function getAvailabilityAdapter(options) {
  return createLocalAvailabilityAdapter(options);
}
