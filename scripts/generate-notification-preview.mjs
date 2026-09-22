import { writeFile } from "node:fs/promises";
import { escapeHtml, renderBookingEmail, renderClientRequestEmail, renderDeliveryEmail } from "../convex/notificationTemplates.js";

const appOrigin = "https://preview.animation-made.test";
const variants = [
  ["Confirmation anglais", renderBookingEmail({ kind: "confirmed", appOrigin, booking: { date: "2026-09-24", time: "09:00", timezone: "Europe/Paris" } })],
  ["Rappel anglais", renderBookingEmail({ kind: "reminder", appOrigin, booking: { date: "2026-09-24", time: "09:00", timezone: "Europe/Paris" } })],
  ["Report anglais", renderBookingEmail({ kind: "rescheduled", appOrigin, booking: { date: "2026-10-01", time: "14:00", timezone: "Europe/Paris" } })],
  ["Confirmation feedback", renderClientRequestEmail({ offerKey: "feedback", priceCents: 3800, currency: "eur", appOrigin })],
  ["Livraison PDF", renderDeliveryEmail({ deliveryLabel: "Ton PDF personnalisé", available: true, appOrigin })],
  ["Livraison review", renderDeliveryEmail({ deliveryLabel: "Ta review d’animation", available: true, appOrigin })],
];

const cards = variants.map(([label, message]) => `<section><h2>${escapeHtml(label)} — ${escapeHtml(message.subject)}</h2><iframe title="${escapeHtml(label)}" srcdoc="${escapeHtml(message.html)}"></iframe><details><summary>Alternative texte</summary><pre>${escapeHtml(message.text)}</pre></details></section>`).join("\n");
const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Aperçu local — e-mails Animation Made</title><style>body{margin:0;padding:24px 12px 48px;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif}header,main{max-width:980px;margin:0 auto}h1{font:400 32px/1.1 Georgia,serif}.notice{color:#606174;line-height:1.5}section{margin:24px 0;padding:18px;border:1px solid #e2e3ee;border-radius:16px;background:#f8f8fe}h2{font:400 22px/1.2 Georgia,serif}iframe{display:block;width:100%;height:620px;border:1px solid #e2e3ee;background:#fff}details{margin-top:12px;color:#606174}pre{white-space:pre-wrap;font:13px/1.5 Arial,Helvetica,sans-serif;background:#fff;padding:12px;border:1px solid #e2e3ee}@media(max-width:600px){body{padding:12px 8px 32px}section{padding:10px}iframe{height:600px}}</style></head><body data-generated-from="convex/notificationTemplates.js"><header><p class="notice">Aperçu généré par les fonctions de rendu réelles. Aucun appel Resend n’est effectué.</p><h1>E-mails transactionnels Animation Made</h1></header><main>${cards}</main></body></html>`;
await writeFile(new URL("../docs/notification-email-preview.html", import.meta.url), `${html}\n`, "utf8");
console.log("notification email preview generated from notificationTemplates.js");
