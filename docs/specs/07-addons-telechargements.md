# SPEC-07 — Add-ons, fichiers privés et téléchargements

- Priorité : P0
- Statut : spécifiée, à valider
- Dépendances : SPEC-04, SPEC-05, SPEC-06

## Objectif

Livrer les add-ons gratuits ou achetés sans exposer les fichiers payants publiquement.

## Décision technique

- Les métadonnées éditoriales restent dans Sanity.
- Les versions et droits restent dans Convex.
- Les binaires privés utilisent un stockage privé contrôlé ; Convex est le choix initial sous réserve des quotas.
- Aucun fichier payant ne reste dans `/public/addons` au lancement.

## Flux de téléchargement

1. L'utilisateur demande le fichier depuis sa bibliothèque.
2. Le serveur vérifie identité, droit, version et limites anti-abus.
3. Il émet une URL courte, signée et non devinable.
4. Le stockage sert directement le fichier.
5. Le téléchargement est journalisé avec des données minimales.

## Gestion des versions

- Identifiant stable de l'asset et numéro de version distinct.
- Nouvelle version proposée aux anciens acheteurs selon la politique du produit.
- Hash, taille, type MIME et nom de fichier enregistrés.
- Possibilité de révoquer une version compromise.

## Critères d'acceptation

- [ ] Une URL publique historique ne permet plus d'obtenir un add-on payant.
- [ ] Un utilisateur sans droit reçoit un refus sans fuite d'information.
- [ ] Une URL signée expire et ne peut pas être prolongée côté client.
- [ ] Les limites de taille, type et fréquence sont appliquées.
- [ ] Une nouvelle version ne casse pas les droits antérieurs.
- [ ] Les coûts de stockage et bande passante sont mesurés.

## Clôture de la spec

- [ ] Inventaire et migration des ZIP terminés.
- [ ] Politique de versions validée.
- [ ] Test de partage abusif effectué.
- [ ] Procédure de restauration d'un fichier documentée.
- [ ] Sommaire maître mis à jour.

