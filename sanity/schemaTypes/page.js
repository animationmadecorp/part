import { defineField, defineType } from "sanity";

export const page = defineType({
  name: "page",
  title: "Page publique",
  type: "document",
  fields: [
    defineField({ name: "stableId", title: "Identifiant stable", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "slug", title: "Slug", type: "slug", options: { source: "title", maxLength: 96 }, validation: (Rule) => Rule.required() }),
    defineField({ name: "title", title: "Titre interne", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "description", title: "Description publique", type: "text", rows: 3 }),
    defineField({ name: "status", title: "Statut", type: "string", options: { list: ["draft", "published", "archived"], layout: "radio" }, initialValue: "draft", validation: (Rule) => Rule.required() }),
    defineField({ name: "seo", title: "SEO", type: "seo" }),
    defineField({ name: "hero", title: "En-tête", type: "editorialHero" }),
    defineField({ name: "sections", title: "Sections", type: "array", of: [{ type: "editorialContentSection" }] }),
    defineField({ name: "sortOrder", title: "Ordre", type: "number", initialValue: 0 }),
  ],
  preview: { select: { title: "title", subtitle: "slug.current", status: "status" }, prepare: ({ title, subtitle, status }) => ({ title: `${status === "published" ? "●" : "○"} ${title}`, subtitle }) },
});
