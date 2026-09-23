const PUBLIC_DOCUMENT_FILTER = '!(_id in path("drafts.**")) && status == "published"';
const DRAFT_DOCUMENT_FILTER = '!(_id in path("versions.**")) && status != "archived"';

export const SANITY_EDITORIAL_TAG = "sanity:editorial";
export const SANITY_EDITORIAL_REVALIDATE_SECONDS = 60;

function editorialQuery(documentFilter) {
  return `{
  "editorialMeta": {
    "documentCount": count(*[_type in ["siteSettings", "page", "offer", "resourcePresentation", "faq"] && ${documentFilter}])
  },
  "siteSettings": *[_type == "siteSettings" && ${documentFilter} && stableId == "site-settings:animation-made"][0]{
    stableId,
    status,
    brand
  },
  "pages": *[_type == "page" && ${documentFilter}] | order(sortOrder asc){
    stableId,
    status,
    title,
    "slug": slug.current,
    seo{title, description, noIndex},
    hero{eyebrow, title, emphasisPrefix, emphasis, lead},
    sections[]{stableId, style, eyebrow, heading, emphasis, body, ctaLabel, ctaHref, sheetLabel, sheetTitle, sheetBody, items[]{stableId, title, body}},
    sortOrder
  },
  "offers": *[_type == "offer" && ${documentFilter}] | order(sortOrder asc){
    stableId,
    status,
    slug,
    number,
    title,
    category,
    description,
    icon,
    color,
    entitlementKey,
    checkoutVariantId,
    sortOrder
  },
  "resources": *[_type == "resourcePresentation" && ${documentFilter}] | order(sortOrder asc){
    "downloadUrl": select(accessRule == "free" => download.asset->url),
    presentationSlug,
    summary,
    "coverUrl": cover.asset->url,
    "coverAlt": cover.alt,
    "coverAssetRef": cover.asset._ref,
    gallery[]{
      _key,
      mediaType,
      caption,
      "imageUrl": image.asset->url,
      "imageAlt": image.alt,
      "imageAssetRef": image.asset._ref,
      "videoUrl": video.asset->url,
      "videoAssetRef": video.asset._ref,
      "posterUrl": poster.asset->url,
      "posterAlt": poster.alt
    },
    recap[]{..., _type == "image" => { ..., "url": asset->url }},
    installation[]{..., _type == "image" => { ..., "url": asset->url }},
    technicalDetails[]{label, value},
    license,
    body[]{..., _type == "image" => { ..., "url": asset->url, "assetRef": asset._ref }},
    stableId,
    status,
    slug,
    title,
    collection,
    format,
    accessRule,
    accessKey,
    color,
    symbol,
    subtitle,
    description,
    metadata[]{label, value},
    progress,
    sortOrder
  },
  "faqs": *[_type == "faq" && ${documentFilter}] | order(sortOrder asc){
    stableId,
    status,
    slug,
    title,
    items[]{stableId, question, answer, sortOrder},
    sortOrder
  }
}`;
}

export const PUBLIC_EDITORIAL_QUERY = editorialQuery(PUBLIC_DOCUMENT_FILTER);
export const DRAFT_EDITORIAL_QUERY = editorialQuery(DRAFT_DOCUMENT_FILTER);
