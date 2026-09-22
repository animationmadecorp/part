import { mutationGeneric } from "convex/server";
import { v } from "convex/values";

const RETRY_AFTER_MS = 5 * 60 * 1000;
const NOTIFICATION_EVENT = "client_confirmation_email";

function notificationError(code, message) {
  throw new Error(`${code}: ${message}`);
}

function requireSecret(args) {
  const configuredSecret = process.env.BOOKING_WEBHOOK_SECRET;
  if (!configuredSecret || args.webhookSecret !== configuredSecret) {
    notificationError("FORBIDDEN", "Invalid notification secret");
  }
}

function expectedKey(requestId) {
  return `client-request:${requestId}:confirmation`;
}

function attemptKey(idempotencyKey, now, previous) {
  // The stable sourceId deduplicates the paid order; fromStatus carries the
  // short-lived claim token so a late completion cannot close a newer retry.
  return `${idempotencyKey}:attempt:${now}:${previous?.createdAt ?? 0}`;
}

function safeRequestForNotification(request) {
  return {
    requestId: request._id,
    offerKey: request.offerKey,
    priceCents: request.priceCents,
    currency: request.currency,
    ...(typeof request.email === "string" ? { email: request.email } : {}),
  };
}

async function findNotificationEvent(ctx, requestId, idempotencyKey) {
  const events = await ctx.db
    .query("clientRequestEvents")
    .withIndex("by_request", (query) => query.eq("requestId", requestId))
    .collect();
  return events
    .filter((event) => event.eventType === NOTIFICATION_EVENT && event.sourceId === idempotencyKey)
    .sort((left, right) => right.createdAt - left.createdAt)[0] || null;
}

export const claimClientRequestNotification = mutationGeneric({
  args: {
    webhookSecret: v.string(),
    requestId: v.id("clientRequests"),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireSecret(args);
    if (args.idempotencyKey !== expectedKey(args.requestId)) {
      notificationError("IDEMPOTENCY_MISMATCH", "Invalid client notification key");
    }
    const request = await ctx.db.get(args.requestId);
    if (!request) return { claimed: false, status: "missing" };
    if (request.status !== "paid" || request.paymentStatus !== "paid") {
      return { claimed: false, status: "not_paid" };
    }
    const now = Date.now();
    const previous = await findNotificationEvent(ctx, request._id, args.idempotencyKey);
    if (previous?.toStatus === "sent") return { claimed: false, status: "sent" };
    if (previous?.toStatus === "skipped") return { claimed: false, status: "skipped" };
    if (previous?.toStatus === "sending" && now - previous.createdAt < RETRY_AFTER_MS) {
      return { claimed: false, status: "sending" };
    }
    const claimId = attemptKey(args.idempotencyKey, now, previous);
    if (previous) {
      await ctx.db.patch(previous._id, {
        fromStatus: claimId,
        toStatus: "sending",
        createdAt: now,
      });
    } else {
      await ctx.db.insert("clientRequestEvents", {
        requestId: request._id,
        eventType: NOTIFICATION_EVENT,
        fromStatus: claimId,
        toStatus: "sending",
        sourceId: args.idempotencyKey,
        createdAt: now,
      });
    }
    return {
      claimed: true,
      status: "sending",
      attemptId: claimId,
      request: safeRequestForNotification(request),
    };
  },
});

export const completeClientRequestNotification = mutationGeneric({
  args: {
    webhookSecret: v.string(),
    requestId: v.id("clientRequests"),
    idempotencyKey: v.string(),
    attemptId: v.string(),
    status: v.union(v.literal("sent"), v.literal("skipped"), v.literal("failed")),
    providerId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireSecret(args);
    if (args.idempotencyKey !== expectedKey(args.requestId)) {
      notificationError("IDEMPOTENCY_MISMATCH", "Invalid client notification key");
    }
    const event = await findNotificationEvent(ctx, args.requestId, args.idempotencyKey);
    if (!event) return { ok: false, status: "missing" };
    if (["sending", "failed"].includes(event.toStatus) && event.fromStatus !== args.attemptId) {
      return { ok: false, status: "stale_claim" };
    }
    if (event.toStatus === "sent" && args.status === "failed") return { ok: true, status: "sent" };
    if (!["sending", "failed"].includes(event.toStatus)) {
      return { ok: true, status: event.toStatus };
    }
    await ctx.db.patch(event._id, {
      toStatus: args.status,
      createdAt: Date.now(),
    });
    return { ok: true, status: args.status };
  },
});
