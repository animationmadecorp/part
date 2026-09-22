import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  getMyEnglishLesson,
  getMyEnglishLessons,
  recordLessonOpened,
  setLessonCompleted,
} from "../convex/englishLessons.js";
import { EN_LESSONS } from "../lib/englishLessons.js";
import { hasEnglishLessonAccess, isEnglishLessonEntitlement } from "../convex/englishLessonRules.js";

const schemaSource = await readFile(new URL("../convex/schema.js", import.meta.url), "utf8");
const rulesSource = await readFile(new URL("../convex/englishLessonRules.js", import.meta.url), "utf8");
const moduleSource = await readFile(new URL("../convex/englishLessons.js", import.meta.url), "utf8");
const librarySource = await readFile(new URL("../app/nouveau/bibliotheque/EnglishLibrary.js", import.meta.url), "utf8");
const libraryShellSource = await readFile(new URL("../app/nouveau/bibliotheque/Library.js", import.meta.url), "utf8");
const legacyIndexSource = await readFile(new URL("../app/anglais/lessons/page.js", import.meta.url), "utf8");
const legacyLessonSource = await readFile(new URL("../app/anglais/lessons/[slug]/page.js", import.meta.url), "utf8");
const newLibraryPageSource = await readFile(new URL("../app/nouveau/bibliotheque/page.js", import.meta.url), "utf8");
const englishLandingSource = await readFile(new URL("../app/anglais/page.js", import.meta.url), "utf8");
const cssSource = await readFile(new URL("../app/nouveau/bibliotheque/english-library.css", import.meta.url), "utf8");

assert.equal(EN_LESSONS.length, 17, "the existing catalogue still contains the 17 lessons");
assert.equal(new Set(EN_LESSONS.map((lesson) => lesson.slug)).size, 17, "lesson slugs remain unique");
assert.ok(EN_LESSONS.every((lesson) => typeof lesson.body === "string" && lesson.body.trim()), "every lesson has real body content");
assert.match(schemaSource, /englishLessonProgress: defineTable/);
assert.match(schemaSource, /\.index\("by_clerk_user_lesson", \["clerkUserId", "lessonSlug"\]\)/);
assert.match(schemaSource, /\.index\("by_clerk_user_id", \["clerkUserId"\]\)/);
assert.match(moduleSource, /query\("entitlements"\)/);
assert.match(moduleSource, /query\("englishLessonProgress"\)/);
assert.match(moduleSource, /export const getMyEnglishLesson/);
assert.doesNotMatch(moduleSource, /validUntil/);
assert.match(rulesSource, /status !== "refunded"/);
assert.match(librarySource, /query: "englishLessons:getMyEnglishLessons"/);
assert.match(librarySource, /query: "englishLessons:getMyEnglishLesson"/);
assert.match(librarySource, /useMutation\("englishLessons:recordLessonOpened"\)/);
assert.match(librarySource, /useMutation\("englishLessons:setLessonCompleted"\)/);
assert.match(librarySource, /viewerMatches/);
assert.match(librarySource, /scrollIntoView/);
assert.match(librarySource, /lastOpenedSlug/);
assert.match(librarySource, /initialLessonSlug/);
assert.doesNotMatch(librarySource, /localStorage/);
assert.match(libraryShellSource, /resource\.id !== "english"/);
assert.match(libraryShellSource, /<EnglishLibrary search=\{search\} initialLessonSlug=\{initialEnglishLesson\}\/>/);
assert.match(newLibraryPageSource, /p\.lecon/);
assert.match(legacyIndexSource, /redirect\("\/nouveau\/bibliotheque/);
assert.doesNotMatch(legacyIndexSource, /EN_LESSONS|EnglishLessonBody|lesson\.body/);
assert.match(legacyLessonSource, /notFound/);
assert.match(legacyLessonSource, /redirect\(`\/nouveau\/bibliotheque/);
assert.doesNotMatch(legacyLessonSource, /EnglishLessonBody|lesson\.body|getContent/);
assert.match(englishLandingSource, /Les 17 leçons/);
assert.doesNotMatch(englishLandingSource, /href="https:\/\/chatgpt\.com"/);
assert.match(cssSource, /@media \(max-width: 760px\)/);
assert.match(cssSource, /\.am-english-lesson-grid\s*\{[\s\S]*grid-template-columns: 1fr/);

function makeContext(identity, initialState) {
  const state = initialState;
  let sequence = 1;
  const tableNames = ["entitlements", "englishLessonProgress"];

  function rows(table) {
    assert.ok(tableNames.includes(table), `unexpected table ${table}`);
    return state[table];
  }

  function query(table) {
    const all = rows(table);
    const chain = (predicates) => ({
      collect: async () => all.filter((row) => predicates.every(([field, value]) => row[field] === value)),
      first: async () => all.find((row) => predicates.every(([field, value]) => row[field] === value)) || null,
    });
    return {
      collect: async () => [...all],
      first: async () => all[0] || null,
      withIndex: (_indexName, callback) => {
        const predicates = [];
        const builder = {
          eq: (field, value) => {
            predicates.push([field, value]);
            return builder;
          },
        };
        callback(builder);
        return chain(predicates);
      },
    };
  }

  return {
    state,
    ctx: {
      auth: { getUserIdentity: async () => identity },
      db: {
        get: async (id) => tableNames.flatMap((table) => rows(table)).find((row) => row._id === id) || null,
        query,
        insert: async (table, value) => {
          const id = `${table}-${sequence++}`;
          rows(table).push({ ...value, _id: id, _creationTime: sequence });
          return id;
        },
        patch: async (id, patch) => {
          const row = tableNames.flatMap((table) => rows(table)).find((item) => item._id === id);
          assert.ok(row, `missing row ${id}`);
          for (const [key, value] of Object.entries(patch)) {
            if (value === undefined) delete row[key];
            else row[key] = value;
          }
        },
      },
    },
  };
}

const owner = { subject: "user-a", tokenIdentifier: "token-a" };
const other = { subject: "user-b", tokenIdentifier: "token-b" };
const ownerEntitlement = {
  _id: "ent-a",
  clerkUserId: "user-a",
  tokenIdentifier: "token-a",
  offerKey: "anglais",
  mode: "solo",
  totalCredits: 1,
  remainingCredits: 0,
  validUntil: 1,
  status: "active",
};
const sharedState = { entitlements: [ownerEntitlement], englishLessonProgress: [] };
const handlers = {
  getMyEnglishLessons: getMyEnglishLessons._handler,
  getMyEnglishLesson: getMyEnglishLesson._handler,
  recordLessonOpened: recordLessonOpened._handler,
  setLessonCompleted: setLessonCompleted._handler,
};

assert.equal(isEnglishLessonEntitlement(ownerEntitlement), true, "a purchased entitlement grants the lesson right even with no credit left");
assert.equal(hasEnglishLessonAccess([ownerEntitlement]), true);
assert.equal(isEnglishLessonEntitlement({ ...ownerEntitlement, status: "refunded" }), false);
assert.equal(isEnglishLessonEntitlement({ ...ownerEntitlement, refundStatus: "refunded" }), false);
assert.equal(isEnglishLessonEntitlement({ ...ownerEntitlement, status: "partial_refund", refundStatus: "partial" }), true);

await assert.rejects(
  () => handlers.getMyEnglishLessons(makeContext(null, { entitlements: [], englishLessonProgress: [] }).ctx, {}),
  /UNAUTHENTICATED/,
);

const locked = await handlers.getMyEnglishLessons(makeContext(other, { entitlements: [], englishLessonProgress: [] }).ctx, {});
assert.equal(locked.access, "locked");
assert.deepEqual(locked.lessons, []);
const lockedLesson = await handlers.getMyEnglishLesson(makeContext(other, { entitlements: [], englishLessonProgress: [] }).ctx, { slug: "present-simple" });
assert.equal(lockedLesson.access, "locked");
assert.equal(lockedLesson.lesson, null);

const ownerContext = makeContext(owner, sharedState);
const firstIndex = await handlers.getMyEnglishLessons(ownerContext.ctx, {});
assert.equal(firstIndex.access, "granted");
assert.equal(firstIndex.lessonCount, 17);
assert.equal(firstIndex.completedCount, 0);
assert.equal(firstIndex.lessons.length, 17);
assert.ok(firstIndex.lessons.every((lesson) => !Object.hasOwn(lesson, "body")), "the index never returns private lesson bodies");

await handlers.recordLessonOpened(ownerContext.ctx, { slug: "present-simple" });
assert.equal(sharedState.englishLessonProgress.length, 1, "opening a lesson creates one progress row");
const reopenedIndex = await handlers.getMyEnglishLessons(ownerContext.ctx, {});
assert.equal(reopenedIndex.lastOpenedSlug, "present-simple");
assert.equal(reopenedIndex.lessons[0].progress.completed, false);

await handlers.setLessonCompleted(ownerContext.ctx, { slug: "present-simple", completed: true });
await handlers.setLessonCompleted(ownerContext.ctx, { slug: "present-simple", completed: true });
assert.equal(sharedState.englishLessonProgress.length, 1, "repeating completion is idempotent");
const completedIndex = await handlers.getMyEnglishLessons(ownerContext.ctx, {});
assert.equal(completedIndex.completedCount, 1);
const privateLesson = await handlers.getMyEnglishLesson(ownerContext.ctx, { slug: "present-simple" });
assert.equal(privateLesson.access, "granted");
assert.match(privateLesson.lesson.body, /Present simple|Quand l'utiliser/i);
assert.equal(privateLesson.lesson.progress.completed, true);
for (const inheritedSlug of ["__proto__", "constructor", "toString"]) {
  await assert.rejects(
    () => handlers.getMyEnglishLesson(ownerContext.ctx, { slug: inheritedSlug }),
    /NOT_FOUND/,
    `${inheritedSlug} must not resolve through the lesson catalogue prototype`,
  );
  await assert.rejects(
    () => handlers.recordLessonOpened(ownerContext.ctx, { slug: inheritedSlug }),
    /NOT_FOUND/,
  );
}

const otherState = {
  entitlements: [
    { ...ownerEntitlement, _id: "ent-b", clerkUserId: "user-b", tokenIdentifier: "token-b" },
  ],
  englishLessonProgress: sharedState.englishLessonProgress,
};
const otherContext = makeContext(other, otherState);
const otherIndex = await handlers.getMyEnglishLessons(otherContext.ctx, {});
assert.equal(otherIndex.access, "granted");
assert.equal(otherIndex.completedCount, 0, "the second account cannot inherit account A progress");
assert.ok(otherIndex.lessons.every((lesson) => lesson.progress === null));
await handlers.setLessonCompleted(otherContext.ctx, { slug: "present-simple", completed: true });
assert.equal(sharedState.englishLessonProgress.length, 2, "the second account gets a separate row");
assert.equal((await handlers.getMyEnglishLessons(ownerContext.ctx, {})).completedCount, 1);

ownerEntitlement.status = "refunded";
const revoked = await handlers.getMyEnglishLessons(ownerContext.ctx, {});
assert.equal(revoked.access, "locked", "a full refund removes private lesson access");
await assert.rejects(
  () => handlers.setLessonCompleted(ownerContext.ctx, { slug: "present-continuous", completed: true }),
  /FORBIDDEN/,
);
await assert.rejects(
  () => handlers.getMyEnglishLesson(ownerContext.ctx, { slug: "not-a-real-lesson" }),
  /NOT_FOUND/,
);

console.log("English lessons verifier: PASS (catalogue, entitlement boundary, private payload, persistence, idempotency, refund and account isolation)");
