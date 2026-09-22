import { internalMutation } from "./_generated/server.js";
import { v } from "convex/values";

function refuse(code, message) {
  throw new Error(`REPAIR_REFUSED: ${code}${message ? `: ${message}` : ""}`);
}

async function findSubmission(ctx, requestId, sequence) {
  return ctx.db
    .query("clientSubmissions")
    .withIndex("by_request_sequence", (query) => query.eq("requestId", requestId).eq("sequence", sequence))
    .first();
}

async function listRows(ctx, table, requestId) {
  return ctx.db
    .query(table)
    .withIndex("by_request", (query) => query.eq("requestId", requestId))
    .collect();
}

/**
 * Remove only the pre-review projection that incorrectly treated a paid
 * project questionnaire video as the client's first review submission.
 *
 * This is intentionally internal and requires the exact ids observed during
 * a read-only audit. It never deletes clientRequestFiles or storage objects,
 * refuses any draft/snapshot/later cycle, and is idempotent after the two
 * projection rows have been removed.
 */
export const repairAnimationQuestionnaireProjection = internalMutation({
  args: {
    requestId: v.id("clientRequests"),
    expectedSubmissionId: v.id("clientSubmissions"),
    expectedSourceFileId: v.id("clientRequestFiles"),
    expectedClerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) refuse("request_not_found");
    if (request.offerKey !== "projet-animation") refuse("wrong_offer");
    if (request.status !== "paid" || request.paymentStatus !== "paid") refuse("request_not_paid");
    if (request.clerkUserId !== args.expectedClerkUserId) refuse("request_owner_mismatch");
    if (["refunded", "cancelled"].includes(request.status) || request.paymentStatus === "refunded") {
      refuse("request_closed");
    }

    const sourceFile = await ctx.db.get(args.expectedSourceFileId);
    if (!sourceFile || sourceFile.requestId !== request._id || sourceFile.clerkUserId !== args.expectedClerkUserId) {
      refuse("source_file_mismatch");
    }
    const submissions = await listRows(ctx, "clientSubmissions", request._id);
    const submission = submissions.find((row) => row.sequence === 1) || null;
    const requestUploads = (await ctx.db.query("clientSubmissionUploads").collect())
      .filter((upload) => upload.requestId === request._id);
    if (!submission) {
      const [orphanCycles, orphanDrafts, orphanSnapshots] = await Promise.all([
        listRows(ctx, "reviewCycles", request._id),
        listRows(ctx, "reviewDrafts", request._id),
        listRows(ctx, "reviewSnapshots", request._id),
      ]);
      if (submissions.length) refuse("orphan_submission_exists");
      if (orphanCycles.length) refuse("orphan_cycle_exists");
      if (orphanDrafts.length) refuse("orphan_review_draft_exists");
      if (orphanSnapshots.length) refuse("orphan_review_snapshot_exists");
      if (requestUploads.length) refuse("orphan_submission_upload_exists");
      if (sourceFile.status !== "active" || sourceFile.kind !== "video" || !String(sourceFile.mimeType || "").startsWith("video/")) {
        refuse("source_file_not_questionnaire");
      }
      return {
        ok: true,
        status: "already_clean",
        requestId: request._id,
        deleted: false,
        preservedSourceFileId: sourceFile._id,
      };
    }
    if (submission._id !== args.expectedSubmissionId) refuse("submission_id_mismatch");
    if (submission.clerkUserId !== args.expectedClerkUserId || submission.requestId !== request._id) {
      refuse("submission_owner_mismatch");
    }
    if (submission.kind !== "animation" || submission.sequence !== 1) refuse("unsupported_submission");
    if (submission.status !== "submitted" || submission.reviewedAt !== undefined) {
      refuse("submission_not_unpublished");
    }
    if (sourceFile.status !== "active" || sourceFile.kind !== "video" || !String(sourceFile.mimeType || "").startsWith("video/")) {
      refuse("source_file_not_questionnaire");
    }
    if (submission.sourceFileIds.length !== 1 || submission.sourceFileIds[0] !== args.expectedSourceFileId) {
      refuse("source_projection_mismatch");
    }

    if (submissions.some((row) => row._id !== submission._id)) refuse("other_submission_exists");

    const cycles = await listRows(ctx, "reviewCycles", request._id);
    const cycle = cycles.find((row) => row.cycleNumber === 1);
    if (!cycle || cycle.submissionId !== submission._id) refuse("cycle_projection_mismatch");
    if (cycles.some((row) => row._id !== cycle._id)) refuse("other_cycle_exists");
    if (
      cycle.status !== "submitted"
      || cycle.sourceFileId !== args.expectedSourceFileId
      || cycle.reviewDraftId !== undefined
      || cycle.reviewSnapshotId !== undefined
      || cycle.publishedAt !== undefined
    ) {
      refuse("cycle_not_unpublished");
    }

    const drafts = await listRows(ctx, "reviewDrafts", request._id);
    if (drafts.length) refuse("review_draft_exists");
    const snapshots = await listRows(ctx, "reviewSnapshots", request._id);
    if (snapshots.length) refuse("review_snapshot_exists");
    const uploads = requestUploads.filter((upload) => upload.submissionId === submission._id);
    if (uploads.length) refuse("submission_upload_exists");

    await ctx.db.delete(cycle._id);
    await ctx.db.delete(submission._id);
    return {
      ok: true,
      status: "repaired",
      requestId: request._id,
      deleted: true,
      deletedSubmissionId: submission._id,
      deletedCycleId: cycle._id,
      preservedSourceFileId: sourceFile._id,
    };
  },
});
