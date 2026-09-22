# Lot 2 — commandes et dossiers privés non-anglais

## Périmètre

Rendre commandables en Stripe test les questionnaires `review`, `contenu` et `projet-animation`. Le questionnaire `feedback` vidéo reste hors périmètre de ce lot, mais réutilisera le contrat de dossier et de stockage.

## Contrat retenu

- Convex est la source privée des dossiers, réponses normalisées, pièces jointes et états de paiement.
- L'identité Clerk (`clerkUserId` + `tokenIdentifier`) est vérifiée par chaque query/mutation sensible.
- Les pièces jointes transitent par une URL Convex courte puis sont finalisées avec des métadonnées contrôlées ; seuls les identifiants de stockage sont persistés dans le dossier.
- Le prix Stripe est fourni par l'allowlist serveur Convex, jamais par le navigateur.
- Checkout est créé côté serveur avec une clé Stripe `sk_test_` et une clé d'idempotence par dossier.
- Le webhook lit le corps brut, vérifie la signature et refuse les événements live ; Convex déduplique par `eventId` avant d'accorder l'état payé.

## Limites explicites

Convex annonce tous types de fichiers, sans limite de taille par fichier, mais avec un délai POST de 2 minutes. Le quota du dossier suit 1 GiB (aligné sur l'inclusion Free/Starter) ; aucun plafond arbitraire de taille vidéo n'est inventé. Une URL Convex de lecture est un bearer URL : la livraison applicativement autorisée et l'expiration des vidéos restent à décider avec un stockage à URLs temporaires (par exemple R2). Les liens Drive/YouTube/Vimeo restent des références que la cliente doit rendre accessibles.

## Preuves attendues

- Tests de l'allowlist et des trois montants, du contrat Checkout test et de l'idempotence Stripe.
- Tests de validation des réponses, types/quota/pièces jointes et isolation entre comptes.
- Vérification statique des mutations Convex et du routage webhook signé/rejoué.
- E2E fournisseur limité aux accès réellement disponibles ; aucun succès navigateur/Clerk/Stripe ne sera déclaré sans preuve.
