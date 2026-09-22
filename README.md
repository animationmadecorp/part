# Animation Made

Site Next.js 16 de la nouvelle plateforme Animation Made. La page publique est servie sur `/` et `/nouveau` ; les comptes passent par Clerk, les données et réservations par Convex, le contenu éditorial par Sanity, les paiements par Stripe et les notifications par Resend.

## Développement

```bash
npm ci
npm run dev
```

Les variables nécessaires sont décrites dans `.env.example` ; les valeurs réelles restent dans `.env.local` et les tableaux de bord des fournisseurs, jamais dans Git.

## Vérifications avant déploiement

```bash
npm run build
npm run lint
npm run verify:auth-foundation
npm run verify:booking-connected
npm run verify:client-orders
npm run verify:review-studio
npm run verify:review-submissions
npm run verify:delivery-notifications
npm run verify:stripe-contract
```

`npm run preflight:production` contrôle la configuration sans déclencher de paiement ni d'envoi d'e-mail. Les paiements réels et les envois Resend restent fermés tant que leurs paramètres de production ne sont pas validés.

Le dépôt Git ne doit contenir que le nouveau site et ses dépendances effectives. Ne pas réintroduire les anciennes routes `/tools`, `/dashboard`, `/login` ou leurs API.
