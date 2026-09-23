import { resolveResourceMedia } from "./resource-core.mjs";

function slugKey(value) {
  return String(value || "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "media";
}

function toSanityGalleryItem(item, index) {
  if (!item?.assetRef || item.type !== "image") return null;
  return {
    _key: `gallery-${index + 1}-${slugKey(item.assetRef).slice(0, 48)}`,
    _type: "resourceGalleryItem",
    mediaType: "image",
    image: {
      _type: "image",
      asset: { _type: "reference", _ref: item.assetRef },
      alt: item.alt,
    },
    ...(item.caption ? { caption: item.caption } : {}),
  };
}

export function buildResourceStructurePatch(resource) {
  const { gallery } = resolveResourceMedia(resource);
  const patch = {};
  const notes = [];

  if (!resource.summary && resource.subtitle) {
    patch.summary = resource.subtitle;
    notes.push("summary depuis subtitle");
  }

  if (!Array.isArray(resource.gallery) || resource.gallery.length === 0) {
    const galleryItems = gallery.map(toSanityGalleryItem).filter(Boolean);
    if (galleryItems.length > 0) {
      patch.gallery = galleryItems;
      notes.push(`${galleryItems.length} image(s) dédupliquée(s) depuis cover/body`);
    }
  }

  if (!resource.installation?.length && resource.body?.some((block) => block?._type === "block")) {
    notes.push("installation à structurer manuellement depuis le corps legacy");
  }
  if (!resource.license) notes.push("licence à confirmer manuellement");
  return { patch, notes };
}
