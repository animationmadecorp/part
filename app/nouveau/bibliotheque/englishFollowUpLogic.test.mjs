import assert from "node:assert/strict";
import { test } from "node:test";
import { getUpcomingEnglishBookings } from "./englishFollowUpLogic.mjs";

test("keeps every future paid course in chronological order", () => {
  const now = Date.parse("2026-09-23T08:00:00Z");
  const bookings = [
    { id: "later", status: "confirmed", paymentStatus: "paid", startISO: "2026-10-01T07:00:00Z" },
    { id: "past", status: "confirmed", paymentStatus: "paid", startISO: "2026-09-22T07:00:00Z" },
    { id: "first", status: "confirmed", paymentStatus: "paid", startISO: "2026-09-24T09:00:00Z" },
    { id: "cancelled", status: "cancelled", paymentStatus: "paid", startISO: "2026-10-02T07:00:00Z" },
    { id: "unpaid", status: "confirmed", paymentStatus: "unpaid", startISO: "2026-10-03T07:00:00Z" },
    { id: "expired", status: "pending", holdExpiresAt: now - 1, startISO: "2026-09-25T09:00:00Z" },
    { id: "pending", status: "pending", holdExpiresAt: now + 60_000, startISO: "2026-09-30T09:00:00Z" },
  ];
  assert.deepEqual(getUpcomingEnglishBookings(bookings, now).map(({ id }) => id), ["first", "pending", "later"]);
});
