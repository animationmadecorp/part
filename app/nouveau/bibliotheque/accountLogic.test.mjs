import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPurchaseHistory,
  formatHistoryDate,
  formatPurchaseAmount,
  makeAccountQueryArgs,
  mapRequestToPurchaseHistory,
  resolveAccountDataStatus,
} from "./accountLogic.mjs";

test("les états compte distinguent chargement, vide et erreur", () => {
  assert.equal(resolveAccountDataStatus({ authLoading: true }), "loading");
  assert.equal(resolveAccountDataStatus({ isAuthenticated: true, queryStatus: "success" }), "ready");
  assert.equal(resolveAccountDataStatus({ isAuthenticated: true, queryStatus: "error" }), "error");
  assert.deepEqual(buildPurchaseHistory(), []);
});

test("une déconnexion ne réutilise pas un historique Convex mis en cache", () => {
  assert.equal(resolveAccountDataStatus({
    isAuthenticated: true,
    queryStatus: "success",
    connectionState: { hasEverConnected: true, isWebSocketConnected: false },
  }), "error");
});

test("l’identité et la reconnexion changent la clé de query avant d’afficher l’historique", () => {
  const accountA = makeAccountQueryArgs({ isAuthenticated: true, clerkLoaded: true, isSignedIn: true, userId: "account-a", connectionCount: 1 });
  const accountB = makeAccountQueryArgs({ isAuthenticated: true, clerkLoaded: true, isSignedIn: true, userId: "account-b", connectionCount: 1 });
  const reconnected = makeAccountQueryArgs({ isAuthenticated: true, clerkLoaded: true, isSignedIn: true, userId: "account-a", connectionCount: 2 });
  assert.notDeepEqual(accountA, accountB);
  assert.notDeepEqual(accountA, reconnected);
  assert.equal(resolveAccountDataStatus({ isAuthenticated: true, queryStatus: "success", identityMatches: false }), "error");
  assert.equal(resolveAccountDataStatus({ isAuthenticated: true, queryStatus: "pending", connectionState: { isWebSocketConnected: false, connectionRetries: 3 } }), "error");
  assert.equal(resolveAccountDataStatus({ authLoading: true, isAuthenticated: true, queryStatus: "pending", connectionState: { isWebSocketConnected: false, connectionRetries: 3 } }), "error");
});

test("les brouillons ne deviennent pas des achats affichés", () => {
  assert.equal(mapRequestToPurchaseHistory({ id: "draft-1", status: "draft", offerKey: "review" }), null);
  assert.equal(mapRequestToPurchaseHistory({ id: "mismatch-1", status: "paid", paymentStatus: "unpaid", offerKey: "review" }), null);
  const history = buildPurchaseHistory({
    requests: [{ id: "paid-1", status: "paid", paymentStatus: "paid", offerKey: "review", priceCents: 2800, currency: "eur", paidAt: 2 }],
  });
  assert.equal(history.length, 1);
  assert.equal(history[0].title, "Review de book");
  assert.equal(history[0].status, "Paiement confirmé");
  assert.equal(history[0].amount, "28,00 €");
  assert.equal(history[0].href, "/nouveau/confirmation?requestId=paid-1");
});

test("les remboursements restent visibles avec leur statut réel", () => {
  const [entry] = buildPurchaseHistory({
    requests: [{ id: "refund-1", status: "refunded", paymentStatus: "refunded", offerKey: "contenu", priceCents: 12000, currency: "eur", updatedAt: 4 }],
  });
  assert.equal(entry.status, "Remboursé");
});

test("les achats anglais viennent uniquement des droits confirmés, pas de chaque séance", () => {
  const history = buildPurchaseHistory({
    entitlements: [
      { id: "entitlement-1", offerKey: "anglais", mode: "solo-4h", totalCredits: 4 },
    ],
  });
  assert.deepEqual(history.map((entry) => entry.id), ["entitlement:entitlement-1"]);
  assert.equal(history[0].detail, "Pack individuel · 4 cours");
});

test("un entitlement anglais remboursé reste dans l’historique avec le statut réel", () => {
  const [entry] = buildPurchaseHistory({
    entitlements: [{ id: "entitlement-refunded", offerKey: "anglais", mode: "solo", status: "refunded", refundStatus: "refunded", refundedAmountCents: 5500 }],
  });
  assert.equal(entry.status, "Remboursé");
  assert.equal(entry.statusKey, "refunded");
  assert.equal(entry.refundAmount, "55,00 €");
});

test("un remboursement anglais partiel est visible sans décider d’une révocation commerciale", () => {
  const [entry] = buildPurchaseHistory({
    entitlements: [{ id: "entitlement-partial", offerKey: "anglais", mode: "solo-4h", status: "partial_refund", refundStatus: "partial", refundedAmountCents: 5000, remainingCredits: 3 }],
  });
  assert.equal(entry.status, "Remboursement partiel à traiter");
  assert.equal(entry.statusKey, "partial_refund");
  assert.equal(entry.refundAmount, "50,00 €");
});

test("un changement de compte remplace entièrement la liste reçue", () => {
  const accountA = buildPurchaseHistory({ requests: [{ id: "account-a", status: "paid", paymentStatus: "paid", offerKey: "review", priceCents: 2800, currency: "eur" }] });
  const accountB = buildPurchaseHistory({ requests: [] });
  assert.deepEqual(accountA.map((entry) => entry.id), ["request:account-a"]);
  assert.deepEqual(accountB, []);
});

test("les dates invalides et montants indisponibles ne fabriquent pas de valeur", () => {
  assert.equal(formatHistoryDate("not-a-date"), null);
  assert.equal(formatPurchaseAmount(undefined), null);
  assert.match(formatHistoryDate("2026-09-21T12:00:00.000Z"), /2026/);
});
