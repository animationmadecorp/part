import { defineField, defineType } from "sanity";

export const resourceMetadataItem = defineType({
  name: "resourceMetadataItem",
  title: "Métadonnée de ressource",
  type: "object",
  fields: [
    defineField({ name: "download", title: "ZIP public (ressource gratuite uniquement)", type: "file", options: { accept: ".zip" } }),
    defineField({ name: "presentationSlug", title: "Slug de la fiche de présentation", type: "string" }),
    defineField({ name: "label", title: "Libellé", type: "string" }),
    defineField({ name: "value", title: "Valeur", type: "string" }),
  ],
  preview: { select: { title: "label", subtitle: "value" } },
});

export const resourcePresentation = defineType({
  name: "resourcePresentation",
  title: "Ressource publique",
  type: "document",
  fields: [
    defineField({ name: "stableId", title: "Identifiant stable", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "slug", title: "Slug", type: "string" }),
    defineField({ name: "title", title: "Titre", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "status", title: "Statut", type: "string", options: { list: ["draft", "published", "archived"], layout: "radio" }, initialValue: "draft", validation: (Rule) => Rule.required() }),
    defineField({ name: "sortOrder", title: "Ordre", type: "number", initialValue: 0 }),
    defineField({ name: "collection", title: "Collection", type: "string" }),
    defineField({ name: "format", title: "Format", type: "string" }),
    defineField({ name: "accessRule", title: "Règle éditoriale d’accès", type: "string", options: { list: ["free", "member", "offer", "purchase"] }, description: "Cette règle décrit l’intention éditoriale ; Convex vérifie toujours le droit effectif." }),
    defineField({ name: "accessKey", title: "Clé de droit", type: "string" }),
    defineField({ name: "color", title: "Couleur", type: "string", options: { list: ["peach", "pink", "yellow", "blue"] } }),
    defineField({ name: "symbol", title: "Symbole", type: "string" }),
    defineField({ name: "subtitle", title: "Sous-titre", type: "string" }),
    defineField({ name: "description", title: "Description", type: "text", rows: 4 }),
    defineField({ name: "metadata", title: "Métadonnées", type: "array", of: [{ type: "resourceMetadataItem" }] }),
    defineField({ name: "progress", title: "Progression de démonstration", type: "number", validation: (Rule) => Rule.min(0).max(100) }),
  ],
  preview: { select: { title: "title", subtitle: "collection", status: "status" }, prepare: ({ title, subtitle, status }) => ({ title: `${status === "published" ? "●" : "○"} ${title}`, subtitle }) },
});
