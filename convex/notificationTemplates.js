const LOCAL_HOSTS = new Set(["localhost", "0.0.0.0", "::1"]);

const BOOKING_COPY = Object.freeze({
  confirmed: {
    subject: "Ton cours d’anglais est confirmé",
    eyebrow: "RÉSERVATION CONFIRMÉE",
    title: "Ton cours d’anglais est confirmé.",
    intro: "Ton créneau est bien réservé. Retrouve les informations utiles dans ton suivi.",
    note: "Le lien Google Meet sera ajouté dans ton suivi lorsqu’il sera disponible.",
  },
  reminder: {
    subject: "Rappel : ton cours d’anglais approche",
    eyebrow: "RAPPEL DE COURS",
    title: "Ton cours d’anglais approche.",
    intro: "Voici le rappel de ton prochain créneau. Ouvre ton suivi pour retrouver les informations à jour.",
    note: "Le lien Google Meet est accessible depuis ton suivi lorsqu’il a été ajouté.",
  },
  rescheduled: {
    subject: "Ton cours d’anglais a été reporté",
    eyebrow: "CRÉNEAU MODIFIÉ",
    title: "Ton cours d’anglais a été reporté.",
    intro: "Le nouveau créneau est enregistré. Retrouve les détails actualisés dans ton suivi.",
    note: "Si tu as une question, écris à animationmadecorp@gmail.com.",
  },
});

const CLIENT_REQUEST_COPY = Object.freeze({
  review: {
    label: "Review de book",
    subject: "Ta review de book est confirmée",
    intro: "Ton paiement est confirmé et ton dossier est bien enregistré.",
    note: "La prochaine étape et les informations de suivi seront disponibles dans ton espace.",
  },
  contenu: {
    label: "Direction de contenu",
    subject: "Ta commande de contenu est confirmée",
    intro: "Ton paiement est confirmé et ton dossier de contenu est bien enregistré.",
    note: "La prochaine étape et les informations de suivi seront disponibles dans ton espace.",
  },
  "projet-animation": {
    label: "Projet d’animation",
    subject: "Ta commande de projet d’animation est confirmée",
    intro: "Ton paiement est confirmé et ton dossier de projet est bien enregistré.",
    note: "La prochaine étape et les informations de suivi seront disponibles dans ton espace.",
  },
  feedback: {
    label: "Feedback d’animation",
    subject: "Ta commande de feedback d’animation est confirmée",
    intro: "Ton paiement est confirmé et ton dossier de feedback est bien enregistré.",
    note: "La prochaine étape et les informations de suivi seront disponibles dans ton espace.",
  },
});

const EMAIL_STYLE = [
  "@media (max-width:480px){.am-shell{padding:12px 8px!important}.am-top{padding:20px!important}.am-content{padding:24px 20px!important}.am-footer{padding:18px 20px 22px!important}h1{font-size:26px!important}.am-detail-value{display:block!important;margin-top:4px!important;text-align:left!important}.am-button{display:block!important;box-sizing:border-box!important;text-align:center!important;}}",
].join("");

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function safeAppOrigin(value, { production = false } = {}) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    if (production && parsed.protocol !== "https:") return null;
    if (production && isLoopbackHostname(parsed.hostname)) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function isLoopbackHostname(value) {
  const hostname = String(value || "")
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .replace(/\.+$/, "")
    .toLowerCase();
  if (LOCAL_HOSTS.has(hostname) || hostname.endsWith(".localhost")) return true;
  if (isLocalIpv4(hostname)) return true;
  if (hostname === "::1" || hostname === "0:0:0:0:0:0:0:1") return true;
  const mappedIpv4 = mappedIpv4Address(hostname);
  return Boolean(mappedIpv4 && isLocalIpv4(mappedIpv4));
}

function isLocalIpv4(hostname) {
  return hostname === "0.0.0.0" || /^127(?:\.\d{1,3}){3}$/.test(hostname);
}

function mappedIpv4Address(hostname) {
  const match = hostname.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!match) return null;
  const high = Number.parseInt(match[1], 16);
  const low = Number.parseInt(match[2], 16);
  return [high >> 8, high & 255, low >> 8, low & 255].join(".");
}

export function safeDeliveryUrl(value, { production = false } = {}) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    if (production && parsed.protocol !== "https:") return null;
    if (production && isLoopbackHostname(parsed.hostname)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function followUpUrl({ appOrigin, path = "/nouveau/bibliotheque?onglet=suivi", production = false } = {}) {
  const origin = safeAppOrigin(appOrigin, { production });
  if (!origin) return null;
  return new URL(path, `${origin}/`).toString();
}

function euroAmount(priceCents, currency = "eur") {
  if (!Number.isSafeInteger(priceCents) || priceCents < 0 || String(currency).toLowerCase() !== "eur") return null;
  return `${(priceCents / 100).toFixed(2).replace(".", ",")} €`;
}

function frenchDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function detailRows(details) {
  return details.filter((detail) => detail?.value !== undefined && detail?.value !== "");
}

function renderDocument({ subject, preheader, eyebrow, title, intro, details, note, ctaLabel, ctaHref }) {
  const rows = detailRows(details);
  const textLines = [title, "", intro, "", ...rows.flatMap((detail) => [`${detail.label} : ${detail.value}`]), "", note];
  if (ctaHref) textLines.push("", `${ctaLabel} : ${ctaHref}`);
  const detailsMarkup = rows.length
    ? `<table class="am-details" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 24px;border-top:1px solid #e2e3ee;"><tbody>${rows.map((detail) => `<tr><td class="am-detail-label" style="padding:13px 16px 13px 0;border-bottom:1px solid #e2e3ee;color:#606174;font:15px/1.4 Arial,Helvetica,sans-serif;vertical-align:top;">${escapeHtml(detail.label)}</td><td class="am-detail-value" style="padding:13px 0;border-bottom:1px solid #e2e3ee;color:#111;font:700 15px/1.4 Arial,Helvetica,sans-serif;text-align:right;vertical-align:top;">${escapeHtml(detail.value)}</td></tr>`).join("")}</tbody></table>`
    : "";
  const ctaMarkup = ctaHref
    ? `<a class="am-button" href="${escapeHtml(ctaHref)}" style="display:inline-block;border-radius:9px;background:#fca900;color:#fff!important;padding:13px 20px;text-decoration:none;font:700 15px/1.3 Arial,Helvetica,sans-serif;">${escapeHtml(ctaLabel)}</a>`
    : "";
  return {
    subject,
    text: textLines.join("\n"),
    html: `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="${escapeHtml(preheader)}"><title>${escapeHtml(subject)}</title><style>${EMAIL_STYLE}</style></head><body style="margin:0;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;"><div class="am-shell" style="width:100%;padding:28px 12px;box-sizing:border-box;background:#fff;"><table class="am-card" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:620px;margin:0 auto;background:#fff;border:1px solid #e2e3ee;border-radius:22px;overflow:hidden;"><tr><td class="am-top" style="padding:24px 28px;background:#aaa9e6;color:#fff;"><div class="am-brand" style="color:#fff;font:700 14px/1.3 Arial,Helvetica,sans-serif;letter-spacing:.14em;text-transform:uppercase;">Animation Made</div></td></tr><tr><td class="am-content" style="padding:30px 28px 28px;background:#fff;"><p class="am-eyebrow" style="margin:0 0 12px;color:#57548b;font:700 12px/1.6 Arial,Helvetica,sans-serif;letter-spacing:.12em;text-transform:uppercase;">${escapeHtml(eyebrow)}</p><h1 style="margin:0 0 16px;color:#111;font:400 30px/1.1 Georgia,'Times New Roman',serif;letter-spacing:-.02em;">${escapeHtml(title)}</h1><p class="am-intro" style="margin:0 0 24px;color:#606174;font:17px/1.55 Arial,Helvetica,sans-serif;">${escapeHtml(intro)}</p>${detailsMarkup}<p class="am-note" style="margin:0 0 24px;color:#606174;font:14px/1.55 Arial,Helvetica,sans-serif;">${escapeHtml(note)}</p>${ctaMarkup}</td></tr><tr><td class="am-footer" style="padding:20px 28px 26px;color:#606174;font:12px/1.5 Arial,Helvetica,sans-serif;background:#fff;">Ce message concerne ton achat ou ta réservation. Il ne s’agit pas d’un message promotionnel.</td></tr></table></div></body></html>`,
  };
}

export function renderBookingEmail({ kind = "confirmed", booking = {}, appOrigin, production = false } = {}) {
  const copy = BOOKING_COPY[kind] || BOOKING_COPY.confirmed;
  const date = frenchDate(booking.date) || "ton prochain créneau";
  const time = booking.time || "à confirmer";
  const timezone = booking.timezone || "Europe/Paris";
  const ctaHref = followUpUrl({
    appOrigin,
    path: "/nouveau/bibliotheque?onglet=suivi&suivi=anglais",
    production,
  });
  return renderDocument({
    subject: copy.subject,
    preheader: copy.intro,
    eyebrow: copy.eyebrow,
    title: copy.title,
    intro: copy.intro,
    details: [
      { label: "Date", value: date },
      { label: "Heure", value: time },
      { label: "Fuseau", value: timezone },
    ],
    note: copy.note,
    ctaLabel: "Accéder à mon suivi",
    ctaHref,
  });
}

export function renderClientRequestEmail({ offerKey, priceCents, currency = "eur", appOrigin, production = false } = {}) {
  const copy = CLIENT_REQUEST_COPY[offerKey];
  if (!copy) return null;
  const amount = euroAmount(priceCents, currency);
  const ctaHref = followUpUrl({ appOrigin, production });
  return renderDocument({
    subject: copy.subject,
    preheader: copy.intro,
    eyebrow: "PAIEMENT CONFIRMÉ",
    title: "Ta commande est bien confirmée.",
    intro: copy.intro,
    details: [
      { label: "Offre", value: copy.label },
      ...(amount ? [{ label: "Total payé", value: amount }] : []),
    ],
    note: copy.note,
    ctaLabel: "Accéder à mon suivi",
    ctaHref,
  });
}

// Delivery contract: the delivery lot can provide a verified, expiring
// deliveryUrl later without changing the email transport or its text fallback.
export function renderDeliveryEmail({
  deliveryLabel = "Ton livrable",
  deliveryUrl,
  available = false,
  followUpPath = "/nouveau/bibliotheque?onglet=suivi",
  appOrigin,
  production = false,
} = {}) {
  const safeUrl = safeDeliveryUrl(deliveryUrl, { production });
  if (!safeUrl && !available) {
    return {
      ...renderDocument({
        subject: `${deliveryLabel} est en préparation`,
        preheader: `${deliveryLabel} est en préparation. Tu recevras un nouveau message dès qu’il sera disponible.`,
        eyebrow: "LIVRABLE EN PRÉPARATION",
        title: "Ton livrable arrive.",
        intro: `${deliveryLabel} est en préparation. Tu recevras un nouveau message dès qu’il sera disponible.`,
        details: [{ label: "Livrable", value: deliveryLabel }],
        note: "Aucun lien de fichier n’est affiché tant qu’il n’est pas disponible.",
        ctaLabel: "Accéder à mon suivi",
        ctaHref: followUpUrl({ appOrigin, path: followUpPath, production }),
      }),
      sendable: false,
      deliveryUrl: null,
    };
  }
  const ctaHref = safeUrl || followUpUrl({ appOrigin, path: followUpPath, production });
  const feminineDelivery = /^(?:ta|la|une)\b/i.test(deliveryLabel.trim()) || /\breview\b/i.test(deliveryLabel);
  const readyCopy = feminineDelivery ? "prête à être consultée" : "prêt à être consulté";
  return {
    ...renderDocument({
      subject: `${deliveryLabel} est disponible`,
      preheader: `${deliveryLabel} est ${readyCopy}.`,
      eyebrow: "LIVRABLE DISPONIBLE",
      title: "Ton livrable est prêt.",
      intro: safeUrl
        ? `${deliveryLabel} est disponible. Tu peux l’ouvrir depuis ce message ou retrouver son état dans ton suivi.`
        : `${deliveryLabel} est disponible. Ouvre ton suivi pour le consulter avec tes droits d’accès.`,
      details: [{ label: "Livrable", value: deliveryLabel }],
      note: safeUrl
        ? "Le lien reste accessible selon les droits et la durée prévus pour ton livrable."
        : "Aucun lien de fichier privé n’est inclus dans ce message. Le suivi ouvre l’accès sécurisé à ton livrable.",
      ctaLabel: safeUrl ? "Ouvrir mon livrable" : "Accéder à mon suivi",
      ctaHref,
    }),
    sendable: true,
    deliveryUrl: safeUrl,
  };
}

export function clientRequestOfferKeys() {
  return Object.keys(CLIENT_REQUEST_COPY);
}
