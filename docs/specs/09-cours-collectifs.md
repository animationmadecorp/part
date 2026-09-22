# SPEC-09 — Cours collectifs et réservations

- Priorité : P1
- Statut : spécifiée, à valider
- Dépendances : SPEC-05, SPEC-06, SPEC-08

## Objectif

Vendre des places à des cours collectifs en visioconférence et fournir les informations seulement aux inscrits.

## Données d'une session

- Titre et identifiant produit.
- Date de début, durée et fuseau horaire.
- Capacité et nombre d'inscrits confirmés.
- Intervenant, langue et prérequis.
- Lien de visioconférence privé.
- Statut : brouillon, ouverte, complète, passée, annulée.

## Règles

- L'inscription n'est confirmée qu'après paiement confirmé.
- La capacité est vérifiée avant checkout et à la confirmation ; la stratégie de survente doit être explicitement définie.
- Le lien de visioconférence n'est visible qu'aux inscrits dans une fenêtre configurable.
- Confirmation, rappel et notification de changement envoyés par e-mail.
- Annulation et report conservent un historique.

## Critères d'acceptation

- [ ] Une session complète ne peut plus être achetée.
- [ ] Un achat confirmé crée une inscription unique.
- [ ] Le fuseau horaire est clair pour l'utilisateur.
- [ ] Le lien privé n'est pas visible publiquement.
- [ ] Le report ou l'annulation prévient les inscrits.
- [ ] La liste des participants est accessible uniquement au rôle autorisé.

## Clôture de la spec

- [ ] Fournisseur visio choisi.
- [ ] Politique annulation/report validée.
- [ ] E-mails testés.
- [ ] Session fictive recettée de bout en bout.
- [ ] Sommaire maître mis à jour.

