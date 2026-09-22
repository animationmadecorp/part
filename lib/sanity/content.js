import { draftMode } from "next/headers";
import { editorialFallback } from "../../app/nouveau/_data/content.js";
import { getSanityClient } from "./config";
import {
  DRAFT_EDITORIAL_QUERY,
  PUBLIC_EDITORIAL_QUERY,
  SANITY_EDITORIAL_REVALIDATE_SECONDS,
  SANITY_EDITORIAL_TAG,
} from "./queries";

const SAFE_ICONS = new Set(["film", "frames", "globe", "sparkles"]);
const SAFE_COLORS = new Set(["peach", "pink", "yellow", "blue"]);
const SAFE_ACCESS = new Set(["free", "review", "english", "visibility"]);
const SAFE_ACCESS_RULES = new Set(["free", "member", "offer", "purchase"]);
const SAFE_SECTION_STYLES = new Set(["default", "cards", "steps", "list", "problems", "feature", "prose", "bio", "gift"]);

function stringOr(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function deepMerge(base, override) {
  if (Array.isArray(override)) return override;
  if (!override || typeof override !== "object") return override ?? base;
  const result = { ...(base && typeof base === "object" ? base : {}) };
  for (const [key, value] of Object.entries(override)) {
    result[key] = value && typeof value === "object" && !Array.isArray(value)
      ? deepMerge(result[key], value)
      : value;
  }
  return result;
}

function normalizePage(value) {
  if (!value?.stableId) return null;
  return {
    ...value,
    slug: stringOr(value.slug, "/nouveau"),
    title: stringOr(value.title),
    description: stringOr(value.description),
    hero: value.hero && typeof value.hero === "object" ? value.hero : {},
    seo: value.seo && typeof value.seo === "object" ? value.seo : {},
    sections: Array.isArray(value.sections)
      ? value.sections.map(normalizeSection).filter(Boolean)
      : [],
  };
}

function normalizeSection(value) {
  if (!value?.stableId) return null;
  return {
    stableId: value.stableId,
    style: SAFE_SECTION_STYLES.has(value.style) ? value.style : "default",
    eyebrow: stringOr(value.eyebrow),
    heading: stringOr(value.heading),
    emphasis: stringOr(value.emphasis),
    body: stringOr(value.body),
    ctaLabel: stringOr(value.ctaLabel),
    ctaHref: isSafeEditorialPath(value.ctaHref) ? value.ctaHref : "",
    sheetLabel: stringOr(value.sheetLabel),
    sheetTitle: stringOr(value.sheetTitle),
    sheetBody: stringOr(value.sheetBody),
    items: Array.isArray(value.items)
      ? value.items
        .filter((item) => item && (item.title || item.body))
        .map((item, index) => ({
          stableId: stringOr(item.stableId, `${value.stableId}:item-${index + 1}`),
          title: stringOr(item.title),
          body: stringOr(item.body),
        }))
      : [],
  };
}

function normalizeOffer(value) {
  if (!value?.stableId) return null;
  return {
    ...value,
    slug: stringOr(value.slug),
    icon: SAFE_ICONS.has(value.icon) ? value.icon : "sparkles",
    color: SAFE_COLORS.has(value.color) ? value.color : "peach",
    title: stringOr(value.title),
    description: stringOr(value.description),
  };
}

function normalizeResource(value) {
  if (!value?.stableId) return null;
  const rawAccessKey = stringOr(value.accessKey, stringOr(value.access));
  const accessKey = { contenu: "visibility", anglais: "english" }[rawAccessKey] || rawAccessKey;
  const accessRule = SAFE_ACCESS_RULES.has(value.accessRule) ? value.accessRule : "locked";
  const access = accessRule === "free"
    ? "free"
    : SAFE_ACCESS.has(accessKey) && accessKey !== "free"
      ? accessKey
      : "locked";
  const presentation = { ...value };
  delete presentation.content;
  delete presentation.previewContent;
  delete presentation.privateAssetRef;
  return {
    ...presentation,
    id: stringOr(value.id, value.stableId.replace(/^resource:/, "")),
    access,
    accessRule,
    accessKey: access === "visibility" ? "contenu" : access === "english" ? "anglais" : rawAccessKey,
    color: SAFE_COLORS.has(value.color) ? value.color : "peach",
    title: stringOr(value.title),
    collection: stringOr(value.collection),
    format: stringOr(value.format),
    metadata: Array.isArray(value.metadata)
      ? value.metadata
        .map((item) => ({ label: stringOr(item?.label), value: stringOr(item?.value) }))
        .filter((item) => item.label || item.value)
      : [],
    // Resource lesson bodies and private assets are intentionally never part
    // of the public editorial payload. Access is decided by the member area.
    content: [],
  };
}

function normalizeFaq(value) {
  if (!value?.stableId) return null;
  return {
    ...value,
    slug: stringOr(value.slug, value.stableId.replace(/^faq:/, "")),
    title: stringOr(value.title, "Questions fréquentes"),
    items: Array.isArray(value.items)
      ? value.items.filter((item) => item?.question && item?.answer)
      : [],
  };
}

function mergeCollection(fallback, remote, normalize) {
  if (!Array.isArray(remote)) {
    return (Array.isArray(fallback) ? fallback : []).map(normalize).filter(Boolean)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  const base = (Array.isArray(fallback) ? fallback : []).map(normalize).filter(Boolean);
  const byId = new Map(base.map((item) => [item.stableId, item]));
  const remoteItems = [];
  for (const candidate of remote) {
    const item = normalize(candidate);
    if (!item) continue;
    remoteItems.push(deepMerge(byId.get(item.stableId), item));
  }
  return remoteItems.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

async function draftModeEnabled() {
  try {
    return (await draftMode()).isEnabled;
  } catch {
    return false;
  }
}

async function readRemoteEditorialContent({ drafts }) {
  try {
    const client = getSanityClient({ drafts });
    if (!client) return null;
    return await client.fetch(
      drafts ? DRAFT_EDITORIAL_QUERY : PUBLIC_EDITORIAL_QUERY,
      {},
      drafts
        ? { cache: "no-store" }
        : {
            cache: "force-cache",
            next: { revalidate: SANITY_EDITORIAL_REVALIDATE_SECONDS, tags: [SANITY_EDITORIAL_TAG] },
          },
    );
  } catch {
    return null;
  }
}

function fallbackEditorialContent(drafts) {
  return {
    siteSettings: { ...editorialFallback.siteSettings },
    pages: editorialFallback.pages.map(normalizePage).filter(Boolean),
    offers: editorialFallback.offers.map(normalizeOffer).filter(Boolean),
    resources: editorialFallback.resources.map(normalizeResource).filter(Boolean),
    faqs: editorialFallback.faqs.map(normalizeFaq).filter(Boolean),
    source: "fixture",
    preview: drafts,
  };
}

export function isEditorialCatalogInitialized(remote) {
  const documentCount = remote?.editorialMeta?.documentCount;
  if (typeof documentCount === "number" && Number.isFinite(documentCount)) {
    return documentCount > 0;
  }

  // Keep compatibility with older cached/query-shaped payloads that do not
  // contain the metadata marker. Any editorial document means an initialized
  // catalog, including a catalog that intentionally publishes an empty
  // collection such as offers or resources.
  return Boolean(
    remote?.siteSettings
    || ["pages", "offers", "resources", "faqs"].some((key) => Array.isArray(remote?.[key]) && remote[key].length > 0),
  );
}

export function resolveEditorialContent(remote, drafts = false) {
  if (!remote || !isEditorialCatalogInitialized(remote)) {
    return fallbackEditorialContent(drafts);
  }

  return {
    siteSettings: deepMerge(editorialFallback.siteSettings, remote.siteSettings || {}),
    pages: mergeCollection(editorialFallback.pages, remote.pages, normalizePage),
    offers: mergeCollection(editorialFallback.offers, remote.offers, normalizeOffer),
    resources: mergeCollection(editorialFallback.resources, remote.resources, normalizeResource),
    faqs: mergeCollection(editorialFallback.faqs, remote.faqs, normalizeFaq),
    source: drafts ? "sanity-draft" : "sanity",
    preview: drafts,
  };
}

export async function getPublicEditorialContent() {
  const drafts = await draftModeEnabled();
  const remote = await readRemoteEditorialContent({ drafts });
  return resolveEditorialContent(remote, drafts);
}

export async function getEditorialPage(slug) {
  const editorial = await getPublicEditorialContent();
  return editorial.pages.find((page) => page.slug === slug) || null;
}

export async function getEditorialFaq(slug = "nouveau-offres") {
  const editorial = await getPublicEditorialContent();
  return editorial.faqs.find((faq) => faq.slug === slug) || null;
}

export function isSafeEditorialPath(value) {
  return typeof value === "string" && value.startsWith("/nouveau") && !value.startsWith("//") && !value.includes("\\");
}
