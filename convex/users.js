import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

const profileArgs = {
  name: v.optional(v.string()),
  locale: v.optional(v.string()),
  timezone: v.optional(v.string()),
  consentVersion: v.optional(v.string()),
};

function requireIdentity(ctx) {
  return ctx.auth.getUserIdentity().then((identity) => {
    if (!identity) throw new Error("Not authenticated");
    const tokenIdentifier = identity.tokenIdentifier || identity.subject;
    if (!tokenIdentifier || !identity.subject) {
      throw new Error("Authenticated identity is incomplete");
    }
    return { ...identity, tokenIdentifier };
  });
}

function validateProfilePatch(args) {
  const limits = { name: 160, locale: 32, timezone: 80, consentVersion: 80 };
  for (const [field, limit] of Object.entries(limits)) {
    if (args[field] !== undefined && args[field].trim().length > limit) {
      throw new Error(`Profile field too long: ${field}`);
    }
  }
}

function publicProfile(profile) {
  if (!profile) return null;
  return {
    _id: profile._id,
    clerkUserId: profile.clerkUserId,
    role: profile.role,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    ...(profile.email === undefined ? {} : { email: profile.email }),
    ...(profile.name === undefined ? {} : { name: profile.name }),
    ...(profile.locale === undefined ? {} : { locale: profile.locale }),
    ...(profile.timezone === undefined ? {} : { timezone: profile.timezone }),
    ...(profile.consentVersion === undefined ? {} : { consentVersion: profile.consentVersion }),
  };
}

async function findCurrentProfile(ctx, tokenIdentifier) {
  return ctx.db
    .query("users")
    .withIndex("by_token_identifier", (query) => query.eq("tokenIdentifier", tokenIdentifier))
    .unique();
}

export const getCurrentProfile = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    return publicProfile(await findCurrentProfile(ctx, identity.tokenIdentifier));
  },
});

export const ensureCurrentProfile = mutationGeneric({
  args: profileArgs,
  handler: async (ctx, args) => {
    validateProfilePatch(args);
    const identity = await requireIdentity(ctx);
    const now = Date.now();
    const current = await findCurrentProfile(ctx, identity.tokenIdentifier);
    const patch = {
      ...(args.name === undefined ? {} : { name: args.name.trim() }),
      ...(args.locale === undefined ? {} : { locale: args.locale.trim() }),
      ...(args.timezone === undefined ? {} : { timezone: args.timezone.trim() }),
      ...(args.consentVersion === undefined ? {} : { consentVersion: args.consentVersion.trim() }),
      updatedAt: now,
      ...(identity.email === undefined ? {} : { email: identity.email }),
    };

    if (current) {
      await ctx.db.patch(current._id, patch);
      return publicProfile({ ...current, ...patch });
    }

    const profile = {
      clerkUserId: identity.subject,
      tokenIdentifier: identity.tokenIdentifier,
      // This is the only creation path exposed to a signed-in client. It never
      // accepts a role, so no browser parameter can create an administrator.
      role: "member",
      createdAt: now,
      updatedAt: now,
      ...(identity.email === undefined ? {} : { email: identity.email }),
      ...((args.name?.trim() || identity.name) === undefined
        ? {}
        : { name: args.name?.trim() || identity.name }),
      ...(args.locale === undefined ? {} : { locale: args.locale.trim() }),
      ...(args.timezone === undefined ? {} : { timezone: args.timezone.trim() }),
      ...(args.consentVersion === undefined ? {} : { consentVersion: args.consentVersion.trim() }),
    };
    const id = await ctx.db.insert("users", profile);
    return publicProfile({ _id: id, ...profile });
  },
});

export const updateCurrentProfile = mutationGeneric({
  args: profileArgs,
  handler: async (ctx, args) => {
    validateProfilePatch(args);
    const identity = await requireIdentity(ctx);
    const current = await findCurrentProfile(ctx, identity.tokenIdentifier);
    if (!current) throw new Error("Profile not initialized");

    const patch = {
      ...(args.name === undefined ? {} : { name: args.name.trim() }),
      ...(args.locale === undefined ? {} : { locale: args.locale.trim() }),
      ...(args.timezone === undefined ? {} : { timezone: args.timezone.trim() }),
      ...(args.consentVersion === undefined ? {} : { consentVersion: args.consentVersion.trim() }),
      updatedAt: Date.now(),
    };
    await ctx.db.patch(current._id, patch);
    return publicProfile({ ...current, ...patch });
  },
});
