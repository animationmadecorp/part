const configuredSiteUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

// The production URL is overridable for previews without changing source or
// exposing any secret. The documented public domain is the safe fallback.
export const SITE_ORIGIN = new URL(
  configuredSiteUrl || "https://animation-made.com",
).origin;

export const NO_INDEX_ROBOTS = {
  index: false,
  follow: false,
};
