"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { CalendarDays, Video, BookOpen, Clock3 } from "lucide-react";
import { useConvexAuth, useQuery } from "convex/react";
import ConvexErrorBoundary from "../_components/ConvexErrorBoundary";

function displayDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date(`${value}T12:00:00Z`));
}

function statusLabel(status) {
  return {
    pending: "Paiement en vérification",
    confirmed: "Confirmé",
    expired: "Créneau libéré",
    cancelled: "Annulé",
  }[status] || status;
}

function subscribeClock(onChange) {
  const timer = window.setInterval(() => {
    clockSnapshot = Date.now();
    onChange();
  }, 30_000);
  return () => window.clearInterval(timer);
}

let clockSnapshot = Date.now();
const getClock = () => clockSnapshot;
const getServerClock = () => 0;

function EnglishFollowUpContent() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const data = useQuery("bookings:getMyFollowUp", isAuthenticated ? {} : "skip");
  const now = useSyncExternalStore(subscribeClock, getClock, getServerClock);

  if (authLoading) {
    return <div className="am-english-follow" role="status">Chargement de ton suivi…</div>;
  }
  if (!isAuthenticated) return <div className="am-english-follow" role="alert">Connecte-toi pour voir ton suivi.</div>;
  if (data === undefined) {
    return <div className="am-english-follow" role="status">Chargement de ton suivi…</div>;
  }

  const upcoming = data.bookings.find((booking) =>
    ["pending", "confirmed"].includes(booking.status) &&
    (booking.status !== "pending" || Number(booking.holdExpiresAt) > now) &&
    Number.isFinite(new Date(booking.startISO).getTime()) &&
    new Date(booking.startISO).getTime() >= now,
  );
  const activeEntitlements = data.entitlements.filter(
    (entitlement) => entitlement.remainingCredits > 0 && entitlement.validUntil > now,
  );
  const remainingCredits = activeEntitlements.reduce((total, entitlement) => total + entitlement.remainingCredits, 0);
  const nextOfferMode = activeEntitlements[0]?.mode || upcoming?.mode || "solo";

  return <div className="am-english-follow">
    <article className="am-follow-card" aria-labelledby="am-english-next-title">
      <div className="am-follow-card-top"><span className="am-follow-badge">Cours en visio</span><Video size={25} aria-hidden="true" /></div>
      <h2 id="am-english-next-title">Ton prochain <em>cours.</em></h2>
      <p className="am-follow-description">Retrouve ton rendez-vous et rejoins Made sur Google Meet.</p>
      <div className="am-follow-resource">
        <span className="am-follow-icon"><CalendarDays size={28} aria-hidden="true" /></span>
        <div>{upcoming ? <><h3>{displayDate(upcoming.date)} · {upcoming.time}</h3><p>{statusLabel(upcoming.status)} · Europe/Paris</p>{upcoming.mode === "duo" && <small>En duo, vous rejoignez le même lien Meet, ensemble ou chacun depuis votre ordinateur.</small>}</> : <><h3>Aucun cours réservé</h3><p>Choisis un créneau d’une heure qui te convient.</p><small>Après confirmation du paiement, ton rendez-vous apparaîtra ici.</small></>}</div>
      </div>
      <div className="am-follow-actions">
        <Link className="am-button" href={`/nouveau/reserver?offre=anglais&format=${nextOfferMode}`}>{upcoming ? "Réserver un autre cours" : "Réserver un cours"}</Link>
        {upcoming?.meetUrl ? <a className="am-button am-follow-download" href={upcoming.meetUrl} target="_blank" rel="noreferrer">Rejoindre Google Meet</a> : upcoming ? <span role="status">Le lien Google Meet apparaîtra ici avant le cours.</span> : null}
      </div>
      <div className="am-follow-credit-summary" role="status"><strong>{remainingCredits} crédit{remainingCredits > 1 ? "s" : ""} disponible{remainingCredits > 1 ? "s" : ""}</strong>{activeEntitlements.length ? <span>Valables selon la date d’expiration affichée dans ton pack.</span> : upcoming?.status === "confirmed" ? <span>Ton cours réservé est confirmé. Aucun crédit supplémentaire n’est disponible.</span> : <span>Après achat d’un pack, tes heures restantes pourront être utilisées sans nouveau paiement.</span>}</div>
      <p className="am-english-policy">Une question sur ton rendez-vous ? <Link href="/nouveau/contact">Contacte Made</Link>.</p>
    </article>

    <section className="am-english-pack" aria-labelledby="am-english-pack-title">
      <div><p className="am-eyebrow">TES HEURES DE COURS</p><h2 id="am-english-pack-title">Ton <em>pack.</em></h2></div>
      <div className="am-english-balance"><Clock3 size={22} aria-hidden="true" /><strong>{remainingCredits}</strong><span>heure{remainingCredits > 1 ? "s" : ""} restante{remainingCredits > 1 ? "s" : ""}</span></div>
      <div className="am-english-pack-detail"><p>{remainingCredits ? "Ton crédit est disponible pour un prochain cours." : "Aucun pack actif"}</p><small>4 heures à utiliser en 3 mois · 8 heures en 6 mois, à compter de l’achat.</small><Link href="/nouveau/anglais">Voir les formules</Link></div>
    </section>

    <section className="am-english-practice" aria-labelledby="am-english-practice-title">
      <h2 id="am-english-practice-title">Entre deux <em>cours.</em></h2>
      <p>Les leçons de Made sont incluses dès ton premier cours acheté, à l’unité ou en pack.</p>
      <div className="am-english-resource-grid">
        <article><BookOpen size={27} aria-hidden="true" /><h3>Tes leçons</h3><p>Retrouve les leçons de Made pour reprendre les explications et continuer à pratiquer.</p><Link href="/nouveau/bibliotheque">Ouvrir ma bibliothèque</Link></article>
      </div>
    </section>
  </div>;
}

export default function EnglishFollowUp() {
  return <ConvexErrorBoundary title="Ton suivi est momentanément indisponible."><EnglishFollowUpContent /></ConvexErrorBoundary>;
}
