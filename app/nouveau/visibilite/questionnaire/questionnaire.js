"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { Header, Footer } from "../../_components/Shared";
import PrePaymentRecap from "../../_components/PrePaymentRecap";
import { useClientRequestCheckout } from "../../_components/clientRequestCheckout";
import { paymentLabel } from "../../_components/prePaymentLogic.mjs";
import { questions } from "../../_data/contentQuestionnaire";
import {
  contentOffer,
  createQuestionnaireState,
  isRequiredAnswerValid,
  questionnaireReducer,
} from "./questionnaire-logic.mjs";
import "../../feedback/projet/questionnaire/questionnaire.css";
import "./questionnaire.css";

const storageKey = "animation-made:content-questionnaire:v1";
const sections = [
  { title: "Ton profil", indexes: [0, 1, 2] },
  { title: "Tes envies de contenu", indexes: [3, 4, 5, 6] },
  { title: "Tes exemples", indexes: [7, 8, 9] },
];

export default function ContentQuestionnaire({ requestId = null }) {
  const [{ answers, files, step }, dispatch] = useReducer(
    questionnaireReducer,
    questions.length,
    createQuestionnaireState,
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
  } = useClientRequestCheckout({
    offerKey: "contenu",
    draftStorageKey: storageKey,
    requestId,
  });
  const fileInput = useRef(null);
  const questionnaireHeading = useRef(null);
  const recapHeading = useRef(null);
  const firstRender = useRef(true);
  const hydratedDraft = useRef("");
  const hydrationKey = `${userId || "signed-out"}:${requestId || "new"}:${localDraftKey}`;
  const draftReady = !serverLoading && ready;
  const visibleAnswers = draftReady ? answers : Array(questions.length).fill("");
  const visibleFiles = draftReady ? files : [];
  const visibleStoredFiles = draftReady ? storedFiles : [];
  const visibleStep = draftReady ? step : "questionnaire";

  /* eslint-disable react-hooks/set-state-in-effect -- localStorage is available only after client hydration. */
  useEffect(() => {
    if (serverLoading) {
      setReady(false);
      return;
    }
    if (hydratedDraft.current === hydrationKey) {
      setReady(true);
      return;
    }
    let answers = Array(questions.length).fill("");
    try {
      if (requestId) {
        answers = Array.isArray(serverRequest?.answers?.answers)
          ? serverRequest.answers.answers
          : answers;
      } else {
        const saved = JSON.parse(localStorage.getItem(localDraftKey) || "null");
        if (Array.isArray(saved)) answers = answers.map((_, i) => typeof saved[i] === "string" ? saved[i] : "");
      }
    } catch { setError("Le brouillon précédent n’a pas pu être récupéré."); }
    dispatch({ type: "reset_draft", answers });
    hydratedDraft.current = hydrationKey;
    setReady(true);
  }, [hydrationKey, localDraftKey, requestId, serverLoading, serverRequest, userId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    (step === "recap" ? recapHeading : questionnaireHeading).current?.focus();
  }, [step]);

  function update(index, value) {
    const next = answers.map((answer, i) => i === index ? value : answer);
    dispatch({ type: "update_answer", index, value });
    try { localStorage.setItem(localDraftKey, JSON.stringify(next)); setError(""); }
    catch { setError("La sauvegarde est indisponible. Garde cette page ouverte pour conserver tes réponses."); }
  }

  function addFiles(event) {
    const selected = Array.from(event.target.files || []);
    dispatch({ type: "add_files", files: selected });
    event.target.value = "";
  }

  function showRecap(event) {
    event.preventDefault();
    const form = event.currentTarget;
    form.querySelectorAll("textarea[required]").forEach((field) => {
      field.setCustomValidity(isRequiredAnswerValid(field.value) ? "" : "Merci de renseigner cette réponse.");
    });
    if (!form.reportValidity()) return;
    dispatch({ type: "show_recap" });
  }

  function editAnswers() {
    dispatch({ type: "edit_answers" });
  }

  const page = visibleStep === "recap" ? <PrePaymentRecap
    headingRef={recapHeading}
    offer={{
      ...contentOffer,
      priceLabel: displayPrice?.priceLabel || "Tarif indisponible",
      launchPriceEnd: displayPrice?.version === 1 ? contentOffer.launchPriceEnd : null,
      format: "Fiche personnalisée · Sans visio",
      details: [
        "Une fiche personnalisée préparée à partir de ton questionnaire, sans appel vidéo.",
        "Livraison sous 10 jours maximum après réception de ton questionnaire complet et du paiement.",
      ],
    }}
    paymentText={displayPrice ? paymentLabel(displayPrice.priceLabel) : "Tarif indisponible"}
    onPayment={() => startCheckout({ answers: visibleAnswers, files: visibleFiles })}
    paymentDisabled={paymentBusy || !displayPrice}
    paymentBusyLabel={displayPrice ? undefined : "Tarif indisponible"}
    paymentBusyMessage={displayPrice ? undefined : "Recharge la page pour connaître le montant avant de payer."}
    paymentError={paymentError}
    onEdit={editAnswers}
    files={[...visibleStoredFiles, ...visibleFiles]}
    items={questions.map(([label, hint], index) => ({
      label,
      value: visibleAnswers[index],
      fallback: hint?.startsWith("Facultatif.") ? "Non renseigné" : "—",
    }))}
  /> : <>
    <Link className="am-project-back" href="/nouveau/visibilite">Revenir à l’offre contenu</Link>
    <p className="am-eyebrow am-project-eyebrow">Questionnaire</p>
    <h1 ref={questionnaireHeading} tabIndex={-1} className="am-project-title">Ta direction <em>de contenu.</em></h1>
    <p className="am-project-intro">Tes réponses et tes exemples me permettront de préparer une fiche adaptée à ton travail et à tes ambitions.</p>
    <form className="am-project-form" onSubmit={showRecap}>
      {sections.map(({ title, indexes }, sectionIndex) => <fieldset disabled={!ready || !draftReady} className="am-content-section" key={title}>
        <legend><span>0{sectionIndex + 1}</span>{title}</legend>
        {indexes.map(index => {
          const [label, hint = ""] = questions[index];
          const optional = hint.startsWith("Facultatif.");
          const help = hint.replace(/^Facultatif\.\s*/, "");
          return <div className="am-content-question" key={label}>
            <label htmlFor={`content-answer-${index}`}>{label}{optional && <span className="am-field-hint">Facultatif</span>}</label>
            {help && <p className="am-field-hint" id={`content-help-${index}`}>{help}</p>}
            <textarea className="am-field-control" id={`content-answer-${index}`} name={`answer-${index}`} rows={3} required={!optional} aria-describedby={help ? `content-help-${index}` : undefined} value={visibleAnswers[index]} onChange={event => { event.currentTarget.setCustomValidity(""); update(index, event.target.value); }} />
            {index === 7 && <>
              <p className="am-field-hint">Liens Drive, YouTube, Vimeo… Vérifie que tes liens privés sont accessibles.</p>
              <input ref={fileInput} type="file" hidden multiple accept="image/*,.pdf,.mov,.mp4" onChange={addFiles} />
              <div className="am-project-attachment-row"><button className="am-secondary-button" type="button" onClick={() => fileInput.current?.click()}>Ajouter des fichiers</button><span className="am-field-hint">Facultatif · Images, PDF, MOV ou MP4</span></div>
              {visibleStoredFiles.length > 0 && <ul className="am-content-files">{visibleStoredFiles.map((file) => <li key={file.id}><span>{file.name}</span><button type="button" aria-label={`Retirer ${file.name}`} onClick={async () => { const removed = await removeStoredFile(file.id); if (removed && typeof removed === "object") dispatch({ type: "remove_matching_file", file: removed }); }}>Retirer</button></li>)}</ul>}
              {visibleFiles.length > 0 && <ul className="am-content-files">{visibleFiles.map((file, i) => <li key={`${file.name}-${file.lastModified}-${file.size}`}><span>{file.name}</span><button type="button" aria-label={`Retirer ${file.name}`} onClick={() => dispatch({ type: "remove_file", index: i })}>Retirer</button></li>)}</ul>}
            </>}
          </div>;
        })}
      </fieldset>)}
      {(error || paymentError) && <p role="alert">{error || paymentError}</p>}
      <p className="am-field-hint">Les réponses restent dans un brouillon isolé sur cet appareil. Après l’envoi, les pièces jointes sont conservées dans ton dossier privé pour éviter un nouvel envoi.</p>
      <button className="am-button" type="submit">Continuer vers le paiement</button>
    </form>
  </>;

  return <><Header /><main className="am-container am-project-questionnaire am-content-questionnaire">
    {page}
  </main><Footer /></>;
}
