import assert from "node:assert/strict";
import test from "node:test";
import {
  createConfirmationView,
  createDevelopmentPreview,
  isSafeMeetUrl,
  resolvePaymentStatus,
  resolveRecoveryLinks,
  resolveConfirmationOffer,
} from "./confirmationLogic.mjs";

test("une offre inconnue reste en vérification", () => {
  assert.equal(resolveConfirmationOffer("inconnue"), null);
  assert.equal(createConfirmationView({ paymentStatus: "paid", paymentVerified: true, offerKey: "inconnue" }).status, "pending");
});

test("seul un paiement explicitement vérifié affiche la confirmation", () => {
  assert.equal(createConfirmationView({ offerKey: "review", paymentStatus: "paid" }).confirmed, false);
  assert.equal(createConfirmationView({ offerKey: "review", paymentStatus: "pending", paymentVerified: true }).confirmed, false);
  assert.equal(createConfirmationView({ offerKey: "review", paymentStatus: "paid", paymentVerified: true }).confirmed, true);
});

test("les fichiers manquants conservent le paiement confirmé sans démarrer le délai", () => {
  const view = createConfirmationView({
    offerKey: "feedback",
    paymentStatus: "paid",
    paymentVerified: true,
    filesComplete: false,
  });
  assert.equal(view.confirmed, true);
  assert.equal(view.filesComplete, false);
});

test("un dossier asynchrone exige une complétude explicitement confirmée", () => {
  const base = { offerKey: "review", paymentStatus: "paid", paymentVerified: true };
  assert.equal(createConfirmationView(base).filesComplete, false);
  assert.equal(createConfirmationView({ ...base, filesComplete: false }).filesComplete, false);
  assert.equal(createConfirmationView({ ...base, filesComplete: true }).filesComplete, true);
});

test("les totaux proviennent des métadonnées existantes", () => {
  assert.equal(resolveConfirmationOffer("review").price, 28);
  assert.equal(resolveConfirmationOffer("feedback").price, 38);
  assert.equal(resolveConfirmationOffer("projet-animation").price, 88);
  assert.equal(resolveConfirmationOffer("contenu").price, 58);
  assert.equal(resolveConfirmationOffer("anglais", "solo").price, 55);
  assert.equal(resolveConfirmationOffer("anglais", "solo-4h").price, 200);
  assert.equal(resolveConfirmationOffer("anglais", "solo-8h").price, 360);
  assert.equal(resolveConfirmationOffer("anglais", "duo").price, 68);
});

test("le lien Meet exige une réservation vérifiée et une URL Google Meet sûre", () => {
  const base = { offerKey: "anglais", format: "solo", paymentStatus: "paid", paymentVerified: true };
  assert.equal(createConfirmationView({ ...base, meetUrl: "https://meet.google.com/abc-defg-hij" }).appointment, null);
  assert.equal(createConfirmationView({ ...base, bookingVerified: true, meetUrl: "https://example.com/abc-defg-hij" }).appointment.meetUrl, null);
  assert.equal(createConfirmationView({ ...base, bookingVerified: true, meetUrl: "https://meet.google.com/abc-defg-hij" }).appointment.meetUrl, "https://meet.google.com/abc-defg-hij");
  assert.equal(isSafeMeetUrl("javascript:alert(1)"), false);
});

test("un paiement anglais sans réservation vérifiée ne prétend pas que le cours est réservé", () => {
  const base = {
    offerKey: "anglais",
    format: "solo",
    paymentStatus: "paid",
    paymentVerified: true,
    filesComplete: true,
  };
  const pendingBooking = createConfirmationView(base);
  assert.equal(pendingBooking.appointment, null);
  assert.equal(pendingBooking.offer.nextTitle, "Ton rendez-vous reste à confirmer.");

  const booked = createConfirmationView({ ...base, bookingVerified: true });
  assert.equal(booked.offer.nextTitle, "Ton cours d’anglais est réservé.");
});

test("les aperçus confirmés sont strictement limités au développement", () => {
  const query = { apercu: "review" };
  assert.equal(createDevelopmentPreview(query, "production"), null);
  assert.equal(createDevelopmentPreview(query, "test"), null);
  assert.equal(createDevelopmentPreview(query, "development").paymentVerified, true);
  assert.equal(createDevelopmentPreview(query, "development").filesComplete, true);
  assert.equal(createDevelopmentPreview({ apercu: "anglais" }, "development").meetUrl, undefined);
  assert.equal(createDevelopmentPreview({ apercu: "inconnue" }, "development"), null);
});

test("les statuts de paiement sont mappés explicitement", () => {
  assert.equal(resolvePaymentStatus("paid"), "confirmed");
  assert.equal(resolvePaymentStatus("cancelled"), "cancelled");
  assert.equal(resolvePaymentStatus("canceled"), "cancelled");
  assert.equal(resolvePaymentStatus("failed"), "failed");
  assert.equal(resolvePaymentStatus("redirected"), "pending");
});

test("un échec ou une annulation exige toujours un état vérifié", () => {
  assert.equal(createConfirmationView({ offerKey: "review", paymentStatus: "failed" }).status, "pending");
  assert.equal(createConfirmationView({ offerKey: "review", paymentStatus: "failed", paymentVerified: true }).status, "failed");
  assert.equal(createConfirmationView({ offerKey: "feedback", paymentStatus: "cancelled", paymentVerified: true }).status, "cancelled");
});

test("chaque offre reprend sur son parcours sûr", () => {
  assert.equal(resolveRecoveryLinks("review").retryHref, "/nouveau/review/questionnaire");
  assert.equal(resolveRecoveryLinks("feedback").retryHref, "/nouveau/feedback/questionnaire");
  assert.equal(resolveRecoveryLinks("projet-animation").retryHref, "/nouveau/feedback/projet/questionnaire");
  assert.equal(resolveRecoveryLinks("contenu").retryHref, "/nouveau/visibilite/questionnaire");
  for (const format of ["solo", "solo-4h", "solo-8h", "duo"]) {
    assert.equal(resolveRecoveryLinks("anglais", format).retryHref, `/nouveau/reserver?offre=anglais&format=${format}`);
  }
});

test("une offre ou un format inconnu ne produit aucun lien arbitraire", () => {
  assert.equal(resolveRecoveryLinks("inconnue"), null);
  assert.equal(resolveRecoveryLinks("anglais", "https://evil.example"), null);
  const view = createConfirmationView({
    offerKey: "https://evil.example",
    format: "javascript:alert(1)",
    paymentStatus: "failed",
    paymentVerified: true,
    returnTo: "https://evil.example",
  });
  assert.equal(view.status, "pending");
  assert.equal(view.recovery, null);
});

test("les aperçus annulation et échec sont réservés au développement", () => {
  const failed = createDevelopmentPreview({ etat: "echec", apercu: "review" }, "development");
  const cancelled = createDevelopmentPreview({ etat: "annule", apercu: "anglais", format: "duo" }, "development");
  assert.equal(createConfirmationView(failed).status, "failed");
  assert.equal(createConfirmationView(cancelled).status, "cancelled");
  assert.equal(failed.preview, true);
  assert.equal(createDevelopmentPreview({ etat: "echec", apercu: "review" }, "production"), null);
});

test("les textes annulation et échec restent distincts dans le composant", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("./PaymentConfirmation.js", import.meta.url), "utf8"));
  assert.match(source, /Le paiement n’a pas été finalisé/);
  assert.match(source, /Le paiement n’a pas abouti/);
  assert.doesNotMatch(source, /Total payé[\s\S]*PaymentRecovery/);
});
