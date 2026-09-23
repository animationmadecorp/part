import { anyApi } from "convex/server";
import { ConvexHttpClient } from "convex/browser";
import { getAuthFoundationConfig } from "@/lib/auth-config";
import {
  getStripePaymentIntent,
  getStripeConfig,
  parseVerifiedStripeEvent,
  refundStripePaymentIntent,
} from "@/lib/stripe-server.mjs";
import {
  clientRequestNotificationKey,
  isRetryableResendReason,
  sendBookingNotification,
  sendClientRequestNotification,
} from "@/lib/resend-server.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function metadataBookingId(object) {
  const value = object?.metadata?.bookingId;
  return typeof value === "string" && /^[a-z0-9][a-z0-9_-]{7,}$/i.test(value) ? value : undefined;
}

function metadataClientRequestId(object) {
  const value = object?.metadata?.clientRequestId;
  return typeof value === "string" && /^[a-z0-9][a-z0-9_-]{7,}$/i.test(value) ? value : undefined;
}

function metadataValue(object, key) {
  const value = object?.metadata?.[key];
  return typeof value === "string" && value.length <= 240 ? value : undefined;
}

function metadataAttempt(object) {
  const value = metadataValue(object, "attempt");
  const attempt = Number(value);
  return Number.isSafeInteger(attempt) && attempt > 0 ? attempt : undefined;
}

function effectFailure(error) {
  return error instanceof Error ? error.message : "provider_effect_failed";
}

function shouldRetryNotification(notification) {
  return isRetryableResendReason(notification?.reason);
}

function checkoutConsentStatus(event, object) {
  if (!event.type.startsWith("checkout.session.")) return "pending";
  return object?.consent?.terms_of_service === "accepted" ? "accepted" : "missing";
}

function eventCreatedAt(event) {
  return Number.isSafeInteger(event?.created) && event.created > 0 ? event.created * 1000 : null;
}

async function enforceCheckoutContract(
  convex,
  stripeConfig,
  event,
  object,
  { requestId, bookingId, checkoutSessionId, paymentIntentId, webhookSecret },
) {
  const proofId = metadataValue(object, "contractProofId");
  // Existing test-mode harnesses and historical test payments remain
  // readable. Every newly-created session carries the proof metadata, and
  // live mode never accepts the legacy path.
  if (!proofId && stripeConfig.mode !== "live") return { status: "legacy_test" };
  if (!proofId) return { status: "missing" };
  const createdAt = eventCreatedAt(event);
  if (!createdAt || (!requestId && !bookingId)) return { status: "invalid" };
  return convex.mutation(anyApi.paymentContractProofs.recordStripeConsent, {
    webhookSecret,
    proofId,
    eventId: event.id,
    eventType: event.type,
    ...(requestId ? { requestId } : {}),
    ...(bookingId ? { bookingId } : {}),
    ...(checkoutSessionId ? { checkoutSessionId } : {}),
    ...(paymentIntentId ? { paymentIntentId } : {}),
    ...(metadataValue(object, "contractVersion") ? { contractVersion: metadataValue(object, "contractVersion") } : {}),
    stripeMode: stripeConfig.mode,
    livemode: event.livemode === true,
    consentStatus: checkoutConsentStatus(event, object),
    eventCreatedAt: createdAt,
  });
}

async function updateStripeEffect(convex, { webhookSecret, eventId, effect, status, providerId, error }) {
  return convex.mutation(anyApi.bookings.completeStripeEffect, {
    webhookSecret,
    eventId,
    effect,
    status,
    ...(providerId ? { providerId } : {}),
    ...(error ? { error: error.slice(0, 500) } : {}),
  });
}

export async function POST(request) {
  const rawBody = await request.text();
  let event;
  try {
    event = parseVerifiedStripeEvent(rawBody, request.headers.get("stripe-signature"));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "invalid_signature" },
      { status: Number.isInteger(error?.status) ? error.status : 400 },
    );
  }

  const config = getAuthFoundationConfig();
  const stripeConfig = getStripeConfig();
  const webhookSecret = process.env.BOOKING_WEBHOOK_SECRET;
  if (!config.convexConfigured || !webhookSecret) {
    return Response.json({ error: "booking_webhook_configuration_required" }, { status: 503 });
  }
  const convex = new ConvexHttpClient(config.convexUrl, { logger: false });
  const object = event.data.object;
  const isCheckout = event.type.startsWith("checkout.session.");
  const checkoutSessionId = isCheckout && typeof object.id === "string" ? object.id : undefined;
  const paymentIntentId = isCheckout
    ? typeof object.payment_intent === "string" ? object.payment_intent : undefined
    : event.type === "charge.refunded"
      ? typeof object.payment_intent === "string" ? object.payment_intent : undefined
      : typeof object.payment_intent === "string"
        ? object.payment_intent
        : typeof object.id === "string" ? object.id : undefined;
  const paymentStatus = object.payment_status || (object.status === "succeeded" ? "paid" : "unpaid");
  const isPaymentSuccess = [
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "payment_intent.succeeded",
  ].includes(event.type);

  let clientRequestId = metadataClientRequestId(object);
  const bookingMetadataId = metadataBookingId(object);
  let englishRefundMarker = Boolean(bookingMetadataId) || metadataValue(object, "offerKey") === "anglais";
  let refundMetadataObject = object;
  if (event.type === "charge.refunded" && !paymentIntentId) {
    return Response.json({ error: "refund_payment_intent_missing" }, { status: 400 });
  }
  if (event.type === "charge.refunded" && paymentIntentId) {
    let bookingRefund;
    try {
      bookingRefund = await convex.mutation(anyApi.bookings.applyStripeRefund, {
        webhookSecret,
        eventId: event.id,
        paymentIntentId,
        ...(bookingMetadataId ? { bookingId: bookingMetadataId } : {}),
        ...(typeof object.amount === "number" ? { amountTotal: object.amount } : {}),
        ...(typeof object.amount_refunded === "number" ? { amountRefunded: object.amount_refunded } : {}),
        ...(typeof object.refunded === "boolean" ? { refunded: object.refunded } : {}),
        ...(typeof object.currency === "string" ? { currency: object.currency } : {}),
      });
    } catch {
      return Response.json({ error: "booking_refund_processing_failed" }, { status: 500 });
    }
    if (bookingRefund.kind === "unmatched" && !englishRefundMarker && !clientRequestId) {
      let paymentIntent;
      try {
        paymentIntent = await getStripePaymentIntent(paymentIntentId);
      } catch {
        return Response.json({ error: "refund_classification_failed" }, { status: 503 });
      }
      refundMetadataObject = paymentIntent;
      clientRequestId = metadataClientRequestId(paymentIntent);
      englishRefundMarker = Boolean(metadataBookingId(paymentIntent)) || metadataValue(paymentIntent, "offerKey") === "anglais";
      if (!englishRefundMarker && !clientRequestId) {
        return Response.json({ error: "refund_owner_metadata_missing" }, { status: 503 });
      }
    }
    if (
      bookingRefund.kind === "booking" ||
      bookingRefund.kind === "rejected" ||
      (bookingRefund.kind === "unmatched" && englishRefundMarker)
    ) {
      return Response.json(
        {
          received: true,
          status: bookingRefund.status,
          duplicate: bookingRefund.duplicate === true,
          refund: bookingRefund,
        },
        { status: 200 },
      );
    }
  }
  const clientRefundByPaymentIntent = event.type === "charge.refunded" && Boolean(paymentIntentId);
  if (clientRequestId || clientRefundByPaymentIntent) {
    if (isPaymentSuccess) {
      let contractResult;
      try {
        contractResult = await enforceCheckoutContract(convex, stripeConfig, event, object, {
          requestId: clientRequestId,
          checkoutSessionId,
          paymentIntentId,
          webhookSecret,
        });
      } catch {
        return Response.json({ error: "contract_proof_processing_failed" }, { status: 500 });
      }
      if (contractResult.status === "missing" || contractResult.status === "invalid") {
        return Response.json({ error: "contract_proof_required" }, { status: 400 });
      }
      if (contractResult.status === "rejected") {
        return Response.json({ received: true, status: "contract_consent_required", requestId: clientRequestId }, { status: 200 });
      }
      if (contractResult.status === "pending") {
        return Response.json({ received: true, status: "contract_consent_pending", requestId: clientRequestId }, { status: 502 });
      }
    }
    let clientResult;
    try {
      clientResult = await convex.mutation(anyApi.clientRequests.confirmFromStripe, {
        webhookSecret,
        eventId: event.id,
        eventType: event.type,
        ...(clientRequestId ? { requestId: clientRequestId } : {}),
        ...(checkoutSessionId ? { checkoutSessionId } : {}),
        ...(paymentIntentId ? { paymentIntentId } : {}),
        paymentStatus,
        ...(isPaymentSuccess && typeof object.amount_total === "number" ? { amountTotal: object.amount_total } : {}),
        ...(isPaymentSuccess && typeof object.amount_total !== "number" && typeof object.amount_received === "number" ? { amountTotal: object.amount_received } : {}),
        ...(isPaymentSuccess && typeof object.amount_total !== "number" && typeof object.amount_received !== "number" && typeof object.amount === "number" ? { amountTotal: object.amount } : {}),
        ...(event.type === "charge.refunded" && typeof object.amount === "number" ? { amountTotal: object.amount } : {}),
        ...(event.type === "charge.refunded" && typeof object.amount_refunded === "number" ? { amountRefunded: object.amount_refunded } : {}),
        ...(event.type === "charge.refunded" && typeof object.refunded === "boolean" ? { refunded: object.refunded } : {}),
        ...(typeof object.currency === "string" ? { currency: object.currency } : {}),
        ...(metadataValue(refundMetadataObject, "userId") ? { metadataUserId: metadataValue(refundMetadataObject, "userId") } : {}),
        ...(metadataValue(refundMetadataObject, "offerKey") ? { metadataOfferKey: metadataValue(refundMetadataObject, "offerKey") } : {}),
        ...(metadataAttempt(refundMetadataObject) ? { checkoutAttempt: metadataAttempt(refundMetadataObject) } : {}),
      });
    } catch {
      return Response.json({ error: "client_request_confirmation_failed" }, { status: 500 });
    }
    let notification = null;
    let notificationFailed = false;
    let claim = null;
    if (["paid", "already_paid"].includes(clientResult.status) && clientResult.requestId) {
      const idempotencyKey = clientRequestNotificationKey(clientResult.requestId);
      try {
        claim = await convex.mutation(anyApi.clientNotifications.claimClientRequestNotification, {
          webhookSecret,
          requestId: clientResult.requestId,
          idempotencyKey,
        });
        if (!claim.claimed) {
          notification = { sent: claim.status === "sent", reason: claim.status };
          notificationFailed = claim.status === "sending";
        } else {
          notification = await sendClientRequestNotification({
            // The recipient is read from the server-side dossier under the
            // webhook secret, never inferred from an untrusted request body.
            request: claim.request,
            idempotencyKey,
          });
          const retry = shouldRetryNotification(notification);
          await convex.mutation(anyApi.clientNotifications.completeClientRequestNotification, {
            webhookSecret,
            requestId: clientResult.requestId,
            idempotencyKey,
            attemptId: claim.attemptId,
            status: notification.sent ? "sent" : (retry ? "failed" : "skipped"),
            ...(notification.id ? { providerId: notification.id } : {}),
            ...(!notification.sent && notification.reason ? { error: notification.reason } : {}),
          });
          notificationFailed = retry;
        }
      } catch (error) {
        notificationFailed = true;
        notification = { sent: false, reason: effectFailure(error) };
        if (claim?.claimed && claim.attemptId) {
          try {
            await convex.mutation(anyApi.clientNotifications.completeClientRequestNotification, {
              webhookSecret,
              requestId: clientResult.requestId,
              idempotencyKey,
              attemptId: claim.attemptId,
              status: "failed",
              error: effectFailure(error),
            });
          } catch {
            // The durable event remains claimable for the next signed retry.
          }
        }
      }
    }
    return Response.json(
      {
        received: true,
        status: clientResult.status,
        duplicate: clientResult.duplicate === true,
        requestId: clientResult.requestId || clientRequestId,
        notification,
      },
      { status: notificationFailed ? 502 : 200 },
    );
  }

  let result;
  if (isPaymentSuccess) {
    let contractResult;
    try {
      contractResult = await enforceCheckoutContract(convex, stripeConfig, event, object, {
        bookingId: bookingMetadataId,
        checkoutSessionId,
        paymentIntentId,
        webhookSecret,
      });
    } catch {
      return Response.json({ error: "contract_proof_processing_failed" }, { status: 500 });
    }
    if (contractResult.status === "missing" || contractResult.status === "invalid") {
      return Response.json({ error: "contract_proof_required" }, { status: 400 });
    }
    if (contractResult.status === "rejected") {
      return Response.json({ received: true, status: "contract_consent_required", bookingId: bookingMetadataId }, { status: 200 });
    }
    if (contractResult.status === "pending") {
      return Response.json({ received: true, status: "contract_consent_pending", bookingId: bookingMetadataId }, { status: 502 });
    }
  }
  try {
    result = await convex.mutation(anyApi.bookings.confirmFromStripe, {
      webhookSecret,
      eventId: event.id,
      eventType: event.type,
      ...(bookingMetadataId ? { bookingId: bookingMetadataId } : {}),
      ...(checkoutSessionId ? { checkoutSessionId } : {}),
      ...(paymentIntentId ? { paymentIntentId } : {}),
      paymentStatus,
      ...(isPaymentSuccess && typeof object.amount_total === "number" ? { amountTotal: object.amount_total } : {}),
      ...(isPaymentSuccess && typeof object.amount_total !== "number" && typeof object.amount_received === "number" ? { amountTotal: object.amount_received } : {}),
      ...(isPaymentSuccess && typeof object.amount_total !== "number" && typeof object.amount_received !== "number" && typeof object.amount === "number" ? { amountTotal: object.amount } : {}),
      ...(isPaymentSuccess && typeof object.currency === "string" ? { currency: object.currency } : {}),
    });
  } catch {
    return Response.json({ error: "booking_confirmation_failed" }, { status: 500 });
  }

  let effectFailed = false;
  let refund = null;
  if (result.refundStatus && ["late_hold", "late_conflict"].includes(result.status)) {
    if (!paymentIntentId) {
      effectFailed = true;
      refund = { sent: false, reason: "payment_intent_missing" };
    } else {
      try {
        const claim = await convex.mutation(anyApi.bookings.claimStripeRefund, {
          webhookSecret,
          paymentIntentId,
        });
        if (claim.claimed) {
          try {
            const providerResult = await refundStripePaymentIntent(paymentIntentId, process.env, {
              idempotencyKey: `payment-intent:${paymentIntentId}:refund`,
            });
            if (providerResult?.skipped) throw new Error(providerResult.reason || "refund_skipped");
            await convex.mutation(anyApi.bookings.completeStripeRefund, {
              webhookSecret,
              paymentIntentId,
              status: "sent",
              providerId: providerResult?.id,
            });
            refund = { sent: true, id: providerResult?.id || null };
          } catch (error) {
            effectFailed = true;
            refund = { sent: false, reason: effectFailure(error) };
            try {
              await convex.mutation(anyApi.bookings.completeStripeRefund, {
                webhookSecret,
                paymentIntentId,
                status: "failed",
                error: effectFailure(error),
              });
            } catch {
              // Keep the effect pending if the durable status cannot be written.
            }
          }
        } else {
          if (claim.status === "sending") effectFailed = true;
          refund = claim.status === "sent"
            ? { sent: true, reason: "already_refunded" }
            : { sent: false, reason: claim.status || "refund_in_progress" };
        }
      } catch (error) {
        effectFailed = true;
        refund = { sent: false, reason: effectFailure(error) };
      }
    }
  }

  let notification = null;
  const notificationBooking = result.notificationSnapshot && result.booking
    ? { ...result.booking, ...result.notificationSnapshot }
    : result.booking;
  if (result.notificationStatus && notificationBooking?.email) {
    try {
      const claim = await convex.mutation(anyApi.bookings.claimStripeEffect, {
        webhookSecret,
        eventId: result.eventId || event.id,
        effect: "notification",
      });
      if (claim.claimed) {
        try {
          const sent = await sendBookingNotification({
            kind: "confirmed",
            booking: notificationBooking,
            idempotencyKey: `booking:${result.eventId || event.id}:notification`,
          });
          const skipped = !sent.sent;
          const retry = shouldRetryNotification(sent);
          await updateStripeEffect(convex, {
            webhookSecret,
            eventId: result.eventId || event.id,
            effect: "notification",
            status: skipped ? (retry ? "failed" : "skipped") : "sent",
            providerId: sent.id,
            error: skipped ? sent.reason : undefined,
          });
          notification = sent;
          if (retry) effectFailed = true;
        } catch (error) {
          effectFailed = true;
          notification = { sent: false, reason: effectFailure(error) };
          try {
            await updateStripeEffect(convex, {
              webhookSecret,
              eventId: result.eventId || event.id,
              effect: "notification",
              status: "failed",
              error: effectFailure(error),
            });
          } catch {
            // Keep the effect pending if the durable status cannot be written.
          }
        }
      } else {
        if (claim.status === "sending") effectFailed = true;
        notification = { sent: false, reason: claim.status || "notification_in_progress" };
      }
    } catch (error) {
      effectFailed = true;
      notification = { sent: false, reason: effectFailure(error) };
    }
  }

  return Response.json(
    { received: true, status: result.status, refund, notification },
    { status: effectFailed ? 502 : 200 },
  );
}
