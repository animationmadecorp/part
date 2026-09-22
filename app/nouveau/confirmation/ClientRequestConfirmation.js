"use client";

import Link from "next/link";
import { Check, CircleAlert, Clock3 } from "lucide-react";
import { useConvexAuth, useQuery } from "convex/react";
import ConvexErrorBoundary from "../_components/ConvexErrorBoundary";

const OFFER_COPY = Object.freeze({
  review: {
    name: "Ta review personnalisée",
    route: "/nouveau/review/questionnaire",
    offerRoute: "/nouveau/review",
    next: "Ton guide PDF personnalisé sera préparé après réception des éléments nécessaires.",
  },
  contenu: {
    name: "Ta direction de contenu",
    route: "/nouveau/visibilite/questionnaire",
    offerRoute: "/nouveau/visibilite",
    next: "Ta fiche personnalisée sera préparée après réception des éléments nécessaires.",
  },
  "projet-animation": {
    name: "Ton projet d’animation",
    route: "/nouveau/feedback/projet/questionnaire",
    offerRoute: "/nouveau/feedback",
    next: "Ton document de préparation sera préparé après réception des éléments nécessaires.",
  },
  feedback: {
    name: "Ton feedback d’animation",
    route: "/nouveau/feedback/questionnaire",
    offerRoute: "/nouveau/feedback",
    next: "Ton retour annoté sera préparé après réception du paiement et de tes éléments complets.",
  },
});

const FOLLOW_UP_BY_OFFER = Object.freeze({
  review: "book",
  contenu: "contenu",
  "projet-animation": "animation",
  feedback: "feedback",
});

function priceLabel(priceCents, currency = "eur") {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: currency.toUpperCase() }).format(priceCents / 100);
}

function Loading() {
  return <section className="am-confirmation-card" aria-live="polite"><p className="am-eyebrow">PAIEMENT</p><h1>Vérification du paiement</h1><p className="am-confirmation-lead">Nous vérifions la confirmation Stripe. Cette page se met à jour après réception du webhook signé.</p></section>;
}

function ClientRequestConfirmationContent({ requestId, cancelled }) {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const request = useQuery("clientRequests:getMyRequest", requestId && isAuthenticated ? { requestId } : "skip");
  if (authLoading || !isAuthenticated || request === undefined) return <Loading />;
  if (!request) {
    return <section className="am-confirmation-card" role="alert"><div className="am-confirmation-status am-confirmation-status-neutral"><CircleAlert size={24} /></div><p className="am-eyebrow">DOSSIER</p><h1>Dossier introuvable</h1><p className="am-confirmation-lead">Ce dossier n’est pas accessible avec le compte connecté.</p><Link className="am-button" href="/nouveau">Revenir aux offres</Link></section>;
  }

  const copy = OFFER_COPY[request.offerKey];
  if (!copy) return <section className="am-confirmation-card" role="alert"><h1>Offre indisponible</h1><p className="am-confirmation-lead">Ce dossier ne peut pas être affiché ici.</p></section>;

  if (request.paymentStatus === "refunded" || request.status === "refunded") {
    return <section className="am-confirmation-card" role="alert"><div className="am-confirmation-status am-confirmation-status-neutral"><CircleAlert size={24} /></div><p className="am-eyebrow">PAIEMENT REMBOURSÉ</p><h1>Ce dossier a été remboursé</h1><p className="am-confirmation-lead">Ce dossier est fermé et ne peut pas être repris. Si tu penses qu’il s’agit d’une erreur, contacte-nous pour ouvrir une nouvelle demande.</p><Link className="am-button" href="/nouveau">Revenir aux offres</Link></section>;
  }

  if (cancelled && request.paymentStatus !== "paid") {
    return <section className="am-confirmation-card" aria-labelledby="client-request-cancelled-title"><div className="am-confirmation-status am-confirmation-status-neutral"><Clock3 size={24} /></div><p className="am-eyebrow">PAIEMENT NON FINALISÉ</p><h1 id="client-request-cancelled-title">Le paiement n’a pas été finalisé</h1><p className="am-confirmation-lead">Tes réponses et ton dossier restent enregistrés. Tu peux reprendre le paiement quand tu le souhaites.</p><Link className="am-button" href={`${copy.route}?requestId=${encodeURIComponent(request.id)}`}>Reprendre mon dossier</Link><Link className="am-confirmation-programs" href={copy.offerRoute}>Revoir l’offre</Link></section>;
  }

  if (request.paymentStatus === "failed" || request.status === "payment_failed") {
    return <section className="am-confirmation-card" aria-labelledby="client-request-failed-title"><div className="am-confirmation-status am-confirmation-status-neutral"><CircleAlert size={24} /></div><p className="am-eyebrow">PAIEMENT ÉCHOUÉ</p><h1 id="client-request-failed-title">Le paiement n’a pas abouti</h1><p className="am-confirmation-lead">Aucun accès n’est accordé tant que le paiement n’est pas confirmé par Stripe. Ton dossier reste disponible pour réessayer.</p><Link className="am-button" href={`${copy.route}?requestId=${encodeURIComponent(request.id)}`}>Réessayer le paiement</Link></section>;
  }

  if (request.paymentStatus !== "paid" || request.status !== "paid") {
    return <section className="am-confirmation-card" aria-labelledby="client-request-pending-title"><div className="am-confirmation-status am-confirmation-status-neutral"><Clock3 size={24} /></div><p className="am-eyebrow">PAIEMENT EN ATTENTE</p><h1 id="client-request-pending-title">Nous vérifions ton paiement</h1><p className="am-confirmation-lead">Ton dossier sera considéré comme payé uniquement après réception du webhook Stripe signé. Cette page peut être actualisée dans quelques instants.</p><div className="am-confirmation-summary am-confirmation-summary-single"><div><span>Offre</span><strong>{copy.name}</strong></div></div></section>;
  }

  const followUp = FOLLOW_UP_BY_OFFER[request.offerKey];
  const followUpHref = `/nouveau/bibliotheque?onglet=suivi${followUp ? `&suivi=${encodeURIComponent(followUp)}` : ""}&requestId=${encodeURIComponent(request.id)}`;
  return <section className="am-confirmation-card" aria-labelledby="client-request-confirmed-title"><div className="am-confirmation-status"><Check size={24} /></div><p className="am-eyebrow">PAIEMENT CONFIRMÉ</p><h1 id="client-request-confirmed-title">Ton dossier est bien commandé</h1><div className="am-confirmation-summary" aria-label="Récapitulatif du paiement"><div><span>Offre</span><strong>{copy.name}</strong></div><div><span>Total payé</span><strong>{priceLabel(request.priceCents, request.currency)}</strong></div></div><div className="am-confirmation-next"><p className="am-eyebrow">PROCHAINE ÉTAPE</p><h2>Ton accompagnement peut commencer.</h2><p>{copy.next}</p></div><Link className="am-button am-confirmation-cta" href={followUpHref}>Accéder à mon suivi</Link></section>;
}

export default function ClientRequestConfirmation({ requestId, cancelled = false }) {
  return <ConvexErrorBoundary title="La confirmation est momentanément indisponible."><ClientRequestConfirmationContent requestId={requestId} cancelled={cancelled} /></ConvexErrorBoundary>;
}
