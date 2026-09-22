# SPEC-04 — Données Convex et autorisations

- Priorité : P0
- Statut : spécifiée, à valider
- Dépendances : SPEC-01, SPEC-03

## Objectif

Créer la source de vérité des données métier et des droits d'accès avec un historique vérifiable.

## Tables principales

- `users`, `billingCustomers`.
- `orders`, `orderItems`, `subscriptions`, `entitlements`.
- `webhookEvents`, `auditEvents`, `manualGrants`.
- `digitalAssets`, `downloadEvents`.
- `courseEnrollments`, `lessonProgress`.
- `liveSessions`, `sessionRegistrations`.
- `reviewRequests`, `reviewFiles`.

## Règles de données

- Identifiants fournisseurs uniques et indexés.
- Événements financiers idempotents.
- Historique des transitions importantes.
- Validation systématique des entrées.
- Pas de données bancaires.
- Suppression logique des éléments ayant un historique financier.
- Droit manuel obligatoirement associé à un auteur, un motif et éventuellement une expiration.

## Règles d'autorisation

- `public` : lecture explicitement autorisée.
- `member` : identité Clerk valide.
- `owner` : l'identité correspond au propriétaire de la ressource.
- `entitled` : droit actif correspondant à la ressource.
- `support/admin` : rôle serveur vérifié et action auditée.

## Critères d'acceptation

- [ ] Le schéma et les index sont documentés.
- [ ] Chaque query/mutation sensible possède un contrôle d'accès testé.
- [ ] Un webhook dupliqué ne crée aucun doublon métier.
- [ ] L'historique permet d'expliquer pourquoi un utilisateur a ou n'a pas accès.
- [ ] Une migration peut être reprise après interruption.
- [ ] Les quotas et volumes sont observables.

## Clôture de la spec

- [ ] Schéma validé.
- [ ] Matrice d'autorisation validée.
- [ ] Tests de migration et d'isolation passés.
- [ ] Procédure d'export/restauration testée.
- [ ] Sommaire maître mis à jour.

