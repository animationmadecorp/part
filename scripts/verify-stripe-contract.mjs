import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { register } from "node:module";

import {
  createStripeCheckoutSession,
  createStripeClientCheckoutSession,
  getStripeConfig,
  parseVerifiedStripeEvent,
  STRIPE_CHECKOUT_CONSENT_TEXT,
} from "../lib/stripe-server.mjs";
import {
  CHECKOUT_CONTRACT_VERSION,
  CHECKOUT_CONSENT_TEXT,
  attachCheckoutSession,
  getMyProof,
  prepare,
  recordStripeConsent,
} from "../convex/paymentContractProofs.js";

register("./resolve-convex-imports.mjs", import.meta.url);
const { attachCheckoutSession: attachClientCheckoutSession } = await import("../convex/clientRequests.js");

assert.equal(STRIPE_CHECKOUT_CONSENT_TEXT, CHECKOUT_CONSENT_TEXT, "Stripe and Convex must share one consent sentence");

const closedTestEnv = {
  STRIPE_MODE: "test",
  STRIPE_SECRET_KEY: "sk_test_fixed",
  STRIPE_WEBHOOK_SECRET: "whsec_test",
  STRIPE_CHECKOUT_ENABLED: "false",
  STRIPE_WEBHOOK_ENABLED: "false",
  STRIPE_LIVE_ENABLED: "false",
};
assert.equal(getStripeConfig(closedTestEnv).checkoutEnabled, false, "test Checkout is closed by default");
assert.equal(getStripeConfig(closedTestEnv).webhookEnabled, false, "test webhook is closed by default");
assert.equal(getStripeConfig({ ...closedTestEnv, STRIPE_CHECKOUT_ENABLED: "true" }).checkoutEnabled, true);
assert.equal(getStripeConfig({ ...closedTestEnv, STRIPE_WEBHOOK_ENABLED: "true" }).webhookEnabled, true);
assert.equal(
  getStripeConfig({
    STRIPE_MODE: "live",
    STRIPE_SECRET_KEY: "sk_live_fixed",
    STRIPE_WEBHOOK_SECRET: "whsec_live",
    STRIPE_CHECKOUT_ENABLED: "true",
    STRIPE_WEBHOOK_ENABLED: "true",
    STRIPE_LIVE_ENABLED: "false",
  }).configured,
  true,
  "live mode is explicit before the provider-side opt-in gates are evaluated",
);
const liveClosed = getStripeConfig({
  STRIPE_MODE: "live",
  STRIPE_SECRET_KEY: "sk_live_fixed",
  STRIPE_WEBHOOK_SECRET: "whsec_live",
  STRIPE_CHECKOUT_ENABLED: "true",
  STRIPE_WEBHOOK_ENABLED: "true",
  STRIPE_LIVE_ENABLED: "false",
});
assert.equal(liveClosed.checkoutEnabled, false, "live Checkout needs the explicit live opt-in");
assert.equal(liveClosed.webhookEnabled, false, "live webhooks need the explicit live opt-in");
const liveEnv = {
  STRIPE_MODE: "live",
  STRIPE_SECRET_KEY: "sk_live_fixed",
  STRIPE_WEBHOOK_SECRET: "whsec_live",
  STRIPE_CHECKOUT_ENABLED: "true",
  STRIPE_WEBHOOK_ENABLED: "true",
  STRIPE_LIVE_ENABLED: "true",
};
const liveOpen = getStripeConfig(liveEnv);
assert.equal(liveOpen.checkoutEnabled, true);
assert.equal(liveOpen.webhookEnabled, true);
assert.equal(
  getStripeConfig({ ...closedTestEnv, STRIPE_MODE: "live" }).modeMatchesKey,
  false,
  "a test key cannot be used under the live mode declaration",
);
assert.equal(
  getStripeConfig({ STRIPE_MODE: "staging", STRIPE_SECRET_KEY: "sk_test_fixed" }).configured,
  false,
  "unknown Stripe modes are closed",
);

function signedHeader(body, secret, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`, "utf8").digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

const testEvent = JSON.stringify({
  id: "evt_test_contract",
  type: "checkout.session.completed",
  livemode: false,
  created: 1_800_000_000,
  data: { object: { id: "cs_test_contract" } },
});
assert.equal(
  parseVerifiedStripeEvent(
    testEvent,
    signedHeader(testEvent, "whsec_test"),
    { ...closedTestEnv, STRIPE_WEBHOOK_ENABLED: "true" },
  ).id,
  "evt_test_contract",
  "raw signed test Checkout payloads are accepted only when the webhook gate is open",
);
assert.throws(
  () => parseVerifiedStripeEvent(testEvent, signedHeader(testEvent, "whsec_test"), closedTestEnv),
  /Invalid Stripe webhook signature/,
  "closed test webhooks do not process events",
);
const liveEvent = JSON.stringify({
  id: "evt_live_contract",
  type: "checkout.session.completed",
  livemode: true,
  created: 1_800_000_000,
  data: { object: { id: "cs_live_contract" } },
});
assert.throws(
  () => parseVerifiedStripeEvent(
    liveEvent,
    signedHeader(liveEvent, "whsec_test"),
    { ...closedTestEnv, STRIPE_WEBHOOK_ENABLED: "true" },
  ),
  /mode does not match/,
  "a live event cannot cross into test mode",
);
assert.equal(
  parseVerifiedStripeEvent(liveEvent, signedHeader(liveEvent, "whsec_live"), liveEnv).id,
  "evt_live_contract",
  "a live event is accepted only with matching explicit live gates",
);

const originalFetch = globalThis.fetch;
const stripeRequests = [];
globalThis.fetch = async (_url, options) => {
  stripeRequests.push({ body: String(options.body), idempotencyKey: options.headers["Idempotency-Key"] });
  return new Response(JSON.stringify({
    id: "cs_test_contract",
    url: "https://checkout.stripe.test/cs_test_contract",
    mode: "payment",
    livemode: false,
    metadata: { contractProofId: "paymentContractProofs-1", contractVersion: CHECKOUT_CONTRACT_VERSION },
    consent_collection: { terms_of_service: "required" },
  }), { status: 200, headers: { "content-type": "application/json" } });
};
try {
  const clientArgs = {
    amountCents: 5500,
    productName: "Feedback vidéo",
    description: "Feedback personnalisé",
    customerEmail: "client@example.com",
    requestId: "request_test_12345678",
    userId: "member-a",
    offerKey: "feedback",
    attempt: 1,
    contractProofId: "paymentContractProofs-1",
    contractVersion: CHECKOUT_CONTRACT_VERSION,
    successUrl: "http://localhost:3010/nouveau/confirmation",
    cancelUrl: "http://localhost:3010/nouveau/confirmation?etat=annule",
    idempotencyKey: "client-request:request_test_12345678:1:contract:paymentContractProofs-1",
    env: { STRIPE_MODE: "test", STRIPE_SECRET_KEY: "sk_test_fixed", STRIPE_CHECKOUT_ENABLED: "true" },
  };
  await createStripeClientCheckoutSession(clientArgs);
  await createStripeClientCheckoutSession(clientArgs);
  assert.equal(stripeRequests.length, 2);
  assert.equal(stripeRequests[0].body, stripeRequests[1].body, "Checkout parameters stay stable across retries");
  assert.equal(stripeRequests[0].idempotencyKey, stripeRequests[1].idempotencyKey);
  const clientForm = new URLSearchParams(stripeRequests[0].body);
  assert.equal(clientForm.get("client_reference_id"), clientArgs.requestId);
  assert.equal(clientForm.get("consent_collection[terms_of_service]"), "required");
  assert.equal(clientForm.get("custom_text[terms_of_service_acceptance][message]"), STRIPE_CHECKOUT_CONSENT_TEXT);
  assert.equal(clientForm.get("metadata[contractProofId]"), clientArgs.contractProofId);
  assert.equal(clientForm.get("metadata[contractVersion]"), CHECKOUT_CONTRACT_VERSION);
  assert.equal(clientForm.get("payment_intent_data[metadata][contractProofId]"), clientArgs.contractProofId);
  assert.equal(clientForm.get("payment_intent_data[metadata][contractVersion]"), CHECKOUT_CONTRACT_VERSION);

  const legacyBefore = stripeRequests.length;
  await createStripeCheckoutSession({
    amountCents: 5500,
    productName: "Cours d’anglais",
    description: "Cours particulier",
    customerEmail: "client@example.com",
    bookingId: "booking_test_12345678",
    userId: "member-a",
    offerKey: "anglais",
    mode: "solo",
    successUrl: "http://localhost:3010/nouveau/confirmation",
    cancelUrl: "http://localhost:3010/nouveau/confirmation?etat=annule",
    idempotencyKey: "booking:booking_test_12345678",
    env: { STRIPE_SECRET_KEY: "sk_test_fixed" },
  });
  const legacyForm = new URLSearchParams(stripeRequests[legacyBefore].body);
  assert.equal(legacyForm.get("consent_collection[terms_of_service]"), null, "legacy test helper remains compatible");
} finally {
  globalThis.fetch = originalFetch;
}

const conflictFetch = globalThis.fetch;
globalThis.fetch = async () => new Response(JSON.stringify({
  error: { code: "idempotency_key_in_use", message: "Request in progress" },
}), { status: 409, headers: { "content-type": "application/json" } });
try {
  await assert.rejects(
    () => createStripeCheckoutSession({
      amountCents: 5500,
      productName: "Cours d’anglais",
      description: "Cours particulier",
      customerEmail: "client@example.com",
      bookingId: "booking_test_12345678",
      userId: "member-a",
      offerKey: "anglais",
      mode: "solo",
      successUrl: "http://localhost:3010/nouveau/confirmation",
      cancelUrl: "http://localhost:3010/nouveau/confirmation?etat=annule",
      idempotencyKey: "booking:booking_test_12345678",
      env: { STRIPE_SECRET_KEY: "sk_test_fixed" },
    }),
    (error) => error?.code === "idempotency_key_in_use" && error.retryable === true,
    "Stripe idempotency conflicts remain retryable and do not authorize hold cancellation",
  );
} finally {
  globalThis.fetch = conflictFetch;
}

const INDEX_FIELDS = {
  by_booking: "bookingId",
  by_checkout_session: "stripeCheckoutSessionId",
  by_request: "requestId",
};

function createProofHarness() {
  const state = {
    clientRequests: [{
      _id: "request_test_12345678",
      clerkUserId: "member-a",
      tokenIdentifier: "token-a",
      offerKey: "feedback",
      status: "awaiting_payment",
      paymentStatus: "unpaid",
    }],
    bookings: [{
      _id: "booking_test_12345678",
      clerkUserId: "member-a",
      tokenIdentifier: "token-a",
      offerKey: "anglais",
      status: "pending",
      paymentStatus: "unpaid",
    }],
    paymentContractProofs: [],
  };
  const counters = new Map();
  const allRows = () => Object.values(state).flat();
  const context = {
    auth: {
      getUserIdentity: async () => ({ subject: "member-a", tokenIdentifier: "token-a" }),
    },
    db: {
      get: async (id) => allRows().find((row) => row._id === id) || null,
      insert: async (table, value) => {
        const id = `${table}-${(counters.get(table) || 0) + 1}`;
        counters.set(table, (counters.get(table) || 0) + 1);
        state[table].push({ ...value, _id: id, _creationTime: counters.get(table) });
        return id;
      },
      patch: async (id, patch) => {
        const row = allRows().find((candidate) => candidate._id === id);
        if (!row) throw new Error(`missing row ${id}`);
        Object.assign(row, patch);
      },
      query: (table) => ({
        withIndex: (indexName, callback) => {
          let field = INDEX_FIELDS[indexName];
          let expected;
          callback({ eq: (nextField, nextValue) => { field = nextField; expected = nextValue; } });
          const rows = () => (state[table] || []).filter((row) => row[field] === expected);
          return { collect: async () => rows(), first: async () => rows()[0] || null };
        },
      }),
    },
  };
  return { context, state };
}

const previousSecret = process.env.BOOKING_WEBHOOK_SECRET;
const previousMode = process.env.STRIPE_MODE;
const previousKey = process.env.STRIPE_SECRET_KEY;
process.env.BOOKING_WEBHOOK_SECRET = "booking-webhook-test";
try {
  const harness = createProofHarness();
  const proofOne = await prepare._handler(harness.context, {
    requestId: "request_test_12345678",
    stripeMode: "test",
  });
  await attachCheckoutSession._handler(harness.context, {
    proofId: proofOne.id,
    checkoutSessionId: "cs_test_contractone",
    attempt: 1,
    serverSecret: "booking-webhook-test",
  });
  const missingConsent = await recordStripeConsent._handler(harness.context, {
    webhookSecret: "booking-webhook-test",
    proofId: proofOne.id,
    eventId: "evt_missing_consent",
    eventType: "checkout.session.completed",
    requestId: "request_test_12345678",
    checkoutSessionId: "cs_test_contractone",
    paymentIntentId: "pi_missing_consent",
    contractVersion: proofOne.contractVersion,
    stripeMode: "test",
    livemode: false,
    consentStatus: "missing",
    eventCreatedAt: proofOne.createdAt + 1000,
  });
  assert.equal(missingConsent.status, "rejected");
  assert.equal(harness.state.clientRequests[0].status, "awaiting_payment", "missing consent cannot grant access");
  assert.equal(harness.state.clientRequests[0].paymentStatus, "unpaid");

  const proofTwo = await prepare._handler(harness.context, {
    requestId: "request_test_12345678",
    stripeMode: "test",
    currentCheckoutSessionId: "cs_test_contractone",
  });
  assert.notEqual(proofTwo.id, proofOne.id, "a rejected consent requires a new proof");
  await attachCheckoutSession._handler(harness.context, {
    proofId: proofTwo.id,
    checkoutSessionId: "cs_test_contracttwo",
    attempt: 2,
    serverSecret: "booking-webhook-test",
  });
  const pendingPayment = await recordStripeConsent._handler(harness.context, {
    webhookSecret: "booking-webhook-test",
    proofId: proofTwo.id,
    eventId: "evt_payment_first",
    eventType: "payment_intent.succeeded",
    requestId: "request_test_12345678",
    paymentIntentId: "pi_contract_two",
    contractVersion: proofTwo.contractVersion,
    stripeMode: "test",
    livemode: false,
    consentStatus: "pending",
    eventCreatedAt: proofTwo.createdAt + 1000,
  });
  assert.equal(pendingPayment.status, "pending", "payment success alone cannot accept the contract");
  assert.equal(harness.state.paymentContractProofs.find((row) => row._id === proofTwo.id).status, "attached");
  const accepted = await recordStripeConsent._handler(harness.context, {
    webhookSecret: "booking-webhook-test",
    proofId: proofTwo.id,
    eventId: "evt_checkout_accepted",
    eventType: "checkout.session.completed",
    requestId: "request_test_12345678",
    checkoutSessionId: "cs_test_contracttwo",
    paymentIntentId: "pi_contract_two",
    contractVersion: proofTwo.contractVersion,
    stripeMode: "test",
    livemode: false,
    consentStatus: "accepted",
    eventCreatedAt: proofTwo.createdAt + 2000,
  });
  assert.equal(accepted.status, "accepted");
  const acceptedReplay = await recordStripeConsent._handler(harness.context, {
    webhookSecret: "booking-webhook-test",
    proofId: proofTwo.id,
    eventId: "evt_checkout_accepted",
    eventType: "checkout.session.completed",
    requestId: "request_test_12345678",
    checkoutSessionId: "cs_test_contracttwo",
    paymentIntentId: "pi_contract_two",
    contractVersion: proofTwo.contractVersion,
    stripeMode: "test",
    livemode: false,
    consentStatus: "accepted",
    eventCreatedAt: proofTwo.createdAt + 2000,
  });
  assert.equal(acceptedReplay.status, "accepted", "the consent event is idempotent");
  const proofOneRow = harness.state.paymentContractProofs.find((row) => row._id === proofOne.id);
  const proofTwoRow = harness.state.paymentContractProofs.find((row) => row._id === proofTwo.id);
  proofOneRow.createdAt = proofTwoRow.createdAt;

  const proofThree = await prepare._handler(harness.context, {
    bookingId: "booking_test_12345678",
    stripeMode: "test",
  });
  await attachCheckoutSession._handler(harness.context, {
    proofId: proofThree.id,
    checkoutSessionId: "cs_test_contractthree",
    attempt: 1,
    serverSecret: "booking-webhook-test",
  });
  const retroactive = await recordStripeConsent._handler(harness.context, {
    webhookSecret: "booking-webhook-test",
    proofId: proofThree.id,
    eventId: "evt_before_proof",
    eventType: "checkout.session.completed",
    bookingId: "booking_test_12345678",
    checkoutSessionId: "cs_test_contractthree",
    contractVersion: proofThree.contractVersion,
    stripeMode: "test",
    livemode: false,
    consentStatus: "accepted",
    eventCreatedAt: proofThree.createdAt - 2000,
  });
  assert.equal(retroactive.status, "rejected", "a later proof cannot recreate earlier consent");
  await assert.rejects(
    () => recordStripeConsent._handler(harness.context, {
      webhookSecret: "booking-webhook-test",
      proofId: proofTwo.id,
      eventId: "evt_wrong_mode",
      eventType: "checkout.session.completed",
      requestId: "request_test_12345678",
      checkoutSessionId: "cs_test_contracttwo",
      contractVersion: proofTwo.contractVersion,
      stripeMode: "live",
      livemode: true,
      consentStatus: "accepted",
      eventCreatedAt: proofTwo.createdAt + 3000,
    }),
    /PAYMENT_MISMATCH/,
    "a mismatched Stripe mode cannot accept the proof",
  );
  const proofView = await getMyProof._handler(harness.context, { requestId: "request_test_12345678" });
  assert.equal(proofView.contractVersion, CHECKOUT_CONTRACT_VERSION);
  assert.match(proofView.consentText, /CGV/);
  assert.equal(proofView.status, "accepted");
  assert.equal(proofView.id, proofTwo.id, "equal preparation timestamps still select the newest proof deterministically");

  const liveRequest = {
    _id: "request_live_12345678",
    clerkUserId: "member-a",
    tokenIdentifier: "token-a",
    offerKey: "animation",
    status: "awaiting_payment",
    paymentStatus: "unpaid",
    answersJson: "{}",
    priceCents: 5500,
    currency: "eur",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const liveState = { request: liveRequest, files: [] };
  const liveContext = {
    auth: { getUserIdentity: async () => ({ subject: "member-a", tokenIdentifier: "token-a" }) },
    db: {
      get: async (id) => id === liveRequest._id ? liveState.request : null,
      patch: async (id, patch) => {
        assert.equal(id, liveRequest._id);
        Object.assign(liveState.request, patch);
      },
      query: () => ({ withIndex: () => ({ collect: async () => liveState.files }) }),
    },
  };
  process.env.STRIPE_MODE = "live";
  process.env.STRIPE_SECRET_KEY = "sk_live_fixed";
  await attachClientCheckoutSession._handler(liveContext, {
    requestId: liveRequest._id,
    checkoutSessionId: "cs_live_fixture123",
    attempt: 1,
    serverSecret: "booking-webhook-test",
  });
  assert.equal(liveState.request.stripeCheckoutSessionId, "cs_live_fixture123", "client attachment follows the explicit live mode");
} finally {
  if (previousSecret === undefined) delete process.env.BOOKING_WEBHOOK_SECRET;
  else process.env.BOOKING_WEBHOOK_SECRET = previousSecret;
  if (previousMode === undefined) delete process.env.STRIPE_MODE;
  else process.env.STRIPE_MODE = previousMode;
  if (previousKey === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = previousKey;
}

const [schema, proofSource, stripeSource, clientRoute, bookingRoute, webhookRoute, clientRequestsSource, envExample] = await Promise.all([
  readFile(new URL("../convex/schema.js", import.meta.url), "utf8"),
  readFile(new URL("../convex/paymentContractProofs.js", import.meta.url), "utf8"),
  readFile(new URL("../lib/stripe-server.mjs", import.meta.url), "utf8"),
  readFile(new URL("../app/api/stripe/client-checkout/route.js", import.meta.url), "utf8"),
  readFile(new URL("../app/api/stripe/checkout/route.js", import.meta.url), "utf8"),
  readFile(new URL("../app/api/stripe/webhook/route.js", import.meta.url), "utf8"),
  readFile(new URL("../convex/clientRequests.js", import.meta.url), "utf8"),
  readFile(new URL("../.env.example", import.meta.url), "utf8"),
]);
assert.match(schema, /paymentContractProofs: defineTable/);
assert.match(schema, /consentAcceptedAt: v\.optional\(v\.number\(\)\)/);
assert.match(proofSource, /consent_event_precedes_proof/);
assert.match(proofSource, /termsConsentRequired: true/);
assert.match(stripeSource, /consent_collection\[terms_of_service\]/);
assert.match(stripeSource, /Idempotency-Key/);
assert.match(stripeSource, /rawBody/);
assert.match(clientRoute, /paymentContractProofs\.prepare/);
assert.match(clientRoute, /stripe_session_contract_mismatch/);
assert.match(bookingRoute, /paymentContractProofs\.attachCheckoutSession/);
assert.match(webhookRoute, /recordStripeConsent/);
assert.match(webhookRoute, /contract_consent_pending/);
assert.match(clientRequestsSource, /expectedPrefix/);
assert.match(envExample, /STRIPE_MODE=test/);
assert.match(envExample, /STRIPE_CHECKOUT_ENABLED=false/);
assert.match(envExample, /STRIPE_WEBHOOK_ENABLED=false/);
assert.match(envExample, /STRIPE_LIVE_ENABLED=false/);

console.log("Stripe contract, explicit gates, consent proof, and webhook idempotency checks: PASS");
