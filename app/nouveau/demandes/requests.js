"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import ConvexErrorBoundary from "../_components/ConvexErrorBoundary";
import PdfDelivery from "./PdfDelivery";
import BookReviewDelivery from "./BookReviewDelivery";

const STATUSES = [
  { key: "todo", label: "À traiter" },
  { key: "in_progress", label: "En cours" },
  { key: "done", label: "Terminées" },
];

const ANSWER_LABELS = {
  objective: "Objectif",
  dream: "Direction souhaitée",
  workTypes: "Types de travaux",
  workLink: "Lien vers le travail",
  password: "Mot de passe du lien",
  selfAssessment: "Auto-évaluation",
  authorization: "Autorisation de consultation",
  idea: "Idée du projet",
  goal: "Objectif du projet",
  difficulty: "Difficulté rencontrée",
  references: "Références",
  stage: "Étape du projet",
  software: "Logiciel",
  plans: "Plans à corriger",
  total: "Durée totale",
  intent: "Intention du feedback",
  blocker: "Point de blocage",
};

function labelFor(key) {
  return ANSWER_LABELS[key] || key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function formatDate(value) {
  if (!value) return "—";
  try { return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
  catch { return "—"; }
}

function formatBytes(value) {
  if (!Number.isFinite(value)) return "—";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} Ko`;
  return `${(value / (1024 * 1024)).toFixed(1)} Mo`;
}

function AnswerValue({ value }) {
  if (Array.isArray(value)) {
    return <ul className="am-request-value-list">{value.map((item, index) => <li key={index}>{typeof item === "object" && item !== null ? Object.entries(item).map(([key, nested]) => `${labelFor(key)} : ${String(nested)}`).join(" · ") : String(item)}</li>)}</ul>;
  }
  if (typeof value === "boolean") return <p>{value ? "Oui" : "Non"}</p>;
  if (value === null || value === undefined || value === "") return <p>—</p>;
  return <p>{String(value)}</p>;
}

function AnswerList({ answers, valid }) {
  if (!valid) return <p className="am-request-warning">Les réponses enregistrées ne peuvent pas être interprétées avec les règles actuelles.</p>;
  if (!answers || typeof answers !== "object") return <p>Aucune réponse enregistrée.</p>;
  const entries = Object.entries(answers);
  if (!entries.length) return <p>Aucune réponse enregistrée.</p>;
  return <div>{entries.map(([key, value]) => <div className="am-request-answer" key={key}><strong>{labelFor(key)}</strong><AnswerValue value={value}/></div>)}</div>;
}

function StatusTabs({ requests, selectedStatus, onSelect }) {
  return <nav aria-label="Statut des demandes">{STATUSES.map((status) => <button key={status.key} type="button" aria-pressed={status.key === selectedStatus} onClick={() => onSelect(status.key)}>{status.label}<span>{requests.filter((request) => request.workStatus === status.key).length}</span></button>)}</nav>;
}

function RequestsContent({ initialRequestId = null }) {
  const requests = useQuery("adminRequests:getAdminRequests", {});
  const setWorkStatus = useMutation("adminRequests:setWorkStatus");
  const [selectedStatus, setSelectedStatus] = useState("todo");
  const [selectedId, setSelectedId] = useState(initialRequestId);
  const [query, setQuery] = useState("");
  const [actionKey, setActionKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const selectedForReview = Array.isArray(requests)
    ? requests.find((request) => request.id === selectedId)
    : null;
  const reviewProgress = useQuery(
    "reviewStudio:getAdminReviewProgress",
    selectedForReview?.requestStatus === "paid" && selectedForReview.paymentStatus === "paid" && ["projet-animation", "feedback", "review"].includes(selectedForReview.offerKey)
      ? { requestId: selectedForReview.id }
      : "skip",
  );

  if (requests === undefined) {
    return <main className="am-requests"><section className="am-request-empty" aria-live="polite"><h1>Chargement des <em>demandes.</em></h1><p>Lecture des commandes et questionnaires depuis Convex.</p></section></main>;
  }

  const selected = requests.find((request) => request.id === selectedId) || null;
  const normalizedQuery = query.trim().toLocaleLowerCase("fr");
  const filtered = requests.filter((request) => request.workStatus === selectedStatus && `${request.email || ""} ${request.offerTitle}`.toLocaleLowerCase("fr").includes(normalizedQuery));

  async function updateStatus(nextStatus) {
    if (!selected || actionKey) return;
    setActionKey(`status:${selected.id}`);
    setError("");
    setNotice("");
    try {
      await setWorkStatus({ requestId: selected.id, workStatus: nextStatus });
      setNotice("Le statut est enregistré dans Convex et audité dans l’historique du dossier.");
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Le statut n’a pas pu être enregistré.");
    } finally {
      setActionKey("");
    }
  }

  return <main className="am-requests">
    <header className="am-requests-heading"><div><p className="am-eyebrow">Espace de travail administrateur</p><h1>Les <em>demandes réelles.</em></h1><p>Commandes payées, questionnaires et fichiers lus depuis Convex. Aucun brouillon non payé n’entre dans cette file.</p></div></header>
    {error && <p className="am-request-error" role="alert">{error}</p>}
    {notice && <p className="am-request-success" role="status">{notice}</p>}
    <div className="am-request-tools"><StatusTabs requests={requests} selectedStatus={selectedStatus} onSelect={(status) => { setSelectedStatus(status); setSelectedId(null); setNotice(""); }}/><input className="am-field-control am-request-search" aria-label="Rechercher une demande" placeholder="Un e-mail, une offre…" value={query} onChange={(event) => setQuery(event.target.value)}/></div>
    <div className="am-request-grid"><section aria-label="Liste des demandes" className="am-request-list">
      <div className="am-request-columns"><span>Client et offre</span><span>Mis à jour</span></div>
      {filtered.length ? filtered.map((request) => <button key={request.id} type="button" className="am-request-row" aria-pressed={selected?.id === request.id} onClick={() => { setSelectedId(request.id); setNotice(""); }}><span><strong>{request.email || "E-mail indisponible"}</strong><small>{request.offerTitle} · Paiement {request.paymentStatus}</small></span><span>{formatDate(request.updatedAt)}</span></button>) : <div className="am-request-empty"><h2>{requests.length ? (query ? "Aucun résultat." : "Aucun dossier ici.") : "Aucune commande réelle."}</h2><p>{requests.length ? (query ? "Essaie un autre e-mail ou une autre offre." : "Choisis un autre statut pour consulter les dossiers persistés.") : "Les commandes et questionnaires apparaîtront ici après leur enregistrement dans Convex."}</p></div>}
    </section><aside className="am-request-detail" aria-live="polite">{selected ? <>
      <div className="am-request-detail-top"><p className="am-eyebrow">{selected.offerTitle}</p><span>{selected.workStatusLabel}</span></div>
      <h2>{selected.email || "Client sans e-mail"}</h2>
      <p className="am-request-deadline"><strong>Dernière mise à jour</strong>{formatDate(selected.updatedAt)}</p>
      <p className="am-request-payment">Paiement : <strong>{selected.paymentStatus}</strong> · Dossier : <strong>{selected.requestStatus}</strong></p>
      <h3>Questionnaire réel</h3><AnswerList answers={selected.answers} valid={selected.answersValid}/>
      <h3>Fichiers contrôlés par le serveur</h3><div className="am-request-files">{selected.files?.length ? selected.files.map((file) => file.downloadUrl ? <a key={file.id} href={file.downloadUrl} target="_blank" rel="noreferrer"><span><strong>{file.name}</strong><small>{file.kind} · {formatBytes(file.size)}</small></span><span>Ouvrir</span></a> : <span key={file.id}><strong>{file.name}</strong><small>URL temporairement indisponible</small></span>) : <p>Aucun fichier enregistré.</p>}</div>
      {selected.requestStatus === "paid" && selected.paymentStatus === "paid" && ["projet-animation", "feedback"].includes(selected.offerKey) && <ReviewStudioLinks request={selected} progress={reviewProgress}/>} 
      <h3>Historique audité</h3><div className="am-request-events">{selected.events?.length ? [...selected.events].reverse().slice(0, 8).map((event) => <div key={event.id}><strong>{event.eventType}</strong><small>{event.fromStatus ? `${event.fromStatus} → ` : ""}{event.toStatus} · {formatDate(event.createdAt)} · {event.sourceId || "système"}</small></div>) : <p>Aucun événement enregistré.</p>}</div>
      <div className="am-request-status-actions" aria-label="Modifier le statut">{STATUSES.filter((status) => status.key !== selected.workStatus).map((status) => <button type="button" key={status.key} disabled={Boolean(actionKey)} onClick={() => updateStatus(status.key)}>{status.key === "done" ? "Marquer terminée" : `Passer ${status.label.toLocaleLowerCase("fr")}`}</button>)}</div>
    </> : <><p className="am-eyebrow">Le dossier</p><h2>Les données réelles,<br/><em>sans dossier inventé.</em></h2><p>Sélectionne une commande pour retrouver le questionnaire, les fichiers accessibles par le serveur et l’historique des actions.</p><div className="am-request-outline"><span>Questionnaire Convex</span><span>Fichiers contrôlés</span><span>Historique audité</span></div></>}</aside></div>
    {selected?.requestStatus === "paid" && selected?.paymentStatus === "paid" && <PdfDelivery key={selected.id} request={selected} onDelivered={() => setNotice("Le PDF est enregistré dans Convex et l’événement de livraison est audité.")}/>} 
    {selected?.requestStatus === "paid" && selected?.paymentStatus === "paid" && selected?.offerKey === "review" && <BookReviewDelivery key={`book-review:${selected.id}`} requestId={selected.id} progress={reviewProgress} onPublished={() => setNotice("Le deuxième retour book est publié et audité dans le dossier.")}/>} 
  </main>;
}

function ReviewStudioLinks({ request, progress }) {
  const videoFiles = (request.files || []).filter((file) => file.mimeType?.startsWith("video/") && file.id);
  const firstCycle = progress?.cycles?.find((cycle) => cycle.cycleNumber === 1);
  const secondCycle = progress?.cycles?.find((cycle) => cycle.cycleNumber === 2);
  const submissions = Array.isArray(progress?.submissions) ? progress.submissions : [];
  const firstSubmission = submissions.find((submission) => submission.sequence === 1);
  const secondSubmission = submissions.find((submission) => submission.sequence === 2);
  // A project questionnaire video is reference material, not a review source.
  // Only a post-preparation client submission may open the project studio.
  const firstFile = firstSubmission?.files?.[0]?.id;
  const secondFile = secondSubmission?.files?.[0]?.id;
  const firstLinks = request.offerKey === "feedback"
    ? videoFiles.map((file, index) => ({ label: `Annoter le plan ${index + 1}`, cycle: 1, sourceFileId: file.id }))
    : firstFile ? [{ label: "Ouvrir la première review", cycle: 1, sourceFileId: firstFile }] : [];
  const cycleLinks = request.offerKey === "projet-animation" && secondCycle && secondFile
    ? [{ label: "Ouvrir la deuxième review", cycle: 2, sourceFileId: secondFile }]
    : [];
  const links = [...firstLinks, ...cycleLinks];
  if (!links.length) return <p className="am-request-studio-link"><span>Le studio s’ouvrira quand une version vidéo sera attachée à ce dossier.</span></p>;
  return <div className="am-request-studio-links" aria-label="Reviews incluses">
    {links.map((link) => <Link className="am-button" key={`${link.cycle}:${link.sourceFileId || "none"}`} href={`/nouveau/studio?requestId=${encodeURIComponent(request.id)}&cycle=${link.cycle}${link.sourceFileId ? `&sourceFileId=${encodeURIComponent(link.sourceFileId)}` : ""}`}>{link.label}</Link>)}
    {request.offerKey === "projet-animation" && firstCycle?.status === "published" && !secondCycle && <small>La deuxième review s’ouvrira après réception de la version corrigée.</small>}
  </div>;
}

export default function Requests(props) {
  return <ConvexErrorBoundary title="Les demandes Convex sont momentanément indisponibles."><RequestsContent {...props}/></ConvexErrorBoundary>;
}
