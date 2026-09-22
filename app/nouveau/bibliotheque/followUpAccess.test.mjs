import test from "node:test";
import assert from "node:assert/strict";
import { getDeliveryForKind, getDeliveryStepIndex, resolveFollowUps } from "./followUpAccess.mjs";

test("sans achat, aucun suivi fictif n'apparaît", () => {
  assert.deepEqual(resolveFollowUps([], { bookings: [], entitlements: [] }), { kinds: [], selectedKind: null, entries: [] });
});

test("la review payée ouvre le suivi book, pas le projet animation", () => {
  const result = resolveFollowUps([
    { offerKey: "review", status: "paid", paymentStatus: "paid", updatedAt: 20 },
    { offerKey: "projet-animation", status: "draft", paymentStatus: "unpaid", updatedAt: 30 },
  ], { bookings: [], entitlements: [] });
  assert.deepEqual(result, {
    kinds: ["book"],
    selectedKind: "book",
    entries: [{ kind: "book", requestId: null, offerKey: "review", updatedAt: 20 }],
  });
});

test("l'offre payée la plus récente est sélectionnée, sauf choix explicite possédé", () => {
  const requests = [{ offerKey: "review", status: "paid", paymentStatus: "paid", updatedAt: 30 }];
  const english = { bookings: [{ paymentStatus: "paid", updatedAt: 10 }], entitlements: [] };
  assert.deepEqual(resolveFollowUps(requests, english), {
    kinds: ["book", "anglais"],
    selectedKind: "book",
    entries: [
      { kind: "book", requestId: null, offerKey: "review", updatedAt: 30 },
      { kind: "anglais", updatedAt: 10 },
    ],
  });
  assert.equal(resolveFollowUps(requests, english, "anglais").selectedKind, "anglais");
  assert.equal(resolveFollowUps(requests, english, "animation").selectedKind, "book");
});

test("remboursement et droits expirés n'accordent pas de suivi", () => {
  const requests = [{ offerKey: "review", status: "refunded", paymentStatus: "refunded" }];
  const english = { bookings: [], entitlements: [{ remainingCredits: 0 }] };
  assert.deepEqual(resolveFollowUps(requests, english), { kinds: [], selectedKind: null, entries: [] });
});

test("les dossiers d'une même offre gardent leur identifiant et leur livraison", () => {
  const result = resolveFollowUps([
    { id: "request-old", offerKey: "review", status: "paid", paymentStatus: "paid", updatedAt: 10 },
    { id: "request-new", offerKey: "review", status: "paid", paymentStatus: "paid", updatedAt: 20 },
  ], { bookings: [], entitlements: [] });
  assert.deepEqual(result.entries.map((entry) => entry.requestId), ["request-new", "request-old"]);
  assert.equal(getDeliveryForKind([
    { requestId: "request-old", offerKey: "review", updatedAt: 10, state: "delivered" },
    { requestId: "request-new", offerKey: "review", updatedAt: 20, state: "preparing" },
  ], "book", "request-old").state, "delivered");
  assert.equal(getDeliveryStepIndex("book"), 1);
  assert.equal(getDeliveryStepIndex("animation"), 0);
});
