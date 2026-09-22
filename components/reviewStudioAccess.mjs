export function getReviewStudioQueryArgs({
  authLoading = true,
  isAuthenticated = false,
  clerkLoaded = false,
  clerkUserId = null,
  requestId = null,
  cycleNumber = 1,
  sourceFileId = null,
} = {}) {
  if (authLoading || !isAuthenticated || !clerkLoaded || typeof clerkUserId !== "string" || !clerkUserId || !requestId) {
    return "skip";
  }
  return {
    requestId,
    cycleNumber,
    ...(sourceFileId ? { sourceFileId } : {}),
  };
}

export function getReviewStudioStatus({
  authLoading = true,
  isAuthenticated = false,
  clerkLoaded = false,
  clerkUserId = null,
  queryStatus = "pending",
} = {}) {
  if (!clerkLoaded || authLoading) return "auth-loading";
  if (!isAuthenticated || typeof clerkUserId !== "string" || !clerkUserId) return "unauthenticated";
  if (queryStatus === "error") return "error";
  if (queryStatus !== "success") return "loading";
  return "ready";
}
