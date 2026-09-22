const OFFER_BY_RESOURCE_ACCESS = Object.freeze({
  review: "review",
  visibility: "contenu",
});

export const ENGLISH_RIGHTS_SOURCE = "bookings:getMyFollowUp";

function resourceAccessKey(resource) {
  const rawKey = typeof resource?.accessKey === "string" && resource.accessKey.trim()
    ? resource.accessKey.trim()
    : resource?.access;
  if (rawKey === "contenu") return "visibility";
  if (rawKey === "anglais") return "english";
  return rawKey;
}

export function isConfirmedPurchase(request) {
  return Boolean(request && request.status === "paid" && request.paymentStatus === "paid");
}

export function getConfirmedOfferKeys(requests) {
  return new Set(
    (Array.isArray(requests) ? requests : [])
      .filter(isConfirmedPurchase)
      .map((request) => request.offerKey)
      .filter((offerKey) => typeof offerKey === "string" && offerKey.length > 0),
  );
}

export function resolveRequestStatus({
  authLoading = false,
  isAuthenticated = false,
  queryStatus = "pending",
  connectionState = {},
} = {}) {
  if (authLoading) return "loading";
  if (!isAuthenticated) return "error";
  if (queryStatus === "error") return "error";
  if (queryStatus === "pending") return "loading";

  // Convex keeps the last successful query value in its local cache while a
  // socket reconnects. Never turn that stale value into a paid entitlement.
  if (connectionState.hasEverConnected && connectionState.isWebSocketConnected === false) {
    return "error";
  }

  return "ready";
}

export function resolveResourceAccess(resource, { status = "ready", requests = [] } = {}) {
  const accessKey = resourceAccessKey(resource);

  if (accessKey === "free" || resource?.accessRule === "free") {
    return { kind: "free", unlocked: true, accessKey };
  }

  // English purchases live in bookings/entitlements, not clientRequests. Do
  // not infer access from another offer or from a stale editorial flag.
  if (accessKey === "english") {
    return {
      kind: "separate-model",
      unlocked: false,
      accessKey,
      source: ENGLISH_RIGHTS_SOURCE,
    };
  }

  if (status !== "ready") {
    return {
      kind: status === "error" ? "unavailable" : "loading",
      unlocked: false,
      accessKey,
    };
  }

  const offerKey = OFFER_BY_RESOURCE_ACCESS[accessKey];
  if (!offerKey) return { kind: "locked", unlocked: false, accessKey };

  return getConfirmedOfferKeys(requests).has(offerKey)
    ? { kind: "purchased", unlocked: true, accessKey, offerKey }
    : { kind: "locked", unlocked: false, accessKey, offerKey };
}

export function hasDeliveredLessonContent(resource) {
  return Boolean(
    (resource?.format === "Leçon" || resource?.format === "Article") &&
    Array.isArray(resource.content) &&
    resource.content.some((section) =>
      section &&
      typeof section.text === "string" &&
      section.text.trim().length > 0,
    ),
  );
}
