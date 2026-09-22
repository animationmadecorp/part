# Batch réservation complète

## Reprise du 21 septembre — validation des services

Orchestration principale : `01a05cb8-2f96-7333-b548-a7534450cf3c` ; exécution existante à reprendre : `01a0bf33-d51c-7b63-a46b-3f25af2e0010`. Apex absent des deux emplacements `/Users/kaolla/.codex/skills/apex/SKILL.md` et `/Users/kaolla/.agents/skills/apex/SKILL.md`, recherche des racines installées négative : workflow Markdown Analyze → Plan → Execute → eXamine maintenu.

Les clés Stripe test et Resend sont désormais présentes dans `.env.local` (valeurs non affichées). Le domaine `animation-made.com` a été ajouté à Resend ; les trois enregistrements DNS d'envoi ont été ajoutés dans Hostinger. Dernier constat utilisateur : CNAME `send` validé, DKIM et CNAME `rsend` encore Pending. Aucun MX de réception ajouté. La bibliothèque affiche désormais la frontière `unavailable` après connexion : l'erreur précise Clerk/jeton Convex/profil reste à établir.

- [x] Identifier et corriger la cause réelle du refus de bibliothèque ; vérifier une session membre réelle et le profil Convex sans contournement d'authentification.
- [ ] Vérifier publiquement les trois enregistrements DNS Resend et la portée utilisable de la clé ; configurer l'expéditeur local et Convex quand le domaine est prêt.
- [ ] Configurer les secrets de liaison et la réception des événements Stripe test, puis vérifier les parcours réels disponibles.
- [ ] Refaire uniquement les contrôles invalidés par les changements ; obtenir revue cumulative et preuves fournisseur, ou relever les seuls blocages nécessitant l'utilisateur.

Preuves obtenues par l'orchestrateur le 21 septembre :
- Nouvelle exécution `01a0c302-6cda-7421-bc88-499640822921` créée en Luna Max local, car le goal de l'ancien worker est encore `blocked` et non réactivable par update_goal. Arrêt des écritures demandé à l'ancien worker ; ne pas travailler simultanément. Nouveau goal ciblé : rétablir bibliothèque Clerk–Convex, préparer Resend envois désactivés, configurer/vérifier Stripe test avec revue cumulative.
- Runtime worker confirmé par turn_context : `gpt-5.6-luna`, effort `max`, dossier local du projet.
- DNS public : TXT DKIM présent ; CNAME rsend et send conformes. Interface Resend : domaine et trois enregistrements `verified`, Sending activé, Receiving désactivé, région Ireland.
- Clé Resend limitée à l'envoi (`restricted_api_key` sur lecture /domains), limitation conservée.
- L'utilisatrice a explicitement autorisé un seul test vers `animationmadecorp@gmail.com`. POST /emails HTTP 200, id `01a0c2fe-2a7c-70b5-ab16-19d77b552a7c`, clé d'idempotence `animation-made-setup-test-20260921`. Interface Resend confirme `delivered`. Ne pas renvoyer ce test.
- Diagnostic auth : GET Clerk /v1/jwt_templates HTTP 200, tableau vide. Le template `convex` demandé par l'application est absent. Convex dev possède bien l'issuer `https://picked-hornet-1277.clerk.accounts.dev`. Cause transmise au worker pour correction.
- Correction fournisseur : template Clerk `convex` créé par le worker et relu via API. L'orchestrateur a ensuite ouvert la bibliothèque avec la session réelle : ressources et restrictions affichées, plus de frontière indisponible.
- Contrôle complémentaire : Mon suivi → Anglais échoue côté React (`Maximum update depth exceeded`, `EnglishFollowUpContent`). Le snapshot d'horloge `Date.now()` de `useSyncExternalStore` n'est pas stable ; correction confiée au même worker. Ne pas confondre ce défaut d'affichage avec le blocage d'authentification désormais corrigé.
- Mon compte reste une interface partiellement non branchée (champs et actions désactivés dans `Account.js`) ; l'accès à la bibliothèque ne valide pas ces fonctions.
- Correction de l'horloge appliquée : snapshot stable, actualisé par intervalle. L'orchestrateur a rechargé et ouvert Mon suivi → Anglais : aucun cours, zéro crédit et aucun pack (état réel attendu), sans frontière d'erreur ; état resté stable après plus de 30 secondes. Le lien Réserver un cours ouvre bien le calendrier avec créneaux disponibles et prix solo 55 €. Aucun paiement ni réservation créé par ce contrôle navigateur.
- `node scripts/verify-booking-connected.mjs` repassé par l'orchestrateur : PASS. Le préflight reste à revérifier après configuration ; un PASS local ne constitue pas un paiement Stripe de bout en bout.
- État final intermédiaire des variables, relu sans valeurs : local Resend préparé avec expéditeur, destinataire test et envoi désactivé ; secrets `STRIPE_WEBHOOK_SECRET` et `BOOKING_WEBHOOK_SECRET` locaux absents. Convex dev contient `BOOKING_WEBHOOK_SECRET`, issuer Clerk, expéditeur, destinataire test et envoi désactivé ; `RESEND_API_KEY` distant absent. Ne pas déclarer les secrets synchronisés.
- Blocage de sécurité : les tentatives de mutation du secret partagé ont été refusées par auto-review ; pas de contournement. Autorisation utilisateur explicite demandée pour copier la clé Resend vers Convex dev et configurer le secret partagé local/Convex dev. Le worker ne doit plus muter ces secrets en attendant la réponse.
- Autorisation reçue ensuite dans la conversation principale : « bah vas y alors tfaçon aucun argent peut etre pris ya pas de carte ni rien », après explication des deux transferts et de leur portée. Worker existant informé : reprise autorisée uniquement en développement, secret Resend vers Convex et secret partagé local/Convex, sans affichage des valeurs, sans email supplémentaire, `RESEND_SEND_ENABLED=false` conservé. L'autorisation ne vaut pas preuve d'exécution ; vérifier les égalités par lecture masquée.
- Incident d'exécution : le worker a affiché la clé Resend et le secret booking dans des sorties techniques malgré la consigne de masquage. Aucun secret reproduit dans ce document. Utilisatrice informée. Main a révoqué la clé Resend exposée via UI (liste vide vérifiée), puis créé une clé de remplacement limitée à Sending access pour animation-made.com. Nouvelle clé laissée dans le dialogue Resend, copiée via bouton UI sans afficher sa valeur ; .env.local ouvert dans TextEdit pour remplacement manuel. Ne pas réutiliser l'ancienne clé. Rotation du secret booking exposé demandée au worker, puis revue cumulative ; pas encore validée.
- Stripe test : aucun endpoint webhook fournisseur configuré d'après lecture API worker. CLI locale absente au contrôle initial ; Homebrew disponible. L'installation/configuration du listener et le paiement complet restent à faire après résolution des secrets. Aucun paiement réel ni e-mail supplémentaire envoyé.

Critères : accès réel à la bibliothèque, absence de fuite de secrets, distinction claire entre tests locaux et fournisseur, webhook Stripe signé traité une seule fois, e-mails limités au destinataire de test explicitement confirmé. Pas de paiement réel, pas de production, pas de désactivation des protections. Le contrôle DNS et navigateur est assuré par l'orchestrateur ; les changements applicatifs, variables de développement et corrections sont confiés au worker existant. Ne pas modifier les DNS Hostinger pendant la propagation sans défaut démontré.

## Workflow
Astra orchestrator explicitement demandé. Apex absent après contrôle des chemins /Users/kaolla/.codex/skills/apex/SKILL.md, /Users/kaolla/.agents/skills/apex/SKILL.md et recherche dans les skills/plugins installés. Workflow Markdown Analyze → Plan → Execute → eXamine. Exécution Luna Max avec revue Astra persistante et acceptation principale.

## Résultat et limites
Le parcours anglais est implémenté contre Clerk + Convex : disponibilités administrateur, réservation atomique, maintien temporaire du créneau, crédits des packs, suivi membre/admin, reports, lien Meet manuel et files de notifications versionnées. Stripe est limité aux événements test signés ; Resend reste désactivé par défaut et allow-listé. Interfaces existantes conservées. Aucune vente réelle, aucun e-mail et aucun déploiement production. Les autres offres restent sans rendez-vous. Sanity est une tranche ultérieure indépendante.

La revue Astra cumulative finale est **C7 PASS** sur le code. Cette acceptation couvre les preuves locales et les simulations déterministes, pas un E2E fournisseur : le compte Clerk de test reste bloqué par le challenge `client-trust`, aucun compte administrateur de test n’a été élevé, et les variables Stripe/Resend ne sont pas présentes dans `.env.local`.

## Ordre et critères
- [x] Corriger les défauts de connexion et protéger les pages/routes privées par Clerk + Convex ; le parcours réel d’inscription/connexion reste à exécuter avec le challenge Clerk disponible.
- [x] Relier disponibilités, exceptions et réservations Convex ; refus anonyme/admin et isolation synthétique vérifiés.
- [x] Réserver temporairement un créneau puis gérer confirmation Stripe signée/idempotente, expiration, abandon et événements tardifs dans le code ; fournisseur Stripe test non appelé.
- [x] Packs 4h/200 € (3 mois), 8h/360 € (6 mois), solo 55 €, duo 68 € un payeur ; crédit consommé une fois, report jusqu'à 24h, exceptions administrateur.
- [x] Brancher suivi client/admin et lien Meet manuel ; les parcours anglais concernés n’utilisent plus les fixtures locales.
- [x] Préparer confirmations/rappels/reports Resend avec snapshot immuable, retries et allow-list ; aucun envoi tant que les destinataires tests et les variables ne sont pas configurés.
- [x] Vérifier localement concurrence logique, isolation, idempotence, erreurs et accès HTTP ; E2E fournisseurs et concurrence réelle Convex restent explicitement non validés.
- [x] Revue cumulative finale C7 PASS ; l’archivage et la validation E2E restent conditionnés aux accès externes.

## Preuves locales finales

- `node scripts/verify-booking.mjs` : PASS.
- `node scripts/verify-booking-connected.mjs` : PASS.
- `npm run verify:auth-foundation` : PASS.
- `node --test app/nouveau/confirmation/confirmationLogic.test.mjs` : 14/14 PASS.
- ESLint ciblé des fichiers modifiés : PASS.
- `npx convex codegen` et `npx convex dev --once --typecheck disable --tail-logs disable` : PASS sur `clever-bulldog-649`.
- `npm run build` : PASS, 91 pages Next.js générées.
- Contrôles HTTP locaux : réservation anonyme gardée par Clerk ; checkout/notification anonymes en 401 ; signature Stripe invalide en 400.
- Identité synthétique Convex : disponibilité et suivi membre vides sans fuite ; requête admin refusée avec `FORBIDDEN`.
- Transaction Convex dev réelle : l’identité synthétique `worker-member` a créé un hold impayé le 22 septembre à 09:00 ; `worker-member-b` a reçu `SLOT_UNAVAILABLE` sur le même créneau puis `FORBIDDEN` en tentant d’annuler le hold ; le propriétaire l’a ensuite annulé et la disponibilité finale ne contient aucun booking actif.
- `npm run verify:booking-external` est le préflight sans secret affiché ; il reste actuellement `NOT READY` jusqu’à la configuration Stripe/Resend locale et son miroir Convex.

## Accès connus
Clerk app_3JYG4kDpRA5yu86dvpidjVwY2QA (development), Convex animationmadecorp/animation-made déploiement clever-bulldog-649. Secrets uniquement `.env.local` et variables Convex dev ; ne jamais les envoyer dans le chat. À renseigner pour l’E2E : `STRIPE_SECRET_KEY` (`sk_test_`), `STRIPE_WEBHOOK_SECRET`, `BOOKING_WEBHOOK_SECRET`, puis `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_TEST_RECIPIENTS` et `RESEND_SEND_ENABLED=true` seulement avec un destinataire de test autorisé, en miroir sur Convex pour le consommateur durable. Ne pas attribuer administrateur au compte public de test dont les identifiants ont été partagés ; identifier le compte personnel de Marie avant toute élévation.

## Objectif exact du worker
Implémenter et vérifier dans AM-PLATEFORM le parcours de réservation anglais connecté à Clerk et Convex, avec disponibilités administrateur, réservation atomique, maintien temporaire de créneau et confirmation Stripe en mode test, crédits des packs, reports selon la règle des 24 heures, suivi client et administrateur, lien Google Meet manuel et notifications Resend. Réparer les défauts de connexion existants, préserver les interfaces et les règles commerciales validées, démontrer les contrôles d'accès, l'isolation des comptes, l'absence de double réservation et l'idempotence des paiements et crédits par des vérifications adaptées, puis obtenir une revue Astra cumulative PASS du code final. Demander immédiatement les accès externes manquants en poursuivant le travail indépendant ; distinguer précisément les preuves locales des parcours réels non testés et ne pas déclarer le parcours connecté complet tant que ses dépendances nécessaires restent absentes.
