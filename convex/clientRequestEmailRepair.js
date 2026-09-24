import { internalMutationGeneric } from "convex/server";
import { v } from "convex/values";
import { resolveOwnerEmail } from "./clientRequestEmail";

// Explicit one-time repair. Never schedules or resends historical notifications.
export const backfillPaidRequestEmails = internalMutationGeneric({
  args: { dryRun: v.boolean() },
  handler: async (ctx, { dryRun }) => {
    const requests = await ctx.db.query("clientRequests").collect();
    let repaired = 0;
    let unresolved = 0;
    for (const request of requests) {
      if (request.status !== "paid" || request.paymentStatus !== "paid" || request.email) continue;
      const email = await resolveOwnerEmail(ctx, request);
      if (!email) {
        unresolved += 1;
        continue;
      }
      if (!dryRun) await ctx.db.patch(request._id, { email });
      repaired += 1;
    }
    return { dryRun, repaired, unresolved };
  },
});
