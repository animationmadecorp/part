import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

export const CHECKOUT_CONTRACT_VERSION = "2026-09-19";
export const CHECKOUT_TERMS_PATH = "/nouveau/cgv";
export const CHECKOUT_REFUND_POLICY_PATH = "/nouveau/remboursements";
export const CHECKOUT_CONSENT_TEXT =
  "J’accepte les CGV et, si l’exécution commence avant la fin du délai légal, je demande expressément ce commencement et reconnais la perte du droit de rétractation après exécution complète.";

const stripeModes = v.union(v.literal("test"), v.literal("live"));

function contractError(code, message) {
  throw new Error(`${code}: ${message}`);
}

async function requireIdentity(ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) contractError("UNAUTHENTICATED", "Authentication required");
  return {
    clerkUserId: identity.subject,
    tokenIdentifier: identity.tokenIdentifier || identity.subject,
  };
}

function assertOwner(source, current) {
  if (!source || source.clerkUserId !== current.clerkUserId || source.tokenIdentifier !== current.tokenIdentifier) {
    contractError("FORBIDDEN", "Payment contract proof belongs to another account");
  }
  return source;
}

async function getOwnedSource(ctx, args, current) {
  if (Boolean(args.requestId) === Boolean(args.bookingId)) {
    contractError("INVALID_INPUT", "Exactly one payment source is required");
  }
  if (args.requestId) {
    const request = await ctx.db.get(args.requestId);
    if (!request) contractError("NOT_FOUND", "Client request not found");
    return {
      kind: "client_request",
      request: assertOwner(request, current),
      sourceId: request._id,
      clerkUserId: request.clerkUserId,
      tokenIdentifier: request.tokenIdentifier,
      offerKey: request.offerKey,
    };
  }
  const booking = await ctx.db.get(args.bookingId);
  if (!booking) contractError("NOT_FOUND", "Booking not found");
  return {
    kind: "booking",
    booking: assertOwner(booking, current),
    sourceId: booking._id,
    clerkUserId: booking.clerkUserId,
    tokenIdentifier: booking.tokenIdentifier,
    offerKey: booking.offerKey,
  };
}

async function getLatestProof(ctx, source) {
  const proofs = await ctx.db
    .query("paymentContractProofs")
    .withIndex(source.kind === "client_request" ? "by_request" : "by_booking", (query) => query.eq(
      source.kind === "client_request" ? "requestId" : "bookingId",
      source.sourceId,
    ))
    .collect();
  return proofs.sort((left, right) =>
    right.createdAt - left.createdAt ||
    Number(right._creationTime || 0) - Number(left._creationTime || 0) ||
    String(right._id).localeCompare(String(left._id))
  )[0] || null;
}

function safeProof(proof) {
  if (!proof) return null;
  return {
    id: proof._id,
    kind: proof.kind,
    ...(proof.requestId ? { requestId: proof.requestId } : {}),
    ...(proof.bookingId ? { bookingId: proof.bookingId } : {}),
    offerKey: proof.offerKey,
    contractVersion: proof.contractVersion,
    termsPath: proof.termsPath,
    refundPolicyPath: proof.refundPolicyPath,
    consentText: proof.consentText,
    termsConsentRequired: proof.termsConsentRequired,
    earlyStartConsentRequired: proof.earlyStartConsentRequired,
    stripeMode: proof.stripeMode,
    status: proof.status,
    ...(proof.stripeCheckoutSessionId ? { stripeCheckoutSessionId: proof.stripeCheckoutSessionId } : {}),
    ...(proof.checkoutAttempt === undefined ? {} : { checkoutAttempt: proof.checkoutAttempt }),
    ...(proof.stripeConsentStatus ? { stripeConsentStatus: proof.stripeConsentStatus } : {}),
    ...(proof.consentAcceptedAt ? { consentAcceptedAt: proof.consentAcceptedAt } : {}),
    ...(proof.consentEventId ? { consentEventId: proof.consentEventId } : {}),
    ...(proof.rejectionReason ? { rejectionReason: proof.rejectionReason } : {}),
    createdAt: proof.createdAt,
    updatedAt: proof.updatedAt,
  };
}

function assertShortString(value, field, max = 240) {
  if (typeof value !== "string" || value.trim().length < 1 || value.trim().length > max) {
    contractError("INVALID_INPUT", `Invalid ${field}`);
  }
  return value.trim();
}

export const prepare = mutationGeneric({
  args: {
    requestId: v.optional(v.id("clientRequests")),
    bookingId: v.optional(v.id("bookings")),
    stripeMode: stripeModes,
    currentCheckoutSessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx);
    const source = await getOwnedSource(ctx, args, current);
    if (source.kind === "client_request") {
      if (["paid", "refunded", "cancelled"].includes(source.request.status)) {
        contractError("INVALID_STATE", "This request cannot receive a new checkout contract");
      }
    } else if (source.booking.status !== "pending" || source.booking.paymentStatus !== "unpaid") {
      contractError("INVALID_STATE", "This booking cannot receive a new checkout contract");
    }

    const latest = await getLatestProof(ctx, source);
    const canReuse = latest &&
      latest.status !== "rejected" &&
      latest.stripeMode === args.stripeMode &&
      (!args.currentCheckoutSessionId ||
        !latest.stripeCheckoutSessionId ||
        latest.stripeCheckoutSessionId === args.currentCheckoutSessionId);
    if (canReuse) return safeProof(latest);

    const now = Date.now();
    const proofId = await ctx.db.insert("paymentContractProofs", {
      kind: source.kind,
      ...(source.kind === "client_request" ? { requestId: source.sourceId } : { bookingId: source.sourceId }),
      clerkUserId: source.clerkUserId,
      tokenIdentifier: source.tokenIdentifier,
      offerKey: source.offerKey,
      contractVersion: CHECKOUT_CONTRACT_VERSION,
      termsPath: CHECKOUT_TERMS_PATH,
      refundPolicyPath: CHECKOUT_REFUND_POLICY_PATH,
      consentText: CHECKOUT_CONSENT_TEXT,
      termsConsentRequired: true,
      earlyStartConsentRequired: true,
      stripeMode: args.stripeMode,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    return safeProof(await ctx.db.get(proofId));
  },
});

export const attachCheckoutSession = mutationGeneric({
  args: {
    proofId: v.id("paymentContractProofs"),
    checkoutSessionId: v.string(),
    attempt: v.number(),
    serverSecret: v.string(),
  },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx);
    const configuredSecret = process.env.BOOKING_WEBHOOK_SECRET;
    if (!configuredSecret || args.serverSecret !== configuredSecret) {
      contractError("FORBIDDEN", "Server checkout attachment required");
    }
    const proof = await ctx.db.get(args.proofId);
    if (!proof) contractError("NOT_FOUND", "Payment contract proof not found");
    if (proof.clerkUserId !== current.clerkUserId || proof.tokenIdentifier !== current.tokenIdentifier) {
      contractError("FORBIDDEN", "Payment contract proof belongs to another account");
    }
    if (!Number.isSafeInteger(args.attempt) || args.attempt < 1) {
      contractError("INVALID_INPUT", "Invalid checkout attempt");
    }
    const checkoutSessionId = assertShortString(args.checkoutSessionId, "checkout session");
    const expectedPrefix = proof.stripeMode === "live" ? "cs_live_" : "cs_test_";
    if (!checkoutSessionId.startsWith(expectedPrefix)) {
      contractError("PAYMENT_MISMATCH", "Checkout session mode does not match the contract proof");
    }
    if (proof.status === "rejected") {
      contractError("INVALID_STATE", "A rejected contract proof cannot be attached");
    }
    if (
      proof.stripeCheckoutSessionId &&
      proof.stripeCheckoutSessionId !== checkoutSessionId &&
      args.attempt <= Number(proof.checkoutAttempt || 0)
    ) {
      contractError("IDEMPOTENCY_MISMATCH", "A different checkout session is already attached");
    }
    const now = Date.now();
    await ctx.db.patch(proof._id, {
      status: proof.status === "accepted" ? "accepted" : "attached",
      stripeCheckoutSessionId: checkoutSessionId,
      checkoutAttempt: Math.max(args.attempt, Number(proof.checkoutAttempt || 0)),
      updatedAt: now,
    });
    return safeProof(await ctx.db.get(proof._id));
  },
});

export const recordStripeConsent = mutationGeneric({
  args: {
    webhookSecret: v.string(),
    proofId: v.id("paymentContractProofs"),
    eventId: v.string(),
    eventType: v.string(),
    requestId: v.optional(v.id("clientRequests")),
    bookingId: v.optional(v.id("bookings")),
    checkoutSessionId: v.optional(v.string()),
    paymentIntentId: v.optional(v.string()),
    contractVersion: v.optional(v.string()),
    stripeMode: stripeModes,
    livemode: v.boolean(),
    consentStatus: v.union(v.literal("accepted"), v.literal("missing"), v.literal("pending")),
    eventCreatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const configuredSecret = process.env.BOOKING_WEBHOOK_SECRET;
    if (!configuredSecret || args.webhookSecret !== configuredSecret) {
      contractError("FORBIDDEN", "Invalid webhook secret");
    }
    if (Boolean(args.requestId) === Boolean(args.bookingId)) {
      contractError("INVALID_INPUT", "Exactly one payment source is required");
    }
    const proof = await ctx.db.get(args.proofId);
    if (!proof) contractError("NOT_FOUND", "Payment contract proof not found");
    if (
      (args.requestId && proof.requestId !== args.requestId) ||
      (args.bookingId && proof.bookingId !== args.bookingId)
    ) {
      contractError("PAYMENT_MISMATCH", "Payment source does not match the contract proof");
    }
    if (proof.stripeMode !== args.stripeMode || args.livemode !== (args.stripeMode === "live")) {
      contractError("PAYMENT_MISMATCH", "Stripe event mode does not match the contract proof");
    }
    if (args.contractVersion && args.contractVersion !== proof.contractVersion) {
      contractError("PAYMENT_MISMATCH", "Stripe contract version does not match the proof");
    }
    assertShortString(args.eventId, "Stripe event");
    assertShortString(args.eventType, "Stripe event type");
    if (!Number.isFinite(args.eventCreatedAt) || args.eventCreatedAt <= 0) {
      contractError("INVALID_INPUT", "Stripe event timestamp is required");
    }
    if (
      args.checkoutSessionId &&
      proof.stripeCheckoutSessionId &&
      args.checkoutSessionId !== proof.stripeCheckoutSessionId
    ) {
      contractError("PAYMENT_MISMATCH", "Checkout session does not match the contract proof");
    }
    if (args.checkoutSessionId && !/^cs_(?:test|live)_[A-Za-z0-9]+$/.test(args.checkoutSessionId)) {
      contractError("INVALID_INPUT", "Invalid checkout session");
    }
    if (args.paymentIntentId && proof.stripePaymentIntentId && args.paymentIntentId !== proof.stripePaymentIntentId) {
      contractError("PAYMENT_MISMATCH", "Payment intent does not match the contract proof");
    }
    if (proof.status === "accepted") return { ok: true, duplicate: false, status: "accepted", proofId: proof._id };
    if (proof.status === "rejected") return { ok: true, duplicate: false, status: "rejected", proofId: proof._id, reason: proof.rejectionReason };
    if (proof.lastEventId === args.eventId) {
      return { ok: true, duplicate: true, status: proof.status === "attached" ? "pending" : proof.status, proofId: proof._id };
    }
    if (!proof.stripeCheckoutSessionId) {
      contractError("PAYMENT_MISMATCH", "Checkout session was not attached before the Stripe event");
    }
    const commonPatch = {
      ...(args.paymentIntentId ? { stripePaymentIntentId: args.paymentIntentId } : {}),
      lastEventId: args.eventId,
      lastEventType: args.eventType,
      updatedAt: Date.now(),
    };
    if (proof.createdAt > args.eventCreatedAt + 999) {
      await ctx.db.patch(proof._id, {
        ...commonPatch,
        status: "rejected",
        stripeConsentStatus: "missing",
        rejectionReason: "consent_event_precedes_proof",
      });
      return { ok: true, duplicate: false, status: "rejected", proofId: proof._id, reason: "consent_event_precedes_proof" };
    }
    if (args.consentStatus === "accepted") {
      if (!args.eventType.startsWith("checkout.session.")) {
        contractError("PAYMENT_MISMATCH", "Only a Checkout event can carry terms consent");
      }
      await ctx.db.patch(proof._id, {
        ...commonPatch,
        status: "accepted",
        stripeConsentStatus: "accepted",
        consentAcceptedAt: args.eventCreatedAt,
        consentEventId: args.eventId,
      });
      return { ok: true, duplicate: false, status: "accepted", proofId: proof._id };
    }
    if (args.consentStatus === "missing") {
      await ctx.db.patch(proof._id, {
        ...commonPatch,
        status: "rejected",
        stripeConsentStatus: "missing",
        rejectionReason: "stripe_terms_of_service_not_accepted",
      });
      return { ok: true, duplicate: false, status: "rejected", proofId: proof._id, reason: "stripe_terms_of_service_not_accepted" };
    }
    await ctx.db.patch(proof._id, {
      ...commonPatch,
      stripeConsentStatus: "pending",
    });
    return { ok: true, duplicate: false, status: "pending", proofId: proof._id };
  },
});

export const getMyProof = queryGeneric({
  args: {
    requestId: v.optional(v.id("clientRequests")),
    bookingId: v.optional(v.id("bookings")),
  },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx);
    const source = await getOwnedSource(ctx, args, current);
    return safeProof(await getLatestProof(ctx, source));
  },
});
