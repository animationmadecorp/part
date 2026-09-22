import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { decideAccess, ROUTE_ACCESS } from "../lib/access-policy.mjs";
import { startProfileSync } from "../lib/profile-bootstrap.mjs";
import { filterProfilePatch } from "../lib/profile-policy.mjs";

const cases = [
  {
    name: "public route stays available without configuration",
    input: { scope: ROUTE_ACCESS.PUBLIC, configured: false, authenticated: false },
    expected: { allowed: true, reason: "public" },
  },
  {
    name: "member route refuses missing configuration",
    input: { scope: ROUTE_ACCESS.MEMBER, configured: false, authenticated: false },
    expected: { allowed: false, reason: "configuration_required" },
  },
  {
    name: "member route refuses anonymous access",
    input: { scope: ROUTE_ACCESS.MEMBER, configured: true, authenticated: false },
    expected: { allowed: false, reason: "unauthenticated" },
  },
  {
    name: "member cannot enter admin scope",
    input: { scope: ROUTE_ACCESS.ADMIN, configured: true, authenticated: true, role: "member" },
    expected: { allowed: false, reason: "forbidden" },
  },
  {
    name: "verified admin can enter admin scope",
    input: { scope: ROUTE_ACCESS.ADMIN, configured: true, authenticated: true, role: "admin" },
    expected: { allowed: true, reason: "authorized" },
  },
];

for (const testCase of cases) {
  assert.deepEqual(decideAccess(testCase.input), testCase.expected, testCase.name);
}

assert.deepEqual(
  filterProfilePatch({ name: " Test ", role: "admin", tokenIdentifier: "attacker" }),
  { name: "Test" },
  "client profile patches cannot set role or identity",
);

const [usersSource, libraryPage, requestsPage, studioPage, proxySource, accountSource, bootstrapSource, providersSource] = await Promise.all([
  readFile(new URL("../convex/users.js", import.meta.url), "utf8"),
  readFile(new URL("../app/nouveau/bibliotheque/page.js", import.meta.url), "utf8"),
  readFile(new URL("../app/nouveau/demandes/page.js", import.meta.url), "utf8"),
  readFile(new URL("../app/nouveau/studio/page.js", import.meta.url), "utf8"),
  readFile(new URL("../proxy.js", import.meta.url), "utf8"),
  readFile(new URL("../app/nouveau/bibliotheque/Account.js", import.meta.url), "utf8"),
  readFile(new URL("../components/ConvexProfileBootstrap.js", import.meta.url), "utf8"),
  readFile(new URL("../components/AuthProviders.js", import.meta.url), "utf8"),
]);

assert.match(usersSource, /ctx\.auth\.getUserIdentity\(\)/, "Convex functions read server identity");
assert.match(usersSource, /role: "member"/, "new profiles default to member");
assert.match(usersSource, /const profileArgs = \{[\s\S]*consentVersion/, "profile validators are explicit");
const updateStart = usersSource.indexOf("export const updateCurrentProfile");
assert.notEqual(updateStart, -1, "current profile update handler exists");
const updateSection = usersSource.slice(updateStart);
assert.match(updateSection, /args: profileArgs/, "current profile update uses the bounded profile validator");
assert.doesNotMatch(updateSection, /args\.role|role:\s*v\./, "profile updates do not accept a client role");
assert.match(libraryPage, /requireConnectedMemberPage/, "library has a connected member server guard");
assert.match(requestsPage, /requireAdminPage/, "requests have an admin server guard");
assert.match(studioPage, /requireAdminPage/, "studio has an admin server guard");
assert.match(proxySource, /clerkMiddleware/, "Next 16 proxy integrates Clerk");
assert.match(accountSource, /useClerk/, "account uses the Clerk client");
assert.match(accountSource, /signOut\(\{ redirectUrl: \"\/nouveau\" \}\)/, "account can sign out");
assert.match(bootstrapSource, /userId/, "profile bootstrap is keyed by Clerk user id");
assert.match(bootstrapSource, /startProfileSync/, "profile bootstrap uses the cancellable sync runner");
assert.match(providersSource, /createConvexClient/, "invalid Convex configuration is contained on the client");

const flushMicrotasks = () => new Promise((resolve) => queueMicrotask(() => queueMicrotask(resolve)));
const createFakeTimers = () => {
  const pending = new Map();
  let nextId = 1;
  return {
    pending,
    setTimer(callback) {
      const id = nextId;
      nextId += 1;
      pending.set(id, callback);
      return id;
    },
    clearTimer(id) {
      pending.delete(id);
    },
  };
};

{
  const timers = createFakeTimers();
  let attempts = 0;
  let syncedUserId = null;
  const cleanup = startProfileSync({
    userId: "user_cleanup",
    ensureCurrentProfile: async () => {
      attempts += 1;
      throw new Error("transient");
    },
    onSynced: (userId) => { syncedUserId = userId; },
    onExhausted: () => {},
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  await flushMicrotasks();
  assert.equal(attempts, 1, "profile sync starts once");
  assert.equal(timers.pending.size, 1, "profile sync schedules a bounded retry");
  cleanup();
  assert.equal(timers.pending.size, 0, "cleanup cancels a pending retry timer");
  assert.equal(syncedUserId, null, "a failed sync is not marked as successful");
}

{
  const timers = createFakeTimers();
  let attempts = 0;
  let syncedUserId = null;
  const cleanup = startProfileSync({
    userId: "user_success",
    ensureCurrentProfile: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("transient");
    },
    onSynced: (userId) => { syncedUserId = userId; },
    onExhausted: () => { throw new Error("success path exhausted"); },
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  await flushMicrotasks();
  const retry = timers.pending.values().next().value;
  assert.equal(typeof retry, "function", "retry callback is retained until it runs");
  retry();
  await flushMicrotasks();
  assert.equal(attempts, 2, "profile sync retries once after a transient failure");
  assert.equal(syncedUserId, "user_success", "profile is marked only after a successful sync");
  cleanup();
}

console.log("auth foundation local policy checks: PASS");
