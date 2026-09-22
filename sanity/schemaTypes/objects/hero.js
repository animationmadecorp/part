import { defineField, defineType } from "sanity";

export const editorialHero = defineType({
  name: "editorialHero",
  title: "En-tête éditorial",
  type: "object",
  fields: [
    defineField({ name: "eyebrow", title: "Surtitre", type: "string" }),
    defineField({ name: "title", title: "Titre", type: "string", description: "Utiliser un retour à la ligne pour conserver le rythme visuel." }),
    defineField({ name: "emphasisPrefix", title: "Avant le mot en italique", type: "string" }),
    defineField({ name: "emphasis", title: "Fin en italique", type: "string" }),
    defineField({ name: "lead", title: "Introduction", type: "text", rows: 5 }),
  ],
});
