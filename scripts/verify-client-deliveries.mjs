import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  getMyDelivery,
  getMyDeliveryDownload,
  getMyDeliveries,
} from "../convex/clientDeliveries.js";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
process.env.BOOKING_WEBHOOK_SECRET = "delivery-secret-test";

const [deliveryModule, route, projectFollowUp, library, adminModule] = await Promise.all([
  read("convex/clientDeliveries.js"),
  read("app/api/client-deliveries/[requestId]/route.js"),
  read("app/nouveau/bibliotheque/ProjectFollowUp.js"),
  read("app/nouveau/bibliotheque/Library.js"),
  read("convex/adminRequests.js"),
]);

assert.match(deliveryModule, /isRequestOwner/, "delivery reads must enforce both owner identity fields");
assert.match(deliveryModule, /admin_delivery_recorded/, "delivery reads must require the audited admin finalization event");
assert.match(deliveryModule, /admin_delivery_prepared/, "preparation must be exposed only from the audited admin reservation");
assert.match(deliveryModule, /downloadUrl: `\/api\/client-deliveries\//, "browser payloads must expose only the same-origin proxy URL");
assert.doesNotMatch(deliveryModule, /uploads\.some\(\(upload\) => upload\.kind === ADMIN_DELIVERY_KIND && upload\.status === "finalized"\)/, "a client-forged finalized upload must not look like an admin delivery");
assert.match(route, /getMyDeliveryDownload/, "the route must query the server-side delivery proof");
assert.match(route, /getClerkSession/, "the route must authenticate the current Clerk session");
assert.match(route, /serverSecret/, "the route must provide a server-only proof to the download query");
assert.match(route, /redirect: "error"/, "the proxy must never follow a storage redirect");
assert.match(route, /private, no-store/, "PDF responses must be private and uncached");
assert.match(route, /X-Content-Type-Options/, "PDF responses must set a safe content type header");
assert.doesNotMatch(route, /Location/, "the proxy must not redirect the browser to storage");
assert.match(library, /clientDeliveries:getMyDeliveries/, "the library must read persisted delivery states");
assert.match(projectFollowUp, /availableEntries/, "the follow-up must preserve paid dossier identifiers");
assert.match(projectFollowUp, /Consulter le PDF/, "the follow-up must expose the finalized PDF action");
assert.match(projectFollowUp, /preparing|awaiting_delivery|payment_required/, "the follow-up must render real delivery states");
assert.match(projectFollowUp, /return Math\.min\(deliveryStep, flowLength - 1\)/, "a final delivery without a following step must remain on its delivery step");
assert.match(projectFollowUp, /delivery\?\.state === "delivered"/, "a delivered PDF must remain visible after the active step advances");
assert.match(projectFollowUp, /deliveryStatus/, "delivery query errors must be represented locally without replacing unrelated follow-ups");
assert.match(library, /hasClientFollowUp/, "only client dossier follow-ups may depend on delivery query readiness");
assert.match(library, /deliveryStatus=\{deliveryResult\.status\}/, "the follow-up must receive the delivery query state");
assert.doesNotMatch(library, /followUpUnavailable/, "a client delivery error must not hide an unrelated English follow-up");
assert.doesNotMatch(library, /deliveries \|\| \[\]\)\.map\(delivery =>.*key/, "delivery refreshes must not reset the selected dossier");
assert.doesNotMatch(library, /<ProjectFollowUp key=/, "offer reordering must not reset the selected dossier");
assert.match(adminModule, /eventType: "admin_delivery_prepared"/, "admin preparation must create an auditable proof");

function makeContext() {
  const state = {
    clientRequests: [
      request("request-delivered-a", "member-a", "token-a", "paid", "paid", 10),
      request("request-other-b", "member-b", "token-b", "paid", "paid", 20),
      request("request-unpaid-a", "member-a", "token-a", "awaiting_payment", "unpaid", 30),
      request("request-forged-a", "member-a", "token-a", "paid", "paid", 40),
      request("request-preparing-a", "member-a", "token-a", "paid", "paid", 50),
      request("request-refunded-a", "member-a", "token-a", "refunded", "refunded", 60),
    ],
    clientRequestFiles: [
      file("file-delivered-a", "request-delivered-a", "storage-delivered-a", "guide-final.pdf", 10),
      file("file-forged-a", "request-forged-a", "storage-forged-a", "forged.pdf", 40),
    ],
    clientRequestUploads: [
      {
        _id: "upload-forged-a", _creationTime: 71, requestId: "request-forged-a", kind: "admin_delivery",
        status: "finalized", storageId: "storage-forged-a", updatedAt: 71, createdAt: 71, expiresAt: 999_999,
      },
      {
        _id: "upload-preparing-a", _creationTime: 72, requestId: "request-preparing-a", kind: "admin_delivery",
        status: "pending", updatedAt: 72, createdAt: 72, expiresAt: Date.now() + 60_000,
      },
    ],
    clientRequestEvents: [
      event("event-delivered-a", "request-delivered-a", "admin_delivery_recorded", "admin:admin-1:file:file-delivered-a", 11),
      event("event-preparing-a", "request-preparing-a", "admin_delivery_prepared", "admin:admin-1:upload:upload-preparing-a", 73),
    ],
  };
  let identity = null;
  const storage = new Map([
    ["storage-delivered-a", "https://storage.example.test/delivered-a"],
    ["storage-forged-a", "https://storage.example.test/forged-a"],
  ]);

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
  return {
    ctx: {
      auth: { getUserIdentity: async () => identity },
      db: {
        query,
        get: async (id) => Object.values(state).flat().find((row) => row?._id === id) || null,
      },
      storage: {
        getUrl: async (id) => storage.get(id) || null,
      },
    },
    asMemberA: () => { identity = { subject: "member-a", tokenIdentifier: "token-a" }; },
    asMemberB: () => { identity = { subject: "member-b", tokenIdentifier: "token-b" }; },
    asAnonymous: () => { identity = null; },
  };
}

function request(id, clerkUserId, tokenIdentifier, status, paymentStatus, createdAt) {
  return {
    _id: id,
    _creationTime: createdAt,
    clerkUserId,
    tokenIdentifier,
    offerKey: "review",
    status,
    paymentStatus,
    createdAt,
    updatedAt: createdAt + 1,
  };
}

function file(id, requestId, storageId, name, createdAt) {
  return {
    _id: id,
    _creationTime: createdAt,
    requestId,
    clerkUserId: "member-a",
    tokenIdentifier: "token-a",
    storageId,
    name,
    mimeType: "application/pdf",
    size: 5,
    kind: "admin_delivery",
    status: "active",
    createdAt,
    updatedAt: createdAt,
  };
}

function event(id, requestId, eventType, sourceId, createdAt) {
  return { _id: id, _creationTime: createdAt, requestId, eventType, sourceId, toStatus: "done", createdAt };
}

const handlers = {
  getMyDelivery: getMyDelivery._handler,
  getMyDeliveries: getMyDeliveries._handler,
  getMyDeliveryDownload: getMyDeliveryDownload._handler,
};

const harness = makeContext();
harness.asMemberA();
const delivered = await handlers.getMyDelivery(harness.ctx, { requestId: "request-delivered-a" });
assert.equal(delivered.state, "delivered");
assert.equal(delivered.file.downloadUrl, "/api/client-deliveries/request-delivered-a");
assert.doesNotMatch(JSON.stringify(delivered), /storage\.example\.test|https?:\/\//, "browser delivery payload must not contain the bearer storage URL");
await assert.rejects(() => handlers.getMyDeliveryDownload(harness.ctx, { requestId: "request-delivered-a" }), /FORBIDDEN/, "an owner calling the public query without server proof must still be refused");
assert.equal((await handlers.getMyDeliveryDownload(harness.ctx, { requestId: "request-delivered-a", serverSecret: "delivery-secret-test" })).url, "https://storage.example.test/delivered-a", "only the authenticated proxy proof may resolve the storage URL");

harness.asMemberB();
await assert.rejects(() => handlers.getMyDelivery(harness.ctx, { requestId: "request-delivered-a" }), /FORBIDDEN/, "another account cannot read the dossier delivery");
await assert.rejects(() => handlers.getMyDeliveryDownload(harness.ctx, { requestId: "request-delivered-a", serverSecret: "delivery-secret-test" }), /FORBIDDEN/, "another account cannot resolve the private download");

harness.asMemberA();
const unpaid = await handlers.getMyDelivery(harness.ctx, { requestId: "request-unpaid-a" });
assert.equal(unpaid.state, "payment_required");
assert.equal(unpaid.file, null);
await assert.rejects(() => handlers.getMyDeliveryDownload(harness.ctx, { requestId: "request-unpaid-a", serverSecret: "delivery-secret-test" }), /FORBIDDEN/);

const forged = await handlers.getMyDelivery(harness.ctx, { requestId: "request-forged-a" });
assert.equal(forged.state, "awaiting_delivery", "a client-created finalized upload is not an administration proof");
assert.equal(forged.file, null);
await assert.rejects(() => handlers.getMyDeliveryDownload(harness.ctx, { requestId: "request-forged-a", serverSecret: "delivery-secret-test" }), /NOT_FOUND/);

const preparing = await handlers.getMyDelivery(harness.ctx, { requestId: "request-preparing-a" });
assert.equal(preparing.state, "preparing", "an audited admin reservation is visible as preparation");

const refunded = await handlers.getMyDelivery(harness.ctx, { requestId: "request-refunded-a" });
assert.equal(refunded.state, "closed");
await assert.rejects(() => handlers.getMyDeliveryDownload(harness.ctx, { requestId: "request-refunded-a", serverSecret: "delivery-secret-test" }), /FORBIDDEN/);

const mine = await handlers.getMyDeliveries(harness.ctx, {});
assert.ok(mine.every((delivery) => [
  "request-delivered-a",
  "request-unpaid-a",
  "request-forged-a",
  "request-preparing-a",
  "request-refunded-a",
].includes(delivery.requestId)), "the list must stay within the current account");
assert.equal(mine.some((delivery) => delivery.requestId === "request-other-b"), false, "another account's dossier must never enter the list");

harness.asAnonymous();
await assert.rejects(() => handlers.getMyDeliveries(harness.ctx, {}), /UNAUTHENTICATED/);

console.log("client delivery checks passed: owner/payment isolation, audited admin proof, real states, proxy-only storage resolution");
