import { anyApi } from "convex/server";
import { getAuthenticatedConvexClient, getClerkSession } from "@/lib/server-auth";
import {
  createStripeClientCheckoutSession,
  getStripeCheckoutSession,
  getStripeConfig,
} from "@/lib/stripe-server.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorStatus(error) {
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("UNAUTHENTICATED:")) return 401;
  if (message.startsWith("FORBIDDEN:")) return 403;
  if (["ALREADY_PAID:", "INVALID_STATE:", "IDEMPOTENCY_MISMATCH:", "CHECKOUT_IN_PROGRESS:"].some((code) => message.startsWith(code))) return 409;
  if (["INVALID_INPUT:", "INVALID_OFFER:", "PAYMENT_MISMATCH:"].some((code) => message.startsWith(code))) return 400;
  return Number.isInteger(error?.status) ? error.status : 502;
}

function appOrigin(request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  try {
    return new URL(configured || request.url).origin;
  } catch {
    return new URL(request.url).origin;
  }
}

function isMissingStripeSession(error) {
  return Number(error?.status) === 404;
}

function matchesClientCheckoutBase(payload, session) {
  const metadata = session?.metadata || {};
  return session?.mode === "payment" &&
    metadata.clientRequestId === payload.requestId &&
    metadata.userId === payload.userId &&
    metadata.offerKey === payload.offerKey &&
    String(session.currency || "").toLowerCase() === String(payload.currency || "").toLowerCase() &&
    Number(session.amount_total) === Number(payload.amountCents);
}

function hasRequiredCheckoutConsent(session) {
  return session?.consent_collection?.terms_of_service === "required";
}

function matchesClientCheckout(payload, session, proof, stripeMode) {
  const metadata = session?.metadata || {};
  return matchesClientCheckoutBase(payload, session) &&
    session?.livemode === (stripeMode === "live") &&
    hasRequiredCheckoutConsent(session) &&
    metadata.contractProofId === proof?.id &&
    metadata.contractVersion === proof?.contractVersion;
}

function matchesCreatedContract(session, proof, stripeMode) {
  const metadata = session?.metadata || {};
  return session?.mode === "payment" &&
    session?.livemode === (stripeMode === "live") &&
    hasRequiredCheckoutConsent(session) &&
    metadata.contractProofId === proof?.id &&
    metadata.contractVersion === proof?.contractVersion;
}

async function releaseUnattachedFeedbackCheckout(convex, payload, serverSecret) {
  if (payload?.offerKey !== "feedback" || payload.checkoutSessionId) return;
  try {
    await convex.client.mutation(anyApi.clientRequests.releaseCheckout, {
      requestId: payload.requestId,
      attempt: Number(payload.checkoutPreparationAttempt ?? (Number(payload.checkoutAttempt || 0) + 1)),
      serverSecret,
    });
  } catch {
    // Keep the original checkout error; a subsequent retry can reconcile the dossier.
  }
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

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body?.requestId !== "string" || !body.requestId) {
    return Response.json({ error: "request_required" }, { status: 400 });
  }
  const serverSecret = process.env.BOOKING_WEBHOOK_SECRET;
  if (!serverSecret) return Response.json({ error: "checkout_configuration_required" }, { status: 503 });

  let payload;
  try {
    payload = await convex.client.mutation(anyApi.clientRequests.prepareCheckout, {
      requestId: body.requestId,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "request_unavailable" }, { status: errorStatus(error) });
  }

  let contractProof;
  try {
    contractProof = await convex.client.mutation(anyApi.paymentContractProofs.prepare, {
      requestId: payload.requestId,
      stripeMode: stripeConfig.mode,
      ...(payload.checkoutSessionId ? { currentCheckoutSessionId: payload.checkoutSessionId } : {}),
    });
  } catch (error) {
    await releaseUnattachedFeedbackCheckout(convex, payload, serverSecret);
    return Response.json({ error: "checkout_contract_unavailable" }, { status: errorStatus(error) });
  }

  const origin = appOrigin(request);
  if (payload.checkoutSessionId) {
    try {
      const existing = await getStripeCheckoutSession(payload.checkoutSessionId);
      const baseMatches = matchesClientCheckoutBase(payload, existing);
      if (matchesClientCheckout(payload, existing, contractProof, stripeConfig.mode) && existing?.status === "open" && existing?.url) {
        try {
          await convex.client.mutation(anyApi.paymentContractProofs.attachCheckoutSession, {
            proofId: contractProof.id,
            checkoutSessionId: payload.checkoutSessionId,
            attempt: Math.max(1, Number(payload.checkoutAttempt || 1)),
            serverSecret,
          });
        } catch {
          return Response.json({ error: "checkout_contract_not_attached", retryable: true }, { status: 502 });
        }
        return Response.json({ url: existing.url, requestId: payload.requestId, reused: true });
      }
      if (baseMatches && existing?.status === "complete") {
        return Response.json(
          { error: "checkout_requires_reconciliation", retryable: false, requestId: payload.requestId },
          { status: 409 },
        );
      }
      // A session created before the contract proof existed must never be
      // reused. A same-source open session can be replaced with a new
      // contract-bound attempt; an unrelated session remains an error.
      if (!baseMatches && existing?.status !== "expired") {
        return Response.json({ error: "stripe_session_unusable", retryable: true }, { status: 502 });
      }
    } catch (error) {
      if (!isMissingStripeSession(error)) {
        return Response.json(
          {
            error: error instanceof Error ? error.message : "stripe_unavailable",
            retryable: error?.retryable === true,
            requestId: payload.requestId,
          },
          { status: errorStatus(error) },
        );
      }
      // A deleted or already-expired Stripe session can be replaced with a
      // fresh attempt; the server-side attempt counter prevents stale
      // responses from overwriting a newer attachment.
    }
  }

  const attempt = Number(payload.checkoutSessionId
    ? Number(payload.checkoutAttempt || 0) + 1
    : (payload.checkoutPreparationAttempt ?? (Number(payload.checkoutAttempt || 0) + 1)));
  if (!Number.isSafeInteger(attempt) || attempt < 1) {
    await releaseUnattachedFeedbackCheckout(convex, payload, serverSecret);
    return Response.json({ error: "invalid_checkout_attempt", retryable: false }, { status: 500 });
  }
  let checkout;
  try {
    checkout = await createStripeClientCheckoutSession({
      amountCents: payload.amountCents,
      currency: payload.currency,
      productName: payload.name,
      description: payload.description,
      customerEmail: payload.customerEmail,
      requestId: payload.requestId,
      userId: payload.userId,
      offerKey: payload.offerKey,
      attempt,
      contractProofId: contractProof.id,
      contractVersion: contractProof.contractVersion,
      successUrl: `${origin}/nouveau/confirmation?requestId=${encodeURIComponent(payload.requestId)}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/nouveau/confirmation?requestId=${encodeURIComponent(payload.requestId)}&etat=annule`,
      idempotencyKey: `client-request:${payload.requestId}:${attempt}:contract:${contractProof.id}`,
    });
  } catch (error) {
    if (error?.retryable !== true) {
      await releaseUnattachedFeedbackCheckout(convex, payload, serverSecret);
    }
    return Response.json(
      {
        error: error instanceof Error ? error.message : "stripe_unavailable",
        retryable: error?.retryable === true,
        requestId: payload.requestId,
      },
      { status: errorStatus(error) },
    );
  }

  if (!checkout?.id || !checkout?.url) {
    return Response.json({ error: "stripe_session_missing_url", retryable: false }, { status: 502 });
  }
  if (!matchesCreatedContract(checkout, contractProof, stripeConfig.mode)) {
    return Response.json({ error: "stripe_session_contract_mismatch", retryable: false }, { status: 502 });
  }
  try {
    await convex.client.mutation(anyApi.clientRequests.attachCheckoutSession, {
      requestId: payload.requestId,
      checkoutSessionId: checkout.id,
      attempt,
      serverSecret,
    });
  } catch (error) {
    return Response.json({ error: "request_checkout_not_attached", retryable: true }, { status: errorStatus(error) });
  }
  try {
    await convex.client.mutation(anyApi.paymentContractProofs.attachCheckoutSession, {
      proofId: contractProof.id,
      checkoutSessionId: checkout.id,
      attempt,
      serverSecret,
    });
  } catch (error) {
    return Response.json({ error: "checkout_contract_not_attached", retryable: true }, { status: errorStatus(error) });
  }

  return Response.json({ url: checkout.url, requestId: payload.requestId });
}
