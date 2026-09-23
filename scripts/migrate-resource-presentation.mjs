import nextEnv from "@next/env";
import { createClient } from "@sanity/client";
import { getGlobalCliClient } from "@sanity/cli-core/apiClient";
import { getSanityEnvironment } from "../sanity/project.js";
import { buildResourceStructurePatch } from "../lib/sanity/resource-migration.mjs";

const { loadEnvConfig } = nextEnv;
const slugArgument = process.argv.find((argument) => argument.startsWith("--slug="))?.slice("--slug=".length) || "scene-light";
const applyDraft = process.argv.includes("--apply");
const applyPublic = process.argv.includes("--apply-public");
const dryRun = !applyDraft;

function withoutSanitySystemFields(document) {
  return Object.fromEntries(Object.entries(document).filter(([key]) => !["_id", "_rev", "_createdAt", "_updatedAt"].includes(key)));
}

if (applyPublic) throw new Error("Cette migration prépare uniquement un brouillon ; publie ensuite volontairement dans Studio.");
if (slugArgument !== "scene-light") throw new Error("Migration ciblée : seul --slug=scene-light est autorisé dans ce script.");

loadEnvConfig(process.cwd());
const environment = getSanityEnvironment();
if (environment.hasConflict || !environment.dataset) throw new Error("Configuration Sanity invalide ou dataset absent.");

const resourceProjection = `{
  _id,
  _rev,
  stableId,
  slug,
  title,
  subtitle,
  summary,
  gallery,
  recap,
  installation,
  technicalDetails,
  license,
  metadata[]{_key, _type, label, value},
  body[]{..., _type == "image" => { ..., "url": asset->url, "assetRef": asset._ref }},
  "coverUrl": cover.asset->url,
  "coverAlt": cover.alt,
  "coverAssetRef": cover.asset._ref
}`;
const resourceQuery = `*[_type == "resourcePresentation" && (slug.current == $slug || slug == $slug)] | order(_updatedAt desc)[0]${resourceProjection}`;

const readClient = createClient({ projectId: environment.projectId, dataset: environment.dataset, apiVersion: environment.apiVersion, useCdn: false, perspective: "published" });
const publishedProjection = await readClient.fetch(resourceQuery, { slug: slugArgument });
if (!publishedProjection) throw new Error(`Ressource introuvable : ${slugArgument}.`);

if (dryRun) {
  const { patch, notes } = buildResourceStructurePatch(publishedProjection);
  console.log(JSON.stringify({ mode: "dry-run", id: publishedProjection._id, slug: slugArgument, patch, notes, bodyPreserved: true, publication: "aucune" }, null, 2));
  process.exit(0);
}

const client = process.env.SANITY_WRITE_TOKEN
  ? createClient({ projectId: environment.projectId, dataset: environment.dataset, apiVersion: environment.apiVersion, useCdn: false, token: process.env.SANITY_WRITE_TOKEN, perspective: "raw" })
  : (await getGlobalCliClient({ apiVersion: environment.apiVersion, requireUser: true })).withConfig({ projectId: environment.projectId, dataset: environment.dataset, useProjectHostname: true, useCdn: false, perspective: "raw" });
const publishedId = publishedProjection._id;
const draftId = `drafts.${publishedId}`;
const [publishedDoc, draftDoc] = await Promise.all([client.getDocument(publishedId), client.getDocument(draftId)]);
if (!publishedDoc || publishedDoc._rev !== publishedProjection._rev) throw new Error("La ressource publiée a changé pendant la lecture ; relance le dry-run.");

const source = draftDoc || publishedDoc;
const sourceProjection = await client.fetch(`*[_id == $id][0]${resourceProjection}`, { id: source._id });
if (!sourceProjection) throw new Error("Document source indisponible pour préparer le brouillon.");
const { patch, notes } = buildResourceStructurePatch(sourceProjection);
console.log(JSON.stringify({ mode: "apply-draft", id: publishedId, draftId, patch, notes, bodyPreserved: true, publication: "brouillon uniquement" }, null, 2));
if (Object.keys(patch).length === 0) process.exit(0);

const transaction = client.transaction();
if (draftDoc) {
  transaction.patch(draftId, (builder) => builder.ifRevisionId(draftDoc._rev).set(patch));
} else {
  const payload = withoutSanitySystemFields(publishedDoc);
  transaction.create({ ...payload, ...patch, _id: draftId, _type: publishedDoc._type, status: "draft" });
}
await transaction.commit();
console.log(`Brouillon préparé : ${draftId}. Publication volontaire dans Studio uniquement.`);
