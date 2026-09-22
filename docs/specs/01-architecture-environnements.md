# SPEC-01 — Architecture et environnements

- Priorité : P0
- Statut : spécifiée, à valider
- Dépendances : aucune
- Référence : PRD sections 8, 12 et 19

## Objectif

Établir une fondation reproductible séparant clairement le code, les contenus, l'identité, les données métier et les paiements.

## Architecture retenue

- Next.js sur Vercel pour le site, les routes serveur et les webhooks.
- Sanity pour les contenus éditoriaux publics.
- Convex pour les données métier, droits, progression et fichiers privés ciblés.
- Clerk pour l'identité et les sessions.
- Lemon Squeezy pour checkout, commandes, abonnements, taxes et factures.
- GitHub comme source du code et déclencheur CI/CD.

## Exigences

- Conserver les fonctionnalités et le design utiles du dépôt actuel.
- Ne pas remplacer automatiquement l'application par un starter.
- Créer des configurations distinctes local, preview/staging et production.
- Fournir un `.env.example` sans valeur secrète.
- Interdire l'import d'un secret serveur dans un composant client.
- Documenter la source de vérité de chaque donnée.
- Nommer un propriétaire et un administrateur de secours pour chaque service.
- Protéger la branche de production et exiger une CI réussie.

## Livrables

- Schéma d'architecture à jour.
- Tableau des environnements et identifiants non secrets.
- Registre des variables d'environnement.
- Convention de branches et de déploiement.
- Procédure locale reproductible depuis un clone neuf.

## Critères d'acceptation

- [ ] Un développeur peut démarrer le projet avec la documentation seule.
- [ ] Une Preview n'accède jamais aux données ou paiements live.
- [ ] Chaque service possède un environnement de développement identifié.
- [ ] Aucun secret n'est versionné ni exposé au navigateur.
- [ ] La source de vérité de chaque domaine est sans ambiguïté.
- [ ] Le build de production fonctionne dans la CI.

## Clôture de la spec

- [ ] Spec relue par la fondatrice.
- [ ] Spec relue par le responsable technique.
- [ ] Décisions ouvertes résolues.
- [ ] Implémentation liée à une PR ou un commit.
- [ ] Critères d'acceptation vérifiés.
- [ ] Sommaire maître mis à jour.

