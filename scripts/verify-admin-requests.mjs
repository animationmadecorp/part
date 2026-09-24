import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  finalizeDelivery,
  getAdminDeliveryUpload,
  getAdminFileDownload,
  getAdminRequest,
  getAdminRequests,
  getLatestAdminWorkStatus,
  prepareDelivery,
  recordDeliveryStorage,
  setWorkStatus,
} from "../convex/adminRequests.js";
import { canReuseUnuploadedReservation, matchesUploadSession, preferNewestUpload } from "../app/nouveau/demandes/deliverySession.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

process.env.BOOKING_WEBHOOK_SECRET = "delivery-secret-test";

const [adminModule, adminFileRoute, page, requests, delivery, fixtures, studio, deliverySession] = await Promise.all([
  read("convex/adminRequests.js"),
  read("app/api/admin-files/[requestId]/[fileId]/route.js"),
  read("app/nouveau/demandes/page.js"),
  read("app/nouveau/demandes/requests.js"),
  read("app/nouveau/demandes/PdfDelivery.js"),
  read("app/nouveau/demandes/fixtures.js"),
  read("app/nouveau/studio/page.js"),
  read("app/nouveau/demandes/deliverySession.mjs"),
]);

const adminFunctions = ["getAdminRequests", "getAdminRequest", "getAdminFileDownload", "getAdminDeliveryUpload", "setWorkStatus", "prepareDelivery", "recordDeliveryStorage", "finalizeDelivery"];
for (const name of adminFunctions) {
  const start = adminModule.indexOf(`export const ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const next = adminModule.indexOf("export const ", start + 1);
  const block = adminModule.slice(start, next === -1 ? undefined : next);
  assert.match(block, /await requireAdmin\(ctx\)/, `${name} must enforce admin authorization`);
}

assert.match(adminModule, /ctx\.db\.insert\("clientRequestEvents"/, "admin actions must write an audit event");
assert.match(adminModule, /ctx\.storage\.getUrl/, "admin file reads must resolve URLs server-side");
assert.match(adminModule, /downloadUrl: `\/api\/admin-files\//, "admin browser payloads must expose only the protected file proxy");
assert.match(adminModule, /serverSecret: v\.string\(\)/, "admin raw storage resolution must require a server-only proof");
assert.match(adminModule, /ctx\.db\.system\.get\("_storage"/, "delivery finalization must validate stored metadata");
assert.match(adminModule, /ctx\.storage\.generateUploadUrl/, "delivery upload must use a server-generated upload URL");
assert.match(adminModule, /admin-delivery:\$\{request\._id\}:\$\{current\.clerkUserId\}:\$\{uploadUrl\}/, "each delivery reservation key must include the unique server upload URL");
assert.match(adminModule, /Storage upload belongs to another dossier/, "a storage reservation cannot be moved across dossiers");
assert.match(adminModule, /status: "finalized"/, "delivery upload must be finalized in Convex");
assert.match(adminModule, /getLatestAdminWorkStatus/, "work status must be derived from persisted events");
assert.match(adminModule, /enqueueDeliveryNotification/, "a finalized PDF must enqueue a delivery notification");
assert.match(adminModule, /kind: "pdf"/, "the PDF publication hook must use the PDF notification kind");

assert.doesNotMatch(page, /requestFixtures/, "the admin page must not load fixture dossiers");
assert.match(page, /<Requests initialRequestId=/, "the page must render the Convex-backed client");
assert.match(requests, /useQuery\("adminRequests:getAdminRequests"/, "the client must query real admin data");
assert.match(requests, /useMutation\("adminRequests:setWorkStatus"/, "status actions must call Convex");
assert.match(requests, /Questionnaire réel/, "the UI must label real questionnaire data");
assert.match(requests, /Historique audité/, "the UI must expose persisted audit history");
assert.match(delivery, /useMutation\("adminRequests:prepareDelivery"/, "delivery preparation must call Convex");
assert.match(delivery, /useQuery\("adminRequests:getAdminDeliveryUpload"/, "delivery retries must read the persisted reservation");
assert.match(delivery, /useMutation\("adminRequests:recordDeliveryStorage"/, "uploaded storage ids must be persisted before finalization");
assert.match(delivery, /useMutation\("adminRequests:finalizeDelivery"/, "delivery finalization must call Convex");
assert.match(delivery, /storageId/, "the client must finalize the server upload result");
assert.match(adminFileRoute, /getAdminFileDownload/, "admin file links must resolve through the authenticated server proxy");
assert.match(adminFileRoute, /redirect: "error"/, "admin file proxy must never follow a storage redirect");
assert.match(adminFileRoute, /private, no-store/, "admin file proxy responses must be private and uncached");
assert.match(adminFileRoute, /application\/octet-stream/, "non-PDF admin files must not be rendered as active browser content");
assert.match(adminFileRoute, /Content-Security-Policy/, "admin file responses must carry an isolation policy");
assert.doesNotMatch(requests, /href=\{file\.url\}/, "admin UI must not render raw storage URLs");
assert.match(deliverySession, /canReuseUnuploadedReservation/, "delivery retries must have an explicit session policy");
assert.doesNotMatch(delivery, /Ton message/, "unsaved delivery messages must not be offered");
assert.doesNotMatch(requests, /offerKey !== "review"/, "paid review dossiers must also offer their PDF delivery");
assert.doesNotMatch(fixtures, /Lina|Noé|Sarah|Book_Lina|Portfolio_Sarah/, "fixture people and files must be gone");
assert.match(fixtures, /requestFixtures = \[\]/, "the compatibility fixture export must be empty");
assert.doesNotMatch(studio, /getRequestContext|fixtures/, "the correction studio must not depend on fixture contexts");
assert.match(studio, /requestId/, "the correction studio must be addressed by the real dossier id");
assert.match(studio, /sourceFileId/, "the correction studio must preserve the selected dossier video");
const deliveryNow = 1_000;
const sameNameAndSize = { name: "guide.pdf", size: 5 };
assert.equal(canReuseUnuploadedReservation({ status: "pending", name: "guide.pdf", expectedSize: 5, expiresAt: 2_000 }, sameNameAndSize, deliveryNow), true);
assert.equal(canReuseUnuploadedReservation({ status: "pending", name: "guide.pdf", expectedSize: 5, storageId: "storage-a", expiresAt: 2_000 }, sameNameAndSize, deliveryNow), false, "a new same-size file cannot reuse an uploaded storage id");
assert.equal(matchesUploadSession({ status: "pending", uploadKey: "upload-a", expiresAt: 2_000, storageId: "storage-a" }, sameNameAndSize, "upload-a", deliveryNow), true, "a failed finalization can resume the same persisted storage");
assert.equal(matchesUploadSession({ status: "pending", uploadKey: "upload-a", expiresAt: 2_000, storageId: "storage-a" }, sameNameAndSize, "upload-b", deliveryNow), false, "a different document session cannot finalize the old storage");
assert.equal(preferNewestUpload(false, { status: "pending", uploadKey: "old" }), null, "a replacement selection must hide the previous remote reservation");
assert.equal(preferNewestUpload({ status: "pending", uploadKey: "upload-a", storageId: "storage-a" }, { status: "pending", uploadKey: "upload-a" }).storageId, "storage-a", "a local storage id survives a lost record response");

function makeConvexContext() {
  const state = {
    users: [
      { _id: "user-admin", _creationTime: 1, clerkUserId: "admin-1", tokenIdentifier: "token-admin", role: "admin" },
      { _id: "user-member", _creationTime: 2, clerkUserId: "member-1", tokenIdentifier: "token-member", role: "member" },
    ],
    clientRequests: [
      {
        _id: "request-a", _creationTime: 3, email: "a@example.test", offerKey: "review", status: "paid", paymentStatus: "paid",
        answersJson: JSON.stringify({ objective: "Stage", dream: "", workTypes: ["Animation 3D"], workLink: "https://example.test/work", password: "", selfAssessment: "Timing", authorization: true }),
        priceCents: 2800, currency: "eur", createdAt: 10, updatedAt: 11, paidAt: 11,
      },
      {
        _id: "request-b", _creationTime: 4, email: "b@example.test", offerKey: "contenu", status: "draft", paymentStatus: "unpaid",
        answersJson: JSON.stringify({ answers: ["a", "b", "c", "d", "e", "f", "g", "h", "", ""] }),
        priceCents: 5800, currency: "eur", createdAt: 12, updatedAt: 13,
      },
    ],
    clientRequestFiles: [],
    clientRequestUploads: [],
    clientRequestEvents: [],
    deliveryNotificationOutbox: [],
  };
  let identity = null;
  let sequence = 10;
  const scheduled = [];
  const storage = new Map([
    ["storage-a", { size: 5, contentType: "application/pdf" }],
    ["storage-b", { size: 5, contentType: "text/plain" }],
  ]);
  const storageState = { uploads: 0, deleted: [] };
  const harnessStorage = storage;

  function rows(table) { return state[table] || []; }
  function query(table) {
    const all = rows(table);
    const result = (predicate = () => true) => ({
      collect: async () => all.filter(predicate),
      first: async () => all.find(predicate) || null,
    });
    return {
      collect: async () => [...all],
      first: async () => all[0] || null,
      withIndex: (_indexName, callback) => {
        let field;
        let value;
        callback({ eq: (nextField, nextValue) => { field = nextField; value = nextValue; } });
        return result((row) => row[field] === value);
      },
    };
  }
  const ctx = {
    auth: { getUserIdentity: async () => identity },
    db: {
      query,
      get: async (id) => Object.values(state).flat().find((row) => row?._id === id) || null,
      insert: async (table, value) => {
        const id = `${table}-${sequence++}`;
        const row = { ...value, _id: id, _creationTime: sequence };
        rows(table).push(row);
        return id;
      },
      patch: async (id, patch) => {
        const row = Object.values(state).flat().find((candidate) => candidate?._id === id);
        if (!row) throw new Error(`missing ${id}`);
        Object.assign(row, patch);
      },
      system: {
        get: async (_table, id) => harnessStorage.get(id) || null,
      },
    },
    storage: {
      getUrl: async (id) => storage.has(id) ? `https://files.example.test/${id}` : null,
      generateUploadUrl: async () => `https://upload.example.test/${++storageState.uploads}`,
      getMetadata: async (id) => storage.get(id) || null,
      delete: async (id) => { storage.delete(id); storageState.deleted.push(id); },
    },
    scheduler: {
      runAfter: async (delayMs, functionReference, args) => {
        scheduled.push({ delayMs, functionReference, args });
        return `schedule-${scheduled.length}`;
      },
    },
  };
  return {
    ctx,
    state,
    storage,
    scheduled,
    asAdmin: () => { identity = { subject: "admin-1", tokenIdentifier: "token-admin" }; },
    asMember: () => { identity = { subject: "member-1", tokenIdentifier: "token-member" }; },
    asAnonymous: () => { identity = null; },
  };
}

const handlers = {
  getAdminRequests: getAdminRequests._handler,
  getAdminRequest: getAdminRequest._handler,
  getAdminFileDownload: getAdminFileDownload._handler,
  getAdminFileDownload: getAdminFileDownload._handler,
  getAdminDeliveryUpload: getAdminDeliveryUpload._handler,
  setWorkStatus: setWorkStatus._handler,
  prepareDelivery: prepareDelivery._handler,
  recordDeliveryStorage: recordDeliveryStorage._handler,
  finalizeDelivery: finalizeDelivery._handler,
};

const harness = makeConvexContext();
const collisionHarness = makeConvexContext();
collisionHarness.asAdmin();
const collisionA = await handlers.prepareDelivery(collisionHarness.ctx, { requestId: "request-a", name: "one.pdf", mimeType: "application/pdf", size: 5 });
const collisionB = await handlers.prepareDelivery(collisionHarness.ctx, { requestId: "request-a", name: "two.pdf", mimeType: "application/pdf", size: 5 });
assert.notEqual(collisionA.uploadKey, collisionB.uploadKey, "two delivery reservations remain distinct even in one millisecond");
harness.asAnonymous();
await assert.rejects(() => handlers.getAdminRequests(harness.ctx, {}), /UNAUTHENTICATED/);
harness.asMember();
await assert.rejects(() => handlers.getAdminRequests(harness.ctx, {}), /FORBIDDEN/);
await assert.rejects(() => handlers.getAdminRequest(harness.ctx, { requestId: "request-a" }), /FORBIDDEN/);
for (const [handler, args] of [
  [handlers.getAdminDeliveryUpload, { requestId: "request-a" }],
  [handlers.setWorkStatus, { requestId: "request-a", workStatus: "done" }],
  [handlers.prepareDelivery, { requestId: "request-a", name: "guide.pdf", mimeType: "application/pdf", size: 5 }],
  [handlers.recordDeliveryStorage, { requestId: "request-a", uploadKey: "unknown", storageId: "storage-a" }],
  [handlers.finalizeDelivery, { requestId: "request-a", uploadKey: "unknown", storageId: "storage-a" }],
]) {
  await assert.rejects(() => handler(harness.ctx, args), /FORBIDDEN/, "a member cannot invoke an admin dossier action");
}
harness.asAdmin();

const listed = await handlers.getAdminRequests(harness.ctx, {});
assert.deepEqual(new Set(listed.map((request) => request.id)), new Set(["request-a"]), "the admin work queue includes only paid dossiers");
assert.equal((await handlers.getAdminRequest(harness.ctx, { requestId: "request-a" })).email, "a@example.test");
assert.equal(getLatestAdminWorkStatus([
  { eventType: "admin_work_status_changed", toStatus: "in_progress", createdAt: 20, _creationTime: 20 },
  { eventType: "admin_work_status_changed", toStatus: "done", createdAt: 20, _creationTime: 21 },
]), "done", "same-millisecond events use Convex creation order");

const eventCountBeforeStatus = harness.state.clientRequestEvents.length;
const statusResult = await handlers.setWorkStatus(harness.ctx, { requestId: "request-a", workStatus: "in_progress" });
assert.equal(statusResult.workStatus, "in_progress");
await assert.rejects(() => handlers.setWorkStatus(harness.ctx, { requestId: "request-b", workStatus: "done" }), /INVALID_STATE/, "an unpaid draft cannot be processed");
assert.equal(harness.state.clientRequestEvents.length, eventCountBeforeStatus + 1, "status writes one persisted audit event");
assert.equal(harness.state.clientRequestEvents.at(-1).sourceId, "admin:admin-1");
await handlers.setWorkStatus(harness.ctx, { requestId: "request-a", workStatus: "in_progress" });
assert.equal(harness.state.clientRequestEvents.length, eventCountBeforeStatus + 1, "same status is idempotent");

const prepared = await handlers.prepareDelivery(harness.ctx, { requestId: "request-a", name: "guide.pdf", mimeType: "application/pdf", size: 5 });
const pendingUpload = await handlers.getAdminDeliveryUpload(harness.ctx, { requestId: "request-a" });
assert.equal(pendingUpload.uploadKey, prepared.uploadKey, "admin can resume its persisted upload reservation");
assert.equal(pendingUpload.status, "pending");
await handlers.recordDeliveryStorage(harness.ctx, { requestId: "request-a", uploadKey: prepared.uploadKey, storageId: "storage-a" });
const resumedUpload = await handlers.getAdminDeliveryUpload(harness.ctx, { requestId: "request-a" });
assert.equal(resumedUpload.storageId, "storage-a", "uploaded storage id is persisted before finalization");
const finalized = await handlers.finalizeDelivery(harness.ctx, { requestId: "request-a", uploadKey: prepared.uploadKey, storageId: "storage-a" });
assert.equal(finalized.ok, true);
const adminView = await handlers.getAdminRequest(harness.ctx, { requestId: "request-a" });
assert.match(adminView.files[0].downloadUrl, /^\/api\/admin-files\/request-a\//, "admin browser payloads contain only a protected same-origin file URL");
await assert.rejects(() => handlers.getAdminFileDownload(harness.ctx, { requestId: "request-a", fileId: adminView.files[0].id }), /FORBIDDEN/, "admin raw storage resolution requires the server proof");
assert.equal((await handlers.getAdminFileDownload(harness.ctx, { requestId: "request-a", fileId: adminView.files[0].id, serverSecret: "delivery-secret-test" })).url, "https://files.example.test/storage-a", "only the server proxy resolves the admin storage URL");
assert.equal(harness.state.clientRequestEvents.at(-1).eventType, "admin_delivery_recorded", "delivery writes an audit event");
assert.equal(harness.state.deliveryNotificationOutbox.length, 1, "a real PDF publication creates one outbox event");
assert.equal(harness.state.deliveryNotificationOutbox[0].kind, "pdf");
assert.equal(harness.state.deliveryNotificationOutbox[0].recipient, "a@example.test", "the recipient comes from the paid dossier");
assert.doesNotMatch(JSON.stringify(harness.state.deliveryNotificationOutbox[0]), /files\.example\.test|storageUrl|downloadUrl/);
assert.ok(harness.scheduled.length >= 1, "the outbox event schedules delivery work");
assert.equal((await handlers.getAdminDeliveryUpload(harness.ctx, { requestId: "request-a" })).status, "finalized");
await assert.rejects(() => handlers.finalizeDelivery(harness.ctx, { requestId: "request-a", uploadKey: prepared.uploadKey, storageId: "storage-b" }), /IDEMPOTENCY_MISMATCH/);
const rejectedPreparation = await handlers.prepareDelivery(harness.ctx, { requestId: "request-a", name: "bad.pdf", mimeType: "application/pdf", size: 5 });
await handlers.recordDeliveryStorage(harness.ctx, { requestId: "request-a", uploadKey: rejectedPreparation.uploadKey, storageId: "storage-b" });
const rejected = await handlers.finalizeDelivery(harness.ctx, { requestId: "request-a", uploadKey: rejectedPreparation.uploadKey, storageId: "storage-b" });
assert.equal(rejected.ok, false);
assert.equal(harness.state.clientRequestEvents.at(-1).eventType, "admin_delivery_rejected", "a rejected delivery is also audited");

console.log(`admin requests checks passed: ${adminFunctions.length} guarded Convex functions, behavior, isolation, audited delivery, no fixture records`);
