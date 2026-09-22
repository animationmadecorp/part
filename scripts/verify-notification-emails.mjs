import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  claimClientRequestNotification,
  completeClientRequestNotification,
} from "../convex/clientNotifications.js";
import {
  clientRequestOfferKeys,
  escapeHtml,
  followUpUrl,
  renderBookingEmail,
  renderClientRequestEmail,
  renderDeliveryEmail,
  safeAppOrigin,
  safeDeliveryUrl,
} from "../convex/notificationTemplates.js";
import {
  canSendResendTo,
  clientRequestNotificationKey,
  sendBookingNotification,
  sendClientRequestNotification,
  sendDeliveryNotification,
} from "../lib/resend-server.mjs";

const appUrl = "https://preview.animation-made.test";
const enabledEnv = {
  RESEND_API_KEY: "re_test",
  RESEND_FROM_EMAIL: "made@example.test",
  RESEND_TEST_RECIPIENTS: "client@example.com",
  RESEND_SEND_ENABLED: "true",
  RESEND_SEND_MODE: "development",
  RESEND_APP_URL: appUrl,
};

assert.equal(safeAppOrigin("http://localhost:3010", { production: true }), null);
assert.equal(safeAppOrigin("http://example.test", { production: true }), null);
assert.equal(followUpUrl({ appOrigin: appUrl, production: true }), `${appUrl}/nouveau/bibliotheque?onglet=suivi`);
assert.equal(
  followUpUrl({ appOrigin: "javascript:alert(1)", production: false }),
  null,
  "tracking URLs must be http(s) origins",
);
for (const origin of [
  "http://[::1]:3010",
  "http://127.0.0.2:3010",
  "http://localhost.:3010",
  "http://foo.localhost:3010",
  "http://[::ffff:127.0.0.1]:3010",
  "http://[::ffff:7f00:1]:3010",
  "http://[0:0:0:0:0:ffff:7f00:1]:3010",
]) {
  assert.equal(safeAppOrigin(origin, { production: true }), null, `loopback origin rejected: ${origin}`);
}
assert.equal(safeDeliveryUrl("http://127.0.0.2:3010/file.pdf", { production: true }), null);
assert.equal(safeDeliveryUrl("http://files.example.test/file.pdf", { production: true }), null);
assert.equal(clientRequestNotificationKey("request_paid"), "client-request:request_paid:confirmation");
assert.equal(clientRequestNotificationKey("request_paid"), clientRequestNotificationKey("request_paid"), "different Stripe event types share the paid-order key");

for (const kind of ["confirmed", "reminder", "rescheduled"]) {
  const message = renderBookingEmail({
    kind,
    appOrigin: appUrl,
    booking: {
      date: "2026-09-24",
      time: "09:00",
      timezone: "Europe/Paris",
    },
  });
  assert.match(message.html, /<!doctype html>/i);
  assert.match(message.html, /name="viewport"/);
  assert.match(message.html, /Animation Made/);
  assert.match(message.html, /Accéder à mon suivi/);
  assert.match(message.text, /24 septembre 2026/);
  assert.notEqual(message.html, message.text);
}

const escaped = renderBookingEmail({
  kind: "reminder",
  appOrigin: appUrl,
  booking: { date: "<img src=x>", time: "09 & 00", timezone: "Europe/Paris" },
});
assert.match(escaped.html, /&lt;img src=x&gt;/);
assert.match(escaped.html, /09 &amp; 00/);
assert.doesNotMatch(escaped.html, /<img src=x>/);
assert.doesNotMatch(escaped.text, /demain/, "a late reminder must not assert that the lesson is tomorrow");
assert.match(renderBookingEmail({ kind: "rescheduled", appOrigin: appUrl, booking: { date: "2026-10-01", time: "14:00" } }).text, /animationmadecorp@gmail\.com/);

for (const offerKey of clientRequestOfferKeys()) {
  const message = renderClientRequestEmail({
    offerKey,
    priceCents: offerKey === "feedback" ? 3800 : 2800,
    currency: "eur",
    appOrigin: appUrl,
  });
  assert.ok(message, `${offerKey} has a confirmation model`);
  assert.match(message.html, /PAIEMENT CONFIRMÉ/);
  assert.match(message.text, /Total payé/);
}
assert.match(renderClientRequestEmail({ offerKey: "feedback", priceCents: 3800, appOrigin: appUrl }).html, /38,00 €/);
assert.equal(renderClientRequestEmail({ offerKey: "unknown", priceCents: 1, appOrigin: appUrl }), null);
const delivery = renderDeliveryEmail({ deliveryLabel: "PDF de synthèse", deliveryUrl: "https://files.animation-made.test/delivery.pdf" });
assert.match(delivery.html, /Ouvrir mon livrable/);
assert.match(delivery.text, /PDF de synthèse/);
const pendingDelivery = renderDeliveryEmail({ deliveryLabel: "PDF de synthèse", deliveryUrl: "http://localhost:3010/delivery.pdf", production: true });
assert.equal(pendingDelivery.sendable, false);
assert.equal(pendingDelivery.deliveryUrl, null);
assert.match(pendingDelivery.subject, /en préparation/);
assert.match(pendingDelivery.text, /Tu recevras un nouveau message/);
assert.doesNotMatch(pendingDelivery.html, /LIVRABLE DISPONIBLE|Ton livrable est prêt|contrat de livraison/);
const privateDelivery = renderDeliveryEmail({
  deliveryLabel: "PDF de synthèse",
  deliveryUrl: "https://private-storage.example.test/secret.pdf",
  available: true,
  appOrigin: appUrl,
  production: true,
});
assert.equal(privateDelivery.sendable, true);
assert.equal(privateDelivery.deliveryUrl, "https://private-storage.example.test/secret.pdf");
assert.match(privateDelivery.html, /private-storage\.example\.test\/secret\.pdf/);
const secureDelivery = renderDeliveryEmail({
  deliveryLabel: "PDF de synthèse",
  available: true,
  appOrigin: appUrl,
  production: true,
});
assert.equal(secureDelivery.sendable, true);
assert.equal(secureDelivery.deliveryUrl, null);
assert.match(secureDelivery.html, /Accéder à mon suivi/);
assert.doesNotMatch(secureDelivery.html, /storage|secret\.pdf/i);
assert.doesNotMatch(secureDelivery.text, /https:\/\/private-storage/);
const reviewDelivery = renderDeliveryEmail({
  deliveryLabel: "Ta review d’animation",
  available: true,
  appOrigin: appUrl,
  production: true,
});
assert.match(reviewDelivery.html, /Ta review d’animation est prête à être consultée/);
assert.doesNotMatch(reviewDelivery.html, /Ta review d’animation est prêt à être consulté/);

assert.equal(canSendResendTo("client@example.com", enabledEnv), true);
assert.equal(canSendResendTo("other@example.com", enabledEnv), false);

const requests = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (_url, options) => {
  requests.push({ body: JSON.parse(String(options.body)), idempotencyKey: options.headers["Idempotency-Key"] });
  return new Response(JSON.stringify({ id: `email_${requests.length}` }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
try {
  const booking = { email: "Client@Example.com", date: "2026-09-24", time: "09:00", timezone: "Europe/Paris" };
  await sendBookingNotification({ kind: "confirmed", booking, idempotencyKey: "booking:event-1:notification", env: enabledEnv });
  await sendBookingNotification({ kind: "confirmed", booking, idempotencyKey: "booking:event-1:notification", env: enabledEnv });
  await sendClientRequestNotification({
    request: { email: "client@example.com", offerKey: "feedback", priceCents: 3800, currency: "eur" },
    idempotencyKey: "client-request:event-2:notification",
    env: enabledEnv,
  });
  await sendDeliveryNotification({
    recipient: "client@example.com",
    kind: "pdf",
    deliveryLabel: "Ton PDF personnalisé",
    idempotencyKey: "delivery:request-paid:pdf:file-1",
    env: enabledEnv,
  });
  assert.equal(requests.length, 4);
  assert.equal(requests[0].body.html.startsWith("<!doctype html>"), true);
  assert.equal(requests[0].body.text.includes("24 septembre 2026"), true);
  assert.equal(requests[0].body.reply_to, "animationmadecorp@gmail.com");
  assert.deepEqual(requests[0].body, requests[1].body, "retry keeps HTML and text stable");
  assert.equal(requests[0].idempotencyKey, requests[1].idempotencyKey);
  assert.match(requests[2].body.html, /38,00 €/);
  assert.match(requests[3].body.html, /LIVRABLE DISPONIBLE/);
  assert.match(requests[3].body.text, /Ton PDF personnalisé/);
  assert.doesNotMatch(requests[3].body.html, /private-storage|storage\.example|secret\.pdf/i);

const beforeDisabled = requests.length;
const disabled = await sendBookingNotification({
  booking: { email: "client@example.com", date: "2026-09-24", time: "09:00" },
  env: { ...enabledEnv, RESEND_SEND_ENABLED: "false" },
});
assert.deepEqual(disabled, { sent: false, reason: "resend_send_disabled" });
assert.equal(requests.length, beforeDisabled, "disabled mode never calls Resend");

const notAllowed = await sendClientRequestNotification({
  request: { email: "other@example.com", offerKey: "feedback", priceCents: 3800 },
  env: enabledEnv,
});
assert.deepEqual(notAllowed, { sent: false, reason: "recipient_not_allowlisted" });
assert.equal(requests.length, beforeDisabled, "non-allowlisted recipients never call Resend");

const previousWebhookSecret = process.env.BOOKING_WEBHOOK_SECRET;
process.env.BOOKING_WEBHOOK_SECRET = "secret-test";
const notificationState = {
  clientRequests: [{
    _id: "request-paid",
    email: "client@example.com",
    offerKey: "feedback",
    priceCents: 3800,
    currency: "eur",
    status: "paid",
    paymentStatus: "paid",
  }],
  clientRequestEvents: [],
};
const notificationContext = {
  db: {
    get: async (id) => Object.values(notificationState).flat().find((row) => row?._id === id) || null,
    insert: async (table, value) => {
      const id = `${table}-${notificationState[table].length + 1}`;
      notificationState[table].push({ ...value, _id: id });
      return id;
    },
    patch: async (id, value) => {
      const row = Object.values(notificationState).flat().find((candidate) => candidate?._id === id);
      Object.assign(row, value);
    },
    query: (table) => ({
      withIndex: (_index, callback) => {
        let field;
        let expected;
        callback({ eq: (nextField, nextValue) => { field = nextField; expected = nextValue; } });
        const rows = () => (notificationState[table] || []).filter((row) => row[field] === expected);
        return { collect: async () => rows(), first: async () => rows()[0] || null };
      },
    }),
  },
};
const notificationHandlers = {
  claim: claimClientRequestNotification._handler,
  complete: completeClientRequestNotification._handler,
};
try {
  const key = clientRequestNotificationKey("request-paid");
  const firstClaim = await notificationHandlers.claim(notificationContext, {
    webhookSecret: "secret-test",
    requestId: "request-paid",
    idempotencyKey: key,
  });
  assert.equal(firstClaim.claimed, true);
  assert.match(firstClaim.attemptId, /:attempt:/);
  assert.equal(firstClaim.request.email, "client@example.com", "recipient comes from the paid server dossier");
  await notificationHandlers.complete(notificationContext, {
    webhookSecret: "secret-test",
    requestId: "request-paid",
    idempotencyKey: key,
    attemptId: firstClaim.attemptId,
    status: "failed",
    error: "recipient_missing on the first event payload",
  });
  const retryClaim = await notificationHandlers.claim(notificationContext, {
    webhookSecret: "secret-test",
    requestId: "request-paid",
    idempotencyKey: key,
  });
  assert.equal(retryClaim.claimed, true, "a failed first notification remains retryable");
  const staleCompletion = await notificationHandlers.complete(notificationContext, {
    webhookSecret: "secret-test",
    requestId: "request-paid",
    idempotencyKey: key,
    attemptId: firstClaim.attemptId,
    status: "failed",
  });
  assert.deepEqual(staleCompletion, { ok: false, status: "stale_claim" }, "a late completion cannot invalidate a newer claim");
  await notificationHandlers.complete(notificationContext, {
    webhookSecret: "secret-test",
    requestId: "request-paid",
    idempotencyKey: key,
    attemptId: retryClaim.attemptId,
    status: "sent",
  });
  const replayClaim = await notificationHandlers.claim(notificationContext, {
    webhookSecret: "secret-test",
    requestId: "request-paid",
    idempotencyKey: key,
  });
  assert.deepEqual(replayClaim, { claimed: false, status: "sent" }, "a second Stripe event cannot resend the paid order");
  notificationState.clientRequests[0].status = "refunded";
  notificationState.clientRequests[0].paymentStatus = "refunded";
  const refundedClaim = await notificationHandlers.claim(notificationContext, {
    webhookSecret: "secret-test",
    requestId: "request-paid",
    idempotencyKey: key,
  });
  assert.deepEqual(refundedClaim, { claimed: false, status: "not_paid" }, "a replay after refund cannot send confirmation");
} finally {
  if (previousWebhookSecret === undefined) delete process.env.BOOKING_WEBHOOK_SECRET;
  else process.env.BOOKING_WEBHOOK_SECRET = previousWebhookSecret;
}

const productionDisabled = await sendBookingNotification({
  booking: { email: "client@example.com", date: "2026-09-24", time: "09:00" },
  env: { ...enabledEnv, NODE_ENV: "production", RESEND_SEND_MODE: "development", RESEND_PRODUCTION_SEND_ENABLED: "false" },
});
assert.deepEqual(productionDisabled, { sent: true, id: "email_5" }, "NODE_ENV alone does not change the explicit development mode");
assert.equal(requests.length, beforeDisabled + 1, "the development allow-list remains the only gate in development mode");
const explicitProductionDisabled = await sendDeliveryNotification({
  recipient: "other@example.com",
  kind: "review",
  env: { ...enabledEnv, RESEND_SEND_MODE: "production", RESEND_PRODUCTION_SEND_ENABLED: "false" },
});
assert.deepEqual(explicitProductionDisabled, { sent: false, reason: "resend_send_disabled" });
assert.equal(requests.length, beforeDisabled + 1, "production requires both explicit opt-ins");
const explicitProduction = await sendDeliveryNotification({
  recipient: "other@example.com",
  kind: "review",
  deliveryLabel: "Ta review d’animation",
  idempotencyKey: "delivery:request-paid:review:snapshot-1",
  env: { ...enabledEnv, RESEND_SEND_MODE: "production", RESEND_PRODUCTION_SEND_ENABLED: "true" },
});
assert.deepEqual(explicitProduction, { sent: true, id: "email_6" }, "production mode may send real recipients only after both explicit opt-ins");
assert.equal(requests.length, beforeDisabled + 2);
} finally {
  globalThis.fetch = originalFetch;
}

const [resendServer, templates, stripeWebhook, notificationRoute, bookings, clientNotifications, preview] = await Promise.all([
  readFile(new URL("../lib/resend-server.mjs", import.meta.url), "utf8"),
  readFile(new URL("../convex/notificationTemplates.js", import.meta.url), "utf8"),
  readFile(new URL("../app/api/stripe/webhook/route.js", import.meta.url), "utf8"),
  readFile(new URL("../app/api/booking/notification/route.js", import.meta.url), "utf8"),
  readFile(new URL("../convex/bookings.js", import.meta.url), "utf8"),
  readFile(new URL("../convex/clientNotifications.js", import.meta.url), "utf8"),
  readFile(new URL("../docs/notification-email-preview.html", import.meta.url), "utf8"),
]);
assert.match(resendServer, /html: message\.html/);
assert.match(resendServer, /reply_to: config\.replyTo/);
assert.match(resendServer, /sendClientRequestNotification/);
assert.match(templates, /escapeHtml/);
assert.match(templates, /name="viewport/);
assert.match(templates, /style=/);
assert.match(templates, /Georgia/);
assert.match(templates, /#fca900/);
assert.doesNotMatch(templates, /display:flex/);
assert.match(stripeWebhook, /sendClientRequestNotification/);
assert.match(stripeWebhook, /clientNotifications\.claimClientRequestNotification/);
assert.match(stripeWebhook, /\["paid", "already_paid"\]/);
assert.match(stripeWebhook, /claim\?\.claimed && claim\.attemptId/);
assert.match(notificationRoute, /isRetryableResendReason/);
assert.match(bookings, /html: message\.html/);
assert.match(bookings, /resend_configuration_required/);
assert.match(bookings, /\["sent", "skipped"\]/);
assert.match(clientNotifications, /client_confirmation_email/);
assert.match(clientNotifications, /request\.email/);
assert.match(clientNotifications, /stale_claim/);
assert.match(preview, /data-generated-from="convex\/notificationTemplates\.js"/);
const previewConfirmation = renderBookingEmail({
  kind: "confirmed",
  appOrigin: appUrl,
  booking: { date: "2026-09-24", time: "09:00", timezone: "Europe/Paris" },
});
assert.ok(preview.includes(escapeHtml(previewConfirmation.html)), "preview embeds the current renderer output");
assert.match(preview, /24 septembre 2026/);
assert.match(preview, /Livraison PDF/);
assert.match(preview, /Livraison review/);
assert.match(preview, /Aucun lien de fichier privé/);

console.log("notification email templates, escape rules and send gates: PASS");
