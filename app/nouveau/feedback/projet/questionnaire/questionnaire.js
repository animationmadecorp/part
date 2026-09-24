"use client";
import { useEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Header, Footer } from "../../../_components/Shared";
import PrePaymentRecap from "../../../_components/PrePaymentRecap";
import { useClientRequestCheckout } from "../../../_components/clientRequestCheckout";
import { createPrePaymentState, isNonBlank, paymentLabel, prePaymentReducer } from "../../../_components/prePaymentLogic.mjs";
import { animationProjectOffer } from "../../../_data/prePaymentOffers.mjs";
import "./questionnaire.css";

const key = "animation-made:project-questionnaire:v1";
const empty = { idea: "", goal: "", difficulty: "", references: "", stage: "", software: "" };
export default function ProjectQuestionnaire({ requestId = null }) {
  const [{ answers, files, step }, dispatch] = useReducer(
    prePaymentReducer,
    undefined,
    () => createPrePaymentState({ answers: empty, files: [] }),
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
    offerKey: "projet-animation",
    draftStorageKey: key,
    requestId,
  });
  const fileInput = useRef(null);
  const recapHeading = useRef(null);
  const questionnaireHeading = useRef(null);
  const firstRender = useRef(true);
  const hydratedDraft = useRef("");
  const hydrationKey = `${userId || "signed-out"}:${requestId || "new"}:${localDraftKey}`;
  const draftReady = !serverLoading && ready;
  const visibleAnswers = draftReady ? answers : { ...empty };
  const visibleFiles = draftReady ? files : [];
  const visibleStoredFiles = draftReady ? storedFiles : [];
  const visibleStep = draftReady ? step : "form";
  /* eslint-disable react-hooks/set-state-in-effect -- localStorage is available only after client hydration. */
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (step === "form") questionnaireHeading.current?.focus();
  }, [step]);
  useEffect(() => {
    if (serverLoading) {
      setReady(false);
      return;
    }
    if (hydratedDraft.current === hydrationKey) {
      setReady(true);
      return;
    }
    let restored = { ...empty };
    try {
      if (requestId) {
        if (serverRequest?.answers && typeof serverRequest.answers === "object") {
          restored = Object.fromEntries(Object.entries(empty).map(([name, value]) => [
            name,
            typeof serverRequest.answers[name] === "string" ? serverRequest.answers[name] : value,
          ]));
        }
      } else {
        const saved = JSON.parse(localStorage.getItem(localDraftKey) || "null");
        if (saved && typeof saved === "object") restored = Object.fromEntries(Object.entries(empty).map(([name, value]) => [name, typeof saved[name] === "string" ? saved[name] : value]));
      }
    } catch { setError("Le brouillon précédent n’a pas pu être récupéré."); }
    dispatch({ type: "patch", values: { answers: restored, files: [], step: "form" } });
    hydratedDraft.current = hydrationKey;
    setReady(true);
  }, [hydrationKey, localDraftKey, requestId, serverLoading, serverRequest, userId]);
  /* eslint-enable react-hooks/set-state-in-effect */
  function update(name, value) {
    const next = { ...answers, [name]: value };
    dispatch({ type: "patch", values: { answers: next } });
    try { localStorage.setItem(localDraftKey, JSON.stringify(next)); setError(""); }
    catch { setError("La sauvegarde locale est indisponible. Garde cette page ouverte pour conserver tes réponses."); }
  }
  function showRecap(event) {
    event.preventDefault();
    event.currentTarget.querySelectorAll("textarea[required], input[required]").forEach((control) => {
      control.setCustomValidity(isNonBlank(control.value) ? "" : "Merci de renseigner cette réponse.");
    });
    if (!event.currentTarget.reportValidity()) return;
    dispatch({ type: "show_recap" });
  }
  const field = (name, label, optional, placeholder) => <label className="am-project-field">{label}{optional && <small className="am-field-hint"><em>Facultatif</em></small>}<textarea className="am-field-control" name={name} rows={3} required={!optional} value={visibleAnswers[name]} onChange={e => { e.currentTarget.setCustomValidity(""); update(name,e.target.value); }} placeholder={placeholder} /></label>;
  const page = visibleStep === "recap" ? <PrePaymentRecap
    headingRef={recapHeading}
    offer={{ ...animationProjectOffer, priceLabel: displayPrice?.priceLabel || "Tarif indisponible", launchPriceEnd: displayPrice?.version === 1 ? animationProjectOffer.launchPriceEnd : null }}
    paymentText={displayPrice ? paymentLabel(displayPrice.priceLabel) : "Tarif indisponible"}
    onPayment={() => startCheckout({ answers: visibleAnswers, files: visibleFiles })}
    paymentDisabled={paymentBusy || !displayPrice}
    paymentBusyLabel={displayPrice ? undefined : "Tarif indisponible"}
    paymentBusyMessage={displayPrice ? undefined : "Recharge la page pour connaître le montant avant de payer."}
    paymentError={paymentError}
    onEdit={() => dispatch({ type: "edit" })}
    files={[...visibleStoredFiles, ...visibleFiles]}
    items={[
      { label: "Ton idée de plan", value: visibleAnswers.idea },
      { label: "Ce que tu veux montrer", value: visibleAnswers.goal },
      { label: "Difficulté particulière", value: visibleAnswers.difficulty },
      { label: "Ton avancement", value: visibleAnswers.stage },
      { label: "Ton logiciel", value: visibleAnswers.software },
      { label: "Tes références", value: visibleAnswers.references },
    ]}
  /> : <>
    <Link className="am-project-back" href="/nouveau/feedback#projet-animation">Revenir au projet d’animation</Link>
    <p className="am-eyebrow am-project-eyebrow">Questionnaire</p><h1 ref={questionnaireHeading} tabIndex={-1} className="am-project-title">Ton projet <em>d’animation.</em></h1>
    <p className="am-project-intro">Un plan de 15 secondes maximum. Tu peux arriver avec une idée seulement : pas besoin d’avoir déjà ton rig ou ta scène prêts.</p>
    <form className="am-project-form" onSubmit={showRecap}><fieldset disabled={!ready || !draftReady}>
      {field("idea", "Décris ton idée de plan.", false, "Le mouvement, l’action ou l’intention que tu imagines…")}
      {field("goal", "Que veux-tu montrer avec ce plan ? Quel est ton but ?", false, "L’effet recherché, ce que tu souhaites exprimer ou travailler…")}
      {field("difficulty", "Y a-t-il quelque chose qui te pose problème en particulier ?", true, "Un mouvement, une seconde, un enchaînement, un principe d’animation…")}
      <label className="am-project-field">Où en es-tu ?<span className="am-project-select-wrap"><select className="am-field-control am-project-select" required value={visibleAnswers.stage} onChange={e => update("stage",e.target.value)}><option value="" disabled>Sélectionne ton avancement</option>{["Une idée seulement", "Préparation commencée", "Animation commencée"].map(s => <option key={s}>{s}</option>)}</select><ChevronDown className="am-project-select-icon" aria-hidden="true" size={22}/></span></label>
      <label className="am-project-field">Quel logiciel utilises-tu ?<input className="am-field-control" name="software" required value={visibleAnswers.software} onChange={e => { e.currentTarget.setCustomValidity(""); update("software",e.target.value); }} placeholder="Blender, Maya…" /></label>
      <section className="am-project-references" aria-labelledby="references-title">
        <div className="am-project-reference-heading"><h2 id="references-title">Tes références</h2><span>Facultatif</span></div>
        <label htmlFor="project-references">Liens Drive, YouTube, Vimeo…</label>
        <textarea className="am-field-control" id="project-references" rows={3} value={visibleAnswers.references} onChange={e => update("references", e.target.value)} placeholder="Colle tes liens et ce qui t’inspire."/>
        <input ref={fileInput} type="file" multiple accept="image/*,.pdf,.mov,.mp4" hidden onChange={e => { dispatch({ type: "patch", values: { files: [...files,...Array.from(e.target.files || [])] } }); e.target.value = ""; }}/>
        <div className="am-project-attachment-row"><button className="am-secondary-button" type="button" onClick={() => fileInput.current?.click()}>Ajouter des fichiers</button><span className="am-field-hint">Images, PDF ou vidéos</span></div>
        {visibleStoredFiles.length > 0 && <ul>{visibleStoredFiles.map((file) => <li key={file.id}><span>{file.name}</span><button type="button" onClick={async () => { const removed = await removeStoredFile(file.id); if (removed && typeof removed === "object") dispatch({ type: "patch", values: { files: files.filter((localFile) => !(localFile.name === removed.name && Number(localFile.size) === Number(removed.size))) } }); }} aria-label={`Retirer ${file.name}`}>Retirer</button></li>)}</ul>}
        {visibleFiles.length > 0 && <ul>{visibleFiles.map((file,i) => <li key={`${file.name}-${i}`}><span>{file.name}</span><button type="button" onClick={() => dispatch({ type: "patch", values: { files: files.filter((_,index) => index !== i) } })} aria-label={`Retirer ${file.name}`}>Retirer</button></li>)}</ul>}
        <details><summary>Partage des liens et sauvegarde</summary><p>Vérifie que tes liens privés sont accessibles. Les réponses restent dans un brouillon isolé sur cet appareil. Après l’envoi, les pièces jointes sont conservées dans ton dossier privé.</p></details>
      </section>
      {(error || paymentError) && <p role="alert">{error || paymentError}</p>}
      <button type="submit" className="am-button">Continuer vers le paiement</button>
    </fieldset></form>
  </>;
  return <><Header/><main className="am-container am-project-questionnaire">{page}</main><Footer/></>;
}
