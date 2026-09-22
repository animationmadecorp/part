import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { editorialFallback } from "../app/nouveau/_data/content.js";
import { PUBLIC_EDITORIAL_QUERY } from "../lib/sanity/queries.js";
import * as esbuild from "esbuild";

const tempDir = await mkdtemp(join(process.cwd(), ".am-sanity-editorial-"));
const bundlePath = join(tempDir, "content.cjs");

await esbuild.build({
  absWorkingDir: process.cwd(),
  entryPoints: ["lib/sanity/content.js"],
  outfile: bundlePath,
  bundle: true,
  format: "cjs",
  platform: "node",
  plugins: [{
    name: "sanity-content-test-mocks",
    setup(build) {
      build.onResolve({ filter: /^next\/headers$/ }, () => ({ path: "next-headers", namespace: "sanity-next-headers" }));
      build.onLoad({ filter: /.*/, namespace: "sanity-next-headers" }, () => ({
        contents: "export async function draftMode() { return { isEnabled: false }; }",
        loader: "js",
      }));
      build.onResolve({ filter: /^@sanity\/client$/ }, () => ({ path: "sanity-client", namespace: "sanity-client" }));
      build.onLoad({ filter: /.*/, namespace: "sanity-client" }, () => ({
        contents: "export function createClient() { return { fetch: async () => null }; }",
        loader: "js",
      }));
    },
  }],
});

const require = createRequire(import.meta.url);
const { isEditorialCatalogInitialized, resolveEditorialContent } = require(bundlePath);

assert.match(PUBLIC_EDITORIAL_QUERY, /"editorialMeta"/);
assert.match(PUBLIC_EDITORIAL_QUERY, /"documentCount": count\(\*\[/);
assert.match(PUBLIC_EDITORIAL_QUERY, /status == "published"/);

const emptyRemote = {
  editorialMeta: { documentCount: 0 },
  siteSettings: null,
  pages: [],
  offers: [],
  resources: [],
  faqs: [],
};

assert.equal(isEditorialCatalogInitialized(emptyRemote), false);
const emptyResult = resolveEditorialContent(emptyRemote);
assert.equal(emptyResult.source, "fixture");
assert.equal(emptyResult.pages.length, editorialFallback.pages.length);
assert.equal(emptyResult.offers.length, editorialFallback.offers.length);
assert.equal(emptyResult.resources.length, editorialFallback.resources.length);
assert.ok(emptyResult.pages.some((page) => page.slug === "/nouveau"));

const intentionalEmptyRemote = {
  editorialMeta: { documentCount: 1 },
  siteSettings: null,
  pages: [],
  offers: [{ stableId: "offer:custom", slug: "custom", title: "Offre publiée", description: "Description publiée" }],
  resources: [],
  faqs: [],
};

assert.equal(isEditorialCatalogInitialized(intentionalEmptyRemote), true);
const intentionalEmptyResult = resolveEditorialContent(intentionalEmptyRemote);
assert.equal(intentionalEmptyResult.source, "sanity");
assert.deepEqual(intentionalEmptyResult.pages, []);
assert.deepEqual(intentionalEmptyResult.resources, []);
assert.deepEqual(intentionalEmptyResult.faqs, []);
assert.equal(intentionalEmptyResult.offers.length, 1);
assert.equal(intentionalEmptyResult.offers[0].stableId, "offer:custom");

const compatibilityRemote = {
  siteSettings: { stableId: "site-settings:animation-made", brand: "Animation Made" },
  pages: [],
  offers: [],
  resources: [],
  faqs: [],
};

assert.equal(isEditorialCatalogInitialized(compatibilityRemote), true);
assert.equal(resolveEditorialContent(compatibilityRemote).pages.length, 0);
assert.equal(resolveEditorialContent(null).source, "fixture");

await rm(tempDir, { recursive: true, force: true });
console.log("Sanity editorial fallback verifier: PASS (empty catalog fallback, initialized empty collections, query marker and public-only resolution)");
