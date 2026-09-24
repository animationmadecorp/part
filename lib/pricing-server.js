import "server-only";

import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { DEFAULT_PRICES, PRICE_CURRENCY, formatPriceLabel } from "./pricing-core.mjs";

function localCatalog() {
  return {
    currency: PRICE_CURRENCY,
    prices: Object.fromEntries(Object.entries(DEFAULT_PRICES).map(([variantKey, priceCents]) => [
      variantKey,
      { priceCents, version: 1, currency: PRICE_CURRENCY, priceLabel: formatPriceLabel(priceCents, variantKey) },
    ])),
  };
}

/** Read the same published prices used by Convex when it creates a payment record. */
export async function getPublishedPriceCatalog() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!url) return localCatalog();
  const client = new ConvexHttpClient(url, { logger: false });
  // A configured provider error must not be mistaken for an unedited default.
  return client.query(anyApi.pricing.getPublicCatalog, {});
}

export function publishedPrice(catalog, variantKey) {
  const price = catalog?.prices?.[variantKey];
  if (!price || !Number.isSafeInteger(price.priceCents) || !Number.isSafeInteger(price.version)) {
    throw new Error(`Published price unavailable for ${variantKey}`);
  }
  return price;
}
