import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CLIENT_REQUEST_OFFERS,
  CLIENT_REQUEST_QUOTA_BYTES,
  getClientRequestOffer,
  isRequestOwner,
  normalizeAttachment,
  normalizeClientRequestAnswers,
  parseClientRequestAnswers,
  validateClientRequestFiles,
} from "../convex/clientRequestRules.js";
import { createStripeClientCheckoutSession, getStripeCheckoutSession, getStripeConfig, parseVerifiedStripeEvent, verifyStripeSignature } from "../lib/stripe-server.mjs";
import { animationProjectOffer, feedbackOffer, reviewOffer } from "../app/nouveau/_data/prePaymentOffers.mjs";
import { contentOffer } from "../app/nouveau/visibilite/questionnaire/questionnaire-logic.mjs";

test("les prix UI correspondent au catalogue serveur des quatre offres commandables", () => {
  assert.deepEqual(
    {
      review: reviewOffer.price * 100,
      contenu: contentOffer.price * 100,
      "projet-animation": animationProjectOffer.price * 100,
      feedback: feedbackOffer.price * 100,
    },
    Object.fromEntries(Object.entries(CLIENT_REQUEST_OFFERS).map(([key, offer]) => [key, offer.priceCents])),
  );
  assert.equal(feedbackOffer.price, 38);
  assert.equal(getClientRequestOffer("feedback")?.priceCents, 3800);
  assert.equal(getClientRequestOffer("__proto__"), null, "l’offre ne doit pas être contournable par une clé de prototype");
});

test("les réponses sont normalisées côté Convex avant sauvegarde", () => {
  const review = normalizeClientRequestAnswers("review", {
    objective: " Stage ",
    dream: "",
    workTypes: ["Animation 3D"],
    workLink: "https://example.test/book",
    password: "secret",
    selfAssessment: "À retravailler",
    authorization: true,
  });
  assert.equal(review.objective, "Stage");
  assert.throws(() => normalizeClientRequestAnswers("review", { ...review, authorization: false }), /authorization/i);

  const content = normalizeClientRequestAnswers("contenu", {
    answers: ["fort", "", "singulier", "idée", "vivre de mon art", "regard", "désaccord", "exemple", "", ""],
  });
  assert.equal(content.answers.length, 10);

  const project = normalizeClientRequestAnswers("projet-animation", {
    idea: "Une marche",
    goal: "Travailler le poids",
    difficulty: "Le timing",
    references: "https://example.test/ref",
    stage: "Une idée seulement",
    software: "Blender",
  });
  assert.equal(project.stage, "Une idée seulement");
  assert.throws(() => parseClientRequestAnswers("projet-animation", "{}"), /Missing project/);

  const feedback = normalizeClientRequestAnswers("feedback", {
    plans: [{ name: "salto.mp4", duration: 4.5 }],
    intent: "Travailler le poids",
    blocker: "La réception",
    references: "https://example.test/reference",
  });
  assert.equal(feedback.total, 4.5);
  assert.equal(feedback.references, "https://example.test/reference");
  const homonymousFeedback = normalizeClientRequestAnswers("feedback", {
    plans: [
      { name: "plan.mp4", duration: 2, size: 10, mimeType: "video/mp4" },
      { name: "plan.mp4", duration: 3, size: 11, mimeType: "video/mp4" },
    ],
    intent: "Deux versions",
  });
  assert.equal(validateClientRequestFiles("feedback", homonymousFeedback, [
    { name: "plan.mp4", size: 11, mimeType: "video/mp4" },
    { name: "plan.mp4", size: 10, mimeType: "video/mp4" },
  ]), true);
  assert.throws(() => validateClientRequestFiles("feedback", homonymousFeedback, [
    { name: "plan.mp4", size: 10, mimeType: "video/mp4" },
    { name: "plan.mp4", size: 12, mimeType: "video/mp4" },
  ]), /uploaded before payment/);
  assert.throws(() => normalizeClientRequestAnswers("feedback", {
    plans: [{ name: "bad.mp4", duration: 0 }],
    intent: "Un objectif",
  }), /duration/);
  assert.equal(validateClientRequestFiles("feedback", feedback, [{ name: "salto.mp4", mimeType: "video/mp4" }]), true);
  assert.throws(() => validateClientRequestFiles("feedback", feedback, []), /uploaded before payment/);
  assert.throws(() => validateClientRequestFiles("feedback", feedback, [{ name: "salto.mp4", mimeType: "application/pdf" }]), /video files only/);
});

test("les fichiers respectent type, quota et limite non arbitraire vidéo", () => {
  assert.throws(() => normalizeAttachment({
    offerKey: "review",
    name: "book.pdf",
    mimeType: "application/pdf",
    size: 10,
    remainingBytes: CLIENT_REQUEST_QUOTA_BYTES,
  }), /does not accept/);
  assert.equal(normalizeAttachment({
    offerKey: "contenu",
    name: "plan.mov",
    mimeType: "video/quicktime",
    size: 100 * 1024 * 1024,
    remainingBytes: CLIENT_REQUEST_QUOTA_BYTES,
  }).isVideo, true);
  assert.throws(() => normalizeAttachment({
    offerKey: "feedback",
    name: "reference.pdf",
    mimeType: "application/pdf",
    size: 10,
    remainingBytes: CLIENT_REQUEST_QUOTA_BYTES,
  }), /not accepted/);
  assert.equal(normalizeAttachment({
    offerKey: "feedback",
    name: "feedback.mov",
    mimeType: "video/quicktime",
    size: 100 * 1024 * 1024,
    remainingBytes: CLIENT_REQUEST_QUOTA_BYTES,
  }).isVideo, true);
  assert.throws(() => normalizeAttachment({
    offerKey: "contenu",
    name: "large.pdf",
    mimeType: "application/pdf",
    size: 26 * 1024 * 1024,
    remainingBytes: CLIENT_REQUEST_QUOTA_BYTES,
  }), /too large/);
  assert.throws(() => normalizeAttachment({
    offerKey: "projet-animation",
    name: "too-large.mov",
    mimeType: "video/quicktime",
    size: CLIENT_REQUEST_QUOTA_BYTES + 1,
    remainingBytes: CLIENT_REQUEST_QUOTA_BYTES,
  }), /quota/);
});

test("les contrôles d’identité refusent un dossier appartenant à un autre compte", () => {
  const request = { clerkUserId: "user_a", tokenIdentifier: "token_a" };
  assert.equal(isRequestOwner(request, { clerkUserId: "user_a", tokenIdentifier: "token_a" }), true);
  assert.equal(isRequestOwner(request, { clerkUserId: "user_b", tokenIdentifier: "token_b" }), false);
  assert.equal(isRequestOwner(request, { clerkUserId: "user_a", tokenIdentifier: "token_b" }), false);
});

test("Checkout client envoie seulement le contrat serveur et reste Stripe test", async () => {
  const requests = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    requests.push({ body: String(options.body), headers: options.headers });
    return new Response(JSON.stringify({ id: "cs_test_client", url: "https://checkout.stripe.test/cs_test_client" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    await createStripeClientCheckoutSession({
      amountCents: 5800,
      productName: "Ta direction de contenu",
      description: "Fiche personnalisée · Sans visio",
      customerEmail: "client@example.com",
      requestId: "jclientrequest123456",
      userId: "user_test_123",
      offerKey: "contenu",
      successUrl: "http://localhost:3010/nouveau/confirmation?requestId=jclientrequest123456&session_id={CHECKOUT_SESSION_ID}",
      cancelUrl: "http://localhost:3010/nouveau/confirmation?requestId=jclientrequest123456&etat=annule",
      idempotencyKey: "client-request:jclientrequest123456:1",
      env: { STRIPE_SECRET_KEY: "sk_test_fixed" },
    });
    const form = new URLSearchParams(requests[0].body);
    assert.equal(form.get("line_items[0][price_data][unit_amount]"), "5800");
    assert.equal(form.get("metadata[clientRequestId]"), "jclientrequest123456");
    assert.equal(form.get("metadata[attempt]"), "1");
    assert.equal(form.get("payment_intent_data[metadata][clientRequestId]"), "jclientrequest123456");
    assert.equal(form.get("payment_intent_data[metadata][attempt]"), "1");
    assert.equal(requests[0].headers["Idempotency-Key"], "client-request:jclientrequest123456:1");
    assert.equal(getStripeConfig({ STRIPE_SECRET_KEY: "sk_live_never" }).configured, false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("une session Stripe existante est relue avant de créer une nouvelle tentative", async () => {
  const requests = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    return new Response(JSON.stringify({ id: "cs_test_existing", status: "expired" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    const session = await getStripeCheckoutSession("cs_test_existing", { STRIPE_SECRET_KEY: "sk_test_fixed" });
    assert.equal(session.status, "expired");
    assert.equal(requests[0].url, "https://api.stripe.com/v1/checkout/sessions/cs_test_existing");
    assert.equal(requests[0].options.method, "GET");
    assert.equal(requests[0].options.headers.Authorization, "Bearer sk_test_fixed");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("la signature webhook est vérifiée et le replay reste traçable par eventId", async () => {
  const timestamp = Math.floor(Date.now() / 1000);
  const body = JSON.stringify({
    id: "evt_client_test",
    type: "checkout.session.completed",
    livemode: false,
    data: { object: { id: "cs_test_client", metadata: { clientRequestId: "jclientrequest123456" } } },
  });
  const signature = createHmac("sha256", "whsec_test").update(`${timestamp}.${body}`).digest("hex");
  assert.equal(verifyStripeSignature(body, `t=${timestamp},v1=${signature}`, "whsec_test", { nowSeconds: timestamp }), true);
  assert.equal(verifyStripeSignature(body, `t=${timestamp},v1=${signature}`, "whsec_wrong", { nowSeconds: timestamp }), false);
  assert.equal(parseVerifiedStripeEvent(body, `t=${timestamp},v1=${signature}`, { STRIPE_WEBHOOK_SECRET: "whsec_test" }, { nowSeconds: timestamp }).id, "evt_client_test");

  const source = await readFile(new URL("../convex/clientRequests.js", import.meta.url), "utf8");
  assert.match(source, /clientStripeEvents/);
  assert.match(source, /duplicate: true/);
  assert.match(source, /withIndex\("by_event_id"/);
});

const [schema, rules, clientRequests, checkoutRoute, webhookRoute, checkoutHook, reviewQuestionnaire, reviewPage, contentQuestionnaire, contentPage, projectQuestionnaire, projectPage, feedbackQuestionnaire, feedbackPage, confirmation, followUp] = await Promise.all([
  readFile(new URL("../convex/schema.js", import.meta.url), "utf8"),
  readFile(new URL("../convex/clientRequestRules.js", import.meta.url), "utf8"),
  readFile(new URL("../convex/clientRequests.js", import.meta.url), "utf8"),
  readFile(new URL("../app/api/stripe/client-checkout/route.js", import.meta.url), "utf8"),
  readFile(new URL("../app/api/stripe/webhook/route.js", import.meta.url), "utf8"),
  readFile(new URL("../app/nouveau/_components/clientRequestCheckout.js", import.meta.url), "utf8"),
  readFile(new URL("../app/nouveau/review/Questionnaire.js", import.meta.url), "utf8"),
  readFile(new URL("../app/nouveau/review/questionnaire/page.js", import.meta.url), "utf8"),
  readFile(new URL("../app/nouveau/visibilite/questionnaire/questionnaire.js", import.meta.url), "utf8"),
  readFile(new URL("../app/nouveau/visibilite/questionnaire/page.js", import.meta.url), "utf8"),
  readFile(new URL("../app/nouveau/feedback/projet/questionnaire/questionnaire.js", import.meta.url), "utf8"),
  readFile(new URL("../app/nouveau/feedback/projet/questionnaire/page.js", import.meta.url), "utf8"),
  readFile(new URL("../app/nouveau/feedback/questionnaire/questionnaire.js", import.meta.url), "utf8"),
  readFile(new URL("../app/nouveau/feedback/questionnaire/page.js", import.meta.url), "utf8"),
  readFile(new URL("../app/nouveau/confirmation/ClientRequestConfirmation.js", import.meta.url), "utf8"),
  readFile(new URL("../app/nouveau/bibliotheque/ProjectFollowUp.js", import.meta.url), "utf8"),
]);

for (const table of ["clientRequests", "clientRequestFiles", "clientRequestUploads", "clientRequestEvents", "clientStripeEvents"]) {
  assert.match(schema, new RegExp(`${table}: defineTable`), `${table} is in the Convex schema`);
}
assert.match(schema, /clientStripeEvents[\s\S]*by_payment_intent/);
assert.match(schema, /checkoutPending/);
assert.match(rules, /CLIENT_REQUEST_OFFERS/);
assert.match(rules, /CLIENT_REQUEST_QUOTA_BYTES/);
assert.match(rules, /priceCents: 3800/);
assert.match(rules, /feedback: 3/);
assert.match(rules, /Feedback requires between 1 and 3 plans/);
assert.match(rules, /validateClientRequestFiles/);
assert.match(clientRequests, /ctx\.auth\.getUserIdentity\(\)/);
assert.match(clientRequests, /by_token_identifier/);
assert.match(clientRequests, /ctx\.storage\.generateUploadUrl\(\)/);
assert.match(clientRequests, /ctx\.storage\.getMetadata/);
assert.match(clientRequests, /ctx\.storage\.delete/);
assert.match(clientRequests, /by_storage_id/);
assert.match(clientRequests, /getOpenUploads/);
assert.match(clientRequests, /checkoutAttempt/);
assert.match(clientRequests, /ok: false/);
assert.match(clientRequests, /abandonAttachmentUpload/);
assert.match(clientRequests, /recordAttachmentStorage/);
assert.match(clientRequests, /ignored_stale_attempt/);
assert.match(clientRequests, /pending_refund/);
assert.match(clientRequests, /charge\.refunded/);
assert.match(clientRequests, /prepareCheckout/);
assert.match(clientRequests, /validateClientRequestFiles/);
assert.match(clientRequests, /assertFeedbackMutable/);
assert.match(clientRequests, /stripeCheckoutSessionId/);
assert.match(clientRequests, /releaseCheckout/);
assert.match(clientRequests, /confirmFromStripe/);
assert.match(checkoutRoute, /clientRequests\.prepareCheckout/);
assert.match(checkoutRoute, /clientRequests\.attachCheckoutSession/);
assert.match(checkoutRoute, /getStripeCheckoutSession/);
assert.match(checkoutRoute, /matchesClientCheckout/);
assert.match(checkoutRoute, /client-request:\$\{payload\.requestId\}:\$\{attempt\}/);
assert.match(checkoutRoute, /serverSecret/);
assert.match(checkoutRoute, /attempt/);
assert.doesNotMatch(checkoutRoute, /body\.amount|body\.price/);
assert.match(webhookRoute, /request\.text\(\)/);
assert.match(webhookRoute, /parseVerifiedStripeEvent/);
assert.match(webhookRoute, /clientRequests\.confirmFromStripe/);
assert.match(webhookRoute, /clientRefundByPaymentIntent/);
assert.match(checkoutHook, /localDraftKey/);
assert.match(checkoutHook, /storedFiles/);
assert.match(checkoutHook, /finalized\?\.ok === false/);
assert.match(checkoutHook, /abandonAttachmentUpload/);
assert.match(checkoutHook, /recordAttachmentStorage/);
assert.match(checkoutHook, /feedbackPlanMatchesFile/);
assert.match(checkoutHook, /attachment_reconcile_failed/);
assert.match(checkoutHook, /checkoutPending/);
assert.match(checkoutHook, /checkoutLocked = isFeedbackCheckoutLocked\(draft\)/);
assert.match(checkoutHook, /pendingStorageKey/);
assert.match(checkoutHook, /localStorage\.removeItem\(draftStorageKeyBase\)/);
assert.match(reviewPage, /searchParams/);
assert.match(contentPage, /searchParams/);
assert.match(projectPage, /searchParams/);
assert.match(feedbackQuestionnaire, /offerKey: "feedback"/);
assert.match(feedbackQuestionnaire, /onPayment={pay}/);
assert.match(feedbackQuestionnaire, /references/);
assert.match(feedbackQuestionnaire, /storedFiles/);
assert.match(feedbackQuestionnaire, /shouldRestoreServerDraft/);
assert.match(feedbackQuestionnaire, /activeRequestId/);
assert.match(feedbackPage, /searchParams/);
assert.match(confirmation, /copy\.route\}\?requestId=/);
assert.match(confirmation, /feedback:/);
assert.match(followUp, /clientRequests:getMyRequests/);
assert.match(followUp, /Reprendre/);
assert.match(followUp, /Paiement remboursé/);
assert.doesNotMatch(reviewQuestionnaire, /localStorage\.setItem\(STORAGE_KEY/);
assert.doesNotMatch(contentQuestionnaire, /localStorage\.setItem\(storageKey/);
assert.doesNotMatch(projectQuestionnaire, /localStorage\.setItem\(key/);
for (const questionnaire of [reviewQuestionnaire, contentQuestionnaire, projectQuestionnaire]) {
  assert.match(questionnaire, /useClientRequestCheckout/);
  assert.match(questionnaire, /onPayment=/);
}

console.log("non-English order contracts and targeted security checks: PASS");
