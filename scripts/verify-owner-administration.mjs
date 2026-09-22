import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { promoteOwnerProfile } from "../convex/ownerAdministration.js";

const root = new URL("../", import.meta.url);
const ownerSource = await readFile(new URL("../convex/ownerAdministration.js", import.meta.url), "utf8");
const schemaSource = await readFile(new URL("../convex/schema.js", import.meta.url), "utf8");
const usersSource = await readFile(new URL("../convex/users.js", import.meta.url), "utf8");

assert.match(ownerSource, /import \{ internalMutation \} from "\.\/\_generated\/server\.js"/);
assert.match(ownerSource, /export const promoteOwnerProfile = internalMutation/);
assert.doesNotMatch(ownerSource, /export const mutation|mutationGeneric|httpAction|ctx\.auth/);
assert.doesNotMatch(ownerSource, /console\.(log|error|warn)/);
assert.match(ownerSource, /args: \{[\s\S]*id: v\.id\("users"\)[\s\S]*clerkUserId: v\.string\(\)[\s\S]*email: v\.string\(\)/);
assert.equal(schemaSource.includes("ownerAdministration"), false, "promotion must not add a schema table");
assert.equal(usersSource.includes("role: v."), false, "client profile mutations must remain unable to set role");
void root;

function makeContext(profiles) {
  const state = profiles.map((profile) => ({ ...profile }));
  const patches = [];

  return {
    ctx: {
      db: {
        get: async (id) => state.find((profile) => profile._id === id) || null,
        query: (table) => {
          assert.equal(table, "users");
          return { collect: async () => [...state] };
        },
        patch: async (id, patch) => {
          const profile = state.find((candidate) => candidate._id === id);
          if (!profile) throw new Error("test profile missing");
          Object.assign(profile, patch);
          patches.push({ id, patch });
        },
      },
    },
    state,
    patches,
  };
}

const handler = promoteOwnerProfile._handler;

{
  const harness = makeContext([
    { _id: "profile-1", clerkUserId: "user_verified", email: "owner@example.test", role: "member", updatedAt: 10 },
  ]);
  const result = await handler(harness.ctx, {
    id: "profile-1",
    clerkUserId: "user_verified",
    email: "owner@example.test",
  });
  assert.deepEqual(result, { ok: true, status: "promoted", profileId: "profile-1" });
  assert.equal(harness.state[0].role, "admin");
  assert.equal(harness.patches.length, 1);
}

{
  const harness = makeContext([
    { _id: "profile-1", clerkUserId: "user_verified", email: "owner@example.test", role: "member", updatedAt: 10 },
    { _id: "profile-2", clerkUserId: "user_verified", email: "other@example.test", role: "member", updatedAt: 11 },
  ]);
  await assert.rejects(
    () => handler(harness.ctx, { id: "profile-1", clerkUserId: "user_verified", email: "owner@example.test" }),
    /OWNER_PROMOTION_REFUSED: ambiguous_identity/,
  );
  assert.equal(harness.state[0].role, "member");
  assert.equal(harness.patches.length, 0);
}

{
  const harness = makeContext([
    { _id: "profile-1", clerkUserId: "user_verified", email: "owner@example.test", role: "admin", updatedAt: 10 },
  ]);
  const result = await handler(harness.ctx, {
    id: "profile-1",
    clerkUserId: "user_verified",
    email: "owner@example.test",
  });
  assert.deepEqual(result, { ok: true, status: "already_admin", profileId: "profile-1" });
  assert.equal(harness.patches.length, 0, "already-admin promotion is idempotent and does not write");
}

{
  const harness = makeContext([
    { _id: "profile-1", clerkUserId: "user_verified", email: "owner@example.test", role: "member", updatedAt: 10 },
  ]);
  await assert.rejects(
    () => handler(harness.ctx, { id: "profile-1", clerkUserId: "wrong_user", email: "owner@example.test" }),
    /OWNER_PROMOTION_REFUSED: ambiguous_identity/,
  );
  await assert.rejects(
    () => handler(harness.ctx, { id: "profile-1", clerkUserId: "user_verified", email: "other@example.test" }),
    /OWNER_PROMOTION_REFUSED: ambiguous_identity/,
  );
  assert.equal(harness.patches.length, 0);
}

console.log("owner administration internal promotion checks: PASS");
