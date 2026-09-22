import test from "node:test";
import assert from "node:assert/strict";
import {
  ENGLISH_RIGHTS_SOURCE,
  getConfirmedOfferKeys,
  hasDeliveredLessonContent,
  isConfirmedPurchase,
  resolveRequestStatus,
  resolveResourceAccess,
} from "./accessLogic.mjs";

const freeResource = { access: "free", accessRule: "free" };
const reviewResource = { access: "review", accessKey: "review", accessRule: "offer" };
const contentResource = { access: "visibility", accessKey: "contenu", accessRule: "offer" };
const englishResource = { access: "english", accessKey: "anglais", accessRule: "offer" };

test("les ressources gratuites restent accessibles sans achat ni réseau Convex", () => {
  assert.deepEqual(resolveResourceAccess(freeResource, { status: "error" }), {
    kind: "free",
    unlocked: true,
    accessKey: "free",
  });
});

test("une offre non achetée reste verrouillée", () => {
  assert.equal(resolveResourceAccess(reviewResource, { requests: [] }).kind, "locked");
  assert.equal(resolveResourceAccess(contentResource, { requests: [] }).unlocked, false);
});

test("seul un dossier payé et confirmé débloque la bonne offre", () => {
  const requests = [
    { offerKey: "review", status: "paid", paymentStatus: "paid" },
    { offerKey: "contenu", status: "paid", paymentStatus: "failed" },
    { offerKey: "projet-animation", status: "awaiting_payment", paymentStatus: "unpaid" },
  ];
  assert.equal(isConfirmedPurchase(requests[0]), true);
  assert.deepEqual([...getConfirmedOfferKeys(requests)], ["review"]);
  assert.equal(resolveResourceAccess(reviewResource, { requests }).kind, "purchased");
  assert.equal(resolveResourceAccess(contentResource, { requests }).kind, "locked");
});

test("un achat remboursé ne conserve jamais le droit", () => {
  const refunded = { offerKey: "review", status: "refunded", paymentStatus: "refunded" };
  assert.equal(isConfirmedPurchase(refunded), false);
  assert.equal(resolveResourceAccess(reviewResource, { requests: [refunded] }).kind, "locked");
});

test("un changement de compte remplace l’état précédent sans réutiliser ses achats", () => {
  const accountA = [{ offerKey: "review", status: "paid", paymentStatus: "paid" }];
  assert.equal(resolveResourceAccess(reviewResource, { requests: accountA }).unlocked, true);
  assert.equal(resolveResourceAccess(reviewResource, { requests: [] }).unlocked, false);
});

test("une erreur réseau verrouille les droits payants sans inventer de contenu", () => {
  const result = resolveResourceAccess(reviewResource, { status: "error" });
  assert.equal(result.kind, "unavailable");
  assert.equal(result.unlocked, false);
});

test("une déconnexion invalide le dernier résultat Convex avant d'accorder un droit", () => {
  const status = resolveRequestStatus({
    isAuthenticated: true,
    queryStatus: "success",
    connectionState: { hasEverConnected: true, isWebSocketConnected: false },
  });
  assert.equal(status, "error");
  assert.equal(resolveResourceAccess(reviewResource, { status }).unlocked, false);
});

test("les droits anglais restent rattachés au modèle de réservation documenté", () => {
  const result = resolveResourceAccess(englishResource, {
    requests: [{ offerKey: "review", status: "paid", paymentStatus: "paid" }],
  });
  assert.equal(result.kind, "separate-model");
  assert.equal(result.source, ENGLISH_RIGHTS_SOURCE);
  assert.equal(result.unlocked, false);
});

test("un contenu de leçon vide n’est pas considéré comme livré", () => {
  assert.equal(hasDeliveredLessonContent({ format: "Leçon", content: [] }), false);
  assert.equal(hasDeliveredLessonContent({ format: "Leçon", content: [{ title: "Titre", text: "Texte livré" }] }), true);
});
