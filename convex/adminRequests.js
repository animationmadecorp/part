import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { getClientRequestOffer, parseClientRequestAnswers } from "./clientRequestRules.js";
import { enqueueDeliveryNotification } from "./deliveryNotifications/actions.js";

export const ADMIN_WORK_STATUSES = Object.freeze(["todo", "in_progress", "done"]);
export const ADMIN_WORK_STATUS_LABELS = Object.freeze({
  todo: "À traiter",
  in_progress: "En cours",
  done: "Terminées",
});

const ADMIN_DELIVERY_KIND = "admin_delivery";
const ADMIN_DELIVERY_MAX_BYTES = 25 * 1024 * 1024;
const ADMIN_UPLOAD_TTL_MS = 60 * 60 * 1000;

function deliveryStageForRequest(request) {
  if (request.offerKey === "projet-animation") return "preparation";
  if (request.offerKey === "review") return "book_guide";
  return "deliverable";
}

// clientRequests.status is the payment lifecycle and is intentionally left
// untouched. Admin work status is an audited event projection so "En cours"
// and "Terminées" do not pretend to be values supported by the existing schema.

function adminRequestError(code, message) {
  throw new Error(`${code}: ${message}`);
}

function secretsMatch(provided, configured) {
  if (typeof provided !== "string" || typeof configured !== "string" || provided.length !== configured.length) return false;
  let difference = 0;
  for (let index = 0; index < configured.length; index += 1) {
    difference |= provided.charCodeAt(index) ^ configured.charCodeAt(index);
  }
  return difference === 0;
}

function requireServerProxy(args) {
  const configuredSecret = process.env.BOOKING_WEBHOOK_SECRET;
  if (!configuredSecret || !secretsMatch(args.serverSecret, configuredSecret)) {
    adminRequestError("FORBIDDEN", "A server file proxy is required");
  }
}

async function requireIdentity(ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) adminRequestError("UNAUTHENTICATED", "Authentication required");
  return {
    identity,
    clerkUserId: identity.subject,
    tokenIdentifier: identity.tokenIdentifier || identity.subject,
  };
}

async function findProfile(ctx, tokenIdentifier) {
  return ctx.db
    .query("users")
    .withIndex("by_token_identifier", (query) => query.eq("tokenIdentifier", tokenIdentifier))
    .first();
}

async function requireAdmin(ctx) {
  const current = await requireIdentity(ctx);
  const profile = await findProfile(ctx, current.tokenIdentifier);
  if (profile?.role !== "admin") adminRequestError("FORBIDDEN", "Administrator access required");
  return { ...current, profile };
}

async function getRequest(ctx, requestId) {
  const request = await ctx.db.get(requestId);
  if (!request) adminRequestError("NOT_FOUND", "Client request not found");
  return request;
}

async function getRequestFiles(ctx, requestId) {
  const files = await ctx.db
    .query("clientRequestFiles")
    .withIndex("by_request", (query) => query.eq("requestId", requestId))
    .collect();
  return files.filter((file) => file.status === "active");
}

async function getRequestEvents(ctx, requestId) {
  const events = await ctx.db
    .query("clientRequestEvents")
    .withIndex("by_request", (query) => query.eq("requestId", requestId))
    .collect();
  return events.sort(compareEvents);
}

function compareEvents(left, right) {
  return left.createdAt - right.createdAt
    || (left._creationTime || 0) - (right._creationTime || 0)
    || String(left._id).localeCompare(String(right._id));
}

function isAdminWorkStatus(value) {
  return ADMIN_WORK_STATUSES.includes(value);
}

export function getLatestAdminWorkStatus(events = []) {
  const statusEvent = [...events]
    .sort(compareEvents)
    .reverse()
    .find((event) => event.eventType === "admin_work_status_changed" && isAdminWorkStatus(event.toStatus));
  return statusEvent?.toStatus || "todo";
}

function nextAuditTimestamp(events = []) {
  const latest = events.reduce((maximum, event) => Math.max(maximum, Number(event.createdAt) || 0), 0);
  return Math.max(Date.now(), latest + 1);
}

function safeAnswers(request) {
  try {
    return { value: parseClientRequestAnswers(request.offerKey, request.answersJson), valid: true };
  } catch {
    return { value: null, valid: false };
  }
}

async function safeFile(file) {
  return {
    id: file._id,
    name: file.name,
    mimeType: file.mimeType,
    size: file.size,
    kind: file.kind,
    ...(file.deliveryStage ? { deliveryStage: file.deliveryStage } : {}),
    createdAt: file.createdAt,
    downloadUrl: `/api/admin-files/${encodeURIComponent(file.requestId)}/${encodeURIComponent(file._id)}`,
  };
}

async function getStorageMetadata(ctx, storageId) {
  return ctx.db.system.get("_storage", storageId);
}

function safeEvent(event) {
  return {
    id: event._id,
    eventType: event.eventType,
    fromStatus: event.fromStatus || null,
    toStatus: event.toStatus,
    sourceId: event.sourceId || null,
    createdAt: event.createdAt,
  };
}

async function safeAdminRequest(ctx, request, { events, files } = {}) {
  const requestEvents = events || await getRequestEvents(ctx, request._id);
  const requestFiles = files || await getRequestFiles(ctx, request._id);
  const answers = safeAnswers(request);
  const workStatus = getLatestAdminWorkStatus(requestEvents);
  const offer = getClientRequestOffer(request.offerKey);
  return {
    id: request._id,
    email: request.email || null,
    offerKey: request.offerKey,
    offerTitle: offer?.title || request.offerKey,
    offerDescription: offer?.description || null,
    requestStatus: request.status,
    paymentStatus: request.paymentStatus,
    priceCents: request.priceCents,
    currency: request.currency,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    paidAt: request.paidAt || null,
    workStatus,
    workStatusLabel: ADMIN_WORK_STATUS_LABELS[workStatus],
    answers: answers.value,
    answersValid: answers.valid,
    files: await Promise.all(requestFiles.map((file) => safeFile(file))),
    events: requestEvents.map(safeEvent),
  };
}

function safeDeliveryUpload(upload) {
  return {
    status: upload.status,
    uploadKey: upload.uploadKey,
    uploadUrl: upload.status === "pending" ? upload.uploadUrl : null,
    storageId: upload.storageId || null,
    name: upload.name,
    expectedSize: upload.expectedSize,
    expiresAt: upload.expiresAt,
    updatedAt: upload.updatedAt,
  };
}

async function getLatestAdminDeliveryUpload(ctx, requestId, current) {
  const uploads = await ctx.db
    .query("clientRequestUploads")
    .withIndex("by_request", (query) => query.eq("requestId", requestId))
    .collect();
  return uploads
    .filter((upload) =>
      upload.kind === ADMIN_DELIVERY_KIND &&
      upload.clerkUserId === current.clerkUserId &&
      upload.tokenIdentifier === current.tokenIdentifier &&
      upload.status !== "rejected",
    )
    .sort((left, right) => right.updatedAt - left.updatedAt || right._creationTime - left._creationTime)[0] || null;
}

export const getAdminRequests = queryGeneric({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const requests = await ctx.db.query("clientRequests").collect();
    requests.sort((left, right) => right.updatedAt - left.updatedAt || right._creationTime - left._creationTime);
    return Promise.all(requests.map((request) => safeAdminRequest(ctx, request)));
  },
});

export const getAdminRequest = queryGeneric({
  args: { requestId: v.id("clientRequests") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return safeAdminRequest(ctx, await getRequest(ctx, args.requestId));
  },
});

export const getAdminFileDownload = queryGeneric({
  args: {
    requestId: v.id("clientRequests"),
    fileId: v.id("clientRequestFiles"),
    serverSecret: v.string(),
  },
  handler: async (ctx, args) => {
    requireServerProxy(args);
    await requireAdmin(ctx);
    const request = await getRequest(ctx, args.requestId);
    const file = (await getRequestFiles(ctx, request._id)).find((candidate) => candidate._id === args.fileId);
    if (!file) adminRequestError("NOT_FOUND", "Client file not found");
    const url = await ctx.storage.getUrl(file.storageId);
    if (!url) adminRequestError("NOT_FOUND", "Client file is no longer available");
    return {
      url,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
    };
  },
});

export const getAdminDeliveryUpload = queryGeneric({
  args: { requestId: v.id("clientRequests") },
  handler: async (ctx, args) => {
    const current = await requireAdmin(ctx);
    await getRequest(ctx, args.requestId);
    const upload = await getLatestAdminDeliveryUpload(ctx, args.requestId, current);
    return upload ? safeDeliveryUpload(upload) : null;
  },
});

export const setWorkStatus = mutationGeneric({
  args: {
    requestId: v.id("clientRequests"),
    workStatus: v.union(v.literal("todo"), v.literal("in_progress"), v.literal("done")),
  },
  handler: async (ctx, args) => {
    const current = await requireAdmin(ctx);
    const request = await getRequest(ctx, args.requestId);
    const events = await getRequestEvents(ctx, request._id);
    const previousStatus = getLatestAdminWorkStatus(events);
    if (previousStatus === args.workStatus) {
      return safeAdminRequest(ctx, request, { events });
    }

    const now = nextAuditTimestamp(events);
    await ctx.db.insert("clientRequestEvents", {
      requestId: request._id,
      eventType: "admin_work_status_changed",
      fromStatus: previousStatus,
      toStatus: args.workStatus,
      sourceId: `admin:${current.clerkUserId}`,
      createdAt: now,
    });
    await ctx.db.patch(request._id, { updatedAt: now });
    return safeAdminRequest(ctx, await ctx.db.get(request._id), { events: await getRequestEvents(ctx, request._id) });
  },
});

function assertDeliveryName(value) {
  if (typeof value !== "string") adminRequestError("INVALID_INPUT", "Invalid delivery file name");
  const name = value.trim();
  if (!name || name.length > 180 || !/\.pdf$/i.test(name) || /[\[\]{}<>\0\r\n]/.test(name)) {
    adminRequestError("INVALID_INPUT", "Delivery must be a PDF with a valid file name");
  }
  return name;
}

function assertDeliverySize(value) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > ADMIN_DELIVERY_MAX_BYTES) {
    adminRequestError("INVALID_INPUT", "Delivery PDF is too large or empty");
  }
  return value;
}

function assertDeliveryRequest(request) {
  if (["refunded", "cancelled"].includes(request.status)) {
    adminRequestError("INVALID_STATE", "A closed request cannot receive a delivery");
  }
  if (request.status !== "paid" || request.paymentStatus !== "paid") {
    adminRequestError("INVALID_STATE", "A delivery can only be recorded for a paid request");
  }
}

export const prepareDelivery = mutationGeneric({
  args: {
    requestId: v.id("clientRequests"),
    name: v.string(),
    mimeType: v.string(),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    const current = await requireAdmin(ctx);
    const request = await getRequest(ctx, args.requestId);
    assertDeliveryRequest(request);
    const name = assertDeliveryName(args.name);
    if (args.mimeType.toLowerCase() !== "application/pdf") adminRequestError("INVALID_INPUT", "Delivery must be a PDF");
    const size = assertDeliverySize(args.size);
    const uploadUrl = await ctx.storage.generateUploadUrl();
    const uploadKey = `admin-delivery:${request._id}:${current.clerkUserId}:${uploadUrl}`;
    const events = await getRequestEvents(ctx, request._id);
    const now = nextAuditTimestamp(events);
    const uploadId = await ctx.db.insert("clientRequestUploads", {
      requestId: request._id,
      clerkUserId: current.clerkUserId,
      tokenIdentifier: current.tokenIdentifier,
      uploadKey,
      uploadUrl,
      name,
      mimeType: "application/pdf",
      expectedSize: size,
      kind: ADMIN_DELIVERY_KIND,
      deliveryStage: deliveryStageForRequest(request),
      status: "pending",
      expiresAt: now + ADMIN_UPLOAD_TTL_MS,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("clientRequestEvents", {
      requestId: request._id,
      eventType: "admin_delivery_prepared",
      fromStatus: getLatestAdminWorkStatus(events),
      toStatus: getLatestAdminWorkStatus(events),
      sourceId: `admin:${current.clerkUserId}:upload:${uploadId}`,
      createdAt: now,
    });
    return { uploadUrl, uploadKey, expiresAt: now + ADMIN_UPLOAD_TTL_MS };
  },
});

export const recordDeliveryStorage = mutationGeneric({
  args: {
    requestId: v.id("clientRequests"),
    uploadKey: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const current = await requireAdmin(ctx);
    const request = await getRequest(ctx, args.requestId);
    assertDeliveryRequest(request);
    const upload = await ctx.db
      .query("clientRequestUploads")
      .withIndex("by_upload_key", (query) => query.eq("uploadKey", args.uploadKey))
      .first();
    if (!upload || upload.requestId !== request._id || upload.kind !== ADMIN_DELIVERY_KIND) {
      adminRequestError("NOT_FOUND", "Delivery upload reservation not found");
    }
    if (upload.clerkUserId !== current.clerkUserId || upload.tokenIdentifier !== current.tokenIdentifier) {
      adminRequestError("FORBIDDEN", "Delivery upload belongs to another administrator");
    }
    if (upload.status === "finalized") {
      if (upload.storageId !== args.storageId) {
        adminRequestError("IDEMPOTENCY_MISMATCH", "Delivery upload was finalized with another file");
      }
      return { ok: true, storageId: args.storageId, status: "finalized" };
    }
    if (upload.status !== "pending" || upload.expiresAt <= Date.now()) {
      adminRequestError("RETRY_REQUIRED", "Delivery upload has expired");
    }
    if (upload.storageId && upload.storageId !== args.storageId) {
      adminRequestError("IDEMPOTENCY_MISMATCH", "Delivery upload storage does not match");
    }
    const existingFile = await ctx.db
      .query("clientRequestFiles")
      .withIndex("by_storage_id", (query) => query.eq("storageId", args.storageId))
      .first();
    if (existingFile) adminRequestError("FORBIDDEN", "Storage file is already attached to a dossier");
    const existingUpload = await ctx.db
      .query("clientRequestUploads")
      .withIndex("by_storage_id", (query) => query.eq("storageId", args.storageId))
      .first();
    if (existingUpload && existingUpload._id !== upload._id) {
      adminRequestError("FORBIDDEN", "Storage upload belongs to another dossier");
    }
    if (!await getStorageMetadata(ctx, args.storageId)) {
      adminRequestError("NOT_FOUND", "Uploaded storage file not found");
    }
    await ctx.db.patch(upload._id, { storageId: args.storageId, updatedAt: Date.now() });
    return { ok: true, storageId: args.storageId, status: "pending" };
  },
});

export const finalizeDelivery = mutationGeneric({
  args: {
    requestId: v.id("clientRequests"),
    uploadKey: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const current = await requireAdmin(ctx);
    const request = await getRequest(ctx, args.requestId);
    assertDeliveryRequest(request);
    const upload = await ctx.db
      .query("clientRequestUploads")
      .withIndex("by_upload_key", (query) => query.eq("uploadKey", args.uploadKey))
      .first();
    if (!upload || upload.requestId !== request._id || upload.kind !== ADMIN_DELIVERY_KIND) {
      adminRequestError("NOT_FOUND", "Delivery upload reservation not found");
    }
    if (upload.clerkUserId !== current.clerkUserId || upload.tokenIdentifier !== current.tokenIdentifier) {
      adminRequestError("FORBIDDEN", "Delivery upload belongs to another administrator");
    }
    if (upload.status === "finalized") {
      if (upload.storageId !== args.storageId) {
        adminRequestError("IDEMPOTENCY_MISMATCH", "Delivery upload was finalized with another file");
      }
      const files = await getRequestFiles(ctx, request._id);
      const existing = files.find((file) => file.storageId === args.storageId);
      if (existing) return { ok: true, file: await safeFile(existing), duplicate: true };
      adminRequestError("RETRY_REQUIRED", "Delivery upload was finalized but its file is unavailable");
    }
    if (upload.status !== "pending" || upload.expiresAt <= Date.now()) {
      adminRequestError("RETRY_REQUIRED", "Delivery upload has expired");
    }
    if (upload.storageId && upload.storageId !== args.storageId) {
      adminRequestError("IDEMPOTENCY_MISMATCH", "Delivery upload storage does not match");
    }

    const existingFile = await ctx.db
      .query("clientRequestFiles")
      .withIndex("by_storage_id", (query) => query.eq("storageId", args.storageId))
      .first();
    if (existingFile) adminRequestError("FORBIDDEN", "Storage file is already attached to a dossier");
    const existingUpload = await ctx.db
      .query("clientRequestUploads")
      .withIndex("by_storage_id", (query) => query.eq("storageId", args.storageId))
      .first();
    if (existingUpload && existingUpload._id !== upload._id) {
      adminRequestError("FORBIDDEN", "Storage upload belongs to another dossier");
    }

    const metadata = await getStorageMetadata(ctx, args.storageId);
    const actualSize = Number(metadata?.size);
    const actualMimeType = typeof metadata?.contentType === "string" ? metadata.contentType.toLowerCase() : "";
    const rejectDelivery = async (reason) => {
      await ctx.storage.delete(args.storageId).catch(() => {});
      const now = nextAuditTimestamp(await getRequestEvents(ctx, request._id));
      await ctx.db.patch(upload._id, {
        status: "rejected",
        storageId: args.storageId,
        rejectionReason: reason.slice(0, 200),
        updatedAt: now,
      });
      const events = await getRequestEvents(ctx, request._id);
      await ctx.db.insert("clientRequestEvents", {
        requestId: request._id,
        eventType: "admin_delivery_rejected",
        fromStatus: getLatestAdminWorkStatus(events),
        toStatus: getLatestAdminWorkStatus(events),
        sourceId: `admin:${current.clerkUserId}:upload:${upload._id}`,
        createdAt: now,
      });
      return { ok: false, error: reason };
    };

    if (actualSize !== upload.expectedSize || actualMimeType !== "application/pdf") {
      return rejectDelivery("INVALID_INPUT: Uploaded file is not the expected PDF");
    }

    const now = nextAuditTimestamp(await getRequestEvents(ctx, request._id));
    const fileId = await ctx.db.insert("clientRequestFiles", {
      requestId: request._id,
      clerkUserId: current.clerkUserId,
      tokenIdentifier: current.tokenIdentifier,
      storageId: args.storageId,
      name: upload.name,
      mimeType: "application/pdf",
      size: actualSize,
      kind: ADMIN_DELIVERY_KIND,
      deliveryStage: deliveryStageForRequest(request),
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(upload._id, { status: "finalized", storageId: args.storageId, updatedAt: now });
    await ctx.db.patch(request._id, { updatedAt: now });
    const events = await getRequestEvents(ctx, request._id);
    const workStatus = getLatestAdminWorkStatus(events);
    await ctx.db.insert("clientRequestEvents", {
      requestId: request._id,
      eventType: "admin_delivery_recorded",
      fromStatus: workStatus,
      toStatus: workStatus,
      sourceId: `admin:${current.clerkUserId}:file:${fileId}`,
      createdAt: now,
    });
    await enqueueDeliveryNotification(ctx, {
      requestId: request._id,
      kind: "pdf",
      sourceId: String(fileId),
      publishedAt: now,
    });
    return { ok: true, file: await safeFile(await ctx.db.get(fileId)), duplicate: false };
  },
});
