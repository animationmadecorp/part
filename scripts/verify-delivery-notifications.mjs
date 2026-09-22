import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  claim,
  complete,
  deliver,
  deliveryNotificationConstants,
  enqueueDeliveryNotification,
  getSendPayload,
  recordPayload,
} from "../convex/deliveryNotifications/actions.js";
import {
  canSendResendTo,
  getResendConfig,
  sendDeliveryNotification,
} from "../lib/resend-server.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const previousEnv = {};
for (const key of [
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "RESEND_REPLY_TO_EMAIL",
  "RESEND_TEST_RECIPIENTS",
  "RESEND_SEND_ENABLED",
  "RESEND_SEND_MODE",
  "RESEND_PRODUCTION_SEND_ENABLED",
  "RESEND_APP_URL",
  "NEXT_PUBLIC_APP_URL",
  "NODE_ENV",
]) previousEnv[key] = process.env[key];

const testEnv = {
  RESEND_API_KEY: "re_test",
  RESEND_FROM_EMAIL: "made@example.test",
  RESEND_REPLY_TO_EMAIL: "animationmadecorp@gmail.com",
  RESEND_TEST_RECIPIENTS: "buyer@example.test,other@example.test",
  RESEND_SEND_ENABLED: "true",
  RESEND_SEND_MODE: "development",
  RESEND_PRODUCTION_SEND_ENABLED: "false",
  RESEND_APP_URL: "https://preview.animation-made.test",
};
Object.assign(process.env, testEnv);

const state = {
  clientRequests: [
    {
      _id: "request-paid",
      email: "Buyer@Example.test",
      offerKey: "review",
      status: "paid",
      paymentStatus: "paid",
    },
    {
      _id: "request-other",
      email: "other@example.test",
      offerKey: "feedback",
      status: "paid",
      paymentStatus: "paid",
    },
    {
      _id: "request-unpaid",
      email: "unpaid@example.test",
      offerKey: "contenu",
      status: "draft",
      paymentStatus: "unpaid",
    },
    {
      _id: "request-refunded",
      email: "refunded@example.test",
      offerKey: "projet-animation",
      status: "paid",
      paymentStatus: "paid",
    },
  ],
  deliveryNotificationOutbox: [],
};
const scheduled = [];
let sequence = 1;

function allRows(table) {
  if (!state[table]) state[table] = [];
  return state[table];
}

function findById(id) {
  return Object.values(state).flat().find((row) => row?._id === id) || null;
}

function makeQuery(table) {
  const rows = allRows(table);
  const result = (predicate = () => true) => ({
    collect: async () => rows.filter(predicate),
    first: async () => rows.find(predicate) || null,
  });
  return {
    collect: async () => [...rows],
    first: async () => rows[0] || null,
    withIndex: (_indexName, callback) => {
      let field;
      let expected;
      callback({ eq: (nextField, nextExpected) => { field = nextField; expected = nextExpected; } });
      return result((row) => row[field] === expected);
    },
  };
}

const ctx = {
  db: {
    get: async (id) => findById(id),
    insert: async (table, value) => {
      const id = `${table}-${sequence++}`;
      allRows(table).push({ ...value, _id: id, _creationTime: sequence });
      return id;
    },
    patch: async (id, patch) => {
      const row = findById(id);
      if (!row) throw new Error(`missing ${id}`);
      Object.assign(row, patch);
    },
    query: makeQuery,
  },
  scheduler: {
    runAfter: async (delayMs, functionReference, args) => {
      scheduled.push({ delayMs, functionReference, args });
      return `schedule-${scheduled.length}`;
    },
  },
};

const handlers = {
  claim: claim._handler,
  complete: complete._handler,
  deliver: deliver._handler,
  getSendPayload: getSendPayload._handler,
  recordPayload: recordPayload._handler,
};
ctx.runMutation = async (_functionReference, args) => {
  if (args.providerPayload) return handlers.recordPayload(ctx, args);
  if (args.claimToken) return handlers.complete(ctx, args);
  return handlers.claim(ctx, args);
};
ctx.runQuery = async (_functionReference, args) => handlers.getSendPayload(ctx, args);

const sends = [];
const originalFetch = globalThis.fetch;
let fetchMode = "success";
globalThis.fetch = async (_url, options) => {
  const body = JSON.parse(String(options.body));
  sends.push({ body, headers: options.headers });
  if (fetchMode === "failure") {
    return new Response(JSON.stringify({ message: "temporary provider failure" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }
  if (fetchMode === "slow-body") {
    return {
      ok: true,
      json: () => new Promise((_resolve, reject) => {
        const abort = () => {
          const error = new Error("response body aborted");
          error.name = "AbortError";
          reject(error);
        };
        if (options.signal.aborted) abort();
        else options.signal.addEventListener("abort", abort, { once: true });
      }),
    };
  }
  return new Response(JSON.stringify({ id: `delivery_email_${sends.length}` }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

try {
  const first = await enqueueDeliveryNotification(ctx, {
    requestId: "request-paid",
    kind: "pdf",
    sourceId: "file-1",
    publishedAt: 10,
  });
  const duplicate = await enqueueDeliveryNotification(ctx, {
    requestId: "request-paid",
    kind: "pdf",
    sourceId: "file-1",
    publishedAt: 11,
  });
  assert.equal(first.duplicate, false);
  assert.equal(duplicate.duplicate, true, "the same publication source is idempotent");
  assert.equal(state.deliveryNotificationOutbox.length, 1);
  assert.equal(first.notification.recipient, "buyer@example.test", "email is normalized from the paid dossier");
  assert.doesNotMatch(JSON.stringify(first.notification), /storageUrl|files\.example|downloadUrl/);

  const sentResult = await handlers.deliver(ctx, { notificationId: first.notification._id });
  assert.equal(sentResult.sent, true);
  assert.equal(state.deliveryNotificationOutbox[0].status, "sent");
  assert.equal(sends.length, 1);
  assert.equal(sends[0].body.to[0], "buyer@example.test");
  assert.match(sends[0].body.html, /suivi=book&amp;requestId=request-paid/);
  assert.match(sends[0].body.html, /<!doctype html>/i);
  assert.match(sends[0].body.text, /Ton PDF personnalisé/);
  assert.doesNotMatch(`${sends[0].body.html}\n${sends[0].body.text}`, /storageUrl|files\.example|downloadUrl|secret\.pdf/i);
  assert.match(sends[0].headers["Idempotency-Key"], /^delivery:request-paid:pdf:file-1$/);
  await handlers.deliver(ctx, { notificationId: first.notification._id });
  assert.equal(sends.length, 1, "a sent outbox event cannot send again on replay");

  const unpaid = await enqueueDeliveryNotification(ctx, {
    requestId: "request-unpaid",
    kind: "pdf",
    sourceId: "file-unpaid",
    publishedAt: 12,
  });
  assert.equal(unpaid.notification.status, "skipped");
  assert.equal(unpaid.notification.lastError, "request_not_paid");
  await handlers.deliver(ctx, { notificationId: unpaid.notification._id });
  assert.equal(sends.length, 1, "unpaid dossiers never reach the provider");

  const refunded = await enqueueDeliveryNotification(ctx, {
    requestId: "request-refunded",
    kind: "review",
    sourceId: "snapshot-refunded",
    publishedAt: 13,
  });
  state.clientRequests.find((request) => request._id === "request-refunded").status = "refunded";
  state.clientRequests.find((request) => request._id === "request-refunded").paymentStatus = "refunded";
  await handlers.deliver(ctx, { notificationId: refunded.notification._id });
  assert.equal(state.deliveryNotificationOutbox.find((row) => row._id === refunded.notification._id).status, "skipped");
  assert.equal(sends.length, 1, "a refund between publication and delivery prevents the send");

  const other = await enqueueDeliveryNotification(ctx, {
    requestId: "request-other",
    kind: "review",
    sourceId: "snapshot-other",
    publishedAt: 14,
  });
  await handlers.deliver(ctx, { notificationId: other.notification._id });
  assert.equal(sends.length, 2);
  assert.equal(sends[1].body.to[0], "other@example.test", "one dossier cannot borrow another dossier's recipient");
  assert.match(sends[1].body.html, /suivi=feedback&amp;requestId=request-other/);
  assert.match(sends[1].body.text, /review d.animation|review/);

  const postSend = await enqueueDeliveryNotification(ctx, {
    requestId: "request-paid",
    kind: "pdf",
    sourceId: "file-post-send-refund",
    publishedAt: 145,
  });
  const postSendClaim = await handlers.claim(ctx, { notificationId: postSend.notification._id });
  const postSendPayload = await handlers.getSendPayload(ctx, {
    notificationId: postSend.notification._id,
    claimToken: postSendClaim.claimToken,
  });
  const paidRequest = state.clientRequests.find((request) => request._id === "request-paid");
  paidRequest.status = "refunded";
  paidRequest.paymentStatus = "refunded";
  const postSendCompletion = await handlers.complete(ctx, {
    notificationId: postSend.notification._id,
    claimToken: postSendClaim.claimToken,
    status: "sent",
    providerId: "provider-after-refund",
    recipient: postSendPayload.recipient,
  });
  const postSendRow = state.deliveryNotificationOutbox.find((row) => row._id === postSend.notification._id);
  assert.deepEqual(postSendCompletion, { ok: true, status: "sent" });
  assert.equal(postSendRow.status, "sent", "a provider success remains a sent event even if a refund races completion");
  assert.equal(postSendRow.providerId, "provider-after-refund");
  assert.equal(postSendRow.recipient, "buyer@example.test", "the actual provider recipient is preserved");
  assert.equal(postSendRow.lastError, "eligibility_changed_after_send");
  paidRequest.status = "paid";
  paidRequest.paymentStatus = "paid";

  const stablePayload = await enqueueDeliveryNotification(ctx, {
    requestId: "request-paid",
    kind: "pdf",
    sourceId: "file-stable-payload",
    publishedAt: 146,
  });
  fetchMode = "failure";
  await handlers.deliver(ctx, { notificationId: stablePayload.notification._id });
  const stableRow = state.deliveryNotificationOutbox.find((row) => row._id === stablePayload.notification._id);
  const firstProviderBody = sends.at(-1).body;
  const firstProviderKey = sends.at(-1).headers["Idempotency-Key"];
  process.env.RESEND_FROM_EMAIL = "changed@example.test";
  process.env.RESEND_REPLY_TO_EMAIL = "changed-reply@example.test";
  process.env.RESEND_APP_URL = "https://changed.animation-made.test";
  fetchMode = "success";
  stableRow.nextAttemptAt = 0;
  await handlers.deliver(ctx, { notificationId: stablePayload.notification._id });
  assert.equal(stableRow.status, "sent");
  assert.deepEqual(sends.at(-1).body, firstProviderBody, "a retry reuses the first provider payload");
  assert.equal(sends.at(-1).headers["Idempotency-Key"], firstProviderKey, "a retry reuses the first idempotency key");
  process.env.RESEND_FROM_EMAIL = testEnv.RESEND_FROM_EMAIL;
  process.env.RESEND_REPLY_TO_EMAIL = testEnv.RESEND_REPLY_TO_EMAIL;
  process.env.RESEND_APP_URL = testEnv.RESEND_APP_URL;

  const watchdog = await enqueueDeliveryNotification(ctx, {
    requestId: "request-paid",
    kind: "pdf",
    sourceId: "file-watchdog-recovery",
    publishedAt: 1465,
  });
  const watchdogClaim = await handlers.claim(ctx, { notificationId: watchdog.notification._id });
  const watchdogRow = state.deliveryNotificationOutbox.find((row) => row._id === watchdog.notification._id);
  await handlers.recordPayload(ctx, {
    notificationId: watchdog.notification._id,
    claimToken: watchdogClaim.claimToken,
    providerPayload: stableRow.providerPayload,
  });
  watchdogRow.claimExpiresAt = Date.now() - 1;
  const watchdogSchedule = scheduled
    .filter((entry) => entry.args.notificationId === watchdog.notification._id && entry.delayMs === deliveryNotificationConstants.CLAIM_STALE_AFTER_MS)
    .at(-1);
  assert.ok(watchdogSchedule, "the stale-claim watchdog is persisted in the scheduler mock");
  await handlers.deliver(ctx, watchdogSchedule.args);
  assert.equal(watchdogRow.status, "sent", "a payload write cannot strand a sending job past its watchdog");

  const failed = await enqueueDeliveryNotification(ctx, {
    requestId: "request-paid",
    kind: "pdf",
    sourceId: "file-retry",
    publishedAt: 15,
  });
  fetchMode = "failure";
  await handlers.deliver(ctx, { notificationId: failed.notification._id });
  const failedRow = state.deliveryNotificationOutbox.find((row) => row._id === failed.notification._id);
  assert.equal(failedRow.status, "failed");
  assert.equal(failedRow.attempts, 1);
  assert.equal(failedRow.nextAttemptAt > Date.now(), true);
  assert.ok(scheduled.some((entry) => entry.delayMs === deliveryNotificationConstants.RETRY_AFTER_MS));
  for (let attempt = 2; attempt <= deliveryNotificationConstants.MAX_ATTEMPTS; attempt += 1) {
    failedRow.nextAttemptAt = 0;
    await handlers.deliver(ctx, { notificationId: failed.notification._id });
    assert.equal(failedRow.attempts, attempt);
  }
  const sendsAfterMax = sends.length;
  failedRow.nextAttemptAt = 0;
  const exhaustedResult = await handlers.deliver(ctx, { notificationId: failed.notification._id });
  assert.deepEqual(exhaustedResult, { claimed: false, status: "max_attempts" });
  assert.equal(sends.length, sendsAfterMax, "retry attempts are bounded");

  const late = await enqueueDeliveryNotification(ctx, {
    requestId: "request-paid",
    kind: "pdf",
    sourceId: "file-late-recovery",
    publishedAt: 17,
  });
  const lateClaim = await handlers.claim(ctx, { notificationId: late.notification._id });
  assert.equal(lateClaim.claimed, true);
  const lateRow = state.deliveryNotificationOutbox.find((row) => row._id === late.notification._id);
  lateRow.idempotencyExpiresAt = Date.now() - 1;
  lateRow.updatedAt = Date.now() - deliveryNotificationConstants.IDEMPOTENCY_WINDOW_MS - 1;
  const lateRecovery = await handlers.claim(ctx, { notificationId: late.notification._id });
  assert.deepEqual(lateRecovery, { claimed: false, status: "idempotency_window_expired" }, "an ambiguous recovery after provider key expiry is blocked");
  assert.equal(lateRow.status, "failed");
  assert.equal(lateRow.lastError, "idempotency_window_expired");
  const sendsBeforeExpiryGuard = sends.length;
  const expiryGuard = await sendDeliveryNotification({
    recipient: stableRow.providerPayload.recipient,
    kind: "pdf",
    idempotencyKey: "delivery:expiry-guard",
    idempotencyExpiresAt: Date.now() + deliveryNotificationConstants.RESEND_IDEMPOTENCY_SAFETY_MARGIN_MS - 1,
    providerPayload: stableRow.providerPayload,
  });
  assert.deepEqual(expiryGuard, { sent: false, reason: "idempotency_window_expired" });
  assert.equal(sends.length, sendsBeforeExpiryGuard, "the transport guard emits no POST near key expiry");
  fetchMode = "slow-body";
  const slowBodyStartedAt = Date.now();
  await assert.rejects(
    () => sendDeliveryNotification({
      recipient: stableRow.providerPayload.recipient,
      kind: "pdf",
      idempotencyKey: "delivery:slow-body",
      idempotencyExpiresAt: Date.now() + deliveryNotificationConstants.RESEND_IDEMPOTENCY_SAFETY_MARGIN_MS + 25,
      providerPayload: stableRow.providerPayload,
    }),
    (error) => error?.name === "AbortError",
  );
  assert.equal(Date.now() - slowBodyStartedAt < 1_000, true, "a stalled response body is bounded by the transport timeout");
  fetchMode = "success";

  const stale = await enqueueDeliveryNotification(ctx, {
    requestId: "request-paid",
    kind: "pdf",
    sourceId: "file-stale",
    publishedAt: 16,
  });
  const firstClaim = await handlers.claim(ctx, { notificationId: stale.notification._id });
  assert.equal(firstClaim.claimed, true);
  const staleRow = state.deliveryNotificationOutbox.find((row) => row._id === stale.notification._id);
  const secondClaimBeforeStale = await handlers.claim(ctx, { notificationId: stale.notification._id });
  assert.deepEqual(secondClaimBeforeStale, { claimed: false, status: "sending" });
  staleRow.claimExpiresAt = Date.now() - 1;
  const secondClaim = await handlers.claim(ctx, { notificationId: stale.notification._id });
  assert.equal(secondClaim.claimed, true, "a crashed claim can be reclaimed");
  const staleCompletion = await handlers.complete(ctx, {
    notificationId: stale.notification._id,
    claimToken: firstClaim.claimToken,
    status: "sent",
  });
  assert.deepEqual(staleCompletion, { ok: false, status: "stale_claim" });
  await handlers.complete(ctx, {
    notificationId: stale.notification._id,
    claimToken: secondClaim.claimToken,
    status: "skipped",
    error: "test cleanup",
  });

  const developmentUnderProduction = getResendConfig({
    ...testEnv,
    NODE_ENV: "production",
    RESEND_SEND_MODE: "development",
  });
  assert.equal(developmentUnderProduction.production, false, "NODE_ENV does not unlock production mode");
  assert.equal(canSendResendTo("unknown@example.test", { ...testEnv, NODE_ENV: "production", RESEND_SEND_MODE: "development" }), false);
  const explicitProduction = getResendConfig({
    ...testEnv,
    RESEND_SEND_MODE: "production",
    RESEND_PRODUCTION_SEND_ENABLED: "true",
    RESEND_TEST_RECIPIENTS: "",
  });
  assert.equal(explicitProduction.production, true);
  assert.equal(explicitProduction.allowlistRequired, false);
  assert.equal(canSendResendTo("unknown@example.test", {
    ...testEnv,
    RESEND_SEND_MODE: "production",
    RESEND_PRODUCTION_SEND_ENABLED: "true",
    RESEND_TEST_RECIPIENTS: "",
  }), true, "the production recipient bypass is only available with explicit double opt-in");

  const [adminModule, reviewModule, schema] = await Promise.all([
    read("convex/adminRequests.js"),
    read("convex/reviewStudio.js"),
    read("convex/schema.js"),
  ]);
  assert.match(adminModule, /enqueueDeliveryNotification/);
  assert.match(adminModule, /kind: "pdf"/);
  assert.match(reviewModule, /enqueueDeliveryNotification/, "review publication must use the same outbox contract");
  assert.match(reviewModule, /kind: "review"/);
  assert.match(schema, /deliveryNotificationOutbox/);
  assert.match(schema, /by_dedupe/);
  assert.match(schema, /sourceId: v\.string\(\)/);
  assert.match(schema, /followUpPath: v\.string\(\)/);
  assert.match(schema, /claimExpiresAt: v\.optional\(v\.number\(\)\)/);
  assert.match(schema, /idempotencyExpiresAt: v\.optional\(v\.number\(\)\)/);
  assert.match(schema, /providerPayload: v\.optional\(v\.object/);
} finally {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

console.log("delivery notification outbox, retries, isolation, secure payloads and explicit send modes: PASS");
