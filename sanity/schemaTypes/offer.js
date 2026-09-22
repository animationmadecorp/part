import { defineField, defineType } from "sanity";

export const offer = defineType({
  name: "offer",
  title: "Offre publique",
  type: "document",
  fields: [
    defineField({ name: "stableId", title: "Identifiant stable", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "slug", title: "Slug de l’offre", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "number", title: "Numéro affiché", type: "string" }),
    defineField({ name: "title", title: "Titre", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "category", title: "Catégorie", type: "string" }),
    defineField({ name: "description", title: "Description", type: "text", rows: 4 }),
    defineField({ name: "icon", title: "Icône", type: "string", options: { list: ["film", "frames", "globe", "sparkles"] } }),
    defineField({ name: "color", title: "Couleur", type: "string", options: { list: ["peach", "pink", "yellow", "blue"] } }),
    defineField({ name: "status", title: "Statut", type: "string", options: { list: ["draft", "published", "archived"], layout: "radio" }, initialValue: "draft", validation: (Rule) => Rule.required() }),
    defineField({ name: "sortOrder", title: "Ordre", type: "number", initialValue: 0 }),
    defineField({ name: "entitlementKey", title: "Clé de droit métier", type: "string", description: "Clé stable consommée par Convex/Stripe. Le prix et le droit effectif restent côté serveur." }),
    defineField({ name: "checkoutVariantId", title: "Référence de variante de checkout", type: "string", description: "Référence éditoriale facultative uniquement. Ne contient ni prix contractuel ni secret." }),
  ],
  preview: { select: { title: "title", subtitle: "slug", status: "status" }, prepare: ({ title, subtitle, status }) => ({ title: `${status === "published" ? "●" : "○"} ${title}`, subtitle }) },
});
