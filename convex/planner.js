import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { effectiveBookingStatus } from "./bookingRules.js";
import { isOccurrenceDate, isValidDateKey, isValidTime } from "./plannerRules.js";

function plannerError(code, message) {
  throw new Error(`${code}: ${message}`);
}

async function requireIdentity(ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) plannerError("UNAUTHENTICATED", "Authentication required");
  return {
    clerkUserId: identity.subject,
    tokenIdentifier: identity.tokenIdentifier || identity.subject,
  };
}

function assertText(value, field, maxLength) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    plannerError("INVALID_INPUT", `Invalid ${field}`);
  }
  return value.trim();
}

function normalizeTaskArgs(args) {
  const clientId = assertText(args.clientId, "client id", 160);
  const title = assertText(args.title, "title", 180);
  const subtitle = typeof args.subtitle === "string" ? args.subtitle.trim() : "";
  if (subtitle.length > 180) plannerError("INVALID_INPUT", "Invalid subtitle");
  const date = assertText(args.date, "date", 10);
  if (!isValidDateKey(date)) plannerError("INVALID_INPUT", "Invalid date");
  const time = typeof args.time === "string" ? args.time : "";
  if (!isValidTime(time)) plannerError("INVALID_INPUT", "Invalid time");
  if (typeof args.recurring !== "boolean") plannerError("INVALID_INPUT", "Invalid recurrence");
  return { clientId, title, subtitle, date, time, recurring: args.recurring };
}

function safeTask(task) {
  return {
    id: task._id,
    clientId: task.clientId,
    title: task.title,
    subtitle: task.subtitle,
    date: task.date,
    time: task.time,
    recurring: task.recurring,
    completedDates: [...task.completedDates],
    deletedDates: [...task.deletedDates],
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

function taskMatchesInput(task, input) {
  return task.clientId === input.clientId
    && task.title === input.title
    && task.subtitle === input.subtitle
    && task.date === input.date
    && task.time === input.time
    && task.recurring === input.recurring;
}

async function findClientTasks(ctx, current, clientId) {
  return ctx.db
    .query("plannerTasks")
    .withIndex("by_clerk_user_client", (query) => query
      .eq("clerkUserId", current.clerkUserId)
      .eq("clientId", clientId))
    .collect();
}

async function requireOwnedTask(ctx, taskId, current) {
  const task = await ctx.db.get(taskId);
  if (!task) plannerError("NOT_FOUND", "Planner task not found");
  if (
    task.clerkUserId !== current.clerkUserId
    || task.tokenIdentifier !== current.tokenIdentifier
  ) {
    plannerError("FORBIDDEN", "Planner task belongs to another account");
  }
  return task;
}

function assertOccurrence(task, occurrenceDate) {
  if (!isValidDateKey(occurrenceDate) || !isOccurrenceDate(task, occurrenceDate)) {
    plannerError("INVALID_OCCURRENCE", "This task has no occurrence on that date");
  }
  if (task.deletedDates.includes(occurrenceDate)) {
    plannerError("OCCURRENCE_DELETED", "This task occurrence is already deleted");
  }
}

function sortedTasks(tasks) {
  return tasks.sort((left, right) =>
    left.date.localeCompare(right.date)
    || (left.time || "99:99").localeCompare(right.time || "99:99")
    || left.createdAt - right.createdAt,
  );
}

export const getMyTasks = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const current = await requireIdentity(ctx);
    const tasks = await ctx.db
      .query("plannerTasks")
      .withIndex("by_token_identifier", (query) => query.eq("tokenIdentifier", current.tokenIdentifier))
      .collect();
    return {
      viewerId: current.clerkUserId,
      tasks: sortedTasks(
        tasks
          .filter((task) => task.clerkUserId === current.clerkUserId)
          .map(safeTask),
      ),
    };
  },
});

export const getMyAppointments = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const current = await requireIdentity(ctx);
    const now = Date.now();
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_token_identifier", (query) => query.eq("tokenIdentifier", current.tokenIdentifier))
      .collect();
    return {
      viewerId: current.clerkUserId,
      bookings: bookings
        .filter((booking) => booking.clerkUserId === current.clerkUserId && booking.offerKey === "anglais")
        .sort((left, right) => left.startAt - right.startAt)
        .map((booking) => ({
          id: booking._id,
          offerKey: booking.offerKey,
          mode: booking.mode,
          date: booking.date,
          time: booking.time,
          status: effectiveBookingStatus(booking, now),
          ...(booking.holdExpiresAt === undefined ? {} : { holdExpiresAt: booking.holdExpiresAt }),
        })),
    };
  },
});

export const createTask = mutationGeneric({
  args: {
    clientId: v.string(),
    title: v.string(),
    subtitle: v.string(),
    date: v.string(),
    time: v.string(),
    recurring: v.boolean(),
  },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx);
    const input = normalizeTaskArgs(args);
    const existing = await findClientTasks(ctx, current, input.clientId);
    if (existing.length > 1) plannerError("AMBIGUOUS_TASK", "This task id is duplicated");
    if (existing.length === 1) {
      const task = existing[0];
      if (task.tokenIdentifier !== current.tokenIdentifier) {
        plannerError("FORBIDDEN", "Planner task belongs to another session");
      }
      if (!taskMatchesInput(task, input)) {
        plannerError("IDEMPOTENCY_MISMATCH", "This task id was already used with different data");
      }
      return safeTask(task);
    }

    const now = Date.now();
    const id = await ctx.db.insert("plannerTasks", {
      ...input,
      clerkUserId: current.clerkUserId,
      tokenIdentifier: current.tokenIdentifier,
      completedDates: [],
      deletedDates: [],
      createdAt: now,
      updatedAt: now,
    });
    return safeTask(await ctx.db.get(id));
  },
});

export const setOccurrenceCompleted = mutationGeneric({
  args: {
    taskId: v.id("plannerTasks"),
    occurrenceDate: v.string(),
    completed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx);
    const task = await requireOwnedTask(ctx, args.taskId, current);
    assertOccurrence(task, args.occurrenceDate);
    const hasDate = task.completedDates.includes(args.occurrenceDate);
    if (hasDate === args.completed) return safeTask(task);
    const completedDates = args.completed
      ? [...task.completedDates, args.occurrenceDate]
      : task.completedDates.filter((date) => date !== args.occurrenceDate);
    await ctx.db.patch(task._id, { completedDates, updatedAt: Date.now() });
    return safeTask({ ...task, completedDates });
  },
});

export const deleteOccurrence = mutationGeneric({
  args: {
    taskId: v.id("plannerTasks"),
    occurrenceDate: v.string(),
  },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx);
    const task = await requireOwnedTask(ctx, args.taskId, current);
    if (!isValidDateKey(args.occurrenceDate) || !isOccurrenceDate(task, args.occurrenceDate)) {
      plannerError("INVALID_OCCURRENCE", "This task has no occurrence on that date");
    }
    if (!task.recurring) {
      await ctx.db.delete(task._id);
      return { ok: true, status: "deleted_task", taskId: task._id };
    }
    if (task.deletedDates.includes(args.occurrenceDate)) {
      return { ok: true, status: "already_deleted", taskId: task._id };
    }
    const deletedDates = [...task.deletedDates, args.occurrenceDate];
    const completedDates = task.completedDates.filter((date) => date !== args.occurrenceDate);
    await ctx.db.patch(task._id, { deletedDates, completedDates, updatedAt: Date.now() });
    return { ok: true, status: "deleted_occurrence", taskId: task._id };
  },
});
