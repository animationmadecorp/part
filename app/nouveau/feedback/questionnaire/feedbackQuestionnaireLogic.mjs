import { isNonBlank } from "../../_components/prePaymentLogic.mjs";

export const FEEDBACK_MAX_PLANS = 3;
export const FEEDBACK_MAX_SECONDS = 15;

export function feedbackTotalDuration(plans) {
  return (Array.isArray(plans) ? plans : []).reduce(
    (sum, plan) => sum + (Number.isFinite(plan?.duration) ? plan.duration : 0),
    0,
  );
}

export function feedbackHydrationState({ requestId = null, activeRequestId = null, serverRequest = null } = {}) {
  const terminal = new Set(["paid", "refunded", "cancelled"]);
  const serverDraftLocked = Boolean(
    serverRequest?.offerKey === "feedback" &&
    !terminal.has(serverRequest.status) &&
    (serverRequest.checkoutPending || serverRequest.checkoutSessionId),
  );
  const shouldRestoreServerDraft = Boolean(requestId || serverDraftLocked);
  const serverHydrationIdentity = serverDraftLocked
    ? `${activeRequestId || serverRequest?.id || "none"}:${serverRequest?.updatedAt || "none"}`
    : (requestId ? `requested:${requestId}` : "local");
  return { serverDraftLocked, shouldRestoreServerDraft, serverHydrationIdentity };
}

export function validateFeedbackQuestionnaire({ plans, intent }) {
  if (!Array.isArray(plans) || plans.length === 0) {
    return "Choisis au moins un plan à faire analyser.";
  }
  if (plans.length > FEEDBACK_MAX_PLANS) {
    return "Tu peux sélectionner 3 plans maximum.";
  }
  if (plans.some((plan) => !Number.isFinite(plan?.duration) || plan.duration <= 0)) {
    return "La durée de chaque plan doit être supérieure à zéro.";
  }
  if (feedbackTotalDuration(plans) > FEEDBACK_MAX_SECONDS + 0.05) {
    return "Tes plans dépassent 15 secondes au total.";
  }
  if (!isNonBlank(intent)) {
    return "Explique ce que tu veux montrer avec ces plans.";
  }
  return "";
}
