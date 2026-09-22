import { anyApi } from "convex/server";
import { ConvexHttpClient } from "convex/browser";
import { getAuthFoundationConfig } from "@/lib/auth-config";
import { getAuthenticatedConvexClient, getClerkSession } from "@/lib/server-auth";
import { isRetryableResendReason, sendBookingNotification } from "@/lib/resend-server.mjs";
import { notificationIdempotencyKey } from "@/convex/notificationKeys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorStatus(error) {
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("UNAUTHENTICATED:")) return 401;
  if (message.startsWith("FORBIDDEN:")) return 403;
  if (message.startsWith("NOT_FOUND:")) return 404;
  return 500;
}

export async function POST(request) {
  const session = await getClerkSession();
  if (!session.authenticated) return Response.json({ error: "unauthenticated" }, { status: 401 });
  const convex = await getAuthenticatedConvexClient(session);
  if (!convex.ok) return Response.json({ error: convex.reason }, { status: 503 });
  const webhookSecret = process.env.BOOKING_WEBHOOK_SECRET;
  if (!webhookSecret) return Response.json({ error: "booking_webhook_configuration_required" }, { status: 503 });
  const internalConvex = new ConvexHttpClient(getAuthFoundationConfig().convexUrl, { logger: false });
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const kind = body?.kind || "rescheduled";
  if (!body?.notificationId && typeof body?.bookingId !== "string") {
    return Response.json({ error: "notification_required" }, { status: 400 });
  }

  let notificationId = body.notificationId;
  let claimAcquired = false;
  try {
    if (notificationId) {
      await convex.client.query(anyApi.bookings.getBookingNotificationById, { notificationId });
    } else {
      const pending = await convex.client.query(anyApi.bookings.getBookingNotification, {
        bookingId: body.bookingId,
        kind: ["confirmed", "rescheduled", "reminder"].includes(kind) ? kind : "rescheduled",
      });
      notificationId = pending?.id;
    }
    if (!notificationId) return Response.json({ sent: false, reason: "no_pending_notification" });
    const claim = await internalConvex.mutation(anyApi.bookings.claimBookingNotification, { webhookSecret, notificationId });
    if (!claim.claimed) {
      const notDue = claim.status === "not_due";
      return Response.json(
        {
          sent: claim.status === "sent",
          reason: claim.status === "sent"
            ? undefined
            : notDue
              ? "notification_not_due"
              : "notification_in_progress",
        },
        { status: claim.status === "sending" || notDue ? 202 : 200 },
      );
    }
    claimAcquired = true;
    const idempotencyKey = notificationIdempotencyKey(
      notificationId,
      claim.kind,
      claim.booking.rescheduleRevision || 0,
    );
    const sent = await sendBookingNotification({ kind: claim.kind, booking: claim.booking, idempotencyKey });
    if (sent.sent) {
      await internalConvex.mutation(anyApi.bookings.completeBookingNotification, {
        webhookSecret,
        notificationId,
        status: "sent",
        ...(sent.id ? { providerId: sent.id } : {}),
      });
      return Response.json(sent);
    }
    const retryable = isRetryableResendReason(sent.reason);
    await internalConvex.mutation(anyApi.bookings.completeBookingNotification, {
      webhookSecret,
      notificationId,
      status: retryable ? "failed" : "skipped",
      error: sent.reason,
    });
    return Response.json(sent, { status: retryable ? 502 : 200 });
  } catch (error) {
    try {
      if (notificationId && claimAcquired) {
        await internalConvex.mutation(anyApi.bookings.completeBookingNotification, {
          webhookSecret,
          notificationId,
          status: "failed",
          error: error instanceof Error ? error.message : "notification_failed",
        });
      }
    } catch {
      // The durable job remains available for a later retry.
    }
    return Response.json({ error: "notification_failed" }, { status: errorStatus(error) });
  }
}
