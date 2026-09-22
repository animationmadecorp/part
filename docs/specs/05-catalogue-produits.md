# SPEC-05 — Catalogue et produits

- Priorité : P0
- Statut : spécifiée, à valider
- Dépendances : SPEC-02, SPEC-04

## Objectif

Présenter toutes les offres dans une boutique cohérente et relier sans ambiguïté chaque offre éditoriale au produit facturé.

## Types supportés

- Add-on gratuit ou payant.
- Cours collectif daté.
- Review de book.
- Formation à achat unique.
- Abonnement mensuel ou annuel.
- Ressource incluse dans un palier.

## Données produit

- `productKey` interne stable.
- Type, titre, résumé, description, médias et bénéfices dans Sanity.
- `storeId`, `productId` et `variantId` Lemon Squeezy selon le besoin.
- Règle d'accès et ressource délivrée dans Convex.
- Statuts : brouillon, actif, masqué, épuisé ou archivé.

## Règles d'affichage

- Le prix contractuel vient de Lemon Squeezy ou d'une synchronisation serveur récente.
- L'indisponibilité du fournisseur de prix ne doit jamais afficher un prix inventé.
- Un produit archivé reste visible dans l'historique des clients qui l'ont acheté.
- Le CTA dépend du type : obtenir, acheter, s'abonner, réserver ou accéder.

## Critères d'acceptation

- [ ] Le catalogue filtre les types d'offres prévus.
- [ ] Chaque produit vendable pointe vers une variante existante et active.
- [ ] Aucun mélange entre prix éditorial et prix facturé n'est possible.
- [ ] Les produits gratuits peuvent exiger ou non un compte.
- [ ] Une fiche archivée ne casse pas une bibliothèque client existante.
- [ ] SEO, mobile et accessibilité de la fiche sont validés.

## Clôture de la spec

- [ ] Taxonomie et types validés.
- [ ] Mapping Sanity/Lemon/Convex vérifié.
- [ ] Parcours gratuits et payants recettés.
- [ ] Sommaire maître mis à jour.

