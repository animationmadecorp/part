import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { register } from "node:module";
import { parseVerifiedStripeEvent } from "../lib/stripe-server.mjs";
import { mapEntitlementToPurchaseHistory } from "../app/nouveau/bibliotheque/accountLogic.mjs";

register("./resolve-convex-imports.mjs", import.meta.url);
const {
  applyStripeRefund,
  confirmCreditBooking,
  confirmFromStripe,
} = await import("../convex/bookings.js");

const webhookSecret = "refund-secret-test";
const now = Date.now();
const INDEX_FIELDS = {
  by_booking: "bookingId",
  by_checkout_session: "stripeCheckoutSessionId",
  by_dedupe_key: "dedupeKey",
  by_entitlement: "entitlementId",
  by_event_id: "eventId",
  by_idempotency: "idempotencyKey",
  by_payment_intent: "stripePaymentIntentId",
  by_source_event: "sourceEventId",
  by_token_identifier: "tokenIdentifier",
};

function createHarness(initial = {}) {
  const state = {
    bookings: [],
    bookingEvents: [],
    bookingNotifications: [],
    creditLedger: [],
    entitlements: [],
    stripeEvents: [],
    stripeRefunds: [],
    ...Object.fromEntries(Object.entries(initial).map(([table, rows]) => [table, rows.map((row) => ({ ...row }))])),
  };
  const counters = new Map();
  const allRows = () => Object.values(state).flat();
  const context = {
    auth: {
      getUserIdentity: async () => ({ subject: "member-a", tokenIdentifier: "token-a" }),
    },
    db: {
      get: async (id) => allRows().find((row) => row._id === id) || null,
      insert: async (table, value) => {
        const next = (counters.get(table) || 0) + 1;
        counters.set(table, next);
        const id = `${table}-${next}`;
        state[table].push({ ...value, _id: id });
        return id;
      },
      patch: async (id, value) => {
        const row = allRows().find((candidate) => candidate._id === id);
        if (!row) throw new Error(`Missing row ${id}`);
        Object.assign(row, value);
      },
      query: (table) => ({
        withIndex: (indexName, callback) => {
          let field = INDEX_FIELDS[indexName];
          let expected;
          callback({ eq: (nextField, nextValue) => { field = nextField; expected = nextValue; } });
          const rows = () => (state[table] || []).filter((row) => row[field] === expected);
          return {
            collect: async () => rows(),
            first: async () => rows()[0] || null,
          };
        },
        collect: async () => state[table] || [],
      }),
    },
    scheduler: {
      runAfter: async () => undefined,
      runAt: async () => undefined,
    },
  };
  return { context, state };
}

function entitlement({ id, user = "member-a", token = "token-a", paymentIntentId, remainingCredits = 1, mode = "solo" }) {
  return {
    _id: id,
    clerkUserId: user,
    tokenIdentifier: token,
    offerKey: "anglais",
    mode,
    totalCredits: mode === "solo-4h" ? 4 : 1,
    remainingCredits,
    status: "active",
    stripeCheckoutSessionId: `cs-${id}`,
    stripePaymentIntentId: paymentIntentId,
    createdAt: now,
    updatedAt: now,
  };
}

function booking({ id, paymentIntentId, entitlementId, status = "confirmed", paymentStatus = "paid", user = "member-a", mode: requestedMode }) {
  const mode = requestedMode || (entitlementId && /pack|partial/.test(entitlementId) ? "solo-4h" : "solo");
  return {
    _id: id,
    clerkUserId: user,
    tokenIdentifier: user === "member-a" ? "token-a" : `token-${user}`,
    offerKey: "anglais",
    mode,
    date: "2026-10-15",
    time: "09:00",
    startAt: now + 7 * 24 * 60 * 60 * 1000,
    endAt: now + 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000,
    durationMinutes: 60,
    timezone: "Europe/Paris",
    status,
    paymentStatus,
    holdExpiresAt: now + 30 * 60 * 1000,
    stripeExpiresAt: now + 60 * 60 * 1000,
    idempotencyKey: `hold-${id}-idempotency`,
    stripeCheckoutSessionId: `cs-${id}`,
    stripePaymentIntentId: paymentIntentId,
    name: "Member",
    email: "member@example.com",
    level: "intermediate",
    difficulties: "oral",
    goal: "practice",
    ...(entitlementId ? { entitlementId } : {}),
    creditsConsumed: Boolean(entitlementId),
    createdAt: now,
    updatedAt: now,
    rescheduleRevision: 0,
  };
}

async function call(handler, context, args) {
  return handler(context, args);
}

const refundHandler = applyStripeRefund._handler;
const confirmHandler = confirmFromStripe._handler;
const confirmCreditHandler = confirmCreditBooking._handler;
const previousSecret = process.env.BOOKING_WEBHOOK_SECRET;
process.env.BOOKING_WEBHOOK_SECRET = webhookSecret;

try {
  const full = createHarness({
    entitlements: [
      entitlement({ id: "ent-pack-a", paymentIntentId: "pi-pack-a", remainingCredits: 3, mode: "solo-4h" }),
      entitlement({ id: "ent-pack-b", paymentIntentId: "pi-pack-b", remainingCredits: 4, mode: "solo-4h" }),
    ],
    bookings: [
      booking({ id: "booking-pack-a", paymentIntentId: "pi-pack-a", entitlementId: "ent-pack-a" }),
      booking({ id: "booking-pack-b", paymentIntentId: "pi-pack-b", entitlementId: "ent-pack-b" }),
    ],
  });
  const fullArgs = {
    webhookSecret,
    eventId: "evt-refund-pack-a",
    paymentIntentId: "pi-pack-a",
    bookingId: "booking-pack-a",
    amountTotal: 20000,
    amountRefunded: 20000,
    currency: "eur",
    refunded: true,
  };
  const fullResult = await call(refundHandler, full.context, fullArgs);
  assert.equal(fullResult.status, "refunded");
  assert.equal(full.state.entitlements.find((row) => row._id === "ent-pack-a").remainingCredits, 0);
  assert.equal(full.state.entitlements.find((row) => row._id === "ent-pack-a").status, "refunded");
  assert.equal(full.state.bookings.find((row) => row._id === "booking-pack-a").paymentStatus, "refunded");
  assert.equal(full.state.bookings.find((row) => row._id === "booking-pack-a").status, "refunded");
  assert.equal(full.state.entitlements.find((row) => row._id === "ent-pack-b").remainingCredits, 4, "another order keeps its credits");
  assert.equal(full.state.bookings.find((row) => row._id === "booking-pack-b").paymentStatus, "paid", "another booking is untouched");
  assert.deepEqual(full.state.creditLedger.map((row) => ({ kind: row.kind, units: row.units, key: row.idempotencyKey })), [
    { kind: "adjust", units: -3, key: "refund:pi-pack-a:revoke" },
  ]);
  assert.equal(full.state.bookingEvents.length, 1);
  const replayResult = await call(refundHandler, full.context, fullArgs);
  assert.equal(replayResult.duplicate, true);
  assert.equal(full.state.creditLedger.length, 1, "same Stripe event cannot add a second revocation");
  const secondEventResult = await call(refundHandler, full.context, { ...fullArgs, eventId: "evt-refund-pack-a-replay" });
  assert.equal(secondEventResult.status, "already_refunded", "a new replay for the same PaymentIntent stays terminal");
  assert.equal(full.state.creditLedger.length, 1);
  await assert.rejects(
    () => call(confirmCreditHandler, full.context, { bookingId: "booking-pack-a" }),
    /PAYMENT_REQUIRED/,
    "a refunded booking cannot consume the revoked entitlement",
  );
  assert.equal(mapEntitlementToPurchaseHistory({ id: "ent-pack-a", offerKey: "anglais", mode: "solo-4h", status: "refunded", refundStatus: "refunded" }).status, "Remboursé");

  const partial = createHarness({
    entitlements: [entitlement({ id: "ent-partial", paymentIntentId: "pi-partial", remainingCredits: 3, mode: "solo-4h" })],
    bookings: [booking({ id: "booking-partial", paymentIntentId: "pi-partial", entitlementId: "ent-partial" })],
  });
  const partialResult = await call(refundHandler, partial.context, {
    webhookSecret,
    eventId: "evt-refund-partial",
    paymentIntentId: "pi-partial",
    bookingId: "booking-partial",
    amountTotal: 20000,
    amountRefunded: 5000,
    currency: "eur",
    refunded: false,
  });
  assert.equal(partialResult.status, "partial_refund");
  assert.equal(partial.state.entitlements[0].remainingCredits, 3, "partial refund does not invent a credit-revocation policy");
  assert.equal(partial.state.entitlements[0].refundStatus, "partial");
  assert.equal(partial.state.entitlements[0].refundedAmountCents, 5000);
  assert.equal(partial.state.bookings[0].paymentStatus, "paid");
  assert.equal(partial.state.bookings[0].refundStatus, "partial");
  assert.equal(partial.state.bookingEvents[0].status, "partial_refund");
  await call(refundHandler, partial.context, {
    webhookSecret,
    eventId: "evt-refund-partial-cumulative",
    paymentIntentId: "pi-partial",
    bookingId: "booking-partial",
    amountTotal: 20000,
    amountRefunded: 8000,
    currency: "eur",
    refunded: false,
  });
  assert.equal(partial.state.entitlements[0].refundedAmountCents, 8000, "partial amount is cumulative and never decreases");
  const partialThenFull = await call(refundHandler, partial.context, {
    webhookSecret,
    eventId: "evt-refund-partial-completed",
    paymentIntentId: "pi-partial",
    bookingId: "booking-partial",
    amountTotal: 20000,
    amountRefunded: 20000,
    currency: "eur",
    refunded: true,
  });
  assert.equal(partialThenFull.status, "refunded");
  assert.equal(partial.state.entitlements[0].remainingCredits, 0);
  assert.equal(partial.state.entitlements[0].refundedAmountCents, 20000);

  const refundBeforeSuccess = createHarness({
    bookings: [booking({ id: "booking-before-success", paymentIntentId: "pi-before-success", status: "pending", paymentStatus: "unpaid" })],
  });
  const beforeSuccess = await call(refundHandler, refundBeforeSuccess.context, {
    webhookSecret,
    eventId: "evt-before-success-refund",
    paymentIntentId: "pi-before-success",
    bookingId: "booking-before-success",
    amountTotal: 5500,
    amountRefunded: 5500,
    currency: "eur",
    refunded: true,
  });
  assert.equal(beforeSuccess.status, "refunded");
  const lateSuccess = await call(confirmHandler, refundBeforeSuccess.context, {
    webhookSecret,
    eventId: "evt-before-success-paid",
    eventType: "checkout.session.completed",
    bookingId: "booking-before-success",
    checkoutSessionId: "cs-before-success",
    paymentIntentId: "pi-before-success",
    paymentStatus: "paid",
    amountTotal: 5500,
    currency: "eur",
  });
  assert.equal(lateSuccess.status, "already_refunded");
  assert.equal(refundBeforeSuccess.state.entitlements.length, 0, "refund before payment success cannot create rights later");
  assert.equal(refundBeforeSuccess.state.bookings[0].status, "refunded");

  const partialBeforeSuccess = createHarness({
    bookings: [booking({
      id: "booking-partial-before-success",
      paymentIntentId: "pi-partial-before-success",
      status: "pending",
      paymentStatus: "unpaid",
      mode: "solo-4h",
    })],
  });
  const partialBefore = await call(refundHandler, partialBeforeSuccess.context, {
    webhookSecret,
    eventId: "evt-partial-before-success-refund",
    paymentIntentId: "pi-partial-before-success",
    bookingId: "booking-partial-before-success",
    amountTotal: 20000,
    amountRefunded: 5000,
    currency: "eur",
    refunded: false,
  });
  assert.equal(partialBefore.status, "partial_refund");
  assert.equal(partialBeforeSuccess.state.entitlements.length, 0);
  const partialPaid = await call(confirmHandler, partialBeforeSuccess.context, {
    webhookSecret,
    eventId: "evt-partial-before-success-paid",
    eventType: "payment_intent.succeeded",
    bookingId: "booking-partial-before-success",
    paymentIntentId: "pi-partial-before-success",
    paymentStatus: "paid",
    amountTotal: 20000,
    currency: "eur",
  });
  assert.equal(partialPaid.status, "confirmed");
  assert.equal(partialBeforeSuccess.state.bookings[0].refundStatus, "partial");
  assert.equal(partialBeforeSuccess.state.bookings[0].refundedAmountCents, 5000);
  assert.equal(partialBeforeSuccess.state.entitlements[0].status, "partial_refund");
  assert.equal(partialBeforeSuccess.state.entitlements[0].refundStatus, "partial");
  assert.equal(partialBeforeSuccess.state.entitlements[0].refundedAmountCents, 5000);
  assert.equal(partialBeforeSuccess.state.entitlements[0].remainingCredits, 3, "partial refund preserves the explicit credit policy");

  const outOfOrderFull = createHarness({
    bookings: [booking({ id: "booking-out-of-order-full", status: "pending", paymentStatus: "unpaid" })],
  });
  await call(refundHandler, outOfOrderFull.context, {
    webhookSecret,
    eventId: "evt-out-of-order-full",
    paymentIntentId: "pi-out-of-order-full",
    amountTotal: 5500,
    amountRefunded: 5500,
    currency: "eur",
    refunded: true,
  });
  await call(refundHandler, outOfOrderFull.context, {
    webhookSecret,
    eventId: "evt-out-of-order-old-partial",
    paymentIntentId: "pi-out-of-order-full",
    amountTotal: 5500,
    amountRefunded: 2500,
    currency: "eur",
    refunded: false,
  });
  const outOfOrderPaid = await call(confirmHandler, outOfOrderFull.context, {
    webhookSecret,
    eventId: "evt-out-of-order-paid",
    eventType: "payment_intent.succeeded",
    bookingId: "booking-out-of-order-full",
    paymentIntentId: "pi-out-of-order-full",
    paymentStatus: "paid",
    amountTotal: 5500,
    currency: "eur",
  });
  assert.equal(outOfOrderPaid.status, "already_refunded", "a later full refund remains terminal despite an older partial event");
  assert.equal(outOfOrderFull.state.entitlements.length, 0);

  const outOfOrderPartial = createHarness({
    bookings: [booking({ id: "booking-out-of-order-partial", status: "pending", paymentStatus: "unpaid", mode: "solo-4h" })],
  });
  for (const [eventId, amountRefunded] of [["evt-partial-8000", 8000], ["evt-partial-5000", 5000]]) {
    await call(refundHandler, outOfOrderPartial.context, {
      webhookSecret,
      eventId,
      paymentIntentId: "pi-out-of-order-partial",
      amountTotal: 20000,
      amountRefunded,
      currency: "eur",
      refunded: false,
    });
  }
  const outOfOrderPartialPaid = await call(confirmHandler, outOfOrderPartial.context, {
    webhookSecret,
    eventId: "evt-partial-out-of-order-paid",
    eventType: "payment_intent.succeeded",
    bookingId: "booking-out-of-order-partial",
    paymentIntentId: "pi-out-of-order-partial",
    paymentStatus: "paid",
    amountTotal: 20000,
    currency: "eur",
  });
  assert.equal(outOfOrderPartialPaid.status, "confirmed");
  assert.equal(outOfOrderPartial.state.entitlements[0].refundStatus, "partial");
  assert.equal(outOfOrderPartial.state.entitlements[0].refundedAmountCents, 8000, "unmatched partial refunds are monotone");

  const successBeforeRefund = createHarness({
    bookings: [booking({ id: "booking-success-first", paymentIntentId: "pi-success-first", status: "pending", paymentStatus: "unpaid" })],
  });
  const paidFirst = await call(confirmHandler, successBeforeRefund.context, {
    webhookSecret,
    eventId: "evt-success-first",
    eventType: "payment_intent.succeeded",
    bookingId: "booking-success-first",
    paymentIntentId: "pi-success-first",
    paymentStatus: "paid",
    amountTotal: 5500,
    currency: "eur",
  });
  assert.equal(paidFirst.status, "confirmed");
  assert.equal(successBeforeRefund.state.entitlements.length, 1);
  const checkoutBeforeRefund = await call(confirmHandler, successBeforeRefund.context, {
    webhookSecret,
    eventId: "evt-checkout-before-refund",
    eventType: "checkout.session.completed",
    bookingId: "booking-success-first",
    checkoutSessionId: "cs-success-first",
    paymentIntentId: "pi-success-first",
    paymentStatus: "paid",
    amountTotal: 5500,
    currency: "eur",
  });
  assert.equal(checkoutBeforeRefund.status, "already_confirmed", "payment-intent then checkout produces one confirmation");
  assert.equal(successBeforeRefund.state.entitlements.length, 1);
  const refundedAfterPaid = await call(refundHandler, successBeforeRefund.context, {
    webhookSecret,
    eventId: "evt-refund-after-success",
    paymentIntentId: "pi-success-first",
    bookingId: "booking-success-first",
    amountTotal: 5500,
    amountRefunded: 5500,
    currency: "eur",
    refunded: true,
  });
  assert.equal(refundedAfterPaid.status, "refunded");
  assert.equal(successBeforeRefund.state.entitlements[0].remainingCredits, 0);
  assert.equal(successBeforeRefund.state.creditLedger.at(-1).kind, "adjust");
  assert.equal(successBeforeRefund.state.creditLedger.at(-1).units, 0);
  assert.equal(successBeforeRefund.state.creditLedger.at(-1).idempotencyKey, "refund:pi-success-first:revoke");
  const checkoutReplay = await call(confirmHandler, successBeforeRefund.context, {
    webhookSecret,
    eventId: "evt-checkout-after-payment-intent",
    eventType: "checkout.session.completed",
    bookingId: "booking-success-first",
    checkoutSessionId: "cs-success-first",
    paymentIntentId: "pi-success-first",
    paymentStatus: "paid",
    amountTotal: 5500,
    currency: "eur",
  });
  assert.equal(checkoutReplay.status, "already_refunded", "payment-intent then checkout replay cannot resurrect a refund");
  assert.equal(successBeforeRefund.state.entitlements.length, 1);

  const unmatched = createHarness({
    bookings: [booking({ id: "booking-unmatched", paymentIntentId: undefined, status: "pending", paymentStatus: "unpaid" })],
  });
  const unmatchedRefund = await call(refundHandler, unmatched.context, {
    webhookSecret,
    eventId: "evt-unmatched-refund",
    paymentIntentId: "pi-unmatched",
    amountTotal: 5500,
    amountRefunded: 5500,
    currency: "eur",
    refunded: true,
  });
  assert.equal(unmatchedRefund.kind, "unmatched");
  const unmatchedPaid = await call(confirmHandler, unmatched.context, {
    webhookSecret,
    eventId: "evt-unmatched-paid",
    eventType: "payment_intent.succeeded",
    bookingId: "booking-unmatched",
    paymentIntentId: "pi-unmatched",
    paymentStatus: "paid",
    amountTotal: 5500,
    currency: "eur",
  });
  assert.equal(unmatchedPaid.status, "already_refunded", "an authenticated unmatched refund is applied when the booking appears");
  assert.equal(unmatched.state.entitlements.length, 0);

  const isolatedBooking = createHarness({
    entitlements: [entitlement({ id: "ent-isolated-b", paymentIntentId: "pi-isolated-b", remainingCredits: 4, mode: "solo-4h" })],
    bookings: [booking({ id: "booking-isolated-a", status: "pending", paymentStatus: "unpaid" })],
  });
  const isolatedRefund = await call(refundHandler, isolatedBooking.context, {
    webhookSecret,
    eventId: "evt-isolated-refund",
    paymentIntentId: "pi-isolated-b",
    bookingId: "booking-isolated-a",
    amountTotal: 20000,
    amountRefunded: 20000,
    currency: "eur",
    refunded: true,
  });
  assert.equal(isolatedRefund.kind, "rejected", "a booking without a PI cannot borrow another order's entitlement");
  assert.equal(isolatedRefund.status, "refund_rejected_mismatch");
  assert.equal(isolatedBooking.state.entitlements[0].status, "active");
  assert.equal(isolatedBooking.state.entitlements[0].remainingCredits, 4);
  assert.equal(isolatedBooking.state.bookings[0].status, "pending");

  const mismatch = createHarness({
    bookings: [
      booking({ id: "booking-mismatch-a", paymentIntentId: "pi-mismatch-a" }),
      booking({ id: "booking-mismatch-b", paymentIntentId: "pi-mismatch-b" }),
    ],
  });
  const mismatchResult = await call(refundHandler, mismatch.context, {
    webhookSecret,
    eventId: "evt-mismatch",
    paymentIntentId: "pi-mismatch-a",
    bookingId: "booking-mismatch-b",
    amountTotal: 5500,
    amountRefunded: 5500,
    currency: "eur",
    refunded: true,
  });
  assert.equal(mismatchResult.kind, "rejected", "a mismatched refund is terminal and journaled");
  assert.equal(mismatchResult.status, "refund_rejected_mismatch");
  assert.equal(mismatch.state.stripeEvents.length, 1);
  assert.equal(mismatch.state.stripeEvents[0].status, "refund_rejected_mismatch");
  assert.equal(mismatch.state.bookings.every((row) => row.paymentStatus === "paid"), true);

  const amountMismatch = createHarness({
    bookings: [booking({ id: "booking-amount-mismatch", paymentIntentId: "pi-amount-mismatch" })],
  });
  const amountMismatchResult = await call(refundHandler, amountMismatch.context, {
    webhookSecret,
    eventId: "evt-amount-mismatch",
    paymentIntentId: "pi-amount-mismatch",
    bookingId: "booking-amount-mismatch",
    amountTotal: 9999,
    amountRefunded: 9999,
    currency: "eur",
    refunded: true,
  });
  assert.equal(amountMismatchResult.kind, "rejected");
  assert.equal(amountMismatchResult.status, "refund_rejected_amount");
  assert.equal(amountMismatch.state.stripeEvents[0].status, "refund_rejected_amount");
  assert.equal(amountMismatch.state.bookings[0].status, "confirmed");

  const body = JSON.stringify({ id: "evt-signed-refund", type: "charge.refunded", livemode: false, data: { object: {} } });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", "whsec_test")
    .update(`${timestamp}.${body}`, "utf8")
    .digest("hex");
  assert.equal(
    parseVerifiedStripeEvent(body, `t=${timestamp},v1=${signature}`, { STRIPE_WEBHOOK_SECRET: "whsec_test" }).type,
    "charge.refunded",
  );
  const liveBody = body.replace('"livemode":false', '"livemode":true');
  const liveSignature = createHmac("sha256", "whsec_test")
    .update(`${timestamp}.${liveBody}`, "utf8")
    .digest("hex");
  assert.throws(
    () => parseVerifiedStripeEvent(liveBody, `t=${timestamp},v1=${liveSignature}`, { STRIPE_WEBHOOK_SECRET: "whsec_test" }),
    /Invalid Stripe webhook payload/,
    "live refund events remain refused",
  );

  const [schema, bookings, webhookRoute, account, stripeServer] = await Promise.all([
    readFile(new URL("../convex/schema.js", import.meta.url), "utf8"),
    readFile(new URL("../convex/bookings.js", import.meta.url), "utf8"),
    readFile(new URL("../app/api/stripe/webhook/route.js", import.meta.url), "utf8"),
    readFile(new URL("../convex/account.js", import.meta.url), "utf8"),
    readFile(new URL("../lib/stripe-server.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(schema, /bookingEvents: defineTable/);
  assert.match(schema, /paymentStatus: v\.union\(v\.literal\("unpaid"\), v\.literal\("paid"\), v\.literal\("refunded"\)\)/);
  assert.match(bookings, /export const applyStripeRefund/);
  assert.match(bookings, /charge\.refunded/);
  assert.match(bookings, /refund:\$\{args\.paymentIntentId\}:revoke/);
  assert.match(webhookRoute, /applyStripeRefund/);
  assert.match(webhookRoute, /event\.type === "charge\.refunded"\s*\?\s*typeof object\.payment_intent/);
  assert.match(webhookRoute, /bookingRefund\.kind === "unmatched" && englishRefundMarker/);
  assert.match(webhookRoute, /getStripePaymentIntent/);
  assert.match(webhookRoute, /refund_classification_failed/);
  assert.match(stripeServer, /export async function getStripePaymentIntent/);
  assert.match(account, /refundStatus/);

  console.log("English Stripe refunds: authentication, idempotence, ordering, isolation and history: PASS");
} finally {
  if (previousSecret === undefined) delete process.env.BOOKING_WEBHOOK_SECRET;
  else process.env.BOOKING_WEBHOOK_SECRET = previousSecret;
}
