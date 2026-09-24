import assert from "node:assert/strict";
import {
  createStripeCheckoutSession,
  createStripeClientCheckoutSession,
  syncCreditNotesForRefundedCharge,
} from "../lib/stripe-server.mjs";
import { getMyInvoiceCheckout } from "../convex/account.js";

const env = {
  STRIPE_MODE: "test",
  STRIPE_SECRET_KEY: "sk_test_local",
  STRIPE_WEBHOOK_SECRET: "whsec_local",
  STRIPE_CHECKOUT_ENABLED: "true",
  STRIPE_WEBHOOK_ENABLED: "true",
};
const originalFetch = globalThis.fetch;
const requests = [];
function reply(value) { return { ok: true, json: async () => value }; }
globalThis.fetch = async (url, init = {}) => {
  requests.push({ url, init });
  if (url.endsWith("/checkout/sessions")) return reply({ id: "cs_test_invoice" });
  if (url.includes("/checkout/sessions?payment_intent=")) return reply({ data: [{ payment_intent: "pi_123", invoice: "in_123", invoice_creation: { enabled: true }, metadata: { userId: "user_123" } }] });
  if (url.includes("/refunds?charge=ch_123&limit=100")) return reply({ data: [{ id: "re_123", status: "succeeded", amount: 2800 }], has_more: false });
  if (url.includes("/credit_notes?")) return reply({ data: [], has_more: false });
  if (url.endsWith("/credit_notes")) return reply({ id: "cn_123" });
  throw new Error(`unexpected Stripe URL: ${url}`);
};
try {
  const common = { amountCents: 2800, productName: "Offre", description: "Description", customerEmail: "client@example.test", userId: "user_123", offerKey: "anglais", successUrl: "https://example.test/success", cancelUrl: "https://example.test/cancel", env };
  await createStripeCheckoutSession({ ...common, bookingId: "booking_123", mode: "solo" });
  await createStripeClientCheckoutSession({ ...common, requestId: "request_123", offerKey: "review" });
  for (const request of requests.slice(0, 2)) {
    const form = request.init.body;
    assert.equal(form.get("invoice_creation[enabled]"), "true");
    assert.equal(form.get("customer_creation"), "always");
    assert.equal(form.get("billing_address_collection"), "required");
    assert.equal(form.get("name_collection[business][enabled]"), "true");
    assert.equal(form.get("tax_id_collection[enabled]"), "true");
    assert.match(form.get("invoice_creation[invoice_data][footer]"), /293 B/);
    assert.equal(form.get("invoice_creation[invoice_data][custom_fields][0][value]"), "933 272 411 00010");
  }
  assert.equal(requests[0].init.body.get("invoice_creation[invoice_data][metadata][orderReference]"), "booking_123");
  assert.equal(requests[1].init.body.get("invoice_creation[invoice_data][metadata][orderReference]"), "request_123");

  const synced = await syncCreditNotesForRefundedCharge({ chargeId: "ch_123", paymentIntentId: "pi_123", env });
  assert.equal(synced.created, 1);
  const creditNote = requests.find((request) => request.url.endsWith("/credit_notes") && request.init.method === "POST");
  assert.equal(creditNote.init.body.get("refunds[0][refund]"), "re_123");
  assert.equal(creditNote.init.body.get("refunds[0][amount_refunded]"), "2800");
  assert.equal(creditNote.init.headers["Idempotency-Key"], "credit-note:re_123");

  const handler = getMyInvoiceCheckout._handler;
  const records = new Map([
    ["request_123", { _id: "request_123", clerkUserId: "user_123", tokenIdentifier: "token_123", paymentStatus: "paid", stripeCheckoutSessionId: "cs_test_invoice" }],
    ["entitlement_123", { _id: "entitlement_123", clerkUserId: "user_123", tokenIdentifier: "token_123", stripeCheckoutSessionId: "cs_test_invoice" }],
  ]);
  const ctx = { auth: { getUserIdentity: async () => ({ subject: "user_123", tokenIdentifier: "token_123" }) }, db: { get: async (id) => records.get(id) } };
  assert.deepEqual(await handler(ctx, { sessionUserId: "user_123", requestId: "request_123" }), { checkoutSessionId: "cs_test_invoice" });
  assert.deepEqual(await handler(ctx, { sessionUserId: "user_123", entitlementId: "entitlement_123" }), { checkoutSessionId: "cs_test_invoice" });
  await assert.rejects(() => handler(ctx, { sessionUserId: "another_user", requestId: "request_123" }), /FORBIDDEN/);
  records.set("request_123", { ...records.get("request_123"), clerkUserId: "another_user" });
  await assert.rejects(() => handler(ctx, { sessionUserId: "user_123", requestId: "request_123" }), /FORBIDDEN/);
  console.log("Stripe invoices, credit notes and owner access: PASS");
} finally {
  globalThis.fetch = originalFetch;
}
