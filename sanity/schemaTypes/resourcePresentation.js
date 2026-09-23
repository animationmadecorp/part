import { defineField, defineType } from "sanity";
import { article } from "./article";

const articleBodyField = article.fields.find(field => field.name === "body");
const articleCoverField = article.fields.find(field => field.name === "cover");

export const resourceGalleryItem = defineType({
  name: "resourceGalleryItem",
  title: "Média de galerie",
  type: "object",
  fields: [
    defineField({ name: "mediaType", title: "Type", type: "string", options: { list: [{ title: "Image", value: "image" }, { title: "Vidéo", value: "video" }], layout: "radio" }, initialValue: "image", validation: (Rule) => Rule.required() }),
    defineField({ name: "image", title: "Image", type: "image", options: { hotspot: true }, hidden: ({ parent }) => parent?.mediaType === "video", fields: [defineField({ name: "alt", title: "Description de l’image (alt)", type: "string", validation: (Rule) => Rule.required() })] }),
    defineField({ name: "video", title: "Vidéo", type: "file", options: { accept: "video/mp4,video/webm,video/quicktime" }, hidden: ({ parent }) => parent?.mediaType !== "video" }),
    defineField({ name: "poster", title: "Image d’aperçu vidéo (optionnelle)", type: "image", options: { hotspot: true }, hidden: ({ parent }) => parent?.mediaType !== "video", fields: [defineField({ name: "alt", title: "Description de l’aperçu", type: "string" })] }),
    defineField({ name: "caption", title: "Légende", type: "string" }),
  ],
  validation: (Rule) => Rule.custom((value) => {
    if (!value?.mediaType) return true;
    if (value.mediaType === "video" && !value.video?.asset) return "Ajoute un fichier vidéo.";
    if (value.mediaType === "image" && !value.image?.asset) return "Ajoute une image.";
    return true;
  }),
  preview: { select: { title: "caption", media: "image", mediaType: "mediaType" }, prepare: ({ title, media, mediaType }) => ({ title: title || (mediaType === "video" ? "Vidéo" : "Image"), media }) },
});

export const resourceDetailItem = defineType({
  name: "resourceDetailItem",
  title: "Détail technique",
  type: "object",
  fields: [
    defineField({ name: "label", title: "Libellé", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "value", title: "Valeur", type: "string", validation: (Rule) => Rule.required() }),
  ],
  preview: { select: { title: "label", subtitle: "value" } },
});

export const resourceMetadataItem = defineType({
  name: "resourceMetadataItem",
  title: "Métadonnée de ressource",
  type: "object",
  fields: [
    defineField({ name: "label", title: "Libellé", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "value", title: "Valeur", type: "string", validation: (Rule) => Rule.required() }),
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
    defineField({ name: "summary", title: "Phrase courte", type: "string", validation: (Rule) => Rule.max(220) }),
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
    defineField({ name: "gallery", title: "Galerie d’aperçus", type: "array", of: [{ type: "resourceGalleryItem" }], validation: (Rule) => Rule.max(8) }),
    defineField({ ...articleBodyField, name: "recap", title: "Récapitulatif", validation: undefined }),
    defineField({ ...articleBodyField, name: "installation", title: "Installation", validation: undefined }),
    defineField({ name: "technicalDetails", title: "Détails techniques", type: "array", of: [{ type: "resourceDetailItem" }] }),
    defineField({ name: "license", title: "Licence", type: "text", rows: 3 }),
    defineField({ ...articleBodyField, name: "body", title: "Ancien contenu complémentaire", validation: undefined }),
    defineField({ ...articleCoverField, name: "cover", title: "Couverture legacy", validation: undefined }),
    defineField({ name: "download", title: "Fichier public (ressource gratuite uniquement)", type: "file", options: { accept: ".zip,.pdf" } }),
    defineField({ name: "progress", title: "Progression de démonstration", type: "number", validation: (Rule) => Rule.min(0).max(100) }),
  ],
  preview: { select: { title: "title", subtitle: "collection", status: "status" }, prepare: ({ title, subtitle, status }) => ({ title: `${status === "published" ? "●" : "○"} ${title}`, subtitle }) },
});
