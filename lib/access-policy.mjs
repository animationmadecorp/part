export const ROUTE_ACCESS = Object.freeze({
  PUBLIC: "public",
  MEMBER: "member",
  ADMIN: "admin",
});

export function decideAccess({
  scope = ROUTE_ACCESS.PUBLIC,
  configured = false,
  authenticated = false,
  role = null,
}) {
  if (scope === ROUTE_ACCESS.PUBLIC) {
    return { allowed: true, reason: "public" };
  }

  if (!configured) {
    return { allowed: false, reason: "configuration_required" };
  }

  if (!authenticated) {
    return { allowed: false, reason: "unauthenticated" };
  }

  if (scope === ROUTE_ACCESS.ADMIN && role !== "admin") {
    return { allowed: false, reason: "forbidden" };
  }

  return { allowed: true, reason: "authorized" };
}
