import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Clock3, Globe2 } from "lucide-react";
import { Header, Footer } from "../_components/Shared";
import { getBookingOffer } from "../_booking/bookingLogic.mjs";
import BookingCalendar from "./BookingCalendar";
import AccessBoundary from "../_components/AccessBoundary";
import { requireConnectedMemberPage } from "@/lib/server-auth";

export const metadata = {
  title: "Réserver un rendez-vous — Animation Made",
  description: "Choisis un créneau pour ton accompagnement Animation Made.",
};

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

const availableOffers = [
  ["anglais", "Cours d’anglais", "1 heure"],
];

export default async function BookingPage({ searchParams }) {
  const access = await requireConnectedMemberPage();
  const query = await searchParams;
  if (["contenu", "visibilite"].includes(firstQueryValue(query?.offre))) {
    redirect("/nouveau/visibilite");
  }
  if (firstQueryValue(query?.offre) === "projet-animation") {
    redirect("/nouveau/feedback#projet-animation");
  }
  const offer = getBookingOffer(
    firstQueryValue(query?.offre),
    firstQueryValue(query?.format),
  );

  return (
    <>
      <Header />
      {!access.ok ? <AccessBoundary reason={access.reason} /> : <main className="am-container am-booking-page">
        <Link className="am-back" href={offer?.returnHref ?? "/nouveau#programmes"}>
          <ArrowLeft size={16} aria-hidden="true" /> Tous les programmes
        </Link>

        {offer ? (
          <>
            <section className="am-booking-intro" aria-labelledby="booking-page-title">
              <div>
                <p className="am-eyebrow">RÉSERVER · {offer.category}</p>
                <h1 id="booking-page-title">Trouver ton <em>créneau.</em></h1>
                <p className="am-lead">{offer.sessionCount ? `Choisis le créneau du premier cours de ton pack de ${offer.sessionCount} heures. Chaque séance dure une heure.` : `Choisis le moment qui te convient pour ton ${offer.title.toLowerCase()}. Les disponibilités se mettent à jour au fil des réservations.`}</p>
              </div>
              <aside className="am-booking-offer-summary" aria-label="Récapitulatif de l’offre">
                <span className="am-tag">{offer.modeLabel}</span>
                <h2>{offer.title}</h2>
                <p>{offer.description}</p>
                <div><span><Clock3 size={16} aria-hidden="true" />{offer.durationLabel}</span><span><Globe2 size={16} aria-hidden="true" />Europe/Paris</span></div>
                <strong>{offer.priceLabel}</strong>
                <p><em>Report possible jusqu’à 24 heures avant le cours. À moins de 24 heures ou en cas d’absence, la séance est décomptée, sauf exception accordée par Made.</em></p>
                {offer.validityMonths && <p><em>Les {offer.sessionCount} heures sont à utiliser dans les {offer.validityMonths} mois suivant l’achat.</em></p>}
              </aside>
            </section>
            <BookingCalendar offer={offer} />
          </>
        ) : (
          <section className="am-booking-invalid" aria-labelledby="booking-invalid-title" role="alert">
            <p className="am-eyebrow">RÉSERVER UN RENDEZ-VOUS</p>
            <h1 id="booking-invalid-title">Choisis une <em>offre.</em></h1>
            <p>Le lien de réservation ne précise pas l’accompagnement à préparer. Sélectionne celui qui correspond à ton besoin.</p>
            <div className="am-booking-offer-links">
              {availableOffers.map(([key, title, duration]) => (
                <Link key={key} className="am-button" href={`/nouveau/reserver?offre=${key}`}>
                  {title} · {duration}
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>}
      <Footer />
    </>
  );
}
