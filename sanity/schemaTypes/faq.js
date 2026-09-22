import { defineField, defineType } from "sanity";

export const faqItem = defineType({
  name: "faqItem",
  title: "Question",
  type: "object",
  fields: [
    defineField({ name: "stableId", title: "Identifiant stable", type: "string" }),
    defineField({ name: "question", title: "Question", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "answer", title: "Réponse", type: "text", rows: 6, validation: (Rule) => Rule.required() }),
    defineField({ name: "sortOrder", title: "Ordre", type: "number", initialValue: 0 }),
  ],
  preview: { select: { title: "question", subtitle: "stableId" } },
});

export const faq = defineType({
  name: "faq",
  title: "FAQ publique",
  type: "document",
  fields: [
    defineField({ name: "stableId", title: "Identifiant stable", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "slug", title: "Slug", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "title", title: "Titre", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "status", title: "Statut", type: "string", options: { list: ["draft", "published", "archived"], layout: "radio" }, initialValue: "draft", validation: (Rule) => Rule.required() }),
    defineField({ name: "sortOrder", title: "Ordre", type: "number", initialValue: 0 }),
    defineField({ name: "items", title: "Questions", type: "array", of: [{ type: "faqItem" }] }),
  ],
  preview: { select: { title: "title", subtitle: "slug", status: "status" }, prepare: ({ title, subtitle, status }) => ({ title: `${status === "published" ? "●" : "○"} ${title}`, subtitle }) },
});
