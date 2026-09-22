import { getSanityClient } from "./config";
import { SANITY_EDITORIAL_REVALIDATE_SECONDS } from "./queries";
import { uniquePublishedArticles } from "./article-core.mjs";

export const ARTICLE_TAG = "sanity:article";
const fields = `{_id, title, "slug": slug.current, summary, category, body[]{..., _type == "image" => { ..., "url": asset->url }}, publishedAt, status, "coverUrl": cover.asset->url, "coverAlt": cover.alt}`;

async function fetchArticles(query, params = {}) {
  const client = getSanityClient();
  if (!client) throw new Error("Lecture des articles indisponible : configuration Sanity manquante.");
  try {
    return await client.fetch(query, params, { cache: "force-cache", next: { revalidate: SANITY_EDITORIAL_REVALIDATE_SECONDS, tags: [ARTICLE_TAG] } });
  } catch (error) {
    console.error("Lecture Sanity des articles échouée", error);
    throw new Error("Lecture des articles momentanément indisponible.");
  }
}

export async function getPublishedArticles() {
  const values = await fetchArticles(`*[_type == "article" && !(_id in path("drafts.**")) && status == "published"] | order(publishedAt desc, _createdAt desc) ${fields}`);
  return uniquePublishedArticles(values);
}

export async function getPublishedArticle(slug) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug || "")) return null;
  const values = await fetchArticles(`*[_type == "article" && !(_id in path("drafts.**")) && status == "published" && slug.current == $slug] | order(_createdAt asc) ${fields}`, { slug });
  return uniquePublishedArticles(values)[0] || null;
}
