import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { EN_LESSONS, EN_LESSON_BY_SLUG } from "../lib/englishLessons.js";
import { hasEnglishLessonAccess, latestOpenedLesson } from "./englishLessonRules.js";

function englishError(code, message) {
  throw new Error(`${code}: ${message}`);
}

async function requireIdentity(ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) englishError("UNAUTHENTICATED", "Authentication required");
  return {
    clerkUserId: identity.subject,
    tokenIdentifier: identity.tokenIdentifier || identity.subject,
  };
}

function requireLesson(slug) {
  const normalized = typeof slug === "string" ? slug.trim() : "";
  const lesson = Object.hasOwn(EN_LESSON_BY_SLUG, normalized)
    ? EN_LESSON_BY_SLUG[normalized]
    : null;
  if (!lesson) englishError("NOT_FOUND", "English lesson not found");
  return lesson;
}

async function getOwnedEnglishEntitlements(ctx, current) {
  const entitlements = await ctx.db
    .query("entitlements")
    .withIndex("by_token_identifier", (query) => query.eq("tokenIdentifier", current.tokenIdentifier))
    .collect();
  return entitlements.filter((entitlement) => entitlement.clerkUserId === current.clerkUserId);
}

async function assertEnglishAccess(ctx, current) {
  const entitlements = await getOwnedEnglishEntitlements(ctx, current);
  if (!hasEnglishLessonAccess(entitlements)) {
    englishError("FORBIDDEN", "An English purchase is required to access this lesson");
  }
  return entitlements;
}

async function getProgressRows(ctx, current) {
  return ctx.db
    .query("englishLessonProgress")
    .withIndex("by_clerk_user_id", (query) => query.eq("clerkUserId", current.clerkUserId))
    .collect();
}

async function findProgress(ctx, current, lessonSlug) {
  const rows = await ctx.db
    .query("englishLessonProgress")
    .withIndex("by_clerk_user_lesson", (query) => query
      .eq("clerkUserId", current.clerkUserId)
      .eq("lessonSlug", lessonSlug))
    .collect();
  if (rows.length > 1) englishError("DATA_INTEGRITY", "Duplicate English lesson progress records");
  return rows[0] || null;
}

function safeProgress(progress) {
  if (!progress) return null;
  return {
    lessonSlug: progress.lessonSlug,
    completed: progress.completed,
    ...(typeof progress.completedAt === "number" ? { completedAt: progress.completedAt } : {}),
    ...(typeof progress.lastOpenedAt === "number" ? { lastOpenedAt: progress.lastOpenedAt } : {}),
    updatedAt: progress.updatedAt,
  };
}

function safeLessonMeta(lesson, progress, index) {
  return {
    slug: lesson.slug,
    title: lesson.title,
    category: lesson.category,
    position: index,
    progress: safeProgress(progress),
  };
}

function safeLesson(lesson, progress) {
  return {
    slug: lesson.slug,
    title: lesson.title,
    category: lesson.category,
    body: lesson.body,
    progress: safeProgress(progress),
  };
}

async function upsertProgress(ctx, current, lessonSlug, changes) {
  const previous = await findProgress(ctx, current, lessonSlug);
  const now = Date.now();
  if (previous) {
    const next = {
      ...changes,
      tokenIdentifier: current.tokenIdentifier,
      updatedAt: now,
    };
    await ctx.db.patch(previous._id, next);
    return safeProgress({ ...previous, ...next });
  }

  const id = await ctx.db.insert("englishLessonProgress", {
    clerkUserId: current.clerkUserId,
    tokenIdentifier: current.tokenIdentifier,
    lessonSlug,
    completed: false,
    ...changes,
    updatedAt: now,
  });
  return safeProgress(await ctx.db.get(id));
}

export const getMyEnglishLessons = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const current = await requireIdentity(ctx);
    const [entitlements, progressRows] = await Promise.all([
      getOwnedEnglishEntitlements(ctx, current),
      getProgressRows(ctx, current),
    ]);
    const access = hasEnglishLessonAccess(entitlements);
    const progressBySlug = new Map(progressRows.map((progress) => [progress.lessonSlug, progress]));
    const completedCount = access
      ? EN_LESSONS.filter((lesson) => progressBySlug.get(lesson.slug)?.completed === true).length
      : 0;
    const latest = access ? latestOpenedLesson(progressRows) : null;

    return {
      viewerId: current.clerkUserId,
      access: access ? "granted" : "locked",
      lessonCount: EN_LESSONS.length,
      completedCount,
      lastOpenedSlug: latest?.lessonSlug || null,
      // Metadata and progression are safe to list after the entitlement check;
      // lesson bodies are fetched separately by getMyEnglishLesson.
      lessons: access
        ? EN_LESSONS.map((lesson, index) => safeLessonMeta(lesson, progressBySlug.get(lesson.slug), index))
        : [],
    };
  },
});

export const getMyEnglishLesson = queryGeneric({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx);
    const lesson = requireLesson(args.slug);
    const entitlements = await getOwnedEnglishEntitlements(ctx, current);
    if (!hasEnglishLessonAccess(entitlements)) {
      return {
        viewerId: current.clerkUserId,
        access: "locked",
        lesson: null,
      };
    }
    const progress = await findProgress(ctx, current, lesson.slug);
    return {
      viewerId: current.clerkUserId,
      access: "granted",
      lesson: safeLesson(lesson, progress),
    };
  },
});

export const recordLessonOpened = mutationGeneric({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx);
    const lesson = requireLesson(args.slug);
    await assertEnglishAccess(ctx, current);
    return upsertProgress(ctx, current, lesson.slug, { lastOpenedAt: Date.now() });
  },
});

export const setLessonCompleted = mutationGeneric({
  args: {
    slug: v.string(),
    completed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const current = await requireIdentity(ctx);
    const lesson = requireLesson(args.slug);
    await assertEnglishAccess(ctx, current);
    const now = Date.now();
    return upsertProgress(ctx, current, lesson.slug, {
      completed: args.completed,
      ...(args.completed ? { completedAt: now } : { completedAt: undefined }),
    });
  },
});
