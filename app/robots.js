import { SITE_ORIGIN } from "@/lib/seo";

const privatePaths = [
  "/admin",
  "/anglais",
  "/api",
  "/bibliotheque",
  "/carte",
  "/dashboard",
  "/editor",
  "/lessons",
  "/login",
  "/nouveau/bibliotheque",
  "/nouveau/confirmation",
  "/nouveau/demandes",
  "/nouveau/feedback/projet/questionnaire",
  "/nouveau/feedback/questionnaire",
  "/nouveau/reserver",
  "/nouveau/review/questionnaire",
  "/nouveau/studio",
  "/nouveau/visibilite/questionnaire",
  "/onboarding",
  "/preferences",
  "/review",
  "/sign-in",
  "/sign-up",
  "/signup",
  "/tools",
  "/tracker",
];

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: privatePaths,
    },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
