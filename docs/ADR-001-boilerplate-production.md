# ADR-001 — Base technique de production

- Statut : historique, partiellement remplacé par le [nouveau cadrage](specs/00-cadrage-nouvelle-version.md) ; la conservation du design du prototype et Lemon Squeezy ne sont plus retenus comme contraintes.
- Date : 2 septembre 2026
- Projet : Animation Made
- Décision : conserver le produit existant et migrer progressivement son infrastructure

## Décision

Il n'existe pas, à ce jour, de boilerplate officiel et maintenu réunissant proprement Next.js, Vercel, Sanity, Convex, Clerk et Lemon Squeezy.

La base recommandée est donc :

1. conserver l'interface et les fonctionnalités déjà présentes dans ce dépôt ;
2. utiliser [`get-convex/template-nextjs-clerk`](https://github.com/get-convex/template-nextjs-clerk) comme référence d'architecture pour Convex + Clerk ;
3. intégrer Sanity avec le SDK officiel [`sanity-io/next-sanity`](https://github.com/sanity-io/next-sanity) ;
4. adapter les flux de paiement et de webhooks du starter officiel [`lmsqueezy/nextjs-billing`](https://github.com/lmsqueezy/nextjs-billing), sans reprendre Auth.js, Drizzle ou Neon ;
5. déployer l'ensemble sur Vercel avec des environnements séparés.

Le starter Convex peut aussi être généré par :

```bash
npm create convex@latest -- -t nextjs-clerk
```

Il sert de référence ou de bac à sable de migration, pas de remplacement automatique du dépôt actuel.

## Pourquoi ne pas repartir d'un starter e-commerce complet ?

- Les starters e-commerce courants sont principalement conçus pour Shopify ou Stripe.
- Le starter Lemon Squeezy officiel utilise une autre authentification et une autre base de données.
- Remplacer l'application actuelle ferait perdre les pages, composants, contenus et règles métier déjà construits.
- Une migration verticale, fonctionnalité par fonctionnalité, permet des tests et un retour arrière à chaque étape.

## Répartition des responsabilités

| Service | Responsabilité | Ne doit pas contenir |
|---|---|---|
| Next.js / Vercel | Site, espace client, routes serveur, SEO, webhooks | Secrets dans le navigateur |
| Sanity | Pages, articles, fiches éditoriales, SEO, structure des cours | Paiements, mots de passe, droits clients, fichiers privés |
| Convex | Données applicatives, commandes miroir, droits d'accès, progression, stockage privé ciblé | Numéros de carte bancaire |
| Clerk | Identité, sessions, profil de connexion | Catalogue ou logique de facturation |
| Lemon Squeezy | Checkout, commandes, abonnements, factures, taxes, remboursements | Contenu éditorial et progression pédagogique |

## CLI et MCP retenus

| Service | CLI | MCP officiel | Usage en production |
|---|---|---|---|
| Vercel | `vercel` | `https://mcp.vercel.com` | Déploiements, journaux et diagnostic ; actions sensibles avec confirmation humaine |
| Sanity | `sanity` | `https://mcp.sanity.io` | Création/modification de contenu et schémas ; publication contrôlée |
| Convex | `convex` | `npx -y convex@latest mcp start` | Schéma, fonctions, données de développement ; accès production limité et supervisé |
| Clerk | `clerk` | `https://mcp.clerk.com/mcp` | Documentation et snippets ; administration via CLI/API selon les droits |
| Lemon Squeezy | API/SDK | Aucun MCP officiel retenu | Intégration par API et webhooks signés uniquement |

Le MCP facilite le développement et l'administration. Il ne remplace ni les tests, ni l'autorisation côté serveur, ni les sauvegardes.

## Alternatives rejetées

- **Réécriture totale à partir du starter Lemon Squeezy** : trop de substitutions structurelles.
- **Starter Sanity e-commerce historique** : archivé et orienté Shopify/Hydrogen.
- **Monorepo Convex Next.js + Expo** : utile seulement si une application mobile native devient prioritaire.
- **WordPress/WooCommerce** : solution viable, mais différente de la direction produit et du travail existant dans ce dépôt.

## Conséquences

- La mise en production commerciale sur Vercel nécessite de budgéter Vercel Pro ; Hobby est réservé aux usages personnels et non commerciaux.
- Le dataset Sanity gratuit étant public, seules les données éditoriales publiques y sont stockées.
- Les droits d'accès sont calculés côté serveur à partir des événements Lemon Squeezy enregistrés dans Convex.
- Les fichiers payants ne restent pas dans `/public` : ils doivent être livrés par un mécanisme privé et contrôlé.
- Les MCP de production utilisent le moindre privilège, des comptes nominatifs et une confirmation humaine pour toute mutation sensible.
