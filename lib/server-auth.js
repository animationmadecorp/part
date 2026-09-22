import "server-only";

import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { getAuthFoundationConfig } from "@/lib/auth-config";
import { decideAccess, ROUTE_ACCESS } from "@/lib/access-policy.mjs";

const getCurrentProfileRef = anyApi.users.getCurrentProfile;
const ensureCurrentProfileRef = anyApi.users.ensureCurrentProfile;
const updateCurrentProfileRef = anyApi.users.updateCurrentProfile;

export async function getClerkSession() {
  const config = getAuthFoundationConfig();
  if (!config.clerkConfigured) {
    return {
      configured: false,
      authenticated: false,
      reason: "configuration_required",
    };
  }

  try {
    const clerk = await auth();
    if (!clerk?.userId) {
      return { configured: true, authenticated: false, reason: "unauthenticated" };
    }
    return { configured: true, authenticated: true, userId: clerk.userId, clerk };
  } catch {
    // Fail closed when Clerk is partially configured or its request context is
    // unavailable. Never fall back to the legacy signed cookie here.
    return { configured: true, authenticated: false, reason: "unavailable" };
  }
}

export async function requireMemberPage() {
  const session = await getClerkSession();
  if (session.reason === "unavailable") return { ...session, ok: false };

  const decision = decideAccess({
    scope: ROUTE_ACCESS.MEMBER,
    configured: session.configured,
    authenticated: session.authenticated,
  });
  return { ...session, ...decision, ok: decision.allowed };
}

// Booking pages are interactive Convex clients, so a Clerk-only session is
// not enough. Verify the Clerk JWT template and the profile sync on the server
// before rendering the client component; otherwise a missing Convex provider
// can look like an endless client-side spinner.
export async function requireConnectedMemberPage() {
  const session = await getClerkSession();
  if (session.reason === "unavailable") return { ...session, ok: false };
  if (!session.authenticated) return { ...session, ok: false };

  const config = getAuthFoundationConfig();
  if (!config.foundationConfigured) {
    return { ...session, configured: false, ok: false, reason: "configuration_required" };
  }

  const profileResult = await getCurrentProfile(session, { ensure: true });
  if (!profileResult.ok) return { ...session, ...profileResult, ok: false };
  return { ...session, ...profileResult, ok: true, reason: "authorized" };
}

async function getConvexClient(session) {
  const config = getAuthFoundationConfig();
  if (!config.foundationConfigured) {
    return { ok: false, reason: "configuration_required" };
  }

  let token;
  try {
    // The Convex JWT template must be configured in Clerk. A missing template
    // is an unavailable integration, never evidence of a signed-in user.
    token = await session.clerk.getToken({ template: "convex" });
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (!token) return { ok: false, reason: "configuration_required" };

  try {
    const client = new ConvexHttpClient(config.convexUrl, { logger: false });
    client.setAuth(token);
    return { ok: true, client };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

// Route handlers use the same Clerk-issued Convex token as the client
// provider. This keeps server-side reads and mutations on one auth seam.
export async function getAuthenticatedConvexClient(session) {
  return getConvexClient(session);
}

export async function getCurrentProfile(session, { ensure = false } = {}) {
  const convex = await getConvexClient(session);
  if (!convex.ok) return convex;

  try {
    if (ensure) await convex.client.mutation(ensureCurrentProfileRef, {});
    const profile = await convex.client.query(getCurrentProfileRef, {});
    if (!profile) return { ok: false, reason: "unavailable" };
    return { ok: true, profile };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function updateCurrentProfileForSession(session, patch) {
  const convex = await getConvexClient(session);
  if (!convex.ok) return convex;

  try {
    const profile = await convex.client.mutation(updateCurrentProfileRef, patch);
    return { ok: true, profile };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function requireAdminPage() {
  const session = await getClerkSession();
  if (session.reason === "unavailable") return { ...session, ok: false };
  if (!session.authenticated) return { ...session, ok: false };

  const config = getAuthFoundationConfig();
  if (!config.foundationConfigured) {
    return { ...session, configured: false, ok: false, reason: "configuration_required" };
  }

  const profileResult = await getCurrentProfile(session, { ensure: true });
  if (!profileResult.ok) return { ...session, ...profileResult, ok: false };

  const decision = decideAccess({
    scope: ROUTE_ACCESS.ADMIN,
    configured: true,
    authenticated: true,
    role: profileResult.profile.role,
  });
  return {
    ...session,
    ...profileResult,
    ...decision,
    ok: decision.allowed,
  };
}

export function accessStatus(reason) {
  if (reason === "unauthenticated" || reason === "forbidden") {
    return reason === "forbidden" ? 403 : 401;
  }
  return 503;
}
