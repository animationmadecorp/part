import { SITE_ORIGIN } from "@/lib/seo";
import { getPublicEditorialContent } from "@/lib/sanity/content";
import { getPublishedArticles } from "@/lib/sanity/articles";

export const dynamic = "force-dynamic";

const publicPaths = [
  "/",
  "/nouveau/anglais",
  "/nouveau/articles",
  "/nouveau/cgv",
  "/nouveau/confidentialite",
  "/nouveau/contact",
  "/nouveau/feedback",
  "/nouveau/faq",
  "/nouveau/mentions-legales",
  "/nouveau/remboursements",
  "/nouveau/review",
  "/nouveau/visibilite",
];

export default async function sitemap() {
  const [editorial, articles] = await Promise.all([
    getPublicEditorialContent(),
    getPublishedArticles().catch(() => []),
  ]);
  const resourcePaths = editorial.source === "sanity"
    ? editorial.resources.filter((resource) => resource.downloadUrl).map((resource) => `/nouveau/ressources/${encodeURIComponent(resource.id)}`)
    : [];
  const articlePaths = articles.map((article) => `/nouveau/articles/${encodeURIComponent(article.slug)}`);
  return [...publicPaths, ...resourcePaths, ...articlePaths].map((path) => ({
    url: `${SITE_ORIGIN}${path}`,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
