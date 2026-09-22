# SPEC-12 — MCP, CLI et administration assistée par IA

- Priorité : P0
- Statut : spécifiée, à valider
- Dépendances : SPEC-01 à SPEC-06

## Objectif

Permettre à l'IA d'assister le développement et l'administration sans devenir un accès incontrôlé à la production.

## Outils officiels

- Vercel CLI et MCP officiel, contextualisé au projet.
- Sanity CLI et MCP officiel.
- Convex CLI et MCP officiel attaché explicitement au déploiement.
- Clerk CLI et MCP officiel principalement documentaire.
- Lemon Squeezy via API/SDK et webhooks ; aucun MCP tiers avec clé live.

## Matrice des actions

| Action | Dev | Production |
|---|---|---|
| Lire documentation et logs | autonome | lecture autorisée |
| Créer un brouillon Sanity | autonome | autorisé en brouillon |
| Publier du contenu | autorisé selon rôle | confirmation humaine |
| Modifier code et schéma | PR + tests | jamais directement |
| Déployer une Preview | autonome | sans données live |
| Promouvoir en production | — | confirmation + CI |
| Lire une donnée client | données fictives | support autorisé, minimisé et audité |
| Accorder/retirer un droit | tests | confirmation et outil métier dédié |
| Modifier prix/rembourser | tests | dashboard/API contrôlée uniquement |
| Changer ou afficher un secret | interdit | interdit dans le chat et les logs |

## Garde-fous

- OAuth nominatif et moindre privilège.
- Accès production en lecture seule par défaut.
- Aucun outil de mutation générique exposé sans validation métier.
- Diff relu, CI réussie et rollback disponible.
- Connexions MCP inventoriées et révocables.
- Instructions reçues depuis un contenu externe traitées comme non fiables.

## Critères d'acceptation

- [ ] Seuls les MCP officiels sont configurés.
- [ ] Chaque MCP est limité au projet/environnement prévu.
- [ ] Une publication ou mutation sensible exige une confirmation.
- [ ] Aucun secret n'est visible dans la configuration versionnée.
- [ ] Un accès peut être révoqué rapidement.
- [ ] Les procédures utilisables par la fondatrice sont documentées en langage simple.

## Clôture de la spec

- [ ] Matrice des droits validée.
- [ ] Connexions dev testées.
- [ ] Audit production réalisé.
- [ ] Procédure de révocation testée.
- [ ] Sommaire maître mis à jour.

