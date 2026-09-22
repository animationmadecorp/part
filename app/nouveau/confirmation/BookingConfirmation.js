"use client";

import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { CalendarDays, Check, Clock3, CircleAlert, Video } from "lucide-react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { getBookingOffer } from "../_booking/bookingLogic.mjs";
import ConvexErrorBoundary from "../_components/ConvexErrorBoundary";

function dateLabel(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Paris",
    }).format(new Date(`${value}T12:00:00Z`));
  } catch {
    return value;
  }
}

function Loading() {
  return <section className="am-confirmation-card" aria-live="polite"><p className="am-eyebrow">PAIEMENT</p><h1>Vérification du paiement</h1><p className="am-confirmation-lead">Nous vérifions la confirmation Stripe. Cette page se met à jour automatiquement.</p></section>;
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

function BookingConfirmationContent({ bookingId, cancelled = false }) {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const booking = useQuery("bookings:getMyBooking", bookingId && isAuthenticated ? { bookingId } : "skip");
  const cancelHold = useMutation("bookings:cancelHold");
  const cancellationRequested = useRef(false);
  const now = useSyncExternalStore(subscribeClock, getClock, getServerClock);
  useEffect(() => {
    if (!cancelled || !bookingId || booking?.status !== "pending" || cancellationRequested.current) return;
    cancellationRequested.current = true;
    void cancelHold({ bookingId }).catch(() => {});
  }, [booking, bookingId, cancelHold, cancelled]);
  if (authLoading || !isAuthenticated || booking === undefined) return <Loading />;
  if (!booking) {
    return <section className="am-confirmation-card" role="alert"><div className="am-confirmation-status am-confirmation-status-neutral"><CircleAlert size={24} /></div><p className="am-eyebrow">RÉSERVATION</p><h1>Réservation introuvable</h1><p className="am-confirmation-lead">Cette réservation n’est pas accessible avec le compte connecté.</p><Link className="am-button" href="/nouveau/anglais">Revenir aux formules</Link></section>;
  }

  const offer = getBookingOffer(booking.offerKey, booking.mode);
  const effectiveStatus = cancelled && booking.status === "pending"
    ? "cancelled"
    : booking.status === "pending" && Number(booking.holdExpiresAt) <= now
      ? "expired"
    : booking.status;
  if (effectiveStatus !== "confirmed") {
    const expired = effectiveStatus === "expired" || effectiveStatus === "cancelled";
    return <section className="am-confirmation-card" aria-labelledby="booking-confirmation-title">
      <div className="am-confirmation-status am-confirmation-status-neutral"><Clock3 size={24} /></div>
      <p className="am-eyebrow">{expired ? "CRÉNEAU LIBÉRÉ" : "PAIEMENT EN ATTENTE"}</p>
      <h1 id="booking-confirmation-title">{expired ? "Ce créneau n’est plus maintenu" : "Nous vérifions ton paiement"}</h1>
      <p className="am-confirmation-lead">{expired ? "Le maintien temporaire a expiré ou le paiement a été annulé. Aucun cours n’a été confirmé." : "La réservation sera confirmée uniquement après réception du webhook Stripe signé."}</p>
      <Link className="am-button" href="/nouveau/reserver?offre=anglais&format=solo">Choisir un autre créneau</Link>
    </section>;
  }

  return <section className="am-confirmation-card" aria-labelledby="booking-confirmation-title">
    <div className="am-confirmation-status"><Check size={24} /></div>
    <p className="am-eyebrow">PAIEMENT CONFIRMÉ</p>
    <h1 id="booking-confirmation-title">Ton cours d’anglais est réservé</h1>
    <div className="am-confirmation-summary" aria-label="Récapitulatif de la réservation">
      <div><span>Offre</span><strong>{offer?.modeLabel || booking.mode}</strong></div>
      <div><span>Crédit</span><strong>1 heure décomptée</strong></div>
    </div>
    <div className="am-confirmation-appointment" aria-label="Ton rendez-vous">
      <h2>Ton rendez-vous</h2>
      <dl>
        <div><dt><CalendarDays size={18} aria-hidden="true" />Date</dt><dd>{dateLabel(booking.date)}</dd></div>
        <div><dt><Clock3 size={18} aria-hidden="true" />Horaire</dt><dd>{booking.time} · Europe/Paris</dd></div>
        <div><dt><Video size={18} aria-hidden="true" />Format</dt><dd>{offer?.modeLabel || booking.mode}</dd></div>
      </dl>
      {booking.meetUrl ? <a className="am-secondary-button" href={booking.meetUrl} target="_blank" rel="noreferrer">Rejoindre Google Meet</a> : <p>Le lien Google Meet sera ajouté par Made dans ton suivi.</p>}
    </div>
    <Link className="am-button am-confirmation-cta" href="/nouveau/bibliotheque?onglet=suivi">Accéder à mon suivi</Link>
  </section>;
}

export default function BookingConfirmation({ bookingId, cancelled }) {
  return <ConvexErrorBoundary title="La confirmation est momentanément indisponible."><BookingConfirmationContent bookingId={bookingId} cancelled={cancelled} /></ConvexErrorBoundary>;
}
