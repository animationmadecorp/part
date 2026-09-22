import { getBookingOffer } from "../_booking/bookingLogic.mjs";
import {
  animationProjectOffer,
  feedbackOffer,
  reviewOffer,
} from "../_data/prePaymentOffers.mjs";
import { contentOffer } from "../visibilite/questionnaire/questionnaire-logic.mjs";

const DELIVERY_COPY = Object.freeze({
  review: {
    nextTitle: "La review de ton book peut commencer.",
    nextBody:
      "Ton guide PDF personnalisé est livré sous 7 jours après réception du paiement et de tous les éléments nécessaires.",
  },
  feedback: {
    nextTitle: "Ton feedback peut commencer.",
    nextBody:
      "Ton retour annoté est livré sous 7 jours après réception du paiement et de tes éléments complets.",
  },
  "projet-animation": {
    nextTitle: "La préparation de ton projet peut commencer.",
    nextBody:
      "Ton document de préparation est remis sous 7 jours après réception de tous les éléments. Tes deux reviews sont ensuite remises sous 7 jours chacune, après réception de la version correspondante.",
  },
  contenu: {
    nextTitle: "L’analyse de ta direction de contenu peut commencer.",
    nextBody:
      "Ta fiche personnalisée est livrée sous 10 jours après réception du questionnaire complet et de toutes les pièces jointes.",
  },
});

const RECOVERY_ROUTES = Object.freeze({
  review: {
    retryHref: "/nouveau/review/questionnaire",
    offerHref: "/nouveau/review",
  },
  feedback: {
    retryHref: "/nouveau/feedback/questionnaire",
    offerHref: "/nouveau/feedback",
  },
  "projet-animation": {
    retryHref: "/nouveau/feedback/projet/questionnaire",
    offerHref: "/nouveau/feedback",
  },
  contenu: {
    retryHref: "/nouveau/visibilite/questionnaire",
    offerHref: "/nouveau/visibilite",
  },
});

const FAILED_STATUSES = new Set(["failed", "echec"]);
const CANCELLED_STATUSES = new Set(["cancelled", "canceled", "annule"]);

function englishOffer(format) {
  const offer = getBookingOffer("anglais", format);
  if (!offer) return null;
  return {
    key: "anglais",
    format: offer.mode,
    name: offer.title,
    formatLabel: offer.modeLabel,
    price: offer.price,
    priceLabel: offer.priceLabel,
    nextTitle: "Ton rendez-vous reste à confirmer.",
    nextBody:
      "Retrouve dans ton suivi les informations de réservation et la confirmation de ton prochain rendez-vous.",
  };
}

export function resolveConfirmationOffer(key, format) {
  const offers = {
    review: reviewOffer,
    feedback: feedbackOffer,
    "projet-animation": animationProjectOffer,
    contenu: contentOffer,
  };
  if (key === "anglais") return englishOffer(format);
  const offer = offers[key];
  if (!offer) return null;
  return {
    key,
    name: offer.name,
    formatLabel: offer.format,
    price: offer.price,
    priceLabel: offer.priceLabel,
    ...DELIVERY_COPY[key],
  };
}

export function resolvePaymentStatus(value) {
  if (value === "paid") return "confirmed";
  if (FAILED_STATUSES.has(value)) return "failed";
  if (CANCELLED_STATUSES.has(value)) return "cancelled";
  return "pending";
}

export function resolveRecoveryLinks(key, format) {
  if (key === "anglais") {
    const offer = englishOffer(format);
    if (!offer) return null;
    const encodedFormat = encodeURIComponent(offer.format);
    return {
      retryHref: `/nouveau/reserver?offre=anglais&format=${encodedFormat}`,
      offerHref: "/nouveau/anglais",
    };
  }
  return RECOVERY_ROUTES[key] || null;
}

export function isSafeMeetUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "meet.google.com" &&
      /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}\/?$/i.test(url.pathname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export function createConfirmationView(record) {
  const offer = resolveConfirmationOffer(record?.offerKey, record?.format);
  const resolvedStatus = resolvePaymentStatus(record?.paymentStatus);
  const trusted = record?.paymentVerified === true;
  const confirmed = Boolean(
    offer && resolvedStatus === "confirmed" && trusted,
  );
  const recoverable = Boolean(
    offer && trusted && (resolvedStatus === "failed" || resolvedStatus === "cancelled"),
  );
  const status = confirmed
    ? "confirmed"
    : recoverable
      ? resolvedStatus
      : "pending";
  const filesComplete = record?.filesComplete === true;
  const bookingVerified = record?.bookingVerified === true;
  const meetUrl =
    confirmed &&
    offer?.key === "anglais" &&
    bookingVerified &&
    isSafeMeetUrl(record?.meetUrl)
      ? record.meetUrl
      : null;

  return {
    status,
    confirmed,
    preview: record?.preview === true,
    filesComplete,
    offer: confirmed || recoverable
      ? offer?.key === "anglais" && bookingVerified
        ? {
            ...offer,
            nextTitle: "Ton cours d’anglais est réservé.",
            nextBody:
              "Retrouve les informations de ton rendez-vous dans ton suivi. Tu peux reporter ton cours jusqu’à 24 heures avant le rendez-vous.",
          }
        : offer
      : null,
    recovery: recoverable
      ? resolveRecoveryLinks(record.offerKey, record.format)
      : null,
    appointment:
      confirmed && offer?.key === "anglais" && bookingVerified
        ? {
            dateLabel: record?.dateLabel || null,
            timeLabel: record?.timeLabel || null,
            formatLabel: offer.formatLabel,
            meetUrl,
          }
        : null,
  };
}

export function createDevelopmentPreview(query, nodeEnv = process.env.NODE_ENV) {
  if (nodeEnv !== "development") return null;
  const state = Array.isArray(query?.etat) ? query.etat[0] : query?.etat;
  const preview = Array.isArray(query?.apercu) ? query.apercu[0] : query?.apercu;
  const format = Array.isArray(query?.format) ? query.format[0] : query?.format;
  const missing =
    (Array.isArray(query?.fichiers) ? query.fichiers[0] : query?.fichiers) ===
    "manquants";
  const offerAliases = {
    review: "review",
    feedback: "feedback",
    "projet-animation": "projet-animation",
    contenu: "contenu",
    anglais: "anglais",
  };
  const offerKey = offerAliases[preview];
  if (!offerKey) return null;

  const paymentStatus = {
    annule: "cancelled",
    echec: "failed",
  }[state] || "paid";

  return {
    paymentStatus,
    paymentVerified: true,
    preview: true,
    filesComplete: !missing,
    offerKey,
    format: offerKey === "anglais" ? format || "solo" : undefined,
    ...(offerKey === "anglais"
      ? {
          bookingVerified: true,
          dateLabel: "mardi 22 septembre 2026",
          timeLabel: "10:00 · Europe/Paris",
        }
      : {}),
  };
}
