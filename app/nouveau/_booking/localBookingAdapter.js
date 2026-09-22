import {
  BOOKING_TIMEZONE,
  DEFAULT_BOOKING_CONFIG,
  getBookableSlots,
  getBookingOffer,
  isBookableSlot,
  isValidParisWallClock,
  isSlotTaken,
  parisInstant,
} from "./bookingLogic.mjs";
import { createLocalAvailabilityAdapter } from "./localAvailabilityAdapter.mjs";

export const LOCAL_BOOKING_STORAGE_KEY = "animation-made:bookings:v1";

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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

function parseBookings(storage, memoryBookings) {
  if (!storage) return memoryBookings;
  try {
    const value = JSON.parse(storage.getItem(LOCAL_BOOKING_STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter(isValidStoredBooking) : [];
  } catch {
    return memoryBookings;
  }
}

function persistBookings(storage, bookings) {
  if (!storage) return true;
  try {
    storage.setItem(LOCAL_BOOKING_STORAGE_KEY, JSON.stringify(bookings));
    return true;
  } catch {
    // The in-memory copy still makes the current session usable when storage
    // is blocked by a privacy setting or a full browser quota.
    return false;
  }
}

function isValidStoredBooking(booking) {
  if (!booking || typeof booking !== "object") return false;
  const duration = Number(booking.durationMinutes);
  if (!Number.isInteger(duration) || duration <= 0 || duration > 24 * 60) return false;
  if (booking.date || booking.time) {
    if (
      typeof booking.date !== "string" ||
      typeof booking.time !== "string" ||
      !isValidParisWallClock(booking.date, booking.time)
    ) {
      return false;
    }
  }
  if (booking.startISO) {
    const start = new Date(booking.startISO);
    if (Number.isNaN(start.getTime())) return false;
  } else if (!booking.date || !booking.time) {
    return false;
  }
  return true;
}

function adapterError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * @typedef {Object} BookingAdapter
 * @property {(args?: { fromDate?: string, toDate?: string }) => Promise<{ weeklyAvailability: Object, dateExceptions: Object, bookings: Array<Object> }>} getAvailability
 * @property {(input: { offerKey: string, mode?: string, date: string, time: string, name: string, email: string, message?: string }) => Promise<Object>} createBooking
 */

/** @returns {BookingAdapter} */
export function createLocalBookingAdapter({ storage } = {}) {
  const browserStorage = getDefaultStorage(storage);
  const availabilityAdapter = createLocalAvailabilityAdapter({ storage });
  let memoryBookings = [];
  let storageWriteFailed = !browserStorage;

  function currentBookings() {
    if (storageWriteFailed) return memoryBookings;
    const bookings = parseBookings(browserStorage, memoryBookings);
    memoryBookings = bookings;
    return bookings;
  }

  async function snapshot() {
    const availability = await availabilityAdapter.getAvailability();
    return {
      weeklyAvailability: availability.weeklyAvailability,
      dateExceptions: availability.dateExceptions,
      bookings: currentBookings(),
    };
  }

  return {
    async getAvailability() {
      return snapshot();
    },

    async createBooking(input) {
      const availability = await availabilityAdapter.getAvailability();
      const offer = getBookingOffer(input?.offerKey, input?.mode);
      if (!offer) {
        throw adapterError("INVALID_OFFER", "Cette offre ne peut pas être réservée.");
      }

      const name = String(input?.name ?? "").trim();
      const email = String(input?.email ?? "").trim();
      const message = String(input?.message ?? "").trim();
      if (!name || name.length > 120 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        throw adapterError("INVALID_INPUT", "Vérifie ton nom et ton adresse e-mail.");
      }
      if (message.length > 1000) {
        throw adapterError("INVALID_INPUT", "Ton message est trop long.");
      }

      const bookings = currentBookings();
      const now = new Date();
      let valid = false;
      try {
        valid = isBookableSlot({
          dateStr: input.date,
          time: input.time,
          durationMinutes: offer.durationMinutes,
          intervalMinutes: offer.slotIntervalMinutes,
          dateExceptions: availability.dateExceptions,
          bookings,
          now,
          config: {
            ...DEFAULT_BOOKING_CONFIG,
            weeklyAvailability: availability.weeklyAvailability,
          },
        });
      } catch {
        throw adapterError("INVALID_INPUT", "Choisis un créneau proposé dans le calendrier.");
      }
      if (!valid || isSlotTaken({
        dateStr: input.date,
        time: input.time,
        durationMinutes: offer.durationMinutes,
        bookings,
      })) {
        throw adapterError(
          "SLOT_UNAVAILABLE",
          "Ce créneau n’est plus disponible. Choisis-en un autre.",
        );
      }

      const startISO = parisInstant(input.date, input.time).toISOString();
      const booking = {
        id: makeId(),
        offerKey: offer.key,
        mode: offer.mode,
        date: input.date,
        time: input.time,
        startISO,
        durationMinutes: offer.durationMinutes,
        timezone: BOOKING_TIMEZONE,
        name,
        email,
        message,
        createdAt: new Date().toISOString(),
      };
      const nextBookings = [...bookings, booking];
      memoryBookings = nextBookings;
      storageWriteFailed = !persistBookings(browserStorage, nextBookings);
      return booking;
    },
  };
}

// Kept as a named seam so a Convex/Clerk/Stripe-aware adapter can replace the
// local constructor at one import boundary later. Availability is isolated in
// localAvailabilityAdapter.mjs.
export function getBookingAdapter(options) {
  return createLocalBookingAdapter(options);
}

export { getBookableSlots };
