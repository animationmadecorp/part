"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { Header, Footer } from "../../_components/Shared";
import PrePaymentRecap from "../../_components/PrePaymentRecap";
import { useClientRequestCheckout } from "../../_components/clientRequestCheckout";
import { createPrePaymentState, paymentLabel, prePaymentReducer } from "../../_components/prePaymentLogic.mjs";
import { feedbackOffer } from "../../_data/prePaymentOffers.mjs";
import FeedbackDeposit from "../../bibliotheque/FeedbackDeposit";
import { feedbackHydrationState } from "./feedbackQuestionnaireLogic.mjs";
import "../../bibliotheque/follow-up.css";
import "../projet/questionnaire/questionnaire.css";

const STORAGE_KEY = "animation-made:feedback-questionnaire:v2";
const EMPTY_SUBMISSION = Object.freeze({
  plans: [],
  intent: "",
  blocker: "",
  references: "",
  total: 0,
});

function normalizeLocalDraft(value) {
  if (!value || typeof value !== "object") return { ...EMPTY_SUBMISSION };
  return {
    ...EMPTY_SUBMISSION,
    intent: typeof value.intent === "string" ? value.intent : "",
    blocker: typeof value.blocker === "string" ? value.blocker : "",
    references: typeof value.references === "string" ? value.references : "",
  };
}

function normalizeServerDraft(value, files) {
  if (!value || typeof value !== "object") return { ...EMPTY_SUBMISSION };
  const storedFiles = Array.isArray(files) ? [...files] : [];
  const plans = Array.isArray(value.plans)
    ? value.plans.map((plan) => {
      const storedIndex = storedFiles.findIndex((file) =>
        file.name === plan?.name &&
        (plan?.size === undefined || Number(file.size) === Number(plan.size)) &&
        (plan?.mimeType === undefined || String(file.mimeType || "").toLowerCase() === String(plan.mimeType).toLowerCase()),
      );
      const stored = storedIndex >= 0 ? storedFiles.splice(storedIndex, 1)[0] : null;
      return {
        name: plan?.name,
        duration: plan?.duration,
        size: plan?.size,
        mimeType: plan?.mimeType,
        file: stored ? { ...stored, type: stored.mimeType, mimeType: stored.mimeType } : undefined,
        fileId: stored?.id,
        persisted: Boolean(stored),
        missing: !stored,
      };
    })
    : [];
  return {
    plans,
    intent: typeof value.intent === "string" ? value.intent : "",
    blocker: typeof value.blocker === "string" ? value.blocker : "",
    references: typeof value.references === "string" ? value.references : "",
    total: Number.isFinite(value.total) ? value.total : plans.reduce((sum, plan) => sum + plan.duration, 0),
  };
}

function answerPayload(submission) {
  return {
    plans: submission.plans.map((plan) => ({
      name: plan.file?.name || plan.name,
      duration: plan.duration,
      ...(Number.isSafeInteger(Number(plan.file?.size ?? plan.size)) && Number(plan.file?.size ?? plan.size) > 0
        ? { size: Number(plan.file?.size ?? plan.size) }
        : {}),
      ...((plan.file?.mimeType || plan.file?.type || plan.mimeType)
        ? { mimeType: String(plan.file?.mimeType || plan.file?.type || plan.mimeType).toLowerCase() }
        : {}),
    })),
    intent: submission.intent,
    blocker: submission.blocker,
    references: submission.references,
  };
}

export default function FeedbackQuestionnaire({ requestId = null }) {
  const [{ step, submission }, dispatch] = useReducer(
    prePaymentReducer,
    undefined,
    () => createPrePaymentState({ submission: null }),
  );
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const {
    startCheckout,
    isBusy: paymentBusy,
    error: paymentError,
    userId,
    localDraftKey,
    serverRequest,
    serverLoading,
    displayPrice,
    storedFiles,
    removeStoredFile,
    requestId: activeRequestId,
  } = useClientRequestCheckout({
    offerKey: "feedback",
    draftStorageKey: STORAGE_KEY,
    requestId,
  });
  const recapHeading = useRef(null);
  const questionnaireHeading = useRef(null);
  const firstRender = useRef(true);
  const hydratedDraft = useRef("");
  // A newly created editable dossier is only a server reservation. Its
  // response has no browser File objects, so changing activeRequestId or
  // updatedAt must not replace the in-memory selection B. A locked dossier
  // discovered through that reservation is different: its server answers and
  // metadata are authoritative and must replace B exactly once per snapshot.
  const { serverDraftLocked, shouldRestoreServerDraft, serverHydrationIdentity } = feedbackHydrationState({
    requestId,
    activeRequestId,
    serverRequest,
  });
  const hydrationKey = `${userId || "signed-out"}:${requestId || "new"}:${localDraftKey}:${serverHydrationIdentity}`;
  const draftReady = !serverLoading && ready;
  const visibleSubmission = draftReady ? (submission || EMPTY_SUBMISSION) : EMPTY_SUBMISSION;
  const checkoutLocked = Boolean(
    draftReady &&
    !["paid", "refunded", "cancelled"].includes(serverRequest?.status) &&
    (serverRequest?.checkoutPending || serverRequest?.checkoutSessionId),
  );
  const visibleStep = draftReady ? (checkoutLocked ? "recap" : step) : "form";
  const localFiles = visibleSubmission.plans
    .filter((plan) => !plan.persisted && !plan.missing && plan.file)
    .map((plan) => plan.file);

  /* eslint-disable react-hooks/set-state-in-effect -- restore one server/browser draft after client hydration. */
  useEffect(() => {
    if (serverLoading) {
      setReady(false);
      return;
    }
    if (hydratedDraft.current === hydrationKey) {
      setReady(true);
      return;
    }
    const restored = shouldRestoreServerDraft
      ? normalizeServerDraft(serverRequest?.answers, serverRequest?.files)
      : (() => {
        try {
          return normalizeLocalDraft(JSON.parse(window.localStorage.getItem(localDraftKey) || "null"));
        } catch {
          setError("Le brouillon précédent n’a pas pu être récupéré.");
          return { ...EMPTY_SUBMISSION };
        }
      })();
    dispatch({ type: "patch", values: { submission: restored, step: "form" } });
    hydratedDraft.current = hydrationKey;
    setReady(true);
  }, [hydrationKey, localDraftKey, requestId, serverLoading, serverRequest, shouldRestoreServerDraft, userId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    (step === "recap" ? recapHeading : questionnaireHeading).current?.focus();
  }, [step]);

  function saveLocalText(next) {
    if (requestId) return;
    try {
      window.localStorage.setItem(localDraftKey, JSON.stringify({
        intent: next.intent,
        blocker: next.blocker,
        references: next.references,
      }));
      setError("");
    } catch {
      setError("La sauvegarde locale est indisponible. Garde cette page ouverte pour conserver tes réponses.");
    }
  }

  function removeServerFile(fileId) {
    if (!fileId) return false;
    // FeedbackDeposit owns the in-progress form state. Do not replace it from
    // the parent snapshot after an async deletion: that would restore stale
    // text or newly selected local plans on the next render.
    return removeStoredFile(fileId);
  }

  function continueToPayment(nextSubmission) {
    dispatch({ type: "patch", values: { submission: nextSubmission } });
    dispatch({ type: "show_recap" });
  }

  function pay() {
    startCheckout({
      answers: answerPayload(visibleSubmission),
      files: localFiles,
    });
  }

  return <><Header/><main className="am-container am-project-questionnaire">
    <div hidden={visibleStep === "recap"}>
      <Link className="am-project-back" href="/nouveau/feedback">Revenir au feedback d’animation</Link>
      <p className="am-eyebrow am-project-eyebrow">Questionnaire</p>
      <h1 ref={questionnaireHeading} tabIndex={-1} className="am-project-title">Tes plans <em>d’animation.</em></h1>
      <p className="am-project-intro">Ajoute jusqu’à 3 plans, pour 15 secondes cumulées maximum, puis indique ce que tu veux travailler.</p>
      <FeedbackDeposit
        mode="prepurchase"
        initialSubmission={visibleSubmission}
        onDraftChange={saveLocalText}
        onRemoveStoredFile={removeServerFile}
        onContinue={continueToPayment}
        draftStorageKey={localDraftKey}
        disabled={!draftReady || checkoutLocked}
      />
    </div>
    {visibleStep === "recap" && <PrePaymentRecap
      headingRef={recapHeading}
      offer={{ ...feedbackOffer, priceLabel: displayPrice?.priceLabel || "Tarif indisponible", launchPriceEnd: displayPrice?.version === 1 ? feedbackOffer.launchPriceEnd : null }}
      paymentText={displayPrice ? paymentLabel(displayPrice.priceLabel) : "Tarif indisponible"}
      onPayment={pay}
      paymentDisabled={paymentBusy || !displayPrice}
      paymentBusyLabel={displayPrice ? undefined : "Tarif indisponible"}
      paymentBusyMessage={displayPrice ? undefined : "Recharge la page pour connaître le montant avant de payer."}
      paymentError={paymentError || error}
      onEdit={() => dispatch({ type: "edit" })}
      files={[...storedFiles, ...localFiles]}
      filesTitle="Plans sélectionnés"
      items={[
        { label: "Durée cumulée", value: `${visibleSubmission.total.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} seconde${visibleSubmission.total > 1 ? "s" : ""}` },
        { label: "Ce que tu veux montrer", value: visibleSubmission.intent },
        { label: "Difficulté particulière", value: visibleSubmission.blocker },
        { label: "Tes références", value: visibleSubmission.references },
      ]}
    />}
    {error && visibleStep !== "recap" && <p role="alert">{error}</p>}
  </main><Footer/></>;
}
