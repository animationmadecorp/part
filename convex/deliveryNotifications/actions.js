import {
  internalActionGeneric,
  internalMutationGeneric,
  internalQueryGeneric,
} from "convex/server";
import { v } from "convex/values";
import { internal } from "../_generated/api.js";
import {
  isRetryableResendReason,
  prepareDeliveryNotification,
  RESEND_IDEMPOTENCY_SAFETY_MARGIN_MS,
  sendDeliveryNotification,
} from "../../lib/resend-server.mjs";

const RETRY_AFTER_MS = 5 * 60 * 1000;
const CLAIM_STALE_AFTER_MS = 5 * 60 * 1000;
const IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const DELIVERY_KINDS = new Set(["pdf", "review"]);
const FOLLOW_UP_BY_OFFER = Object.freeze({
  review: "book",
  contenu: "contenu",
  "projet-animation": "animation",
  feedback: "feedback",
});

function deliveryError(code, message) {
  throw new Error(`${code}: ${message}`);
}

function normalizeEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > 320 || /\s/.test(email) || !email.includes("@")) return null;
  return email;
}

function isPaidRequest(request) {
  return request?.status === "paid" && request?.paymentStatus === "paid";
}

function labelForKind(kind, request) {
  if (kind === "pdf") return "Ton PDF personnalisé";
  return request?.offerKey === "review" ? "Ton deuxième retour sur ton book" : "Ta review d’animation";
}

function followUpPathForRequest(requestId, offerKey) {
  const followUp = FOLLOW_UP_BY_OFFER[offerKey];
  return `/nouveau/bibliotheque?onglet=suivi${followUp ? `&suivi=${encodeURIComponent(followUp)}` : ""}&requestId=${encodeURIComponent(requestId)}`;
}

function dedupeKeyFor({ requestId, kind, sourceId }) {
  return `delivery:${requestId}:${kind}:${sourceId}`;
}

function safeError(error) {
  const value = error instanceof Error ? error.message : String(error || "notification_failed");
  return value.slice(0, 500);
}

function claimTokenFor(notification, attempt, now) {
  return `${notification.dedupeKey}:attempt:${attempt}:${now}`;
}

async function findByDedupeKey(ctx, dedupeKey) {
  return ctx.db
    .query("deliveryNotificationOutbox")
    .withIndex("by_dedupe", (query) => query.eq("dedupeKey", dedupeKey))
    .first();
}

async function markSkipped(ctx, notification, reason, now = Date.now()) {
  if (notification.status === "sent") return notification;
  await ctx.db.patch(notification._id, {
    status: "skipped",
    claimToken: undefined,
    claimExpiresAt: undefined,
    lastError: reason,
    nextAttemptAt: 0,
    updatedAt: now,
  });
  return await ctx.db.get(notification._id);
}

function scheduleDelivery(ctx, notificationId, delayMs = 0) {
  return ctx.scheduler.runAfter(delayMs, internal.deliveryNotifications.actions.deliver, {
    notificationId,
  });
}

// Called from the publication mutation, while the paid dossier and its
// publication record are still in the same Convex transaction. The source id
// is deliberately opaque: neither storage URLs nor browser-provided links
// are accepted into the outbox.
export async function enqueueDeliveryNotification(ctx, { requestId, kind, sourceId, publishedAt }) {
  if (!DELIVERY_KINDS.has(kind)) deliveryError("INVALID_INPUT", "Unknown delivery notification kind");
  if (typeof sourceId !== "string" || !sourceId.trim()) {
    deliveryError("INVALID_INPUT", "A publication source id is required");
  }
  const dedupeKey = dedupeKeyFor({ requestId, kind, sourceId: sourceId.trim() });
  const existing = await findByDedupeKey(ctx, dedupeKey);
  if (existing) return { notification: existing, duplicate: true };

  const request = await ctx.db.get(requestId);
  if (!request) deliveryError("NOT_FOUND", "Client request not found");
  const now = Number.isSafeInteger(publishedAt) ? publishedAt : Date.now();
  const recipient = normalizeEmail(request.email);
  const paid = isPaidRequest(request);
  const status = paid && recipient ? "pending" : "skipped";
  const lastError = !paid ? "request_not_paid" : recipient ? undefined : "recipient_missing";
  const notificationId = await ctx.db.insert("deliveryNotificationOutbox", {
    requestId,
    kind,
    sourceId: sourceId.trim(),
    dedupeKey,
    ...(recipient && paid ? { recipient } : {}),
    deliveryLabel: labelForKind(kind, request),
    followUpPath: followUpPathForRequest(requestId, request.offerKey),
    publishedAt: now,
    status,
    attempts: 0,
    nextAttemptAt: status === "pending" ? now : 0,
    ...(lastError ? { lastError } : {}),
    createdAt: now,
    updatedAt: now,
  });
  const notification = await ctx.db.get(notificationId);
  if (status === "pending") await scheduleDelivery(ctx, notificationId);
  return { notification, duplicate: false };
}

export const getSendPayload = internalQueryGeneric({
  args: {
    notificationId: v.id("deliveryNotificationOutbox"),
    claimToken: v.string(),
  },
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) return { ok: false, reason: "missing" };
    if (notification.status !== "sending" || notification.claimToken !== args.claimToken) {
      return { ok: false, reason: "stale_claim" };
    }
    if (
      notification.idempotencyExpiresAt &&
      notification.idempotencyExpiresAt <= Date.now() + RESEND_IDEMPOTENCY_SAFETY_MARGIN_MS
    ) {
      return { ok: false, reason: "idempotency_window_expired" };
    }
    const request = await ctx.db.get(notification.requestId);
    if (!request || !isPaidRequest(request)) return { ok: false, reason: "request_not_paid" };
    const recipient = normalizeEmail(request.email);
    if (!recipient) return { ok: false, reason: "recipient_missing" };
    const effectiveRecipient = notification.providerPayload?.recipient || recipient;
    return {
      ok: true,
      recipient: effectiveRecipient,
      kind: notification.kind,
      deliveryLabel: notification.deliveryLabel,
      followUpPath: notification.followUpPath,
      idempotencyKey: notification.dedupeKey,
      idempotencyExpiresAt: notification.idempotencyExpiresAt,
      ...(notification.providerPayload ? { providerPayload: notification.providerPayload } : {}),
    };
  },
});

export const claim = internalMutationGeneric({
  args: { notificationId: v.id("deliveryNotificationOutbox") },
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) return { claimed: false, status: "missing" };
    if (notification.status === "sent" || notification.status === "skipped") {
      return { claimed: false, status: notification.status };
    }
    const now = Date.now();
    if (
      notification.idempotencyExpiresAt &&
      notification.idempotencyExpiresAt <= now + RESEND_IDEMPOTENCY_SAFETY_MARGIN_MS
    ) {
      await ctx.db.patch(notification._id, {
        status: "failed",
        claimToken: undefined,
        claimExpiresAt: undefined,
        lastError: "idempotency_window_expired",
        nextAttemptAt: 0,
        updatedAt: now,
      });
      return { claimed: false, status: "idempotency_window_expired" };
    }
    if (notification.status === "failed" && notification.attempts >= MAX_ATTEMPTS) {
      return { claimed: false, status: "max_attempts" };
    }
    if (
      notification.status === "failed" &&
      notification.nextAttemptAt > now
    ) {
      return { claimed: false, status: "not_due", nextAttemptAt: notification.nextAttemptAt };
    }
    if (
      notification.status === "sending" &&
      now < Number(notification.claimExpiresAt || 0)
    ) {
      return { claimed: false, status: "sending" };
    }

    const request = await ctx.db.get(notification.requestId);
    if (!request || !isPaidRequest(request)) {
      await markSkipped(ctx, notification, "request_not_paid", now);
      return { claimed: false, status: "not_paid" };
    }
    const recipient = normalizeEmail(request.email);
    if (!recipient) {
      await markSkipped(ctx, notification, "recipient_missing", now);
      return { claimed: false, status: "recipient_missing" };
    }

    const attempts = notification.attempts + 1;
    if (attempts > MAX_ATTEMPTS) {
      await ctx.db.patch(notification._id, {
        status: "failed",
        claimToken: undefined,
        claimExpiresAt: undefined,
        lastError: "max_attempts_reached",
        nextAttemptAt: 0,
        updatedAt: now,
      });
      return { claimed: false, status: "max_attempts" };
    }
    const claimToken = claimTokenFor(notification, attempts, now);
    const firstAttemptAt = notification.firstAttemptAt || now;
    await ctx.db.patch(notification._id, {
      status: "sending",
      attempts,
      recipient,
      claimToken,
      claimExpiresAt: now + CLAIM_STALE_AFTER_MS,
      firstAttemptAt,
      idempotencyExpiresAt: notification.idempotencyExpiresAt || firstAttemptAt + IDEMPOTENCY_WINDOW_MS,
      nextAttemptAt: now + CLAIM_STALE_AFTER_MS,
      updatedAt: now,
    });
    await scheduleDelivery(ctx, notification._id, CLAIM_STALE_AFTER_MS);
    return {
      claimed: true,
      status: "sending",
      notificationId: notification._id,
      claimToken,
      attempts,
    };
  },
});

export const recordPayload = internalMutationGeneric({
  args: {
    notificationId: v.id("deliveryNotificationOutbox"),
    claimToken: v.string(),
    providerPayload: v.object({
      recipient: v.string(),
      from: v.string(),
      replyTo: v.string(),
      subject: v.string(),
      text: v.string(),
      html: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) return { ok: false, status: "missing" };
    if (notification.status !== "sending" || notification.claimToken !== args.claimToken) {
      return { ok: false, status: "stale_claim" };
    }
    if (notification.providerPayload) {
      const samePayload = JSON.stringify(notification.providerPayload) === JSON.stringify(args.providerPayload);
      return samePayload
        ? { ok: true, status: "locked", providerPayload: notification.providerPayload }
        : { ok: false, status: "payload_locked", providerPayload: notification.providerPayload };
    }
    await ctx.db.patch(notification._id, {
      providerPayload: args.providerPayload,
      updatedAt: Date.now(),
    });
    return { ok: true, status: "recorded", providerPayload: args.providerPayload };
  },
});

export const complete = internalMutationGeneric({
  args: {
    notificationId: v.id("deliveryNotificationOutbox"),
    claimToken: v.string(),
    status: v.union(v.literal("sent"), v.literal("skipped"), v.literal("failed")),
    providerId: v.optional(v.string()),
    error: v.optional(v.string()),
    recipient: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) return { ok: false, status: "missing" };
    if (notification.status === "sent") return { ok: true, status: "sent" };
    if (notification.status === "skipped") return { ok: true, status: "skipped" };
    if (notification.status !== "sending" || notification.claimToken !== args.claimToken) {
      return { ok: false, status: "stale_claim" };
    }
    const now = Date.now();
    if (args.status === "sent") {
      const request = await ctx.db.get(notification.requestId);
      // The provider result is authoritative once Resend has accepted the
      // message. If payment or the email changes in the tiny window after the
      // pre-send recheck, preserve the actual recipient/provider id and mark
      // the post-send eligibility change for audit instead of pretending no
      // email was sent.
      const providerRecipient = normalizeEmail(args.recipient) || notification.recipient || null;
      const currentRecipient = normalizeEmail(request?.email);
      const eligibilityChanged =
        !request ||
        !isPaidRequest(request) ||
        !providerRecipient ||
        currentRecipient !== providerRecipient;
      await ctx.db.patch(notification._id, {
        status: "sent",
        ...(providerRecipient ? { recipient: providerRecipient } : {}),
        claimToken: undefined,
        claimExpiresAt: undefined,
        ...(args.providerId ? { providerId: args.providerId } : {}),
        lastError: eligibilityChanged ? "eligibility_changed_after_send" : undefined,
        nextAttemptAt: 0,
        updatedAt: now,
      });
      return { ok: true, status: "sent" };
    }
    if (args.status === "skipped") {
      await ctx.db.patch(notification._id, {
        status: "skipped",
        claimToken: undefined,
        claimExpiresAt: undefined,
        ...(args.recipient ? { recipient: normalizeEmail(args.recipient) || undefined } : {}),
        ...(args.error ? { lastError: args.error.slice(0, 500) } : {}),
        nextAttemptAt: 0,
        updatedAt: now,
      });
      return { ok: true, status: "skipped" };
    }

    const attempts = notification.attempts;
    const idempotencyExpired = Boolean(
      notification.idempotencyExpiresAt &&
      notification.idempotencyExpiresAt <= now + RESEND_IDEMPOTENCY_SAFETY_MARGIN_MS,
    );
    const exhausted = attempts >= MAX_ATTEMPTS || idempotencyExpired;
    const nextAttemptAt = exhausted ? 0 : now + RETRY_AFTER_MS;
    await ctx.db.patch(notification._id, {
      status: "failed",
      claimToken: undefined,
      claimExpiresAt: undefined,
      lastError: (idempotencyExpired ? "idempotency_window_expired" : args.error || "notification_failed").slice(0, 500),
      nextAttemptAt,
      updatedAt: now,
    });
    if (!exhausted) await scheduleDelivery(ctx, notification._id, RETRY_AFTER_MS);
    return { ok: true, status: "failed", retryScheduled: !exhausted };
  },
});

export const deliver = internalActionGeneric({
  args: { notificationId: v.id("deliveryNotificationOutbox") },
  handler: async (ctx, args) => {
    const claim = await ctx.runMutation(internal.deliveryNotifications.actions.claim, {
      notificationId: args.notificationId,
    });
    if (!claim.claimed) return claim;

    const payload = await ctx.runQuery(internal.deliveryNotifications.actions.getSendPayload, {
      notificationId: args.notificationId,
      claimToken: claim.claimToken,
    });
    if (!payload.ok) {
      await ctx.runMutation(internal.deliveryNotifications.actions.complete, {
        notificationId: args.notificationId,
        claimToken: claim.claimToken,
        status: payload.reason === "idempotency_window_expired" ? "failed" : "skipped",
        error: payload.reason,
      });
      return { sent: false, reason: payload.reason };
    }

    let providerRecipient = payload.recipient;
    try {
      let providerPayload = payload.providerPayload;
      if (!providerPayload) {
        const prepared = prepareDeliveryNotification({
          recipient: payload.recipient,
          kind: payload.kind,
          deliveryLabel: payload.deliveryLabel,
          followUpPath: payload.followUpPath,
        });
        if (!prepared.ready) {
          const retryable = isRetryableResendReason(prepared.reason) || prepared.reason === "notification_failed";
          await ctx.runMutation(internal.deliveryNotifications.actions.complete, {
            notificationId: args.notificationId,
            claimToken: claim.claimToken,
            status: retryable ? "failed" : "skipped",
            error: prepared.reason || "notification_failed",
            recipient: payload.recipient,
          });
          return { sent: false, reason: prepared.reason };
        }
        const recorded = await ctx.runMutation(internal.deliveryNotifications.actions.recordPayload, {
          notificationId: args.notificationId,
          claimToken: claim.claimToken,
          providerPayload: prepared.providerPayload,
        });
        if (!recorded.ok) return { sent: false, reason: recorded.status };
        providerPayload = recorded.providerPayload;
      }
      providerRecipient = providerPayload.recipient;
      const result = await sendDeliveryNotification({
        recipient: payload.recipient,
        kind: payload.kind,
        deliveryLabel: payload.deliveryLabel,
        idempotencyKey: payload.idempotencyKey,
        idempotencyExpiresAt: payload.idempotencyExpiresAt,
        providerPayload,
      });
      if (result.sent) {
        await ctx.runMutation(internal.deliveryNotifications.actions.complete, {
          notificationId: args.notificationId,
          claimToken: claim.claimToken,
          status: "sent",
          ...(result.id ? { providerId: result.id } : {}),
          recipient: providerPayload.recipient,
        });
        return result;
      }
      const retryable =
        result.reason === "idempotency_window_expired" ||
        isRetryableResendReason(result.reason) ||
        result.reason === "notification_failed";
      await ctx.runMutation(internal.deliveryNotifications.actions.complete, {
        notificationId: args.notificationId,
        claimToken: claim.claimToken,
        status: retryable ? "failed" : "skipped",
        error: result.reason || "notification_failed",
        recipient: providerPayload.recipient,
      });
      return result;
    } catch (error) {
      await ctx.runMutation(internal.deliveryNotifications.actions.complete, {
        notificationId: args.notificationId,
        claimToken: claim.claimToken,
        status: "failed",
        error: safeError(error),
        recipient: providerRecipient,
      });
      return { sent: false, reason: "notification_failed" };
    }
  },
});

export const deliveryNotificationConstants = Object.freeze({
  MAX_ATTEMPTS,
  RETRY_AFTER_MS,
  CLAIM_STALE_AFTER_MS,
  IDEMPOTENCY_WINDOW_MS,
  RESEND_IDEMPOTENCY_SAFETY_MARGIN_MS,
});
