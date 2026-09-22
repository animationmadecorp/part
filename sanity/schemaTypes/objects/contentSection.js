import { defineField, defineType } from "sanity";

const contentItem = defineType({
  name: "editorialContentItem",
  title: "Élément de contenu",
  type: "object",
  fields: [
    defineField({ name: "stableId", title: "Identifiant stable", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "title", title: "Titre", type: "string" }),
    defineField({ name: "body", title: "Texte", type: "text", rows: 4 }),
  ],
  preview: { select: { title: "title", subtitle: "stableId" } },
});

export const editorialContentSection = defineType({
  name: "editorialContentSection",
  title: "Section éditoriale",
  type: "object",
  fields: [
    defineField({ name: "stableId", title: "Identifiant stable", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "style", title: "Présentation", type: "string", options: { list: ["default", "cards", "steps", "list", "problems", "feature", "prose", "bio", "gift"], layout: "radio" }, initialValue: "default" }),
    defineField({ name: "eyebrow", title: "Sur-titre", type: "string" }),
    defineField({ name: "heading", title: "Titre", type: "string" }),
    defineField({ name: "emphasis", title: "Fin en italique", type: "string" }),
    defineField({ name: "body", title: "Texte", type: "text", rows: 5 }),
    defineField({ name: "ctaLabel", title: "Libellé du bouton", type: "string" }),
    defineField({ name: "ctaHref", title: "Lien interne du bouton", type: "string" }),
    defineField({ name: "sheetLabel", title: "Libellé de la fiche", type: "string" }),
    defineField({ name: "sheetTitle", title: "Titre de la fiche", type: "string" }),
    defineField({ name: "sheetBody", title: "Texte de la fiche", type: "text", rows: 4 }),
    defineField({ name: "items", title: "Éléments", type: "array", of: [{ type: "editorialContentItem" }] }),
  ],
  preview: { select: { title: "heading", subtitle: "stableId" } },
});

export { contentItem };
