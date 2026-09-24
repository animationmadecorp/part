import { queryGeneric } from "convex/server";
import { v } from "convex/values";

const HISTORY_REQUEST_STATUSES = new Set([
  "awaiting_payment",
  "payment_failed",
  "paid",
  "refunded",
  "cancelled",
  "expired",
]);

function accountError(code, message) {
  throw new Error(`${code}: ${message}`);
}

async function requireIdentity(ctx, requestedUserId) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) accountError("UNAUTHENTICATED", "Authentication required");
  if (requestedUserId !== identity.subject) accountError("FORBIDDEN", "Account identity mismatch");
  return {
    clerkUserId: identity.subject,
    tokenIdentifier: identity.tokenIdentifier || identity.subject,
  };
}

function safeRequest(request) {
  return {
    id: request._id,
    offerKey: request.offerKey,
    status: request.status,
    paymentStatus: request.paymentStatus,
    priceCents: request.priceCents,
    currency: request.currency,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    ...(request.paidAt === undefined ? {} : { paidAt: request.paidAt }),
  };
}

function safeEntitlement(entitlement) {
  return {
    id: entitlement._id,
    offerKey: entitlement.offerKey,
    mode: entitlement.mode,
    totalCredits: entitlement.totalCredits,
    remainingCredits: entitlement.remainingCredits,
    validUntil: entitlement.validUntil,
    status: entitlement.status || "active",
    ...(entitlement.refundStatus === undefined ? {} : { refundStatus: entitlement.refundStatus }),
    ...(entitlement.refundedAmountCents === undefined ? {} : { refundedAmountCents: entitlement.refundedAmountCents }),
    createdAt: entitlement.createdAt,
  };
}

export const getMyPurchaseHistory = queryGeneric({
  args: {
    sessionUserId: v.string(),
    refreshKey: v.number(),
  },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx, args.sessionUserId);
    // refreshKey intentionally participates in the query contract so a new
    // authenticated session or Convex connection cannot reuse an old cache key.
    void args.refreshKey;
    const [requests, entitlements] = await Promise.all([
      ctx.db
        .query("clientRequests")
        .withIndex("by_token_identifier", (query) => query.eq("tokenIdentifier", current.tokenIdentifier))
        .collect(),
      ctx.db
        .query("entitlements")
        .withIndex("by_token_identifier", (query) => query.eq("tokenIdentifier", current.tokenIdentifier))
        .collect(),
    ]);

    return {
      accountId: current.clerkUserId,
      requests: requests
        .filter((request) => request.clerkUserId === current.clerkUserId && HISTORY_REQUEST_STATUSES.has(request.status))
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .map(safeRequest),
      entitlements: entitlements
        .filter((entitlement) => entitlement.clerkUserId === current.clerkUserId)
        .sort((left, right) => right.createdAt - left.createdAt)
        .map(safeEntitlement),
    };
  },
});

// Resolve a paid order to its Checkout Session on the server. Session IDs and
// Stripe invoice URLs never enter the public purchase-history query.
export const getMyInvoiceCheckout = queryGeneric({
  args: {
    sessionUserId: v.string(),
    requestId: v.optional(v.id("clientRequests")),
    entitlementId: v.optional(v.id("entitlements")),
  },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx, args.sessionUserId);
    if (Boolean(args.requestId) === Boolean(args.entitlementId)) accountError("INVALID_INPUT", "One purchase is required");
    if (args.requestId) {
      const request = await ctx.db.get(args.requestId);
      if (!request || request.clerkUserId !== current.clerkUserId || request.tokenIdentifier !== current.tokenIdentifier) {
        accountError("FORBIDDEN", "Purchase is unavailable");
      }
      if (!["paid", "refunded"].includes(request.paymentStatus) || !request.stripeCheckoutSessionId) return null;
      return { checkoutSessionId: request.stripeCheckoutSessionId };
    }
    const entitlement = await ctx.db.get(args.entitlementId);
    if (!entitlement || entitlement.clerkUserId !== current.clerkUserId || entitlement.tokenIdentifier !== current.tokenIdentifier) {
      accountError("FORBIDDEN", "Purchase is unavailable");
    }
    return { checkoutSessionId: entitlement.stripeCheckoutSessionId };
  },
});
