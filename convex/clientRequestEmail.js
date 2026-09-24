export function normalizeRequestEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > 320 || /\s/.test(email) || !email.includes("@")) return null;
  return email;
}

export async function resolveOwnerEmail(ctx, owner, preferredEmail) {
  const preferred = normalizeRequestEmail(preferredEmail);
  if (preferred) return preferred;
  if (!owner?.tokenIdentifier || !owner?.clerkUserId) return null;
  const profile = await ctx.db
    .query("users")
    .withIndex("by_token_identifier", (query) => query.eq("tokenIdentifier", owner.tokenIdentifier))
    .unique();
  if (profile?.clerkUserId !== owner.clerkUserId) return null;
  return normalizeRequestEmail(profile.email);
}
