# SPEC-14 — Déploiement, observabilité et lancement

- Priorité : P0
- Statut : spécifiée, à valider
- Dépendances : toutes les specs P0 et P1 du lancement

## Objectif

Mettre le site en production de manière contrôlée, observable et réversible.

## CI/CD

1. Installation verrouillée.
2. Lint et types.
3. Tests unitaires et intégration.
4. Build production.
5. Preview Vercel.
6. Tests E2E.
7. Revue humaine.
8. Fusion sur branche protégée.
9. Promotion production et smoke test.

## Ordre de déploiement

- Migrations compatibles vers l'avant.
- Schéma/fonctions Convex avant le frontend consommateur.
- Contenus Sanity nécessaires avant activation des routes.
- Webhooks et secrets live avant ouverture du checkout.
- Activation progressive des fonctionnalités risquées par configuration.

## Observabilité

- Logs avec request ID et webhook event ID.
- Alertes erreurs serveur, webhooks en échec, checkout et quotas.
- Tableau de bord des coûts/volumes fournisseurs.
- Runbooks pour paiement absent, droit incorrect, fichier indisponible et panne fournisseur.
- Surveillance renforcée pendant 72 heures après lancement.

## Rollback et incident

- Rollback Vercel documenté.
- Migrations de données avec plan de reprise spécifique.
- Désactivation du checkout sans couper le contenu public.
- Rotation de secrets et révocation MCP documentées.
- Communication support préparée pour les incidents client.

## Critères d'acceptation

- [ ] Vercel Pro actif pour l'usage commercial.
- [ ] Domaine, DNS et HTTPS valides.
- [ ] Achat live contrôlé puis remboursement testés.
- [ ] Webhooks live visibles et relançables.
- [ ] Smoke tests réussis sur mobile et desktop.
- [ ] Alertes reçues par au moins deux responsables.
- [ ] Rollback et restauration testés.
- [ ] Aucune donnée test dans les interfaces publiques.

## Clôture de la spec

- [ ] Checklist de lancement PRD entièrement traitée.
- [ ] Go/No-Go signé.
- [ ] Production surveillée 72 heures.
- [ ] Incidents et corrections consignés.
- [ ] Sommaire maître mis à jour.

