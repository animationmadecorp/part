import nextEnv from "@next/env";
import { readFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { resolve, extname } from "node:path";
import { createClient } from "@sanity/client";
import { getGlobalCliClient } from "@sanity/cli-core/apiClient";
import { getSanityEnvironment } from "../sanity/project.js";
import { validateArticleInput, resolveArticleIdentity, preservePublicDraftFields, shouldUploadCover } from "../lib/sanity/article-core.mjs";

const { loadEnvConfig } = nextEnv;
const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith("--"));
const publish = args.includes("--publish");
const dryRun = args.includes("--dry-run");
if (!file || args.some((arg) => arg.startsWith("--") && !["--publish", "--dry-run"].includes(arg))) throw new Error("Usage : node scripts/manage-article.mjs article.json [--dry-run] [--publish]");
const input = JSON.parse(await readFile(file, "utf8"));
const article = validateArticleInput(input);
if (dryRun) {
  console.log(JSON.stringify({ valid: true, slug: article.slug, target: publish ? "publication" : "brouillon", cloudWrite: false }));
  process.exit(0);
}

loadEnvConfig(process.cwd());
const environment = getSanityEnvironment();
if (environment.hasConflict || !environment.dataset) throw new Error("Configuration Sanity invalide ou dataset absent.");
const client = process.env.SANITY_WRITE_TOKEN
  ? createClient({ projectId: environment.projectId, dataset: environment.dataset, apiVersion: environment.apiVersion, useCdn: false, token: process.env.SANITY_WRITE_TOKEN, perspective: "raw" })
  : (await getGlobalCliClient({ apiVersion: environment.apiVersion, requireUser: true })).withConfig({ projectId: environment.projectId, dataset: environment.dataset, useProjectHostname: true, useCdn: false, perspective: "raw" });
const candidates = await client.fetch('*[_type == "article" && slug.current == $slug]{_id, _rev}', { slug: article.slug });
const resolvedId = resolveArticleIdentity(candidates, article.slug);
const resolvedDraftId = `drafts.${resolvedId}`;
const [publicDoc, draftDoc] = await Promise.all([client.getDocument(resolvedId), client.getDocument(resolvedDraftId)]);
if ([publicDoc, draftDoc].some((doc) => doc && (doc._type !== "article" || doc.slug?.current !== article.slug))) throw new Error("Identifiant déjà occupé par un autre document.");
let fields = { _type: "article", title: article.title, slug: { _type: "slug", current: article.slug }, summary: article.summary, body: article.body, category: article.category, publishedAt: article.publishedAt || (publish ? new Date().toISOString() : null), status: publish ? "published" : "draft" };
if (!publish) fields = preservePublicDraftFields(fields, draftDoc || publicDoc);
if (article.coverUrl) throw new Error("Utiliser coverPath local ou téléverser l’image dans Studio.");
if (shouldUploadCover({ coverPath: article.coverPath, publish, hasDraft: Boolean(draftDoc) })) {
  const imagePath = resolve(file, "..", article.coverPath);
  if (![".jpg", ".jpeg", ".png", ".webp"].includes(extname(imagePath).toLowerCase())) throw new Error("Couverture : format JPG, PNG ou WebP requis.");
  const asset = await client.assets.upload("image", createReadStream(imagePath), { filename: imagePath.split("/").at(-1) });
  fields.cover = { _type: "image", asset: { _type: "reference", _ref: asset._id }, alt: article.coverAlt };
}

const transaction = client.transaction();
if (!publish) {
  // Always write to Sanity's draft document. The public version stays untouched.
  if (draftDoc) transaction.patch(resolvedDraftId, (patch) => patch.ifRevisionId(draftDoc._rev).set(fields));
  else transaction.create({ _id: resolvedDraftId, ...fields });
} else {
  if (!draftDoc && publicDoc) throw new Error("Aucun brouillon à publier : préparer et valider une nouvelle version dans Studio ou par import.");
  if (draftDoc) {
    validateArticleInput({ title: draftDoc.title, slug: draftDoc.slug?.current, summary: draftDoc.summary, body: draftDoc.body, category: draftDoc.category, publishedAt: draftDoc.publishedAt });
    Object.assign(fields, { title: draftDoc.title, slug: draftDoc.slug, summary: draftDoc.summary, body: draftDoc.body, category: draftDoc.category, cover: draftDoc.cover, publishedAt: draftDoc.publishedAt || new Date().toISOString() });
    transaction.patch(resolvedDraftId, (patch) => patch.ifRevisionId(draftDoc._rev).set({ status: "published" }));
  }
  if (publicDoc) transaction.patch(resolvedId, (patch) => patch.ifRevisionId(publicDoc._rev).set(fields));
  else transaction.create({ _id: resolvedId, ...fields });
  if (draftDoc) transaction.delete(resolvedDraftId);
}
await transaction.commit();
console.log(`${publish ? "Publié" : "Brouillon enregistré"} : ${article.slug}`);
