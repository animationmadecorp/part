import nextEnv from "@next/env";
import { createClient } from "@sanity/client";
import { getSanityEnvironment } from "../sanity/project.js";
import { buildResourceStructurePatch } from "../lib/sanity/resource-migration.mjs";

const { loadEnvConfig } = nextEnv;
const slugArgument = process.argv.find((argument) => argument.startsWith("--slug="))?.slice("--slug=".length) || "scene-light";
const apply = process.argv.includes("--apply");
const dryRun = !apply;

if (apply && process.argv.includes("--publish")) {
  throw new Error("Cette migration ne publie jamais. Retire --publish et valide le brouillon dans Studio séparément.");
}
if (slugArgument !== "scene-light") {
  throw new Error("Migration ciblée : seul --slug=scene-light est autorisé dans ce script.");
}

loadEnvConfig(process.cwd());
const { projectId, dataset, apiVersion } = getSanityEnvironment();
if (!projectId || !dataset) throw new Error("Configuration Sanity manquante : dataset/projet requis.");

const readClient = createClient({ projectId, dataset, apiVersion, useCdn: false, perspective: "published" });
const resource = await readClient.fetch(`*[_type == "resourcePresentation" && (slug.current == $slug || slug == $slug)] | order(_updatedAt desc)[0]{
  _id,
  stableId,
  slug,
  title,
  subtitle,
  summary,
  gallery,
  installation,
  license,
  body[]{..., _type == "image" => { ..., "url": asset->url, "assetRef": asset._ref }},
  "coverUrl": cover.asset->url,
  "coverAlt": cover.alt,
  "coverAssetRef": cover.asset._ref
}`, { slug: slugArgument });

if (!resource) throw new Error(`Ressource introuvable : ${slugArgument}.`);
const { patch, notes } = buildResourceStructurePatch(resource);
console.log(JSON.stringify({ mode: dryRun ? "dry-run" : "apply-draft", id: resource._id, slug: slugArgument, patch, notes }, null, 2));

if (dryRun || Object.keys(patch).length === 0) process.exit(0);

const token = process.env.SANITY_WRITE_TOKEN || "";
if (!token) throw new Error("--apply exige SANITY_WRITE_TOKEN ; aucun contenu n’a été écrit.");
const writeClient = createClient({ projectId, dataset, apiVersion, useCdn: false, perspective: "drafts", token });
const raw = await writeClient.fetch(`*[_id == $id][0]`, { id: resource._id });
if (!raw?._id) throw new Error("Document source indisponible pour préparer le brouillon.");
const { _id, _rev, _createdAt, _updatedAt, ...payload } = raw;
const draftId = `drafts.${_id}`;
await writeClient.createIfNotExists({ ...payload, _id: draftId, _type: raw._type, status: "draft" });
await writeClient.patch(draftId).set(patch).commit();
console.log(`Brouillon ${draftId} mis à jour. Publication volontaire dans Studio uniquement.`);
