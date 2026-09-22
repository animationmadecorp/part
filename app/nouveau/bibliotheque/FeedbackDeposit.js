"use client";

import { useEffect, useRef, useState } from "react";
import { Film, Plus, X } from "lucide-react";
import { validateFeedbackQuestionnaire } from "../feedback/questionnaire/feedbackQuestionnaireLogic.mjs";

const PREPURCHASE_DRAFT_KEY = "animation-made:feedback-questionnaire:v1";

function readDuration(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    const finish = (duration) => {
      clearTimeout(timer);
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      if (Number.isFinite(duration) && duration > 0) resolve(duration);
      else reject(new Error(`Impossible de lire « ${file.name} ». Exporte ton plan en MP4 H.264 puis réessaie.`));
    };
    const timer = setTimeout(() => finish(null), 10000);
    video.preload = "metadata";
    video.onloadedmetadata = () => { video.onloadedmetadata = null; video.onerror = null; finish(video.duration); };
    video.onerror = () => { video.onloadedmetadata = null; video.onerror = null; finish(null); };
    video.src = url;
  });
}

export default function FeedbackDeposit({
  mode = "postpurchase",
  onContinue,
  initialSubmission,
  onDraftChange,
  onRemoveStoredFile,
  draftStorageKey = PREPURCHASE_DRAFT_KEY,
  disabled = false,
}) {
  const input = useRef(null);
  const [plans, setPlans] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [intent, setIntent] = useState("");
  const [blocker, setBlocker] = useState("");
  const [references, setReferences] = useState("");
  const externalDraft = mode === "prepurchase" && (initialSubmission !== undefined || onDraftChange);
  const total = plans.reduce((sum, plan) => sum + (Number.isFinite(plan.duration) ? plan.duration : 0), 0);

  function draftValue(nextPlans = plans, nextIntent = intent, nextBlocker = blocker, nextReferences = references) {
    onDraftChange?.({
      plans: nextPlans.map((plan) => ({
        name: plan.file?.name || plan.name || "",
        duration: plan.duration,
      })),
      intent: nextIntent,
      blocker: nextBlocker,
      references: nextReferences,
    });
  }

  useEffect(() => {
    if (mode !== "prepurchase" || externalDraft) return;
    try {
      const saved = JSON.parse(localStorage.getItem(draftStorageKey) || "null");
      if (!saved || typeof saved !== "object") return;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIntent(typeof saved.intent === "string" ? saved.intent : "");
      setBlocker(typeof saved.blocker === "string" ? saved.blocker : "");
      setReferences(typeof saved.references === "string" ? saved.references : "");
    } catch { setError("Le brouillon précédent n’a pas pu être récupéré."); }
  }, [draftStorageKey, externalDraft, mode]);

  useEffect(() => {
    if (!externalDraft) return;
    const restoredPlans = Array.isArray(initialSubmission?.plans)
      ? initialSubmission.plans.map((plan) => ({
        ...plan,
        file: plan.file || (plan.missing ? undefined : {
          name: plan.name,
          size: plan.size,
          type: plan.mimeType || "video/mp4",
          mimeType: plan.mimeType || "video/mp4",
        }),
        persisted: plan.persisted === true,
      }))
      : [];
    // A server draft contains safe file metadata, never a bearer URL or the
    // file contents. Those entries are marked persisted so checkout can keep
    // them attached without trying to upload a browser-less File.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlans(restoredPlans);
    setIntent(typeof initialSubmission?.intent === "string" ? initialSubmission.intent : "");
    setBlocker(typeof initialSubmission?.blocker === "string" ? initialSubmission.blocker : "");
    setReferences(typeof initialSubmission?.references === "string" ? initialSubmission.references : "");
  }, [externalDraft, initialSubmission]);

  function updateText(field, value) {
    if (field === "intent") setIntent(value);
    else if (field === "blocker") setBlocker(value);
    else setReferences(value);
    if (mode !== "prepurchase") return;
    const nextIntent = field === "intent" ? value : intent;
    const nextBlocker = field === "blocker" ? value : blocker;
    const nextReferences = field === "references" ? value : references;
    if (externalDraft) {
      draftValue(plans, nextIntent, nextBlocker, nextReferences);
      setError("");
      return;
    }
    try { localStorage.setItem(draftStorageKey, JSON.stringify({ intent: nextIntent, blocker: nextBlocker, references: nextReferences })); setError(""); }
    catch { setError("La sauvegarde locale est indisponible. Garde cette page ouverte pour conserver tes réponses."); }
  }

  function continueToRecap() {
    const validationError = validateFeedbackQuestionnaire({ plans, intent });
    if (validationError) { setError(validationError); return; }
    setError("");
    onContinue?.({ plans, intent, blocker, references, total });
  }

  async function selectFiles(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    setError("");
    if (plans.length + files.length > 3) { setError("Tu peux sélectionner 3 plans maximum. Retire un plan pour en ajouter un autre."); return; }
    if (files.some(file => !/\.(mp4|mov)$/i.test(file.name))) { setError("Choisis des vidéos MOV ou MP4, exportées en H.264."); return; }
    setBusy(true);
    try {
      const additions = await Promise.all(files.map(async file => ({ file, duration: await readDuration(file) })));
      if (total + additions.reduce((sum, plan) => sum + plan.duration, 0) > 15.05) {
        setError("Tes plans dépassent 15 secondes au total. Raccourcis-les avant de les sélectionner à nouveau.");
      } else {
        const nextPlans = [...plans, ...additions];
        setPlans(nextPlans);
        draftValue(nextPlans);
      }
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  async function removePlan(index) {
    const plan = plans[index];
    if (!plan) return;
    if (plan.persisted && plan.fileId && onRemoveStoredFile) {
      const removed = await onRemoveStoredFile(plan.fileId || plan.file?.id);
      if (!removed) return;
    }
    const nextPlans = plans.filter((_, planIndex) => planIndex !== index);
    setPlans(nextPlans);
    draftValue(nextPlans);
    setError("");
  }

  return <div className="am-feedback-deposit">
    <div className="am-deposit-heading"><h3>Tes vidéos</h3><span>{plans.length} / 3 plans · {total.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} / 15 s</span></div>
    <p id="am-video-formats">MOV ou MP4, exportés en H.264. Jusqu’à 15 secondes pour l’ensemble de tes plans.</p>
    <input ref={input} type="file" accept=".mov,.mp4" multiple hidden onChange={selectFiles} disabled={disabled || busy} />
    {plans.length > 0 && <ul className="am-deposit-files">{plans.map((plan, index) => { const name = plan.file?.name || plan.name; const state = plan.persisted ? " · enregistré" : plan.missing ? " · à resélectionner" : ""; return <li key={`${name}-${index}`}><Film aria-hidden="true" /><span><strong>{name}</strong><small>{plan.duration.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} s{state}</small></span><button type="button" disabled={disabled || busy} aria-label={`Retirer ${name}`} onClick={() => removePlan(index)}><X size={18} /></button></li>; })}</ul>}
    <button type="button" className="am-deposit-add" aria-describedby="am-video-formats" disabled={disabled || busy || plans.length === 3} onClick={() => input.current?.click()}><Plus size={20} aria-hidden="true" />{busy ? "Lecture des vidéos…" : "Choisir mes vidéos"}</button>
    {error && <p className="am-deposit-error" role="alert">{error}</p>}
    <label htmlFor="am-feedback-intent">Que veux-tu montrer avec ces plans ? Quel est ton but ?</label>
    <textarea className="am-field-control" id="am-feedback-intent" rows={3} required={mode === "prepurchase"} disabled={disabled} value={intent} onChange={(event) => updateText("intent", event.target.value)} placeholder="Par exemple : un salto rapide et dynamique, inspiré d’une scène ou d’une référence…" />
    <label htmlFor="am-feedback-blocker">Y a-t-il quelque chose qui te pose problème en particulier ? <small className="am-field-hint">Facultatif</small></label>
    <p id="am-feedback-examples">Un mouvement, une seconde, un enchaînement, un principe d’animation…</p>
    <textarea className="am-field-control" id="am-feedback-blocker" rows={3} aria-describedby="am-feedback-examples" disabled={disabled} value={blocker} onChange={(event) => updateText("blocker", event.target.value)} placeholder="Indique le plan et le passage si tu souhaites attirer mon attention dessus." />
    <label htmlFor="am-feedback-references">Tes références <small className="am-field-hint">Facultatif</small></label>
    <p id="am-feedback-references-help">Liens Drive, YouTube, Vimeo ou références qui t’inspirent. Vérifie que les liens privés sont accessibles.</p>
    <textarea className="am-field-control" id="am-feedback-references" rows={3} aria-describedby="am-feedback-references-help" disabled={disabled} value={references} onChange={(event) => updateText("references", event.target.value)} placeholder="Colle tes liens et précise ce qui t’inspire…" />
    <div className="am-follow-actions"><button type="button" className="am-button" disabled={disabled || mode === "postpurchase" || busy} onClick={continueToRecap}>{mode === "prepurchase" ? "Continuer vers le paiement" : "Envoyer mes plans"}</button></div>
    <p className="am-deposit-local"><em>Les vidéos sélectionnées restent sur ton appareil. Rien n’est envoyé pour le moment.</em></p>
  </div>;
}
