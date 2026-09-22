import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ensureReview,
  getAdminReview,
  getMyPublishedReview,
  getReviewVideoDownload,
  publishReview,
  saveReview,
} from "../convex/reviewStudio.js";
import { getReviewStudioQueryArgs, getReviewStudioStatus } from "../components/reviewStudioAccess.mjs";

process.env.BOOKING_WEBHOOK_SECRET = "review-secret-test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

function makeContext() {
  const state = {
    users: [
      { _id: "user-admin", tokenIdentifier: "token-admin", clerkUserId: "admin-1", role: "admin" },
      { _id: "user-a", tokenIdentifier: "token-a", clerkUserId: "member-a", role: "member" },
      { _id: "user-b", tokenIdentifier: "token-b", clerkUserId: "member-b", role: "member" },
    ],
    clientRequests: [
      request("request-paid-a", "member-a", "token-a", "feedback", "paid", "paid"),
      request("request-project-a", "member-a", "token-a", "projet-animation", "paid", "paid"),
      request("request-paid-b", "member-b", "token-b", "feedback", "paid", "paid"),
      request("request-unpaid-a", "member-a", "token-a", "feedback", "awaiting_payment", "unpaid"),
      request("request-refunded-a", "member-a", "token-a", "feedback", "refunded", "refunded"),
    ],
    clientRequestFiles: [
      videoFile("file-paid-a", "request-paid-a", "storage-paid-a"),
      videoFile("file-project-a", "request-project-a", "storage-project-a", "submission"),
      {
        _id: "file-project-prep",
        requestId: "request-project-a",
        clerkUserId: "admin-1",
        tokenIdentifier: "token-admin",
        storageId: "storage-project-prep",
        name: "preparation.pdf",
        mimeType: "application/pdf",
        size: 1200,
        kind: "admin_delivery",
        deliveryStage: "preparation",
        status: "active",
        createdAt: 1,
        updatedAt: 1,
      },
      videoFile("file-paid-b", "request-paid-b", "storage-paid-b"),
      videoFile("file-unpaid-a", "request-unpaid-a", "storage-unpaid-a"),
      videoFile("file-refunded-a", "request-refunded-a", "storage-refunded-a"),
    ],
    reviewDrafts: [],
    reviewSnapshots: [],
    clientSubmissions: [{
      _id: "submission-project-a",
      requestId: "request-project-a",
      clerkUserId: "member-a",
      tokenIdentifier: "token-a",
      offerKey: "projet-animation",
      kind: "animation",
      sequence: 1,
      status: "submitted",
      payloadJson: "{}",
      sourceFileIds: ["file-project-a"],
      submittedAt: 3,
      createdAt: 3,
      updatedAt: 3,
    }],
    clientSubmissionUploads: [],
    reviewCycles: [],
    clientRequestEvents: [
      { _id: "event-project-prep", requestId: "request-project-a", eventType: "admin_delivery_recorded", toStatus: "todo", sourceId: "admin:admin-1:file:file-project-prep", createdAt: 2 },
    ],
    deliveryNotificationOutbox: [],
  };
  const storage = new Map([
    ["storage-paid-a", "https://storage.example.test/paid-a"],
    ["storage-project-a", "https://storage.example.test/project-a"],
    ["storage-project-prep", "https://storage.example.test/project-prep"],
    ["storage-paid-b", "https://storage.example.test/paid-b"],
    ["storage-unpaid-a", "https://storage.example.test/unpaid-a"],
    ["storage-refunded-a", "https://storage.example.test/refunded-a"],
  ]);
  let identity = null;
  let sequence = 0;

  function rows(table) { return state[table] || []; }
  function query(table) {
    const all = rows(table);
    const chain = (predicate = () => true) => ({
      first: async () => all.find(predicate) || null,
      unique: async () => all.filter(predicate)[0] || null,
      collect: async () => all.filter(predicate),
    });
    return {
      first: async () => all[0] || null,
      unique: async () => all[0] || null,
      collect: async () => [...all],
      withIndex: (_indexName, callback) => {
        const equals = [];
        const indexedQuery = {
          eq: (nextField, nextValue) => {
            equals.push([nextField, nextValue]);
            return indexedQuery;
          },
        };
        callback(indexedQuery);
        return chain((row) => equals.every(([field, value]) => row[field] === value));
      },
    };
  }

  const ctx = {
    auth: { getUserIdentity: async () => identity },
    db: {
      query,
      get: async (id) => Object.values(state).flat().find((row) => row?._id === id) || null,
      insert: async (table, value) => {
        const id = `${table}-${++sequence}`;
        const row = { _id: id, _creationTime: sequence, ...value };
        rows(table).push(row);
        return id;
      },
      patch: async (id, patch) => {
        const row = Object.values(state).flat().find((candidate) => candidate?._id === id);
        if (!row) throw new Error(`missing row ${id}`);
        Object.assign(row, patch);
      },
    },
    storage: { getUrl: async (id) => storage.get(id) || null },
  };

  return {
    ctx,
    asAdmin: () => { identity = { subject: "admin-1", tokenIdentifier: "token-admin" }; },
    asMemberA: () => { identity = { subject: "member-a", tokenIdentifier: "token-a" }; },
    asMemberB: () => { identity = { subject: "member-b", tokenIdentifier: "token-b" }; },
    asAnonymous: () => { identity = null; },
    state,
  };
}

function request(id, clerkUserId, tokenIdentifier, offerKey, status, paymentStatus) {
  return {
    _id: id,
    clerkUserId,
    tokenIdentifier,
    offerKey,
    status,
    paymentStatus,
    answersJson: offerKey === "feedback"
      ? JSON.stringify({ plans: [{ name: "plan.mp4", duration: 2, size: 3209, mimeType: "video/mp4" }], intent: "Ralentir les poses.", blocker: "", references: "" })
      : "{}",
    createdAt: 1,
    updatedAt: 1,
  };
}

function videoFile(id, requestId, storageId, kind = "video") {
  return {
    _id: id,
    requestId,
    clerkUserId: "member-a",
    tokenIdentifier: "token-a",
    storageId,
    name: `${id}.mp4`,
    mimeType: "video/mp4",
    size: 3209,
    kind,
    status: "active",
    createdAt: 1,
    updatedAt: 1,
  };
}

const handlers = {
  ensureReview: ensureReview._handler,
  getAdminReview: getAdminReview._handler,
  saveReview: saveReview._handler,
  publishReview: publishReview._handler,
  getMyPublishedReview: getMyPublishedReview._handler,
  getReviewVideoDownload: getReviewVideoDownload._handler,
};

const harness = makeContext();

assert.equal(
  getReviewStudioQueryArgs({ authLoading: true, isAuthenticated: true, clerkLoaded: true, clerkUserId: "admin-1", requestId: "request-paid-a" }),
  "skip",
  "the admin review query must wait for Convex authentication",
);
assert.equal(
  getReviewStudioQueryArgs({ authLoading: false, isAuthenticated: false, clerkLoaded: true, clerkUserId: "admin-1", requestId: "request-paid-a" }),
  "skip",
  "the admin review query must never run while unauthenticated",
);
assert.deepEqual(
  getReviewStudioQueryArgs({ authLoading: false, isAuthenticated: true, clerkLoaded: true, clerkUserId: "admin-1", requestId: "request-paid-a", cycleNumber: 1, sourceFileId: "file-paid-a" }),
  { requestId: "request-paid-a", cycleNumber: 1, sourceFileId: "file-paid-a" },
  "the admin review query must run only for the settled identity and requested source",
);
assert.equal(getReviewStudioStatus({ clerkLoaded: false, authLoading: true }), "auth-loading");
assert.equal(getReviewStudioStatus({ clerkLoaded: true, authLoading: false, isAuthenticated: false }), "unauthenticated");
assert.equal(getReviewStudioStatus({ clerkLoaded: true, authLoading: false, isAuthenticated: true, clerkUserId: "admin-1", queryStatus: "error" }), "error");
assert.equal(getReviewStudioStatus({ clerkLoaded: true, authLoading: false, isAuthenticated: true, clerkUserId: "admin-1", queryStatus: "success" }), "ready");

harness.asAnonymous();
await assert.rejects(() => handlers.getAdminReview(harness.ctx, { requestId: "request-paid-a" }), /UNAUTHENTICATED/);

harness.asAdmin();
const initial = await handlers.getAdminReview(harness.ctx, { requestId: "request-paid-a" });
assert.equal(initial.id, null);
assert.equal(initial.source.id, "file-paid-a");
assert.equal(initial.videoUrl, "/api/review-media/request-paid-a/video?file=file-paid-a");
assert.doesNotMatch(JSON.stringify(initial), /storage\.example\.test|https?:\/\//, "admin editor payload must not leak a storage URL");

const draft = await handlers.ensureReview(harness.ctx, { requestId: "request-paid-a" });
assert.ok(draft.id);
assert.equal(draft.revision, 0);

const baseSave = {
  requestId: "request-paid-a",
  expectedRevision: 0,
  strokesJson: JSON.stringify([{ frame: 4, end: 5, color: "#FF4D4D", size: 4, pts: [[0.1, 0.2], [0.4, 0.5]] }]),
  textBoxesJson: JSON.stringify([]),
  commentsJson: JSON.stringify([]),
  fps: 24,
  duration: 2,
  videoWidth: 640,
  videoHeight: 360,
};
const firstSave = await handlers.saveReview(harness.ctx, baseSave);
assert.deepEqual({ ok: firstSave.ok, revision: firstSave.revision }, { ok: true, revision: 1 });

const stale = await handlers.saveReview(harness.ctx, { ...baseSave, strokesJson: JSON.stringify([]) });
assert.equal(stale.conflict, true, "a stale editor must receive an explicit conflict");
assert.equal(stale.current.revision, 1);

const secondSave = await handlers.saveReview(harness.ctx, {
  ...baseSave,
  expectedRevision: 1,
  strokesJson: JSON.stringify([{ frame: 4, end: 5, color: "#FF4D4D", size: 4, pts: [[0.1, 0.2], [0.4, 0.5]] }]),
  commentsJson: JSON.stringify([{ id: "comment-1", time: 0.5, text: "Décale cette pose." }]),
});
assert.equal(secondSave.revision, 2);
const published = await handlers.publishReview(harness.ctx, { requestId: "request-paid-a", expectedRevision: 2 });
assert.equal(published.ok, true);
assert.equal(published.snapshot.status, "published");
assert.equal(published.snapshot.videoUrl, "/api/review-media/request-paid-a/video?file=file-paid-a");
assert.equal(harness.state.reviewSnapshots.length, 1, "publication creates one immutable snapshot");

harness.asMemberA();
const mine = await handlers.getMyPublishedReview(harness.ctx, { requestId: "request-paid-a" });
assert.equal(mine.comments[0].text, "Décale cette pose.");
assert.equal(mine.videoUrl, "/api/review-media/request-paid-a/video?file=file-paid-a");
assert.doesNotMatch(JSON.stringify(mine), /storage\.example\.test|https?:\/\//, "buyer payload must contain only the same-origin proxy");
await assert.rejects(() => handlers.getReviewVideoDownload(harness.ctx, { requestId: "request-paid-a" }), /FORBIDDEN/);
const proxyFile = await handlers.getReviewVideoDownload(harness.ctx, { requestId: "request-paid-a", serverSecret: "review-secret-test" });
assert.equal(proxyFile.url, "https://storage.example.test/paid-a");

harness.asAdmin();
const projectInitial = await handlers.getAdminReview(harness.ctx, { requestId: "request-project-a" });
assert.equal(projectInitial.source.id, "file-project-a", "the animation-project offer resolves its paid dossier video");
await handlers.ensureReview(harness.ctx, { requestId: "request-project-a" });
const projectSave = await handlers.saveReview(harness.ctx, {
  requestId: "request-project-a",
  expectedRevision: 0,
  strokesJson: JSON.stringify([]),
  textBoxesJson: JSON.stringify([]),
  commentsJson: JSON.stringify([{ id: "project-comment", time: 0.25, text: "Ralentir ici." }]),
  fps: 24,
  duration: 2,
  videoWidth: 640,
  videoHeight: 360,
});
assert.equal(projectSave.revision, 1, "animation-project drafts use the same optimistic revision contract");
const projectPublished = await handlers.publishReview(harness.ctx, { requestId: "request-project-a", expectedRevision: 1 });
assert.equal(projectPublished.snapshot.status, "published", "animation-project reviews can be frozen for the buyer");
harness.asMemberA();
assert.equal((await handlers.getMyPublishedReview(harness.ctx, { requestId: "request-project-a" })).comments[0].text, "Ralentir ici.");

harness.asMemberB();
assert.equal(await handlers.getMyPublishedReview(harness.ctx, { requestId: "request-paid-b" }), null, "a paid buyer cannot see an unpublished draft");
await assert.rejects(() => handlers.getReviewVideoDownload(harness.ctx, { requestId: "request-paid-b", serverSecret: "review-secret-test" }), /FORBIDDEN/);
await assert.rejects(() => handlers.getMyPublishedReview(harness.ctx, { requestId: "request-paid-a" }), /FORBIDDEN/);
await assert.rejects(() => handlers.getReviewVideoDownload(harness.ctx, { requestId: "request-paid-a", serverSecret: "review-secret-test" }), /FORBIDDEN/);

harness.asMemberA();
for (const requestId of ["request-unpaid-a", "request-refunded-a"]) {
  await assert.rejects(() => handlers.getMyPublishedReview(harness.ctx, { requestId }), /INVALID_STATE|FORBIDDEN/);
  await assert.rejects(() => handlers.getReviewVideoDownload(harness.ctx, { requestId, serverSecret: "review-secret-test" }), /INVALID_STATE|FORBIDDEN/);
}

harness.asAdmin();
await assert.rejects(() => handlers.saveReview(harness.ctx, { ...baseSave, expectedRevision: 2 }), /PUBLISHED/);
const idempotentPublish = await handlers.publishReview(harness.ctx, { requestId: "request-paid-a", expectedRevision: 2 });
assert.equal(idempotentPublish.snapshot.id, published.snapshot.id, "republishing cannot create a second mutable version");
await assert.rejects(() => handlers.getAdminReview(harness.ctx, { requestId: "request-unpaid-a" }), /INVALID_STATE|FORBIDDEN/);

const [studioPage, studio, player, route, schema, followUp, library, confirmation] = await Promise.all([
  read("app/nouveau/studio/page.js"),
  read("components/ReviewStudio.js"),
  read("app/nouveau/bibliotheque/ReviewPlayer.js"),
  read("app/api/review-media/[requestId]/video/route.js"),
  read("convex/schema.js"),
  read("app/nouveau/bibliotheque/ProjectFollowUp.js"),
  read("app/nouveau/bibliotheque/Library.js"),
  read("app/nouveau/confirmation/ClientRequestConfirmation.js"),
]);
assert.doesNotMatch(studioPage, /fixtures|getRequestContext/, "the real studio route must not load fixtures");
assert.doesNotMatch(studio, /localStorage|createObjectURL|type="file"/, "the real studio must not use local video/localStorage persistence");
assert.match(studio, /dirtyVersionRef|saveVersion/, "autosave must preserve edits made while a save request is in flight");
assert.match(studio, /useConvexAuth/, "the admin studio must gate Convex queries on auth readiness");
assert.match(studio, /useQuery_experimental/, "the admin studio must expose query errors instead of hiding them behind an undefined result");
assert.match(studio, /reviewQueryArgs/, "the admin studio must pass skip until the settled admin identity is ready");
assert.match(studio, /identityKey/, "the admin studio must reset its local editor lifetime when the Clerk identity changes");
assert.doesNotMatch(player, /createObjectURL|type="file"|input.*upload/i, "the buyer player must not expose a local upload path");
assert.match(route, /Range/, "the private media proxy must forward browser byte ranges");
assert.match(route, /redirect: "error"/, "the private media proxy must not follow storage redirects");
assert.doesNotMatch(route, /Location/, "the private media proxy must not redirect to storage");
assert.match(schema, /reviewDrafts: defineTable/, "review drafts must be persisted in a dedicated table");
assert.match(schema, /reviewSnapshots: defineTable/, "published reviews must use a dedicated immutable table");
assert.match(followUp, /reviewStudio:getMyPublishedReview/, "the buyer follow-up must query the published review");
assert.match(followUp, /initialRequestId/, "deep links must preserve the selected paid dossier");
assert.match(library, /initialRequestId/, "the library must pass the selected dossier through");
assert.match(confirmation, /requestId=\$\{encodeURIComponent\(request\.id\)\}/, "confirmation must deep-link to the paid dossier");
assert.match(confirmation, /FOLLOW_UP_BY_OFFER/, "confirmation must select the matching follow-up offer");

console.log("review studio checks passed: paid source, autosave revision conflict, immutable publication, proxy-only media, owner/payment isolation");
