"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Footer, Header } from "../_components/Shared";
import PrePaymentRecap from "../_components/PrePaymentRecap";
import { useClientRequestCheckout } from "../_components/clientRequestCheckout";
import {
  createPrePaymentState,
  paymentLabel,
  prePaymentReducer,
  requiredFieldMessage,
} from "../_components/prePaymentLogic.mjs";
import { reviewOffer } from "../_data/prePaymentOffers.mjs";

const STORAGE_KEY = "animation-made:review-questionnaire:v1";
const workTypes = [
  "Animation 3D",
  "Animation 2D",
  "Modélisation",
  "Book généraliste",
];

const emptyForm = {
  objective: "",
  dream: "",
  workTypes: [],
  workLink: "",
  password: "",
  selfAssessment: "",
  authorization: false,
};

function normalizeForm(value) {
  if (!value || typeof value !== "object") return { ...emptyForm };
  return {
    ...emptyForm,
    ...value,
    workTypes: Array.isArray(value.workTypes) ? value.workTypes : [],
    authorization: value.authorization === true,
  };
}

export default function Questionnaire({ requestId = null }) {
  const [{ form, step }, dispatch] = useReducer(
    prePaymentReducer,
    undefined,
    () => createPrePaymentState({ form: emptyForm }),
  );
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const {
    startCheckout,
    isBusy: paymentBusy,
    error: paymentError,
    userId,
    localDraftKey,
    serverRequest,
    serverLoading,
  } = useClientRequestCheckout({
    offerKey: "review",
    draftStorageKey: STORAGE_KEY,
    requestId,
  });
  const recapHeading = useRef(null);
  const questionnaireHeading = useRef(null);
  const firstRender = useRef(true);
  const hydratedDraft = useRef("");
  const hydrationKey = `${userId || "signed-out"}:${requestId || "new"}:${localDraftKey}`;
  const draftReady = !serverLoading && ready;
  const visibleForm = draftReady ? form : emptyForm;
  const visibleStep = draftReady ? step : "form";

  /* eslint-disable react-hooks/set-state-in-effect -- restore a server or browser draft after hydration. */
  useEffect(() => {
    if (serverLoading) {
      setReady(false);
      return;
    }
    if (hydratedDraft.current === hydrationKey) {
      setReady(true);
      return;
    }
    const restored = requestId
      ? normalizeForm(serverRequest?.answers)
      : (() => {
        try {
          return normalizeForm(JSON.parse(window.localStorage.getItem(localDraftKey) || "null"));
        } catch {
          setError("Le brouillon précédent n’a pas pu être récupéré.");
          return { ...emptyForm };
        }
      })();
    dispatch({ type: "patch", values: { form: restored, step: "form" } });
    hydratedDraft.current = hydrationKey;
    setReady(true);
  }, [hydrationKey, localDraftKey, requestId, serverLoading, serverRequest, userId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (step === "form") questionnaireHeading.current?.focus();
  }, [step]);

  function updateField(field, value) {
    setError("");
    const next = { ...form, [field]: value };
    dispatch({ type: "patch", values: { form: next } });
    try { window.localStorage.setItem(localDraftKey, JSON.stringify(next)); }
    catch { setError("Les réponses ne peuvent pas être enregistrées dans ce navigateur."); }
  }

  function toggleWorkType(type) {
    updateField(
      "workTypes",
      form.workTypes.includes(type)
        ? form.workTypes.filter((item) => item !== type)
        : [...form.workTypes, type],
    );
  }

  function submit(event) {
    event.preventDefault();
    const workLink = event.currentTarget.elements.namedItem("workLink");
    const selfAssessment = event.currentTarget.elements.namedItem("selfAssessment");
    workLink.setCustomValidity(requiredFieldMessage(form.workLink, "Ajoute le lien vers tes travaux."));
    selfAssessment.setCustomValidity(requiredFieldMessage(form.selfAssessment, "Ajoute ton impression actuelle."));
    if (!event.currentTarget.reportValidity()) return;
    if (!form.workTypes.length) {
      setError("Sélectionne au moins un type de travaux.");
      return;
    }
    if (!form.workLink.trim() || !form.selfAssessment.trim()) {
      setError("Ajoute le lien vers tes travaux et ton impression actuelle.");
      return;
    }
    if (!form.authorization) {
      setError("Confirme que je peux consulter les travaux liés à cette review.");
      return;
    }
    try {
      window.localStorage.setItem(localDraftKey, JSON.stringify(form));
    } catch {
      setError("Les réponses ne peuvent pas être enregistrées dans ce navigateur.");
      return;
    }
    setError("");
    dispatch({ type: "show_recap" });
  }

  return (
    <>
      <Header />
      <main className="am-container am-questionnaire">
        <Link className="am-back" href="/nouveau/review">
          <ArrowLeft size={16} /> Retour à la review
        </Link>
        {visibleStep === "form" && <div className="am-questionnaire-heading">
          <p className="am-eyebrow">AVANT LA REVIEW</p>
          <h1 ref={questionnaireHeading} tabIndex={-1}>Quelques questions<br /><em>pour savoir où tu vas.</em></h1>
          <p>
            Réponds à ces questions pour que je comprenne ton parcours, tes travaux et ce que tu veux construire ensuite.
          </p>
        </div>}

        {visibleStep === "recap" ? (
          <PrePaymentRecap
            headingRef={recapHeading}
            offer={reviewOffer}
            paymentText={paymentLabel(reviewOffer.priceLabel)}
            onPayment={() => startCheckout({ answers: visibleForm, files: [] })}
            paymentDisabled={paymentBusy}
            paymentError={paymentError}
            onEdit={() => dispatch({ type: "edit" })}
            files={null}
            items={[
              { label: "Ton objectif à court terme", value: visibleForm.objective },
              { label: "Ton objectif à plus long terme ou ton rêve", value: visibleForm.dream },
              { label: "Types de travaux", value: visibleForm.workTypes },
              { label: "Lien vers ton book ou ton showreel", value: visibleForm.workLink },
              { label: "Mot de passe", value: visibleForm.password ? "Renseigné" : "Non renseigné" },
              { label: "Ton regard sur ton travail", value: visibleForm.selfAssessment },
              { label: "Autorisation de consultation", value: visibleForm.authorization ? "Confirmée" : "—" },
            ]}
          />
        ) : (
          <form className="am-questionnaire-form" onSubmit={submit}>
            <fieldset disabled={!draftReady}>
              <legend>Ce que tu veux construire</legend>
              <label>
                Ton objectif à court terme <span>(facultatif)</span>
                <textarea
                  className="am-field-control"
                  value={visibleForm.objective}
                  onChange={(event) => updateField("objective", event.target.value)}
                  placeholder="Ex. préparer une candidature pour un stage"
                  rows={3}
                />
              </label>
              <label>
                Ton objectif à plus long terme ou ton rêve <span>(facultatif)</span>
                <textarea
                  className="am-field-control"
                  value={visibleForm.dream}
                  onChange={(event) => updateField("dream", event.target.value)}
                  placeholder="Ex. travailler sur des longs métrages d’animation"
                  rows={3}
                />
              </label>
            </fieldset>

            <fieldset>
              <legend>Les travaux concernés</legend>
              <p className="am-questionnaire-hint">Tu peux sélectionner plusieurs réponses.</p>
              <div className="am-questionnaire-options">
                {workTypes.map((type) => (
                  <label key={type} className="am-questionnaire-option">
                    <input
                      type="checkbox"
                      checked={visibleForm.workTypes.includes(type)}
                      onChange={() => toggleWorkType(type)}
                    />
                    <span>{type}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>Le lien vers ton travail</legend>
              <label>
                Lien vers ton book ou ton showreel <strong aria-hidden="true">*</strong>
                <input
                  className="am-field-control"
                  name="workLink"
                  type="url"
                  value={visibleForm.workLink}
                  onChange={(event) => { event.currentTarget.setCustomValidity(""); updateField("workLink", event.target.value); }}
                  placeholder="https://…"
                  required
                />
                <small>Colle l’adresse complète de ton book ou de ta vidéo, par exemple https://ton-site.fr/showreel.</small>
              </label>
              <label>
                Mot de passe <span>(facultatif)</span>
                <input
                  className="am-field-control"
                  type="text"
                  value={visibleForm.password}
                  onChange={(event) => updateField("password", event.target.value)}
                  placeholder="Si ton lien est protégé"
                />
              </label>
            </fieldset>

            <fieldset>
              <legend>Ton regard sur ton travail</legend>
              <label>
                Comment tu juges ton book ou ton showreel aujourd’hui ? <strong aria-hidden="true">*</strong>
                <textarea
                  className="am-field-control"
                  name="selfAssessment"
                  value={visibleForm.selfAssessment}
                  onChange={(event) => { event.currentTarget.setCustomValidity(""); updateField("selfAssessment", event.target.value); }}
                  placeholder="Ce qui te plaît, ce qui te fait hésiter, ce que tu n’arrives pas encore à trancher…"
                  rows={5}
                  required
                />
              </label>
            </fieldset>

            <label className="am-questionnaire-consent">
              <input
                type="checkbox"
                checked={visibleForm.authorization}
                onChange={(event) => updateField("authorization", event.target.checked)}
              />
              <span>J’autorise Made à consulter les travaux liés à cette demande de review. <strong aria-hidden="true">*</strong></span>
            </label>

            {error ? <p className="am-questionnaire-error" role="alert">{error}</p> : null}
            <button className="am-button" type="submit">Continuer vers le paiement <ArrowUpRight size={17} /></button>
          </form>
        )}
      </main>
      <Footer />
    </>
  );
}
