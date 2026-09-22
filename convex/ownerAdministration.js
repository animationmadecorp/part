import { internalMutation } from "./_generated/server.js";
import { v } from "convex/values";

function refuse(code) {
  throw new Error(`OWNER_PROMOTION_REFUSED: ${code}`);
}

function isExactNonEmptyString(value) {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}

/**
 * One-shot owner promotion for an already-created Clerk profile.
 *
 * This is deliberately an internal mutation: there is no browser, HTTP or
 * public Convex entry point that can invoke it. The caller must supply the
 * profile id and both identity attributes observed during the manual check;
 * the mutation refuses any mismatch or ambiguity before changing the role.
 */
export const promoteOwnerProfile = internalMutation({
  args: {
    id: v.id("users"),
    clerkUserId: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    if (!isExactNonEmptyString(args.clerkUserId) || !isExactNonEmptyString(args.email)) {
      refuse("invalid_identity_arguments");
    }

    const profile = await ctx.db.get(args.id);
    if (!profile) refuse("profile_not_found");

    const profiles = await ctx.db.query("users").collect();
    const exactMatches = profiles.filter(
      (candidate) =>
        candidate._id === args.id
        && candidate.clerkUserId === args.clerkUserId
        && candidate.email === args.email,
    );
    const clerkMatches = profiles.filter((candidate) => candidate.clerkUserId === args.clerkUserId);
    const emailMatches = profiles.filter((candidate) => candidate.email === args.email);

    if (
      exactMatches.length !== 1
      || clerkMatches.length !== 1
      || emailMatches.length !== 1
    ) {
      refuse("ambiguous_identity");
    }

    if (profile.role === "admin") {
      return { ok: true, status: "already_admin", profileId: profile._id };
    }
    if (profile.role !== "member") refuse("unsupported_role");

    await ctx.db.patch(profile._id, { role: "admin", updatedAt: Date.now() });
    return { ok: true, status: "promoted", profileId: profile._id };
  },
});
