"use client";

import { useState } from "react";
import { useMutation } from "convex/react";

export default function BookReviewDelivery({ requestId, progress, onPublished }) {
  const publishBookReview = useMutation("reviewStudio:publishBookReview");
  const [summary, setSummary] = useState("");
  const [priorities, setPriorities] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cycle = progress?.cycles?.find((item) => item.cycleNumber === 2);
  const submission = progress?.submissions?.find((item) => item.sequence === 2);

  if (!progress) return <section className="am-book-review-delivery"><p>Lecture de la seconde version…</p></section>;
  if (cycle?.status === "published") {
    return <section className="am-book-review-delivery am-book-review-delivery-published" aria-live="polite">
      <p className="am-eyebrow">SECOND RETOUR LIVRÉ</p>
      <h2>Le retour book est publié.</h2>
      <p>Le client retrouvera cette lecture dans son suivi privé. Cette offre ne permet pas de créer un troisième retour.</p>
    </section>;
  }
  if (!submission || !["submitted", "in_review"].includes(submission.status)) {
    return <section className="am-book-review-delivery"><p>La seconde version du book n’a pas encore été déposée par le client.</p></section>;
  }

  async function publish(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await publishBookReview({ requestId, summary, priorities, nextSteps });
      if (!result?.ok) throw new Error("Le retour book n’a pas pu être publié.");
      onPublished?.();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Le retour book n’a pas pu être publié.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="am-book-review-delivery" aria-labelledby="am-book-review-delivery-title">
    <p className="am-eyebrow">SECONDE VERSION REÇUE</p>
    <h2 id="am-book-review-delivery-title">Préparer le deuxième retour.</h2>
    <p>Le lien et le mot de passe restent attachés au dossier privé. Rédige ici la lecture promise, puis publie-la une seule fois.</p>
    <dl className="am-book-review-source">
      <div><dt>Lien reçu</dt><dd><a href={submission.payload?.workLink} target="_blank" rel="noreferrer">{submission.payload?.workLink}</a></dd></div>
      <div><dt>Mot de passe</dt><dd><code>{submission.payload?.password || "Aucun mot de passe"}</code></dd></div>
    </dl>
    <form onSubmit={publish}>
      <label htmlFor="am-book-summary">Synthèse</label>
      <textarea id="am-book-summary" className="am-field-control" required value={summary} onChange={(event) => setSummary(event.target.value)} disabled={busy} />
      <label htmlFor="am-book-priorities">Priorités</label>
      <textarea id="am-book-priorities" className="am-field-control" required value={priorities} onChange={(event) => setPriorities(event.target.value)} disabled={busy} />
      <label htmlFor="am-book-next-steps">Suite conseillée</label>
      <textarea id="am-book-next-steps" className="am-field-control" required value={nextSteps} onChange={(event) => setNextSteps(event.target.value)} disabled={busy} />
      {error && <p className="am-request-error" role="alert">{error}</p>}
      <button type="submit" disabled={busy}>{busy ? "Publication…" : "Publier le deuxième retour"}</button>
    </form>
  </section>;
}
