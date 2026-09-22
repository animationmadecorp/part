import nextEnv from "@next/env";
import { createClient } from "@sanity/client";
import { editorialFallback } from "../app/nouveau/_data/content.js";
import { getSanityEnvironment } from "../sanity/project.js";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const { projectId, dataset, apiVersion, conflictFields = [] } = getSanityEnvironment();
const token = process.env.SANITY_WRITE_TOKEN || "";
const force = process.argv.includes("--force");

function documentId(kind, stableId) {
  return `editorial.${kind}.${stableId.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
}

function arrayKey(prefix, value, index) {
  return `${prefix}-${String(value || index).replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 80)}`;
}

function typedArray(items, type, prefix, mapItem = (item) => item) {
  return (Array.isArray(items) ? items : []).map((item, index) => ({
    _key: arrayKey(prefix, item?.stableId || item?.label || item?.title, index),
    _type: type,
    ...mapItem(item, index),
  }));
}

function toSeo(seo) {
  return seo ? { _type: "seo", ...seo } : undefined;
}

function toHero(hero) {
  return hero ? { _type: "editorialHero", ...hero } : undefined;
}

function toSections(sections) {
  return typedArray(sections, "editorialContentSection", "section", (section) => ({
    ...section,
    items: typedArray(section?.items, "editorialContentItem", "item"),
  }));
}

function toPageDocument(page) {
  return {
    _id: documentId("page", page.stableId),
    _type: "page",
    stableId: page.stableId,
    slug: { _type: "slug", current: page.slug },
    title: page.title,
    description: page.description,
    status: page.status,
    seo: toSeo(page.seo),
    hero: toHero(page.hero),
    sections: toSections(page.sections),
  };
}

function toOfferDocument(offer) {
  return {
    _id: documentId("offer", offer.stableId),
    _type: "offer",
    stableId: offer.stableId,
    slug: offer.slug,
    number: offer.number,
    title: offer.title,
    category: offer.category,
    description: offer.description,
    icon: offer.icon,
    color: offer.color,
    status: offer.status,
    sortOrder: offer.sortOrder,
    entitlementKey: offer.entitlementKey,
  };
}

function toResourceDocument(resource) {
  return {
    _id: documentId("resource", resource.stableId),
    _type: "resourcePresentation",
    stableId: resource.stableId,
    slug: resource.id,
    title: resource.title,
    status: resource.status,
    sortOrder: resource.sortOrder,
    collection: resource.collection,
    format: resource.format,
    accessRule: resource.accessRule,
    accessKey: resource.accessKey,
    color: resource.color,
    symbol: resource.symbol,
    subtitle: resource.subtitle,
    description: resource.description,
    metadata: typedArray(resource.metadata, "resourceMetadataItem", "metadata"),
    progress: resource.progress,
  };
}

function toFaqDocument(faq) {
  return {
    _id: documentId("faq", faq.stableId),
    _type: "faq",
    stableId: faq.stableId,
    slug: faq.slug,
    title: faq.title,
    status: faq.status,
    sortOrder: faq.sortOrder,
    items: typedArray(faq.items, "faqItem", "faq-item"),
  };
}

function initialDocuments() {
  return [
    {
      _id: "editorial.site-settings.animation-made",
      _type: "siteSettings",
      ...editorialFallback.siteSettings,
    },
    ...editorialFallback.pages.map(toPageDocument),
    ...editorialFallback.offers.map(toOfferDocument),
    ...editorialFallback.resources.map(toResourceDocument),
    ...editorialFallback.faqs.map(toFaqDocument),
  ];
}

async function main() {
  const missing = [];
  if (conflictFields.length) missing.push(`configuration conflict: ${conflictFields.join(", ")}`);
  if (!dataset) missing.push("SANITY_DATASET/NEXT_PUBLIC_SANITY_DATASET");
  if (!token) missing.push("SANITY_WRITE_TOKEN");
  if (missing.length) {
    console.error(`Seed Sanity impossible : ${missing.join(", ")} manquant(s).`);
    process.exitCode = 2;
    return;
  }

  const client = createClient({ projectId, dataset, apiVersion, useCdn: false, token, perspective: "published" });
  const documents = initialDocuments();
  let transaction = client.transaction();
  for (const document of documents) {
    transaction = force
      ? transaction.createOrReplace(document)
      : transaction.createIfNotExists(document);
  }
  await transaction.commit({ visibility: "async" });
  console.log(`${documents.length} documents Sanity préparés (${force ? "remplacement" : "création si absent"}).`);
}

await main();
