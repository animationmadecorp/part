import { anyApi } from "convex/server";
import { getAuthFoundationConfig } from "@/lib/auth-config";
import {
  getAuthenticatedConvexClient,
  getClerkSession,
} from "@/lib/server-auth";
import { createStripeCheckoutSession, getStripeConfig } from "@/lib/stripe-server.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function matchesCreatedContract(session, proof, stripeMode) {
  const metadata = session?.metadata || {};
  return session?.mode === "payment" &&
    session?.livemode === (stripeMode === "live") &&
    session?.consent_collection?.terms_of_service === "required" &&
    metadata.contractProofId === proof?.id &&
    metadata.contractVersion === proof?.contractVersion;
}

function errorStatus(error) {
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("UNAUTHENTICATED:")) return 401;
  if (message.startsWith("FORBIDDEN:")) return 403;
  if (message.startsWith("HOLD_EXPIRED:")) return 409;
  if (message.startsWith("ALREADY_PAID:")) return 409;
  if (message.startsWith("INVALID_")) return 400;
  return Number.isInteger(error?.status) ? error.status : 502;
}

export async function POST(request) {
  const session = await getClerkSession();
  if (!session.authenticated) {
    return Response.json(
      { error: session.reason || "unauthenticated" },
      { status: session.reason === "unauthenticated" ? 401 : 503 },
    );
  }
  const convex = await getAuthenticatedConvexClient(session);
  if (!convex.ok) return Response.json({ error: convex.reason }, { status: 503 });
  const stripeConfig = getStripeConfig();
  if (!stripeConfig.checkoutEnabled || !stripeConfig.mode) {
    return Response.json({ error: "stripe_checkout_disabled" }, { status: 503 });
  }
  const serverSecret = process.env.BOOKING_WEBHOOK_SECRET;
  if (!serverSecret) return Response.json({ error: "checkout_configuration_required" }, { status: 503 });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body?.bookingId !== "string" || !body.bookingId) {
    return Response.json({ error: "booking_required" }, { status: 400 });
  }

  let payload;
  try {
    payload = await convex.client.query(anyApi.bookings.getCheckoutPayload, {
      bookingId: body.bookingId,
    });
  } catch (error) {
    return Response.json({ error: "booking_unavailable" }, { status: errorStatus(error) });
  }

  let contractProof;
  try {
    contractProof = await convex.client.mutation(anyApi.paymentContractProofs.prepare, {
      bookingId: payload.bookingId,
      stripeMode: stripeConfig.mode,
    });
  } catch (error) {
    return Response.json({ error: "checkout_contract_unavailable" }, { status: errorStatus(error) });
  }

  const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  let checkout;
  try {
    checkout = await createStripeCheckoutSession({
      amountCents: payload.amountCents,
      currency: payload.currency,
      productName: payload.name,
      description: payload.description,
      customerEmail: payload.customerEmail,
      bookingId: payload.bookingId,
      userId: payload.userId,
      offerKey: payload.offerKey,
      mode: payload.mode,
      expiresAt: payload.stripeExpiresAt,
      contractProofId: contractProof.id,
      contractVersion: contractProof.contractVersion,
      successUrl: `${origin}/nouveau/confirmation?bookingId=${encodeURIComponent(payload.bookingId)}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/nouveau/confirmation?bookingId=${encodeURIComponent(payload.bookingId)}&etat=annule`,
      idempotencyKey: `booking:${payload.bookingId}:contract:${contractProof.id}`,
    });
  } catch (error) {
    const retryable = error?.retryable === true;
    // A definite configuration or validation failure should not leave an
    // avoidable active hold. Network/5xx failures keep it so Stripe's stable
    // idempotency key can recover a session that may already exist remotely.
    if (!retryable) {
      try {
        await convex.client.mutation(anyApi.bookings.cancelHold, { bookingId: payload.bookingId });
      } catch {
        // The hold may have expired between the two calls; the server remains the authority.
      }
    }
    return Response.json(
      {
        error: error instanceof Error ? error.message : "stripe_unavailable",
        retryable,
        bookingId: payload.bookingId,
      },
      { status: errorStatus(error) },
    );
  }

  if (!checkout?.id || !checkout?.url) {
    try {
      await convex.client.mutation(anyApi.bookings.cancelHold, { bookingId: payload.bookingId });
    } catch {
      // The hold may have expired between the two calls.
    }
    return Response.json({ error: "stripe_session_missing_url", retryable: false }, { status: 502 });
  }
  if (!matchesCreatedContract(checkout, contractProof, stripeConfig.mode)) {
    try {
      await convex.client.mutation(anyApi.bookings.cancelHold, { bookingId: payload.bookingId });
    } catch {
      // The hold may have expired between the two calls.
    }
    return Response.json({ error: "stripe_session_contract_mismatch", retryable: false }, { status: 502 });
  }
  try {
    await convex.client.mutation(anyApi.bookings.attachCheckoutSession, {
      bookingId: payload.bookingId,
      checkoutSessionId: checkout.id,
    });
  } catch (error) {
    return Response.json({ error: "hold_could_not_be_attached", retryable: true }, { status: errorStatus(error) });
  }
  try {
    await convex.client.mutation(anyApi.paymentContractProofs.attachCheckoutSession, {
      proofId: contractProof.id,
      checkoutSessionId: checkout.id,
      attempt: 1,
      serverSecret,
    });
  } catch (error) {
    return Response.json({ error: "checkout_contract_not_attached", retryable: true }, { status: errorStatus(error) });
  }

  return Response.json({
    url: checkout.url,
    bookingId: payload.bookingId,
    holdExpiresAt: payload.holdExpiresAt,
  });
}
