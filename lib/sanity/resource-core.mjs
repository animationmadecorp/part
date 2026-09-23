import { safeArticleUrl } from "./article-core.mjs";

function stringOr(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function mediaIdentity(item) {
  const assetRef = stringOr(item?.assetRef);
  if (assetRef) return `asset:${assetRef}`;
  const url = stringOr(item?.url);
  return url ? `${item?.type || "media"}:${url}` : "";
}

function uniqueMedia(items) {
  const seen = new Set();
  return items.filter((item) => {
    const identity = mediaIdentity(item);
    if (!identity || seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function normalizeImage(value, fallbackAlt = "Aperçu de la ressource") {
  const url = safeArticleUrl(value?.url || value?.imageUrl, { image: true });
  if (!url) return null;
  const alt = stringOr(value?.alt || value?.imageAlt || value?.caption, fallbackAlt);
  return {
    type: "image",
    url,
    alt,
    assetRef: stringOr(value?.assetRef || value?.imageAssetRef || value?.asset?._ref),
    caption: stringOr(value?.caption),
  };
}

function normalizeVideo(value, fallbackAlt = "Vidéo de présentation de la ressource") {
  const url = safeArticleUrl(value?.url || value?.videoUrl);
  if (!url) return null;
  const posterUrl = safeArticleUrl(value?.posterUrl, { image: true });
  return {
    type: "video",
    url,
    alt: stringOr(value?.alt || value?.caption, fallbackAlt),
    assetRef: stringOr(value?.assetRef || value?.videoAssetRef || value?.asset?._ref),
    posterUrl,
    posterAlt: stringOr(value?.posterAlt),
    caption: stringOr(value?.caption),
  };
}

export function normalizeResourceGallery(value, fallbackAlt = "Aperçu de la ressource") {
  if (!Array.isArray(value)) return [];
  return uniqueMedia(value.map((item) => {
    const type = item?.mediaType === "video" || item?.type === "video" ? "video" : "image";
    return type === "video" ? normalizeVideo(item, fallbackAlt) : normalizeImage(item, fallbackAlt);
  }).filter(Boolean));
}

export function normalizeResourcePortableText(value) {
  if (!Array.isArray(value)) return [];
  return value.map((block) => {
    if (!block || typeof block !== "object") return null;
    if (block._type === "block" && Array.isArray(block.children)) return block;
    if (block._type === "image") {
      const url = safeArticleUrl(block.url, { image: true });
      return url && stringOr(block.alt) ? { ...block, url } : null;
    }
    return null;
  }).filter(Boolean);
}

export function deriveLegacyGallery({ coverUrl, coverAlt, coverAssetRef, body, title } = {}) {
  const fallbackAlt = title ? `Aperçu de ${title}` : "Aperçu de la ressource";
  const cover = normalizeImage({ url: coverUrl, alt: coverAlt, assetRef: coverAssetRef }, fallbackAlt);
  const bodyImages = Array.isArray(body)
    ? body.filter((block) => block?._type === "image").map((block) => normalizeImage({
      url: block.url,
      alt: block.alt,
      assetRef: block.assetRef || block.asset?._ref,
    }, fallbackAlt)).filter(Boolean)
    : [];
  return uniqueMedia([cover, ...bodyImages].filter(Boolean));
}

export function stripGalleryImages(body, gallery) {
  if (!Array.isArray(body)) return [];
  const galleryKeys = new Set(gallery.flatMap((item) => {
    const keys = [];
    if (item.assetRef) keys.push(`asset:${item.assetRef}`);
    if (item.url) keys.push(`${item.type}:${item.url}`);
    return keys;
  }));
  return body.filter((block) => {
    if (block?._type !== "image") return true;
    const assetRef = stringOr(block.assetRef || block.asset?._ref);
    const url = safeArticleUrl(block.url, { image: true });
    return !galleryKeys.has(`asset:${assetRef}`) && !galleryKeys.has(`image:${url}`);
  });
}

export function resolveResourceMedia(resource = {}) {
  const explicitGallery = normalizeResourceGallery(resource.gallery, resource.title && `Aperçu de ${resource.title}`);
  const legacyImages = deriveLegacyGallery(resource);
  const bodyImages = Array.isArray(resource.body) && resource.body.some((block) => block?._type === "image");
  const gallery = explicitGallery.length ? explicitGallery : bodyImages ? legacyImages : [];
  const legacyCover = !gallery.length ? legacyImages[0] || null : null;
  return {
    gallery,
    legacyCover,
    legacyBody: stripGalleryImages(resource.body, gallery),
    usedLegacyGallery: !explicitGallery.length && gallery.length > 0,
  };
}
