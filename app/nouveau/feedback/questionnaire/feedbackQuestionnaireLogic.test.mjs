import assert from "node:assert/strict";
import test from "node:test";
import { feedbackHydrationState, feedbackTotalDuration, validateFeedbackQuestionnaire } from "./feedbackQuestionnaireLogic.mjs";

const plan = (duration) => ({ duration, file: { name: `${duration}.mov` } });

test("le feedback exige au moins un plan et une intention non vide", () => {
  assert.match(validateFeedbackQuestionnaire({ plans: [], intent: "Un objectif" }), /au moins un plan/);
  assert.match(validateFeedbackQuestionnaire({ plans: [plan(4)], intent: "   " }), /ce que tu veux montrer/);
  assert.equal(validateFeedbackQuestionnaire({ plans: [plan(4)], intent: "Travailler le poids" }), "");
});

test("le feedback conserve les limites validées de trois plans et quinze secondes", () => {
  assert.equal(feedbackTotalDuration([plan(4), plan(5.5), plan(5.5)]), 15);
  assert.equal(validateFeedbackQuestionnaire({ plans: [plan(4), plan(5.5), plan(5.5)], intent: "Le rythme" }), "");
  assert.match(validateFeedbackQuestionnaire({ plans: [plan(4), plan(4), plan(4), plan(1)], intent: "Le rythme" }), /3 plans maximum/);
  assert.match(validateFeedbackQuestionnaire({ plans: [plan(8), plan(7.1)], intent: "Le rythme" }), /15 secondes/);
});

test("le feedback refuse une durée absente, nulle ou négative", () => {
  for (const duration of [undefined, 0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.match(validateFeedbackQuestionnaire({ plans: [plan(duration)], intent: "Le rythme" }), /durée/);
  }
});

test("une sélection locale reste intacte pendant la création et un upload partiel échoué", () => {
  const selectedLocally = [{ name: "plan-B.mov", duration: 4, file: {} }];
  const freshServerDraft = feedbackHydrationState({
    activeRequestId: "request-A",
    serverRequest: { id: "request-A", offerKey: "feedback", status: "draft", updatedAt: 2 },
  });
  assert.equal(freshServerDraft.shouldRestoreServerDraft, false);
  assert.deepEqual(selectedLocally, [{ name: "plan-B.mov", duration: 4, file: {} }]);

  const lockedServerDraft = feedbackHydrationState({
    activeRequestId: "request-A",
    serverRequest: { id: "request-A", offerKey: "feedback", status: "awaiting_payment", checkoutPending: true, updatedAt: 3 },
  });
  assert.equal(lockedServerDraft.shouldRestoreServerDraft, true);
  assert.notEqual(lockedServerDraft.serverHydrationIdentity, freshServerDraft.serverHydrationIdentity);
});
