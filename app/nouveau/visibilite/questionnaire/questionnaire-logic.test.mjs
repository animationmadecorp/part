import assert from "node:assert/strict";
import test from "node:test";
import {
  contentOffer,
  createQuestionnaireState,
  isRequiredAnswerValid,
  questionnaireReducer,
} from "./questionnaire-logic.mjs";

test("les réponses obligatoires composées uniquement d’espaces sont refusées", () => {
  assert.equal(isRequiredAnswerValid("   \n\t"), false);
  assert.equal(isRequiredAnswerValid("Une vraie réponse"), true);
});

test("les réponses et les fichiers restent identiques pendant un aller-retour au récapitulatif", () => {
  const file = { name: "reference.pdf", size: 42, lastModified: 123 };
  let state = createQuestionnaireState(2);
  state = questionnaireReducer(state, { type: "update_answer", index: 0, value: "Mon univers" });
  state = questionnaireReducer(state, { type: "add_files", files: [file] });

  const answers = state.answers;
  const files = state.files;
  state = questionnaireReducer(state, { type: "show_recap" });
  state = questionnaireReducer(state, { type: "edit_answers" });

  assert.equal(state.step, "questionnaire");
  assert.strictEqual(state.answers, answers);
  assert.strictEqual(state.files, files);
  assert.strictEqual(state.files[0], file);
});

test("l’offre récapitule le tarif validé", () => {
  assert.equal(contentOffer.name, "Ta direction de contenu");
  assert.equal(contentOffer.price, 58);
  assert.equal(contentOffer.priceLabel, "58 €");
  assert.equal(contentOffer.launchPriceEnd, "31 décembre 2026");
});
