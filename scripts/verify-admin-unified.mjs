import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getSanityStudioStatus } from "../lib/sanity/config.js";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const [adminPage, accountPage, libraryPage, topBar, libraryComponent, proxy, adminCss, cliConfig, sanityConfig, content, revalidate, statusRoute, docs] = await Promise.all([
  read("app/admin/page.js"),
  read("app/nouveau/bibliotheque/Account.js"),
  read("app/nouveau/bibliotheque/page.js"),
  read("components/TopBar.js"),
  read("app/nouveau/bibliotheque/Library.js"),
  read("proxy.js"),
  read("app/admin/admin.css"),
  read("sanity.cli.js"),
  read("lib/sanity/config.js"),
  read("lib/sanity/content.js"),
  read("app/api/sanity/revalidate/route.js"),
  read("app/api/sanity/status/route.js"),
  read("docs/administration-unifiee.md"),
]);

assert.match(adminPage, /requireAdminPage/);
assert.match(adminPage, /href="\/nouveau\/demandes"/);
assert.match(adminPage, /href="\/admin\/reservations"/);
assert.match(adminPage, /href="\/admin\/disponibilites"/);
assert.match(adminPage, /getSanityStudioStatus/);
assert.match(adminPage, /target="_blank"/);
assert.match(adminPage, /SANITY_EDITORIAL_REVALIDATE_SECONDS/);
assert.match(libraryPage, /isAdmin=.*role === "admin"/);
assert.match(accountPage, /isAdmin &&/);
assert.match(accountPage, /href="\/admin"/);
assert.match(libraryComponent, /am-sidebar-admin-link/);
assert.match(libraryComponent, /href="\/admin"/);
assert.match(topBar, /user\.role === "admin"/);
assert.match(topBar, /hasClerkProvider/);
assert.match(proxy, /"\/admin\/:path\*"/);
assert.match(adminCss, /--accent-ink: #27233a/);
assert.match(adminCss, /--lav: #57548b/);
assert.match(cliConfig, /publicDir: false/);
assert.match(cliConfig, /deployment: \{ appId: "immcgmorj3khyr4qcpd4gvh3", autoUpdates: false \}/);
assert.match(sanityConfig, /SANITY_STUDIO_URL/);
assert.match(content, /SANITY_EDITORIAL_REVALIDATE_SECONDS/);
assert.match(revalidate, /parseBody\(request, secret, true\)/);
assert.match(revalidate, /isValidSignature !== true/);
assert.match(statusRoute, /revalidationFallbackSeconds/);
assert.match(docs, /SANITY_REVALIDATE_SECRET/);
assert.match(docs, /60 secondes/);

const hosted = getSanityStudioStatus({ NODE_ENV: "production", SANITY_STUDIO_URL: "https://animation-made.sanity.studio/" });
assert.equal(hosted.configured, true);
assert.equal(hosted.url, "https://animation-made.sanity.studio");
assert.equal(hosted.isLocal, false);

for (const localUrl of [
  "http://localhost:3333",
  "https://localhost./",
  "https://127.0.0.2:3333",
  "https://[::1]:3333",
  "https://[::ffff:127.0.0.1]:3333",
  "https://[::ffff:127.255.255.255]:3333",
]) {
  const localProduction = getSanityStudioStatus({ NODE_ENV: "production", SANITY_STUDIO_URL: localUrl });
  assert.equal(localProduction.configured, false, `local Studio URL must be rejected: ${localUrl}`);
  assert.equal(localProduction.reason, "local_url_in_production", `local Studio URL reason: ${localUrl}`);
}

const localDevelopment = getSanityStudioStatus({ NODE_ENV: "development", SANITY_STUDIO_URL: "http://localhost:3333" });
assert.equal(localDevelopment.configured, true);
assert.equal(localDevelopment.isLocal, true);

const malformed = getSanityStudioStatus({ NODE_ENV: "production", SANITY_STUDIO_URL: "animation-made.sanity.studio" });
assert.equal(malformed.configured, false);
assert.equal(malformed.reason, "invalid_url");

console.log("unified administration verifier: PASS (server ACL, admin-only navigation, safe Studio URL, signed revalidation, 60s fallback, Studio build isolation)");
