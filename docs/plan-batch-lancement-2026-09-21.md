# Batch de lancement — 21 septembre 2026

## Résultat visé

Rendre la nouvelle expérience Animation Made publiable et testable de bout en bout, sans présenter les maquettes comme des fonctions réelles. Conserver les choix validés de design et d'offres. La mise en production, les paiements réels et les arbitrages juridiques restent conditionnés aux accès et décisions de la propriétaire.

## Workflow

Apex absent du catalogue et des deux chemins vérifiés : `/Users/kaolla/.codex/skills/apex/SKILL.md` et `/Users/kaolla/.agents/skills/apex/SKILL.md` (`CODEX_HOME` non défini). Workflow Markdown Analyze → Plan → Execute → eXamine de `astra-orchestrator/references/apex-essentials.md`.

## État vérifié avant la batch

- Achat anglais test : Checkout Stripe payé 55 €, webhook signé reçu, réservation Convex confirmée ; e-mail test Resend livré à l'adresse autorisée.
- L'envoi automatique d'e-mail après un nouvel achat n'a pas encore été testé ; la liste blanche Resend ne contient que l'adresse de test.
- Les récapitulatifs des autres offres n'ont pas de `onPayment` ; leurs questionnaires vivent dans le navigateur et les fichiers ne sont pas stockés côté serveur.
- `/nouveau/demandes` charge des fixtures ; la bibliothèque utilise des ressources statiques et ne débloque pas les achats ; Sanity n'est pas branché.
- `/` affiche l'ancien site ; `/nouveau` a `noindex` ; aucun remote Git ni projet Vercel local identifié.
- `npm run lint` : 231 erreurs préexistantes à cette batch. `npm run build` n'a pas terminé en 3 min 30 avec le serveur de développement actif et a été interrompu ; ce n'est pas un succès ni une preuve d'échec du code.

## Lots et preuves attendues

1. [ ] **Parcours publics et socle de publication** : nouvelle landing à l'URL principale sans casser les routes existantes ; indexation publique/privée cohérente ; build de production diagnostiqué et validé ; contrôles ciblés documentés.
2. [ ] **Commandes des offres non-anglais** : questionnaires persistants, fichiers privés, prix côté serveur, Checkout test signé, demandes et droits Convex, récapitulatif/confirmation cohérents ; tests de sécurité et d'idempotence. Le lot Luna actif couvre review de book, contenu et projet d'animation ; la review d'animation `/nouveau/feedback/questionnaire` est un suivi obligatoire distinct à rattacher au même socle avant clôture de la batch.
3. [ ] **Espace client et administration** : achats donnant réellement accès aux ressources et livrables ; demandes et statuts persistants, livraison privée, compte et suivi réels ; pas de fixtures visibles en production.
4. [ ] **Éditorial Sanity** : modèles, lecture, prévisualisation/revalidation et migration du contenu utile, avec solution sûre si le service n'est pas configuré.
5. [ ] **Notifications et rendez-vous** : test d'achat avec e-mail autorisé, notification automatique et rappel ; Google Meet manuel clairement exploitable ou automatisé après décision sur l'accès Google.
6. [ ] **Recette et production** : essais de deux comptes, chaque offre, annulation/remboursement, mobile/accessibilité, build/lint pertinents, configuration preview/live, domaine/HTTPS, pages légales, sauvegarde et rollback. Ne pas activer un paiement réel avant validation juridique et des clés live.

## Décisions et contraintes

- Conserver Stripe/Clerk/Convex/Resend/Sanity selon la spec ; ne pas changer fournisseur par opportunisme.
- Ne pas inventer de coordonnées de médiateur, de clé live, de Google Meet ou de contenu d'add-on.
- Ne pas publier ni encaisser en production sans preuve de parcours et validation humaine.
- Hébergement cible recommandé : Vercel pour l'application Next.js existante. ChatGPT Sites n'est pas une voie de migration directe pour cette stack et n'est pas disponible dans l'EEE au lancement selon la documentation OpenAI consultée le 21 septembre 2026. Aucun projet Vercel n'existe encore d'après la propriétaire ; la création et le domaine restent à faire après les tests.
- Le dépôt est presque entièrement non suivi par Git : préserver tous les fichiers et vérifier le transfert vers une tâche isolée avant toute délégation d'édition.

## Avancement

### Batch de clôture — reprise après PASS C4 cycles

Autorisation utilisateur : lancer tous les travaux restants avec astra-orchestrator. Apex revérifié absent ; Essentials maintenu. Réutiliser les trois tâches Luna Max existantes avec nouveaux objectifs, sans activation production.

- [ ] A — Raccorder les 17 leçons existantes au nouvel espace anglais avec droits serveur et progression privée persistante ; préparer les ressources sans inventer les add-ons/GPT.
- [ ] B — Préparer Stripe test/live explicitement fermé par défaut et preuve de consentement Checkout selon la spec ; tests de refus/idempotence et revue Astra. Aucun encaissement réel.
- [ ] C — Recette distante des livraisons/cycles et e-mails, préflight de production et dossier de déploiement indépendant de l'hébergeur ; corriger défauts démontrés hors surfaces A/B. Aucun envoi réel ni publication sans décision.
- [ ] Parent — Snapshot stable des lots précédents, synchronisation DEV, contrôle intégré des nouvelles surfaces, acceptation et archivage après revues.
- Décisions externes regroupées : hébergeur, accès de publication Sanity, URL GPT, correspondance des add-ons, formalités légales et validation Stripe live. Avancer les travaux indépendants sans inventer ces réponses.
- Baseline : cinq verifiers cycles/livraisons repassés par le parent ; C4 cumulatif PASS annoncé, build 97 pages et recette mobile 390 PASS rapportés. Correctif planning inspecté sur captures et test UI PASS, tâche A archivée après acceptation.
- Exécution lancée : A `01a0c360-e666-7921-b39c-8821194ff5a1`, B `01a0c362-a3f2-7093-90c3-9d1bf356f969`, C `01a0c367-4c43-7052-832c-2ea3a20c4702`, continuations explicites Luna Max ; runtime des trois confirmé dans turn_context. A a accusé le nouveau goal exact actif.
- Snapshot baseline `/private/tmp/am-cloture.fnYJj8`, sans copie de secrets ; verifiers submissions/delivery/planner PASS. Sync DEV `clever-bulldog-649` réussie à 22:45:00, aucune production ni envoi réel. C informé pour recette distante ; changements ultérieurs A/B non synchronisés.
- Anglais C3 reviewer PASS, verifiers lessons/UI contre-testés PASS. Snapshot sélectif `/private/tmp/am-english-integrated.sHlkTZ` : baseline + module/règles/table progression anglais uniquement, aucun nouveau paiement. Sync DEV réussie 23:27:16 ; recette navigateur confiée à A. Copie de recette complétée avec pages bibliothèque et anglais omises du premier inventaire, verifier snapshot finalement PASS.
- Anglais accepté : retouche visuelle C4 PASS, captures desktop/mobile inspectées parent (blanc sur lavande), tests lessons/UI repassés et 24 tests bibliothèque rapportés PASS. Refus distants A/B/anonyme démontrés ; progression positive/reload démontrés uniquement session propriétaire (Present simple passé 0/17 à 1/17 pendant recette, communiqué à la propriétaire, aucune autre écriture). Progression fixture A explicitement SKIPPED faute achat anglais. Goals terminés et tâche A archivée après acceptation.
- Stripe accepté comme préparation technique : revue STR-01 à STR-05 PASS, contre-tests contract/booking/refunds/non-English PASS, goal complete et tâche B archivée. Compatibilité TEST legacy maintenue quand gates absentes ; LIVE exige opt-in explicite. Création Checkout réelle avec consentement NOT RUN : URL publique des CGV Dashboard à vérifier, pas de preuve d'affichage/événement Stripe réel pour ce nouveau contrat.
- Snapshot intégré `/private/tmp/am-final-integrated.Y02dUp`, verifiers Stripe/anglais/submissions/delivery PASS. Sync DEV réussie 23:55:12, table paymentContractProofs ajoutée. Aucun live, aucun email réel, aucun changement de clé/gate. Build global de ce dernier état encore à exécuter.

### Batch technique suivante — 21 septembre après 18 h

- Acceptation coordinateur sécurité/auth : retour Stripe sans rechargement manuel vérifié, helper admin contrôlé. Remboursements et studio : verifiers rejoués PASS, revues cumulatives PASS. Synchronisation DEV à 18:01:55 réussie ; compte propriétaire confirmé administratrice par lecture distante. La recette navigateur de publication reste explicitement à exécuter.
- Apex revérifié absent aux deux chemins ci-dessus ; workflow Essentials maintenu. Réutilisation des trois tâches Luna Max après archivage des objectifs acceptés.
- A : semainier privé persistant et rendez-vous réels, sans modifier le design approuvé. Preuves : création/coche/suppression/récurrence après rechargement, isolation et erreurs réseau.
- B : notification automatique de livraison PDF/review avec événement serveur, déduplication/reprise, destinataire fiable, HTML et garde-fous dev/production. Aucun envoi réel ni activation live ; hooks studio coordonnés avec C.
- C : dépôts suivants et progression des cycles réellement inclus dans les offres, pièces privées, historique immuable et limites serveur. Pas d'invention d'une nouvelle prestation ; ambiguïtés signalées.
- Parent : recette intégrée et synchronisation uniquement sur checkpoints stables ; ensuite préparation Checkout production/consentements et dernier préflight. Aucune publication ni encaissement réel autorisés.
- D parallèle isolé : mode Stripe explicite test/live fermé par défaut et preuve contractuelle Checkout selon SPEC-06 ; modules/routes paiement et nouvelle table de preuves uniquement. Notifications coordonnées avec B, aucun changement des règles de cycles C. Preuves requises : refus live sans opt-in, pas de faux consentement rétroactif, replay/idempotence, données privées, contrats Stripe vérifiés dans documentation officielle. L'activation reste humaine.
- Création D refusée par contrôle d'autorisation de l'outil (autorisation du skill non reconnue). Pas de quatrième tâche créée : clarification asynchrone envoyée, A/B/C continuent. Ne pas déclarer D lancé.
- Runtime des trois reprises confirmé gpt-5.6-luna/max, dossier partagé correct ; trois goals exacts actifs accusés. Recette parent retour cross-origin auth PASS sans reload ; confirmations des achats synthétiques contenu/feedback/projet ouvrent bien leur requestId et rubrique propre, aucun débordement 1440 px. Script `/private/tmp/am-followup-selection-recette.mjs`, captures `/private/tmp/am-followup-*-latest.png`.
- Recette mobile 390 : contenu/projet sans débordement, feedback déborde à cause du lien « Voir la confirmation » (bord droit 433.875). Correction confiée à C sur sa surface, pas acceptée avant contre-test.
- Inventaire corrigé : `lib/englishLessons.js` contient déjà 17 leçons importées du site anglais existant ; utilisées par anciennes routes `/anglais/lessons`. Il manque leur raccordement sûr au nouveau parcours et leur validation, pas nécessairement leur rédaction. URL GPT toujours manquante.
- Intégration intermédiaire : snapshot `/private/tmp/am-integration.0ue0fY` sans secrets copiés, huit verifiers PASS (planner, delivery notifications, studio, admin requests, client deliveries, refunds, auth, non-English orders). Sync DEV `clever-bulldog-649` réussie à 18:42:24. Nouveaux indexes planner/outbox/submissions/cycles ; aucun paiement ni e-mail réel. Les éditions ultérieures et le lot cycles complet restent non acceptés jusqu'à leur recette/revue finales.
- Semainier accepté par parent : reviewer Astra C4 PASS ; `verify-planner-ui.mjs` PASS (vrai montage React/JSDOM, bascule A→B/mutation tardive/focus), `verify-planner.mjs` PASS et vraie recette navigateur `/private/tmp/am-planner-recette.mjs` PASS création/reload/coche durable/récurrence indépendante/suppression occurrence durable/isolation second compte. Capture `/private/tmp/am-planner-recette-final.png`. Les fixtures « Recette semainier ... » appartiennent uniquement au compte synthétique A en DEV. Aucun compte réel modifié par ces essais.
- Après archivage fonctionnel, inspection de capture détecte lisibilité insuffisante des titres (heure/titre flex dans colonne 150 px). Réouverture A pour objectif CSS/markup strict : titres lisibles, heure séparée, cases alignées, sept colonnes conservées, contre-captures obligatoires. Backend et recette persistence restent acquis ; acceptation visuelle en attente.

### Reprise finale après les achats test réels (environnement test)

Les constats initiaux ci-dessus sont historiques : fonctions Convex synchronisées en développement ; achats anglais solo 55 € et review 28 € vérifiés payés dans Stripe et Convex. Confirmation anglais reçue par la propriétaire, mais texte seul. Les livraisons client, le compte et la recette de production restent à terminer.

Ordre de clôture et critères d'acceptation :

1. [ ] Livraison privée : PDF administrateur réellement accessible au seul acheteur, suivi lié au dossier et non à une maquette ; tests des accès, statuts et absence de livrable.
2. [ ] E-mails : HTML de marque avec texte de secours, confirmations et livraison, aucun envoi involontaire ni doublon ; garder la liste blanche de développement.
3. [ ] Compte : profil/sécurité Clerk, historique réel, liens utiles et aucun faux bouton ; isolation de deux comptes testée.
4. [ ] Boucle de correction/studio et rendez-vous : persistance réelle, remise des retours, lien Meet administrable ; définir les interfaces après le lot livraison pour éviter les écritures concurrentes.
5. [ ] Configuration et contenu : identifier le compte administrateur, dataset Sanity, ressources et GPT réels, hébergeur et paramètres live ; ne rien inventer.
6. [ ] Recette intégrée : tests ciblés, build isolé, parcours de chaque offre, erreurs/refus/remboursement et responsive ; documenter précisément les tests non exécutés.
7. [ ] Mise en ligne : seulement après les décisions externes et validation humaine ; aucun paiement réel dans cette batch de développement.

Les trois tâches Luna existantes sont reprises, sans nouvelle tâche ni nouveau worktree. Elles gardent des surfaces séparées et leur revue Astra locale. Le coordinateur prend les vérifications transversales et la configuration en lecture seule.

Preuves de reprise : les trois runtime `turn_context` du 21 septembre 14:18–14:19 UTC confirment `gpt-5.6-luna`, effort `max`, dossier partagé attendu. Les trois workers ont accusé leur objectif exact actif. Affectations : `01a0c360-e666-7921-b39c-8821194ff5a1` compte ; `01a0c362-a3f2-7093-90c3-9d1bf356f969` e-mails ; `01a0c367-4c43-7052-832c-2ea3a20c4702` livraison.

Contrôles coordinateur avant nouvelles modifications :
- PASS `verify:client-orders` (7 tests), `verify:auth-foundation`, `verify:booking-connected`, `verify-admin-requests.mjs`.
- PASS navigateur Chromium/Playwright non connecté : landing, visibilité, feedback, book, anglais, questionnaire projet en 1440 et 390 px ; 12 réponses 200, aucune exception de page ni débordement horizontal/bouton hors largeur. Captures `/private/tmp/am-{largeur}-_nouveau*.png`. Inspection visuelle visibilité desktop et questionnaire mobile effectuée. Ce contrôle ne couvre pas l'espace connecté ni les nouveaux changements à venir.
- UI Meet déjà présente dans `app/admin/reservations/BookingAdminManager.js` : pas à recréer ; reste à tester avec le vrai rôle administrateur.
- Studio encore relié aux fixtures (`app/nouveau/studio/page.js`) ; annotations locales dans `components/ReviewStudio.js` : lot serveur indispensable.
- Sanity toujours non configuré (dataset absent), pas une réussite distante.
- Vérification distante ultérieure : `createClient({projectId:'ez6qtt5k',dataset:'production',apiVersion:'2026-03-01',useCdn:false}).fetch('count(*)')` réussit, retourne 0. Le dataset PUBLIC `production` existe réellement. Le listage global des datasets nécessite authentification (401). Nom résolu sans demander à la propriétaire ; configuration locale et publication/seed authentifié restent à faire.
- Réglages Stripe/Resend locaux prêts pour tests, envoi limité à la liste blanche. Le mode live n'est pas implémenté/activé.

Points transversaux constatés, à traiter après les surfaces actives :
- `lib/session.js` conserve un secret de repli connu : refuser les sessions legacy en production sans secret sûr, sans casser le parcours Clerk. Examiner les anciennes routes authentifiées avant publication.
- Les sessions Checkout ne configurent pas encore `consent_collection` et les commandes ne portent pas de preuve contractuelle : raccorder le mécanisme validé au checkout, sans inventer un consentement existant.
- Le traitement des remboursements anglais doit être complété/vérifié : `bookings.js` traite les paiements tardifs mais ne contient pas de branche `charge.refunded` pour les remboursements ordinaires. Révocation des crédits/droits et historique à inclure dans le lot paiement avant activation live.
- Ressources anglais : GPT sans URL et contenus réels encore à fournir ; ne pas annoncer de contenu livré à partir d'une simple carte.
- Livraison PDF : décision validée d'une route Next authentifiée qui diffuse le fichier, sans exposer de bearer URL de stockage au navigateur. Ceci contrôle l'accès au service, pas le partage ultérieur d'un fichier téléchargé.

Recette connectée coordinateur :
- Deux comptes fictifs Clerk développement marqués `purpose=am-production-readiness-20260921`, adresses `am-recette-20260921-{a,b}+clerk_test@example.com`, créés pour la recette. Aucun compte réel usurpé, aucun paiement ni message réel envoyé par ces tests.
- Connexion navigateur réelle Clerk → profil Convex → Mon suivi : PASS pour les deux comptes ; état vide avec liens offres, aucune fausse prestation. Captures `/private/tmp/am-test-account-a.png` et `...-b.png`.
- Brouillon fictif review `kn716mx6qnf54q1ykvt0z4w7k18ev3qc` créé par A dans Convex dev ; A peut le lire, B reçoit un refus et sa liste ne contient pas le brouillon : PASS. Sessions de recette révoquées/fermées. Les comptes et le brouillon restent identifiables comme données de test dans le développement seulement.
- Accès navigateur anonyme bibliothèque, demandes, studio, réservations admin, disponibilités admin : les cinq affichent la connexion requise, sans données privées.
- 40 tests unitaires de suivi, droits, questionnaires et confirmation : PASS avant les nouveaux changements workers.

Ordre des suivis après acceptation des trois objectifs actifs (ne pas interrompre leurs revues) :
1. Sécurisation de publication : secret legacy jamais implicite en production, ancien auth ne doit pas ouvrir l'espace Clerk, préflight de configuration sans affichage de secrets, procédure de déploiement et retour arrière. Ne pas activer les clés live.
2. Studio et révisions : retirer les fixtures, charger les fichiers d'un dossier payé, sauvegarder automatiquement les dessins/textes/commentaires côté serveur avec conflit/version explicite, publier une version figée consultable en lecture seule par l'acheteur ; raccorder les soumissions suivantes prévues par les offres (deux reviews projet, deuxième lecture book). Conserver le lecteur/aspect ratio, pas de plateforme externe ajoutée.
3. Confirmation de livraison : raccorder le modèle e-mail au vrai événement de publication accepté et tester l'unicité/reprise sans envoi réel non autorisé.
4. Checkout production et preuve contractuelle : implémenter le mode explicite et les garde-fous, version/horodatage des conditions et demande de commencement anticipé selon SPEC-06, jamais reconstituer rétroactivement une acceptation. Activation seulement après les éléments externes.
5. Recette stable finale et déploiement conditionné aux réponses propriétaire (compte admin, hébergement, dataset, contenus, formalités).

Constat additionnel de recette : `Planner.js` garde ses tâches uniquement dans `useState`, sans stockage local ni serveur. Les tâches sont perdues au rechargement. Prévoir un sous-lot persistance privée Convex du semainier (création, récurrence, coche, suppression, identité), avec ses rendez-vous anglais réels ; ne pas présenter le tableau de bord comme définitivement raccordé avant ce lot. Les ressources et la progression des leçons nécessitent aussi les vrais contenus et la persistance, pas les cartes de présentation seules.

Inventaire ressources retrouvé : cinq archives existent déjà dans `public/addons` (`am_camera_moves.zip`, `anim_studio.zip`, `lighting_studio.zip`, `lipsync_studio.zip`, `pose_bank.zip`), cataloguées dans `lib/addons.js`. Ce ne sont donc pas des fichiers absents. Leur correspondance avec les nouvelles fiches, leur distribution gratuite/payante et leur compatibilité Blender ne sont pas validées ; l'archive anim_studio contient bien licence et code Python (non exécuté). Ne pas inventer la correspondance `scene-light` ni annoncer une compatibilité testée. La vérification des add-ons avait été réservée à la propriétaire.

Preuve de build intermédiaire : worker compte a construit un snapshot isolé `/private/tmp/am-platform-account-build.mRKREt`, exit 0. Ce build précède les ultimes modifications des autres workers et n'est pas la preuve de build final intégré. Test navigateur compte au checkpoint : fenêtre Clerk ouverte, brouillon exclu de l'historique, captures desktop/mobile ; le contrat compte évolue ensuite pour contrer le cache inter-identités, donc recette à rejouer après synchronisation.

### Acceptation des trois sous-lots, 21 septembre 16:55 Paris

- Compte : PASS cumulatif reviewer + contrôle coordinateur après synchronisation. Query distante réelle, refus d'identité différente, navigateur connecté sans erreur, historique vide correct et fenêtre Clerk réellement ouverte. Capture `/private/tmp/am-account-final.png`.
- Notifications : PASS cumulatif reviewer + verifiers coordinateur ; aperçu mobile du vrai renderer inspecté, largeur 390/390, capture `/private/tmp/am-email-final-mobile.png`. Aucun nouvel e-mail réel envoyé. Le déclenchement de livraison reste un suivi distinct.
- Livraison : PASS cumulatif reviewer + verifiers admin/delivery/commandes ; query distante réelle accessible au compte autorisé. Téléchargement final avec propriétaire administrateur et PDF réel reste à recetter : pas de prétention de preuve E2E complète.
- Synchronisation Convex développement réussie à 16:54 : account, clientNotifications, clientDeliveries et proxies exposés. Aucune production touchée.
- Sanity : quatre variables publiques ajoutées à `.env.local`, `verify:sanity` PASS lecture distante, 0 document publié. Aucun secret modifié ni contenu publié.
- Trois tâches archivées après acceptation de ces sous-lots ; réouverture pour de nouveaux objectifs séparés, pas clôture globale du lancement.
- Nouveaux objectifs actifs : A sécurité publication/legacy ; B remboursements anglais ; C studio persistant. Éditions séparées, aucune activation production.
- Recette contenu 58 € : questionnaire UI → récap → Checkout test montant correct → carte fictive Stripe → Stripe `paid/complete/livemode=false` et Convex `paid/paid`, dossier `kn79svcmb2n2bhrdcnek3nrr7h8etqq2`, session `cs_test_a1eMoQB8FEEIcne4SU72w8jCzB6rn32dvgmdisMwmwLQMvNEWEpxyro9Qa`. Adresse fictive exclue de la liste blanche Resend avant soumission, opt-in production faux. Mon suivi réel affiche Contenu, Analyse et Livraison à venir (10 jours). Retour direct post-Stripe a demandé reconnexion dans cette recette par ticket ; l'accès après reconnexion fonctionne, état final confirmation reste à attendre explicitement. Ne pas assimiler cela à une preuve de retour transparent.
- Confirmation contenu après attente explicite : PASS « Ton dossier est bien commandé », total 58 €, capture `/private/tmp/am-content-confirmation-final.png`.
- Feedback38 : vidéo synthétique H264 de2s déposée par UI, fichier privé `kd7adwtv87r91p19f6705p60hs8et2ve`, dossier `kn76x96473vjxzt5zgz1rr0n758ev8yv`, Stripe session `cs_test_a1vA3V7v4iycfnsiPy1MKXkuir02HhwloNBCypY7o8bGqMbSMEMAf6A7bf` paid/livemode=false/3800 et Convex paid. Aucun e-mail autorisé vers cette adresse fictive. Retour direct depuis Stripe affiche encore la connexion requise : investigation explicite transmise au lot sécurité, pas déclaré résolu.
- Scan liens publics des offres : 12 routes testées, toutes HTTP200, aucune404.
- Projet88 : questionnaire et pièce synthétique via UI, dossier `kn72ty546hb8ny08x17eta529n8evfte`, fichier `kd7fytq016qkab1pe7varqyffn8etz3d`, session Stripe test `cs_test_a1qlSzvQvuFwueIp1OLU3WIVhTUYa3rIFnIp2Vg8BvgHBtI95uKsg5AUSI` paid/livemode=false/8800 et Convex paid. Source synthétique identique, aucun fichier personnel transmis.
- Reproduction auth sans paiement : Mon compte connecté → example.com → lien confirmation produit SSR anonyme malgré Clerk client signed-in ; reload affiche confirmation. Cookie values jamais affichées. Script `/private/tmp/am-auth-return-recette.mjs`, correction bornée confiée au lot sécurité.
- Configuration e-mails : `RESEND_APP_URL` et `NEXT_PUBLIC_APP_URL` absents, le nouveau renderer refuse donc l'envoi (configuration_required) plutôt que fabriquer des liens. À compléter explicitement avant recette réelle ; autorisation d'un seul nouveau test vers la propriétaire demandée. Le double opt-in production reste faux, et l'allowlist bloque les trois achats synthétiques.

- [x] Inventaire initial et sélection du workflow.
- [x] Première délégation : tâche Luna Max locale `01a0c360-e666-7921-b39c-8821194ff5a1` (lot 1, publication de la landing) depuis la tâche d'origine `01a05cb8-2f96-7333-b548-a7534450cf3c` ; goal actif et modèle/effort vérifiés dans le journal de runtime.
- [x] Deuxième délégation : tâche Luna Max locale `01a0c362-a3f2-7093-90c3-9d1bf356f969` (lot 2, commandes et dossiers privés non-anglais), avec surfaces séparées du lot 1 ; goal actif et modèle/effort vérifiés dans le journal de runtime.
- [x] Troisième délégation : tâche Luna Max locale `01a0c367-4c43-7052-832c-2ea3a20c4702` (lot Sanity éditorial), ownership séparé des lots publication/commerce ; modèle Luna Max vérifié dans le journal de runtime.
- [x] Revue et acceptation du lot 1 : reviewer Astra persistant PASS, 25/25 tests métier, lint ciblé PASS ; blocage build global (Google Fonts et deux CSS Modules hors lot) transmis comme suivi distinct. Tâche archivée après acceptation.
- [x] Suivi build délégué à la même tâche Luna Max `01a0c360-e666-7921-b39c-8821194ff5a1`, désarchivée pour un nouveau goal exact, avec ownership CSS/polices séparé.
- [x] Suivi build : revue Astra PASS, polices locales, CSS Modules corrigés, 32/32 tests ciblés ; `npm run build -- --webpack` réussit en isolement. Le build Turbopack par défaut reste silencieux après 4 minutes : à finaliser par un script de build explicitement Webpack lorsque l'ownership de `package.json` sera libéré par le lot commandes.
- [x] Revue et acceptation du lot 2 : reviewer Astra PASS cumulatif, trois offres review/contenu/projet-animation, 7/7 contrats ciblés + 25/25 tests existants, auth/booking et ESLint ciblé. Pas encore de test E2E Stripe/Convex, de livraison vidéo privée ni de review d'animation ; ces points restent des lots explicites.
- [x] Suite lot 2 déléguée à la même tâche Luna Max `01a0c362-a3f2-7093-90c3-9d1bf356f969` après clôture/archivage du premier goal : feedback/review d'animation 38 € avec dossier Convex et Checkout test. En cours.
- [x] Suite bibliothèque déléguée à la tâche Luna Max `01a0c360-e666-7921-b39c-8821194ff5a1` avec ownership UI séparé du backend actif : déverrouillage par achats confirmés du compte, sans inventer des assets disponibles. En cours.
- [x] Suite administration déléguée à la tâche Luna Max `01a0c367-4c43-7052-832c-2ea3a20c4702` avec ownership /nouveau/demandes et module Convex séparé : remplacer fixtures par dossiers réels protégés, supprimer les actions non persistées. En cours.
- [x] Revue et acceptation du lot Sanity : reviewer Astra Banach PASS cumulatif C4 ; schémas, lecture/fallback, cinq pages publiques HTTP 200 et contrôles ciblés. Projet connu `ez6qtt5k`, dataset réel non fourni : lecture publiée et changement sans redéploiement non démontrés, activation externe encore requise.

### Nouveau suivi — notification de livraison (21 septembre)

- [x] Ajouter une outbox Convex atomique pour les publications PDF administrateur et snapshot review, avec déduplication `(requestId, kind, sourceId)`, destinataire issu du dossier payé, recheck paiement/remboursement avant envoi, retries bornés et aucun lien bearer/storage privé dans le message.
- [x] Ajouter l’action Resend HTML+texte et les mutations de claim/complete dans `convex/deliveryNotifications/actions.js`; préparer un opt-in production explicite distinct de l’allowlist développement, sans activer l’envoi réel.
- [x] Ajouter le hook minimal `finalizeDelivery` dans `adminRequests.js`; C ajoute le même contrat après publication réelle dans `reviewStudio.js` sans modification concurrente de ce fichier par ce worker.
- [x] Prouver déduplication, échecs/reprise, isolation entre dossiers, destinataire serveur, garde-fous d’URL et configuration par tests synthétiques/mockés; obtenir un PASS cumulatif Astra avant clôture.

Preuve de clôture notification livraison : `npm run verify:delivery-notifications`, `node scripts/verify-notification-emails.mjs`, `node scripts/verify-admin-requests.mjs`, `node scripts/verify-booking-connected.mjs`, `node scripts/preflight-production.mjs` et ESLint ciblé passent. Le test livraison couvre déduplication PDF/review, deep-link `requestId`, remboursement concurrent, payload Resend immuable, fenêtre d’idempotence, watchdog après écriture de payload, corps HTTP suspendu et zéro envoi hors garde-fou. Revue Astra cumulative finale : PASS (DEL-01 à DEL-05 fermés). Aucun e-mail réel, aucune activation production et aucune synchronisation Convex effectués dans ce lot.
