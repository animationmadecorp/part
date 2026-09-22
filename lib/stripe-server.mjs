import { createHmac, timingSafeEqual } from "node:crypto";

const STRIPE_API = "https://api.stripe.com/v1";
export const STRIPE_CHECKOUT_CONSENT_TEXT =
  "J’accepte les CGV et, si l’exécution commence avant la fin du délai légal, je demande expressément ce commencement et reconnais la perte du droit de rétractation après exécution complète.";

function present(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function envFlag(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

export function getStripeConfig(env = process.env) {
  const secretKey = present(env.STRIPE_SECRET_KEY) ? env.STRIPE_SECRET_KEY.trim() : null;
  const webhookSecret = present(env.STRIPE_WEBHOOK_SECRET) ? env.STRIPE_WEBHOOK_SECRET.trim() : null;
  const requestedMode = present(env.STRIPE_MODE) ? env.STRIPE_MODE.trim().toLowerCase() : null;
  const modeExplicit = requestedMode === "test" || requestedMode === "live";
  const modeValueValid = !requestedMode || modeExplicit;
  const keyMode = secretKey?.startsWith("sk_test_")
    ? "test"
    : secretKey?.startsWith("sk_live_")
      ? "live"
      : null;
  const legacyTestCompatibility = modeValueValid && !modeExplicit &&
    !present(env.STRIPE_CHECKOUT_ENABLED) &&
    !present(env.STRIPE_WEBHOOK_ENABLED) &&
    (keyMode === "test" || (!secretKey && Boolean(webhookSecret)));
  const mode = modeExplicit
    ? requestedMode
    : (!requestedMode && (keyMode === "test" || legacyTestCompatibility) ? "test" : null);
  const modeMatchesKey = Boolean(
    mode && (keyMode ? keyMode === mode : legacyTestCompatibility),
  );
  const liveEnabled = envFlag(env.STRIPE_LIVE_ENABLED);
  const checkoutEnabled = Boolean(
    secretKey &&
    modeMatchesKey &&
    (mode === "test" ? (envFlag(env.STRIPE_CHECKOUT_ENABLED) || legacyTestCompatibility) :
      envFlag(env.STRIPE_CHECKOUT_ENABLED) && liveEnabled),
  );
  const webhookEnabled = Boolean(
    webhookSecret &&
    modeMatchesKey &&
    (mode === "test" ? (envFlag(env.STRIPE_WEBHOOK_ENABLED) || legacyTestCompatibility) :
      envFlag(env.STRIPE_WEBHOOK_ENABLED) && liveEnabled),
  );
  return {
    secretKey,
    webhookSecret,
    mode,
    modeExplicit,
    keyMode,
    modeMatchesKey,
    liveEnabled,
    checkoutEnabled,
    webhookEnabled,
    testMode: mode === "test",
    liveMode: mode === "live",
    configured: Boolean(secretKey && modeMatchesKey),
  };
}

function safeError(message, status = 502, { retryable = false, code } = {}) {
  const error = new Error(message);
  error.status = status;
  error.retryable = retryable;
  if (present(code)) error.code = code;
  return error;
}

function stripeHeaders(secretKey, idempotencyKey) {
  return {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
    ...(present(idempotencyKey) ? { "Idempotency-Key": idempotencyKey } : {}),
  };
}

async function stripeRequest(path, secretKey, form, { idempotencyKey } = {}) {
  let response;
  try {
    response = await fetch(`${STRIPE_API}${path}`, {
      method: "POST",
      headers: stripeHeaders(secretKey, idempotencyKey),
      body: form,
    });
  } catch (error) {
    throw safeError(error instanceof Error ? error.message : "Stripe request failed", 502, { retryable: true });
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const stripeCode = payload?.error?.code;
    throw safeError(payload?.error?.message || "Stripe request failed", response.status, {
      retryable: stripeCode === "idempotency_key_in_use" || response.status === 429 || response.status >= 500,
      code: stripeCode,
    });
  }
  return payload;
}

async function stripeGet(path, secretKey) {
  let response;
  try {
    response = await fetch(`${STRIPE_API}${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${secretKey}` },
    });
  } catch (error) {
    throw safeError(error instanceof Error ? error.message : "Stripe request failed", 502, { retryable: true });
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw safeError(payload?.error?.message || "Stripe request failed", response.status, {
      retryable: response.status === 429 || response.status >= 500,
    });
  }
  return payload;
}

function requireStripeCapability(env, capability, message) {
  const config = getStripeConfig(env);
  if (!config.secretKey || !config[capability]) throw safeError(message, 503);
  return config;
}

function addContractFields(form, { contractProofId, contractVersion } = {}) {
  if (!present(contractProofId)) return;
  if (!present(contractVersion)) throw safeError("Missing Stripe contract version", 500);
  if (contractProofId.length > 240 || contractVersion.length > 100) {
    throw safeError("Invalid Stripe contract metadata", 500);
  }
  form.set("metadata[contractProofId]", contractProofId);
  form.set("metadata[contractVersion]", contractVersion);
  form.set("payment_intent_data[metadata][contractProofId]", contractProofId);
  form.set("payment_intent_data[metadata][contractVersion]", contractVersion);
  // Stripe's required terms checkbox is the provider-side proof collection.
  // The durable acceptance is recorded only from the later Checkout event.
  form.set("consent_collection[terms_of_service]", "required");
  form.set("custom_text[terms_of_service_acceptance][message]", STRIPE_CHECKOUT_CONSENT_TEXT);
}

export async function createStripeCheckoutSession({
  amountCents,
  currency = "eur",
  productName,
  description,
  customerEmail,
  bookingId,
  userId,
  offerKey,
  mode,
  expiresAt,
  contractProofId,
  contractVersion,
  successUrl,
  cancelUrl,
  idempotencyKey,
  env = process.env,
}) {
  const { secretKey } = requireStripeCapability(env, "checkoutEnabled", "Stripe checkout configuration is closed");
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw safeError("Invalid Stripe amount", 500);
  if (!present(bookingId) || !present(userId)) throw safeError("Missing booking metadata", 500);

  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("line_items[0][price_data][currency]", currency);
  form.set("line_items[0][price_data][unit_amount]", String(amountCents));
  form.set("line_items[0][price_data][product_data][name]", productName);
  form.set("line_items[0][price_data][product_data][description]", description);
  form.set("line_items[0][quantity]", "1");
  form.set("customer_email", customerEmail);
  form.set("payment_method_types[0]", "card");
  form.set("success_url", successUrl);
  form.set("cancel_url", cancelUrl);
  form.set("client_reference_id", bookingId);
  form.set("metadata[bookingId]", bookingId);
  form.set("metadata[userId]", userId);
  form.set("metadata[offerKey]", offerKey);
  form.set("metadata[mode]", mode);
  form.set("payment_intent_data[metadata][bookingId]", bookingId);
  form.set("payment_intent_data[metadata][userId]", userId);
  form.set("payment_intent_data[metadata][offerKey]", offerKey);
  form.set("payment_intent_data[metadata][mode]", mode);
  addContractFields(form, { contractProofId, contractVersion });
  if (present(contractProofId)) {
    form.set("payment_intent_data[metadata][contractProofId]", contractProofId);
  }
  if (Number.isInteger(expiresAt)) {
    form.set("expires_at", String(Math.floor(expiresAt / 1000)));
  }
  return stripeRequest("/checkout/sessions", secretKey, form, { idempotencyKey });
}

export async function createStripeClientCheckoutSession({
  amountCents,
  currency = "eur",
  productName,
  description,
  customerEmail,
  requestId,
  userId,
  offerKey,
  attempt = 1,
  contractProofId,
  contractVersion,
  successUrl,
  cancelUrl,
  idempotencyKey,
  env = process.env,
}) {
  const { secretKey } = requireStripeCapability(env, "checkoutEnabled", "Stripe checkout configuration is closed");
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw safeError("Invalid Stripe amount", 500);
  if (!present(requestId) || !present(userId) || !present(offerKey)) throw safeError("Missing client request metadata", 500);
  if (!Number.isSafeInteger(attempt) || attempt < 1) throw safeError("Invalid client checkout attempt", 500);
  if (!present(successUrl) || !present(cancelUrl)) throw safeError("Missing Stripe return URL", 500);

  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("line_items[0][price_data][currency]", currency);
  form.set("line_items[0][price_data][unit_amount]", String(amountCents));
  form.set("line_items[0][price_data][product_data][name]", productName);
  form.set("line_items[0][price_data][product_data][description]", description);
  form.set("line_items[0][quantity]", "1");
  if (present(customerEmail)) form.set("customer_email", customerEmail);
  form.set("payment_method_types[0]", "card");
  form.set("success_url", successUrl);
  form.set("cancel_url", cancelUrl);
  form.set("client_reference_id", requestId);
  form.set("metadata[clientRequestId]", requestId);
  form.set("metadata[userId]", userId);
  form.set("metadata[offerKey]", offerKey);
  form.set("metadata[attempt]", String(attempt));
  form.set("payment_intent_data[metadata][clientRequestId]", requestId);
  form.set("payment_intent_data[metadata][userId]", userId);
  form.set("payment_intent_data[metadata][offerKey]", offerKey);
  form.set("payment_intent_data[metadata][attempt]", String(attempt));
  addContractFields(form, { contractProofId, contractVersion });
  return stripeRequest("/checkout/sessions", secretKey, form, { idempotencyKey });
}

export async function getStripeCheckoutSession(sessionId, env = process.env) {
  const { secretKey } = requireStripeCapability(env, "checkoutEnabled", "Stripe checkout configuration is closed");
  if (!present(sessionId) || sessionId.length > 200) throw safeError("Invalid Stripe checkout session", 400);
  return stripeGet(`/checkout/sessions/${encodeURIComponent(sessionId)}`, secretKey);
}

export async function getStripePaymentIntent(paymentIntentId, env = process.env) {
  const { secretKey } = requireStripeCapability(env, "webhookEnabled", "Stripe webhook configuration is closed");
  if (!present(paymentIntentId) || paymentIntentId.length > 200) throw safeError("Invalid Stripe payment intent", 400);
  return stripeGet(`/payment_intents/${encodeURIComponent(paymentIntentId)}`, secretKey);
}

export async function refundStripePaymentIntent(paymentIntentId, env = process.env, { idempotencyKey } = {}) {
  const config = getStripeConfig(env);
  if (!config.secretKey || !config.webhookEnabled) return { skipped: true, reason: "stripe_configuration_required" };
  const { secretKey } = config;
  if (!present(paymentIntentId)) return { skipped: true, reason: "payment_intent_missing" };
  const form = new URLSearchParams();
  form.set("payment_intent", paymentIntentId);
  return stripeRequest("/refunds", secretKey, form, { idempotencyKey });
}

function constantTimeHexEqual(left, right) {
  if (!/^[a-f0-9]+$/i.test(left) || !/^[a-f0-9]+$/i.test(right)) return false;
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyStripeSignature(rawBody, signatureHeader, webhookSecret, {
  toleranceSeconds = 300,
  nowSeconds = Math.floor(Date.now() / 1000),
} = {}) {
  if (!present(rawBody) || !present(signatureHeader) || !present(webhookSecret)) return false;
  const parts = signatureHeader.split(",").reduce((result, item) => {
    const [key, value] = item.split("=", 2);
    if (key && value) (result[key] ||= []).push(value);
    return result;
  }, {});
  const timestamp = Number(parts.t?.[0]);
  if (!Number.isInteger(timestamp) || Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;
  const expected = createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");
  return (parts.v1 || []).some((candidate) => constantTimeHexEqual(expected, candidate));
}

export function parseVerifiedStripeEvent(rawBody, signatureHeader, env = process.env, options) {
  const config = getStripeConfig(env);
  if (!config.webhookSecret || !config.webhookEnabled || !verifyStripeSignature(rawBody, signatureHeader, config.webhookSecret, options)) {
    throw safeError("Invalid Stripe webhook signature", 400);
  }
  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    throw safeError("Invalid Stripe webhook payload", 400);
  }
  if (!event?.id || !event?.type || !event?.data?.object) {
    throw safeError("Invalid Stripe webhook payload", 400);
  }
  const eventIsLive = event.livemode === true;
  if (!config.mode || eventIsLive !== (config.mode === "live")) {
    throw safeError("Invalid Stripe webhook payload: Stripe event mode does not match the configured mode", 400);
  }
  return event;
}
