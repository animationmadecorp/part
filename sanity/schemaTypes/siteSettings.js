import { defineField, defineType } from "sanity";

export const siteSettings = defineType({
  name: "siteSettings",
  title: "Réglages du site",
  type: "document",
  fields: [
    defineField({ name: "stableId", title: "Identifiant stable", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "brand", title: "Marque", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "status", title: "Statut", type: "string", options: { list: ["draft", "published", "archived"], layout: "radio" }, initialValue: "draft", validation: (Rule) => Rule.required() }),
    defineField({ name: "defaultPage", title: "Page d’accueil", type: "reference", to: [{ type: "page" }] }),
  ],
  preview: { select: { title: "brand", subtitle: "stableId", status: "status" }, prepare: ({ title, subtitle, status }) => ({ title: `${status === "published" ? "●" : "○"} ${title}`, subtitle }) },
});
