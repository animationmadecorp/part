import assert from "node:assert/strict";
import {
  ensureInitialSubmission,
  ensureReview,
  finalizeSubmission,
  getMyPublishedReviews,
  getMyReviewProgress,
  getAdminReviewProgress,
  getReviewVideoDownload,
  prepareSubmissionUpload,
  publishBookReview,
  publishReview,
  saveReview,
  submitBookRevision,
} from "../convex/reviewStudio.js";
import { repairAnimationQuestionnaireProjection } from "../convex/reviewMigrations.js";

process.env.BOOKING_WEBHOOK_SECRET = "submission-secret-test";

const handlers = Object.fromEntries([
  ["ensureInitialSubmission", ensureInitialSubmission._handler],
  ["ensureReview", ensureReview._handler],
  ["finalizeSubmission", finalizeSubmission._handler],
  ["getMyPublishedReviews", getMyPublishedReviews._handler],
  ["getMyReviewProgress", getMyReviewProgress._handler],
  ["getAdminReviewProgress", getAdminReviewProgress._handler],
  ["getReviewVideoDownload", getReviewVideoDownload._handler],
  ["prepareSubmissionUpload", prepareSubmissionUpload._handler],
  ["publishBookReview", publishBookReview._handler],
  ["publishReview", publishReview._handler],
  ["saveReview", saveReview._handler],
  ["submitBookRevision", submitBookRevision._handler],
  ["repairAnimationQuestionnaireProjection", repairAnimationQuestionnaireProjection._handler],
]);

function request(_id, clerkUserId, tokenIdentifier, offerKey) {
  return {
    _id,
    clerkUserId,
    tokenIdentifier,
    email: `${clerkUserId}@example.test`,
    offerKey,
    status: "paid",
    paymentStatus: "paid",
    answersJson: offerKey === "review"
      ? JSON.stringify({ workLink: "https://book.example.test/v1", password: "secret" })
      : offerKey === "feedback"
        ? JSON.stringify({ plans: Array.from({ length: _id === "feedback" ? 2 : 1 }, (_, index) => ({ name: `plan-${index + 1}.mp4`, duration: 2, size: 3209, mimeType: "video/mp4" })), intent: "Travailler le rythme.", blocker: "", references: "" })
        : "{}",
    createdAt: 1,
    updatedAt: 1,
  };
}

function file(_id, requestId, storageId, name, mimeType = "video/mp4", kind = "video") {
  return {
    _id,
    requestId,
    clerkUserId: "member-a",
    tokenIdentifier: "token-a",
    storageId,
    name,
    mimeType,
    size: 3209,
      kind,
    deliveryStage: kind === "admin_delivery" && requestId.startsWith("project") ? "preparation" : kind === "admin_delivery" && requestId === "book" ? "book_guide" : undefined,
    status: "active",
    createdAt: 1,
    updatedAt: 1,
  };
}

function makeHarness() {
  const state = {
    users: [
      { _id: "user-admin", tokenIdentifier: "token-admin", clerkUserId: "admin-1", role: "admin" },
      { _id: "user-a", tokenIdentifier: "token-a", clerkUserId: "member-a", role: "member" },
      { _id: "user-b", tokenIdentifier: "token-b", clerkUserId: "member-b", role: "member" },
    ],
    clientRequests: [
      request("project", "member-a", "token-a", "projet-animation"),
      request("feedback", "member-a", "token-a", "feedback"),
      request("book", "member-a", "token-a", "review"),
      request("other", "member-b", "token-b", "projet-animation"),
      request("project-over", "member-a", "token-a", "projet-animation"),
    ],
    clientRequestFiles: [
      file("project-prep", "project", "storage-project-prep", "preparation.pdf", "application/pdf", "admin_delivery"),
      file("feedback-1", "feedback", "storage-feedback-1", "one.mp4"),
      file("feedback-2", "feedback", "storage-feedback-2", "two.mp4"),
      file("book-guide", "book", "storage-book-guide", "guide.pdf", "application/pdf", "admin_delivery"),
      file("project-over-prep", "project-over", "storage-project-over-prep", "preparation.pdf", "application/pdf", "admin_delivery"),
      file("project-over-1", "project-over", "storage-project-over-1", "one.mp4"),
      file("project-over-2", "project-over", "storage-project-over-2", "two.mp4"),
    ],
    clientRequestEvents: [
      { _id: "prep-project-event", requestId: "project", eventType: "admin_delivery_recorded", toStatus: "todo", sourceId: "admin:admin-1:file:project-prep", createdAt: 2 },
      { _id: "guide-book-event", requestId: "book", eventType: "admin_delivery_recorded", toStatus: "todo", sourceId: "admin:admin-1:file:book-guide", createdAt: 2 },
      { _id: "prep-project-over-event", requestId: "project-over", eventType: "admin_delivery_recorded", toStatus: "todo", sourceId: "admin:admin-1:file:project-over-prep", createdAt: 2 },
    ],
    clientSubmissions: [],
    clientSubmissionUploads: [],
    reviewCycles: [],
    reviewDrafts: [],
    reviewSnapshots: [],
    deliveryNotificationOutbox: [],
  };
  const metadata = new Map([
    ["storage-project-prep", { size: 1200, contentType: "application/pdf" }],
    ["storage-feedback-1", { size: 3209, contentType: "video/mp4" }],
    ["storage-feedback-2", { size: 3209, contentType: "video/mp4" }],
    ["storage-book-guide", { size: 1200, contentType: "application/pdf" }],
  ]);
  const urls = new Map([
    ["storage-feedback-1", "https://storage.example.test/feedback-1"],
    ["storage-feedback-2", "https://storage.example.test/feedback-2"],
  ]);
  let identity = null;
  let serial = 0;
  const scheduled = [];
  const rows = (table) => state[table] || [];
  const query = (table) => {
    const all = rows(table);
    const chain = (pred = () => true) => ({
      first: async () => all.find(pred) || null,
      unique: async () => all.find(pred) || null,
      collect: async () => all.filter(pred),
    });
    const indexedQuery = {
      eq: (field, value) => {
        equals.push([field, value]);
        return indexedQuery;
      },
    };
    const equals = [];
    return {
      first: async () => all[0] || null,
      unique: async () => all[0] || null,
      collect: async () => [...all],
      withIndex: (_name, callback) => {
        callback(indexedQuery);
        return chain((row) => equals.every(([field, value]) => row[field] === value));
      },
    };
  };
  const ctx = {
    auth: { getUserIdentity: async () => identity },
    db: {
      query,
      get: async (id) => Object.values(state).flat().find((row) => row?._id === id) || null,
      insert: async (table, value) => {
        const id = `${table}-${++serial}`;
        rows(table).push({ _id: id, _creationTime: serial, ...value });
        return id;
      },
      patch: async (id, value) => {
        const row = Object.values(state).flat().find((candidate) => candidate?._id === id);
        if (!row) throw new Error(`Missing row ${id}`);
        Object.assign(row, value);
      },
      delete: async (id) => {
        for (const [table, tableRows] of Object.entries(state)) {
          if (!Array.isArray(tableRows)) continue;
          const index = tableRows.findIndex((row) => row?._id === id);
          if (index >= 0) {
            tableRows.splice(index, 1);
            return;
          }
        }
        throw new Error(`Missing row ${id}`);
      },
    },
    storage: {
      getUrl: async (id) => urls.get(id) || null,
      getMetadata: async (id) => metadata.get(id) || { size: 3209, contentType: "video/mp4" },
      generateUploadUrl: async () => `https://upload.example.test/${++serial}`,
      delete: async () => {},
    },
    scheduler: { runAfter: async (_delay, _fn, args) => { scheduled.push(args); } },
  };
  return {
    ctx,
    state,
    scheduled,
    asAdmin: () => { identity = { subject: "admin-1", tokenIdentifier: "token-admin" }; },
    asA: () => { identity = { subject: "member-a", tokenIdentifier: "token-a" }; },
    asB: () => { identity = { subject: "member-b", tokenIdentifier: "token-b" }; },
  };
}

function reviewSave(requestId, cycleNumber, sourceFileId) {
  return {
    requestId,
    cycleNumber,
    ...(sourceFileId ? { sourceFileId } : {}),
    expectedRevision: 0,
    strokesJson: JSON.stringify([{ frame: 1, end: 1, color: "#FF4D4D", size: 4, pts: [[0.1, 0.1], [0.2, 0.2]] }]),
    textBoxesJson: "[]",
    commentsJson: "[]",
    fps: 24,
    duration: 2,
    videoWidth: 640,
    videoHeight: 360,
  };
}

const harness = makeHarness();
harness.asA();

// Regression: this mirrors the DEV dossier that incorrectly projected the
// questionnaire video as the first animation submission. The repair removes
// only the projection rows and preserves the original questionnaire file.
harness.state.clientRequests.push(request("project-questionnaire", "member-a", "token-a", "projet-animation"));
harness.state.clientRequestFiles.push(
  file("project-questionnaire-prep", "project-questionnaire", "storage-project-questionnaire-prep", "preparation.pdf", "application/pdf", "admin_delivery"),
  file("project-questionnaire-video", "project-questionnaire", "storage-project-questionnaire-video", "questionnaire.mp4"),
);
harness.state.clientRequestEvents.push({
  _id: "project-questionnaire-prep-event",
  requestId: "project-questionnaire",
  eventType: "admin_delivery_recorded",
  toStatus: "todo",
  sourceId: "admin:admin-1:file:project-questionnaire-prep",
  createdAt: 2,
});
harness.state.clientSubmissions.push({
  _id: "project-questionnaire-bad-submission",
  requestId: "project-questionnaire",
  clerkUserId: "member-a",
  tokenIdentifier: "token-a",
  offerKey: "projet-animation",
  kind: "animation",
  sequence: 1,
  status: "submitted",
  payloadJson: "{}",
  sourceFileIds: ["project-questionnaire-video"],
  submittedAt: 3,
  createdAt: 3,
  updatedAt: 3,
});
harness.state.reviewCycles.push({
  _id: "project-questionnaire-bad-cycle",
  requestId: "project-questionnaire",
  submissionId: "project-questionnaire-bad-submission",
  offerKey: "projet-animation",
  kind: "animation",
  cycleNumber: 1,
  status: "submitted",
  sourceFileId: "project-questionnaire-video",
  submittedAt: 3,
  createdAt: 3,
  updatedAt: 3,
});
const repairedProjection = await handlers.repairAnimationQuestionnaireProjection(harness.ctx, {
  requestId: "project-questionnaire",
  expectedSubmissionId: "project-questionnaire-bad-submission",
  expectedSourceFileId: "project-questionnaire-video",
  expectedClerkUserId: "member-a",
});
assert.equal(repairedProjection.status, "repaired");
assert.equal(harness.state.clientRequestFiles.find((row) => row._id === "project-questionnaire-video").kind, "video");
assert.equal(harness.state.clientSubmissions.some((row) => row._id === "project-questionnaire-bad-submission"), false);
assert.equal(harness.state.reviewCycles.some((row) => row._id === "project-questionnaire-bad-cycle"), false);
const repairedAgain = await handlers.repairAnimationQuestionnaireProjection(harness.ctx, {
  requestId: "project-questionnaire",
  expectedSubmissionId: "project-questionnaire-bad-submission",
  expectedSourceFileId: "project-questionnaire-video",
  expectedClerkUserId: "member-a",
});
assert.equal(repairedAgain.status, "already_clean", "the bounded projection repair must be idempotent");
const orphanSubmission = {
  _id: "project-questionnaire-orphan-submission",
  requestId: "project-questionnaire",
  clerkUserId: "member-a",
  tokenIdentifier: "token-a",
  offerKey: "projet-animation",
  kind: "animation",
  sequence: 2,
  status: "draft",
  payloadJson: "{}",
  sourceFileIds: [],
  createdAt: 4,
  updatedAt: 4,
};
harness.state.clientSubmissions.push(orphanSubmission);
await assert.rejects(
  () => handlers.repairAnimationQuestionnaireProjection(harness.ctx, {
    requestId: "project-questionnaire",
    expectedSubmissionId: "project-questionnaire-bad-submission",
    expectedSourceFileId: "project-questionnaire-video",
    expectedClerkUserId: "member-a",
  }),
  /REPAIR_REFUSED: orphan_submission_exists/,
);
harness.state.clientSubmissions.splice(harness.state.clientSubmissions.indexOf(orphanSubmission), 1);
const orphanUpload = { _id: "project-questionnaire-orphan-upload", requestId: "project-questionnaire", submissionId: "project-questionnaire-bad-submission" };
harness.state.clientSubmissionUploads.push(orphanUpload);
await assert.rejects(
  () => handlers.repairAnimationQuestionnaireProjection(harness.ctx, {
    requestId: "project-questionnaire",
    expectedSubmissionId: "project-questionnaire-bad-submission",
    expectedSourceFileId: "project-questionnaire-video",
    expectedClerkUserId: "member-a",
  }),
  /REPAIR_REFUSED: orphan_submission_upload_exists/,
);
harness.state.clientSubmissionUploads.splice(harness.state.clientSubmissionUploads.indexOf(orphanUpload), 1);

const questionnaireProgress = await handlers.ensureInitialSubmission(harness.ctx, { requestId: "project-questionnaire" });
assert.equal(questionnaireProgress.canSubmit, true, "a project questionnaire must not consume the first submission slot");
assert.equal(questionnaireProgress.nextSequence, 1);
assert.equal(harness.state.clientSubmissions.some((row) => row.requestId === "project-questionnaire"), false);
harness.asAdmin();
await assert.rejects(
  () => handlers.ensureReview(harness.ctx, { requestId: "project-questionnaire", cycleNumber: 1, sourceFileId: "project-questionnaire-video" }),
  /SUBMISSION_REQUIRED/,
  "the admin studio cannot open the questionnaire video as a first review",
);
harness.asA();
const questionnaireUpload = await handlers.prepareSubmissionUpload(harness.ctx, {
  requestId: "project-questionnaire",
  sequence: 1,
  uploadKey: "project-questionnaire-upload-one",
  name: "first.mp4",
  mimeType: "video/mp4",
  size: 3209,
});
const questionnaireFinalized = await handlers.finalizeSubmission(harness.ctx, {
  requestId: "project-questionnaire",
  submissionId: questionnaireUpload.submissionId,
  uploadKey: questionnaireUpload.uploadKey,
  storageId: "storage-project-questionnaire-one",
  payloadJson: JSON.stringify({ duration: 2, fps: 24, videoWidth: 640, videoHeight: 360 }),
});
const questionnaireSource = questionnaireFinalized.submission.files[0];
assert.equal(questionnaireSource.kind, "submission");
assert.notEqual(questionnaireSource.id, "project-questionnaire-video");
assert.equal(harness.state.clientRequestFiles.find((row) => row._id === "project-questionnaire-video").status, "active");
harness.asB();
await assert.rejects(() => handlers.getMyReviewProgress(harness.ctx, { requestId: "project-questionnaire" }), /FORBIDDEN/);
harness.asA();

// A published historical cycle is never a repair candidate and must remain
// byte-for-byte addressable by its immutable snapshot.
harness.state.clientRequests.push(request("project-published", "member-a", "token-a", "projet-animation"));
harness.state.clientRequestFiles.push(
  file("project-published-prep", "project-published", "storage-project-published-prep", "preparation.pdf", "application/pdf", "admin_delivery"),
  file("project-published-video", "project-published", "storage-project-published-video", "published.mp4", "video/mp4", "submission"),
);
harness.state.clientSubmissions.push({
  _id: "project-published-submission",
  requestId: "project-published",
  clerkUserId: "member-a",
  tokenIdentifier: "token-a",
  offerKey: "projet-animation",
  kind: "animation",
  sequence: 1,
  status: "published",
  payloadJson: "{}",
  sourceFileIds: ["project-published-video"],
  submittedAt: 3,
  reviewedAt: 5,
  createdAt: 3,
  updatedAt: 5,
});
harness.state.reviewCycles.push({
  _id: "project-published-cycle",
  requestId: "project-published",
  submissionId: "project-published-submission",
  offerKey: "projet-animation",
  kind: "animation",
  cycleNumber: 1,
  status: "published",
  sourceFileId: "project-published-video",
  reviewDraftId: "project-published-draft",
  reviewSnapshotId: "project-published-snapshot",
  publishedAt: 5,
  createdAt: 3,
  updatedAt: 5,
});
harness.state.reviewDrafts.push({ _id: "project-published-draft", requestId: "project-published", status: "published", cycleNumber: 1, sourceFileId: "project-published-video", publishedSnapshotId: "project-published-snapshot" });
harness.state.reviewSnapshots.push({ _id: "project-published-snapshot", requestId: "project-published", cycleNumber: 1, sourceFileId: "project-published-video" });
await assert.rejects(
  () => handlers.repairAnimationQuestionnaireProjection(harness.ctx, {
    requestId: "project-published",
    expectedSubmissionId: "project-published-submission",
    expectedSourceFileId: "project-published-video",
    expectedClerkUserId: "member-a",
  }),
  /REPAIR_REFUSED: submission_not_unpublished/,
);
assert.equal(harness.state.clientSubmissions.some((row) => row._id === "project-published-submission"), true);
assert.equal(harness.state.reviewSnapshots.some((row) => row._id === "project-published-snapshot"), true);

// Project: the preparation gate opens the first version, then exactly one
// corrected version after the first immutable snapshot.
const overProgress = await handlers.ensureInitialSubmission(harness.ctx, { requestId: "project-over", sourceFileId: "project-over-1" });
assert.equal(overProgress.canSubmit, true, "questionnaire attachments do not become project submissions");
assert.equal(harness.state.clientSubmissions.some((row) => row.requestId === "project-over"), false);
let progress = await handlers.ensureInitialSubmission(harness.ctx, { requestId: "project" });
assert.equal(progress.canSubmit, true);
assert.equal(progress.nextSequence, 1);
await assert.rejects(() => handlers.prepareSubmissionUpload(harness.ctx, { requestId: "project", sequence: 1, uploadKey: "project-upload-too-large", name: "too-large.mp4", mimeType: "video/mp4", size: 1_073_741_825 }), /INVALID_INPUT/);
const firstUpload = await handlers.prepareSubmissionUpload(harness.ctx, { requestId: "project", sequence: 1, uploadKey: "project-upload-one", name: "first.mp4", mimeType: "video/mp4", size: 3209 });
const firstFinalized = await handlers.finalizeSubmission(harness.ctx, { requestId: "project", submissionId: firstUpload.submissionId, uploadKey: firstUpload.uploadKey, storageId: "storage-project-one", payloadJson: JSON.stringify({ duration: 2, fps: 24, videoWidth: 640, videoHeight: 360 }) });
const firstSourceId = firstFinalized.submission.files[0].id;
harness.asAdmin();
await handlers.ensureReview(harness.ctx, { requestId: "project", cycleNumber: 1, sourceFileId: firstSourceId });
await handlers.saveReview(harness.ctx, reviewSave("project", 1, firstSourceId));
await handlers.publishReview(harness.ctx, { requestId: "project", cycleNumber: 1, sourceFileId: firstSourceId, expectedRevision: 1 });
harness.asA();
progress = await handlers.getMyReviewProgress(harness.ctx, { requestId: "project" });
assert.equal(progress.canSubmit, true);
assert.equal(progress.nextSequence, 2);

// A pending second draft has no source yet. It must not let the admin reuse
// the first submitted file while the corrected version is still uploading.
const pendingSecondUpload = await handlers.prepareSubmissionUpload(harness.ctx, {
  requestId: "project",
  sequence: 2,
  uploadKey: "project-upload-two-draft",
  name: "second-pending.mp4",
  mimeType: "video/mp4",
  size: 3209,
});
harness.asAdmin();
await assert.rejects(
  () => handlers.ensureReview(harness.ctx, { requestId: "project", cycleNumber: 2, sourceFileId: firstSourceId }),
  /SUBMISSION_REQUIRED/,
  "cycle 2 must not reuse cycle 1 while the corrected upload is pending",
);
harness.asA();
harness.state.clientSubmissionUploads.splice(
  harness.state.clientSubmissionUploads.findIndex((row) => row.uploadKey === pendingSecondUpload.uploadKey),
  1,
);
harness.state.reviewCycles.splice(
  harness.state.reviewCycles.findIndex((row) => row.submissionId === pendingSecondUpload.submissionId && row.cycleNumber === 2),
  1,
);
harness.state.clientSubmissions.splice(
  harness.state.clientSubmissions.findIndex((row) => row._id === pendingSecondUpload.submissionId),
  1,
);

harness.state.clientRequestFiles.push(file("project-second-questionnaire", "project", "storage-project-second-questionnaire", "second-questionnaire.mp4"));
const badSecondSubmission = {
  _id: "project-bad-second-submission",
  requestId: "project",
  clerkUserId: "member-a",
  tokenIdentifier: "token-a",
  offerKey: "projet-animation",
  kind: "animation",
  sequence: 2,
  status: "submitted",
  payloadJson: "{}",
  sourceFileIds: ["project-second-questionnaire"],
  submittedAt: 4,
  createdAt: 4,
  updatedAt: 4,
};
harness.state.clientSubmissions.push(badSecondSubmission);
harness.state.reviewCycles.push({
  _id: "project-bad-second-cycle",
  requestId: "project",
  submissionId: "project-bad-second-submission",
  offerKey: "projet-animation",
  kind: "animation",
  cycleNumber: 2,
  status: "submitted",
  sourceFileId: "project-second-questionnaire",
  submittedAt: 4,
  createdAt: 4,
  updatedAt: 4,
});
harness.asAdmin();
await assert.rejects(
  () => handlers.ensureReview(harness.ctx, { requestId: "project", cycleNumber: 2, sourceFileId: "project-second-questionnaire" }),
  /SUBMISSION_REQUIRED/,
  "cycle 2 must also reject a questionnaire source",
);
harness.state.clientSubmissions.splice(harness.state.clientSubmissions.indexOf(badSecondSubmission), 1);
harness.state.reviewCycles.splice(harness.state.reviewCycles.findIndex((row) => row._id === "project-bad-second-cycle"), 1);
harness.state.clientRequestFiles.splice(harness.state.clientRequestFiles.findIndex((row) => row._id === "project-second-questionnaire"), 1);
harness.asA();
const secondUpload = await handlers.prepareSubmissionUpload(harness.ctx, { requestId: "project", sequence: 2, uploadKey: "project-upload-two", name: "second.mp4", mimeType: "video/mp4", size: 3209 });
const secondFinalized = await handlers.finalizeSubmission(harness.ctx, { requestId: "project", submissionId: secondUpload.submissionId, uploadKey: secondUpload.uploadKey, storageId: "storage-project-two", payloadJson: JSON.stringify({ duration: 2, fps: 24, videoWidth: 640, videoHeight: 360 }) });
const secondSourceId = secondFinalized.submission.files[0].id;
harness.asAdmin();
await handlers.ensureReview(harness.ctx, { requestId: "project", cycleNumber: 2 });
await handlers.saveReview(harness.ctx, reviewSave("project", 2, secondSourceId));
await handlers.publishReview(harness.ctx, { requestId: "project", cycleNumber: 2, expectedRevision: 1 });
harness.asA();
const projectReviews = await handlers.getMyPublishedReviews(harness.ctx, { requestId: "project" });
assert.deepEqual(projectReviews.map((review) => review.cycleNumber), [1, 2]);
assert.notEqual(projectReviews[0].source.id, projectReviews[1].source.id, "new versions must keep separate source files");
const projectNotifications = harness.state.deliveryNotificationOutbox.filter((row) => row.requestId === "project");
assert.equal(projectNotifications.length, 2, "each promised project cycle creates one delivery notification");
assert.deepEqual(projectNotifications.map((row) => row.sourceId), harness.state.reviewCycles.filter((row) => row.requestId === "project").sort((left, right) => left.cycleNumber - right.cycleNumber).map((row) => row._id));
await assert.rejects(() => handlers.prepareSubmissionUpload(harness.ctx, { requestId: "project", sequence: 3, uploadKey: "project-upload-three", name: "third.mp4", mimeType: "video/mp4", size: 3209 }), /LIMIT_REACHED/);
harness.asB();
await assert.rejects(() => handlers.getMyReviewProgress(harness.ctx, { requestId: "project" }), /FORBIDDEN/);

// Feedback: multiple paid plans share one correction pass, but each source
// gets its own immutable annotation snapshot and private media path.
harness.asAdmin();
for (const sourceFileId of ["feedback-1", "feedback-2"]) {
  await handlers.ensureReview(harness.ctx, { requestId: "feedback", cycleNumber: 1, sourceFileId });
  await handlers.saveReview(harness.ctx, reviewSave("feedback", 1, sourceFileId));
  await handlers.publishReview(harness.ctx, { requestId: "feedback", cycleNumber: 1, sourceFileId, expectedRevision: 1 });
  const feedbackNotifications = harness.state.deliveryNotificationOutbox.filter((row) => row.requestId === "feedback");
  assert.equal(feedbackNotifications.length, sourceFileId === "feedback-1" ? 0 : 1, "one feedback delivery notification is created only after every plan is published");
}
harness.asA();
const feedbackReviews = await handlers.getMyPublishedReviews(harness.ctx, { requestId: "feedback" });
assert.equal(feedbackReviews.length, 2);
assert.equal(new Set(feedbackReviews.map((review) => review.source.id)).size, 2);
const feedbackNotification = harness.state.deliveryNotificationOutbox.find((row) => row.requestId === "feedback");
const feedbackCycle = harness.state.reviewCycles.find((row) => row.requestId === "feedback" && row.cycleNumber === 1);
assert.equal(feedbackNotification.sourceId, feedbackCycle._id, "multi-plan notification uses the stable completed cycle id");
await assert.rejects(() => handlers.prepareSubmissionUpload(harness.ctx, { requestId: "feedback", sequence: 2, uploadKey: "feedback-upload-two", name: "extra.mp4", mimeType: "video/mp4", size: 3209 }), /LIMIT_REACHED|eligible/);

// Book: the second link is available only after the first guide was delivered,
// and one published notes record closes the only additional reading.
const bookProgress = await handlers.ensureInitialSubmission(harness.ctx, { requestId: "book" });
assert.equal(bookProgress.canSubmit, true);
const bookSubmitted = await handlers.submitBookRevision(harness.ctx, { requestId: "book", workLink: "https://book.example.test/v2", password: "new-secret" });
assert.equal(bookSubmitted.ok, true);
assert.equal(Object.hasOwn(bookSubmitted.progress.submissions.find((submission) => submission.sequence === 2).payload, "password"), false, "the buyer progress never returns the book password");
const duplicateBook = await handlers.submitBookRevision(harness.ctx, { requestId: "book", workLink: "https://book.example.test/v3", password: "ignored" });
assert.equal(duplicateBook.duplicate, true, "a submitted second book cannot be overwritten");
harness.asAdmin();
const adminBookProgress = await handlers.getAdminReviewProgress(harness.ctx, { requestId: "book" });
assert.equal(adminBookProgress.submissions.find((submission) => submission.sequence === 2).payload.password, "new-secret", "only the admin review query can read the protected book password");
const bookPublished = await handlers.publishBookReview(harness.ctx, { requestId: "book", summary: "La sélection est plus lisible.", priorities: "Resserre l'ordre des plans.", nextSteps: "Garde une accroche courte." });
assert.equal(bookPublished.cycle.status, "published");
assert.equal(harness.state.deliveryNotificationOutbox.find((row) => row.requestId === "book").deliveryLabel, "Ton deuxième retour sur ton book");
harness.asA();
const finalBook = await handlers.getMyReviewProgress(harness.ctx, { requestId: "book" });
assert.equal(finalBook.cycles.find((cycle) => cycle.cycleNumber === 2).status, "published");
assert.equal(finalBook.cycles.find((cycle) => cycle.cycleNumber === 2).notes.summary, "La sélection est plus lisible.");
assert.ok(harness.state.reviewSnapshots.length >= 4);
assert.ok(harness.scheduled.length >= 3, "published reviews enqueue one notification each completed review");

console.log("review submissions checks passed: bounded questionnaire repair, post-preparation kind=submission gate, private versions, exact project cycles, published-history protection, multi-file feedback, book second reading, ACL and no extra cycle");
