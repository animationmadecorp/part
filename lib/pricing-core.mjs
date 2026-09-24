// Stable commercial keys shared by Convex, checkout and the public interface.
// Version 1 is the source default; an edited price starts at version 2.
export const DEFAULT_PRICES = Object.freeze({
  "booking:anglais:solo": 5500,
  "booking:anglais:solo-4h": 20000,
  "booking:anglais:solo-8h": 36000,
  "booking:anglais:duo": 6800,
  "request:review": 2800,
  "request:contenu": 5800,
  "request:projet-animation": 8800,
  "request:feedback": 3800,
});

export const PRICE_CURRENCY = "eur";

export function bookingPriceKey(offerKey, mode) {
  return `booking:${offerKey}:${mode}`;
}

export function requestPriceKey(offerKey) {
  return `request:${offerKey}`;
}

export function assertPriceCents(value) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 100_000_000) {
    throw new Error("INVALID_PRICE: Amount must be a positive integer in cents");
  }
  return value;
}

export function defaultPrice(variantKey) {
  if (!Object.prototype.hasOwnProperty.call(DEFAULT_PRICES, variantKey)) {
    throw new Error("INVALID_VARIANT: Unknown price variant");
  }
  return { variantKey, priceCents: DEFAULT_PRICES[variantKey], currency: PRICE_CURRENCY, version: 1 };
}

export function resolvePrice(variantKey, stored) {
  const fallback = defaultPrice(variantKey);
  if (!stored) return fallback;
  if (stored.variantKey !== variantKey || stored.currency !== PRICE_CURRENCY ||
      !Number.isSafeInteger(stored.version) || stored.version < 2) {
    throw new Error("INVALID_PRICE_RECORD: Invalid stored price");
  }
  return { ...fallback, priceCents: assertPriceCents(stored.priceCents), version: stored.version,
    updatedAt: stored.updatedAt, updatedBy: stored.updatedBy };
}

export function assertPresentedPriceVersion(actual, presentedVersion) {
  if (!Number.isSafeInteger(presentedVersion) || presentedVersion < 1) {
    throw new Error("INVALID_PRICE_VERSION: Invalid price version");
  }
  if (actual.version !== presentedVersion) {
    throw new Error("PRICE_CHANGED: The price has changed; refresh the offer before continuing");
  }
  return actual;
}

// During a backend-first rollout, an already-open page has no quote version.
// It may use only the unchanged initial catalog, never an edited price.
export function assertCompatiblePriceVersion(actual, presentedVersion) {
  if (presentedVersion === undefined) {
    if (actual.version !== 1) {
      throw new Error("PRICE_CHANGED: Refresh the offer before continuing");
    }
    return actual;
  }
  return assertPresentedPriceVersion(actual, presentedVersion);
}

export function nextPrice(current, expectedVersion, priceCents) {
  assertPriceCents(priceCents);
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
    throw new Error("INVALID_PRICE_VERSION: Invalid expected version");
  }
  if (current.version !== expectedVersion) {
    throw new Error("PRICE_VERSION_CONFLICT: Another price edit was saved first");
  }
  return { ...current, priceCents, version: current.version + 1 };
}

export function formatPriceLabel(priceCents, variantKey) {
  assertPriceCents(priceCents);
  const amount = new Intl.NumberFormat("fr-FR", {
    style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(priceCents / 100).replace(/[\u00a0\u202f]/g, " ");
  return variantKey === "booking:anglais:solo-4h" || variantKey === "booking:anglais:solo-8h"
    ? `${amount} le pack` : amount;
}

export function recordedAmount(priceCents, fallbackCents) {
  return assertPriceCents(priceCents === undefined || priceCents === null ? fallbackCents : priceCents);
}
