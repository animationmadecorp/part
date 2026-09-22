import assert from "node:assert/strict";
import {
  BOOKING_TIMEZONE,
  DEFAULT_BOOKING_CONFIG,
  generateSlots,
  getBookableSlots,
  getBookingOffer,
  isBookableSlot,
  isValidParisWallClock,
  isSlotTaken,
  parisInstant,
  resolveRanges,
} from "../app/nouveau/_booking/bookingLogic.mjs";
import {
  createLocalAvailabilityAdapter,
  DEFAULT_AVAILABILITY,
  LOCAL_AVAILABILITY_STORAGE_KEY,
} from "../app/nouveau/_booking/localAvailabilityAdapter.mjs";

assert.equal(BOOKING_TIMEZONE, "Europe/Paris");
assert.equal(
  parisInstant("2026-01-15", "10:00").toISOString(),
  "2026-01-15T09:00:00.000Z",
);
assert.equal(
  parisInstant("2026-07-15", "10:00").toISOString(),
  "2026-07-15T08:00:00.000Z",
);
assert.equal(isValidParisWallClock("2026-03-29", "02:30"), false);
assert.equal(isValidParisWallClock("2026-10-25", "02:30"), true);

assert.deepEqual(
  generateSlots([{ start: "09:00", end: "09:50" }], 20),
  ["09:00", "09:20"],
);
assert.deepEqual(
  generateSlots([{ start: "09:00", end: "12:00" }], 60),
  ["09:00", "10:00", "11:00"],
);
assert.deepEqual(resolveRanges({}, "2026-09-16", DEFAULT_BOOKING_CONFIG), [
  { start: "09:00", end: "12:00" },
]);
assert.deepEqual(
  resolveRanges({ "2026-09-16": [] }, "2026-09-16", DEFAULT_BOOKING_CONFIG),
  [],
);

assert.equal(getBookingOffer("projet-animation"), null);
assert.equal(getBookingOffer("contenu"), null);
// Exercise generic 20-minute scheduling independently of the current catalogue.
const contentOffer = { key: "test-short-session", durationMinutes: 20 };
const englishSolo = getBookingOffer("anglais");
const englishDuo = getBookingOffer("anglais", "duo");
assert.equal(contentOffer.durationMinutes, 20);
assert.equal(englishSolo.durationMinutes, 60);
assert.equal(englishDuo.durationMinutes, 60);
assert.equal(getBookingOffer("visibilite"), null);

const earlyEnough = new Date("2026-09-01T00:00:00.000Z");
const dstEarlyEnough = new Date("2026-03-01T00:00:00.000Z");
assert.equal(
  isBookableSlot({
    dateStr: "2026-03-26",
    time: "09:00",
    durationMinutes: contentOffer.durationMinutes,
    now: dstEarlyEnough,
  }),
  true,
);
assert.equal(
  isBookableSlot({
    dateStr: "2026-09-16",
    time: "09:00",
    durationMinutes: contentOffer.durationMinutes,
    now: earlyEnough,
  }),
  true,
);
assert.equal(
  isBookableSlot({
    dateStr: "2026-09-16",
    time: "09:13",
    durationMinutes: contentOffer.durationMinutes,
    now: earlyEnough,
  }),
  false,
);
assert.equal(
  isBookableSlot({
    dateStr: "2026-03-29",
    time: "02:00",
    durationMinutes: 20,
    dateExceptions: { "2026-03-29": [{ start: "02:00", end: "03:00" }] },
    now: dstEarlyEnough,
  }),
  false,
);
assert.equal(
  isBookableSlot({
    dateStr: "2026-03-29",
    time: "01:30",
    durationMinutes: 60,
    dateExceptions: { "2026-03-29": [{ start: "01:30", end: "03:00" }] },
    now: dstEarlyEnough,
  }),
  false,
);
assert.equal(
  isBookableSlot({
    dateStr: "2026-09-16",
    time: "09:00",
    durationMinutes: contentOffer.durationMinutes,
    dateExceptions: { "2026-09-16": [] },
    now: earlyEnough,
  }),
  false,
);
assert.equal(
  isBookableSlot({
    dateStr: "2026-09-16",
    time: "11:00",
    durationMinutes: contentOffer.durationMinutes,
    now: new Date("2026-09-16T08:00:00.000Z"),
  }),
  false,
);
assert.equal(
  isBookableSlot({
    dateStr: "2026-11-01",
    time: "09:00",
    durationMinutes: contentOffer.durationMinutes,
    now: earlyEnough,
  }),
  false,
);

const booked = [{
  startISO: parisInstant("2026-09-16", "09:00").toISOString(),
  durationMinutes: 60,
}];
assert.equal(
  isSlotTaken({
    dateStr: "2026-09-16",
    time: "09:20",
    durationMinutes: 20,
    bookings: booked,
  }),
  true,
);
assert.deepEqual(
  getBookableSlots({
    dateStr: "2026-09-16",
    offer: englishSolo,
    bookings: booked,
    now: earlyEnough,
  }),
  ["10:00", "11:00"],
);

assert.equal(
  isBookableSlot({
    dateStr: "2026-02-31",
    time: "09:00",
    durationMinutes: 20,
    now: earlyEnough,
  }),
  false,
);
assert.equal(
  isSlotTaken({
    dateStr: "2026-09-16",
    time: "09:20",
    durationMinutes: 20,
    bookings: [{ date: "not-a-date", time: "99:99", durationMinutes: 20 }],
  }),
  false,
);
assert.equal(getBookingOffer("__proto__"), null);

const storedValues = new Map();
const storage = {
  getItem(key) {
    return storedValues.get(key) ?? null;
  },
  setItem(key, value) {
    storedValues.set(key, value);
  },
};
const availabilityToSave = {
  weeklyAvailability: {
    ...DEFAULT_AVAILABILITY.weeklyAvailability,
    1: [{ start: "10:00", end: "11:00" }],
  },
  dateExceptions: { "2026-09-17": [] },
};
const savedAvailability = await createLocalAvailabilityAdapter({ storage }).saveAvailability(
  availabilityToSave,
);
assert.equal(storedValues.has(LOCAL_AVAILABILITY_STORAGE_KEY), true);
assert.deepEqual(
  await createLocalAvailabilityAdapter({ storage }).getAvailability(),
  savedAvailability,
);
await assert.rejects(
  () => createLocalAvailabilityAdapter({ storage: null }).saveAvailability(availabilityToSave),
  /ne peuvent pas être enregistrées/,
);
const quotaStorage = {
  getItem() {
    return null;
  },
  setItem() {
    throw new Error("QuotaExceededError");
  },
};
await assert.rejects(
  () => createLocalAvailabilityAdapter({ storage: quotaStorage }).saveAvailability(availabilityToSave),
  /ne peuvent pas être enregistrées/,
);
assert.deepEqual(
  getBookableSlots({
    dateStr: "2026-09-14",
    offer: contentOffer,
    dateExceptions: savedAvailability.dateExceptions,
    bookings: [],
    now: earlyEnough,
    config: {
      ...DEFAULT_BOOKING_CONFIG,
      weeklyAvailability: savedAvailability.weeklyAvailability,
    },
  }),
  ["10:00", "10:20", "10:40"],
);

console.log("booking verification: ok");
