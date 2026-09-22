const REQUEST_HISTORY_STATUSES = new Set([
  "awaiting_payment",
  "payment_failed",
  "paid",
  "refunded",
  "cancelled",
  "expired",
]);

const OFFER_LABELS = Object.freeze({
  review: "Review de book",
  contenu: "Direction de contenu",
  "projet-animation": "Projet d’animation",
  feedback: "Feedback d’animation",
});

const REQUEST_STATUS_LABELS = Object.freeze({
  awaiting_payment: "Paiement à finaliser",
  payment_failed: "Paiement à reprendre",
  paid: "Paiement confirmé",
  refunded: "Remboursé",
  cancelled: "Annulé",
  expired: "Dossier expiré",
});

const BOOKING_MODE_LABELS = Object.freeze({
  solo: "Cours particulier",
  "solo-4h": "Pack individuel · 4 cours",
  "solo-8h": "Pack individuel · 8 cours",
  duo: "Cours en duo",
});

export function resolveAccountDataStatus({
  authLoading = false,
  isAuthenticated = false,
  queryStatus = "pending",
  identityMatches = true,
  connectionState = {},
} = {}) {
  const retries = Number(connectionState.connectionRetries || 0);
  const connectionFailed = connectionState.isWebSocketConnected === false && retries >= 3;
  if (connectionFailed) return "error";
  if (authLoading) return "loading";
  if (!isAuthenticated) return "signed-out";
  if (queryStatus === "success" && !identityMatches) return "error";
  if (connectionState.hasEverConnected && connectionState.isWebSocketConnected === false) return "error";
  if (queryStatus === "error") return "error";
  if (queryStatus === "pending") return "loading";
  return "ready";
}

export function makeAccountQueryArgs({
  isAuthenticated = false,
  clerkLoaded = false,
  isSignedIn = false,
  userId = null,
  connectionCount = 0,
} = {}) {
  if (!isAuthenticated || !clerkLoaded || !isSignedIn || typeof userId !== "string" || !userId) return "skip";
  return {
    sessionUserId: userId,
    refreshKey: Number.isFinite(connectionCount) ? connectionCount : 0,
  };
}

export function isHistoryRequest(request) {
  if (!request?.id || !REQUEST_HISTORY_STATUSES.has(request.status)) return false;
  if (request.status === "paid") return request.paymentStatus === "paid";
  if (request.status === "refunded") return request.paymentStatus === "refunded";
  return true;
}

export function formatPurchaseAmount(priceCents, currency = "eur") {
  if (!Number.isFinite(priceCents) || typeof currency !== "string" || !currency.trim()) return null;
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(priceCents / 100);
  } catch {
    return null;
  }
}

export function formatHistoryDate(value) {
  if (value === undefined || value === null) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeZone: "Europe/Paris",
  }).format(date);
}

export function mapRequestToPurchaseHistory(request) {
  if (!isHistoryRequest(request)) return null;
  return {
    id: `request:${request.id}`,
    title: OFFER_LABELS[request.offerKey] || "Commande Animation Made",
    detail: "Dossier Animation Made",
    status: REQUEST_STATUS_LABELS[request.status] || "Statut à vérifier",
    statusKey: request.status,
    amount: formatPurchaseAmount(request.priceCents, request.currency),
    date: request.paidAt || request.updatedAt || request.createdAt || null,
    source: "client-request",
    href: `/nouveau/confirmation?requestId=${encodeURIComponent(request.id)}`,
  };
}

export function mapEntitlementToPurchaseHistory(entitlement) {
  if (!entitlement?.id || entitlement.offerKey !== "anglais") return null;
  const isRefunded = entitlement.status === "refunded" || entitlement.refundStatus === "refunded";
  const isPartialRefund = entitlement.status === "partial_refund" || entitlement.refundStatus === "partial";
  return {
    id: `entitlement:${entitlement.id}`,
    title: "Cours d’anglais",
    detail: BOOKING_MODE_LABELS[entitlement.mode] || "Réservation d’anglais",
    status: isRefunded ? "Remboursé" : isPartialRefund ? "Remboursement partiel à traiter" : "Paiement confirmé",
    statusKey: isRefunded ? "refunded" : isPartialRefund ? "partial_refund" : "paid",
    amount: null,
    refundAmount: formatPurchaseAmount(entitlement.refundedAmountCents, "eur"),
    date: entitlement.createdAt || null,
    source: "booking-entitlement",
  };
}

export function buildPurchaseHistory({ requests = [], entitlements = [] } = {}) {
  return [
    ...(Array.isArray(requests) ? requests.map(mapRequestToPurchaseHistory) : []),
    ...(Array.isArray(entitlements) ? entitlements.map(mapEntitlementToPurchaseHistory) : []),
  ]
    .filter(Boolean)
    .sort((left, right) => Number(right.date || 0) - Number(left.date || 0));
}
