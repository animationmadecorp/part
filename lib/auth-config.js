function runtimeEnv() {
  return typeof process === "undefined" ? {} : process.env;
}

function present(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function parseConvexUrl(value) {
  if (!present(value)) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function getAuthFoundationConfig(env = runtimeEnv()) {
  const hasPublishableKey = present(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const hasSecretKey = present(env.CLERK_SECRET_KEY);
  const convexUrl = parseConvexUrl(env.NEXT_PUBLIC_CONVEX_URL);
  const hasConvexUrl = Boolean(convexUrl);
  const missing = [];

  if (!hasPublishableKey) missing.push("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  if (!hasSecretKey) missing.push("CLERK_SECRET_KEY");
  if (!hasConvexUrl) missing.push("NEXT_PUBLIC_CONVEX_URL");

  return {
    clerkConfigured: hasPublishableKey && hasSecretKey,
    convexConfigured: hasConvexUrl,
    foundationConfigured: hasPublishableKey && hasSecretKey && hasConvexUrl,
    missing,
    convexUrl,
  };
}

export function isClerkConfigured(env = runtimeEnv()) {
  return getAuthFoundationConfig(env).clerkConfigured;
}

export function isFoundationConfigured(env = runtimeEnv()) {
  return getAuthFoundationConfig(env).foundationConfigured;
}
