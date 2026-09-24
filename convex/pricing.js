import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import {
  DEFAULT_PRICES,
  PRICE_CURRENCY,
  defaultPrice,
  formatPriceLabel,
  nextPrice,
  resolvePrice,
} from "../lib/pricing-core.mjs";

export async function getCurrentPrice(ctx, variantKey) {
  const stored = await ctx.db.query("prices")
    .withIndex("by_variant_key", (query) => query.eq("variantKey", variantKey))
    .first();
  return resolvePrice(variantKey, stored);
}

function publicPrice(price) {
  return {
    priceCents: price.priceCents,
    version: price.version,
    currency: PRICE_CURRENCY,
    priceLabel: formatPriceLabel(price.priceCents, price.variantKey),
  };
}

async function catalog(ctx, includeAdmin) {
  const rows = await ctx.db.query("prices").collect();
  const byKey = new Map(rows.map((row) => [row.variantKey, row]));
  const prices = Object.fromEntries(Object.keys(DEFAULT_PRICES).map((key) => {
    const price = resolvePrice(key, byKey.get(key));
    return [key, includeAdmin
      ? { ...publicPrice(price), ...(price.updatedAt === undefined ? {} : { updatedAt: price.updatedAt }),
        ...(price.updatedBy === undefined ? {} : { updatedBy: price.updatedBy }) }
      : publicPrice(price)];
  }));
  return { currency: PRICE_CURRENCY, prices };
}

async function requireAdmin(ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) throw new Error("UNAUTHENTICATED: Authentication required");
  const tokenIdentifier = identity.tokenIdentifier || identity.subject;
  const profile = await ctx.db.query("users")
    .withIndex("by_token_identifier", (query) => query.eq("tokenIdentifier", tokenIdentifier))
    .first();
  if (profile?.role !== "admin" || profile.clerkUserId !== identity.subject) {
    throw new Error("FORBIDDEN: Administrator access required");
  }
  return identity;
}

export const getPublicCatalog = queryGeneric({
  args: {},
  handler: async (ctx) => catalog(ctx, false),
});

export const getAdminCatalog = queryGeneric({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return catalog(ctx, true);
  },
});

export const setPrice = mutationGeneric({
  args: { variantKey: v.string(), priceCents: v.number(), expectedVersion: v.number() },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);
    // Validate the fixed catalog key before querying or writing any record.
    defaultPrice(args.variantKey);
    const stored = await ctx.db.query("prices")
      .withIndex("by_variant_key", (query) => query.eq("variantKey", args.variantKey))
      .first();
    const updated = nextPrice(resolvePrice(args.variantKey, stored), args.expectedVersion, args.priceCents);
    const value = {
      variantKey: args.variantKey,
      currency: PRICE_CURRENCY,
      priceCents: updated.priceCents,
      version: updated.version,
      updatedAt: Date.now(),
      updatedBy: identity.subject,
    };
    if (stored) await ctx.db.patch(stored._id, value);
    else await ctx.db.insert("prices", value);
    return { variantKey: args.variantKey, ...publicPrice(value), updatedAt: value.updatedAt, updatedBy: value.updatedBy };
  },
});
