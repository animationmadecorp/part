// Framework-free rules for the English lesson entitlement. The booking
// entitlement is the only existing purchase record for this product.

export const ENGLISH_OFFER_KEY = "anglais";

// A partial refund keeps the entitlement record active in the existing
// booking model. A full refund/revocation removes access to private lessons.
export function isEnglishLessonEntitlement(entitlement) {
  return Boolean(
    entitlement &&
    entitlement.offerKey === ENGLISH_OFFER_KEY &&
    entitlement.status !== "refunded" &&
    entitlement.refundStatus !== "refunded",
  );
}

// `validUntil` belongs to the reservation-credit contract in bookings. There
// is no separate lesson-license expiration field or published English access
// rule, so this module deliberately does not infer one from pack validity.
export function hasEnglishLessonAccess(entitlements) {
  return (Array.isArray(entitlements) ? entitlements : []).some(isEnglishLessonEntitlement);
}

export function latestOpenedLesson(progressRows) {
  return (Array.isArray(progressRows) ? progressRows : [])
    .filter((row) => Number.isFinite(row?.lastOpenedAt))
    .sort((left, right) => right.lastOpenedAt - left.lastOpenedAt)[0] || null;
}
