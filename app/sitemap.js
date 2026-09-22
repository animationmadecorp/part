import { SITE_ORIGIN } from "@/lib/seo";

const publicPaths = [
  "/",
  "/nouveau/anglais",
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

export default function sitemap() {
  return publicPaths.map((path) => ({
    url: `${SITE_ORIGIN}${path}`,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
