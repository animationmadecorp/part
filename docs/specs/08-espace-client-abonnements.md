# SPEC-08 — Espace client, droits et abonnements

- Priorité : P1
- Statut : spécifiée, à valider
- Dépendances : SPEC-03, SPEC-04, SPEC-06, SPEC-07

## Objectif

Donner au client un lieu unique pour retrouver achats, fichiers, contenus, inscriptions et facturation.

## Écrans

- Vue d'ensemble.
- Bibliothèque.
- Achats et reçus.
- Abonnement et portail de facturation.
- Cours réservés.
- Reviews.
- Progression pédagogique.
- Profil et sécurité du compte.

## États à gérer

- Aucun achat.
- Paiement en attente de webhook.
- Accès actif, période de grâce ou expiré.
- Abonnement annulé mais encore actif.
- Paiement échoué.
- Produit remboursé ou révoqué.
- Ressource archivée mais toujours accessible à l'acheteur.

## Critères d'acceptation

- [ ] Le client retrouve un achat moins de 60 secondes après paiement dans 95 % des cas.
- [ ] Les états d'abonnement sont expliqués en langage simple.
- [ ] Le portail Lemon Squeezy s'ouvre pour le bon client.
- [ ] Le serveur vérifie chaque accès privé.
- [ ] Les états vides et erreurs proposent une action claire.
- [ ] Aucun client ne peut voir les informations d'un autre.

## Clôture de la spec

- [ ] Arborescence et textes validés.
- [ ] Tous les états métier recettés.
- [ ] Mobile et accessibilité validés.
- [ ] Sommaire maître mis à jour.

