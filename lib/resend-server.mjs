import {
  renderBookingEmail,
  renderClientRequestEmail,
  renderDeliveryEmail,
  safeAppOrigin,
} from "../convex/notificationTemplates.js";

const RESEND_API = "https://api.resend.com/emails";
export const RESEND_IDEMPOTENCY_SAFETY_MARGIN_MS = 30 * 1000;
const RESEND_FETCH_TIMEOUT_MS = 30 * 1000;
const RETRYABLE_REASONS = new Set([
  "resend_configuration_required",
  "resend_send_disabled",
  "notification_failed",
  "recipient_missing",
]);

function present(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeRecipient(value) {
  return present(value) ? value.trim().toLowerCase() : null;
}

export function getResendConfig(env = process.env) {
  const recipients = present(env.RESEND_TEST_RECIPIENTS)
    ? env.RESEND_TEST_RECIPIENTS.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean)
    : [];
  // The send mode is intentionally explicit. Convex actions do not always
  // expose the same NODE_ENV value as the web process, so NODE_ENV alone must
  // never unlock real recipients.
  const mode = env.RESEND_SEND_MODE === "production" ? "production" : "development";
  const production = mode === "production";
  const productionEnabled = env.RESEND_PRODUCTION_SEND_ENABLED === "true";
  return {
    apiKey: present(env.RESEND_API_KEY) ? env.RESEND_API_KEY.trim() : null,
    from: present(env.RESEND_FROM_EMAIL) ? env.RESEND_FROM_EMAIL.trim() : null,
    replyTo: present(env.RESEND_REPLY_TO_EMAIL)
      ? env.RESEND_REPLY_TO_EMAIL.trim()
      : "animationmadecorp@gmail.com",
    appUrl: present(env.RESEND_APP_URL)
      ? env.RESEND_APP_URL.trim()
      : present(env.NEXT_PUBLIC_APP_URL)
        ? env.NEXT_PUBLIC_APP_URL.trim()
        : null,
    recipients,
    mode,
    production,
    productionEnabled,
    allowlistRequired: !production,
    // Development/test sends remain explicitly gated by the allow-list. A
    // production process needs a second, separately named opt-in as well.
    enabled: env.RESEND_SEND_ENABLED === "true" && (!production || productionEnabled),
  };
}

export function canSendResendTo(recipient, env = process.env) {
  const config = getResendConfig(env);
  return Boolean(
      config.enabled &&
      config.apiKey &&
      config.from &&
      present(recipient) &&
      (!config.production || safeAppOrigin(config.appUrl, { production: true })) &&
      (!config.allowlistRequired || config.recipients.includes(recipient.trim().toLowerCase())),
  );
}

export function isRetryableResendReason(reason) {
  return RETRYABLE_REASONS.has(reason);
}

export function clientRequestNotificationKey(requestId) {
  return typeof requestId === "string" && requestId
    ? `client-request:${requestId}:confirmation`
    : null;
}

function unavailableReason({ config, recipient }) {
  if (!config.apiKey || !config.from || !safeAppOrigin(config.appUrl, { production: config.production })) {
    return "resend_configuration_required";
  }
  if (!config.enabled) return "resend_send_disabled";
  if (!present(recipient)) return "recipient_missing";
  if (config.allowlistRequired && !config.recipients.includes(recipient.trim().toLowerCase())) {
    return "recipient_not_allowlisted";
  }
  return null;
}

async function sendRenderedMessage({
  recipient,
  message,
  idempotencyKey,
  providerPayload,
  idempotencyExpiresAt,
  env = process.env,
}) {
  const config = getResendConfig(env);
  const effectiveRecipient = normalizeRecipient(providerPayload?.recipient || recipient);
  const reason = unavailableReason({ config, recipient: effectiveRecipient });
  if (reason) return { sent: false, reason };
  const hasIdempotencyDeadline = Number.isFinite(idempotencyExpiresAt);
  const remainingWindowMs = hasIdempotencyDeadline
    ? Math.min(
        RESEND_FETCH_TIMEOUT_MS,
        idempotencyExpiresAt - Date.now() - RESEND_IDEMPOTENCY_SAFETY_MARGIN_MS,
      )
    : RESEND_FETCH_TIMEOUT_MS;
  if (remainingWindowMs <= 0) return { sent: false, reason: "idempotency_window_expired" };
  const body = providerPayload
    ? {
        from: providerPayload.from,
        to: [providerPayload.recipient],
        reply_to: providerPayload.replyTo,
        subject: providerPayload.subject,
        text: providerPayload.text,
        html: providerPayload.html,
      }
    : {
        from: config.from,
        to: [effectiveRecipient],
        reply_to: config.replyTo,
        subject: message.subject,
        text: message.text,
        html: message.html,
      };

  const controller = new AbortController();
  if (
    hasIdempotencyDeadline &&
    idempotencyExpiresAt <= Date.now() + RESEND_IDEMPOTENCY_SAFETY_MARGIN_MS
  ) {
    return { sent: false, reason: "idempotency_window_expired" };
  }
  const timeout = setTimeout(() => controller.abort(), remainingWindowMs);
  let response;
  let payload;
  try {
    response = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        ...(present(idempotencyKey) ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    try {
      payload = await response.json();
    } catch (error) {
      if (controller.signal.aborted) throw error;
      payload = null;
    }
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    const error = new Error(payload?.message || "Resend request failed");
    error.status = response.status;
    throw error;
  }
  return { sent: true, id: payload?.id || null };
}

export async function sendBookingNotification({ kind = "confirmed", booking, idempotencyKey, env = process.env }) {
  const recipient = present(booking?.email) ? booking.email.trim().toLowerCase() : null;
  const config = getResendConfig(env);
  const appOrigin = safeAppOrigin(config.appUrl, { production: config.production });
  const message = renderBookingEmail({
    kind,
    booking,
    appOrigin,
    production: config.production,
  });
  return sendRenderedMessage({ recipient, message, idempotencyKey, env });
}

export async function sendClientRequestNotification({ request, idempotencyKey, env = process.env }) {
  const recipient = present(request?.email) ? request.email.trim().toLowerCase() : null;
  const config = getResendConfig(env);
  const appOrigin = safeAppOrigin(config.appUrl, { production: config.production });
  const message = renderClientRequestEmail({
    offerKey: request?.offerKey,
    priceCents: request?.priceCents,
    currency: request?.currency,
    appOrigin,
    production: config.production,
  });
  if (!message) return { sent: false, reason: "unknown_offer" };
  return sendRenderedMessage({ recipient, message, idempotencyKey, env });
}

export function prepareDeliveryNotification({
  recipient,
  kind,
  deliveryLabel,
  followUpPath,
  env = process.env,
}) {
  const config = getResendConfig(env);
  const normalizedRecipient = normalizeRecipient(recipient);
  const reason = unavailableReason({ config, recipient: normalizedRecipient });
  if (reason) return { ready: false, reason };
  const appOrigin = safeAppOrigin(config.appUrl, { production: config.production });
  const label = present(deliveryLabel)
    ? deliveryLabel.trim()
    : kind === "review"
      ? "Ta review d’animation"
      : "Ton PDF personnalisé";
  const message = renderDeliveryEmail({
    deliveryLabel: label,
    // The email must not carry a storage URL. The client library/proxy can
    // expose the private file after the buyer follows the authenticated path.
    deliveryUrl: null,
    available: true,
    followUpPath,
    appOrigin,
    production: config.production,
  });
  return {
    ready: true,
    providerPayload: {
      recipient: normalizedRecipient,
      from: config.from,
      replyTo: config.replyTo,
      subject: message.subject,
      text: message.text,
      html: message.html,
    },
  };
}

export async function sendDeliveryNotification({
  recipient,
  kind,
  deliveryLabel,
  followUpPath,
  idempotencyKey,
  providerPayload,
  idempotencyExpiresAt,
  env = process.env,
}) {
  if (providerPayload) {
    return sendRenderedMessage({ recipient, providerPayload, idempotencyKey, idempotencyExpiresAt, env });
  }
  const prepared = prepareDeliveryNotification({ recipient, kind, deliveryLabel, followUpPath, env });
  if (!prepared.ready) return { sent: false, reason: prepared.reason };
  return sendRenderedMessage({
    recipient: prepared.providerPayload.recipient,
    providerPayload: prepared.providerPayload,
    idempotencyKey,
    idempotencyExpiresAt,
    env,
  });
}
