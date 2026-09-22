import { queryGeneric } from "convex/server";
import { v } from "convex/values";
import { isRequestOwner } from "./clientRequestRules.js";

const ADMIN_DELIVERY_KIND = "admin_delivery";

export const CLIENT_DELIVERY_STATES = Object.freeze([
  "payment_required",
  "preparing",
  "awaiting_delivery",
  "delivered",
  "unavailable",
  "closed",
]);

export const CLIENT_DELIVERY_STATE_LABELS = Object.freeze({
  payment_required: "Paiement à confirmer",
  preparing: "Préparation en cours",
  awaiting_delivery: "Livraison à venir",
  delivered: "PDF disponible",
  unavailable: "Document temporairement indisponible",
  closed: "Dossier fermé",
});

function deliveryError(code, message) {
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
    deliveryError("FORBIDDEN", "A server delivery proxy is required");
  }
}

async function requireIdentity(ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) deliveryError("UNAUTHENTICATED", "Authentication required");
  return {
    identity,
    clerkUserId: identity.subject,
    tokenIdentifier: identity.tokenIdentifier || identity.subject,
  };
}

async function getOwnedRequest(ctx, requestId, current) {
  const request = await ctx.db.get(requestId);
  if (!request) deliveryError("NOT_FOUND", "Client request not found");
  if (!isRequestOwner(request, current)) deliveryError("FORBIDDEN", "Client request belongs to another account");
  return request;
}

async function getRequestFiles(ctx, requestId) {
  const files = await ctx.db
    .query("clientRequestFiles")
    .withIndex("by_request", (query) => query.eq("requestId", requestId))
    .collect();
  return files
    .filter((file) => file.status === "active" && file.kind === ADMIN_DELIVERY_KIND)
    .sort((left, right) => right.createdAt - left.createdAt || String(right._id).localeCompare(String(left._id)));
}

async function getRequestUploads(ctx, requestId) {
  return ctx.db
    .query("clientRequestUploads")
    .withIndex("by_request", (query) => query.eq("requestId", requestId))
    .collect();
}

async function getRequestEvents(ctx, requestId) {
  const events = await ctx.db
    .query("clientRequestEvents")
    .withIndex("by_request", (query) => query.eq("requestId", requestId))
    .collect();
  return events.sort((left, right) =>
    left.createdAt - right.createdAt ||
    (left._creationTime || 0) - (right._creationTime || 0) ||
    String(left._id).localeCompare(String(right._id))
  );
}

function hasAdminEvent(events, eventType, kind, id) {
  return events.some((event) =>
    event.eventType === eventType &&
    typeof event.sourceId === "string" &&
    event.sourceId.endsWith(`:${kind}:${id}`)
  );
}

function isPaid(request) {
  return request.status === "paid" && request.paymentStatus === "paid";
}

function isClosed(request) {
  return ["refunded", "cancelled"].includes(request.status) || request.paymentStatus === "refunded";
}

function baseDelivery(request, state) {
  return {
    id: request._id,
    requestId: request._id,
    offerKey: request.offerKey,
    requestStatus: request.status,
    paymentStatus: request.paymentStatus,
    state,
    stateLabel: CLIENT_DELIVERY_STATE_LABELS[state],
    updatedAt: request.updatedAt,
    createdAt: request.createdAt,
    file: null,
  };
}

async function safeDeliveredFile(ctx, file) {
  const url = await ctx.storage.getUrl(file.storageId);
  if (!url) return { file: null, available: false };
  return {
    available: true,
    file: {
      id: file._id,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
      createdAt: file.createdAt,
      downloadUrl: `/api/client-deliveries/${encodeURIComponent(file.requestId)}`,
    },
  };
}

async function safeDelivery(ctx, request) {
  if (!isPaid(request)) return baseDelivery(request, isClosed(request) ? "closed" : "payment_required");

  const [files, uploads, events] = await Promise.all([
    getRequestFiles(ctx, request._id),
    getRequestUploads(ctx, request._id),
    getRequestEvents(ctx, request._id),
  ]);

  let hasFinalizedProof = false;
  for (const file of files) {
    if (!hasAdminEvent(events, "admin_delivery_recorded", "file", file._id)) continue;
    hasFinalizedProof = true;
    const delivered = await safeDeliveredFile(ctx, file);
    if (delivered.available) return { ...baseDelivery(request, "delivered"), file: delivered.file };
  }

  const preparedUpload = uploads
    .filter((upload) =>
      upload.kind === ADMIN_DELIVERY_KIND &&
      upload.status === "pending" &&
      upload.expiresAt > Date.now() &&
      hasAdminEvent(events, "admin_delivery_prepared", "upload", upload._id)
    )
    .sort((left, right) => right.updatedAt - left.updatedAt || right._creationTime - left._creationTime)[0];
  if (preparedUpload) return baseDelivery(request, "preparing");
  // A client-created `admin_delivery` upload is not proof of an
  // administration delivery. Only the audited admin event can move a paid
  // dossier into the unavailable state after a failed/removed delivery.
  if (hasFinalizedProof) {
    return baseDelivery(request, "unavailable");
  }
  return baseDelivery(request, "awaiting_delivery");
}

async function getProvenDeliveryFile(ctx, request) {
  if (!isPaid(request)) deliveryError("FORBIDDEN", "A paid request is required");
  const [files, events] = await Promise.all([
    getRequestFiles(ctx, request._id),
    getRequestEvents(ctx, request._id),
  ]);
  for (const file of files) {
    if (!hasAdminEvent(events, "admin_delivery_recorded", "file", file._id)) continue;
    const url = await ctx.storage.getUrl(file.storageId);
    if (url) return { url, name: file.name, mimeType: file.mimeType, size: file.size };
  }
  deliveryError("NOT_FOUND", "No finalized delivery is available");
}

export const getMyDelivery = queryGeneric({
  args: { requestId: v.id("clientRequests") },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx);
    const request = await getOwnedRequest(ctx, args.requestId, current);
    return safeDelivery(ctx, request);
  },
});

export const getMyDeliveries = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const current = await requireIdentity(ctx);
    const requests = await ctx.db
      .query("clientRequests")
      .withIndex("by_token_identifier", (query) => query.eq("tokenIdentifier", current.tokenIdentifier))
      .collect();
    return Promise.all(
      requests
        .filter((request) => isRequestOwner(request, current))
        .sort((left, right) => right.updatedAt - left.updatedAt || right._creationTime - left._creationTime)
        .map((request) => safeDelivery(ctx, request)),
    );
  },
});

// This query is consumed only by the authenticated Next.js proxy. It never
// appears in the browser-facing delivery payload, which contains a same-origin
// route instead of a bearer storage URL.
export const getMyDeliveryDownload = queryGeneric({
  args: {
    requestId: v.id("clientRequests"),
    serverSecret: v.string(),
  },
  handler: async (ctx, args) => {
    requireServerProxy(args);
    const current = await requireIdentity(ctx);
    const request = await getOwnedRequest(ctx, args.requestId, current);
    return getProvenDeliveryFile(ctx, request);
  },
});
