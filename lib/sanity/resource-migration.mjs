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

function blockText(block) {
  return block?._type === "block" ? (block.children || []).map((child) => child?.text || "").join("").trim() : "";
}

function copyPortableTextBlock(block) {
  if (!block || typeof block !== "object") return null;
  if (block._type === "image") return null;
  if (block._type !== "block") return null;
  return { ...block };
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function extractLegacySections(body) {
  const blocks = Array.isArray(body) ? body : [];
  const installationHeadingIndex = blocks.findIndex((block) => /^installation$/i.test(blockText(block)));
  if (installationHeadingIndex < 0) {
    return { recap: blocks.map(copyPortableTextBlock).filter(Boolean), installation: [], license: "", technicalDetails: [] };
  }

  const recap = blocks.slice(0, installationHeadingIndex).map(copyPortableTextBlock).filter(Boolean);
  const installation = blocks.slice(installationHeadingIndex + 1, installationHeadingIndex + 2).map(copyPortableTextBlock).filter(Boolean);
  const licenceBlock = blocks[installationHeadingIndex + 2];
  const licenceText = blockText(licenceBlock);
  const licenceMatch = licenceText.match(/\bLicence\s+([A-Za-z0-9.+-]+)/i);
  const extractedLicense = licenceMatch?.[1]?.replace(/[.,;:]+$/, "") || "";
  const versionMatch = licenceText.match(/\bVersion\s+([0-9]+(?:\.[0-9]+)*)/i);
  const blenderMatch = licenceText.match(/\bBlender\s+([0-9]+(?:\.[0-9]+)*)\s+minimum/i);
  const technicalDetails = [
    versionMatch ? { _key: "detail-version", _type: "resourceDetailItem", label: "Version", value: versionMatch[1] } : null,
    blenderMatch ? { _key: "detail-compatibility", _type: "resourceDetailItem", label: "Compatibilité", value: `Blender ${blenderMatch[1]} minimum · à vérifier sur ta version` } : null,
  ].filter(Boolean);

  return {
    recap,
    installation,
    license: extractedLicense === "GPL-3.0-or-later" ? extractedLicense : "",
    technicalDetails,
  };
}

export function buildResourceStructurePatch(resource) {
  const { gallery } = resolveResourceMedia(resource);
  const legacySections = extractLegacySections(resource.body);
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

  if (!resource.recap?.length && legacySections.recap.length > 0) {
    patch.recap = legacySections.recap;
    notes.push(`${legacySections.recap.length} bloc(s) de récapitulatif sans image`);
  }
  if (!resource.installation?.length && legacySections.installation.length > 0) {
    patch.installation = legacySections.installation;
    notes.push("installation extraite du corps legacy");
  }
  if (!resource.license && legacySections.license) {
    patch.license = legacySections.license;
    notes.push("licence extraite du corps legacy");
  }
  if (!Array.isArray(resource.technicalDetails) || resource.technicalDetails.length === 0) {
    if (legacySections.technicalDetails.length > 0) {
      patch.technicalDetails = legacySections.technicalDetails;
      notes.push("version et compatibilité extraites avec mention de vérification");
    }
  }
  if (Array.isArray(resource.metadata)) {
    const metadata = resource.metadata
      .filter((item) => item?.label === "Éclairages")
      .map((item) => ({
        ...(item?._key ? { _key: item._key } : {}),
        ...(item?._type ? { _type: item._type } : {}),
        label: item.label,
        value: item.value,
      }));
    if (!sameJson(metadata, resource.metadata)) {
      patch.metadata = metadata;
      notes.push("metadata conservées : Éclairages uniquement");
    }
  }

  if (!resource.license && !legacySections.license) notes.push("licence à confirmer manuellement");
  return { patch, notes };
}

export { extractLegacySections };
