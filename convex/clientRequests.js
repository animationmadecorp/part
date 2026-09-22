import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import {
  CLIENT_REQUEST_MAX_ANSWER_JSON_LENGTH,
  CLIENT_REQUEST_QUOTA_BYTES,
  getClientRequestOffer,
  isPaymentFailureEvent,
  isPaymentSuccessEvent,
  isRequestOwner,
  normalizeAttachment,
  parseClientRequestAnswers,
  requestFilePolicy,
  serializeClientRequestAnswers,
  validateClientRequestFiles,
} from "./clientRequestRules";

const REQUEST_STATUSES_EDITABLE = new Set(["draft", "awaiting_payment", "payment_failed", "expired"]);
const UPLOAD_TTL_MS = 60 * 60 * 1000;
const FEEDBACK_TERMINAL_STATUSES = new Set(["paid", "refunded", "cancelled"]);

function requestError(code, message) {
  throw new Error(`${code}: ${message}`);
}

async function requireIdentity(ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) requestError("UNAUTHENTICATED", "Authentication required");
  return {
    identity,
    clerkUserId: identity.subject,
    tokenIdentifier: identity.tokenIdentifier || identity.subject,
  };
}

function assertShortString(value, field, { min = 1, max = 240 } = {}) {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) {
    requestError("INVALID_INPUT", `Invalid ${field}`);
  }
  return value.trim();
}

function assertOwner(request, current) {
  if (!request) requestError("NOT_FOUND", "Client request not found");
  if (!isRequestOwner(request, current)) requestError("FORBIDDEN", "Client request belongs to another account");
  return request;
}

function assertFeedbackMutable(request) {
  if (
    request?.offerKey === "feedback" &&
    !FEEDBACK_TERMINAL_STATUSES.has(request.status) &&
    (request.checkoutPending || request.stripeCheckoutSessionId)
  ) {
    requestError("INVALID_STATE", "This feedback dossier is locked while Stripe checkout is open");
  }
}

async function getOwnedRequest(ctx, requestId, current) {
  return assertOwner(await ctx.db.get(requestId), current);
}

async function findRequestByField(ctx, indexName, value) {
  if (!value) return null;
  return ctx.db
    .query("clientRequests")
    .withIndex(indexName, (query) => query.eq(
      indexName === "by_checkout_session"
        ? "stripeCheckoutSessionId"
        : "stripePaymentIntentId",
      value,
    ))
    .first();
}

async function getActiveFiles(ctx, requestId) {
  const files = await ctx.db
    .query("clientRequestFiles")
    .withIndex("by_request", (query) => query.eq("requestId", requestId))
    .collect();
  return files.filter((file) => file.status === "active");
}

async function getOpenUploads(ctx, requestId, { excludeId } = {}) {
  const uploads = await ctx.db
    .query("clientRequestUploads")
    .withIndex("by_request", (query) => query.eq("requestId", requestId))
    .collect();
  const now = Date.now();
  return uploads.filter((upload) =>
    upload.status === "pending" &&
    upload.expiresAt > now &&
    upload._id !== excludeId,
  );
}

function safeFile(file) {
  return {
    id: file._id,
    name: file.name,
    mimeType: file.mimeType,
    size: file.size,
    kind: file.kind,
    createdAt: file.createdAt,
  };
}

function safeAnswers(request) {
  try {
    return parseClientRequestAnswers(request.offerKey, request.answersJson);
  } catch {
    return null;
  }
}

function safeRequest(request, files = [], { includeAnswers = true } = {}) {
  if (!request) return null;
  return {
    id: request._id,
    offerKey: request.offerKey,
    status: request.status,
    paymentStatus: request.paymentStatus,
    priceCents: request.priceCents,
    currency: request.currency,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    ...(request.paidAt === undefined ? {} : { paidAt: request.paidAt }),
    ...(request.stripeCheckoutSessionId ? { checkoutSessionId: request.stripeCheckoutSessionId } : {}),
    ...(request.checkoutAttempt === undefined ? {} : { checkoutAttempt: request.checkoutAttempt }),
    ...(request.checkoutPending ? { checkoutPending: true } : {}),
    ...(includeAnswers ? { answers: safeAnswers(request) } : {}),
    files: files.filter((file) => file.status === "active").map(safeFile),
  };
}

async function recordRequestEvent(ctx, requestId, { eventType, fromStatus, toStatus, sourceId }) {
  await ctx.db.insert("clientRequestEvents", {
    requestId,
    eventType,
    ...(fromStatus ? { fromStatus } : {}),
    toStatus,
    ...(sourceId ? { sourceId } : {}),
    createdAt: Date.now(),
  });
}

function checkoutPayload(request, current, offer) {
  return {
    requestId: request._id,
    amountCents: offer.priceCents,
    currency: "eur",
    offerKey: offer.key,
    name: offer.title,
    description: offer.description,
    customerEmail: request.email || current.identity.email || undefined,
    userId: current.clerkUserId,
    checkoutSessionId: request.stripeCheckoutSessionId,
    checkoutAttempt: request.checkoutAttempt || 0,
  };
}

export const createDraft = mutationGeneric({
  args: {
    draftKey: v.string(),
    offerKey: v.string(),
  },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx);
    const draftKey = assertShortString(args.draftKey, "draft key", { min: 16, max: 240 });
    const offer = getClientRequestOffer(args.offerKey);
    if (!offer) requestError("INVALID_OFFER", "This client request offer is not available");

    const previous = await ctx.db
      .query("clientRequests")
      .withIndex("by_draft_key", (query) => query.eq("draftKey", draftKey))
      .first();
    if (previous) {
      assertOwner(previous, current);
      if (previous.offerKey !== offer.key) requestError("IDEMPOTENCY_MISMATCH", "Draft key belongs to another offer");
      if (["paid", "refunded", "cancelled"].includes(previous.status)) {
        requestError("NEW_DRAFT_REQUIRED", "This dossier is closed; create a new draft");
      }
      return safeRequest(previous, await getActiveFiles(ctx, previous._id));
    }

    const now = Date.now();
    const requestId = await ctx.db.insert("clientRequests", {
      clerkUserId: current.clerkUserId,
      tokenIdentifier: current.tokenIdentifier,
      ...(typeof current.identity.email === "string" ? { email: current.identity.email } : {}),
      draftKey,
      offerKey: offer.key,
      status: "draft",
      paymentStatus: "unpaid",
      answersJson: "{}",
      priceCents: offer.priceCents,
      currency: "eur",
      checkoutAttempt: 0,
      createdAt: now,
      updatedAt: now,
    });
    await recordRequestEvent(ctx, requestId, { eventType: "draft_created", toStatus: "draft" });
    return safeRequest(await ctx.db.get(requestId));
  },
});

export const saveDraft = mutationGeneric({
  args: {
    requestId: v.id("clientRequests"),
    answersJson: v.string(),
  },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx);
    const request = await getOwnedRequest(ctx, args.requestId, current);
    assertFeedbackMutable(request);
    if (!REQUEST_STATUSES_EDITABLE.has(request.status)) requestError("INVALID_STATE", "A paid request cannot be overwritten");
    if (args.answersJson.length > CLIENT_REQUEST_MAX_ANSWER_JSON_LENGTH) requestError("INVALID_INPUT", "Answers payload is too large");
    let parsedAnswers;
    try {
      parsedAnswers = JSON.parse(args.answersJson);
    } catch {
      requestError("INVALID_INPUT", "Invalid answers payload");
    }
    const normalizedJson = serializeClientRequestAnswers(request.offerKey, parsedAnswers);
    await ctx.db.patch(request._id, { answersJson: normalizedJson, updatedAt: Date.now() });
    return safeRequest(await ctx.db.get(request._id), await getActiveFiles(ctx, request._id));
  },
});

export const prepareAttachment = mutationGeneric({
  args: {
    requestId: v.id("clientRequests"),
    uploadKey: v.string(),
    name: v.string(),
    mimeType: v.string(),
    size: v.number(),
    kind: v.string(),
  },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx);
    const request = await getOwnedRequest(ctx, args.requestId, current);
    assertFeedbackMutable(request);
    if (!REQUEST_STATUSES_EDITABLE.has(request.status)) requestError("INVALID_STATE", "Attachments cannot be changed after payment");
    const uploadKey = assertShortString(args.uploadKey, "upload key", { min: 16, max: 240 });
    const existingUpload = await ctx.db
      .query("clientRequestUploads")
      .withIndex("by_upload_key", (query) => query.eq("uploadKey", uploadKey))
      .first();
    if (existingUpload) {
      if (!isRequestOwner(existingUpload, current) || existingUpload.requestId !== request._id) {
        requestError("FORBIDDEN", "Upload key belongs to another account");
      }
      if (existingUpload.status === "pending" && existingUpload.expiresAt > Date.now()) {
        return {
          uploadUrl: existingUpload.uploadUrl,
          uploadKey: existingUpload.uploadKey,
          expiresAt: existingUpload.expiresAt,
        };
      }
      requestError("RETRY_REQUIRED", "This upload key has expired");
    }

    const policy = requestFilePolicy(request.offerKey);
    const files = await getActiveFiles(ctx, request._id);
    const openUploads = await getOpenUploads(ctx, request._id);
    if (files.length + openUploads.length >= policy.maxFiles) requestError("FILE_QUOTA", "The attachment count limit has been reached");
    const usedBytes = files.reduce((sum, file) => sum + file.size, 0) + openUploads.reduce((sum, upload) => sum + upload.expectedSize, 0);
    const normalized = normalizeAttachment({
      offerKey: request.offerKey,
      name: args.name,
      mimeType: args.mimeType,
      size: args.size,
      remainingBytes: Math.max(0, CLIENT_REQUEST_QUOTA_BYTES - usedBytes),
    });
    const uploadUrl = await ctx.storage.generateUploadUrl();
    const now = Date.now();
    const expiresAt = now + UPLOAD_TTL_MS;
    await ctx.db.insert("clientRequestUploads", {
      requestId: request._id,
      clerkUserId: current.clerkUserId,
      tokenIdentifier: current.tokenIdentifier,
      uploadKey,
      uploadUrl,
      name: normalized.name,
      mimeType: normalized.mimeType,
      expectedSize: normalized.size,
      kind: assertShortString(args.kind, "file kind", { max: 80 }),
      status: "pending",
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });
    return { uploadUrl, uploadKey, expiresAt };
  },
});

export const recordAttachmentStorage = mutationGeneric({
  args: {
    requestId: v.id("clientRequests"),
    uploadKey: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx);
    const request = await getOwnedRequest(ctx, args.requestId, current);
    assertFeedbackMutable(request);
    const upload = await ctx.db
      .query("clientRequestUploads")
      .withIndex("by_upload_key", (query) => query.eq("uploadKey", args.uploadKey))
      .first();
    if (!upload || upload.requestId !== request._id) requestError("NOT_FOUND", "Upload reservation not found");
    if (!isRequestOwner(upload, current)) requestError("FORBIDDEN", "Upload belongs to another account");
    if (upload.status === "finalized") {
      if (upload.storageId !== args.storageId) requestError("IDEMPOTENCY_MISMATCH", "Upload was finalized with another file");
      return { ok: true, storageId: args.storageId };
    }
    if (upload.status !== "pending") requestError("RETRY_REQUIRED", "This upload reservation is no longer active");
    if (upload.storageId && upload.storageId !== args.storageId) requestError("IDEMPOTENCY_MISMATCH", "Upload was recorded with another file");
    const existingStorageFile = await ctx.db
      .query("clientRequestFiles")
      .withIndex("by_storage_id", (query) => query.eq("storageId", args.storageId))
      .first();
    if (existingStorageFile) requestError("FORBIDDEN", "Storage file belongs to another dossier");
    const existingStorageUpload = await ctx.db
      .query("clientRequestUploads")
      .withIndex("by_storage_id", (query) => query.eq("storageId", args.storageId))
      .first();
    if (existingStorageUpload && existingStorageUpload._id !== upload._id) requestError("FORBIDDEN", "Storage upload belongs to another dossier");
    await ctx.db.patch(upload._id, { storageId: args.storageId, updatedAt: Date.now() });
    return { ok: true, storageId: args.storageId };
  },
});

export const finalizeAttachment = mutationGeneric({
  args: {
    requestId: v.id("clientRequests"),
    uploadKey: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx);
    const request = await getOwnedRequest(ctx, args.requestId, current);
    assertFeedbackMutable(request);
    const upload = await ctx.db
      .query("clientRequestUploads")
      .withIndex("by_upload_key", (query) => query.eq("uploadKey", args.uploadKey))
      .first();
    if (!upload || upload.requestId !== request._id) requestError("NOT_FOUND", "Upload reservation not found");
    if (!isRequestOwner(upload, current)) requestError("FORBIDDEN", "Upload belongs to another account");
    if (upload.status === "finalized") {
      if (upload.storageId !== args.storageId) requestError("IDEMPOTENCY_MISMATCH", "Upload was finalized with another file");
      const files = await getActiveFiles(ctx, request._id);
      return files.find((file) => file.storageId === args.storageId) ? safeFile(files.find((file) => file.storageId === args.storageId)) : null;
    }
    if (!REQUEST_STATUSES_EDITABLE.has(request.status)) requestError("INVALID_STATE", "Attachments cannot be changed after payment");
    if (upload.status !== "pending" || upload.expiresAt <= Date.now()) {
      requestError("RETRY_REQUIRED", "The upload URL has expired");
    }
    if (upload.storageId && upload.storageId !== args.storageId) requestError("IDEMPOTENCY_MISMATCH", "Upload was recorded with another file");

    // A storage id is not an authorization token. Refuse ids already assigned
    // to any dossier before reading or deleting the underlying object.
    const existingStorageFile = await ctx.db
      .query("clientRequestFiles")
      .withIndex("by_storage_id", (query) => query.eq("storageId", args.storageId))
      .first();
    if (existingStorageFile) requestError("FORBIDDEN", "Storage file belongs to another dossier");
    const existingStorageUpload = await ctx.db
      .query("clientRequestUploads")
      .withIndex("by_storage_id", (query) => query.eq("storageId", args.storageId))
      .first();
    if (existingStorageUpload && existingStorageUpload._id !== upload._id) requestError("FORBIDDEN", "Storage upload belongs to another dossier");

    const rejectUpload = async (reason) => {
      await ctx.storage.delete(args.storageId).catch(() => {});
      await ctx.db.patch(upload._id, {
        status: "rejected",
        storageId: args.storageId,
        rejectionReason: reason.slice(0, 200),
        updatedAt: Date.now(),
      });
      return { ok: false, error: reason };
    };

    const metadata = await ctx.storage.getMetadata(args.storageId);
    const actualSize = Number(metadata?.size);
    const actualMimeType = typeof metadata?.contentType === "string" && metadata.contentType
      ? metadata.contentType.toLowerCase()
      : upload.mimeType;
    const files = await getActiveFiles(ctx, request._id);
    const usedBytes = files.reduce((sum, file) => sum + file.size, 0);
    let normalized;
    try {
      normalized = normalizeAttachment({
        offerKey: request.offerKey,
        name: upload.name,
        mimeType: actualMimeType,
        size: actualSize,
        remainingBytes: Math.max(0, CLIENT_REQUEST_QUOTA_BYTES - usedBytes),
      });
    } catch (error) {
      return rejectUpload(error instanceof Error ? error.message : "INVALID_INPUT: invalid_file");
    }
    if (actualSize !== upload.expectedSize) {
      return rejectUpload("INVALID_INPUT: Uploaded file size changed");
    }
    const duplicate = files.find((file) => file.name === normalized.name && file.size === normalized.size && file.mimeType === normalized.mimeType);
    if (duplicate) {
      await ctx.storage.delete(args.storageId).catch(() => {});
      await ctx.db.patch(upload._id, { status: "rejected", storageId: args.storageId, rejectionReason: "duplicate", updatedAt: Date.now() });
      return safeFile(duplicate);
    }

    const policy = requestFilePolicy(request.offerKey);
    const openUploads = await getOpenUploads(ctx, request._id, { excludeId: upload._id });
    if (files.length + openUploads.length >= policy.maxFiles) {
      return rejectUpload("FILE_QUOTA: The attachment count limit has been reached");
    }

    const now = Date.now();
    const fileId = await ctx.db.insert("clientRequestFiles", {
      requestId: request._id,
      clerkUserId: current.clerkUserId,
      tokenIdentifier: current.tokenIdentifier,
      storageId: args.storageId,
      name: normalized.name,
      mimeType: normalized.mimeType,
      size: normalized.size,
      kind: upload.kind,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(upload._id, { status: "finalized", storageId: args.storageId, updatedAt: now });
    await ctx.db.patch(request._id, { updatedAt: now });
    return safeFile(await ctx.db.get(fileId));
  },
});

export const abandonAttachmentUpload = mutationGeneric({
  args: {
    requestId: v.id("clientRequests"),
    uploadKey: v.string(),
    storageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx);
    const request = await getOwnedRequest(ctx, args.requestId, current);
    assertFeedbackMutable(request);
    const upload = await ctx.db
      .query("clientRequestUploads")
      .withIndex("by_upload_key", (query) => query.eq("uploadKey", args.uploadKey))
      .first();
    if (!upload || upload.requestId !== request._id) requestError("NOT_FOUND", "Upload reservation not found");
    if (!isRequestOwner(upload, current)) requestError("FORBIDDEN", "Upload belongs to another account");
    if (upload.status === "finalized") return { ok: true, status: "finalized" };
    if (upload.storageId && args.storageId && upload.storageId !== args.storageId) requestError("IDEMPOTENCY_MISMATCH", "Upload storage does not match");
    const cleanupStorageId = upload.storageId || args.storageId;
    if (cleanupStorageId) {
      const existingStorageFile = await ctx.db
        .query("clientRequestFiles")
        .withIndex("by_storage_id", (query) => query.eq("storageId", cleanupStorageId))
        .first();
      if (existingStorageFile) requestError("FORBIDDEN", "Storage file belongs to another dossier");
      const existingStorageUpload = await ctx.db
        .query("clientRequestUploads")
        .withIndex("by_storage_id", (query) => query.eq("storageId", cleanupStorageId))
        .first();
      if (existingStorageUpload && existingStorageUpload._id !== upload._id) requestError("FORBIDDEN", "Storage upload belongs to another dossier");
      await ctx.storage.delete(cleanupStorageId).catch(() => {});
    }
    if (upload.status === "pending") {
      await ctx.db.patch(upload._id, {
        status: "rejected",
        ...(cleanupStorageId ? { storageId: cleanupStorageId } : {}),
        rejectionReason: "abandoned",
        updatedAt: Date.now(),
      });
    }
    return { ok: true, status: upload.status === "rejected" ? "rejected" : "abandoned" };
  },
});

export const removeAttachment = mutationGeneric({
  args: { requestId: v.id("clientRequests"), fileId: v.id("clientRequestFiles") },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx);
    const request = await getOwnedRequest(ctx, args.requestId, current);
    assertFeedbackMutable(request);
    if (!REQUEST_STATUSES_EDITABLE.has(request.status)) requestError("INVALID_STATE", "Attachments cannot be changed after payment");
    const file = await ctx.db.get(args.fileId);
    if (!file || file.requestId !== request._id) requestError("NOT_FOUND", "Attachment not found");
    if (!isRequestOwner(file, current)) requestError("FORBIDDEN", "Attachment belongs to another account");
    if (file.status === "active") await ctx.storage.delete(file.storageId).catch(() => {});
    await ctx.db.patch(file._id, { status: "deleted", updatedAt: Date.now() });
    return { ok: true };
  },
});

export const prepareCheckout = mutationGeneric({
  args: { requestId: v.id("clientRequests") },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx);
    const request = await getOwnedRequest(ctx, args.requestId, current);
    const offer = getClientRequestOffer(request.offerKey);
    if (!offer) requestError("INVALID_OFFER", "This client request offer is not available");
    if (request.status === "paid") requestError("ALREADY_PAID", "This request is already paid");
    if (["refunded", "cancelled"].includes(request.status)) requestError("INVALID_STATE", "This request cannot be paid");
    const answers = parseClientRequestAnswers(request.offerKey, request.answersJson);
    if (request.offerKey === "feedback") {
      const files = await getActiveFiles(ctx, request._id);
      validateClientRequestFiles(request.offerKey, answers, files);
    }
    const nextStatus = request.status === "awaiting_payment" ? request.status : "awaiting_payment";
    if (request.status !== nextStatus) {
      await ctx.db.patch(request._id, {
        status: nextStatus,
        paymentStatus: "unpaid",
        ...(request.offerKey === "feedback" ? { checkoutPending: true } : {}),
        updatedAt: Date.now(),
      });
      await recordRequestEvent(ctx, request._id, { eventType: "checkout_prepared", fromStatus: request.status, toStatus: nextStatus });
    } else if (request.offerKey === "feedback" && !request.stripeCheckoutSessionId && !request.checkoutPending) {
      await ctx.db.patch(request._id, { checkoutPending: true, updatedAt: Date.now() });
    }
    return checkoutPayload({ ...request, status: nextStatus, checkoutPending: request.offerKey === "feedback" ? true : request.checkoutPending }, current, offer);
  },
});

export const attachCheckoutSession = mutationGeneric({
  args: {
    requestId: v.id("clientRequests"),
    checkoutSessionId: v.string(),
    attempt: v.number(),
    serverSecret: v.string(),
  },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx);
    const configuredSecret = process.env.BOOKING_WEBHOOK_SECRET;
    if (!configuredSecret || args.serverSecret !== configuredSecret) requestError("FORBIDDEN", "Server checkout attachment required");
    const request = await getOwnedRequest(ctx, args.requestId, current);
    const checkoutSessionId = assertShortString(args.checkoutSessionId, "checkout session", { max: 200 });
    const declaredStripeMode = process.env.STRIPE_MODE?.trim().toLowerCase();
    const keyStripeMode = process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") ? "live" : "test";
    const stripeMode = declaredStripeMode === "live" || declaredStripeMode === "test"
      ? declaredStripeMode
      : keyStripeMode;
    const expectedPrefix = stripeMode === "live" ? "cs_live_" : "cs_test_";
    if (!new RegExp(`^${expectedPrefix}[A-Za-z0-9]+$`).test(checkoutSessionId)) requestError("INVALID_INPUT", "Invalid checkout session");
    if (!Number.isSafeInteger(args.attempt) || args.attempt < 1) requestError("INVALID_INPUT", "Invalid checkout attempt");
    if (!REQUEST_STATUSES_EDITABLE.has(request.status)) requestError("INVALID_STATE", "Checkout cannot be attached to this request");
    if (request.stripeCheckoutSessionId && request.stripeCheckoutSessionId !== checkoutSessionId) {
      if (args.attempt <= (request.checkoutAttempt || 0)) {
        requestError("IDEMPOTENCY_MISMATCH", "A different checkout session is already attached");
      }
    }
    await ctx.db.patch(request._id, {
      stripeCheckoutSessionId: checkoutSessionId,
      checkoutAttempt: Math.max(args.attempt, request.checkoutAttempt || 0),
      ...(request.offerKey === "feedback" ? { checkoutPending: false } : {}),
      status: "awaiting_payment",
      updatedAt: Date.now(),
    });
    return safeRequest(await ctx.db.get(request._id), await getActiveFiles(ctx, request._id));
  },
});

export const releaseCheckout = mutationGeneric({
  args: {
    requestId: v.id("clientRequests"),
    attempt: v.number(),
    serverSecret: v.string(),
  },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx);
    const configuredSecret = process.env.BOOKING_WEBHOOK_SECRET;
    if (!configuredSecret || args.serverSecret !== configuredSecret) requestError("FORBIDDEN", "Server checkout release required");
    const request = await getOwnedRequest(ctx, args.requestId, current);
    if (request.offerKey !== "feedback" || request.stripeCheckoutSessionId || request.status !== "awaiting_payment") {
      return { ok: true, released: false };
    }
    if (request.checkoutAttempt && args.attempt !== request.checkoutAttempt + 1) {
      requestError("IDEMPOTENCY_MISMATCH", "Checkout attempt does not match the pending attempt");
    }
    await ctx.db.patch(request._id, { checkoutPending: false, updatedAt: Date.now() });
    return { ok: true, released: true };
  },
});

export const getCheckoutPayload = queryGeneric({
  args: { requestId: v.id("clientRequests") },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx);
    const request = await getOwnedRequest(ctx, args.requestId, current);
    const offer = getClientRequestOffer(request.offerKey);
    if (!offer) requestError("INVALID_OFFER", "This client request offer is not available");
    if (request.status === "paid") requestError("ALREADY_PAID", "This request is already paid");
    parseClientRequestAnswers(request.offerKey, request.answersJson);
    return checkoutPayload(request, current, offer);
  },
});

export const getMyRequest = queryGeneric({
  args: { requestId: v.id("clientRequests") },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx);
    const request = await getOwnedRequest(ctx, args.requestId, current);
    return safeRequest(request, await getActiveFiles(ctx, request._id));
  },
});

export const getMyRequests = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const current = await requireIdentity(ctx);
    const requests = await ctx.db
      .query("clientRequests")
      .withIndex("by_token_identifier", (query) => query.eq("tokenIdentifier", current.tokenIdentifier))
      .collect();
    return Promise.all(
      requests
        .filter((request) => request.clerkUserId === current.clerkUserId)
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .map(async (request) => safeRequest(request, await getActiveFiles(ctx, request._id), { includeAnswers: false })),
    );
  },
});

export const confirmFromStripe = mutationGeneric({
  args: {
    webhookSecret: v.string(),
    eventId: v.string(),
    eventType: v.string(),
    requestId: v.optional(v.id("clientRequests")),
    checkoutSessionId: v.optional(v.string()),
    paymentIntentId: v.optional(v.string()),
    paymentStatus: v.optional(v.string()),
    amountTotal: v.optional(v.number()),
    currency: v.optional(v.string()),
    metadataUserId: v.optional(v.string()),
    metadataOfferKey: v.optional(v.string()),
    checkoutAttempt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const configuredSecret = process.env.BOOKING_WEBHOOK_SECRET;
    if (!configuredSecret || args.webhookSecret !== configuredSecret) requestError("FORBIDDEN", "Invalid webhook secret");
    const previousEvent = await ctx.db
      .query("clientStripeEvents")
      .withIndex("by_event_id", (query) => query.eq("eventId", args.eventId))
      .first();
    if (previousEvent && previousEvent.status !== "pending_refund") {
      const previousRequest = previousEvent.requestId ? await ctx.db.get(previousEvent.requestId) : null;
      return {
        ok: true,
        duplicate: true,
        eventId: previousEvent.eventId,
        status: previousEvent.status,
        requestId: previousEvent.requestId,
        ...(previousRequest ? { request: safeRequest(previousRequest, await getActiveFiles(ctx, previousRequest._id), { includeAnswers: false }) } : {}),
      };
    }

    let request = args.requestId ? await ctx.db.get(args.requestId) : null;
    if (!request && args.checkoutSessionId) request = await findRequestByField(ctx, "by_checkout_session", args.checkoutSessionId);
    if (!request && args.paymentIntentId) request = await findRequestByField(ctx, "by_payment_intent", args.paymentIntentId);
    const now = Date.now();
    if (!request) {
      if (previousEvent?.status === "pending_refund") {
        await ctx.db.patch(previousEvent._id, { processedAt: now });
        return { ok: true, duplicate: false, status: "pending_refund", eventId: previousEvent.eventId };
      }
      await ctx.db.insert("clientStripeEvents", {
        eventId: args.eventId,
        eventType: args.eventType,
        status: args.eventType === "charge.refunded" && args.paymentIntentId ? "pending_refund" : "ignored_no_request",
        ...(args.checkoutSessionId ? { checkoutSessionId: args.checkoutSessionId } : {}),
        ...(args.paymentIntentId ? { paymentIntentId: args.paymentIntentId } : {}),
        ...(args.amountTotal === undefined ? {} : { amountTotal: args.amountTotal }),
        ...(args.currency ? { currency: args.currency } : {}),
        processedAt: now,
      });
      return {
        ok: true,
        duplicate: false,
        status: args.eventType === "charge.refunded" && args.paymentIntentId ? "pending_refund" : "ignored_no_request",
      };
    }

    const offer = getClientRequestOffer(request.offerKey);
    if (!offer) requestError("INVALID_OFFER", "This client request offer is not available");
    if (args.metadataUserId && args.metadataUserId !== request.clerkUserId) requestError("PAYMENT_MISMATCH", "Payment account does not match the request");
    if (args.metadataOfferKey && args.metadataOfferKey !== request.offerKey) requestError("PAYMENT_MISMATCH", "Payment offer does not match the request");
    if (args.checkoutAttempt !== undefined && (!Number.isSafeInteger(args.checkoutAttempt) || args.checkoutAttempt < 1)) requestError("PAYMENT_MISMATCH", "Payment attempt is invalid");
    if (previousEvent?.status === "pending_refund") {
      const alreadyRefunded = request.status === "refunded" || request.paymentStatus === "refunded";
      await ctx.db.patch(previousEvent._id, {
        status: "refunded",
        requestId: request._id,
        processedAt: now,
      });
      await ctx.db.patch(request._id, {
        status: "refunded",
        paymentStatus: "refunded",
        checkoutPending: false,
        ...(args.paymentIntentId ? { stripePaymentIntentId: args.paymentIntentId } : {}),
        stripeEventId: previousEvent.eventId,
        updatedAt: now,
      });
      if (!alreadyRefunded) {
        await recordRequestEvent(ctx, request._id, {
          eventType: "stripe_payment_refunded",
          fromStatus: request.status,
          toStatus: "refunded",
          sourceId: previousEvent.eventId,
        });
      }
      const refundedRequest = await ctx.db.get(request._id);
      return {
        ok: true,
        duplicate: false,
        eventId: previousEvent.eventId,
        status: alreadyRefunded ? "already_refunded" : "refunded",
        requestId: request._id,
        request: safeRequest(refundedRequest, await getActiveFiles(ctx, request._id), { includeAnswers: false }),
      };
    }
    const pendingRefund = args.paymentIntentId
      ? await ctx.db
        .query("clientStripeEvents")
        .withIndex("by_payment_intent", (query) => query.eq("paymentIntentId", args.paymentIntentId))
        .filter((query) => query.eq(query.field("status"), "pending_refund"))
        .first()
      : null;
    if (pendingRefund) {
      await ctx.db.patch(pendingRefund._id, { status: "refunded", requestId: request._id, processedAt: now });
      const alreadyRefunded = request.status === "refunded" || request.paymentStatus === "refunded";
      await ctx.db.patch(request._id, {
        status: "refunded",
        paymentStatus: "refunded",
        checkoutPending: false,
        ...(args.paymentIntentId ? { stripePaymentIntentId: args.paymentIntentId } : {}),
        stripeEventId: pendingRefund.eventId,
        updatedAt: now,
      });
      if (!alreadyRefunded) {
        await recordRequestEvent(ctx, request._id, {
          eventType: "stripe_payment_refunded",
          fromStatus: request.status,
          toStatus: "refunded",
          sourceId: pendingRefund.eventId,
        });
      }
      request = await ctx.db.get(request._id);
    }
    const staleCheckoutAttempt = Boolean(
      args.checkoutSessionId &&
      request.stripeCheckoutSessionId &&
      args.checkoutSessionId !== request.stripeCheckoutSessionId,
    );
    if (staleCheckoutAttempt && ["checkout.session.expired", "checkout.session.async_payment_failed"].includes(args.eventType)) {
      await ctx.db.insert("clientStripeEvents", {
        eventId: args.eventId,
        eventType: args.eventType,
        status: "ignored_stale_attempt",
        requestId: request._id,
        ...(args.checkoutSessionId ? { checkoutSessionId: args.checkoutSessionId } : {}),
        ...(args.paymentIntentId ? { paymentIntentId: args.paymentIntentId } : {}),
        ...(args.amountTotal === undefined ? {} : { amountTotal: args.amountTotal }),
        ...(args.currency ? { currency: args.currency } : {}),
        processedAt: now,
      });
      return {
        ok: true,
        duplicate: false,
        eventId: args.eventId,
        status: "ignored_stale_attempt",
        requestId: request._id,
        request: safeRequest(request, await getActiveFiles(ctx, request._id), { includeAnswers: false }),
      };
    }
    const stalePaymentAttempt = Boolean(
      args.checkoutAttempt !== undefined &&
      request.checkoutAttempt !== undefined &&
      args.checkoutAttempt < request.checkoutAttempt,
    );
    if (stalePaymentAttempt && isPaymentFailureEvent(args.eventType)) {
      await ctx.db.insert("clientStripeEvents", {
        eventId: args.eventId,
        eventType: args.eventType,
        status: "ignored_stale_attempt",
        requestId: request._id,
        ...(args.checkoutSessionId ? { checkoutSessionId: args.checkoutSessionId } : {}),
        ...(args.paymentIntentId ? { paymentIntentId: args.paymentIntentId } : {}),
        ...(args.amountTotal === undefined ? {} : { amountTotal: args.amountTotal }),
        ...(args.currency ? { currency: args.currency } : {}),
        processedAt: now,
      });
      return {
        ok: true,
        duplicate: false,
        eventId: args.eventId,
        status: "ignored_stale_attempt",
        requestId: request._id,
        request: safeRequest(request, await getActiveFiles(ctx, request._id), { includeAnswers: false }),
      };
    }
    if (staleCheckoutAttempt) {
      requestError("PAYMENT_MISMATCH", "Checkout session does not match the active attempt");
    }
    if (args.amountTotal !== undefined && args.amountTotal !== offer.priceCents) requestError("PAYMENT_MISMATCH", "Payment amount does not match the offer");
    if (args.currency !== undefined && args.currency.toLowerCase() !== "eur") requestError("PAYMENT_MISMATCH", "Payment currency does not match the offer");

    let status = "ignored_event";
    let updatedRequest = request;
    const isPaid = isPaymentSuccessEvent(args.eventType);
    const isFailed = isPaymentFailureEvent(args.eventType);
    const isRefunded = args.eventType === "charge.refunded";
    if (isRefunded) {
      status = request.paymentStatus === "refunded" || request.status === "refunded"
        ? "already_refunded"
        : "refunded";
      await ctx.db.patch(request._id, {
        status: "refunded",
        paymentStatus: "refunded",
        checkoutPending: false,
        ...(args.paymentIntentId ? { stripePaymentIntentId: args.paymentIntentId } : {}),
        stripeEventId: args.eventId,
        updatedAt: now,
      });
      if (status === "refunded") {
        await recordRequestEvent(ctx, request._id, {
          eventType: "stripe_payment_refunded",
          fromStatus: request.status,
          toStatus: "refunded",
          sourceId: args.eventId,
        });
      }
      updatedRequest = await ctx.db.get(request._id);
    } else if (isPaid && args.paymentStatus !== "unpaid") {
      if (request.paymentStatus === "paid" || request.status === "paid") {
        status = "already_paid";
        await ctx.db.patch(request._id, {
          ...(args.checkoutSessionId ? { stripeCheckoutSessionId: args.checkoutSessionId } : {}),
          ...(args.paymentIntentId ? { stripePaymentIntentId: args.paymentIntentId } : {}),
          stripeEventId: args.eventId,
          updatedAt: now,
        });
      } else if (["expired", "cancelled", "refunded"].includes(request.status)) {
        status = "late_payment";
        await ctx.db.patch(request._id, {
          ...(args.checkoutSessionId ? { stripeCheckoutSessionId: args.checkoutSessionId } : {}),
          ...(args.paymentIntentId ? { stripePaymentIntentId: args.paymentIntentId } : {}),
          stripeEventId: args.eventId,
          updatedAt: now,
        });
      } else {
        status = "paid";
        await ctx.db.patch(request._id, {
          status: "paid",
          paymentStatus: "paid",
          checkoutPending: false,
          ...(args.checkoutSessionId ? { stripeCheckoutSessionId: args.checkoutSessionId } : {}),
          ...(args.paymentIntentId ? { stripePaymentIntentId: args.paymentIntentId } : {}),
          stripeEventId: args.eventId,
          paidAt: now,
          updatedAt: now,
        });
        await recordRequestEvent(ctx, request._id, {
          eventType: "stripe_payment_confirmed",
          fromStatus: request.status,
          toStatus: "paid",
          sourceId: args.eventId,
        });
      }
      updatedRequest = await ctx.db.get(request._id);
    } else if (isPaid && args.paymentStatus === "unpaid") {
      status = "payment_pending";
      await ctx.db.patch(request._id, {
        ...(args.checkoutSessionId ? { stripeCheckoutSessionId: args.checkoutSessionId } : {}),
        ...(args.paymentIntentId ? { stripePaymentIntentId: args.paymentIntentId } : {}),
        updatedAt: now,
      });
      updatedRequest = await ctx.db.get(request._id);
    } else if (isFailed && request.paymentStatus !== "paid" && !["refunded", "cancelled"].includes(request.status)) {
      status = "payment_failed";
        await ctx.db.patch(request._id, {
          status: "payment_failed",
          paymentStatus: "failed",
          checkoutPending: request.checkoutPending === true,
        ...(args.paymentIntentId ? { stripePaymentIntentId: args.paymentIntentId } : {}),
        stripeEventId: args.eventId,
        updatedAt: now,
      });
      await recordRequestEvent(ctx, request._id, {
        eventType: "stripe_payment_failed",
        fromStatus: request.status,
        toStatus: "payment_failed",
        sourceId: args.eventId,
      });
      updatedRequest = await ctx.db.get(request._id);
    } else if (args.eventType === "checkout.session.expired" && request.paymentStatus !== "paid" && !["refunded", "cancelled"].includes(request.status)) {
      status = "expired";
      await ctx.db.patch(request._id, {
        status: "expired",
        paymentStatus: "expired",
        checkoutPending: request.checkoutPending === true,
        stripeEventId: args.eventId,
        updatedAt: now,
      });
      await recordRequestEvent(ctx, request._id, {
        eventType: "stripe_checkout_expired",
        fromStatus: request.status,
        toStatus: "expired",
        sourceId: args.eventId,
      });
      updatedRequest = await ctx.db.get(request._id);
    }

    await ctx.db.insert("clientStripeEvents", {
      eventId: args.eventId,
      eventType: args.eventType,
      status,
      requestId: request._id,
      ...(args.checkoutSessionId ? { checkoutSessionId: args.checkoutSessionId } : {}),
      ...(args.paymentIntentId ? { paymentIntentId: args.paymentIntentId } : {}),
      ...(args.amountTotal === undefined ? {} : { amountTotal: args.amountTotal }),
      ...(args.currency ? { currency: args.currency } : {}),
      processedAt: now,
    });
    return {
      ok: true,
      duplicate: false,
      eventId: args.eventId,
      status,
      requestId: request._id,
      request: safeRequest(updatedRequest, await getActiveFiles(ctx, request._id), { includeAnswers: false }),
    };
  },
});
