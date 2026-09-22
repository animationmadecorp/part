# Premiers écrans — livraison locale

## Périmètre construit

- `/nouveau` : accueil personnel avec portrait existant, quatre offres, approche et cadeaux.
- `/nouveau/review` : fiche review réutilisable comme référence, détails et conditions illustratifs.
- `/nouveau/bibliotheque` : compte gratuit.
- `/nouveau/bibliotheque?profil=review` : élève ayant acheté la review, simulé.

Le prototype existant reste accessible à ses anciennes adresses. Les nouvelles pages utilisent un thème commun isolé dans `app/nouveau/nouveau.css`, une navigation partagée et des données de présentation dans `app/nouveau/_data/content.js`. Ces données seront remplacées par les sources réelles lors des branchements.

## Interactions

- Navigation accueil → review → bibliothèque avec achat simulé.
- Bascule explicite entre profils gratuit et review.
- Filtres de collection et recherche avec état vide.
- Aperçus de ressources, progression de démonstration et fermeture clavier.
- Quatre onglets fixes ; les trois onglets hors bibliothèque présentent leur rôle et leur statut à construire.
- Les autres offres renvoient vers la fiche de référence avec un message explicite.

## Limites

- Aucun compte créé, paiement, réservation ou téléchargement réel.
- Aucun droit d'accès de production : les données sont fictives et publiques.
- Prix, durée, séances et ressources à valider.
- Pas de témoignage inventé.
- Design responsive écrit ; recette visuelle desktop/mobile et validation de la fondatrice encore à faire.
- Routes marquées non indexables.

## Vérifications

- ESLint ciblé sur les nouvelles pages.
- Réponses HTTP 200 pour les trois routes.
- Compilation globale de production réussie (76 pages), après relance avec accès réseau pour les polices. Cela ne remplace pas une recette visuelle et fonctionnelle.

## Prochain checkpoint

La fondatrice examine l'accueil, la fiche et les deux états de bibliothèque ; les corrections portent d'abord sur identité, hiérarchie et contenu. L'intégration Sanity vient après stabilisation des champs éditoriaux.
