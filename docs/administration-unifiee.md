# Administration unifiée

## Parcours et sécurité

`/admin` est une page serveur qui appelle `requireAdminPage`. La garde vérifie la session Clerk, le JWT Convex et le rôle `admin` du profil métier. Les sous-routes existantes (`/admin/reservations`, `/admin/disponibilites`, `/nouveau/demandes` et `/nouveau/studio`) conservent leur propre garde serveur.

Dans `/nouveau/bibliotheque?onglet=compte`, le raccourci Administration n’est rendu que lorsque le profil retourné par cette garde possède `role: "admin"`. Cette visibilité ne remplace pas la garde de `/admin` : un lien copié ou une navigation directe reste refusé côté serveur pour un membre.

## Réglages externes sans secret dans le dépôt

À renseigner dans l’environnement de production, sans les committer :

| Réglage | Valeur / rôle |
| --- | --- |
| `SANITY_STUDIO_URL` | `https://animation-made.sanity.studio` après publication du Studio. Cette variable est serveur uniquement ; une URL `localhost` est refusée en production. |
| `SANITY_REVALIDATE_SECRET` | Secret partagé entre Vercel et le webhook Sanity. Ne pas mettre sa valeur dans Git, une URL ou un ticket. |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | `ez6qtt5k` |
| `NEXT_PUBLIC_SANITY_DATASET` | `production` |
| `NEXT_PUBLIC_SANITY_API_VERSION` | Version API commune au site et au Studio. |

Créer ou conserver un webhook Sanity `POST` vers `https://animation-made.com/api/sanity/revalidate`, avec le dataset `production`, une signature basée sur `SANITY_REVALIDATE_SECRET` et les documents éditoriaux (`siteSettings`, `page`, `offer`, `resourcePresentation`, `faq`). La route rejette les signatures absentes ou invalides avant toute invalidation.

Le cache public est tagué `sanity:editorial` et son repli est borné à 60 secondes. La lecture publiée utilise `useCdn: false` côté serveur : après un webhook signé, l’invalidation Next ne peut pas retomber sur une réponse Sanity CDN ancienne.

## Studio hébergé

Le Studio est déployé sur Sanity avec l’identifiant d’application conservé dans `sanity.cli.js`. La configuration Vite `publicDir: false` empêche d’embarquer le `public/` du site (add-ons, factures ou autres fichiers qui ne font pas partie du Studio). Les mises à jour automatiques sont désactivées par `deployment.autoUpdates: false` afin de garder les versions contrôlées par le dépôt.

Pour une publication autorisée par le propriétaire :

```text
npx sanity deploy --url animation-made --yes
```

Après publication, renseigner `SANITY_STUDIO_URL` et activer le webhook. Le panneau `/admin` expose uniquement un état (configuré ou à configurer), jamais de secret.

## Vérifications locales

```text
npm run verify:admin-unified
npm run verify:auth-foundation
npm run verify:sanity
npm run build
```

La connexion réelle du propriétaire, l’activation du webhook, la promotion de rôle et le déploiement restent des opérations externes à effectuer séparément après revue de cette branche de travail.
