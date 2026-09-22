# Checkpoint initial — Nouvelle version Animation Made

## Statut et portée

Décisions issues des derniers échanges avec la fondatrice. Ce document prévaut sur les dispositions contradictoires de la PRD v1 et des specs du 2 septembre 2026. Il ne marque aucune intégration comme implémentée ou testée.

Le prototype reste une référence conservée. Son design et son administration maison ne sont pas imposés à la nouvelle version. L'emplacement de la nouvelle construction sera défini après inventaire du dépôt, sans écraser le prototype.

## Décisions retenues

- Stripe remplace Lemon Squeezy. La spec paiement doit être réécrite pour Stripe avant implémentation ; remplacer uniquement le nom du fournisseur ne suffit pas.
- Prévoir factures automatiques, remboursements et suivi des paiements. La configuration des taxes est distincte de l'envoi des factures.
- Les quatre accompagnements sont : visibilité d'artiste, review de book/showreel, feedback d'animation et anglais pour les artistes de l'animation.
- Les quatre onglets de l'espace personnel sont fixes : Tableau de bord, Ma bibliothèque, Mon suivi, Mon compte.
- Les nouvelles offres alimentent les fiches publiques et collections, sans créer de nouvel onglet principal.
- Une ressource peut appartenir à plusieurs offres sans duplication. Chaque accès a une durée explicite ; un remboursement ne retire pas un accès acquis par une autre offre.
- Les contenus payants complets et fichiers privés ne doivent pas être stockés dans un dataset public. Les présentations et aperçus publics sont séparés des contenus protégés.
- Le GPT d'anglais est un lien externe. Aucune intégration de chat n'est prévue ; ce lien ne constitue pas un contrôle d'accès strict.
- Une entrée Administration rassemble Sanity Studio, le suivi des élèves et les ventes. Le fonctionnement quotidien ne demande pas d'ouvrir Convex.
- Les anciennes offres Free/Pro/Extra et l'abonnement généralisé ne sont pas des décisions acquises pour cette nouvelle version.

## Plan des espaces

```text
Site public
├── Accueil : approche, quatre accompagnements, références, témoignages, cadeaux
├── Fiches offres et produits : accompagnements, add-ons, e-books, cours et packs
├── À propos / CV détaillé
├── Inscription / connexion
└── Contact et pages légales

Espace personnel
├── Tableau de bord : calendrier, tâches, raccourcis utiles même sans achat
├── Ma bibliothèque : contenus débloqués, gratuits, aperçus des autres collections
├── Mon suivi : objectifs, travaux, retours, séances et réservations
└── Mon compte : informations, paramètres, achats et factures

Administration
├── Contenus et offres : Sanity Studio, configuré et intégré à l'accès admin
├── Élèves et séances : écran métier à construire, données dans Convex
└── Ventes : récapitulatif à construire, liens vers Stripe pour les opérations
```

Sanity Studio conserve son authentification administrative propre. Une entrée commune ne promet pas une connexion unique entre tous les fournisseurs. L'accès au suivi et aux ventes exige un rôle administrateur vérifié côté serveur.

## Premier parcours de référence

1. L'administratrice prépare une fiche et sa ressource.
2. Le visiteur découvre la fiche sur le site.
3. Il crée un compte ; une ressource gratuite est accessible dans sa bibliothèque.
4. Il achète une offre test ; la confirmation serveur débloque les ressources incluses.
5. La bibliothèque affiche le fichier ou les leçons, et Mon suivi la suite si une prestation est incluse.
6. L'administratrice retrouve l'achat et l'élève depuis son administration.

## Ordre de construction et preuves attendues

| Étape | Livrable | Preuve pour clôturer |
|---|---|---|
| 1 | Plan des espaces et fiche type | Parcours public, membre et admin relus avec les champs nécessaires |
| 2 | Première maquette locale : accueil, fiche, bibliothèque | Navigation et présentation visibles et validées |
| 3 | Administration Sanity | Créer et publier une fiche sans modifier le code |
| 4 | Clerk + Convex, compte gratuit | Deux comptes isolés, bibliothèque gratuite fonctionnelle |
| 5 | Stripe test + livraison privée | Paiement, facture, accès, téléchargement et remboursement vérifiés |
| 6 | Réservations et suivi | Une séance et un échange élève/intervenante testés |
| 7 | Production | Recette complète et checklist de lancement passée |

Les fondations, permissions et tests se construisent avec chaque étape. La bibliothèque gratuite ne nécessite pas d'attendre le paiement. Les fichiers privés sont intégrés au premier parcours payant.

## Fiche type à préparer

Champs communs : titre, image, public visé, bénéfice, description, contenu inclus, tarif associé, bouton et conditions d'accès.

Pour un accompagnement : durée, séances/crédits, réservation, ressources incluses, validité, reports et annulations.

Pour un add-on : fonctionnalités, compatibilité, licence, version et fichier privé.

Pour un e-book ou cours : format, aperçu, leçons/produits inclus et durée d'accès.

## Checklist de ce checkpoint

- [x] Décisions produit consignées.
- [x] Plan des trois espaces rédigé.
- [x] Champs de la fiche type proposés.
- [ ] Relecture de la fiche type et choix du premier produit réel de référence.
- [ ] Anciennes specs harmonisées avant leur implémentation, notamment paiement et contenus privés.
- [x] Première maquette locale réalisée : accueil, review, bibliothèque gratuite et après achat simulé. Voir [livraison des écrans](01-premiers-ecrans-livraison.md).
- [ ] Première maquette vérifiée visuellement et validée par la fondatrice.

## Reprise du travail

Commencer par ce document puis le sommaire. Prochain livrable : première maquette de l'accueil, d'une fiche produit et de la bibliothèque, selon les préférences visuelles de la fondatrice. Aucun achat ni déploiement live n'est autorisé par ce cadrage seul.
