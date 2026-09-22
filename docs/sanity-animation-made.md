# Sanity — Animation Made

Le site lit le contenu éditorial public côté serveur. Le repli local conserve l’état validé dans `app/nouveau/_data/content.js`, de sorte que `/nouveau` reste utilisable tant que le dataset Sanity n’est pas configuré.

## Périmètre éditorial

Les documents ont des identifiants stables et ne contiennent pas de prix contractuel, de PII ou de droit d’accès effectif :

- `siteSettings` — `site-settings:animation-made`
- `page` — `page:nouveau-home`, `page:nouveau-feedback`, `page:nouveau-review`, `page:nouveau-visibilite`, `page:nouveau-anglais`
- `offer` — `offer:feedback`, `offer:review`, `offer:visibilite`, `offer:anglais`
- `resourcePresentation` — `resource:*`
- `faq` — `faq:nouveau-offres`

Les `page.sections` portent les cartes, étapes et listes éditoriales visibles dans l’expérience publique. Les ressources Sanity restent des présentations (titre, format, métadonnées et règle éditoriale) : les textes de leçon, livrables et références privées ne sont ni seedés ni projetés. Une règle ou une clé d’accès inconnue est verrouillée par défaut.

Les variantes et prix de checkout restent dans les règles serveur (`prePaymentOffers.mjs` et `bookingLogic.mjs`). Le champ `checkoutVariantId` du schéma est seulement une référence éditoriale facultative ; il n’est pas utilisé pour calculer ou autoriser un paiement.

## État vérifié le 21 septembre 2026

Le projet Sanity est `ez6qtt5k`, le dataset public est `production`. Les quatre variables publiques site/Studio sont configurées localement. La lecture distante est vérifiée et retourne zéro document éditorial publié. Les tokens de lecture brouillon/écriture et les secrets de preview/webhook restent à configurer. Pour revérifier sans afficher de secret :

```bash
npm run verify:sanity
```

Résultat obtenu : `access: "readable"`, `publishedEditorialDocuments: 0`. Cela prouve la lecture, pas la publication ni la revalidation. Le site conserve son contenu local validé tant que les documents initiaux ne sont pas publiés.

Le résolveur partagé compare `SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_PROJECT_ID`, `SANITY_STUDIO_PROJECT_ID` et les trois variantes de dataset. Des valeurs contradictoires bloquent la lecture et le seed au lieu de laisser le Studio et le site viser deux destinations différentes. Pour valider les schémas sans déclarer un dataset réel : `SANITY_STUDIO_DATASET=validation npx sanity schemas validate --level error --format json`.

## Quand le dataset est confirmé

Renseigner localement, sans commit, les variables suivantes :

```dotenv
NEXT_PUBLIC_SANITY_PROJECT_ID=ez6qtt5k
NEXT_PUBLIC_SANITY_DATASET=<dataset-confirmé>
SANITY_STUDIO_PROJECT_ID=ez6qtt5k
SANITY_STUDIO_DATASET=<dataset-confirmé>
SANITY_WRITE_TOKEN=<token-écriture-local>
SANITY_PREVIEW_TOKEN=<token-lecture-brouillons>
SANITY_PREVIEW_SECRET=<secret-url-preview>
SANITY_REVALIDATE_SECRET=<secret-webhook>
```

Puis :

1. `npm run verify:sanity` vérifie la lecture du dataset sans afficher de secret.
2. `npm run seed:sanity` crée les documents initiaux sans remplacer un document existant. `npm run seed:sanity -- --force` est réservé à une migration explicitement confirmée.
3. `npm run studio` lance le Studio depuis `sanity.config.js`.

Le Studio propose les statuts brouillon/publié/archivé. Les documents archivés ne sont pas lus par le site public.

## Publication sans redéploiement

Le lecteur utilise `@sanity/client` avec la perspective `published`, un cache Next tagué `sanity:editorial` et une revalidation d’une heure en filet de sécurité. Configurer dans Sanity un webhook `POST` vers :

```text
https://<domaine>/api/sanity/revalidate
```

Déclencheurs : création, mise à jour et suppression ; filtre : `_type in ["siteSettings", "page", "offer", "resourcePresentation", "faq"]` ; projection : `{_type}` ; secret : la valeur de `SANITY_REVALIDATE_SECRET` côté serveur. La route valide la signature via `next-sanity/webhook`, invalide le tag et les surfaces publiques concernées, puis le prochain rendu lit le document publié sans nouveau build.

Scénario de recette : modifier le `hero.lead` de `page:nouveau-home`, publier, vérifier la réception du webhook puis recharger `/nouveau`. La preuve attendue est le texte modifié après revalidation, avec le même déploiement. Si le webhook n’est pas encore configuré, seul le repli TTL d’une heure existe ; ce n’est pas une preuve de mise à jour immédiate.

## Aperçu brouillon

Une URL Sanity peut ouvrir `/api/sanity/preview?secret=<secret>&slug=/nouveau`. La route refuse les chemins externes, active le Draft Mode Next et lit les brouillons sans cache avec `SANITY_PREVIEW_TOKEN`. La sortie est désactivée par `/api/sanity/preview/disable`.

Tant que le token et le secret ne sont pas fournis, l’aperçu n’est pas déclaré disponible.
