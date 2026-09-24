import assert from "node:assert/strict";
import { register } from "node:module";
import { enqueueDeliveryNotification } from "../convex/deliveryNotifications/actions.js";

register("./resolve-convex-imports.mjs", import.meta.url);
const { createDraft, prepareCheckout } = await import("../convex/clientRequests.js");
const { backfillPaidRequestEmails } = await import("../convex/clientRequestEmailRepair.js");

const identity = { subject: "clerk-owner", tokenIdentifier: "token-owner" };
const rows = {
  users: [{ _id: "profile-owner", clerkUserId: identity.subject, tokenIdentifier: identity.tokenIdentifier, email: "Owner@Example.test" }],
  clientRequests: [],
  prices: [],
  clientRequestEvents: [],
  deliveryNotificationOutbox: [],
};
const scheduled = [];
let sequence = 0;
function query(table) {
  let matching = rows[table];
  const chain = {
    withIndex: (_name, callback) => {
      callback({ eq: (field, value) => { matching = matching.filter((row) => row[field] === value); return chain; } });
      return chain;
    },
    first: async () => matching[0] || null,
    unique: async () => {
      if (matching.length > 1) throw new Error("Non-unique profile");
      return matching[0] || null;
    },
    collect: async () => [...matching],
  };
  return chain;
}
const ctx = {
  auth: { getUserIdentity: async () => identity },
  db: {
    query,
    get: async (id) => Object.values(rows).flat().find((row) => row._id === id) || null,
    insert: async (table, value) => {
      const id = `${table}-${++sequence}`;
      rows[table].push({ _id: id, ...value });
      return id;
    },
    patch: async (id, patch) => {
      const row = Object.values(rows).flat().find((candidate) => candidate._id === id);
      if (!row) throw new Error(`Unknown id: ${id}`);
      Object.assign(row, patch);
    },
  },
  scheduler: { runAfter: async (...args) => scheduled.push(args) },
};

const draft = await createDraft._handler(ctx, { draftKey: "test-draft-key-123456", offerKey: "review" });
const created = rows.clientRequests.find((row) => row._id === draft.id);
assert.equal(created.email, "owner@example.test", "draft inherits the matching Clerk profile email");

created.email = undefined;
created.answersJson = JSON.stringify({
  workTypes: ["animation"],
  workLink: "https://example.test/book",
  selfAssessment: "I want feedback on this work.",
  authorization: true,
});
const checkout = await prepareCheckout._handler(ctx, { requestId: created._id });
assert.equal(checkout.customerEmail, "owner@example.test", "checkout repairs an older draft before payment");
assert.equal(created.email, "owner@example.test");

created.email = undefined;
created.status = "paid";
created.paymentStatus = "paid";
const dry = await backfillPaidRequestEmails._handler(ctx, { dryRun: true });
assert.deepEqual(dry, { dryRun: true, repaired: 1, unresolved: 0 });
assert.equal(created.email, undefined, "dry run cannot modify requests");
assert.equal(scheduled.length, 0, "repair cannot send historical emails");
const repaired = await backfillPaidRequestEmails._handler(ctx, { dryRun: false });
assert.deepEqual(repaired, { dryRun: false, repaired: 1, unresolved: 0 });
assert.equal(created.email, "owner@example.test");
assert.equal(scheduled.length, 0, "backfill does not replay historical notifications");

created.email = undefined;
const notification = await enqueueDeliveryNotification(ctx, {
  requestId: created._id,
  kind: "pdf",
  sourceId: "published-file-1",
});
assert.equal(notification.notification.recipient, "owner@example.test", "publication can recover a legacy request email");
assert.equal(created.email, "owner@example.test");
assert.equal(scheduled.length, 1);

const mismatched = { ...created, _id: "request-mismatch", clerkUserId: "another-clerk", email: undefined };
rows.clientRequests.push(mismatched);
const mismatchRepair = await backfillPaidRequestEmails._handler(ctx, { dryRun: false });
assert.equal(mismatchRepair.unresolved, 1, "a profile from another Clerk account must not be used");
assert.equal(mismatched.email, undefined);

console.log("client request email capture, checkout recovery, paid backfill and notification ownership: PASS");
