"use client";

import { useRef, useState } from "react";
import { Film, FileText, Plus } from "lucide-react";
import { useMutation } from "convex/react";

function readVideoMetadata(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    const finish = (metadata) => {
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      if (metadata) resolve(metadata);
      else reject(new Error(`Impossible de lire « ${file.name} ». Exporte ton plan en MP4 H.264 puis réessaie.`));
    };
    const timer = window.setTimeout(() => finish(null), 10000);
    video.onloadedmetadata = () => {
      window.clearTimeout(timer);
      finish({
        duration: Number(video.duration),
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        fps: 24,
      });
    };
    video.onerror = () => {
      window.clearTimeout(timer);
      finish(null);
    };
    video.preload = "metadata";
    video.src = url;
  });
}

function makeUploadKey() {
  return globalThis.crypto?.randomUUID?.() || `submission-upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function submissionFor(progress) {
  return progress?.submissions?.find((submission) => submission.sequence === 2) || null;
}

export default function SubmissionDeposit({ kind, requestId, progress, onSubmitted }) {
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [workLink, setWorkLink] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const prepareUpload = useMutation("reviewStudio:prepareSubmissionUpload");
  const finalizeSubmission = useMutation("reviewStudio:finalizeSubmission");
  const abandonUpload = useMutation("reviewStudio:abandonSubmissionUpload");
  const submitBookRevision = useMutation("reviewStudio:submitBookRevision");
  const existing = submissionFor(progress);
  const sequence = progress?.nextSequence || 2;
  const firstSubmission = progress?.submissions?.find((submission) => submission.sequence === 1);
  const publishedBookCycle = progress?.cycles?.find((cycle) => cycle.cycleNumber === 2 && cycle.status === "published");

  const visibleWorkLink = workLink || existing?.payload?.workLink || "";

  async function selectFile(event) {
    const selected = event.target.files?.[0] || null;
    event.target.value = "";
    if (!selected) return;
    setError("");
    if (!/\.(mp4|mov)$/i.test(selected.name)) {
      setError("Choisis une vidéo MOV ou MP4 exportée en H.264.");
      return;
    }
    try {
      const nextMetadata = await readVideoMetadata(selected);
      if (!Number.isFinite(nextMetadata.duration) || nextMetadata.duration <= 0 || nextMetadata.duration > 15.05) {
        setError("Le même plan doit rester sous 15 secondes.");
        return;
      }
      setFile(selected);
      setMetadata(nextMetadata);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "La vidéo n’a pas pu être lue.");
    }
  }

  async function submitAnimation() {
    if (!requestId || !file || !metadata || busy) return;
    setBusy(true);
    setError("");
    let uploadKey = null;
    try {
      uploadKey = makeUploadKey();
      const prepared = await prepareUpload({
        requestId,
        sequence,
        uploadKey,
        name: file.name,
        mimeType: file.type || (file.name.toLowerCase().endsWith(".mov") ? "video/quicktime" : "video/mp4"),
        size: file.size,
      });
      const response = await fetch(prepared.uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      const uploaded = await response.json().catch(() => null);
      if (!response.ok || !uploaded?.storageId) throw new Error("Le stockage de ta version n’a pas confirmé l’upload.");
      const result = await finalizeSubmission({
        requestId,
        submissionId: prepared.submissionId,
        uploadKey,
        storageId: uploaded.storageId,
        payloadJson: JSON.stringify(metadata),
      });
      if (!result?.ok) throw new Error(result?.error || "La version n’a pas pu être envoyée.");
      setFile(null);
      setMetadata(null);
      onSubmitted?.(result);
    } catch (failure) {
      if (uploadKey) await abandonUpload({ requestId, uploadKey }).catch(() => {});
      setError(failure instanceof Error ? failure.message : "La version n’a pas pu être envoyée.");
    } finally {
      setBusy(false);
    }
  }

  async function submitBook(event) {
    event.preventDefault();
    if (!requestId || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await submitBookRevision({ requestId, workLink: visibleWorkLink, password });
      if (!result?.ok) throw new Error(result?.error || "Le nouveau lien n’a pas pu être envoyé.");
      setPassword("");
      onSubmitted?.(result);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Le nouveau lien n’a pas pu être envoyé.");
    } finally {
      setBusy(false);
    }
  }

  if (existing && existing.status !== "draft") {
    if (kind === "book" && publishedBookCycle?.notes) {
      return <section className="am-submission-status am-book-review-notes" aria-live="polite">
        <strong>Deuxième retour publié</strong>
        <p>{existing.payload?.workLink || "La nouvelle version est enregistrée dans ton dossier privé."}</p>
        <dl>
          <div><dt>Synthèse</dt><dd>{publishedBookCycle.notes.summary}</dd></div>
          <div><dt>Priorités</dt><dd>{publishedBookCycle.notes.priorities}</dd></div>
          <div><dt>Suite conseillée</dt><dd>{publishedBookCycle.notes.nextSteps}</dd></div>
        </dl>
        <small>Ce deuxième retour clôt la prestation incluse. Aucun troisième retour n’est ouvert.</small>
      </section>;
    }
    return <section className="am-submission-status" aria-live="polite">
      <strong>{existing.status === "published" ? "Deuxième retour publié" : "Version reçue"}</strong>
      <p>{existing.files?.[0]?.name || existing.payload?.workLink || "La nouvelle version est enregistrée dans ton dossier privé."}</p>
      <small>{existing.status === "published" ? "Le retour reste regroupé avec ton guide." : "Made pourra maintenant préparer le deuxième retour."}</small>
    </section>;
  }

  if (!progress) return <p className="am-submission-note" role="status">Vérification de l’ouverture du dépôt…</p>;
  if (kind === "animation" && sequence !== 1 && firstSubmission && firstSubmission.status !== "published" && !progress.canSubmit) {
    return <section className="am-submission-status" aria-live="polite">
      <strong>Première version reçue</strong>
      <p>{firstSubmission.files?.[0]?.name || "La version est enregistrée dans ton dossier privé."}</p>
      <small>La première review est en préparation. Le dépôt de la version corrigée s’ouvrira après sa publication.</small>
    </section>;
  }
  if (!progress.canSubmit) return <p className="am-submission-note" role="status">Le dépôt s’ouvrira après la remise du document et la publication de l’étape précédente.</p>;

  if (kind === "book") {
    return <form className="am-submission-deposit" onSubmit={submitBook}>
      <div className="am-deposit-heading"><h3>Ta nouvelle version</h3><span>Deuxième lecture · 1 dépôt maximum</span></div>
      <p id="am-book-revision-help">Envoie le lien vers le même book après tes corrections. Ajoute le mot de passe seulement si le lien est protégé.</p>
      <label htmlFor="am-book-revision-link">Lien du book corrigé</label>
      <input className="am-field-control" id="am-book-revision-link" type="url" required value={visibleWorkLink} onChange={(event) => setWorkLink(event.target.value)} placeholder="https://…" disabled={busy} />
      <label htmlFor="am-book-revision-password">Mot de passe <small className="am-field-hint">Facultatif</small></label>
      <input className="am-field-control" id="am-book-revision-password" type="text" value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} />
      {error && <p className="am-deposit-error" role="alert">{error}</p>}
      <div className="am-follow-actions"><button className="am-button" type="submit" disabled={busy || !visibleWorkLink.trim()}><FileText size={18} aria-hidden="true" />{busy ? "Envoi…" : "Envoyer mon book corrigé"}</button></div>
      <p className="am-deposit-local"><em>Le lien et le mot de passe restent attachés à ce dossier privé. Aucun troisième retour n’est ouvert.</em></p>
    </form>;
  }

  return <section className="am-submission-deposit">
    <div className="am-deposit-heading"><h3>{sequence === 1 ? "Ta première version" : "Ta version corrigée"}</h3><span>{sequence === 1 ? "Première review" : "Deuxième review"} · 1 dépôt maximum</span></div>
    <p id="am-animation-revision-help">Envoie le même plan après tes corrections. MOV ou MP4, H.264 · 15 secondes maximum.</p>
    <input ref={input} type="file" accept=".mov,.mp4" hidden onChange={selectFile} disabled={busy} />
    {file && <div className="am-submission-selected"><Film aria-hidden="true" /><span><strong>{file.name}</strong><small>{metadata?.duration?.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} s</small></span></div>}
    <button type="button" className="am-deposit-add" onClick={() => input.current?.click()} disabled={busy}><Plus size={20} aria-hidden="true" />{file ? "Choisir une autre version" : sequence === 1 ? "Choisir ma première version" : "Choisir ma version corrigée"}</button>
    {error && <p className="am-deposit-error" role="alert">{error}</p>}
    <div className="am-follow-actions"><button className="am-button" type="button" onClick={submitAnimation} disabled={busy || !file || !metadata}>{busy ? "Envoi sécurisé…" : sequence === 1 ? "Envoyer ma première version" : "Envoyer ma version corrigée"}</button></div>
    <p className="am-deposit-local"><em>La vidéo reste sur ton appareil jusqu’à la confirmation de l’envoi. Les anciennes versions restent conservées.</em></p>
  </section>;
}
