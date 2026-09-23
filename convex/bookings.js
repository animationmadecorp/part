import { internalActionGeneric, internalMutationGeneric, internalQueryGeneric, mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  BOOKING_TIMEZONE,
  DEFAULT_BOOKING_SETTINGS,
  HOLD_DURATION_MINUTES,
  BOOKING_OFFERS,
  addValidityMonths,
  effectiveBookingStatus,
  getBookingOffer,
  isBookingActive,
  isSlotBookable,
  normalizeAvailability,
  parisInstant,
  safeMeetUrl,
  validEmail,
} from "./bookingRules";
import { notificationIdempotencyKey } from "./notificationKeys";
import { renderBookingEmail, safeAppOrigin } from "./notificationTemplates";
import { getResendConfig } from "../lib/resend-server.mjs";

const EFFECT_RETRY_AFTER_MS = 60 * 1000;
const NOTIFICATION_RETRY_AFTER_MS = 5 * 60 * 1000;
const REMINDER_LEAD_MS = 24 * 60 * 60 * 1000;

const availabilityArgs = {
  weeklyAvailability: v.array(
    v.object({
      weekday: v.number(),
      ranges: v.array(v.object({ start: v.string(), end: v.string() })),
    }),
  ),
  dateExceptions: v.array(
    v.object({
      date: v.string(),
      ranges: v.array(v.object({ start: v.string(), end: v.string() })),
    }),
  ),
};

const holdArgs = {
  offerKey: v.string(),
  mode: v.string(),
  date: v.string(),
  time: v.string(),
  name: v.string(),
  email: v.string(),
  level: v.string(),
  difficulties: v.string(),
  goal: v.string(),
  idempotencyKey: v.string(),
  entitlementId: v.optional(v.id("entitlements")),
};

function bookingError(code, message) {
  throw new Error(`${code}: ${message}`);
}

async function requireIdentity(ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) bookingError("UNAUTHENTICATED", "Authentication required");
  const tokenIdentifier = identity.tokenIdentifier || identity.subject;
  return { identity, tokenIdentifier, clerkUserId: identity.subject };
}

async function findProfile(ctx, tokenIdentifier) {
  return ctx.db
    .query("users")
    .withIndex("by_token_identifier", (query) => query.eq("tokenIdentifier", tokenIdentifier))
    .first();
}

async function requireAdmin(ctx) {
  const current = await requireIdentity(ctx);
  const profile = await findProfile(ctx, current.tokenIdentifier);
  if (profile?.role !== "admin") bookingError("FORBIDDEN", "Administrator access required");
  return { ...current, profile };
}

async function getSettings(ctx) {
  const settings = await ctx.db
    .query("bookingSettings")
    .withIndex("by_key", (query) => query.eq("key", "default"))
    .first();
  if (!settings) return DEFAULT_BOOKING_SETTINGS;
  return normalizeAvailability(settings);
}

async function getAllBookings(ctx) {
  return ctx.db.query("bookings").collect();
}

function activeBookings(bookings, now, excludeId = null) {
  return bookings.filter(
    (booking) => booking._id !== excludeId && isBookingActive(booking, now),
  );
}

function safePublicBooking(booking, { includePrivate = false, now = Date.now() } = {}) {
  if (!booking) return null;
  const publicValue = {
    id: booking._id,
    offerKey: booking.offerKey,
    mode: booking.mode,
    date: booking.date,
    time: booking.time,
    startISO: new Date(booking.startAt).toISOString(),
    durationMinutes: booking.durationMinutes,
    timezone: booking.timezone,
    status: effectiveBookingStatus(booking, now),
    paymentStatus: booking.paymentStatus,
    ...(booking.refundStatus === undefined ? {} : { refundStatus: booking.refundStatus }),
    ...(booking.refundedAmountCents === undefined ? {} : { refundedAmountCents: booking.refundedAmountCents }),
    creditsConsumed: booking.creditsConsumed,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    ...(booking.holdExpiresAt === undefined ? {} : { holdExpiresAt: booking.holdExpiresAt }),
    ...(booking.meetUrl === undefined ? {} : { meetUrl: booking.meetUrl }),
    ...(booking.rescheduledAt === undefined ? {} : { rescheduledAt: booking.rescheduledAt }),
    ...(booking.rescheduledBy === undefined ? {} : { rescheduledBy: booking.rescheduledBy }),
    ...(booking.rescheduleReason === undefined ? {} : { rescheduleReason: booking.rescheduleReason }),
    ...(booking.rescheduleRevision === undefined ? {} : { rescheduleRevision: booking.rescheduleRevision }),
  };
  if (includePrivate) {
    return {
      ...publicValue,
      name: booking.name,
      email: booking.email,
      level: booking.level,
      difficulties: booking.difficulties,
      goal: booking.goal,
      clerkUserId: booking.clerkUserId,
      tokenIdentifier: booking.tokenIdentifier,
      stripeCheckoutSessionId: booking.stripeCheckoutSessionId,
      stripePaymentIntentId: booking.stripePaymentIntentId,
      entitlementId: booking.entitlementId,
    };
  }
  return publicValue;
}

async function findOwnedBooking(ctx, bookingId, current) {
  const booking = await ctx.db.get(bookingId);
  if (!booking) bookingError("NOT_FOUND", "Booking not found");
  if (
    booking.clerkUserId !== current.clerkUserId ||
    booking.tokenIdentifier !== current.tokenIdentifier
  ) {
    bookingError("FORBIDDEN", "Booking belongs to another account");
  }
  return booking;
}

function assertText(value, field, maxLength) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    bookingError("INVALID_INPUT", `Invalid ${field}`);
  }
  return value.trim();
}

function assertIdempotencyKey(value) {
  if (typeof value !== "string" || value.length < 16 || value.length > 160) {
    bookingError("INVALID_INPUT", "Invalid idempotency key");
  }
  return value;
}

function sameHoldRequest(booking, args) {
  return (
    booking.offerKey === args.offerKey &&
    booking.mode === args.mode &&
    booking.date === args.date &&
    booking.time === args.time
  );
}

async function findBookingByField(ctx, indexName, fieldValue) {
  if (!fieldValue) return null;
  return ctx.db
    .query("bookings")
    .withIndex(indexName, (query) => query.eq(indexName === "by_checkout_session" ? "stripeCheckoutSessionId" : "stripePaymentIntentId", fieldValue))
    .first();
}

async function findLedger(ctx, idempotencyKey) {
  return ctx.db
    .query("creditLedger")
    .withIndex("by_idempotency", (query) => query.eq("idempotencyKey", idempotencyKey))
    .first();
}

async function findRescheduleOperation(ctx, idempotencyKey) {
  if (!idempotencyKey) return null;
  return ctx.db
    .query("rescheduleOperations")
    .withIndex("by_idempotency_key", (query) => query.eq("idempotencyKey", idempotencyKey))
    .first();
}

async function findRefundEffect(ctx, paymentIntentId) {
  if (!paymentIntentId) return null;
  return ctx.db
    .query("stripeRefunds")
    .withIndex("by_payment_intent", (query) => query.eq("paymentIntentId", paymentIntentId))
    .first();
}

async function findEntitlementsByPaymentIntent(ctx, paymentIntentId) {
  if (!paymentIntentId) return [];
  return ctx.db
    .query("entitlements")
    .withIndex("by_payment_intent", (query) => query.eq("stripePaymentIntentId", paymentIntentId))
    .collect();
}

async function findBookingsByPaymentIntent(ctx, paymentIntentId) {
  if (!paymentIntentId) return [];
  return ctx.db
    .query("bookings")
    .withIndex("by_payment_intent", (query) => query.eq("stripePaymentIntentId", paymentIntentId))
    .collect();
}

async function findBookingsForEntitlement(ctx, entitlementId) {
  if (!entitlementId) return [];
  return ctx.db
    .query("bookings")
    .withIndex("by_entitlement", (query) => query.eq("entitlementId", entitlementId))
    .collect();
}

async function findRefundEventByPaymentIntent(ctx, paymentIntentId) {
  if (!paymentIntentId) return null;
  const events = await ctx.db
    .query("stripeEvents")
    .withIndex("by_payment_intent", (query) => query.eq("paymentIntentId", paymentIntentId))
    .collect();
  const refunds = events
    .filter((event) =>
      event.eventType === "charge.refunded" &&
      [
        "refund_applied",
        "refund_already_applied",
        "refund_unmatched",
        "refund_partial",
        "refund_unmatched_partial",
      ].includes(event.status),
    );
  const fullRefunds = refunds.filter((event) =>
    ["refund_applied", "refund_already_applied", "refund_unmatched"].includes(event.status),
  );
  if (fullRefunds.length > 0) {
    return {
      ...fullRefunds.sort((left, right) => right.processedAt - left.processedAt)[0],
      refundKind: "full",
    };
  }
  const partialRefunds = refunds.filter((event) =>
    ["refund_partial", "refund_unmatched_partial"].includes(event.status),
  );
  if (partialRefunds.length === 0) return null;
  const maxRefundedAmountCents = Math.max(
    ...partialRefunds.map((event) => Number.isSafeInteger(event.amountRefunded) ? event.amountRefunded : 0),
  );
  const representative = partialRefunds.sort((left, right) => {
    const amountDifference = (right.amountRefunded || 0) - (left.amountRefunded || 0);
    return amountDifference || (right.processedAt - left.processedAt);
  })[0];
  return {
    ...representative,
    refundKind: "partial",
    ...(maxRefundedAmountCents > 0 ? { amountRefunded: maxRefundedAmountCents } : {}),
  };
}

async function recordBookingEvent(ctx, {
  bookingId,
  eventType,
  status,
  sourceEventId,
  paymentIntentId,
  amountTotal,
  amountRefunded,
  now,
}) {
  const existing = await ctx.db
    .query("bookingEvents")
    .withIndex("by_source_event", (query) => query.eq("sourceEventId", sourceEventId))
    .collect();
  const alreadyRecorded = existing.find((event) => event.bookingId === bookingId);
  if (alreadyRecorded) return alreadyRecorded;
  const id = await ctx.db.insert("bookingEvents", {
    bookingId,
    eventType,
    status,
    sourceEventId,
    ...(paymentIntentId ? { paymentIntentId } : {}),
    ...(amountTotal === undefined ? {} : { amountTotal }),
    ...(amountRefunded === undefined ? {} : { amountRefunded }),
    createdAt: now,
  });
  return await ctx.db.get(id);
}

async function recordRefundRejection(ctx, {
  eventId,
  paymentIntentId,
  bookingId,
  amountTotal,
  amountRefunded,
  status,
  now,
}) {
  await ctx.db.insert("stripeEvents", {
    eventId,
    eventType: "charge.refunded",
    status,
    ...(bookingId ? { bookingId } : {}),
    paymentIntentId,
    ...(amountTotal === undefined ? {} : { amountTotal }),
    ...(amountRefunded === undefined ? {} : { amountRefunded }),
    processedAt: now,
  });
  return { kind: "rejected", duplicate: false, eventId, status };
}

function isFullChargeRefund({ refunded, amountTotal, amountRefunded }) {
  return refunded === true || (
    Number.isFinite(amountTotal) &&
    Number.isFinite(amountRefunded) &&
    amountRefunded >= amountTotal
  );
}

async function ensureRefundEffect(ctx, { paymentIntentId, eventId, now }) {
  const existing = await findRefundEffect(ctx, paymentIntentId);
  if (existing) return existing;
  const id = await ctx.db.insert("stripeRefunds", {
    paymentIntentId,
    sourceEventId: eventId,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });
  return await ctx.db.get(id);
}

async function grantAndConsumeCredit(ctx, { booking, offer, identity, checkoutSessionId, paymentIntentId, now }) {
  const entitlementKey = checkoutSessionId || `payment-intent:${paymentIntentId || booking._id}`;
  let entitlement = booking.entitlementId ? await ctx.db.get(booking.entitlementId) : null;
  if (!entitlement) {
    entitlement = await ctx.db
      .query("entitlements")
      .withIndex("by_checkout_session", (query) => query.eq("stripeCheckoutSessionId", entitlementKey))
      .first();
  }

  if (entitlement) {
    if (
      entitlement.clerkUserId !== identity.clerkUserId ||
      entitlement.tokenIdentifier !== identity.tokenIdentifier ||
      entitlement.offerKey !== offer.key ||
      entitlement.mode !== offer.mode
    ) {
      bookingError("PAYMENT_MISMATCH", "Payment does not belong to this account or offer");
    }
    if (entitlement.status === "refunded" || entitlement.refundStatus === "refunded") {
      bookingError("CREDITS_UNAVAILABLE", "This English entitlement was refunded");
    }
  } else {
    const entitlementId = await ctx.db.insert("entitlements", {
      clerkUserId: identity.clerkUserId,
      tokenIdentifier: identity.tokenIdentifier,
      offerKey: offer.key,
      mode: offer.mode,
      totalCredits: offer.sessionCount,
      priceCents: booking.priceCents ?? offer.priceCents,
      remainingCredits: offer.sessionCount,
      validUntil: addValidityMonths(now, offer.validityMonths),
      stripeCheckoutSessionId: entitlementKey,
      ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
      createdAt: now,
      updatedAt: now,
    });
    entitlement = await ctx.db.get(entitlementId);
    await ctx.db.insert("creditLedger", {
      entitlementId,
      clerkUserId: identity.clerkUserId,
      kind: "grant",
      units: offer.sessionCount,
      idempotencyKey: `grant:${entitlementKey}`,
      createdAt: now,
    });
  }

  if (booking.creditsConsumed) return entitlement;
  if ((offer.sessionCount > 1 && entitlement.validUntil <= booking.startAt) || entitlement.remainingCredits < 1) {
    bookingError("CREDITS_UNAVAILABLE", "No valid credit remains for this booking");
  }
  const consumeKey = `consume:${booking._id}`;
  const consumed = await findLedger(ctx, consumeKey);
  if (!consumed) {
    await ctx.db.insert("creditLedger", {
      entitlementId: entitlement._id,
      clerkUserId: identity.clerkUserId,
      bookingId: booking._id,
      kind: "consume",
      units: 1,
      idempotencyKey: consumeKey,
      createdAt: now,
    });
    await ctx.db.patch(entitlement._id, {
      remainingCredits: entitlement.remainingCredits - 1,
      updatedAt: now,
    });
  }
  return entitlement;
}

async function confirmBookingInTransaction(ctx, { booking, identity, checkoutSessionId, paymentIntentId, now }) {
  const offer = getBookingOffer(booking.offerKey, booking.mode);
  if (!offer) bookingError("INVALID_OFFER", "Unknown booking offer");
  const all = await getAllBookings(ctx);
  if (!isBookingActive(booking, now)) {
    bookingError("HOLD_EXPIRED", "The temporary hold has expired");
  }
  if (
    all.some(
      (candidate) =>
        candidate._id !== booking._id &&
        isBookingActive(candidate, now) &&
        booking.startAt < candidate.endAt &&
        candidate.startAt < booking.endAt,
    )
  ) {
    bookingError("SLOT_UNAVAILABLE", "The held slot is no longer available");
  }
  const entitlement = await grantAndConsumeCredit(ctx, {
    booking,
    offer,
    identity,
    checkoutSessionId,
    paymentIntentId,
    now,
  });
  await ctx.db.patch(booking._id, {
    status: "confirmed",
    paymentStatus: "paid",
    holdExpiresAt: undefined,
    ...(checkoutSessionId ? { stripeCheckoutSessionId: checkoutSessionId } : {}),
    ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
    entitlementId: entitlement._id,
    creditsConsumed: true,
    updatedAt: now,
  });
  const confirmed = await ctx.db.get(booking._id);
  await queueBookingNotification(ctx, {
    bookingId: confirmed._id,
    kind: "reminder",
    dedupeKey: `reminder:${confirmed._id}:${confirmed.rescheduleRevision || 0}`,
    scheduleRevision: confirmed.rescheduleRevision || 0,
    now,
    delayMs: Math.max(0, confirmed.startAt - now - REMINDER_LEAD_MS),
  });
  return confirmed;
}

async function queueBookingNotification(
  ctx,
  { bookingId, kind, dedupeKey, scheduleRevision, now = Date.now(), delayMs = 0 },
) {
  const existing = await ctx.db
    .query("bookingNotifications")
    .withIndex("by_dedupe_key", (query) => query.eq("dedupeKey", dedupeKey))
    .first();
  if (existing) return existing;
  const booking = await ctx.db.get(bookingId);
  if (!booking) bookingError("NOT_FOUND", "Booking not found");
  const notificationId = await ctx.db.insert("bookingNotifications", {
    bookingId,
    kind,
    dedupeKey,
    status: "pending",
    attempts: 0,
    ...(scheduleRevision === undefined ? {} : { scheduleRevision }),
    deliverySnapshot: notificationSnapshot(booking),
    createdAt: now,
    updatedAt: now,
  });
  await ctx.scheduler.runAfter(delayMs, internal.bookings.deliverBookingNotification, {
    notificationId,
    ...(scheduleRevision === undefined ? {} : { scheduleRevision }),
  });
  return await ctx.db.get(notificationId);
}

function notificationSnapshot(booking) {
  return {
    email: booking.email.trim().toLowerCase(),
    date: booking.date,
    time: booking.time,
    timezone: booking.timezone,
  };
}

function notificationDeliveryBooking(notification, booking) {
  const snapshot = notification.deliverySnapshot;
  if (!snapshot) return booking;
  return {
    ...booking,
    email: snapshot.email,
    date: snapshot.date,
    time: snapshot.time,
    timezone: snapshot.timezone,
  };
}

async function requireNotificationAccess(ctx, notification) {
  const current = await requireIdentity(ctx);
  const booking = await ctx.db.get(notification.bookingId);
  if (!booking) bookingError("NOT_FOUND", "Booking not found");
  const profile = await findProfile(ctx, current.tokenIdentifier);
  const isOwner = booking.clerkUserId === current.clerkUserId && booking.tokenIdentifier === current.tokenIdentifier;
  if (!isOwner && profile?.role !== "admin") {
    bookingError("FORBIDDEN", "Notification belongs to another account");
  }
  return { current, booking, profile };
}

async function claimNotificationRecord(
  ctx,
  notification,
  booking,
  now = Date.now(),
  expectedScheduleRevision,
) {
  if (notification.kind === "reminder") {
    if (booking.status !== "confirmed" || booking.paymentStatus !== "paid") {
      if (!["sent", "skipped"].includes(notification.status)) {
        await ctx.db.patch(notification._id, {
          status: "skipped",
          lastError: "booking_no_longer_confirmed",
          updatedAt: now,
        });
      }
      return { claimed: false, status: "booking_no_longer_confirmed" };
    }
    const bookingRevision = booking.rescheduleRevision || 0;
    const notificationRevision = notification.scheduleRevision || 0;
    if (
      expectedScheduleRevision !== undefined &&
      expectedScheduleRevision !== notificationRevision
    ) {
      return { claimed: false, status: "stale" };
    }
    if (notificationRevision !== bookingRevision) {
      if (!(["sent", "skipped"].includes(notification.status))) {
        await ctx.db.patch(notification._id, {
          status: "skipped",
          lastError: "stale_schedule",
          updatedAt: now,
        });
      }
      return { claimed: false, status: "stale" };
    }
    const dueAt = booking.startAt - REMINDER_LEAD_MS;
    if (dueAt > now) return { claimed: false, status: "not_due", dueAt };
  }
  if (notification.status === "sent" || notification.status === "skipped") {
    return { claimed: false, status: notification.status };
  }
  if (
    notification.status === "sending" &&
    now - Number(notification.claimedAt || 0) < NOTIFICATION_RETRY_AFTER_MS
  ) {
    return { claimed: false, status: "sending" };
  }
  await ctx.db.patch(notification._id, {
    status: "sending",
    claimedAt: now,
    attempts: notification.attempts + 1,
    updatedAt: now,
  });
  await ctx.scheduler.runAfter(NOTIFICATION_RETRY_AFTER_MS, internal.bookings.deliverBookingNotification, {
    notificationId: notification._id,
    ...(notification.kind === "reminder"
      ? { scheduleRevision: notification.scheduleRevision || 0 }
      : {}),
  });
  return { claimed: true, status: "sending", attempts: notification.attempts + 1 };
}

async function completeNotificationRecord(ctx, notification, { status, providerId, error }) {
  if (notification.status === "sent" && status === "failed") return;
  await ctx.db.patch(notification._id, {
    status,
    ...(providerId ? { providerId } : {}),
    ...(error ? { lastError: error.slice(0, 500) } : {}),
    updatedAt: Date.now(),
  });
}

export const getBookingAvailability = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const settings = await getSettings(ctx);
    const now = Date.now();
    const bookings = await getAllBookings(ctx);
    const entitlements = await ctx.db
      .query("entitlements")
      .withIndex("by_token_identifier", (query) => query.eq("tokenIdentifier", identity.tokenIdentifier))
      .collect();
    return {
      timezone: BOOKING_TIMEZONE,
      serverNow: now,
      weeklyAvailability: settings.weeklyAvailability,
      dateExceptions: settings.dateExceptions,
      bookings: activeBookings(bookings, now).map((booking) => ({
        id: booking._id,
        startISO: new Date(booking.startAt).toISOString(),
        durationMinutes: booking.durationMinutes,
        status: booking.status,
        ...(booking.holdExpiresAt === undefined ? {} : { holdExpiresAt: booking.holdExpiresAt }),
      })),
      entitlements: entitlements
        .filter((entitlement) => entitlement.clerkUserId === identity.clerkUserId)
        .map((entitlement) => ({
          id: entitlement._id,
          offerKey: entitlement.offerKey,
          mode: entitlement.mode,
          remainingCredits: entitlement.remainingCredits,
          validUntil: entitlement.validUntil,
          status: entitlement.status || "active",
          ...(entitlement.refundStatus === undefined ? {} : { refundStatus: entitlement.refundStatus }),
          ...(entitlement.refundedAmountCents === undefined ? {} : { refundedAmountCents: entitlement.refundedAmountCents }),
        })),
      viewer: identity.clerkUserId,
    };
  },
});

export const createHold = mutationGeneric({
  args: holdArgs,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const idempotencyKey = assertIdempotencyKey(args.idempotencyKey);
    const previous = await ctx.db
      .query("bookings")
      .withIndex("by_idempotency", (query) => query.eq("idempotencyKey", idempotencyKey))
      .first();
    if (previous) {
      if (
        previous.clerkUserId !== identity.clerkUserId ||
        previous.tokenIdentifier !== identity.tokenIdentifier
      ) {
        bookingError("FORBIDDEN", "Idempotency key belongs to another account");
      }
      if (!sameHoldRequest(previous, args)) {
        bookingError("IDEMPOTENCY_MISMATCH", "The request differs from its first attempt");
      }
      return safePublicBooking(previous);
    }

    const offer = getBookingOffer(args.offerKey, args.mode);
    if (!offer) bookingError("INVALID_OFFER", "This offer cannot be booked");
    const date = assertText(args.date, "date", 10);
    const time = assertText(args.time, "time", 5);
    const name = assertText(args.name, "name", 120);
    const email = assertText(args.email, "email", 320);
    const level = assertText(args.level, "level", 160);
    const difficulties = assertText(args.difficulties, "difficulties", 1200);
    const goal = assertText(args.goal, "goal", 1200);
    if (!validEmail(email)) bookingError("INVALID_INPUT", "Invalid email");

    const now = Date.now();
    let startAt;
    try {
      startAt = parisInstant(date, time).getTime();
    } catch {
      bookingError("INVALID_INPUT", "Invalid date or time");
    }
    const settings = await getSettings(ctx);
    const allBookings = await getAllBookings(ctx);
    if (
      !isSlotBookable({
        date,
        time,
        offer,
        settings,
        bookings: activeBookings(allBookings, now),
        now,
      })
    ) {
      bookingError("SLOT_UNAVAILABLE", "This slot is no longer available");
    }

    let entitlement = null;
    if (args.entitlementId) {
      entitlement = await ctx.db.get(args.entitlementId);
      if (
        !entitlement ||
        entitlement.clerkUserId !== identity.clerkUserId ||
        entitlement.tokenIdentifier !== identity.tokenIdentifier ||
        entitlement.offerKey !== offer.key ||
        entitlement.mode !== offer.mode ||
        (offer.sessionCount > 1 && entitlement.validUntil <= startAt) ||
        entitlement.remainingCredits < 1 ||
        entitlement.status === "refunded" ||
        entitlement.refundStatus === "refunded"
      ) {
        bookingError("CREDITS_UNAVAILABLE", "This pack credit cannot be used");
      }
    }

    const bookingId = await ctx.db.insert("bookings", {
      clerkUserId: identity.clerkUserId,
      tokenIdentifier: identity.tokenIdentifier,
      offerKey: offer.key,
      mode: offer.mode,
      date,
      time,
      startAt,
      endAt: startAt + offer.durationMinutes * 60 * 1000,
      durationMinutes: offer.durationMinutes,
      timezone: BOOKING_TIMEZONE,
      priceCents: offer.priceCents,
      status: "pending",
      paymentStatus: entitlement ? "paid" : "unpaid",
      holdExpiresAt: now + HOLD_DURATION_MINUTES * 60 * 1000,
      // Keep a stable Stripe parameter for retries. The Convex hold remains
      // authoritative after 30 minutes and late paid events are refunded.
      stripeExpiresAt: now + (HOLD_DURATION_MINUTES + 30) * 60 * 1000,
      idempotencyKey,
      name,
      email,
      level,
      difficulties,
      goal,
      ...(entitlement ? { entitlementId: entitlement._id } : {}),
      creditsConsumed: false,
      rescheduleRevision: 0,
      createdAt: now,
      updatedAt: now,
    });
    return safePublicBooking(await ctx.db.get(bookingId));
  },
});

export const attachCheckoutSession = mutationGeneric({
  args: { bookingId: v.id("bookings"), checkoutSessionId: v.string() },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx);
    const booking = await findOwnedBooking(ctx, args.bookingId, current);
    const now = Date.now();
    if (booking.status !== "pending" || Number(booking.holdExpiresAt) <= now) {
      bookingError("HOLD_EXPIRED", "The temporary hold has expired");
    }
    if (
      booking.stripeCheckoutSessionId &&
      booking.stripeCheckoutSessionId !== args.checkoutSessionId
    ) {
      bookingError("IDEMPOTENCY_MISMATCH", "A different checkout session is already attached");
    }
    await ctx.db.patch(booking._id, {
      stripeCheckoutSessionId: args.checkoutSessionId,
      updatedAt: now,
    });
    return safePublicBooking(await ctx.db.get(booking._id));
  },
});

export const cancelHold = mutationGeneric({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx);
    const booking = await findOwnedBooking(ctx, args.bookingId, current);
    if (booking.status === "pending") {
      await ctx.db.patch(booking._id, { status: "cancelled", updatedAt: Date.now() });
    }
    return safePublicBooking(await ctx.db.get(booking._id));
  },
});

export const getCheckoutPayload = queryGeneric({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx);
    const booking = await findOwnedBooking(ctx, args.bookingId, current);
    const now = Date.now();
    if (booking.status !== "pending" || Number(booking.holdExpiresAt) <= now) {
      bookingError("HOLD_EXPIRED", "The temporary hold has expired");
    }
    if (booking.paymentStatus === "paid") {
      bookingError("ALREADY_PAID", "This booking does not require payment");
    }
    const offer = getBookingOffer(booking.offerKey, booking.mode);
    if (!offer) bookingError("INVALID_OFFER", "Unknown booking offer");
    return {
      bookingId: booking._id,
      amountCents: booking.priceCents ?? offer.priceCents,
      currency: "eur",
      offerKey: offer.key,
      mode: offer.mode,
      name: offer.title,
      description: `${offer.modeLabel} · ${offer.priceLabel}`,
      customerEmail: booking.email,
      holdExpiresAt: booking.holdExpiresAt,
      stripeExpiresAt: booking.stripeExpiresAt || booking.createdAt + (HOLD_DURATION_MINUTES + 30) * 60 * 1000,
      userId: current.clerkUserId,
    };
  },
});

export const confirmCreditBooking = mutationGeneric({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx);
    const booking = await findOwnedBooking(ctx, args.bookingId, current);
    if (booking.paymentStatus !== "paid" || !booking.entitlementId) {
      bookingError("PAYMENT_REQUIRED", "This booking still requires payment");
    }
    try {
      const now = Date.now();
      const confirmed = await confirmBookingInTransaction(ctx, {
        booking,
        identity: current,
        now,
      });
      const notification = await queueBookingNotification(ctx, {
        bookingId: confirmed._id,
        kind: "confirmed",
        dedupeKey: `confirmed:${confirmed._id}`,
        now,
      });
      return {
        ...safePublicBooking(confirmed, { now }),
        notificationId: notification._id,
      };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("HOLD_EXPIRED:")) {
        await ctx.db.patch(booking._id, { status: "expired", updatedAt: Date.now() });
      }
      throw error;
    }
  },
});

export const confirmFromStripe = mutationGeneric({
  args: {
    webhookSecret: v.string(),
    eventId: v.string(),
    eventType: v.string(),
    bookingId: v.optional(v.id("bookings")),
    checkoutSessionId: v.optional(v.string()),
    paymentIntentId: v.optional(v.string()),
    paymentStatus: v.optional(v.string()),
    amountTotal: v.optional(v.number()),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const configuredSecret = process.env.BOOKING_WEBHOOK_SECRET;
    if (!configuredSecret || args.webhookSecret !== configuredSecret) {
      bookingError("FORBIDDEN", "Invalid webhook secret");
    }
    const previousEvent = await ctx.db
      .query("stripeEvents")
      .withIndex("by_event_id", (query) => query.eq("eventId", args.eventId))
      .first();
    if (previousEvent) {
      const previousBooking = previousEvent.bookingId
        ? await ctx.db.get(previousEvent.bookingId)
        : null;
      const previousRefund = await findRefundEffect(ctx, previousEvent.paymentIntentId);
      return {
        ok: true,
        duplicate: true,
        eventId: previousEvent.eventId,
        status: previousEvent.status,
        bookingId: previousEvent.bookingId,
        ...((previousRefund?.status || previousEvent.refundStatus) ? { refundStatus: previousRefund?.status || previousEvent.refundStatus } : {}),
        ...(previousEvent.notificationStatus ? { notificationStatus: previousEvent.notificationStatus } : {}),
        ...(previousEvent.notificationSnapshot ? { notificationSnapshot: previousEvent.notificationSnapshot } : {}),
        ...(previousBooking ? { booking: safePublicBooking(previousBooking, { includePrivate: true }) } : {}),
      };
    }

    let booking = args.bookingId ? await ctx.db.get(args.bookingId) : null;
    if (!booking && args.checkoutSessionId) {
      booking = await findBookingByField(ctx, "by_checkout_session", args.checkoutSessionId);
    }
    if (!booking && args.paymentIntentId) {
      booking = await findBookingByField(ctx, "by_payment_intent", args.paymentIntentId);
    }
    const priorRefund = args.paymentIntentId
      ? await findRefundEventByPaymentIntent(ctx, args.paymentIntentId)
      : null;
    const priorFullRefund = priorRefund?.refundKind === "full";
    const priorPartialRefund = priorRefund?.refundKind === "partial";
    const now = Date.now();
    if (!booking) {
      await ctx.db.insert("stripeEvents", {
        eventId: args.eventId,
        eventType: args.eventType,
        status: "ignored_no_booking",
        ...(args.checkoutSessionId ? { checkoutSessionId: args.checkoutSessionId } : {}),
        ...(args.paymentIntentId ? { paymentIntentId: args.paymentIntentId } : {}),
        processedAt: now,
      });
      return { ok: true, duplicate: false, status: "ignored_no_booking" };
    }

    const offer = getBookingOffer(booking.offerKey, booking.mode);
    if (!offer) bookingError("INVALID_OFFER", "Unknown booking offer");
    if (args.amountTotal !== undefined && args.amountTotal !== (booking.priceCents ?? offer.priceCents)) {
      bookingError("PAYMENT_MISMATCH", "Payment amount does not match the offer");
    }
    if (args.currency !== undefined && args.currency !== "eur") {
      bookingError("PAYMENT_MISMATCH", "Payment currency does not match the offer");
    }

    let status = "ignored_event";
    let updatedBooking = booking;
    let refundStatus;
    let refundEffect;
    let notificationStatus;
    const isPaidEvent =
      args.eventType === "checkout.session.completed" ||
      args.eventType === "checkout.session.async_payment_succeeded" ||
      args.eventType === "payment_intent.succeeded";
    const isPaymentFailure =
      args.eventType === "checkout.session.async_payment_failed" ||
      args.eventType === "payment_intent.payment_failed";
    if (isPaidEvent && args.paymentStatus !== "unpaid") {
      if (
        booking.status === "refunded" ||
        booking.paymentStatus === "refunded" ||
        priorFullRefund
      ) {
        status = "already_refunded";
        await ctx.db.patch(booking._id, {
          status: "refunded",
          paymentStatus: "refunded",
          refundStatus: "refunded",
          ...(priorFullRefund
            ? {
                refundedAmountCents: Math.max(
                  priorRefund.amountRefunded || 0,
                  priorRefund.amountTotal || 0,
                  booking.priceCents ?? offer.priceCents,
                ),
              }
            : {}),
          stripeEventId: args.eventId,
          ...(args.paymentIntentId ? { stripePaymentIntentId: args.paymentIntentId } : {}),
          updatedAt: now,
        });
        if (priorFullRefund) {
          await recordBookingEvent(ctx, {
            bookingId: booking._id,
            eventType: "charge.refunded",
            status: "refunded",
            sourceEventId: priorRefund.eventId,
            paymentIntentId: args.paymentIntentId,
            amountTotal: priorRefund.amountTotal,
            amountRefunded: priorRefund.amountRefunded,
            now,
          });
        }
        updatedBooking = await ctx.db.get(booking._id);
      } else if (booking.status === "confirmed") {
        status = "already_confirmed";
        if (args.paymentIntentId || args.checkoutSessionId) {
          await ctx.db.patch(booking._id, {
            ...(args.paymentIntentId ? { stripePaymentIntentId: args.paymentIntentId } : {}),
            ...(args.checkoutSessionId ? { stripeCheckoutSessionId: args.checkoutSessionId } : {}),
            stripeEventId: args.eventId,
            updatedAt: now,
          });
          updatedBooking = await ctx.db.get(booking._id);
        }
      } else if (booking.status !== "pending" || Number(booking.holdExpiresAt) <= now) {
        status = "late_hold";
        await ctx.db.patch(booking._id, {
          status: "expired",
          stripeEventId: args.eventId,
          ...(args.paymentIntentId ? { stripePaymentIntentId: args.paymentIntentId } : {}),
          updatedAt: now,
        });
        updatedBooking = await ctx.db.get(booking._id);
      } else {
        try {
          const identity = {
            clerkUserId: booking.clerkUserId,
            tokenIdentifier: booking.tokenIdentifier,
          };
          updatedBooking = await confirmBookingInTransaction(ctx, {
            booking,
            identity,
            checkoutSessionId: args.checkoutSessionId || booking.stripeCheckoutSessionId,
            paymentIntentId: args.paymentIntentId,
            now,
          });
          await ctx.db.patch(booking._id, { stripeEventId: args.eventId, updatedAt: now });
          updatedBooking = await ctx.db.get(booking._id);
          status = "confirmed";
          if (priorPartialRefund) {
            const partialRefundedAmountCents = Math.min(
              booking.priceCents ?? offer.priceCents,
              Math.max(priorRefund.amountRefunded || 0, booking.refundedAmountCents || 0),
            );
            await ctx.db.patch(booking._id, {
              refundStatus: "partial",
              ...(partialRefundedAmountCents > 0 ? { refundedAmountCents: partialRefundedAmountCents } : {}),
              updatedAt: now,
            });
            if (updatedBooking.entitlementId) {
              const entitlement = await ctx.db.get(updatedBooking.entitlementId);
              if (entitlement && entitlement.status !== "refunded" && entitlement.refundStatus !== "refunded") {
                await ctx.db.patch(entitlement._id, {
                  status: "partial_refund",
                  refundStatus: "partial",
                  ...(partialRefundedAmountCents > 0 ? { refundedAmountCents: partialRefundedAmountCents } : {}),
                  updatedAt: now,
                });
              }
            }
            await recordBookingEvent(ctx, {
              bookingId: booking._id,
              eventType: "charge.refunded",
              status: "partial_refund",
              sourceEventId: priorRefund.eventId,
              paymentIntentId: args.paymentIntentId,
              amountTotal: priorRefund.amountTotal,
              amountRefunded: priorRefund.amountRefunded,
              now,
            });
            updatedBooking = await ctx.db.get(booking._id);
          }
        } catch (error) {
          if (
            error instanceof Error &&
            (error.message.startsWith("SLOT_UNAVAILABLE:") || error.message.startsWith("HOLD_EXPIRED:"))
          ) {
            await ctx.db.patch(booking._id, {
              status: "expired",
              stripeEventId: args.eventId,
              ...(args.paymentIntentId ? { stripePaymentIntentId: args.paymentIntentId } : {}),
              updatedAt: now,
            });
            updatedBooking = await ctx.db.get(booking._id);
            status = error.message.startsWith("HOLD_EXPIRED:") ? "late_hold" : "late_conflict";
          } else {
            throw error;
          }
        }
      }
      refundStatus = status === "late_hold" || status === "late_conflict" ? "pending" : undefined;
      notificationStatus = status === "confirmed" ? "pending" : undefined;
      if (refundStatus && args.paymentIntentId) {
        refundEffect = await ensureRefundEffect(ctx, {
          paymentIntentId: args.paymentIntentId,
          eventId: args.eventId,
          now,
        });
        refundStatus = refundEffect.status;
      }
    } else if (isPaidEvent && args.paymentStatus === "unpaid") {
      status = "payment_pending";
      if (booking.status === "pending") {
        await ctx.db.patch(booking._id, {
          ...(args.checkoutSessionId ? { stripeCheckoutSessionId: args.checkoutSessionId } : {}),
          ...(args.paymentIntentId ? { stripePaymentIntentId: args.paymentIntentId } : {}),
          updatedAt: now,
        });
        updatedBooking = await ctx.db.get(booking._id);
      }
    } else if (isPaymentFailure) {
      status = "payment_failed";
      if (booking.status === "pending") {
        await ctx.db.patch(booking._id, {
          stripeEventId: args.eventId,
          ...(args.paymentIntentId ? { stripePaymentIntentId: args.paymentIntentId } : {}),
          updatedAt: now,
        });
        updatedBooking = await ctx.db.get(booking._id);
      }
    } else if (args.eventType === "checkout.session.expired") {
      if (booking.status === "pending") {
        await ctx.db.patch(booking._id, {
          status: "expired",
          stripeEventId: args.eventId,
          updatedAt: now,
        });
        updatedBooking = await ctx.db.get(booking._id);
      }
      status = "expired";
    }

    await ctx.db.insert("stripeEvents", {
      eventId: args.eventId,
      eventType: args.eventType,
      status,
      bookingId: booking._id,
      ...(args.checkoutSessionId ? { checkoutSessionId: args.checkoutSessionId } : {}),
      ...(args.paymentIntentId ? { paymentIntentId: args.paymentIntentId } : {}),
      ...(refundStatus ? { refundStatus } : {}),
      ...(notificationStatus ? { notificationStatus } : {}),
      ...(notificationStatus ? { notificationSnapshot: notificationSnapshot(updatedBooking) } : {}),
      processedAt: now,
    });
    return {
      ok: true,
      duplicate: false,
      eventId: args.eventId,
      status,
      ...(refundStatus ? { refundStatus } : {}),
      ...(notificationStatus ? { notificationStatus } : {}),
      ...(notificationStatus ? { notificationSnapshot: notificationSnapshot(updatedBooking) } : {}),
      booking: safePublicBooking(updatedBooking, { includePrivate: true }),
    };
  },
});

export const applyStripeRefund = mutationGeneric({
  args: {
    webhookSecret: v.string(),
    eventId: v.string(),
    paymentIntentId: v.string(),
    bookingId: v.optional(v.id("bookings")),
    amountTotal: v.optional(v.number()),
    amountRefunded: v.optional(v.number()),
    currency: v.optional(v.string()),
    refunded: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const configuredSecret = process.env.BOOKING_WEBHOOK_SECRET;
    if (!configuredSecret || args.webhookSecret !== configuredSecret) {
      bookingError("FORBIDDEN", "Invalid webhook secret");
    }
    if (!args.paymentIntentId.trim()) bookingError("INVALID_INPUT", "Missing payment intent");

    const previousEvent = await ctx.db
      .query("stripeEvents")
      .withIndex("by_event_id", (query) => query.eq("eventId", args.eventId))
      .first();
    if (previousEvent) {
      const previousBooking = previousEvent.bookingId ? await ctx.db.get(previousEvent.bookingId) : null;
      const unmatched = ["refund_unmatched", "refund_unmatched_partial"].includes(previousEvent.status);
      const rejected = previousEvent.status.startsWith("refund_rejected_");
      return {
        kind: rejected ? "rejected" : unmatched ? "unmatched" : "booking",
        duplicate: true,
        eventId: previousEvent.eventId,
        status: previousEvent.status,
        ...(previousBooking ? { booking: safePublicBooking(previousBooking, { includePrivate: true }) } : {}),
      };
    }

    const now = Date.now();
    const priorRefund = await findRefundEventByPaymentIntent(ctx, args.paymentIntentId);
    const priorFullRefund = priorRefund?.refundKind === "full";
    const bookingById = args.bookingId ? await ctx.db.get(args.bookingId) : null;
    const bookingsByPaymentIntent = await findBookingsByPaymentIntent(ctx, args.paymentIntentId);
    if (bookingsByPaymentIntent.length > 1) {
      return recordRefundRejection(ctx, {
        eventId: args.eventId,
        paymentIntentId: args.paymentIntentId,
        bookingId: args.bookingId,
        amountTotal: args.amountTotal,
        amountRefunded: args.amountRefunded,
        status: "refund_rejected_mismatch",
        now,
      });
    }
    const bookingByPaymentIntent = bookingsByPaymentIntent[0] || null;
    if (bookingById && bookingByPaymentIntent && bookingById._id !== bookingByPaymentIntent._id) {
      return recordRefundRejection(ctx, {
        eventId: args.eventId,
        paymentIntentId: args.paymentIntentId,
        bookingId: bookingById._id,
        amountTotal: args.amountTotal,
        amountRefunded: args.amountRefunded,
        status: "refund_rejected_mismatch",
        now,
      });
    }
    if (bookingById?.stripePaymentIntentId && bookingById.stripePaymentIntentId !== args.paymentIntentId) {
      return recordRefundRejection(ctx, {
        eventId: args.eventId,
        paymentIntentId: args.paymentIntentId,
        bookingId: bookingById._id,
        amountTotal: args.amountTotal,
        amountRefunded: args.amountRefunded,
        status: "refund_rejected_mismatch",
        now,
      });
    }
    if (
      bookingById &&
      !bookingById.stripePaymentIntentId &&
      !bookingByPaymentIntent &&
      (bookingById.status !== "pending" || bookingById.paymentStatus !== "unpaid")
    ) {
      return recordRefundRejection(ctx, {
        eventId: args.eventId,
        paymentIntentId: args.paymentIntentId,
        bookingId: bookingById._id,
        amountTotal: args.amountTotal,
        amountRefunded: args.amountRefunded,
        status: "refund_rejected_mismatch",
        now,
      });
    }
    const booking = bookingByPaymentIntent || bookingById;
    const entitlementsByPaymentIntent = await findEntitlementsByPaymentIntent(ctx, args.paymentIntentId);
    if (entitlementsByPaymentIntent.length > 1) {
      return recordRefundRejection(ctx, {
        eventId: args.eventId,
        paymentIntentId: args.paymentIntentId,
        bookingId: booking?._id || args.bookingId,
        amountTotal: args.amountTotal,
        amountRefunded: args.amountRefunded,
        status: "refund_rejected_mismatch",
        now,
      });
    }
    const entitlementByPaymentIntent = entitlementsByPaymentIntent[0] || null;
    if (
      booking &&
      !booking.stripePaymentIntentId &&
      entitlementByPaymentIntent &&
      booking.entitlementId !== entitlementByPaymentIntent._id
    ) {
      return recordRefundRejection(ctx, {
        eventId: args.eventId,
        paymentIntentId: args.paymentIntentId,
        bookingId: booking._id,
        amountTotal: args.amountTotal,
        amountRefunded: args.amountRefunded,
        status: "refund_rejected_mismatch",
        now,
      });
    }
    if (
      booking?.entitlementId &&
      entitlementByPaymentIntent &&
      booking.entitlementId !== entitlementByPaymentIntent._id
    ) {
      return recordRefundRejection(ctx, {
        eventId: args.eventId,
        paymentIntentId: args.paymentIntentId,
        bookingId: booking?._id || args.bookingId,
        amountTotal: args.amountTotal,
        amountRefunded: args.amountRefunded,
        status: "refund_rejected_mismatch",
        now,
      });
    }
    let entitlement = booking?.entitlementId
      ? await ctx.db.get(booking.entitlementId)
      : entitlementByPaymentIntent;
    if (!entitlement && entitlementByPaymentIntent) entitlement = entitlementByPaymentIntent;
    const fullRefund = isFullChargeRefund(args) || priorFullRefund;
    const refundEventStatus = fullRefund
      ? (priorFullRefund ? "refund_already_applied" : "refund_unmatched")
      : "refund_unmatched_partial";

    if (!booking && !entitlement) {
      await ctx.db.insert("stripeEvents", {
        eventId: args.eventId,
        eventType: "charge.refunded",
        status: refundEventStatus,
        paymentIntentId: args.paymentIntentId,
        ...(args.amountTotal === undefined ? {} : { amountTotal: args.amountTotal }),
        ...(args.amountRefunded === undefined ? {} : { amountRefunded: args.amountRefunded }),
        processedAt: now,
      });
      return { kind: "unmatched", duplicate: false, eventId: args.eventId, status: refundEventStatus };
    }

    const offer = booking
      ? getBookingOffer(booking.offerKey, booking.mode)
      : entitlement
        ? getBookingOffer(entitlement.offerKey, entitlement.mode)
        : null;
    if (!offer) {
      return recordRefundRejection(ctx, {
        eventId: args.eventId,
        paymentIntentId: args.paymentIntentId,
        bookingId: booking?._id || args.bookingId,
        amountTotal: args.amountTotal,
        amountRefunded: args.amountRefunded,
        status: "refund_rejected_offer",
        now,
      });
    }
    if (args.currency && args.currency.toLowerCase() !== "eur") {
      return recordRefundRejection(ctx, {
        eventId: args.eventId,
        paymentIntentId: args.paymentIntentId,
        bookingId: booking?._id || args.bookingId,
        amountTotal: args.amountTotal,
        amountRefunded: args.amountRefunded,
        status: "refund_rejected_currency",
        now,
      });
    }
    // For a legacy pack without a frozen price, the signed Stripe charge is
    // authoritative. A later credit booking may carry a different catalog price.
    const paidPriceCents = entitlement?.priceCents ??
      (entitlement ? args.amountTotal : undefined) ??
      booking?.priceCents ?? args.amountTotal ?? offer.priceCents;
    if (
      args.amountTotal !== undefined &&
      (!Number.isSafeInteger(args.amountTotal) || args.amountTotal <= 0 || args.amountTotal !== paidPriceCents)
    ) {
      return recordRefundRejection(ctx, {
        eventId: args.eventId,
        paymentIntentId: args.paymentIntentId,
        bookingId: booking?._id || args.bookingId,
        amountTotal: args.amountTotal,
        amountRefunded: args.amountRefunded,
        status: "refund_rejected_amount",
        now,
      });
    }
    if (
      args.amountRefunded !== undefined &&
      (!Number.isSafeInteger(args.amountRefunded) || args.amountRefunded < 0 ||
        args.amountRefunded > paidPriceCents)
    ) {
      return recordRefundRejection(ctx, {
        eventId: args.eventId,
        paymentIntentId: args.paymentIntentId,
        bookingId: booking?._id || args.bookingId,
        amountTotal: args.amountTotal,
        amountRefunded: args.amountRefunded,
        status: "refund_rejected_amount",
        now,
      });
    }

    const entitlementBookings = entitlement ? await findBookingsForEntitlement(ctx, entitlement._id) : [];
    const affectedBookings = [...new Map(
      [...entitlementBookings, ...(booking ? [booking] : [])].map((candidate) => [candidate._id, candidate]),
    ).values()];
    const alreadyFullyRefunded = Boolean(
      priorFullRefund ||
      entitlement?.status === "refunded" ||
      booking?.status === "refunded" ||
      booking?.paymentStatus === "refunded",
    );
    if (!fullRefund) {
      if (alreadyFullyRefunded) {
        await ctx.db.insert("stripeEvents", {
          eventId: args.eventId,
          eventType: "charge.refunded",
          status: "refund_already_applied",
          ...(booking ? { bookingId: booking._id } : {}),
          paymentIntentId: args.paymentIntentId,
          ...(args.amountTotal === undefined ? {} : { amountTotal: args.amountTotal }),
          ...(args.amountRefunded === undefined ? {} : { amountRefunded: args.amountRefunded }),
          processedAt: now,
        });
        return {
          kind: "booking",
          duplicate: false,
          eventId: args.eventId,
          status: "already_refunded",
          ...(booking ? { booking: safePublicBooking(booking, { includePrivate: true }) } : {}),
        };
      }
      const nextRefundedAmountCents = Math.min(
        paidPriceCents,
        Math.max(
          entitlement?.refundedAmountCents || 0,
          booking?.refundedAmountCents || 0,
          priorRefund?.refundKind === "partial" ? priorRefund.amountRefunded || 0 : 0,
          args.amountRefunded || 0,
        ),
      );
      if (entitlement && entitlement.status !== "refunded") {
        await ctx.db.patch(entitlement._id, {
          status: "partial_refund",
          refundStatus: "partial",
          ...(nextRefundedAmountCents > 0 ? { refundedAmountCents: nextRefundedAmountCents } : {}),
          updatedAt: now,
        });
      }
      for (const affectedBooking of affectedBookings) {
        if (affectedBooking.paymentStatus !== "refunded") {
          await ctx.db.patch(affectedBooking._id, {
            refundStatus: "partial",
            ...(nextRefundedAmountCents > 0 ? { refundedAmountCents: nextRefundedAmountCents } : {}),
            ...(affectedBooking._id === booking?._id && !affectedBooking.stripePaymentIntentId
              ? { stripePaymentIntentId: args.paymentIntentId }
              : {}),
            updatedAt: now,
          });
        }
        await recordBookingEvent(ctx, {
          bookingId: affectedBooking._id,
          eventType: "charge.refunded",
          status: "partial_refund",
          sourceEventId: args.eventId,
          paymentIntentId: args.paymentIntentId,
          amountTotal: args.amountTotal,
          amountRefunded: args.amountRefunded,
          now,
        });
      }
      await ctx.db.insert("stripeEvents", {
        eventId: args.eventId,
        eventType: "charge.refunded",
        status: "refund_partial",
        ...(booking ? { bookingId: booking._id } : {}),
        paymentIntentId: args.paymentIntentId,
        ...(args.amountTotal === undefined ? {} : { amountTotal: args.amountTotal }),
        ...(args.amountRefunded === undefined ? {} : { amountRefunded: args.amountRefunded }),
        processedAt: now,
      });
      return {
        kind: "booking",
        duplicate: false,
        eventId: args.eventId,
        status: "partial_refund",
        ...(booking ? { booking: safePublicBooking(await ctx.db.get(booking._id), { includePrivate: true }) } : {}),
      };
    }

    let changed = false;
    if (entitlement) {
      const revokeKey = `refund:${args.paymentIntentId}:revoke`;
      const revocation = await findLedger(ctx, revokeKey);
      if (!revocation) {
        await ctx.db.insert("creditLedger", {
          entitlementId: entitlement._id,
          clerkUserId: entitlement.clerkUserId,
          kind: "adjust",
          units: entitlement.remainingCredits > 0 ? -entitlement.remainingCredits : 0,
          idempotencyKey: revokeKey,
          createdAt: now,
        });
        changed = true;
      }
      if (entitlement.status !== "refunded" || entitlement.refundStatus !== "refunded" || entitlement.remainingCredits !== 0) {
        await ctx.db.patch(entitlement._id, {
          status: "refunded",
          refundStatus: "refunded",
          remainingCredits: 0,
          refundedAmountCents: Math.max(
            entitlement.refundedAmountCents || 0,
            priorRefund?.amountRefunded || 0,
            args.amountRefunded || 0,
            args.amountTotal || 0,
            paidPriceCents,
          ),
          updatedAt: now,
        });
        changed = true;
      }
    }
    for (const affectedBooking of affectedBookings) {
      if (
        affectedBooking.status !== "refunded" ||
        affectedBooking.paymentStatus !== "refunded" ||
        affectedBooking.refundStatus !== "refunded"
      ) {
        await ctx.db.patch(affectedBooking._id, {
          status: "refunded",
          paymentStatus: "refunded",
          refundStatus: "refunded",
          refundedAmountCents: Math.max(
            affectedBooking.refundedAmountCents || 0,
            priorRefund?.amountRefunded || 0,
            args.amountRefunded || 0,
            args.amountTotal || 0,
            paidPriceCents,
          ),
          ...(affectedBooking._id === booking?._id && !affectedBooking.stripePaymentIntentId
            ? { stripePaymentIntentId: args.paymentIntentId }
            : {}),
          updatedAt: now,
        });
        changed = true;
      }
      await recordBookingEvent(ctx, {
        bookingId: affectedBooking._id,
        eventType: "charge.refunded",
        status: "refunded",
        sourceEventId: args.eventId,
        paymentIntentId: args.paymentIntentId,
        amountTotal: args.amountTotal,
        amountRefunded: args.amountRefunded,
        now,
      });
    }
    const status = changed ? "refund_applied" : "refund_already_applied";
    await ctx.db.insert("stripeEvents", {
      eventId: args.eventId,
      eventType: "charge.refunded",
      status,
      ...(booking ? { bookingId: booking._id } : {}),
      paymentIntentId: args.paymentIntentId,
      ...(args.amountTotal === undefined ? {} : { amountTotal: args.amountTotal }),
      ...(args.amountRefunded === undefined ? {} : { amountRefunded: args.amountRefunded }),
      processedAt: now,
    });
    return {
      kind: "booking",
      duplicate: false,
      eventId: args.eventId,
      status: changed ? "refunded" : "already_refunded",
      ...(booking ? { booking: safePublicBooking(await ctx.db.get(booking._id), { includePrivate: true }) } : {}),
    };
  },
});

export const claimStripeEffect = mutationGeneric({
  args: {
    webhookSecret: v.string(),
    eventId: v.string(),
    effect: v.union(v.literal("refund"), v.literal("notification")),
  },
  handler: async (ctx, args) => {
    const configuredSecret = process.env.BOOKING_WEBHOOK_SECRET;
    if (!configuredSecret || args.webhookSecret !== configuredSecret) {
      bookingError("FORBIDDEN", "Invalid webhook secret");
    }
    const event = await ctx.db
      .query("stripeEvents")
      .withIndex("by_event_id", (query) => query.eq("eventId", args.eventId))
      .first();
    if (!event) bookingError("NOT_FOUND", "Stripe event not found");
    const field = args.effect === "refund" ? "refundStatus" : "notificationStatus";
    const status = event[field];
    if (status === "sent" || status === "skipped") return { claimed: false, status };
    const now = Date.now();
    if (status === "sending" && now - Number(event.effectsUpdatedAt || 0) < EFFECT_RETRY_AFTER_MS) {
      return { claimed: false, status };
    }
    await ctx.db.patch(event._id, { [field]: "sending", effectsUpdatedAt: now });
    return { claimed: true, status: "sending" };
  },
});

export const completeStripeEffect = mutationGeneric({
  args: {
    webhookSecret: v.string(),
    eventId: v.string(),
    effect: v.union(v.literal("refund"), v.literal("notification")),
    status: v.union(v.literal("sent"), v.literal("skipped"), v.literal("failed")),
    providerId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const configuredSecret = process.env.BOOKING_WEBHOOK_SECRET;
    if (!configuredSecret || args.webhookSecret !== configuredSecret) {
      bookingError("FORBIDDEN", "Invalid webhook secret");
    }
    const event = await ctx.db
      .query("stripeEvents")
      .withIndex("by_event_id", (query) => query.eq("eventId", args.eventId))
      .first();
    if (!event) bookingError("NOT_FOUND", "Stripe event not found");
    if (args.effect === "refund" && event.refundStatus === "sent" && args.status === "failed") {
      return { ok: true, status: "sent" };
    }
    if (args.effect === "notification" && event.notificationStatus === "sent" && args.status === "failed") {
      return { ok: true, status: "sent" };
    }
    const now = Date.now();
    const patch = args.effect === "refund"
      ? {
          refundStatus: args.status,
          ...(args.providerId ? { refundId: args.providerId } : {}),
          effectsUpdatedAt: now,
        }
      : {
          notificationStatus: args.status,
          ...(args.providerId ? { notificationId: args.providerId } : {}),
          ...(args.error ? { notificationError: args.error.slice(0, 500) } : {}),
          effectsUpdatedAt: now,
        };
    await ctx.db.patch(event._id, patch);
    return { ok: true, status: args.status };
  },
});

export const claimStripeRefund = mutationGeneric({
  args: { webhookSecret: v.string(), paymentIntentId: v.string() },
  handler: async (ctx, args) => {
    const configuredSecret = process.env.BOOKING_WEBHOOK_SECRET;
    if (!configuredSecret || args.webhookSecret !== configuredSecret) {
      bookingError("FORBIDDEN", "Invalid webhook secret");
    }
    const refund = await findRefundEffect(ctx, args.paymentIntentId);
    if (!refund) bookingError("NOT_FOUND", "Stripe refund effect not found");
    if (refund.status === "sent") return { claimed: false, status: "sent" };
    const now = Date.now();
    if (refund.status === "sending" && now - Number(refund.claimedAt || 0) < EFFECT_RETRY_AFTER_MS) {
      return { claimed: false, status: "sending" };
    }
    await ctx.db.patch(refund._id, { status: "sending", claimedAt: now, updatedAt: now });
    return { claimed: true, status: "sending" };
  },
});

export const completeStripeRefund = mutationGeneric({
  args: {
    webhookSecret: v.string(),
    paymentIntentId: v.string(),
    status: v.union(v.literal("sent"), v.literal("failed")),
    providerId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const configuredSecret = process.env.BOOKING_WEBHOOK_SECRET;
    if (!configuredSecret || args.webhookSecret !== configuredSecret) {
      bookingError("FORBIDDEN", "Invalid webhook secret");
    }
    const refund = await findRefundEffect(ctx, args.paymentIntentId);
    if (!refund) bookingError("NOT_FOUND", "Stripe refund effect not found");
    if (refund.status === "sent" && args.status === "failed") return { ok: true, status: "sent" };
    await ctx.db.patch(refund._id, {
      status: args.status,
      ...(args.providerId ? { refundId: args.providerId } : {}),
      ...(args.error ? { lastError: args.error.slice(0, 500) } : {}),
      updatedAt: Date.now(),
    });
    return { ok: true, status: args.status };
  },
});

export const getMyFollowUp = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const current = await requireIdentity(ctx);
    const now = Date.now();
    const [bookings, entitlements] = await Promise.all([
      ctx.db.query("bookings").withIndex("by_token_identifier", (query) => query.eq("tokenIdentifier", current.tokenIdentifier)).collect(),
      ctx.db.query("entitlements").withIndex("by_token_identifier", (query) => query.eq("tokenIdentifier", current.tokenIdentifier)).collect(),
    ]);
    const ownedBookings = bookings
      .filter((booking) => booking.clerkUserId === current.clerkUserId)
      .sort((left, right) => left.startAt - right.startAt)
      .map((booking) => safePublicBooking(booking, { now }));
    return {
      serverNow: now,
      bookings: ownedBookings,
      entitlements: entitlements
        .filter((entitlement) => entitlement.clerkUserId === current.clerkUserId)
        .sort((left, right) => right.createdAt - left.createdAt)
        .map((entitlement) => ({
          id: entitlement._id,
          offerKey: entitlement.offerKey,
          mode: entitlement.mode,
          totalCredits: entitlement.totalCredits,
          remainingCredits: entitlement.remainingCredits,
          validUntil: entitlement.validUntil,
          status: entitlement.status || "active",
          ...(entitlement.refundStatus === undefined ? {} : { refundStatus: entitlement.refundStatus }),
          ...(entitlement.refundedAmountCents === undefined ? {} : { refundedAmountCents: entitlement.refundedAmountCents }),
        })),
    };
  },
});

export const getMyBooking = queryGeneric({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx);
    return safePublicBooking(await findOwnedBooking(ctx, args.bookingId, current));
  },
});

export const getBookingNotification = queryGeneric({
  args: {
    bookingId: v.id("bookings"),
    kind: v.optional(v.union(v.literal("confirmed"), v.literal("rescheduled"), v.literal("reminder"))),
  },
  handler: async (ctx, args) => {
    const notifications = await ctx.db
      .query("bookingNotifications")
      .withIndex("by_booking", (query) => query.eq("bookingId", args.bookingId))
      .collect();
    const candidate = notifications
      .filter((notification) => !args.kind || notification.kind === args.kind)
      .filter((notification) => ["pending", "failed", "sending"].includes(notification.status))
      .sort((left, right) =>
        (right.scheduleRevision || 0) - (left.scheduleRevision || 0) || right.createdAt - left.createdAt,
      )[0];
    if (!candidate) return null;
    const { booking } = await requireNotificationAccess(ctx, candidate);
    return {
      id: candidate._id,
      kind: candidate.kind,
      status: candidate.status,
      booking: safePublicBooking(booking, { includePrivate: true }),
    };
  },
});

export const getBookingNotificationById = queryGeneric({
  args: { notificationId: v.id("bookingNotifications") },
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) bookingError("NOT_FOUND", "Notification not found");
    const { booking } = await requireNotificationAccess(ctx, notification);
    return {
      id: notification._id,
      kind: notification.kind,
      status: notification.status,
      booking: safePublicBooking(booking, { includePrivate: true }),
    };
  },
});

export const claimBookingNotification = mutationGeneric({
  args: { webhookSecret: v.string(), notificationId: v.id("bookingNotifications") },
  handler: async (ctx, args) => {
    const configuredSecret = process.env.BOOKING_WEBHOOK_SECRET;
    if (!configuredSecret || args.webhookSecret !== configuredSecret) {
      bookingError("FORBIDDEN", "Invalid internal secret");
    }
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) bookingError("NOT_FOUND", "Notification not found");
    const booking = await ctx.db.get(notification.bookingId);
    if (!booking) bookingError("NOT_FOUND", "Booking not found");
    const now = Date.now();
    const claimed = await claimNotificationRecord(ctx, notification, booking, now);
    const deliveryBooking = notificationDeliveryBooking(notification, booking);
    if (!claimed.claimed) {
      return {
        claimed: false,
        status: claimed.status,
        id: notification._id,
        kind: notification.kind,
        booking: safePublicBooking(deliveryBooking, { includePrivate: true, now }),
      };
    }
    return {
      claimed: true,
      status: "sending",
      id: notification._id,
      kind: notification.kind,
      booking: safePublicBooking(deliveryBooking, { includePrivate: true, now }),
    };
  },
});

export const completeBookingNotification = mutationGeneric({
  args: {
    webhookSecret: v.string(),
    notificationId: v.id("bookingNotifications"),
    status: v.union(v.literal("sent"), v.literal("skipped"), v.literal("failed")),
    providerId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const configuredSecret = process.env.BOOKING_WEBHOOK_SECRET;
    if (!configuredSecret || args.webhookSecret !== configuredSecret) {
      bookingError("FORBIDDEN", "Invalid internal secret");
    }
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) bookingError("NOT_FOUND", "Notification not found");
    if (notification.status !== "sending") {
      bookingError("INVALID_STATE", "Notification is not in progress");
    }
    await completeNotificationRecord(ctx, notification, args);
    return { ok: true, status: args.status };
  },
});

export const getNotificationForDelivery = internalQueryGeneric({
  args: { notificationId: v.id("bookingNotifications") },
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) return null;
    const booking = await ctx.db.get(notification.bookingId);
    if (!booking) return null;
    return { notification, booking, deliveryBooking: notificationDeliveryBooking(notification, booking) };
  },
});

export const claimBookingNotificationInternal = internalMutationGeneric({
  args: {
    notificationId: v.id("bookingNotifications"),
    scheduleRevision: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) return { claimed: false, status: "missing" };
    const booking = await ctx.db.get(notification.bookingId);
    if (!booking) return { claimed: false, status: "missing" };
    const claimed = await claimNotificationRecord(
      ctx,
      notification,
      booking,
      Date.now(),
      args.scheduleRevision,
    );
    if (!claimed.claimed) return claimed;
    return {
      ...claimed,
      id: notification._id,
      kind: notification.kind,
      booking: notificationDeliveryBooking(notification, booking),
    };
  },
});

export const completeBookingNotificationInternal = internalMutationGeneric({
  args: {
    notificationId: v.id("bookingNotifications"),
    status: v.union(v.literal("sent"), v.literal("skipped"), v.literal("failed")),
    providerId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) return { ok: false, status: "missing" };
    await completeNotificationRecord(ctx, notification, args);
    return { ok: true, status: args.status };
  },
});

export const deliverBookingNotification = internalActionGeneric({
  args: {
    notificationId: v.id("bookingNotifications"),
    scheduleRevision: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const record = await ctx.runQuery(internal.bookings.getNotificationForDelivery, {
      notificationId: args.notificationId,
    });
    if (!record) return { sent: false, reason: "missing" };
    if (["sent", "skipped"].includes(record.notification.status)) {
      return { sent: record.notification.status === "sent", reason: record.notification.status };
    }
    if (record.notification.kind === "reminder") {
      const scheduleRevision = record.notification.scheduleRevision || 0;
      if (
        args.scheduleRevision !== undefined &&
        args.scheduleRevision !== scheduleRevision
      ) {
        return { sent: false, reason: "stale_schedule" };
      }
      if ((record.booking.rescheduleRevision || 0) !== scheduleRevision) {
        const stale = await ctx.runMutation(internal.bookings.claimBookingNotificationInternal, {
          notificationId: args.notificationId,
          scheduleRevision,
        });
        return stale;
      }
      const dueAt = record.booking.startAt - REMINDER_LEAD_MS;
      if (dueAt > Date.now()) {
        await ctx.scheduler.runAt(
          dueAt,
          internal.bookings.deliverBookingNotification,
          { notificationId: args.notificationId, scheduleRevision },
        );
        return { sent: false, reason: "reminder_rescheduled", dueAt };
      }
    }
    const config = getResendConfig();
    const recipient = record.deliveryBooking?.email?.trim().toLowerCase();
    const appOrigin = safeAppOrigin(config.appUrl, { production: config.production });
    const retryArgs = {
      notificationId: args.notificationId,
      ...(record.notification.kind === "reminder"
        ? { scheduleRevision: record.notification.scheduleRevision || 0 }
        : {}),
    };
    if (
      !config.enabled ||
      !config.apiKey ||
      !config.from ||
      !appOrigin
    ) {
      await ctx.scheduler.runAfter(NOTIFICATION_RETRY_AFTER_MS, internal.bookings.deliverBookingNotification, retryArgs);
      return { sent: false, reason: "resend_configuration_required" };
    }

    const claim = await ctx.runMutation(internal.bookings.claimBookingNotificationInternal, retryArgs);
    if (!claim.claimed) return claim;
    if (record.notification.kind === "reminder") {
      const latest = await ctx.runQuery(internal.bookings.getNotificationForDelivery, {
        notificationId: args.notificationId,
      });
      if (!latest || latest.booking.status !== "confirmed" || latest.booking.paymentStatus !== "paid" ||
          (latest.booking.rescheduleRevision || 0) !== (record.notification.scheduleRevision || 0)) {
        await ctx.runMutation(internal.bookings.completeBookingNotificationInternal, {
          notificationId: args.notificationId,
          status: "skipped",
          error: "booking_no_longer_confirmed",
        });
        return { sent: false, reason: "booking_no_longer_confirmed" };
      }
    }
    if (!recipient || (config.allowlistRequired && !config.recipients.includes(recipient))) {
      await ctx.runMutation(internal.bookings.completeBookingNotificationInternal, {
        notificationId: args.notificationId,
        status: "skipped",
        error: "recipient_not_allowlisted",
      });
      return { sent: false, reason: "recipient_not_allowlisted" };
    }
    const message = renderBookingEmail({
      kind: claim.kind,
      booking: claim.booking,
      appOrigin,
      production: config.production,
    });
    const idempotencyKey = notificationIdempotencyKey(
      args.notificationId,
      claim.kind,
      claim.booking.rescheduleRevision || 0,
    );
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          from: config.from,
          to: [recipient],
          reply_to: config.replyTo,
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || "Resend request failed");
      await ctx.runMutation(internal.bookings.completeBookingNotificationInternal, {
        notificationId: args.notificationId,
        status: "sent",
        ...(payload?.id ? { providerId: payload.id } : {}),
      });
      return { sent: true, id: payload?.id || null };
    } catch (error) {
      await ctx.runMutation(internal.bookings.completeBookingNotificationInternal, {
        notificationId: args.notificationId,
        status: "failed",
        error: error instanceof Error ? error.message : "notification_failed",
      });
      return { sent: false, reason: "notification_failed" };
    }
  },
});

async function reschedule(ctx, args, { admin = false } = {}) {
  const current = admin ? await requireAdmin(ctx) : await requireIdentity(ctx);
  const booking = admin
    ? await ctx.db.get(args.bookingId)
    : await findOwnedBooking(ctx, args.bookingId, current);
  if (!booking) bookingError("NOT_FOUND", "Booking not found");
  if (!admin && (booking.clerkUserId !== current.clerkUserId || booking.tokenIdentifier !== current.tokenIdentifier)) {
    bookingError("FORBIDDEN", "Booking belongs to another account");
  }
  const idempotencyKey = args.idempotencyKey ? assertIdempotencyKey(args.idempotencyKey) : null;
  const now = Date.now();
  const previous = await findRescheduleOperation(ctx, idempotencyKey);
  if (previous) {
    if (
      previous.bookingId !== booking._id ||
      previous.date !== args.date ||
      previous.time !== args.time
    ) {
      bookingError("IDEMPOTENCY_MISMATCH", "The reschedule request differs from its first attempt");
    }
    return {
      ...safePublicBooking(await ctx.db.get(booking._id), { now }),
      notificationId: previous.notificationId,
    };
  }
  if (booking.status !== "confirmed") bookingError("INVALID_STATE", "Only confirmed bookings can be rescheduled");
  if (!admin && booking.startAt - now < 24 * 60 * 60 * 1000) {
    bookingError("RESCHEDULE_TOO_LATE", "A booking can only be moved at least 24 hours before its start");
  }
  const offer = getBookingOffer(booking.offerKey, booking.mode);
  const settings = await getSettings(ctx);
  const others = activeBookings(await getAllBookings(ctx), now, booking._id);
  if (!isSlotBookable({ date: args.date, time: args.time, offer, settings, bookings: others, now })) {
    bookingError("SLOT_UNAVAILABLE", "The new slot is not available");
  }
  const startAt = parisInstant(args.date, args.time).getTime();
  if (booking.entitlementId && offer.sessionCount > 1) {
    const entitlement = await ctx.db.get(booking.entitlementId);
    if (!entitlement || entitlement.validUntil <= startAt) {
      bookingError("CREDITS_UNAVAILABLE", "The pack is not valid for the new booking date");
    }
  }
  const rescheduleRevision = (booking.rescheduleRevision || 0) + 1;
  await ctx.db.patch(booking._id, {
    date: args.date,
    time: args.time,
    startAt,
    endAt: startAt + offer.durationMinutes * 60 * 1000,
    rescheduledAt: now,
    rescheduledBy: admin ? "admin" : "member",
    ...(args.reason ? { rescheduleReason: args.reason.slice(0, 500) } : {}),
    rescheduleRevision,
    updatedAt: now,
  });
  const notification = await queueBookingNotification(ctx, {
    bookingId: booking._id,
    kind: "rescheduled",
    dedupeKey: `rescheduled:${booking._id}:${rescheduleRevision}`,
    scheduleRevision: rescheduleRevision,
    now,
  });
  await queueBookingNotification(ctx, {
    bookingId: booking._id,
    kind: "reminder",
    dedupeKey: `reminder:${booking._id}:${rescheduleRevision}`,
    scheduleRevision: rescheduleRevision,
    now,
    delayMs: Math.max(0, startAt - now - REMINDER_LEAD_MS),
  });
  if (idempotencyKey) {
    await ctx.db.insert("rescheduleOperations", {
      idempotencyKey,
      bookingId: booking._id,
      date: args.date,
      time: args.time,
      rescheduleRevision,
      notificationId: notification._id,
      createdAt: now,
    });
  }
  return {
    ...safePublicBooking(await ctx.db.get(booking._id), { now }),
    notificationId: notification._id,
  };
}

export const rescheduleBooking = mutationGeneric({
  args: {
    bookingId: v.id("bookings"),
    date: v.string(),
    time: v.string(),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => reschedule(ctx, args),
});

export const adminRescheduleBooking = mutationGeneric({
  args: {
    bookingId: v.id("bookings"),
    date: v.string(),
    time: v.string(),
    reason: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => reschedule(ctx, args, { admin: true }),
});

export const setMeetLink = mutationGeneric({
  args: { bookingId: v.id("bookings"), meetUrl: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (!safeMeetUrl(args.meetUrl)) bookingError("INVALID_INPUT", "Invalid Google Meet URL");
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) bookingError("NOT_FOUND", "Booking not found");
    await ctx.db.patch(booking._id, { meetUrl: args.meetUrl, updatedAt: Date.now() });
    return safePublicBooking(await ctx.db.get(booking._id), { includePrivate: true });
  },
});

export const getAdminBookings = queryGeneric({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const bookings = await getAllBookings(ctx);
    return bookings
      .sort((left, right) => left.startAt - right.startAt)
      .map((booking) => safePublicBooking(booking, { includePrivate: true }));
  },
});

export const getAdminAvailability = queryGeneric({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return getSettings(ctx);
  },
});

export const saveAdminAvailability = mutationGeneric({
  args: availabilityArgs,
  handler: async (ctx, args) => {
    const current = await requireAdmin(ctx);
    const normalized = normalizeAvailability(args, { rejectInvalid: true });
    const existing = await ctx.db
      .query("bookingSettings")
      .withIndex("by_key", (query) => query.eq("key", "default"))
      .first();
    const value = {
      key: "default",
      ...normalized,
      updatedAt: Date.now(),
      updatedBy: current.clerkUserId,
    };
    if (existing) await ctx.db.patch(existing._id, value);
    else await ctx.db.insert("bookingSettings", value);
    return normalized;
  },
});

export const getBookingOfferCatalog = queryGeneric({
  args: {},
  handler: async (ctx) => {
    await requireIdentity(ctx);
    return BOOKING_OFFERS;
  },
});
