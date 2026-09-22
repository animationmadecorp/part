# Livraison, préflight et mise en production contrôlée — 21 septembre 2026

Ce document regroupe les étapes humaines et les preuves de ce lot. Il ne déclenche aucun déploiement, ne promeut aucun compte, ne crée pas de dossier et n’envoie pas d’e-mail réel.

## Périmètre et garde-fous

- Environnement distant utilisé pour les lectures : Convex DEV `clever-bulldog-649`.
- Fixtures autorisées : comptes Clerk synthétiques de recette `am-production-readiness-20260921`, dossier A et vidéo `am-recette-feedback-2s.mp4` uniquement.
- Aucun compte synthétique n’est administrateur et aucune élévation n’est autorisée. Une publication administrateur doit passer par la session interactive consentie du propriétaire déjà administrateur.
- Le paiement live, l’e-mail réel, Sanity write et tout abonnement d’hébergement restent hors périmètre.
- Le baseline DEV a déjà été synchronisé par le parent. Ne pas resynchroniser ce checkout depuis cette tâche.

Sources de code : [adminRequests](../convex/adminRequests.js), [clientDeliveries](../convex/clientDeliveries.js), [reviewStudio](../convex/reviewStudio.js), [proxy PDF](../app/api/client-deliveries/[requestId]/route.js) et [proxy vidéo](../app/api/review-media/[requestId]/video/route.js).

## État de recette observé

### Lectures distantes, sans écriture

Le compte synthétique A possède les dossiers suivants :

- `kn72ty546hb8ny08x17eta529n8evfte` — `projet-animation`, `paid/paid`, fichier source `kd7fytq016qkab1pe7varqyffn8etz3d`, `am-recette-feedback-2s.mp4`, 3 209 octets.
- `kn76x96473vjxzt5zgz1rr0n758ev8yv` — `feedback`, `paid/paid`, fichier source `kd7adwtv87r91p19f6705p60hs8et2ve`, même vidéo synthétique, 3 209 octets.
- `kn79svcmb2n2bhrdcnek3nrr7h8etqq2` — `contenu`, `paid/paid`, sans fichier.
- `kn716mx6qnf54q1ykvt0z4w7k18ev3qc` — `review`, `draft/unpaid`.

La lecture finale confirme exactement ces quatre lignes : trois achats payés et le brouillon `review` non payé, qui n’est volontairement pas un fixture de livraison et ne peut pas être publié. Les états de livraison sont encore `awaiting_delivery` pour les trois dossiers payés et `payment_required` pour ce brouillon. Aucun PDF administrateur ni snapshot de review n’est publié à distance. Le compte synthétique B ne voit aucun dossier et obtient `FORBIDDEN: Client request belongs to another account` sur une lecture du dossier A. Le compte A obtient `FORBIDDEN: Administrator access required` sur `adminRequests:getAdminRequest`.

Cette preuve distante est donc PASS pour lecture propriétaire et isolation, mais NOT RUN pour publication administrateur et consultation après publication.

### Vérifications locales

Les contrats et les états sont couverts par :

- [verify-admin-requests.mjs](../scripts/verify-admin-requests.mjs) — PASS : préparation, finalisation auditée, taille/type PDF, isolation administrateur.
- [verify-client-deliveries.mjs](../scripts/verify-client-deliveries.mjs) — PASS : paiement, propriétaire, preuve `admin_delivery_recorded`, états et proxy sans URL storage dans le payload.
- [verify-review-studio.mjs](../scripts/verify-review-studio.mjs) — PASS : source payée, autosave, conflit, snapshot immutable, proxy vidéo.
- [verify-delivery-notifications.mjs](../scripts/verify-delivery-notifications.mjs) — PASS : outbox, déduplication, retry, remboursement concurrent et payload sans lien bearer.
- [verify-notification-emails.mjs](../scripts/verify-notification-emails.mjs) — PASS : renderer HTML/texte, échappement, mode no-send et `fetch` Resend mocké.
- [notification-email-preview.html](./notification-email-preview.html) — aperçu généré par le renderer réel ; aucun appel Resend.

Le PDF de recette local est [am-recette-livraison.pdf](../scripts/fixtures/am-recette-livraison.pdf). `pdfinfo` le parse avec succès : 1 page, 431 octets, PDF 1.4, sans donnée personnelle.

## Intervention admin DEV à exécuter par le propriétaire

Cette procédure reste en attente d’une session interactive du propriétaire administrateur. Elle ne doit pas être remplacée par un token partagé, une session créée par script ou une promotion du compte A.

### Pré-check obligatoire

Avant toute écriture distante, confirmer dans la configuration du déploiement Convex DEV, sans copier les valeurs dans un journal :

1. `RESEND_SEND_ENABLED=false`.
2. `RESEND_PRODUCTION_SEND_ENABLED=false`.
3. L’adresse synthétique `am-recette-20260921-a+clerk_test@example.com` n’est pas dans `RESEND_TEST_RECIPIENTS`.
4. Aucun changement de gate Resend ne sera fait pendant la recette.

Si l’un de ces points n’est pas vérifiable, arrêter la procédure. Le lot ne prétend alors pas avoir démontré la publication distante.

### Réparation DEV proposée avant le dépôt client

La lecture du dossier projet synthétique A a trouvé une projection historique incorrecte : le fichier questionnaire `kd7fytq016qkab1pe7varqyffn8etz3d` (`kind=video`) est déjà rattaché à une soumission `sequence=1`, alors qu’il doit rester une référence du dossier. Cette correction n’a pas été exécutée dans ce lot.

Après validation explicite de l’opérateur et synchronisation DEV du code corrigé, la réparation bornée proposée est la mutation interne [repairAnimationQuestionnaireProjection](../convex/reviewMigrations.js). Elle doit recevoir exactement :

```text
requestId: kn72ty546hb8ny08x17eta529n8evfte
expectedSubmissionId: md79qkq7k3hmvdqs0nep0yx2ys8evjq1
expectedSourceFileId: kd7fytq016qkab1pe7varqyffn8etz3d
expectedClerkUserId: user_3JdpWDQM180Wkrd3LetcYFi3SEZ
```

La mutation refuse tout dossier non payé, propriétaire différent, identifiant différent, soumission déjà revue, cycle publié, draft/snapshot, upload ou cycle supplémentaire. En cas d’accord exact, elle supprime uniquement la soumission et le cycle projetés, conserve le fichier questionnaire et son stockage, puis doit retourner `status=repaired`. Le même appel doit ensuite retourner `status=already_clean` sans nouvelle écriture. Après cette preuve, relire le suivi A : `canSubmit=true`, `nextSequence=1`, puis effectuer le dépôt vidéo client décrit ci-dessous. Ne jamais ouvrir le studio avec le fichier questionnaire.

### Publication d’un PDF

1. Démarrer l’application locale déjà configurée sur le DEV Convex, puis ouvrir [`http://localhost:3010/nouveau/demandes?requestId=kn72ty546hb8ny08x17eta529n8evfte`](http://localhost:3010/nouveau/demandes?requestId=kn72ty546hb8ny08x17eta529n8evfte) avec la session interactive administrateur du propriétaire.
2. Sélectionner le dossier `projet-animation`, vérifier visuellement `paid / paid` et le fichier source synthétique `am-recette-feedback-2s.mp4`.
3. Dans « Retour à remettre », choisir [am-recette-livraison.pdf](../scripts/fixtures/am-recette-livraison.pdf), vérifier l’aperçu, puis cliquer « Enregistrer le retour ».
4. Vérifier dans l’interface et dans le dossier que les événements `admin_delivery_prepared` puis `admin_delivery_recorded` sont présents, que le fichier est `active`, de type `application/pdf`, et qu’il porte `deliveryStage=preparation`. Entre la préparation de l’upload et sa finalisation, l’état client attendu est `preparing`; après `admin_delivery_recorded`, il devient `delivered`. Le `delivered` final est donc l’état de remise du PDF, pas le remplacement du stage métier `preparation`.
5. Vérifier que l’outbox de livraison est créée avec `kind=pdf`, `sourceId` égal au fichier livré, et sans URL storage dans ses champs lisibles. Avec les gates Resend fermées, aucune requête externe ne doit être envoyée.

### Consultation du PDF par le client

1. Fermer la session propriétaire et ouvrir le même environnement avec le compte synthétique A, sans modifier son rôle.
2. Ouvrir `/nouveau/bibliotheque?onglet=suivi` et vérifier que le PDF est visible comme disponible.
3. Vérifier que le lien est le proxy same-origin `/api/client-deliveries/kn72ty546hb8ny08x17eta529n8evfte`, avec `Content-Type: application/pdf`, `Cache-Control: private, no-store` et sans URL `convex.cloud` ou storage dans le HTML.
4. Avec le compte synthétique B, vérifier que la même route renvoie `403` et qu’aucun fichier n’est téléchargé.

### Dépôt client de la version 1 puis publication de la review vidéo

1. Après la finalisation du PDF, fermer la session propriétaire et ouvrir le même environnement avec le compte synthétique A. Ouvrir [`http://localhost:3010/nouveau/bibliotheque?onglet=suivi&suivi=animation&requestId=kn72ty546hb8ny08x17eta529n8evfte`](http://localhost:3010/nouveau/bibliotheque?onglet=suivi&suivi=animation&requestId=kn72ty546hb8ny08x17eta529n8evfte). Le dépôt de la version 1 est une action du client : il ne faut pas ouvrir le studio administrateur avec le fichier du questionnaire `kd7fytq016qkab1pe7varqyffn8etz3d`.
2. Dans l’étape « Première review », sélectionner la vidéo de recette client autorisée, puis la déposer via le panneau de suivi. Le serveur doit créer/réutiliser la soumission `sequence=1` uniquement après la remise du PDF `deliveryStage=preparation`, puis finaliser le dépôt avec un nouveau fichier `clientRequestFiles.kind=submission`.
3. Vérifier côté compte A que le résultat expose `clientSubmissions.sequence=1` en `submitted`, `reviewCycles.cycleNumber=1` en `submitted`, et que `sourceFileIds[0]` / `reviewCycles.sourceFileId` désignent le nouvel identifiant de fichier de soumission. Conserver cet identifiant réel pour l’étape suivante; l’ancien fichier du questionnaire n’est pas une source valide de cette soumission et ne doit pas être passé au studio.
4. Si le panneau de dépôt n’apparaît pas après la remise du PDF, recharger la page et rentrer à nouveau dans le dossier A pour laisser les requêtes de suivi se réévaluer. Ne pas contourner `PREPARATION_REQUIRED` et ne pas créer de soumission depuis le studio.
5. Revenir à la session propriétaire administrateur et ouvrir le lien du studio avec `requestId=kn72ty546hb8ny08x17eta529n8evfte`, `cycle=1` et `sourceFileId=<ID réel du fichier clientRequestFiles.kind=submission>` — le composant `ReviewStudioLinks` de [requests.js](../app/nouveau/demandes/requests.js) doit reprendre l’identifiant de `firstSubmission.files[0].id`. Attendre le chargement des métadonnées vidéo, ajouter un commentaire court « Recette synthétique uniquement » et laisser la sauvegarde automatique se terminer.
6. Cliquer « Publier la version » et vérifier le snapshot immutable, le cycle `1` en statut `published` et l’outbox `kind=review`.
7. Revenir au compte A et vérifier que `reviewStudio:getMyPublishedReviews` renvoie le cycle publié et que le suivi affiche la review.
8. Vérifier que la vidéo passe par `/api/review-media/kn72ty546hb8ny08x17eta529n8evfte/video?cycle=1&file=<ID réel de soumission>`, accepte une requête `Range`, reste `private, no-store` et ne révèle pas l’URL storage brute.

Une publication book n’est pas nécessaire pour cette preuve : le dossier book synthétique A n’est pas payé. La procédure book est dans [BookReviewDelivery.js](../app/nouveau/demandes/BookReviewDelivery.js) et dépend d’une seconde soumission payée.

## Contrôle e-mail sans envoi réel

Commandes locales à exécuter depuis le checkout :

```bash
npm run verify:delivery-notifications
node scripts/verify-notification-emails.mjs
node scripts/generate-notification-preview.mjs
```

Ces contrôles remplacent `globalThis.fetch` par un stub, vérifient les variantes PDF et review, et refusent les destinataires hors allowlist ou les gates fermées. Ils ne contactent pas `api.resend.com`. Le fichier visuel à relire est [notification-email-preview.html](./notification-email-preview.html).

Le message de livraison ne contient jamais de lien storage privé : il ouvre le suivi authentifié. Les liens privés sont résolus uniquement par les routes [client-deliveries](../app/api/client-deliveries/[requestId]/route.js) et [review-media](../app/api/review-media/[requestId]/video/route.js).

## Préflight et ordre de publication

Le préflight est [preflight-production.mjs](../scripts/preflight-production.mjs). Il n’affiche aucune valeur de secret et produit des codes de blocage stables. Il distingue deux décisions qui ne doivent pas être confondues :

- `AM_PREFLIGHT_MODE=prepare` (valeur par défaut) vérifie une configuration de publication sans envoi : mode Resend `production`, provider présent, et les deux gates fermées.
- `AM_PREFLIGHT_MODE=live` vérifie uniquement la forme d’une activation approuvée : mode Resend `production` et les deux gates ouvertes. Ce mode ne contacte toujours pas Resend ; l’activation et le smoke test d’un destinataire réel restent des interventions humaines séparées.

- `AUTH_FOUNDATION`, `CLERK_PUBLIC_KEY`, `CLERK_SECRET_KEY`, `CONVEX_URL` pour la fondation et les clés live.
- `LEGACY_AUTH`, `APP_URL`, `EMAIL_ORIGIN`, `EMAIL_PROVIDER` pour l’identité, les URLs et Resend.
- `EMAIL_MODE`, `EMAIL_SEND_GATE`, `EMAIL_PRODUCTION_OPT_IN` pour empêcher une allowlist en préparation et exiger les deux opt-ins uniquement dans le mode live explicitement demandé.

Une publication contrôlée suit cet ordre :

1. `npm ci` sur le checkout exact.
2. Verifiers locaux livraison, review, admin, notifications et [verify-legacy-auth.mjs](../scripts/verify-legacy-auth.mjs).
3. `AM_PREFLIGHT_MODE=prepare npm run preflight:production` avec les variables de la cible chargées par le fournisseur.
4. `npm run build` sur le même checkout.
5. Snapshot/export fournisseur et restauration dans une cible isolée, avec preuve conservée sans secret ni PII.
6. Schéma/fonctions Convex compatibles avant le frontend, puis déploiement applicatif choisi par le propriétaire.
7. Smoke tests public, Clerk membre, isolation, livraison et proxy ; revue humaine et décision Go/No-Go.
8. Les deux gates Resend restent fermées tant que la politique de destinataires réels n’est pas approuvée séparément. Après approbation, exécuter `AM_PREFLIGHT_MODE=live npm run preflight:production` pour contrôler la forme de l’activation, puis effectuer un smoke test humain explicitement autorisé.

La procédure générale d’auth, sauvegarde et rollback est [deploiement-auth-production.md](./deploiement-auth-production.md) ; la spec d’ordre CI/CD et observabilité est [SPEC-14](./specs/14-deploiement-production.md).

## Blocages exacts au 21 septembre

La mise en production n’est pas autorisée par ce lot pour les raisons suivantes :

- aucune session admin interactive du propriétaire n’est disponible dans cette tâche ; la publication distante et la consultation client post-publication n’ont donc pas été exécutées ;
- `NEXT_PUBLIC_APP_URL` et `RESEND_APP_URL` ne sont pas configurées dans le checkout local observé ; l’origine HTTPS finale n’est pas connue ;
- la disponibilité distante de Resend est inconnue dans ce lot : aucune preuve actuelle datée de la présence ou de l’absence de `RESEND_API_KEY` n’est retenue ici ; l’opérateur doit revalider les variables Convex dans le tableau de bord à la date de la recette, sans divulguer leurs valeurs ;
- le domaine connu `animation-made.com` et la configuration DNS Resend sont des éléments de messagerie à distinguer du web : aucun hébergement, projet web, pointage web, certificat, déploiement, snapshot/restauration ou rollback fournisseur n’est sélectionné/testé ; aucun abonnement ne doit être créé automatiquement ;
- aucun déploiement Convex de production ni clé Clerk/Stripe live n’est fourni ; le préflight live doit donc rester bloquant ;
- la formalité du médiateur et les décisions de conservation restent celles de [Décisions légales](./decisions-legales-lancement.md) et doivent être relues avant le premier paiement B2C réel.

## Statut cumulatif de ce lot

| Surface | Statut | Preuve |
| --- | --- | --- |
| Contrats PDF admin et livraison client | PASS local | verifiers admin/client |
| Contrats review et proxy vidéo | PASS local | verifier studio |
| Outbox et renderer e-mail sans réseau réel | PASS local | verifiers notifications + aperçu |
| Lecture propriétaire DEV et isolation A/B | PASS distant | queries Convex en lecture seule |
| Publication PDF admin DEV | NOT RUN | session propriétaire requise |
| Publication review admin DEV | NOT RUN | session propriétaire requise |
| Consultation client après publication | NOT RUN | dépend des deux lignes précédentes |
| Préparation production | BLOCKED | blocages exacts ci-dessus |

La conclusion correcte est donc : chaîne locale durcie et recette distante d’accès/isolation prouvée ; chaîne distante de publication à exécuter par l’opérateur autorisé, puis à revalider avec ce même dossier et sans activer l’envoi réel.
