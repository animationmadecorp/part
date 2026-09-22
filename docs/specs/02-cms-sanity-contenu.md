# SPEC-02 — CMS Sanity et contenu public

- Priorité : P0
- Statut : spécifiée, à valider
- Dépendances : SPEC-01

## Objectif

Permettre de créer et modifier pages, articles, FAQ, navigation et présentations produits sans toucher au code.

## Modèles Sanity

- `siteSettings`, `navigation`, `page`, `post`, `author`, `category`.
- `productPresentation`, `coursePresentation`, `module`, `lesson`.
- `resourcePresentation`, `faq`, `legalDocument`.
- Blocs réutilisables limités à une bibliothèque validée par le design.

## Règles

- Sanity contient uniquement du contenu éditorial, jamais de PII client ni de droit d'accès effectif.
- Chaque contenu possède un identifiant stable, un slug, un statut et des métadonnées SEO.
- Les fiches vendables référencent l'identifiant de variante Lemon Squeezy sans faire du prix affiché la valeur contractuelle.
- Brouillon et aperçu avant publication.
- Publication déclenchant une revalidation Next.js ciblée.
- Archivage plutôt que suppression d'un produit déjà vendu.
- Redirection obligatoire lors d'un changement de slug publié.

## Parcours administrateur

1. Créer ou modifier un brouillon dans Studio ou via MCP.
2. Prévisualiser sur le site.
3. Corriger les validations bloquantes.
4. Publier après confirmation humaine.
5. Vérifier la page publique et la revalidation.

## Critères d'acceptation

- [ ] Une page et un article peuvent être publiés sans déploiement de code.
- [ ] Une fiche produit peut être liée à une variante Lemon valide.
- [ ] L'aperçu affiche le contenu non publié pour un utilisateur autorisé uniquement.
- [ ] Le sitemap et les métadonnées se mettent à jour.
- [ ] Aucune donnée privée n'est présente dans le dataset public.
- [ ] Une ancienne URL reste redirigée après changement de slug.

## Clôture de la spec

- [ ] Schémas validés.
- [ ] Workflow éditorial testé par la fondatrice.
- [ ] Aperçu et revalidation recettés.
- [ ] Documentation Studio/MCP livrée.
- [ ] Sommaire maître mis à jour.

