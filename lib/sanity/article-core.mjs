export const ARTICLE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugFromTitle(title) {
  return String(title || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 96).replace(/-$/, "");
}

export function safeArticleUrl(value, { image = false } = {}) {
  if (typeof value !== "string") return "";
  if (!image && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return "";
    const project = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || process.env.SANITY_PROJECT_ID || "ez6qtt5k";
    const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || process.env.SANITY_DATASET || "production";
    if (image && (url.hostname !== "cdn.sanity.io" || !url.pathname.startsWith(`/images/${project}/${dataset}/`))) return "";
    return url.href;
  } catch { return ""; }
}

export function normalizeArticle(value) {
  const slug = value?.slug?.current ?? value?.slug;
  if (value?._id?.startsWith("drafts.") || value?._id?.startsWith("versions.") || value?.status !== "published" || !ARTICLE_SLUG.test(slug || "") || !value?.title?.trim() || !value?.summary?.trim() || !Array.isArray(value?.body) || !value.body.length) return null;
  return { ...value, slug, publishedAt: value.publishedAt && Number.isFinite(Date.parse(value.publishedAt)) ? value.publishedAt : null, coverUrl: safeArticleUrl(value.coverUrl, { image: true }), coverAlt: value.coverAlt || "" };
}

export function uniquePublishedArticles(values) {
  const seen = new Set();
  return (Array.isArray(values) ? values : []).map(normalizeArticle).filter((item) => {
    if (!item || seen.has(item.slug)) return false;
    seen.add(item.slug);
    return true;
  });
}

export function resolveArticleIdentity(candidates, slug) {
  const ids = [...new Set((candidates || []).map(({ _id }) => _id.replace(/^drafts\./, "")))];
  if (ids.length > 1) throw new Error("Slug utilisé par plusieurs articles : résoudre le conflit dans Studio.");
  return ids[0] || `article-${slug}`;
}

export function preservePublicDraftFields(fields, publicDoc) {
  if (!publicDoc) return fields;
  return { ...fields, publishedAt: fields.publishedAt || publicDoc.publishedAt || null, cover: fields.cover || publicDoc.cover };
}

export function shouldUploadCover({ coverPath, publish, hasDraft }) {
  return Boolean(coverPath && (!publish || !hasDraft));
}

export function validateArticleInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Article JSON invalide.");
  const title = String(input.title || "").trim();
  const slug = String(input.slug || slugFromTitle(title)).trim();
  const summary = String(input.summary || "").trim();
  const body = typeof input.body === "string" ? input.body.trim().split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => ({ _key: `p${index + 1}`, _type: "block", style: "normal", markDefs: [], children: [{ _key: `s${index + 1}`, _type: "span", marks: [], text: paragraph }] })) : input.body;
  if (title.length < 3 || !ARTICLE_SLUG.test(slug) || !summary || summary.length > 320 || !Array.isArray(body) || !body.length) throw new Error("Titre, slug, résumé ou corps invalide.");
  if (input.status && !["draft", "published", "archived"].includes(input.status)) throw new Error("Statut invalide.");
  if (input.coverUrl && (!safeArticleUrl(input.coverUrl, { image: true }) || !String(input.coverAlt || "").trim())) throw new Error("Couverture : URL Sanity HTTPS et alt requis.");
  if (input.coverPath && !String(input.coverAlt || "").trim()) throw new Error("Couverture : texte alternatif requis.");
  for (const block of body) {
    if (block?._type === "block") {
      if (!Array.isArray(block.children) || !Array.isArray(block.markDefs) || !["normal", "h2", "h3"].includes(block.style || "normal")) throw new Error("Bloc de texte invalide.");
      if (block.markDefs.some((mark) => mark._type !== "link" || !safeArticleUrl(mark.href))) throw new Error("URL de lien non autorisée.");
      if (block.children.some((child) => child._type !== "span" || typeof child.text !== "string")) throw new Error("Segment de texte invalide.");
    } else if (block?._type === "image") {
      if (!block.asset?._ref || !String(block.alt || "").trim()) throw new Error("Image : référence Sanity et alt requis.");
    } else throw new Error("Type de bloc non autorisé.");
  }
  if (input.publishedAt && !Number.isFinite(Date.parse(input.publishedAt))) throw new Error("Date de publication invalide.");
  return { title, slug, summary, body, category: String(input.category || "").trim(), publishedAt: input.publishedAt || null, coverPath: input.coverPath || "", coverUrl: input.coverUrl || "", coverAlt: String(input.coverAlt || "").trim() };
}
