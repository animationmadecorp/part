import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHmac } from "node:crypto";
import {
  isSlotTaken,
  parisInstant,
} from "../app/nouveau/_booking/bookingLogic.mjs";
import { getResendConfig, canSendResendTo, sendBookingNotification } from "../lib/resend-server.mjs";
import { notificationIdempotencyKey } from "../convex/notificationKeys.js";
import {
  createStripeCheckoutSession,
  getStripeConfig,
  parseVerifiedStripeEvent,
  verifyStripeSignature,
} from "../lib/stripe-server.mjs";

const now = new Date("2026-09-01T00:00:00.000Z");
const startISO = parisInstant("2026-09-16", "09:00").toISOString();

assert.equal(
  isSlotTaken({
    dateStr: "2026-09-16",
    time: "09:00",
    durationMinutes: 60,
    now,
    bookings: [{ startISO, durationMinutes: 60, status: "confirmed" }],
  }),
  true,
  "confirmed bookings block overlapping slots",
);
assert.equal(
  isSlotTaken({
    dateStr: "2026-09-16",
    time: "09:00",
    durationMinutes: 60,
    now,
    bookings: [{ startISO, durationMinutes: 60, status: "cancelled" }],
  }),
  false,
  "cancelled bookings do not block slots",
);
assert.equal(
  isSlotTaken({
    dateStr: "2026-09-16",
    time: "09:00",
    durationMinutes: 60,
    now,
    bookings: [{ startISO, durationMinutes: 60, status: "pending", holdExpiresAt: now.getTime() - 1 }],
  }),
  false,
  "expired holds do not block slots",
);

const timestamp = 1_700_000_000;
const body = JSON.stringify({ id: "evt_test", type: "checkout.session.completed" });
const signature = createHmac("sha256", "whsec_test")
  .update(`${timestamp}.${body}`)
  .digest("hex");
assert.equal(
  verifyStripeSignature(body, `t=${timestamp},v1=${signature}`, "whsec_test", { nowSeconds: timestamp }),
  true,
  "Stripe signatures are accepted only with the expected secret",
);
assert.equal(
  verifyStripeSignature(body, `t=${timestamp},v1=${signature}`, "whsec_wrong", { nowSeconds: timestamp }),
  false,
  "Stripe signatures reject a wrong secret",
);

const disabledResendEnv = {
  RESEND_API_KEY: "re_test",
  RESEND_FROM_EMAIL: "test@example.com",
  RESEND_TEST_RECIPIENTS: "client@example.com",
  RESEND_SEND_ENABLED: "false",
};
const disabledResend = getResendConfig(disabledResendEnv);
assert.equal(disabledResend.enabled, false);
assert.equal(canSendResendTo("client@example.com", disabledResendEnv), false, "Resend stays disabled by default");
assert.equal(canSendResendTo("client@example.com", { ...disabledResendEnv, RESEND_SEND_ENABLED: "true" }), true, "Resend allows only its explicit test recipient");
assert.equal(canSendResendTo("other@example.com", { ...disabledResendEnv, RESEND_SEND_ENABLED: "true" }), false, "Resend recipient allow-list is enforced");

const enabledResendEnv = {
  RESEND_API_KEY: "re_test",
  RESEND_FROM_EMAIL: "test@example.com",
  RESEND_TEST_RECIPIENTS: "client@example.com",
  RESEND_SEND_ENABLED: "true",
  RESEND_APP_URL: "https://preview.animation-made.test",
};
const resendRequests = [];
const resendFetch = globalThis.fetch;
globalThis.fetch = async (_url, options) => {
  resendRequests.push({
    body: String(options.body),
    idempotencyKey: options.headers["Idempotency-Key"],
  });
  return new Response(JSON.stringify({ id: "email_test_fixed" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
try {
  const snapshotBooking = {
    email: "Client@Example.com",
    date: "2026-09-24",
    time: "09:00",
    timezone: "Europe/Paris",
  };
  const notificationKey = notificationIdempotencyKey("notification_test", "reminder", 0);
  assert.equal(notificationKey, "notification:notification_test:reminder:0");
  await sendBookingNotification({
    kind: "reminder",
    booking: snapshotBooking,
    idempotencyKey: notificationKey,
    env: enabledResendEnv,
  });
  await sendBookingNotification({
    kind: "reminder",
    booking: snapshotBooking,
    idempotencyKey: notificationKey,
    env: enabledResendEnv,
  });
  assert.equal(resendRequests.length, 2, "Notification retry reaches the provider with the same request contract");
  assert.equal(resendRequests[0].body, resendRequests[1].body, "Notification content is stable across retries");
  assert.equal(resendRequests[0].idempotencyKey, resendRequests[1].idempotencyKey, "Notification idempotency key is stable");
  assert.match(resendRequests[0].body, /client@example\.com/);
  assert.match(resendRequests[0].body, /"html":"<!doctype html>/, "Resend receives a mobile HTML alternative");
  assert.match(resendRequests[0].body, /"text":"/, "Resend keeps a text alternative");
} finally {
  globalThis.fetch = resendFetch;
}

assert.equal(getStripeConfig({ STRIPE_SECRET_KEY: "sk_live_not_allowed" }).configured, false, "live Stripe keys are refused");
const liveBody = JSON.stringify({ id: "evt_live", type: "checkout.session.completed", livemode: true, data: { object: {} } });
const liveTimestamp = Math.floor(Date.now() / 1000);
const liveSignature = createHmac("sha256", "whsec_test")
  .update(`${liveTimestamp}.${liveBody}`)
  .digest("hex");
assert.throws(
  () => parseVerifiedStripeEvent(liveBody, `t=${liveTimestamp},v1=${liveSignature}`, { STRIPE_WEBHOOK_SECRET: "whsec_test" }, { nowSeconds: liveTimestamp }),
  /Invalid Stripe webhook payload|Live Stripe events are not accepted/,
  "live Stripe events are refused even with a valid signature",
);

const originalFetch = globalThis.fetch;
const stripeRequests = [];
globalThis.fetch = async (_url, options) => {
  stripeRequests.push({
    body: String(options.body),
    idempotencyKey: options.headers["Idempotency-Key"],
  });
  return new Response(JSON.stringify({ id: "cs_test_fixed", url: "https://checkout.stripe.test/cs_test_fixed" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
try {
  const stableStripeArgs = {
    amountCents: 5500,
    productName: "Cours d’anglais",
    description: "Cours particulier",
    customerEmail: "client@example.com",
    bookingId: "booking_test_123",
    userId: "user_test_123",
    offerKey: "anglais",
    mode: "solo",
    expiresAt: 1_790_000_000_000,
    successUrl: "http://localhost:3010/nouveau/confirmation",
    cancelUrl: "http://localhost:3010/nouveau/confirmation?etat=annule",
    idempotencyKey: "booking:booking_test_123",
    env: { STRIPE_SECRET_KEY: "sk_test_fixed" },
  };
  await createStripeCheckoutSession(stableStripeArgs);
  await createStripeCheckoutSession(stableStripeArgs);
  assert.equal(stripeRequests.length, 2, "Checkout retry reaches Stripe with the same request contract");
  assert.equal(stripeRequests[0].body, stripeRequests[1].body, "Checkout parameters are frozen across retries");
  assert.equal(stripeRequests[0].idempotencyKey, stripeRequests[1].idempotencyKey, "Checkout idempotency key is stable");
} finally {
  globalThis.fetch = originalFetch;
}

const [schema, bookings, stripeServer, checkoutRoute, webhookRoute, followUp, availabilityPage, bookingPage, bookingCalendar] = await Promise.all([
  readFile(new URL("../convex/schema.js", import.meta.url), "utf8"),
  readFile(new URL("../convex/bookings.js", import.meta.url), "utf8"),
  readFile(new URL("../lib/stripe-server.mjs", import.meta.url), "utf8"),
  readFile(new URL("../app/api/stripe/checkout/route.js", import.meta.url), "utf8"),
  readFile(new URL("../app/api/stripe/webhook/route.js", import.meta.url), "utf8"),
  readFile(new URL("../app/nouveau/bibliotheque/EnglishFollowUp.js", import.meta.url), "utf8"),
  readFile(new URL("../app/admin/disponibilites/page.js", import.meta.url), "utf8"),
  readFile(new URL("../app/nouveau/reserver/page.js", import.meta.url), "utf8"),
  readFile(new URL("../app/nouveau/reserver/BookingCalendar.js", import.meta.url), "utf8"),
]);

assert.match(schema, /bookings: defineTable/);
assert.match(schema, /entitlements: defineTable/);
assert.match(schema, /stripeEvents: defineTable/);
assert.match(schema, /bookingNotifications: defineTable/);
assert.match(schema, /stripeRefunds: defineTable/);
assert.match(schema, /rescheduleOperations: defineTable/);
assert.match(schema, /scheduleRevision: v\.optional\(v\.number\(\)\)/);
assert.match(schema, /notificationSnapshot: v\.optional\(v\.object/);
assert.match(bookings, /ctx\.auth\.getUserIdentity\(\)/);
assert.match(bookings, /isSlotBookable/);
assert.match(bookings, /by_idempotency/);
assert.match(bookings, /stripeEvents/);
assert.match(bookings, /claimStripeEffect/);
assert.match(bookings, /claimStripeRefund/);
assert.match(bookings, /deliverBookingNotification/);
assert.match(bookings, /internalActionGeneric/);
assert.match(bookings, /REMINDER_LEAD_MS/);
assert.match(bookings, /status: "not_due"/);
assert.match(bookings, /rescheduleRevision/);
assert.match(bookings, /findRescheduleOperation/);
assert.match(bookings, /notificationSnapshot\(updatedBooking\)/);
assert.match(bookings, /confirmCreditBooking/);
assert.match(bookings, /validUntil <= startAt/);
assert.match(bookings, /RESCHEDULE_TOO_LATE/);
assert.match(bookings, /safeMeetUrl/);
assert.match(checkoutRoute, /getCheckoutPayload/);
assert.match(checkoutRoute, /attachCheckoutSession/);
assert.match(checkoutRoute, /retryable/);
assert.match(stripeServer, /Idempotency-Key/);
assert.match(stripeServer, /expiresAt/);
assert.match(webhookRoute, /parseVerifiedStripeEvent/);
assert.match(webhookRoute, /confirmFromStripe/);
assert.match(webhookRoute, /claimStripeRefund/);
assert.match(followUp, /getMyFollowUp/);
assert.match(followUp, /rescheduleBooking/);
assert.match(followUp, /idempotencyKey/);
assert.match(followUp, /let clockSnapshot = Date\.now\(\)/, "follow-up clock snapshot is cached for useSyncExternalStore");
assert.match(followUp, /const getClock = \(\) => clockSnapshot/, "follow-up clock reads the cached snapshot");
assert.match(availabilityPage, /requireAdminPage/);
assert.doesNotMatch(availabilityPage, /isSuperAdmin/);
assert.match(bookingPage, /requireConnectedMemberPage/);
assert.match(bookingCalendar, /activeHold/);

console.log("connected booking local security and contract checks: PASS");
