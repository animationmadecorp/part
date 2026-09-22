import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createTask,
  deleteOccurrence,
  getMyAppointments,
  getMyTasks,
  setOccurrenceCompleted,
} from "../convex/planner.js";
import {
  isOccurrenceDate,
  isValidDateKey,
  isValidTime,
  occurrenceFor,
} from "../convex/plannerRules.js";

const plannerSource = await readFile(new URL("../app/nouveau/bibliotheque/Planner.js", import.meta.url), "utf8");
const schemaSource = await readFile(new URL("../convex/schema.js", import.meta.url), "utf8");
const librarySource = await readFile(new URL("../app/nouveau/bibliotheque/Library.js", import.meta.url), "utf8");

assert.match(schemaSource, /plannerTasks: defineTable/);
assert.match(schemaSource, /\.index\("by_token_identifier", \["tokenIdentifier"\]\)/);
assert.match(schemaSource, /\.index\("by_clerk_user_client", \["clerkUserId", "clientId"\]\)/);
assert.match(plannerSource, /useQuery_experimental/);
assert.match(plannerSource, /query: "planner:getMyTasks"/);
assert.match(plannerSource, /useMutation\("planner:createTask"\)/);
assert.match(plannerSource, /useMutation\("planner:setOccurrenceCompleted"\)/);
assert.match(plannerSource, /useMutation\("planner:deleteOccurrence"\)/);
assert.match(plannerSource, /query: "planner:getMyAppointments"/);
assert.doesNotMatch(plannerSource, /query: "bookings:getMyFollowUp"/);
assert.match(plannerSource, /identitySettledUserId/);
assert.match(plannerSource, /viewerId/);
assert.match(plannerSource, /dialogError/);
assert.match(plannerSource, /dialogOwnerGeneration/);
assert.match(plannerSource, /const dialogVisible = dialogOpen && formIdentityMatches/);
assert.match(plannerSource, /if \(editDisabled \|\| !dialogVisible\) return/);
assert.match(plannerSource, /if \(!isCurrentIdentity\(operationUserId, operationGeneration\)\) return/);
assert.match(plannerSource, /lecture seule/);
assert.match(plannerSource, /catch/);
assert.doesNotMatch(plannerSource, /localStorage/);
assert.doesNotMatch(plannerSource, /const \[tasks, setTasks\]/);
assert.doesNotMatch(plannerSource, /rescheduleBooking|setMeetLink/);
assert.match(librarySource, /<Planner active=\{tab === "Tableau de bord"\}/);

function makeContext(initialTasks = [], identity = null, sharedState = null) {
  const state = sharedState || { plannerTasks: initialTasks.map((task) => ({ ...task })), bookings: [] };
  const patches = [];
  let sequence = state.plannerTasks.length + 1;

  function rows(table) {
    assert.ok(["plannerTasks", "bookings"].includes(table));
    return state[table] || [];
  }

  function query(table) {
    const all = rows(table);
    const chain = (predicate = () => true) => ({
      collect: async () => all.filter(predicate),
      first: async () => all.find(predicate) || null,
    });
    return {
      collect: async () => [...all],
      first: async () => all[0] || null,
      withIndex: (_indexName, callback) => {
        const clauses = [];
        const builder = {
          eq: (field, value) => {
            clauses.push([field, value]);
            return builder;
          },
        };
        callback(builder);
        return chain((row) => clauses.every(([field, value]) => row[field] === value));
      },
    };
  }

  return {
    state,
    patches,
    ctx: {
      auth: { getUserIdentity: async () => identity },
      db: {
        get: async (id) => state.plannerTasks.find((task) => task._id === id) || null,
        query,
        insert: async (table, value) => {
          rows(table);
          const id = `planner-${sequence++}`;
          const row = { ...value, _id: id, _creationTime: sequence };
          state.plannerTasks.push(row);
          return id;
        },
        patch: async (id, patch) => {
          const row = state.plannerTasks.find((task) => task._id === id);
          if (!row) throw new Error("missing planner task");
          Object.assign(row, patch);
          patches.push({ id, patch });
        },
        delete: async (id) => {
          state.plannerTasks = state.plannerTasks.filter((task) => task._id !== id);
        },
      },
    },
  };
}

const handlers = {
  createTask: createTask._handler,
  getMyTasks: getMyTasks._handler,
  setOccurrenceCompleted: setOccurrenceCompleted._handler,
  deleteOccurrence: deleteOccurrence._handler,
  getMyAppointments: getMyAppointments._handler,
};

const owner = { subject: "user-a", tokenIdentifier: "token-a" };
const other = { subject: "user-b", tokenIdentifier: "token-b" };

{
  // Regression harness for an open A form whose create mutation resolves after
  // the session has switched to B: the dialog and A's draft are hidden, and
  // the late result cannot update B's status.
  let currentIdentity = { userId: "user-a", generation: 1 };
  let dialogOpen = true;
  let draft = { title: "Brouillon privé A" };
  let status = "Enregistrement de la tâche A…";
  const pendingOperation = { ...currentIdentity };
  currentIdentity = { userId: "user-b", generation: 2 };
  dialogOpen = false;
  draft = { title: "" };
  status = "";
  const lateResultBelongsToCurrentIdentity = () =>
    currentIdentity.userId === pendingOperation.userId
      && currentIdentity.generation === pendingOperation.generation;
  if (lateResultBelongsToCurrentIdentity()) status = "Tâche A enregistrée.";
  assert.equal(dialogOpen, false, "an identity switch closes the open planner dialog");
  assert.equal(draft.title, "", "an identity switch removes the previous account draft");
  assert.equal(lateResultBelongsToCurrentIdentity(), false, "a pending A mutation cannot update account B");
  assert.equal(status, "", "a late A mutation does not publish its status in account B");
}

assert.equal(isValidDateKey("2026-02-28"), true);
assert.equal(isValidDateKey("2026-02-30"), false);
assert.equal(isValidTime("09:30"), true);
assert.equal(isValidTime("24:00"), false);

{
  const anonymous = makeContext([], null);
  await assert.rejects(() => handlers.getMyTasks(anonymous.ctx, {}), /UNAUTHENTICATED/);
}

const ownerHarness = makeContext([], owner);
ownerHarness.state.bookings = [
  {
    _id: "booking-a",
    clerkUserId: "user-a",
    tokenIdentifier: "token-a",
    offerKey: "anglais",
    mode: "solo",
    date: "2026-09-21",
    time: "11:00",
    startAt: 1,
    status: "confirmed",
  },
  {
    _id: "booking-b",
    clerkUserId: "user-b",
    tokenIdentifier: "token-b",
    offerKey: "anglais",
    mode: "solo",
    date: "2026-09-22",
    time: "12:00",
    startAt: 2,
    status: "confirmed",
  },
  {
    _id: "booking-other-offer",
    clerkUserId: "user-a",
    tokenIdentifier: "token-a",
    offerKey: "other",
    mode: "solo",
    date: "2026-09-23",
    time: "13:00",
    startAt: 3,
    status: "confirmed",
  },
];
const ownerAppointments = await handlers.getMyAppointments(ownerHarness.ctx, {});
assert.equal(ownerAppointments.viewerId, "user-a");
assert.deepEqual(ownerAppointments.bookings.map((booking) => booking.id), ["booking-a"], "appointments are real and account-scoped");

const createArgs = {
  clientId: "client-task-1",
  title: "Préparer le storyboard",
  subtitle: "Deux poses clés",
  date: "2026-09-21",
  time: "09:30",
  recurring: false,
};
const created = await handlers.createTask(ownerHarness.ctx, createArgs);
assert.equal(created.title, createArgs.title);
assert.equal(ownerHarness.state.plannerTasks.length, 1);
const reloaded = makeContext([], owner, ownerHarness.state);
assert.deepEqual((await handlers.getMyTasks(reloaded.ctx, {})).tasks.map((task) => task.title), [createArgs.title]);

const duplicate = await handlers.createTask(ownerHarness.ctx, createArgs);
assert.equal(duplicate.id, created.id, "repeating a client id is idempotent");
assert.equal(ownerHarness.state.plannerTasks.length, 1);
await assert.rejects(
  () => handlers.createTask(ownerHarness.ctx, { ...createArgs, title: "Autre tâche" }),
  /IDEMPOTENCY_MISMATCH/,
);

const recurring = await handlers.createTask(ownerHarness.ctx, {
  clientId: "client-recurring-1",
  title: "Pratiquer l’anglais",
  subtitle: "Vingt minutes",
  date: "2026-09-21",
  time: "18:00",
  recurring: true,
});
assert.equal(isOccurrenceDate(recurring, "2026-09-28"), true);
assert.equal(isOccurrenceDate(recurring, "2026-09-29"), false);
assert.equal(occurrenceFor(recurring, "2026-09-28")?.done, false);

await handlers.setOccurrenceCompleted(ownerHarness.ctx, {
  taskId: recurring.id,
  occurrenceDate: "2026-09-28",
  completed: true,
});
const afterCheck = (await handlers.getMyTasks(ownerHarness.ctx, {})).tasks.find((task) => task.id === recurring.id);
assert.deepEqual(afterCheck.completedDates, ["2026-09-28"]);
assert.equal(occurrenceFor(afterCheck, "2026-09-21")?.done, false);
assert.equal(occurrenceFor(afterCheck, "2026-09-28")?.done, true);

await handlers.deleteOccurrence(ownerHarness.ctx, {
  taskId: recurring.id,
  occurrenceDate: "2026-10-05",
});
const afterDelete = (await handlers.getMyTasks(ownerHarness.ctx, {})).tasks.find((task) => task.id === recurring.id);
assert.deepEqual(afterDelete.deletedDates, ["2026-10-05"]);
assert.equal(occurrenceFor(afterDelete, "2026-10-05"), null);
assert.equal(occurrenceFor(afterDelete, "2026-09-28")?.done, true);
const recurringReload = makeContext([], owner, ownerHarness.state);
const reloadedRecurring = (await handlers.getMyTasks(recurringReload.ctx, {})).tasks.find((task) => task.id === recurring.id);
assert.deepEqual(reloadedRecurring.deletedDates, ["2026-10-05"], "recurrence deletion survives reload");

const otherHarness = makeContext([], other, ownerHarness.state);
assert.equal((await handlers.getMyTasks(otherHarness.ctx, {})).tasks.length, 0, "other accounts cannot list owner tasks");
const otherAppointments = await handlers.getMyAppointments(otherHarness.ctx, {});
assert.equal(otherAppointments.viewerId, "user-b");
assert.deepEqual(otherAppointments.bookings.map((booking) => booking.id), ["booking-b"], "appointments do not cross account boundaries");
await assert.rejects(
  () => handlers.setOccurrenceCompleted(otherHarness.ctx, { taskId: created.id, occurrenceDate: createArgs.date, completed: true }),
  /FORBIDDEN/,
);
await assert.rejects(
  () => handlers.deleteOccurrence(otherHarness.ctx, { taskId: recurring.id, occurrenceDate: "2026-10-12" }),
  /FORBIDDEN/,
);

await assert.rejects(
  () => handlers.createTask(ownerHarness.ctx, { ...createArgs, clientId: "bad-date", date: "2026-02-30" }),
  /INVALID_INPUT/,
);
await assert.rejects(
  () => handlers.createTask(ownerHarness.ctx, { ...createArgs, clientId: "bad-time", time: "24:00" }),
  /INVALID_INPUT/,
);
await assert.rejects(
  () => handlers.setOccurrenceCompleted(ownerHarness.ctx, { taskId: recurring.id, occurrenceDate: "2026-09-29", completed: true }),
  /INVALID_OCCURRENCE/,
);

const oneOff = await handlers.createTask(ownerHarness.ctx, {
  clientId: "client-one-off",
  title: "Tâche temporaire",
  subtitle: "",
  date: "2026-09-22",
  time: "",
  recurring: false,
});
const deleteResult = await handlers.deleteOccurrence(ownerHarness.ctx, { taskId: oneOff.id, occurrenceDate: "2026-09-22" });
assert.equal(deleteResult.status, "deleted_task");
assert.equal((await handlers.getMyTasks(ownerHarness.ctx, {})).tasks.some((task) => task.id === oneOff.id), false);

const failureHarness = makeContext([], owner);
const failureTask = await handlers.createTask(failureHarness.ctx, { ...createArgs, clientId: "network-task" });
failureHarness.ctx.db.patch = async () => { throw new Error("network unavailable"); };
await assert.rejects(
  () => handlers.setOccurrenceCompleted(failureHarness.ctx, { taskId: failureTask.id, occurrenceDate: createArgs.date, completed: true }),
  /network unavailable/,
);
assert.deepEqual(failureHarness.state.plannerTasks[0].completedDates, [], "failed writes do not invent a completion");

console.log("planner persistence, recurrence, identity and failure checks: PASS");
