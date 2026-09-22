"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, FileText, Film, Clock3 } from "lucide-react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import "./follow-up.css";
import EnglishFollowUp from "./EnglishFollowUp";
import FeedbackDeposit from "./FeedbackDeposit";
import ReviewPlayer from "./ReviewPlayer";
import SubmissionDeposit from "./SubmissionDeposit";
import { getDeliveryForKind, getDeliveryStepIndex } from "./followUpAccess.mjs";

const steps = [
  {
    label: "Préparation",
    title: "Une direction pour ton animation.",
    description: "À partir de ton idée et de tes références, Made prépare les poses clés, les étapes de travail et les erreurs à éviter.",
    resource: "Ton document de préparation",
    detail: "Images, dessins et indications pour démarrer ton plan.",
    action: "Consulter mon document",
    next: "Une fois le document reçu, commence ton animation. Tu pourras envoyer ta première version à l’étape suivante.",
    Icon: FileText,
  },
  {
    label: "Première review",
    title: "Un premier regard sur ton plan.",
    description: "Envoie ta première version pour recevoir des dessins sur tes images et des commentaires sur les passages à retravailler.",
    resource: "Ta première version",
    detail: "Un plan de 15 secondes maximum · MOV ou MP4, H.264.",
    action: "Envoyer mon plan",
    next: "Reprends ton animation à partir des annotations avant de passer à la deuxième review.",
    Icon: Film,
  },
  {
    label: "Deuxième review",
    title: "Affiner après tes corrections.",
    description: "Envoie ton plan retravaillé. Made réalise un deuxième retour annoté pour t’aider à affiner ton animation.",
    resource: "Ta version corrigée",
    detail: "Le même plan, après tes ajustements · MOV ou MP4, H.264.",
    action: "Envoyer ma version corrigée",
    next: "Retrouve tes deux reviews et ton document de préparation en revenant sur les étapes précédentes.",
    Icon: Film,
  },
];

const followUps = {
  anglais: { label: "Anglais", intro: "Tes rendez-vous, tes heures et tes ressources pour pratiquer.", steps: [] },
  animation: { label: "Projet d’animation", intro: "Ta préparation et tes deux reviews, au même endroit.", steps },
  feedback: { label: "Feedback d’animation", intro: "Tes plans et leurs annotations, réunis dans ton espace.", steps: [
    {
      label: "Tes plans",
      title: "Montre-moi ce que tu veux travailler.",
      description: "Envoie tes vidéos avec tes réponses au questionnaire : ce que tu veux montrer et, si tu le souhaites, les passages qui te posent problème.",
      resource: "Tes vidéos d’animation",
      detail: "Jusqu’à 3 plans · 15 secondes cumulées maximum · MOV ou MP4, H.264.",
      hint: "Un seul passage de correction sur l’ensemble des plans envoyés.",
      action: "Envoyer mes plans",
      next: "Une fois tes éléments transmis, Made prépare ton retour annoté.",
      Icon: Film,
    },
    {
      label: "Analyse",
      title: "Un regard précis sur tes mouvements.",
      description: "Made examine tes plans et prépare des dessins sur les images et des commentaires aux passages concernés pour guider tes corrections.",
      resource: "Ton retour en préparation",
      detail: "Poses, rythme, enchaînements : des indications adaptées à tes plans et à ton intention.",
      hint: "Les annotations seront accessibles à l’étape suivante une fois le retour terminé.",
      action: "Consulter mon retour",
      delay: "Sous 7 jours après réception du paiement et de tes éléments complets. Tu seras prévenu en cas de retard.",
      next: "Tu pourras parcourir tes vidéos et retrouver chaque commentaire au bon moment.",
      Icon: Clock3,
    },
    {
      label: "Ton retour",
      title: "Tes corrections, au bon endroit.",
      description: "Parcours tes vidéos annotées, arrête-toi sur les dessins et relis les commentaires pour retravailler ton animation à ton rythme.",
      resource: "Tes plans annotés",
      detail: "Dessins sur les images et commentaires liés aux passages concernés.",
      hint: "Le lecteur sera accessible ici dès la remise de ton retour.",
      action: "Voir mes annotations",
      next: "Tes vidéos et leurs annotations restent regroupées ici pour accompagner tes corrections. Cette offre comprend un seul retour.",
      Icon: Film,
    },
  ] },
  book: { label: "Book / showreel", intro: "Ton analyse, ton guide et le retour sur tes corrections.", steps: [
    { label: "Analyse", title: "Un regard sur ton book et tes objectifs.", description: "Made étudie tes travaux et tes réponses au questionnaire pour préparer un guide adapté à ce que tu veux faire ensuite.", resource: "Ton analyse personnalisée", detail: "Sélection, ordre des plans, présentation et priorités.", hint: "Ton guide apparaîtra à l’étape suivante dès sa mise à disposition.", action: "Consulter mon guide", delay: "Sous 7 jours après réception du paiement et du dossier complet.", next: "Tu pourras consulter ton PDF et le télécharger pour retravailler ta présentation.", Icon: FileText },
    { label: "Ton guide PDF", title: "Des repères pour retravailler ton book.", description: "Retrouve ce qu’il faut conserver, retirer, réorganiser ou compléter, avec des conseils liés à tes objectifs.", resource: "Ton guide personnalisé", detail: "Un PDF à consulter et à télécharger.", hint: "Le PDF sera accessible ici une fois l’analyse terminée.", action: "Consulter mon PDF", secondaryAction: "Télécharger mon PDF", next: "Prends le temps de corriger ton book, puis envoie ta nouvelle version pour le deuxième retour offert au lancement.", Icon: FileText },
    { label: "Deuxième retour", title: "Un nouveau regard après tes corrections.", description: "Renvoie la nouvelle version du même book pour recevoir un retour ciblé sur les changements réalisés.", resource: "Ton book corrigé", detail: "Le lien de ta nouvelle version et son mot de passe, si nécessaire.", hint: "L’envoi s’ouvre après la remise de ton premier guide. Le deuxième retour sera rassemblé ici.", action: "Envoyer mon book corrigé", next: "Ton guide et ton deuxième retour resteront regroupés dans ce suivi.", Icon: FileText },
  ] },
  contenu: { label: "Contenu", intro: "De tes idées à ta direction de contenu personnalisée.", steps: [
    { label: "Analyse", title: "Faire le lien entre tes forces et tes envies.", description: "Made étudie tes réponses, tes idées et tes références pour dégager un fil rouge adapté à ton univers.", resource: "Ta direction de contenu", detail: "Valeurs, singularité, public et idées à développer.", hint: "Ta fiche apparaîtra à l’étape suivante dès sa mise à disposition.", action: "Consulter ma fiche", delay: "Sous 10 jours après réception du questionnaire complet et des pièces jointes.", next: "Tu recevras une fiche avec ton fil rouge, ton persona, des idées de contenus et des pistes professionnelles à explorer.", Icon: FileText },
    { label: "Ta fiche", title: "Une direction pour tes prochaines publications.", description: "Retrouve tes forces à mettre en avant, les personnes auxquelles t’adresser et les pistes à explorer pour tes contenus et ton activité artistique.", resource: "Ta fiche personnalisée", detail: "Fil rouge, valeurs, point de vue, persona et pistes concrètes.", hint: "La fiche sera accessible ici une fois l’analyse terminée.", action: "Consulter ma fiche", secondaryAction: "Télécharger ma fiche", next: "Garde cette fiche sous la main pour choisir les idées et les formats que tu souhaites tester.", Icon: FileText },
  ] },
};

export default function ProjectFollowUp({
  currentStep = 0,
  initialKind = "animation",
  initialRequestId = null,
  availableKinds = [],
  availableEntries = [],
  deliveries,
  deliveryStatus = "pending",
}) {
  const requestedEntry = initialRequestId
    ? (Array.isArray(availableEntries) ? availableEntries.find((entry) => entry.requestId === initialRequestId) : null)
    : null;
  const firstKind = availableKinds.find((candidate) => Object.hasOwn(followUps, candidate)) || "animation";
  const initialSelectedKind = requestedEntry?.kind && availableKinds.includes(requestedEntry.kind)
    ? requestedEntry.kind
    : (availableKinds.includes(initialKind) ? initialKind : firstKind);
  const initialEntries = getEntriesForKind(availableEntries, initialSelectedKind);
  const resolvedInitialRequestId = requestedEntry && requestedEntry.kind === initialSelectedKind
    ? requestedEntry.requestId
    : (initialEntries[0]?.requestId || null);
  const initialDelivery = Array.isArray(deliveries)
    ? getDeliveryForKind(deliveries, initialSelectedKind, resolvedInitialRequestId)
    : null;
  const [kind, setKind] = useState(initialSelectedKind);
  const [selectedRequestId, setSelectedRequestId] = useState(resolvedInitialRequestId);
  const [selected, setSelected] = useState(() => getInitialStep(initialSelectedKind, currentStep, initialDelivery));
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const clientRequests = useQuery("clientRequests:getMyRequests", isAuthenticated ? {} : "skip");
  const reviewProgress = useQuery(
    "reviewStudio:getMyReviewProgress",
    isAuthenticated && selectedRequestId && ["animation", "book", "feedback"].includes(kind)
      ? { requestId: selectedRequestId }
      : "skip",
  );
  const publishedReviews = useQuery(
    "reviewStudio:getMyPublishedReviews",
    isAuthenticated && selectedRequestId && (kind === "animation" || kind === "feedback")
      ? { requestId: selectedRequestId }
      : "skip",
  );
  // The singular reviewStudio:getMyPublishedReview query remains the
  // compatibility contract for older dossier links; this view reads the
  // append-only collection so both animation cycles remain visible.
  const ensureInitialSubmission = useMutation("reviewStudio:ensureInitialSubmission");
  const ensuredRequestRef = useRef({ key: "", busy: false });
  const flow = followUps[kind] || followUps.animation;
  const entriesForKind = getEntriesForKind(availableEntries, kind);
  const delivery = Array.isArray(deliveries) ? getDeliveryForKind(deliveries, kind, selectedRequestId) : null;
  const activeStep = getActiveStep(kind, flow.steps.length, currentStep, delivery, reviewProgress);
  const step = flow.steps[selected] || flow.steps[0];
  const Icon = step?.Icon || FileText;
  const deliveryStep = getDeliveryStepIndex(kind);
  const isCurrent = selected === activeStep;
  const showDeliveryPanel = deliveryStep !== null && (
    selected === deliveryStep ||
    selected === activeStep ||
    delivery?.state === "delivered"
  );
  const deliveryReady = deliveryStatus === "success";
  const deliveryFailed = deliveryStatus === "error";
  const delay = step?.delay || (kind === "animation" ? "Sous 7 jours après réception des éléments nécessaires." : null);
  const feedbackRequests = Array.isArray(clientRequests)
    ? clientRequests.filter((request) => request.offerKey === "feedback").sort((left, right) => right.updatedAt - left.updatedAt)
    : [];
  const feedbackPublishedReviews = Array.isArray(publishedReviews)
    ? publishedReviews.filter((review) => review.cycleNumber === 1).sort((left, right) => String(left.source?.name || left.source?.id || "").localeCompare(String(right.source?.name || right.source?.id || "")))
    : [];
  const firstPublishedReview = Array.isArray(publishedReviews)
    ? publishedReviews.find((review) => review.cycleNumber === 1) || null
    : null;
  const secondPublishedReview = Array.isArray(publishedReviews)
    ? publishedReviews.find((review) => review.cycleNumber === 2) || null
    : null;
  const animationReview = selected === 1 ? firstPublishedReview : selected === 2 ? secondPublishedReview : null;
  const bookSubmissionStep = kind === "book" && selected === 2;
  const animationSubmissionStep = kind === "animation" && (selected === 1 || selected === 2) && !animationReview;
  const hideResource = (kind === "feedback" && (selected === 0 || selected === 2))
    || (kind === "animation" && (selected === 1 || selected === 2))
    || bookSubmissionStep;

  useEffect(() => {
    if (!isAuthenticated || !selectedRequestId || !["animation", "book", "feedback"].includes(kind)) return;
    const key = `${selectedRequestId}:${kind}`;
    if (ensuredRequestRef.current.key === key || ensuredRequestRef.current.busy) return;
    ensuredRequestRef.current.busy = true;
    ensureInitialSubmission({ requestId: selectedRequestId }).catch(() => {}).finally(() => {
      ensuredRequestRef.current.key = key;
      ensuredRequestRef.current.busy = false;
    });
  }, [ensureInitialSubmission, ensuredRequestRef, isAuthenticated, kind, selectedRequestId]);

  function selectKind(nextKind) {
    const nextEntries = getEntriesForKind(availableEntries, nextKind);
    const nextRequestId = nextEntries[0]?.requestId || null;
    const nextFlow = followUps[nextKind] || followUps.animation;
    const nextDelivery = Array.isArray(deliveries)
      ? getDeliveryForKind(deliveries, nextKind, nextRequestId)
      : null;
    setKind(nextKind);
    setSelectedRequestId(nextRequestId);
      setSelected(getInitialStep(nextKind, currentStep, nextDelivery, nextFlow.steps.length, null));
  }

  function selectRequest(requestId) {
    const nextDelivery = Array.isArray(deliveries)
      ? getDeliveryForKind(deliveries, kind, requestId)
      : null;
    setSelectedRequestId(requestId);
    setSelected(getInitialStep(kind, currentStep, nextDelivery, flow.steps.length, null));
  }

  function selectStep(nextStep) {
    setSelected(Math.max(0, Math.min(nextStep, flow.steps.length - 1)));
  }

  return <section className="am-follow-up" aria-labelledby="am-follow-up-title">
    <header className="am-library-title">
      <p className="am-eyebrow">{flow.label}</p>
      <h1 id="am-follow-up-title">Mon <em>suivi.</em></h1>
      <p>{flow.intro}</p>
    </header>
    <div className="am-follow-offers" role="group" aria-label="Choisir un suivi">
      {Object.entries(followUps).filter(([key]) => availableKinds.includes(key)).map(([key, item]) => <button key={key} type="button" aria-pressed={kind === key} onClick={() => selectKind(key)}>{item.label}</button>)}
    </div>

    {kind === "anglais" ? <EnglishFollowUp /> : <>
    {kind === "feedback" && <ClientRequestStatus requests={feedbackRequests} loading={authLoading || clientRequests === undefined} />}
    {entriesForKind.length > 1 && <DossierSelector entries={entriesForKind} selectedRequestId={selectedRequestId} onSelect={selectRequest} />}
    <nav className="am-follow-selector" aria-label="Étapes de ton projet">
      <button type="button" aria-label="Étape précédente" disabled={selected === 0} onClick={() => selectStep(selected - 1)}><ChevronLeft aria-hidden="true" /></button>
      <div aria-live="polite" aria-atomic="true"><span>ÉTAPE {selected + 1} / {flow.steps.length}</span><strong>{step.label}</strong></div>
      <button type="button" aria-label="Étape suivante" disabled={selected === flow.steps.length - 1} onClick={() => selectStep(selected + 1)}><ChevronRight aria-hidden="true" /></button>
    </nav>

    <article className="am-follow-card" aria-labelledby="am-follow-step-title">
      <div className="am-follow-card-top"><span className="am-follow-badge">{isCurrent ? "Étape en cours" : selected > activeStep ? "À venir" : "Étape précédente"}</span><span className="am-follow-number" aria-hidden="true">0{selected + 1}</span></div>
      <h2 id="am-follow-step-title">{step.title}</h2>
      <p className="am-follow-description">{step.description}</p>
      {showDeliveryPanel && selected !== deliveryStep && <DeliveryPanel delivery={delivery} ready={deliveryReady} failed={deliveryFailed} />}
      {kind === "feedback" && <div hidden={selected !== 0}><FeedbackDeposit /></div>}
      {kind === "feedback" && selected === 2 && <>
        <section className="am-follow-feedback-reviews" aria-labelledby="am-follow-feedback-reviews-title">
          <p className="am-eyebrow">RETOUR COMPLET</p>
          <h3 id="am-follow-feedback-reviews-title">Tes plans annotés</h3>
          {feedbackPublishedReviews.length ? feedbackPublishedReviews.map((review, index) => <article className="am-follow-feedback-review" key={review.id}>
            <h4>{review.source?.name || `Plan ${index + 1}`}</h4>
            <ReviewPlayer src={review.videoUrl || null} strokes={review.strokes || []} textBoxes={review.textBoxes || []} comments={review.comments || []} fps={review.fps || 24} aspectRatio={review.videoWidth && review.videoHeight ? review.videoWidth / review.videoHeight : null} />
          </article>) : <p className="am-submission-note">Les annotations apparaîtront ici une fois le retour complet publié.</p>}
        </section>
        <DeliveryPanel delivery={delivery} ready={deliveryReady} failed={deliveryFailed} />
      </>}
      {animationReview && <ReviewPlayer src={animationReview.videoUrl || null} strokes={animationReview.strokes || []} textBoxes={animationReview.textBoxes || []} comments={animationReview.comments || []} fps={animationReview.fps || 24} aspectRatio={animationReview.videoWidth && animationReview.videoHeight ? animationReview.videoWidth / animationReview.videoHeight : null} />}
      {animationSubmissionStep && <SubmissionDeposit kind="animation" requestId={selectedRequestId} progress={reviewProgress} />}
      {bookSubmissionStep && <SubmissionDeposit kind="book" requestId={selectedRequestId} progress={reviewProgress} />}
      {!hideResource && <><div className="am-follow-resource">
        <span className="am-follow-icon"><Icon size={30} aria-hidden="true" /></span>
        <div><h3>{step.resource}</h3><p>{step.detail}</p><small>{step.hint || (selected === 0 ? "Le document apparaîtra ici dès sa mise à disposition." : "L’envoi s’ouvre une fois l’étape précédente terminée.")}</small></div>
      </div>
      {selected === deliveryStep
        ? <DeliveryPanel delivery={delivery} ready={deliveryReady} failed={deliveryFailed} />
        : <div className="am-follow-actions"><button type="button" className="am-button" disabled>{step.action}</button>{step.secondaryAction && <button type="button" className="am-button am-follow-download" disabled>{step.secondaryAction}</button>}{delay && <p><Clock3 size={17} aria-hidden="true" /><em>{delay}</em></p>}</div>}
      </>}
      <div className="am-follow-next"><strong>{selected === flow.steps.length - 1 ? "Tout retrouver" : "Pour la suite"}</strong><p>{step.next}</p></div>
    </article>
    {!isCurrent && <button className="am-follow-return" type="button" onClick={() => selectStep(activeStep)}>Revenir à l’étape en cours</button>}
    </>}
  </section>;
}

function getEntriesForKind(entries, kind) {
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry.kind === kind && entry.requestId);
}

function getInitialStep(kind, currentStep, delivery, flowLength = followUps[kind]?.steps.length || 0, progress = null) {
  if (!flowLength) return 0;
  const deliveryStep = getDeliveryStepIndex(kind);
  if (kind === "animation" && progress) {
    if (!progress.preparation?.delivered) return 0;
    const first = progress.cycles?.find((cycle) => cycle.cycleNumber === 1);
    const second = progress.cycles?.find((cycle) => cycle.cycleNumber === 2);
    if (first?.status === "published" && second?.status !== "published") return 2;
    return 1;
  }
  if (kind === "book" && progress?.cycles?.some((cycle) => cycle.cycleNumber === 2 && cycle.status === "published")) return 2;
  if (delivery?.state === "preparing" && deliveryStep !== null) return Math.min(deliveryStep, flowLength - 1);
  if (delivery?.state === "delivered" && deliveryStep !== null && deliveryStep + 1 < flowLength) return deliveryStep + 1;
  if (delivery?.state === "delivered" && deliveryStep !== null) return Math.min(deliveryStep, flowLength - 1);
  if (delivery?.state === "awaiting_delivery" && deliveryStep !== null) return Math.max(0, deliveryStep - 1);
  return Math.max(0, Math.min(kind === "animation" ? currentStep : 0, flowLength - 1));
}

function getActiveStep(kind, flowLength, currentStep, delivery, progress) {
  return getInitialStep(kind, currentStep, delivery, flowLength, progress);
}

function DossierSelector({ entries, selectedRequestId, onSelect }) {
  return <fieldset className="am-follow-dossiers">
    <legend>Choisir le dossier à suivre</legend>
    <div role="group" aria-label="Dossiers payés">
      {entries.map((entry, index) => <button
        key={entry.requestId}
        type="button"
        aria-pressed={entry.requestId === selectedRequestId}
        onClick={() => onSelect(entry.requestId)}
      >{index === 0 ? "Dossier le plus récent" : `Dossier ${index + 1}`}</button>)}
    </div>
  </fieldset>;
}

function DeliveryPanel({ delivery, ready, failed }) {
  const file = delivery?.file;
  const delivered = delivery?.state === "delivered" && typeof file?.downloadUrl === "string" && file.downloadUrl.startsWith("/api/client-deliveries/");
  return <section className={`am-follow-delivery am-follow-delivery-${delivery?.state || "loading"}`} aria-live="polite" aria-labelledby="am-follow-delivery-title">
    <div className="am-follow-delivery-copy">
      <p className="am-eyebrow">LIVRAISON DU DOCUMENT</p>
      <h3 id="am-follow-delivery-title">{delivered ? file.name : delivery?.stateLabel || "Livraison sécurisée"}</h3>
      <p>{getDeliveryMessage(delivery, ready, failed)}</p>
    </div>
    {delivered && <div className="am-follow-delivery-actions">
      <a href={file.downloadUrl} target="_blank" rel="noreferrer">Consulter le PDF</a>
      <a href={`${file.downloadUrl}?download=1`} download={file.name || "document.pdf"}>Télécharger</a>
    </div>}
  </section>;
}

function getDeliveryMessage(delivery, ready, failed) {
  if (failed) return "Le suivi de la livraison est momentanément indisponible. Aucun document n’est exposé pendant cette vérification.";
  if (!ready) return "Le statut de ta livraison est en cours de vérification. Aucun document n’est exposé pendant ce contrôle.";
  if (!delivery) return "Le statut de cette livraison n’est pas disponible pour le moment. Réessaie dans un instant.";
  if (delivery.state === "delivered") return "Ton PDF finalisé est disponible ici. Les liens restent protégés par ton compte et ton paiement confirmé.";
  if (delivery.state === "preparing") return "L’administration prépare ton PDF. Il apparaîtra ici dès que le fichier sera finalisé.";
  if (delivery.state === "awaiting_delivery") return "Ton paiement est confirmé. Le PDF apparaîtra ici dès sa remise par l’administration.";
  if (delivery.state === "payment_required") return "La livraison s’ouvrira après confirmation du paiement.";
  if (delivery.state === "closed") return "Ce dossier est fermé : aucun document n’est accessible depuis ce suivi.";
  return "Le document n’est momentanément pas disponible. Aucun lien n’est affiché tant que sa remise n’est pas confirmée.";
}

function ClientRequestStatus({ requests, loading }) {
  if (loading) return <p className="am-follow-request" role="status">Chargement de ton dossier…</p>;
  if (!requests.length) return <p className="am-follow-request">Ton dossier apparaîtra ici après la première tentative de paiement.</p>;
  return <section className="am-follow-request" aria-labelledby="am-follow-request-title">
    <div><p className="am-eyebrow">TON DOSSIER</p><h2 id="am-follow-request-title">Feedback d’animation</h2><p>Retrouve ici chaque tentative et l’état réel de son paiement.</p><ul className="am-follow-request-list">{requests.map((request) => {
      const paid = request.paymentStatus === "paid" && request.status === "paid";
      const failed = request.paymentStatus === "failed" || request.status === "payment_failed";
      const refunded = request.paymentStatus === "refunded" || request.status === "refunded";
      const closed = refunded || request.status === "cancelled";
      const status = paid ? "Paiement confirmé" : refunded ? "Paiement remboursé" : request.status === "cancelled" ? "Dossier fermé" : failed ? "Paiement à reprendre" : request.status === "expired" ? "Session expirée" : "Dossier en cours";
      const href = paid
        ? `/nouveau/confirmation?requestId=${encodeURIComponent(request.id)}`
        : `/nouveau/feedback/questionnaire?requestId=${encodeURIComponent(request.id)}`;
      return <li key={request.id}><span><strong>{status}</strong><small>{request.files?.length || 0} vidéo{request.files?.length === 1 ? "" : "s"} enregistrée{request.files?.length === 1 ? "" : "s"}</small></span>{closed ? <span className="am-follow-request-closed">Fermé</span> : <Link href={href}>{paid ? "Voir la confirmation" : "Reprendre"}</Link>}</li>;
    })}</ul></div>
  </section>;
}
