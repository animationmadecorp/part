import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { isRequestOwner, parseClientRequestAnswers } from "./clientRequestRules.js";
import {
  REVIEW_FPS,
  normalizeReviewPayload,
  parseReviewArray,
} from "./reviewStudioRules.js";
import { enqueueDeliveryNotification } from "./deliveryNotifications/actions.js";
import {
  getReviewSubmissionRule,
  isVideoMimeType,
  normalizeAnimationSubmission,
  normalizeBookReviewNotes,
  normalizeBookSubmission,
  parseSubmissionPayload,
} from "./reviewSubmissionRules.js";

const REVIEW_OFFERS = new Set(["projet-animation", "feedback"]);
const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/quicktime"]);
const SUBMISSION_UPLOAD_TTL_MS = 60 * 60 * 1000;

function reviewError(code, message) {
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
  const configured = process.env.BOOKING_WEBHOOK_SECRET;
  if (!configured || !secretsMatch(args.serverSecret, configured)) {
    reviewError("FORBIDDEN", "A server media proxy is required");
  }
}

async function requireIdentity(ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) reviewError("UNAUTHENTICATED", "Authentication required");
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
  if (profile?.role !== "admin") reviewError("FORBIDDEN", "Administrator access required");
  return { ...current, profile };
}

async function getRequest(ctx, requestId) {
  const request = await ctx.db.get(requestId);
  if (!request) reviewError("NOT_FOUND", "Client request not found");
  return request;
}

function assertPaidReviewRequest(request) {
  if (!REVIEW_OFFERS.has(request.offerKey)) {
    reviewError("INVALID_STATE", "This dossier does not contain an animation review");
  }
  if (request.status !== "paid" || request.paymentStatus !== "paid") {
    reviewError("INVALID_STATE", "A review is available only after confirmed payment");
  }
  if (["refunded", "cancelled"].includes(request.status) || request.paymentStatus === "refunded") {
    reviewError("FORBIDDEN", "This dossier is no longer accessible");
  }
}

function assertPaidSubmissionRequest(request, { allowBook = true } = {}) {
  const rule = getReviewSubmissionRule(request?.offerKey);
  if (!rule || (!allowBook && rule.kind === "book")) {
    reviewError("INVALID_STATE", "This dossier does not contain an eligible paid review offer");
  }
  if (request.status !== "paid" || request.paymentStatus !== "paid") {
    reviewError("INVALID_STATE", "A submission is available only after confirmed payment");
  }
  if (["refunded", "cancelled"].includes(request.status) || request.paymentStatus === "refunded") {
    reviewError("FORBIDDEN", "This dossier is no longer accessible");
  }
  return rule;
}

function isVideoFile(file) {
  return file?.status === "active" && VIDEO_MIME_TYPES.has(String(file.mimeType || "").toLowerCase());
}

function isClientSubmissionFile(file) {
  return isVideoFile(file) && file.kind === "submission";
}

function isPublishedReviewState(draft, cycle) {
  return draft?.status === "published"
    || Boolean(draft?.publishedSnapshotId)
    || cycle?.status === "published"
    || Boolean(cycle?.reviewSnapshotId);
}

function assertAnimationSubmissionSource(request, cycleNumber, submission, source, draft, cycle) {
  if (request.offerKey !== "projet-animation" || ![1, 2].includes(cycleNumber) || isPublishedReviewState(draft, cycle)) return;
  if (!submission) {
    reviewError("SUBMISSION_REQUIRED", "The client must submit the first animation version before the review can open");
  }
  if (!isClientSubmissionFile(source)) {
    reviewError("SUBMISSION_REQUIRED", "The questionnaire video is not a client review submission");
  }
}

async function getActiveFiles(ctx, requestId) {
  return (await ctx.db
    .query("clientRequestFiles")
    .withIndex("by_request", (query) => query.eq("requestId", requestId))
    .collect())
    .filter((file) => file.status === "active");
}

async function getRequestEvents(ctx, requestId) {
  return (await ctx.db
    .query("clientRequestEvents")
    .withIndex("by_request", (query) => query.eq("requestId", requestId))
    .collect())
    .sort((left, right) => left.createdAt - right.createdAt || String(left._id).localeCompare(String(right._id)));
}

function isPaidRequest(request) {
  return request?.status === "paid" && request?.paymentStatus === "paid";
}

function hasAdminDelivery(events, files) {
  return files.some((file) => file.status === "active" && file.kind === "admin_delivery" && events.some((event) =>
    event.eventType === "admin_delivery_recorded" &&
    typeof event.sourceId === "string" &&
    event.sourceId.endsWith(`:file:${file._id}`)
  ));
}

function hasTypedAdminDelivery(events, files, deliveryStage) {
  return hasAdminDelivery(events, files.filter((file) =>
    String(file.mimeType || "").toLowerCase() === "application/pdf" && file.deliveryStage === deliveryStage
  ));
}

async function hasPreparationDelivery(ctx, requestId, deliveryStage) {
  const [events, files] = await Promise.all([
    getRequestEvents(ctx, requestId),
    getActiveFiles(ctx, requestId),
  ]);
  return hasTypedAdminDelivery(events, files, deliveryStage);
}

function submissionKindFor(request) {
  return getReviewSubmissionRule(request?.offerKey)?.kind || null;
}

async function findSubmission(ctx, requestId, sequence) {
  return ctx.db
    .query("clientSubmissions")
    .withIndex("by_request_sequence", (query) => query.eq("requestId", requestId).eq("sequence", sequence))
    .first();
}

async function listSubmissions(ctx, requestId) {
  return (await ctx.db
    .query("clientSubmissions")
    .withIndex("by_request", (query) => query.eq("requestId", requestId))
    .collect())
    .sort((left, right) => left.sequence - right.sequence || left.createdAt - right.createdAt);
}

async function findCycle(ctx, requestId, cycleNumber) {
  return ctx.db
    .query("reviewCycles")
    .withIndex("by_request_cycle", (query) => query.eq("requestId", requestId).eq("cycleNumber", cycleNumber))
    .first();
}

async function listCycles(ctx, requestId) {
  return (await ctx.db
    .query("reviewCycles")
    .withIndex("by_request", (query) => query.eq("requestId", requestId))
    .collect())
    .sort((left, right) => left.cycleNumber - right.cycleNumber || left.createdAt - right.createdAt);
}

async function findDraftForCycle(ctx, requestId, cycleNumber = 1, sourceFileId = null) {
  const byCycle = await ctx.db
    .query("reviewDrafts")
    .withIndex("by_request_cycle", (query) => query.eq("requestId", requestId).eq("cycleNumber", cycleNumber))
    .collect();
  const selected = sourceFileId ? byCycle.find((draft) => draft.sourceFileId === sourceFileId) : byCycle[0];
  if (selected) return selected;
  // Rows created before cycle-aware submissions were introduced remain valid
  // as cycle 1 and are intentionally never rewritten during a read.
  if (cycleNumber === 1) {
    const legacy = await ctx.db
      .query("reviewDrafts")
      .withIndex("by_request", (query) => query.eq("requestId", requestId))
      .collect();
    return sourceFileId ? legacy.find((draft) => draft.sourceFileId === sourceFileId) || null : legacy[0] || null;
  }
  return null;
}

async function ensureInitialSubmissionRecord(ctx, request, { sourceFileId } = {}) {
  const existing = await findSubmission(ctx, request._id, 1);
  if (existing) return existing;
  const rule = assertPaidSubmissionRequest(request);
  // The paid project questionnaire is reference material only. Its video
  // remains in clientRequestFiles with kind=video until the client explicitly
  // uploads the first post-preparation version, which is kind=submission.
  if (rule.kind === "animation") return null;
  const files = await getActiveFiles(ctx, request._id);
  const sourceFiles = rule.acceptsVideo ? files.filter((file) => isVideoMimeType(file.mimeType)) : [];
  if (sourceFileId && !sourceFiles.some((file) => file._id === sourceFileId)) {
    reviewError("NOT_FOUND", "The selected animation source is not attached to this dossier");
  }
  if (rule.kind === "feedback" && !sourceFiles.length) {
    reviewError("NOT_FOUND", "No active animation video is attached to this dossier");
  }
  if (sourceFiles.length > rule.maxSourceFiles) {
    reviewError("LIMIT_REACHED", "This offer includes no more animation source files");
  }
  if (rule.kind === "feedback") {
    let answers;
    try {
      answers = parseClientRequestAnswers(request.offerKey, request.answersJson);
    } catch {
      reviewError("INVALID_STATE", "The paid feedback brief is invalid");
    }
    if (answers.plans.length !== sourceFiles.length) {
      reviewError("INVALID_STATE", "The paid feedback source list does not match its brief");
    }
  }
  if (rule.kind === "animation" && !sourceFiles.length) return null;
  const now = Date.now();
  const submissionId = await ctx.db.insert("clientSubmissions", {
    requestId: request._id,
    clerkUserId: request.clerkUserId,
    tokenIdentifier: request.tokenIdentifier,
    offerKey: request.offerKey,
    kind: rule.kind,
    sequence: 1,
    status: "submitted",
    payloadJson: request.answersJson || "{}",
    sourceFileIds: sourceFiles.map((file) => file._id),
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  const submission = (await ctx.db.get(submissionId)) || {
    _id: submissionId,
    requestId: request._id,
    kind: rule.kind,
    sequence: 1,
    sourceFileIds: sourceFiles.map((file) => file._id),
  };
  await ctx.db.insert("reviewCycles", {
    requestId: request._id,
    submissionId,
    offerKey: request.offerKey,
    kind: rule.kind,
    cycleNumber: 1,
    status: "submitted",
    ...(sourceFiles[0] ? { sourceFileId: sourceFiles[0]._id } : {}),
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  return submission;
}

async function ensureCycleForSubmission(ctx, request, submission, cycleNumber, { status = "submitted", sourceFileId } = {}) {
  const existing = await findCycle(ctx, request._id, cycleNumber);
  if (existing) return existing;
  const now = Date.now();
  const cycleId = await ctx.db.insert("reviewCycles", {
    requestId: request._id,
    submissionId: submission._id,
    offerKey: request.offerKey,
    kind: submission.kind,
    cycleNumber,
    status,
    ...(sourceFileId ? { sourceFileId } : {}),
    ...(status === "submitted" ? { submittedAt: now } : {}),
    createdAt: now,
    updatedAt: now,
  });
  return ctx.db.get(cycleId);
}

async function getSourceForSubmission(ctx, request, submission, requestedFileId = null, { allowPublished = false } = {}) {
  const files = await getActiveFiles(ctx, request._id);
  const sourceFileIds = Array.isArray(submission?.sourceFileIds) ? submission.sourceFileIds : [];
  if (request.offerKey === "projet-animation" && !sourceFileIds.length && !allowPublished) {
    reviewError("SUBMISSION_REQUIRED", "The client version has not been finalized");
  }
  const sourceId = requestedFileId || sourceFileIds[0];
  if (requestedFileId && sourceFileIds.length && !sourceFileIds.includes(requestedFileId)) {
    reviewError("FORBIDDEN", "The selected video is not part of this submission");
  }
  const source = sourceId ? files.find((file) => file._id === sourceId) : files.find((file) => isVideoFile(file));
  if (!source || !isVideoFile(source)) reviewError("NOT_FOUND", "No active animation video is attached to this submission");
  return source;
}

async function isFeedbackCycleComplete(ctx, request, cycle, submission) {
  if (cycle?.kind !== "feedback") return true;
  const sourceIds = submission?.sourceFileIds || [];
  if (!sourceIds.length) return false;
  for (const sourceFileId of sourceIds) {
    const draft = await getDraft(ctx, request._id, cycle.cycleNumber, sourceFileId);
    if (!draft?.publishedSnapshotId || draft.status !== "published") return false;
  }
  return true;
}

async function resolveSourceFile(ctx, request, requestedFileId = null, draft = null) {
  const files = await getActiveFiles(ctx, request._id);
  const fixedId = draft?.sourceFileId || requestedFileId;
  const source = fixedId
    ? files.find((file) => file._id === fixedId)
    : files.find(isVideoFile);
  if (!source || !isVideoFile(source)) {
    reviewError("NOT_FOUND", "No active animation video is attached to this dossier");
  }
  return source;
}

async function getDraft(ctx, requestId, cycleNumber = 1, sourceFileId = null) {
  return findDraftForCycle(ctx, requestId, cycleNumber, sourceFileId);
}

function parseStoredArray(value, field) {
  try {
    return parseReviewArray(value, field);
  } catch {
    reviewError("INVALID_STATE", "The saved review is corrupted");
  }
}

function safePayload(record) {
  return {
    strokes: parseStoredArray(record.strokesJson, "strokes"),
    textBoxes: parseStoredArray(record.textBoxesJson, "text boxes"),
    comments: parseStoredArray(record.commentsJson, "comments"),
    fps: record.fps,
    duration: record.duration,
    ...(record.videoWidth === undefined ? {} : { videoWidth: record.videoWidth, videoHeight: record.videoHeight }),
  };
}

function reviewVideoUrl(requestId, cycleNumber = 1, sourceFileId = null) {
  const params = new URLSearchParams();
  if (cycleNumber > 1) params.set("cycle", String(cycleNumber));
  if (sourceFileId) params.set("file", String(sourceFileId));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return `/api/review-media/${encodeURIComponent(requestId)}/video${suffix}`;
}

function safeSource(file) {
  return {
    id: file._id,
    name: file.name,
    mimeType: file.mimeType,
    size: file.size,
    kind: file.kind,
  };
}

function safeDraft(request, draft, source, cycle = null, submission = null) {
  const cycleNumber = draft?.cycleNumber || cycle?.cycleNumber || 1;
  const sourceFileId = draft?.sourceFileId || cycle?.sourceFileId || source?._id || null;
  return {
    id: draft?._id || null,
    requestId: request._id,
    cycleNumber,
    submissionId: draft?.submissionId || cycle?.submissionId || submission?._id || null,
    cycleStatus: cycle?.status || (draft?.status === "published" ? "published" : "draft"),
    status: draft?.status || "draft",
    revision: draft?.revision ?? 0,
    source: safeSource(source),
    videoUrl: reviewVideoUrl(request._id, cycleNumber, sourceFileId),
    ...(draft ? safePayload(draft) : {
      strokes: [],
      textBoxes: [],
      comments: [],
      fps: REVIEW_FPS[0],
      duration: 0,
    }),
    updatedAt: draft?.updatedAt || null,
    publishedAt: draft?.publishedAt || null,
  };
}

function safeSnapshot(request, snapshot) {
  const cycleNumber = snapshot.cycleNumber || 1;
  return {
    id: snapshot._id,
    requestId: request._id,
    cycleNumber,
    submissionId: snapshot.submissionId || null,
    status: "published",
    revision: snapshot.revision,
    source: {
      id: snapshot.sourceFileId,
      name: snapshot.sourceName,
      mimeType: snapshot.sourceMimeType,
      size: snapshot.sourceSize,
    },
    videoUrl: reviewVideoUrl(request._id, cycleNumber, snapshot.sourceFileId),
    ...safePayload(snapshot),
    publishedAt: snapshot.publishedAt,
  };
}

function saveArgsToPayload(args) {
  return normalizeReviewPayload({
    strokes: parseReviewArray(args.strokesJson, "strokes"),
    textBoxes: parseReviewArray(args.textBoxesJson, "text boxes"),
    comments: parseReviewArray(args.commentsJson, "comments"),
    fps: args.fps,
    duration: args.duration,
    videoWidth: args.videoWidth,
    videoHeight: args.videoHeight,
  });
}

function draftPayload(draft) {
  return normalizeReviewPayload({
    strokes: parseStoredArray(draft.strokesJson, "strokes"),
    textBoxes: parseStoredArray(draft.textBoxesJson, "text boxes"),
    comments: parseStoredArray(draft.commentsJson, "comments"),
    fps: draft.fps,
    duration: draft.duration,
    videoWidth: draft.videoWidth,
    videoHeight: draft.videoHeight,
  });
}

async function loadAdminReview(ctx, args) {
  await requireAdmin(ctx);
  const request = await getRequest(ctx, args.requestId);
  assertPaidReviewRequest(request);
  const cycleNumber = args.cycleNumber || 1;
  const cycle = await findCycle(ctx, request._id, cycleNumber);
  const submission = cycle?.submissionId
    ? await ctx.db.get(cycle.submissionId)
    : await findSubmission(ctx, request._id, cycleNumber);
  const draft = await getDraft(ctx, request._id, cycleNumber, args.sourceFileId || null);
  const source = submission
    ? await getSourceForSubmission(ctx, request, submission, draft?.sourceFileId || args.sourceFileId || cycle?.sourceFileId || null, { allowPublished: isPublishedReviewState(draft, cycle) })
    : await resolveSourceFile(ctx, request, args.sourceFileId || null, draft);
  assertAnimationSubmissionSource(request, cycleNumber, submission, source, draft, cycle);
  if (draft && draft.sourceFileId !== source._id) {
    reviewError("INVALID_STATE", "The review source video cannot be changed");
  }
  return safeDraft(request, draft, source, cycle, submission);
}

export const getAdminReview = queryGeneric({
  args: {
    requestId: v.id("clientRequests"),
    sourceFileId: v.optional(v.id("clientRequestFiles")),
    cycleNumber: v.optional(v.number()),
  },
  handler: loadAdminReview,
});

export const ensureReview = mutationGeneric({
  args: {
    requestId: v.id("clientRequests"),
    sourceFileId: v.optional(v.id("clientRequestFiles")),
    cycleNumber: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const request = await getRequest(ctx, args.requestId);
    assertPaidReviewRequest(request);
    const rule = getReviewSubmissionRule(request.offerKey);
    const cycleNumber = args.cycleNumber || 1;
    if (!rule || cycleNumber < 1 || cycleNumber > rule.maxCycles) {
      reviewError("LIMIT_REACHED", "This offer does not include another review cycle");
    }
    if (request.offerKey === "projet-animation" && cycleNumber === 1 && !(await hasPreparationDelivery(ctx, request._id, "preparation"))) {
      reviewError("PREPARATION_REQUIRED", "The project preparation document must be delivered before the first review");
    }
    const existing = await getDraft(ctx, request._id, cycleNumber, args.sourceFileId || null);
    let submission = await findSubmission(ctx, request._id, cycleNumber);
    if (cycleNumber === 1 && !submission) {
      submission = await ensureInitialSubmissionRecord(ctx, request, { sourceFileId: args.sourceFileId || null });
    }
    if (cycleNumber > 1) {
      const previous = await findCycle(ctx, request._id, cycleNumber - 1);
      if (previous?.status !== "published") {
        reviewError("PREVIOUS_REVIEW_REQUIRED", "The previous review must be published before this cycle");
      }
      if (!submission) reviewError("SUBMISSION_REQUIRED", "The corrected version has not been submitted");
    }
    const existingCycle = await findCycle(ctx, request._id, cycleNumber);
    const source = submission
      ? await getSourceForSubmission(ctx, request, submission, existing?.sourceFileId || args.sourceFileId || null, { allowPublished: isPublishedReviewState(existing, existingCycle) })
      : await resolveSourceFile(ctx, request, args.sourceFileId || null, existing);
    assertAnimationSubmissionSource(request, cycleNumber, submission, source, existing, existingCycle);
    if (existing) {
      if (existing.sourceFileId !== source._id) reviewError("INVALID_STATE", "The review source video cannot be changed");
      return safeDraft(request, existing, source, existingCycle, submission);
    }
    const now = Date.now();
    let cycle = submission
      ? await ensureCycleForSubmission(ctx, request, submission, cycleNumber, { status: "in_review", sourceFileId: source._id })
      : null;
    if (cycle?.status !== "in_review") {
      await ctx.db.patch(cycle._id, { status: "in_review", updatedAt: now });
      cycle = (await ctx.db.get(cycle._id)) || { ...cycle, status: "in_review", updatedAt: now };
    }
    const draftId = await ctx.db.insert("reviewDrafts", {
      requestId: request._id,
      sourceFileId: source._id,
      sourceStorageId: source.storageId,
      sourceName: source.name,
      sourceMimeType: source.mimeType,
      sourceSize: source.size,
      revision: 0,
      strokesJson: "[]",
      textBoxesJson: "[]",
      commentsJson: "[]",
      fps: REVIEW_FPS[0],
      duration: 0,
      status: "draft",
      cycleNumber,
      ...(submission ? { submissionId: submission._id } : {}),
      createdAt: now,
      updatedAt: now,
    });
    const draft = await ctx.db.get(draftId);
    if (cycle) {
      await ctx.db.patch(cycle._id, { reviewDraftId: draftId, updatedAt: now });
      cycle = (await ctx.db.get(cycle._id)) || { ...cycle, reviewDraftId: draftId, updatedAt: now };
    }
    return safeDraft(request, draft, source, cycle, submission);
  },
});

export const saveReview = mutationGeneric({
  args: {
    requestId: v.id("clientRequests"),
    expectedRevision: v.number(),
    strokesJson: v.string(),
    textBoxesJson: v.string(),
    commentsJson: v.string(),
    fps: v.number(),
    duration: v.number(),
    videoWidth: v.optional(v.number()),
    videoHeight: v.optional(v.number()),
    cycleNumber: v.optional(v.number()),
    sourceFileId: v.optional(v.id("clientRequestFiles")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const request = await getRequest(ctx, args.requestId);
    assertPaidReviewRequest(request);
    const cycleNumber = args.cycleNumber || 1;
    const draft = await getDraft(ctx, request._id, cycleNumber, args.sourceFileId || null);
    if (!draft) reviewError("NOT_FOUND", "Review draft not initialized");
    if (draft.status !== "draft") reviewError("PUBLISHED", "A published review is immutable");
    const cycle = await findCycle(ctx, request._id, cycleNumber);
    const submission = cycle?.submissionId ? await ctx.db.get(cycle.submissionId) : await findSubmission(ctx, request._id, cycleNumber);
    const source = submission
      ? await getSourceForSubmission(ctx, request, submission, draft.sourceFileId, { allowPublished: isPublishedReviewState(draft, cycle) })
      : await resolveSourceFile(ctx, request, null, draft);
    assertAnimationSubmissionSource(request, cycleNumber, submission, source, draft, cycle);
    if (draft.revision !== args.expectedRevision) {
      return {
        ok: false,
        conflict: true,
        current: safeDraft(request, draft, source, cycle, submission),
      };
    }
    const payload = saveArgsToPayload(args);
    const nextRevision = draft.revision + 1;
    const now = Date.now();
    await ctx.db.patch(draft._id, {
      revision: nextRevision,
      strokesJson: payload.strokesJson,
      textBoxesJson: payload.textBoxesJson,
      commentsJson: payload.commentsJson,
      fps: payload.fps,
      duration: payload.duration,
      ...(payload.videoWidth === undefined ? {} : { videoWidth: payload.videoWidth, videoHeight: payload.videoHeight }),
      updatedAt: now,
    });
    return {
      ok: true,
      conflict: false,
      revision: nextRevision,
      updatedAt: now,
    };
  },
});

export const publishReview = mutationGeneric({
  args: {
    requestId: v.id("clientRequests"),
    expectedRevision: v.number(),
    cycleNumber: v.optional(v.number()),
    sourceFileId: v.optional(v.id("clientRequestFiles")),
  },
  handler: async (ctx, args) => {
    const current = await requireAdmin(ctx);
    const request = await getRequest(ctx, args.requestId);
    assertPaidReviewRequest(request);
    const cycleNumber = args.cycleNumber || 1;
    const draft = await getDraft(ctx, request._id, cycleNumber, args.sourceFileId || null);
    if (!draft) reviewError("NOT_FOUND", "Review draft not initialized");
    const cycle = await findCycle(ctx, request._id, cycleNumber);
    const submission = cycle?.submissionId ? await ctx.db.get(cycle.submissionId) : await findSubmission(ctx, request._id, cycleNumber);
    const source = submission
      ? await getSourceForSubmission(ctx, request, submission, draft.sourceFileId, { allowPublished: isPublishedReviewState(draft, cycle) })
      : await resolveSourceFile(ctx, request, null, draft);
    assertAnimationSubmissionSource(request, cycleNumber, submission, source, draft, cycle);
    if (draft.status === "published") {
      const snapshot = draft.publishedSnapshotId ? await ctx.db.get(draft.publishedSnapshotId) : null;
      if (!snapshot) reviewError("INVALID_STATE", "Published review snapshot is missing");
      return { ok: true, conflict: false, snapshot: safeSnapshot(request, snapshot) };
    }
    if (draft.revision !== args.expectedRevision) {
      return { ok: false, conflict: true, current: safeDraft(request, draft, source, cycle, submission) };
    }
    const payload = draftPayload(draft);
    if (!payload.duration || payload.videoWidth === undefined || payload.videoHeight === undefined) {
      reviewError("INVALID_STATE", "Read the video metadata before publishing");
    }
    if (!payload.strokes.length && !payload.textBoxes.some((item) => item.text.trim()) && !payload.comments.length) {
      reviewError("INVALID_STATE", "Add at least one drawing, text or comment before publishing");
    }
    const publishedAt = Date.now();
    const snapshotId = await ctx.db.insert("reviewSnapshots", {
      draftId: draft._id,
      requestId: request._id,
      sourceFileId: draft.sourceFileId,
      sourceStorageId: draft.sourceStorageId,
      sourceName: draft.sourceName,
      sourceMimeType: draft.sourceMimeType,
      sourceSize: draft.sourceSize,
      revision: draft.revision,
      strokesJson: payload.strokesJson,
      textBoxesJson: payload.textBoxesJson,
      commentsJson: payload.commentsJson,
      fps: payload.fps,
      duration: payload.duration,
      videoWidth: payload.videoWidth,
      videoHeight: payload.videoHeight,
      publishedBy: current.clerkUserId,
      publishedAt,
      cycleNumber,
      ...(submission ? { submissionId: submission._id } : {}),
    });
    await ctx.db.patch(draft._id, {
      status: "published",
      publishedSnapshotId: snapshotId,
      updatedAt: publishedAt,
    });
    const cycleComplete = await isFeedbackCycleComplete(ctx, request, cycle, submission);
    if (cycle && cycleComplete) {
      await ctx.db.patch(cycle._id, {
        status: "published",
        reviewSnapshotId: snapshotId,
        publishedBy: current.clerkUserId,
        publishedAt,
        updatedAt: publishedAt,
      });
    }
    if (submission && cycleComplete) {
      await ctx.db.patch(submission._id, {
        status: "published",
        reviewedAt: publishedAt,
        updatedAt: publishedAt,
      });
    }
    if (cycleComplete) {
      await enqueueDeliveryNotification(ctx, {
        requestId: request._id,
        kind: "review",
        sourceId: cycle?._id || snapshotId,
        publishedAt,
      });
    }
    const snapshot = await ctx.db.get(snapshotId);
    return { ok: true, conflict: false, snapshot: safeSnapshot(request, snapshot) };
  },
});

export const getMyPublishedReview = queryGeneric({
  args: {
    requestId: v.id("clientRequests"),
    cycleNumber: v.optional(v.number()),
    sourceFileId: v.optional(v.id("clientRequestFiles")),
  },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx);
    const request = await getRequest(ctx, args.requestId);
    if (!isRequestOwner(request, current)) reviewError("FORBIDDEN", "Client request belongs to another account");
    assertPaidReviewRequest(request);
    const draft = await getDraft(ctx, request._id, args.cycleNumber || 1, args.sourceFileId || null);
    if (!draft || draft.status !== "published" || !draft.publishedSnapshotId) return null;
    const snapshot = await ctx.db.get(draft.publishedSnapshotId);
    if (!snapshot || snapshot.requestId !== request._id) return null;
    return safeSnapshot(request, snapshot);
  },
});

export const getMyPublishedReviews = queryGeneric({
  args: { requestId: v.id("clientRequests") },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx);
    const request = await getRequest(ctx, args.requestId);
    if (!isRequestOwner(request, current)) reviewError("FORBIDDEN", "Client request belongs to another account");
    assertPaidReviewRequest(request);
    const drafts = await ctx.db
      .query("reviewDrafts")
      .withIndex("by_request", (query) => query.eq("requestId", request._id))
      .collect();
    const published = [];
    for (const draft of drafts) {
      if (draft.status !== "published" || !draft.publishedSnapshotId) continue;
      const snapshot = await ctx.db.get(draft.publishedSnapshotId);
      if (snapshot && snapshot.requestId === request._id) published.push(safeSnapshot(request, snapshot));
    }
    return published.sort((left, right) => left.cycleNumber - right.cycleNumber);
  },
});

export const getReviewVideoDownload = queryGeneric({
  args: {
    requestId: v.id("clientRequests"),
    serverSecret: v.string(),
    cycleNumber: v.optional(v.number()),
    sourceFileId: v.optional(v.id("clientRequestFiles")),
  },
  handler: async (ctx, args) => {
    requireServerProxy(args);
    const current = await requireIdentity(ctx);
    const request = await getRequest(ctx, args.requestId);
    assertPaidReviewRequest(request);
    const profile = await findProfile(ctx, current.tokenIdentifier);
    const admin = profile?.role === "admin";
    const cycleNumber = args.cycleNumber || 1;
    const draft = await getDraft(ctx, request._id, cycleNumber, args.sourceFileId || null);
    const cycle = await findCycle(ctx, request._id, cycleNumber);
    let source;
    if (admin) {
      const submission = cycle?.submissionId ? await ctx.db.get(cycle.submissionId) : await findSubmission(ctx, request._id, cycleNumber);
      source = submission
        ? await getSourceForSubmission(ctx, request, submission, args.sourceFileId || draft?.sourceFileId || cycle?.sourceFileId || null, { allowPublished: isPublishedReviewState(draft, cycle) })
        : await resolveSourceFile(ctx, request, args.sourceFileId || null, draft);
      assertAnimationSubmissionSource(request, cycleNumber, submission, source, draft, cycle);
      if (draft?.status === "published" && draft.publishedSnapshotId) {
        const snapshot = await ctx.db.get(draft.publishedSnapshotId);
        source = snapshot
          ? { storageId: snapshot.sourceStorageId, name: snapshot.sourceName, mimeType: snapshot.sourceMimeType, size: snapshot.sourceSize }
          : source;
      }
    } else {
      if (!isRequestOwner(request, current)) reviewError("FORBIDDEN", "Client request belongs to another account");
      if (!draft || draft.status !== "published" || !draft.publishedSnapshotId) {
        reviewError("FORBIDDEN", "The review has not been published");
      }
      const snapshot = await ctx.db.get(draft.publishedSnapshotId);
      if (!snapshot) reviewError("NOT_FOUND", "Published review not found");
      source = {
        storageId: snapshot.sourceStorageId,
        name: snapshot.sourceName,
        mimeType: snapshot.sourceMimeType,
        size: snapshot.sourceSize,
      };
    }
    const url = await ctx.storage.getUrl(source.storageId);
    if (!url) reviewError("NOT_FOUND", "Video is no longer available");
    return {
      url,
      name: source.name,
      mimeType: source.mimeType,
      size: source.size,
    };
  },
});

function safeSubmissionPayload(submission) {
  const payload = (() => {
    try { return parseSubmissionPayload(submission.payloadJson); } catch { return {}; }
  })();
  if (submission.kind === "book") {
    return {
      workLink: typeof payload.workLink === "string" ? payload.workLink : "",
      passwordProvided: Boolean(payload.password),
    };
  }
  return {
    ...(Number.isFinite(Number(payload.duration)) ? { duration: Number(payload.duration) } : {}),
    ...(Number.isFinite(Number(payload.fps)) ? { fps: Number(payload.fps) } : {}),
    ...(Number.isSafeInteger(Number(payload.videoWidth)) ? { videoWidth: Number(payload.videoWidth) } : {}),
    ...(Number.isSafeInteger(Number(payload.videoHeight)) ? { videoHeight: Number(payload.videoHeight) } : {}),
  };
}

async function safeSubmission(ctx, submission, { includeBookSecrets = false } = {}) {
  const files = [];
  for (const fileId of submission.sourceFileIds || []) {
    const file = await ctx.db.get(fileId);
    if (!file || file.status !== "active" || file.requestId !== submission.requestId) continue;
    files.push({
      id: file._id,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
      kind: file.kind,
      createdAt: file.createdAt,
    });
  }
  const safePayload = safeSubmissionPayload(submission);
  if (includeBookSecrets && submission.kind === "book") {
    const payload = parseSubmissionPayload(submission.payloadJson);
    safePayload.password = typeof payload.password === "string" ? payload.password : "";
    safePayload.workLink = typeof payload.workLink === "string" ? payload.workLink : "";
  }
  return {
    id: submission._id,
    requestId: submission.requestId,
    offerKey: submission.offerKey,
    kind: submission.kind,
    sequence: submission.sequence,
    status: submission.status,
    payload: safePayload,
    files,
    submittedAt: submission.submittedAt || null,
    reviewedAt: submission.reviewedAt || null,
    createdAt: submission.createdAt,
    updatedAt: submission.updatedAt,
  };
}

function safeCycle(cycle, notes) {
  return {
    id: cycle._id,
    requestId: cycle.requestId,
    submissionId: cycle.submissionId,
    offerKey: cycle.offerKey,
    kind: cycle.kind,
    cycleNumber: cycle.cycleNumber,
    status: cycle.status,
    sourceFileId: cycle.sourceFileId || null,
    reviewDraftId: cycle.reviewDraftId || null,
    reviewSnapshotId: cycle.reviewSnapshotId || null,
    ...(notes ? { notes } : {}),
    submittedAt: cycle.submittedAt || null,
    publishedAt: cycle.publishedAt || null,
    updatedAt: cycle.updatedAt,
  };
}

async function buildReviewProgress(ctx, request, { includeBookSecrets = false } = {}) {
  const rule = assertPaidSubmissionRequest(request);
  const [submissions, cycles, events, files] = await Promise.all([
    listSubmissions(ctx, request._id),
    listCycles(ctx, request._id),
    getRequestEvents(ctx, request._id),
    getActiveFiles(ctx, request._id),
  ]);
  const safeSubmissions = await Promise.all(submissions.map((submission) => safeSubmission(ctx, submission, { includeBookSecrets })));
  const safeCycles = cycles.map((cycle) => {
    let notes = null;
    if (cycle.notesJson) {
      try { notes = parseSubmissionPayload(cycle.notesJson, "book review notes"); } catch { notes = null; }
    }
    return safeCycle(cycle, notes);
  });
  const deliveryStage = rule.kind === "animation" ? "preparation" : rule.kind === "book" ? "book_guide" : null;
  const delivered = deliveryStage ? hasTypedAdminDelivery(events, files, deliveryStage) : hasAdminDelivery(events, files);
  const first = cycles.find((cycle) => cycle.cycleNumber === 1);
  const second = cycles.find((cycle) => cycle.cycleNumber === 2);
  const firstPublished = first?.status === "published";
  const firstSubmission = submissions.find((submission) => submission.sequence === 1);
  const canSubmit = rule.kind === "animation"
    ? delivered && (!firstSubmission || firstSubmission.status === "draft" || (firstPublished && !second && !submissions.some((submission) => submission.sequence >= 2 && submission.status !== "closed")))
    : rule.kind === "book"
      ? delivered && !submissions.some((submission) => submission.sequence >= 2 && submission.status !== "closed")
      : false;
  const nextSequence = submissions.find((submission) => submission.sequence === 2)?.sequence
    || (!firstSubmission || firstSubmission.status === "draft" ? (canSubmit ? 1 : null) : (canSubmit ? 2 : null));
  return {
    requestId: request._id,
    offerKey: request.offerKey,
    kind: rule.kind,
    maxSubmissions: rule.maxSubmissions,
    maxCycles: rule.maxCycles,
    maxSourceFiles: rule.maxSourceFiles,
    preparation: {
      required: rule.kind === "animation",
      delivered,
    },
    submissions: safeSubmissions,
    cycles: safeCycles,
    canSubmit,
    nextSequence,
  };
}

export const ensureInitialSubmission = mutationGeneric({
  args: {
    requestId: v.id("clientRequests"),
    sourceFileId: v.optional(v.id("clientRequestFiles")),
  },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx);
    const request = await getRequest(ctx, args.requestId);
    if (!isRequestOwner(request, current)) reviewError("FORBIDDEN", "Client request belongs to another account");
    await ensureInitialSubmissionRecord(ctx, request, { sourceFileId: args.sourceFileId || null });
    return buildReviewProgress(ctx, request);
  },
});

export const getMyReviewProgress = queryGeneric({
  args: { requestId: v.id("clientRequests") },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx);
    const request = await getRequest(ctx, args.requestId);
    if (!isRequestOwner(request, current)) reviewError("FORBIDDEN", "Client request belongs to another account");
    return buildReviewProgress(ctx, request);
  },
});

export const getAdminReviewProgress = queryGeneric({
  args: { requestId: v.id("clientRequests") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const request = await getRequest(ctx, args.requestId);
    return buildReviewProgress(ctx, request, { includeBookSecrets: true });
  },
});

async function getOrCreateSecondSubmission(ctx, request) {
  const rule = assertPaidSubmissionRequest(request);
  if (rule.maxSubmissions < 2) reviewError("LIMIT_REACHED", "This offer includes one review only");
  await ensureInitialSubmissionRecord(ctx, request);
  const existing = await findSubmission(ctx, request._id, 2);
  if (existing) return existing;
  const firstCycle = await findCycle(ctx, request._id, 1);
  if (rule.kind === "animation" && firstCycle?.status !== "published") {
    reviewError("PREVIOUS_REVIEW_REQUIRED", "The first animation review must be published before a corrected version");
  }
  if (rule.kind === "book" && !(await hasPreparationDelivery(ctx, request._id, "book_guide"))) {
    reviewError("FIRST_DELIVERY_REQUIRED", "The first book guide must be delivered before its second reading");
  }
  const now = Date.now();
  const submissionId = await ctx.db.insert("clientSubmissions", {
    requestId: request._id,
    clerkUserId: request.clerkUserId,
    tokenIdentifier: request.tokenIdentifier,
    offerKey: request.offerKey,
    kind: rule.kind,
    sequence: 2,
    status: "draft",
    payloadJson: "{}",
    sourceFileIds: [],
    createdAt: now,
    updatedAt: now,
  });
  const submission = (await ctx.db.get(submissionId)) || {
    _id: submissionId,
    requestId: request._id,
    offerKey: request.offerKey,
    kind: rule.kind,
    sequence: 2,
    status: "draft",
    sourceFileIds: [],
    payloadJson: "{}",
    createdAt: now,
    updatedAt: now,
  };
  await ensureCycleForSubmission(ctx, request, submission, 2, { status: "draft" });
  return submission;
}

async function getOrCreateFirstAnimationDraft(ctx, request) {
  const rule = assertPaidSubmissionRequest(request, { allowBook: false });
  if (rule.kind !== "animation") reviewError("INVALID_STATE", "This offer does not accept an animation submission");
  const existing = await findSubmission(ctx, request._id, 1);
  if (existing) return existing;
  if (!(await hasPreparationDelivery(ctx, request._id, "preparation"))) {
    reviewError("PREPARATION_REQUIRED", "The project preparation document must be delivered before the first submission");
  }
  const now = Date.now();
  const submissionId = await ctx.db.insert("clientSubmissions", {
    requestId: request._id,
    clerkUserId: request.clerkUserId,
    tokenIdentifier: request.tokenIdentifier,
    offerKey: request.offerKey,
    kind: rule.kind,
    sequence: 1,
    status: "draft",
    payloadJson: "{}",
    sourceFileIds: [],
    createdAt: now,
    updatedAt: now,
  });
  const submission = (await ctx.db.get(submissionId)) || {
    _id: submissionId,
    requestId: request._id,
    offerKey: request.offerKey,
    kind: rule.kind,
    sequence: 1,
    status: "draft",
    payloadJson: "{}",
    sourceFileIds: [],
    createdAt: now,
    updatedAt: now,
  };
  await ensureCycleForSubmission(ctx, request, submission, 1, { status: "draft" });
  return submission;
}

function assertUploadKey(value) {
  if (typeof value !== "string" || value.trim().length < 16 || value.trim().length > 240) {
    reviewError("INVALID_INPUT", "Invalid submission upload key");
  }
  return value.trim();
}

async function getSubmissionUpload(ctx, uploadKey) {
  return ctx.db
    .query("clientSubmissionUploads")
    .withIndex("by_upload_key", (query) => query.eq("uploadKey", uploadKey))
    .first();
}

export const prepareSubmissionUpload = mutationGeneric({
  args: {
    requestId: v.id("clientRequests"),
    sequence: v.optional(v.number()),
    uploadKey: v.string(),
    name: v.string(),
    mimeType: v.string(),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx);
    const request = await getRequest(ctx, args.requestId);
    if (!isRequestOwner(request, current)) reviewError("FORBIDDEN", "Client request belongs to another account");
    const rule = assertPaidSubmissionRequest(request, { allowBook: false });
    if (rule.kind !== "animation") reviewError("LIMIT_REACHED", "This offer includes no additional video submission");
    const sequence = args.sequence || 2;
    if (sequence < 1 || sequence > rule.maxSubmissions) reviewError("LIMIT_REACHED", "This offer does not include another video submission");
    const submission = sequence === 1
      ? await getOrCreateFirstAnimationDraft(ctx, request)
      : await getOrCreateSecondSubmission(ctx, request);
    if (submission.status !== "draft") reviewError("LIMIT_REACHED", "This version has already been submitted");
    const uploadKey = assertUploadKey(args.uploadKey);
    const existing = await getSubmissionUpload(ctx, uploadKey);
    if (existing) {
      if (existing.requestId !== request._id || existing.submissionId !== submission._id || existing.clerkUserId !== current.clerkUserId) {
        reviewError("FORBIDDEN", "Submission upload belongs to another account");
      }
      if (existing.status === "pending" && existing.expiresAt > Date.now()) {
        return { uploadUrl: existing.uploadUrl, uploadKey, expiresAt: existing.expiresAt, submissionId: submission._id };
      }
      reviewError("RETRY_REQUIRED", "This submission upload has expired");
    }
    const normalized = normalizeAnimationSubmission({
      name: args.name,
      mimeType: args.mimeType,
      size: args.size,
      duration: 1,
      fps: 24,
      videoWidth: 1,
      videoHeight: 1,
    });
    const uploadUrl = await ctx.storage.generateUploadUrl();
    const now = Date.now();
    const expiresAt = now + SUBMISSION_UPLOAD_TTL_MS;
    await ctx.db.insert("clientSubmissionUploads", {
      requestId: request._id,
      submissionId: submission._id,
      clerkUserId: current.clerkUserId,
      tokenIdentifier: current.tokenIdentifier,
      uploadKey,
      uploadUrl,
      name: normalized.name,
      mimeType: normalized.mimeType,
      expectedSize: normalized.size,
      status: "pending",
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });
    return { uploadUrl, uploadKey, expiresAt, submissionId: submission._id };
  },
});

export const finalizeSubmission = mutationGeneric({
  args: {
    requestId: v.id("clientRequests"),
    submissionId: v.id("clientSubmissions"),
    uploadKey: v.string(),
    storageId: v.id("_storage"),
    payloadJson: v.string(),
  },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx);
    const request = await getRequest(ctx, args.requestId);
    if (!isRequestOwner(request, current)) reviewError("FORBIDDEN", "Client request belongs to another account");
    const rule = assertPaidSubmissionRequest(request, { allowBook: false });
    if (rule.kind !== "animation") reviewError("INVALID_STATE", "This offer does not accept video submissions");
    const submission = await ctx.db.get(args.submissionId);
    if (!submission || submission.requestId !== request._id || ![1, 2].includes(submission.sequence)) reviewError("NOT_FOUND", "Submission not found");
    if (submission.clerkUserId !== current.clerkUserId || submission.tokenIdentifier !== current.tokenIdentifier) reviewError("FORBIDDEN", "Submission belongs to another account");
    const upload = await getSubmissionUpload(ctx, assertUploadKey(args.uploadKey));
    if (!upload || upload.requestId !== request._id || upload.submissionId !== submission._id) reviewError("NOT_FOUND", "Submission upload reservation not found");
    if (upload.clerkUserId !== current.clerkUserId || upload.tokenIdentifier !== current.tokenIdentifier) reviewError("FORBIDDEN", "Submission upload belongs to another account");
    if (upload.status === "finalized") {
      if (upload.storageId !== args.storageId) reviewError("IDEMPOTENCY_MISMATCH", "Submission upload was finalized with another file");
      return { ok: true, duplicate: true, submission: await safeSubmission(ctx, submission) };
    }
    if (submission.status !== "draft") reviewError("LIMIT_REACHED", "This version has already been submitted");
    if (upload.status !== "pending" || upload.expiresAt <= Date.now()) reviewError("RETRY_REQUIRED", "Submission upload has expired");
    if (upload.storageId && upload.storageId !== args.storageId) reviewError("IDEMPOTENCY_MISMATCH", "Submission storage does not match");
    const existingFile = await ctx.db.query("clientRequestFiles").withIndex("by_storage_id", (query) => query.eq("storageId", args.storageId)).first();
    if (existingFile) reviewError("FORBIDDEN", "Storage file is already attached to a dossier");
    const existingUpload = await ctx.db.query("clientSubmissionUploads").withIndex("by_storage_id", (query) => query.eq("storageId", args.storageId)).first();
    if (existingUpload && existingUpload._id !== upload._id) reviewError("FORBIDDEN", "Storage upload belongs to another submission");
    const metadata = await ctx.storage.getMetadata(args.storageId);
    const actualSize = Number(metadata?.size);
    const actualMimeType = typeof metadata?.contentType === "string" && metadata.contentType ? metadata.contentType.toLowerCase() : upload.mimeType;
    const payload = parseSubmissionPayload(args.payloadJson);
    let normalized;
    try {
      normalized = normalizeAnimationSubmission({
        name: upload.name,
        mimeType: actualMimeType,
        size: actualSize,
        duration: payload.duration,
        fps: payload.fps,
        videoWidth: payload.videoWidth,
        videoHeight: payload.videoHeight,
      });
    } catch (error) {
      await ctx.storage.delete(args.storageId).catch(() => {});
      await ctx.db.patch(upload._id, { status: "rejected", storageId: args.storageId, rejectionReason: String(error?.message || "invalid_submission").slice(0, 200), updatedAt: Date.now() });
      throw error;
    }
    if (actualSize !== upload.expectedSize) {
      await ctx.storage.delete(args.storageId).catch(() => {});
      await ctx.db.patch(upload._id, {
        status: "rejected",
        storageId: args.storageId,
        rejectionReason: "uploaded_size_changed",
        updatedAt: Date.now(),
      });
      reviewError("INVALID_INPUT", "Uploaded submission size changed");
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
      kind: "submission",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(upload._id, { status: "finalized", storageId: args.storageId, fileId, updatedAt: now });
    await ctx.db.patch(submission._id, {
      status: "submitted",
      payloadJson: JSON.stringify(normalized),
      sourceFileIds: [fileId],
      submittedAt: now,
      updatedAt: now,
    });
    const cycle = await findCycle(ctx, request._id, submission.sequence);
    if (cycle) await ctx.db.patch(cycle._id, { status: "submitted", sourceFileId: fileId, submittedAt: now, updatedAt: now });
    await ctx.db.patch(request._id, { updatedAt: now });
    return { ok: true, duplicate: false, submission: await safeSubmission(ctx, { ...submission, _id: submission._id, status: "submitted", payloadJson: JSON.stringify(normalized), sourceFileIds: [fileId], submittedAt: now, updatedAt: now }) };
  },
});

export const abandonSubmissionUpload = mutationGeneric({
  args: {
    requestId: v.id("clientRequests"),
    uploadKey: v.string(),
    storageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx);
    const request = await getRequest(ctx, args.requestId);
    if (!isRequestOwner(request, current)) reviewError("FORBIDDEN", "Client request belongs to another account");
    const upload = await getSubmissionUpload(ctx, assertUploadKey(args.uploadKey));
    if (!upload || upload.requestId !== request._id) reviewError("NOT_FOUND", "Submission upload reservation not found");
    if (upload.clerkUserId !== current.clerkUserId || upload.tokenIdentifier !== current.tokenIdentifier) reviewError("FORBIDDEN", "Submission upload belongs to another account");
    if (upload.status === "finalized") return { ok: true, status: "finalized" };
    const cleanupStorageId = upload.storageId || args.storageId;
    if (cleanupStorageId) await ctx.storage.delete(cleanupStorageId).catch(() => {});
    await ctx.db.patch(upload._id, { status: "rejected", ...(cleanupStorageId ? { storageId: cleanupStorageId } : {}), rejectionReason: "abandoned", updatedAt: Date.now() });
    return { ok: true, status: "rejected" };
  },
});

export const submitBookRevision = mutationGeneric({
  args: {
    requestId: v.id("clientRequests"),
    workLink: v.string(),
    password: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx);
    const request = await getRequest(ctx, args.requestId);
    if (!isRequestOwner(request, current)) reviewError("FORBIDDEN", "Client request belongs to another account");
    const rule = assertPaidSubmissionRequest(request);
    if (rule.kind !== "book") reviewError("INVALID_STATE", "This dossier is not a book review");
    const existing = await findSubmission(ctx, request._id, 2);
    if (existing?.status === "submitted" || existing?.status === "in_review" || existing?.status === "published") {
      return { ok: true, duplicate: true, progress: await buildReviewProgress(ctx, request) };
    }
    const submission = existing || await getOrCreateSecondSubmission(ctx, request);
    const normalized = normalizeBookSubmission({ workLink: args.workLink, password: args.password || "" });
    const now = Date.now();
    await ctx.db.patch(submission._id, {
      status: "submitted",
      payloadJson: JSON.stringify(normalized),
      submittedAt: now,
      updatedAt: now,
    });
    const cycle = await findCycle(ctx, request._id, 2);
    if (cycle) await ctx.db.patch(cycle._id, { status: "submitted", submittedAt: now, updatedAt: now });
    await ctx.db.patch(request._id, { updatedAt: now });
    return { ok: true, duplicate: false, progress: await buildReviewProgress(ctx, request) };
  },
});

export const publishBookReview = mutationGeneric({
  args: {
    requestId: v.id("clientRequests"),
    summary: v.string(),
    priorities: v.string(),
    nextSteps: v.string(),
  },
  handler: async (ctx, args) => {
    const current = await requireAdmin(ctx);
    const request = await getRequest(ctx, args.requestId);
    const rule = assertPaidSubmissionRequest(request);
    if (rule.kind !== "book") reviewError("INVALID_STATE", "This dossier is not a book review");
    const cycle = await findCycle(ctx, request._id, 2);
    if (!cycle) reviewError("SUBMISSION_REQUIRED", "The second book version has not been submitted");
    if (cycle.status === "published") return { ok: true, duplicate: true, cycle: safeCycle(cycle, cycle.notesJson ? parseSubmissionPayload(cycle.notesJson) : null) };
    if (cycle.status !== "submitted" && cycle.status !== "in_review") reviewError("INVALID_STATE", "The second book version is not ready for review");
    const submission = await ctx.db.get(cycle.submissionId);
    if (!submission) reviewError("NOT_FOUND", "Book submission not found");
    const notes = normalizeBookReviewNotes(args);
    const now = Date.now();
    await ctx.db.patch(cycle._id, {
      status: "published",
      notesJson: JSON.stringify(notes),
      publishedBy: current.clerkUserId,
      publishedAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(submission._id, { status: "published", reviewedAt: now, updatedAt: now });
    await enqueueDeliveryNotification(ctx, { requestId: request._id, kind: "review", sourceId: cycle._id, publishedAt: now });
    return { ok: true, duplicate: false, cycle: safeCycle({ ...cycle, status: "published", notesJson: JSON.stringify(notes), publishedBy: current.clerkUserId, publishedAt: now, updatedAt: now }, notes) };
  },
});
