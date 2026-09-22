# Socle local Clerk + Convex

## Périmètre

Cette tranche branche uniquement la fondation d’identité et de profil de la nouvelle zone. Elle ne migre ni Stripe, ni Sanity, ni l’agenda, ni les fixtures métier existantes.

- `/nouveau` et les autres pages publiques restent accessibles sans fournisseur configuré.
- `/nouveau/bibliotheque` est membre : une session Clerk vérifiée est requise.
- `/nouveau/demandes` et `/nouveau/studio` sont administrateur : l’identité Clerk est complétée par le rôle du profil Convex vérifié côté serveur.
- Le proxy Next 16 (`proxy.js`) initialise Clerk seulement lorsque les deux clés Clerk existent. Chaque ressource privée garde son contrôle serveur propre.
- Sans configuration, aucun compte local, cookie historique, e-mail ou paramètre d’URL ne sert de preuve d’identité. Les zones privées affichent un état de configuration et ne rendent ni fixtures ni données métier.

## Configuration sans secrets

Si `.env.local` n’existe pas, partir de `.env.example`; sinon ajouter seulement les variables manquantes sans écraser les valeurs existantes. Renseigner uniquement des valeurs de développement. Le fichier `.env.local` existant n’a pas été lu ni recopié par cette tranche.

| Élément | Emplacement | État au 19 septembre 2026 |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | environnement Next local | Identifiant/clé de développement non fourni dans le contexte autorisé |
| `CLERK_SECRET_KEY` | environnement serveur Next local | Secret de développement non fourni ; aucune valeur recherchée ou affichée |
| `NEXT_PUBLIC_CONVEX_URL` | environnement Next local | URL du déploiement Convex de développement non fournie |
| `CLERK_JWT_ISSUER_DOMAIN` | variables du déploiement Convex de développement | Domaine issuer Clerk non configuré/vérifié |
| JWT template `convex` | tableau de bord Clerk | Présence non vérifiée ; nécessaire à `getToken({ template: "convex" })` |
| projet/application Clerk de développement | tableau de bord Clerk | Identifiant non fourni |
| projet/déploiement Convex de développement | tableau de bord Convex | Identifiant et URL non fournis |

`convex/auth.config.js` attend le domaine issuer de développement et l’audience `convex`. Tant que ce domaine n’est pas configuré sur le déploiement, Convex ne doit pas être considéré comme connecté.

Le rôle `admin` n’est pas dérivé de l’e-mail et n’est jamais accepté depuis le navigateur. Toute création de profil par session démarre avec `role: "member"`; l’attribution administrateur est une opération serveur/opérateur séparée dans Convex.

## Mise en route lorsque les identifiants existent

1. Créer ou sélectionner une application Clerk de développement et relever sa Publishable Key, Secret Key et Frontend API URL.
2. Créer ou sélectionner un déploiement Convex de développement, puis définir `CLERK_JWT_ISSUER_DOMAIN` sur ce déploiement.
3. Activer l’intégration Convex dans Clerk et créer le JWT template nommé `convex` avec l’audience attendue par Convex.
4. Renseigner les trois variables locales du tableau, sans ajouter de secret à Git.
5. Lancer `npx convex dev` depuis le projet pour synchroniser `convex/auth.config.js`, le schéma et les fonctions.
6. Attribuer explicitement le rôle administrateur à un profil de développement par une procédure opérateur sécurisée ; ne pas modifier l’URL ou l’e-mail pour contourner la garde.

## Vérifications et limites honnêtes

Passable localement sans accès fournisseur : lint, build Next et `npm run verify:auth-foundation`. Ces contrôles vérifient notamment que le public reste public, que l’absence de configuration refuse les scopes membre/admin, qu’un membre est refusé par la politique admin et que le patch de profil ignore `role`.

Non exécutables et donc non validés sans les projets de développement et leurs variables : inscription réelle Clerk, connexion réelle, vérification d’e-mail, émission du JWT `convex`, synchronisation avec Convex, isolation réelle de deux comptes, lecture/modification de profils sur le déploiement et attribution/révocation effective du rôle admin. Aucun de ces tests n’est présenté comme réussi.

## Références officielles consultées

- [Clerk — Next.js Quickstart](https://clerk.com/docs/nextjs/getting-started/quickstart)
- [Clerk — migration vers les contrôles au niveau des ressources](https://clerk.com/docs/guides/development/upgrading/upgrade-guides/migrate-from-create-route-matcher)
- [Convex — intégration Clerk](https://docs.convex.dev/auth/clerk)
- [Convex — stockage des utilisateurs et contrôle par identité](https://docs.convex.dev/auth/database-auth)
