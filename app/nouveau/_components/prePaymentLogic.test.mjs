import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { getBookingOffer } from "../_booking/bookingLogic.mjs";
import { animationProjectOffer, feedbackOffer, reviewOffer } from "../_data/prePaymentOffers.mjs";
import { createPrePaymentState, isNonBlank, paymentLabel, prePaymentReducer, requiredFieldMessage } from "./prePaymentLogic.mjs";

test("les totaux validés restent propres à chaque offre", () => {
  assert.equal(reviewOffer.price, 28);
  assert.equal(feedbackOffer.price, 38);
  assert.equal(animationProjectOffer.price, 88);
  assert.equal(getBookingOffer("anglais", "solo").price, 55);
  assert.equal(getBookingOffer("anglais", "solo-4h").price, 200);
  assert.equal(getBookingOffer("anglais", "solo-8h").price, 360);
  assert.equal(getBookingOffer("anglais", "duo").price, 68);
});

test("le retour depuis le récapitulatif conserve réponses, fichiers et sélection", () => {
  const file = { name: "plan.mov", size: 42, lastModified: 123 };
  const answers = { goal: "Travailler le rythme" };
  const selection = { date: "2026-10-20", time: "10:00", mode: "solo-4h" };
  let state = createPrePaymentState({ answers, files: [file], selection });
  state = prePaymentReducer(state, { type: "show_recap" });
  state = prePaymentReducer(state, { type: "edit" });

  assert.equal(state.step, "form");
  assert.strictEqual(state.answers, answers);
  assert.strictEqual(state.files[0], file);
  assert.strictEqual(state.selection, selection);
});

test("la validation refuse les champs obligatoires composés d’espaces", () => {
  assert.equal(isNonBlank("  \n\t"), false);
  assert.equal(isNonBlank("Une réponse"), true);
});

test("un champ invalide redevient valide dès que sa valeur est corrigée", () => {
  const message = "Ajoute cette réponse.";
  assert.equal(requiredFieldMessage("   ", message), message);
  assert.equal(requiredFieldMessage("Réponse corrigée", message), "");
});

test("les boutons de packs affichent le total et non un tarif horaire", () => {
  assert.equal(paymentLabel("200 € le pack"), "Payer 200 €");
  assert.equal(paymentLabel("360 € le pack"), "Payer 360 €");
  assert.equal(paymentLabel("68 €"), "Payer 68 €");
});

test("la connexion à Stripe garde le récapitulatif visible au lieu de revenir au formulaire", async () => {
  const calendar = await readFile(new URL("../reserver/BookingCalendar.js", import.meta.url), "utf8");
  assert.match(calendar, /if \(submitState === "recap" \|\| submitState === "processing"\)/);
});

test("le duo précise le total pour deux et le payeur unique", () => {
  const duo = getBookingOffer("anglais", "duo");
  assert.match(duo.payerNote, /total pour deux personnes/);
  assert.match(duo.payerNote, /Un seul paiement et un seul compte/);
});
