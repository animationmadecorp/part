# SPEC-03 — Authentification Clerk et utilisateurs

- Priorité : P0
- Statut : spécifiée, à valider
- Dépendances : SPEC-01

## Objectif

Fournir une identité unique et sécurisée pour les membres gratuits, clients et administrateurs.

## Fonctionnalités

- Inscription, connexion, déconnexion et récupération de compte.
- Vérification de l'adresse e-mail.
- Profil : nom, langue, fuseau horaire et consentements métier dans Convex.
- Synchronisation contrôlée Clerk → Convex par webhook ou création à la première session.
- Routes publiques, membres et administratives clairement séparées.
- Liaison d'un achat invité après preuve suffisante de propriété de l'e-mail.

## Autorisation

- Clerk prouve l'identité ; Convex décide des droits métier.
- Le rôle administrateur n'est jamais accepté depuis une valeur fournie par le navigateur.
- Toute fonction sensible récupère l'identité serveur et refuse par défaut.
- Une suppression Clerk déclenche la procédure d'anonymisation métier prévue.

## Critères d'acceptation

- [ ] Inscription et connexion fonctionnent sur mobile et desktop.
- [ ] Un e-mail non vérifié ne peut pas réclamer un achat existant.
- [ ] Un utilisateur ne peut ni lire ni modifier le profil d'un autre.
- [ ] La déconnexion invalide l'accès aux pages privées.
- [ ] Les erreurs restent compréhensibles sans révéler l'existence d'un compte.
- [ ] Les URLs de retour fonctionnent en preview et production.

## Clôture de la spec

- [ ] Méthodes de connexion validées.
- [ ] Politique de session validée.
- [ ] Tests d'isolation utilisateur passés.
- [ ] Procédure support documentée.
- [ ] Sommaire maître mis à jour.

