import { defineField, defineType } from "sanity";

export const article = defineType({
  name: "article", title: "Article", type: "document",
  fields: [
    defineField({ name: "title", title: "Titre", type: "string", validation: (Rule) => Rule.required().min(3) }),
    defineField({ name: "slug", title: "Adresse de l’article", type: "slug", options: { source: "title", maxLength: 96 }, validation: (Rule) => Rule.required() }),
    defineField({ name: "summary", title: "Résumé", type: "text", rows: 3, validation: (Rule) => Rule.required().max(320) }),
    defineField({ name: "cover", title: "Image de couverture", type: "image", options: { hotspot: true }, fields: [defineField({ name: "alt", title: "Description de l’image (alt)", type: "string", validation: (Rule) => Rule.required() })] }),
    defineField({ name: "category", title: "Catégorie", type: "string" }),
    defineField({ name: "body", title: "Corps de l’article", type: "array", of: [
      { type: "block", styles: [{ title: "Paragraphe", value: "normal" }, { title: "Titre 2", value: "h2" }, { title: "Titre 3", value: "h3" }], lists: [{ title: "Puces", value: "bullet" }, { title: "Numérotée", value: "number" }], marks: { decorators: [{ title: "Gras", value: "strong" }, { title: "Italique", value: "em" }], annotations: [{ name: "link", type: "object", title: "Lien", fields: [{ name: "href", type: "url", title: "Adresse", validation: (Rule) => Rule.uri({ scheme: ["https"], allowRelative: true }) }] }] } },
      { type: "image", options: { hotspot: true }, fields: [defineField({ name: "alt", title: "Description de l’image (alt)", type: "string", validation: (Rule) => Rule.required() })] },
    ], validation: (Rule) => Rule.required().min(1) }),
    defineField({ name: "publishedAt", title: "Date de publication", type: "datetime" }),
    defineField({ name: "status", title: "Statut", type: "string", options: { list: [{ title: "Brouillon", value: "draft" }, { title: "Publié", value: "published" }, { title: "Archivé", value: "archived" }], layout: "radio" }, initialValue: "draft", validation: (Rule) => Rule.required() }),
  ],
  preview: { select: { title: "title", status: "status", media: "cover" }, prepare: ({ title, status, media }) => ({ title, subtitle: status === "published" ? "Publié" : status === "archived" ? "Archivé" : "Brouillon", media }) },
});
