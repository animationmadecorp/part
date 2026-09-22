const REQUEST_KIND = Object.freeze({
  review: "book",
  contenu: "contenu",
  "projet-animation": "animation",
  feedback: "feedback",
});

const DELIVERY_OFFER_BY_KIND = Object.freeze({
  book: "review",
  contenu: "contenu",
  animation: "projet-animation",
  feedback: "feedback",
});

const DELIVERY_STEP_BY_KIND = Object.freeze({
  book: 1,
  contenu: 1,
  animation: 0,
  feedback: 2,
});

export function resolveFollowUps(requests, englishFollowUp, preferredKind) {
  const entries = [];

  for (const request of Array.isArray(requests) ? requests : []) {
    const kind = REQUEST_KIND[request.offerKey];
    if (kind && request.status === "paid" && request.paymentStatus === "paid") {
      entries.push({
        kind,
        requestId: request.id || null,
        offerKey: request.offerKey,
        updatedAt: request.updatedAt ?? request.createdAt ?? 0,
      });
    }
  }

  for (const booking of englishFollowUp?.bookings ?? []) {
    if (booking.paymentStatus === "paid") {
      entries.push({ kind: "anglais", updatedAt: booking.updatedAt ?? booking.createdAt ?? 0 });
    }
  }
  for (const entitlement of englishFollowUp?.entitlements ?? []) {
    if ((entitlement.remainingCredits ?? 0) > 0) {
      entries.push({ kind: "anglais", updatedAt: entitlement.createdAt ?? 0 });
    }
  }

  entries.sort((left, right) => right.updatedAt - left.updatedAt);
  const kinds = [...new Set(entries.map(entry => entry.kind))];
  return {
    kinds,
    selectedKind: preferredKind && kinds.includes(preferredKind) ? preferredKind : kinds[0] ?? null,
    entries,
  };
}

export function getDeliveryForKind(deliveries, kind, requestId = null) {
  const offerKey = DELIVERY_OFFER_BY_KIND[kind];
  return (Array.isArray(deliveries) ? deliveries : [])
    .filter((delivery) => delivery.offerKey === offerKey && (!requestId || delivery.requestId === requestId))
    .sort((left, right) => right.updatedAt - left.updatedAt)[0] || null;
}

export function getDeliveryStepIndex(kind) {
  return DELIVERY_STEP_BY_KIND[kind] ?? null;
}
