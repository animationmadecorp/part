# Administration unifiée — 22 septembre 2026

## Résultat attendu
Marie accède avec son identité Google existante à une entrée Administration réservée au rôle admin, regroupant demandes, cours/disponibilités et gestion des contenus Sanity. Sanity reste disponible sans serveur local et ses publications actualisent le site. Les comptes clients ne gagnent aucun droit admin.

## Workflow
Astra orchestrator demandé explicitement. Apex absent après inspection de /Users/kaolla/.codex/skills/apex/SKILL.md, /Users/kaolla/.agents/skills/apex/SKILL.md et recherche des deux racines. Workflow sélectionné : Apex essentials (Analyze → Plan → Execute → eXamine). Parent : 01a05cb8-2f96-7333-b548-a7534450cf3c.

## État initial
Routes /admin/reservations, /admin/disponibilites et /nouveau/demandes ; requireAdminPage et rôle Convex existants. Pas d’accueil /admin. Header public ne propose que Mon espace. Studio local : localhost:3333. Sanity ez6qtt5k/production, 18 documents publics + une fiche de test ; téléchargement add-on non raccordé, hors de cette étape. Site animation-made.com sur Vercel part. Revalidation Sanity non configurée ; cache 3600 secondes. Modifications préexistantes à préserver : .gitignore, package.json, package-lock.json, scripts/seed-sanity.mjs.

## Objectif exact du worker
Créer et vérifier un espace Administration unifié pour Animation Made : une page /admin protégée côté serveur par le rôle admin existant, un accès Administration visible uniquement au propriétaire administrateur dans son espace connecté, des accès clairs vers demandes, réservations/disponibilités et un Studio Sanity hébergé configurable sans localhost en production, ainsi qu'une actualisation fiable des contenus publiés (webhook signé existant et solution de repli bornée). Préserver le fonctionnement client et les modifications préexistantes. La réalisation doit être accessible sur mobile, refuser les non-admin, documenter les réglages externes nécessaires sans secrets, passer les vérifications ciblées et le build et obtenir un PASS cumulatif du reviewer Astra. Ne pas promouvoir de compte, publier, déployer ou modifier des services externes : Astra réalise ces opérations après vérification de l'identité et acceptation.

## Étapes
- [x] Luna Max : implémentation cohérente et revue Astra persistante.
- [x] Astra : identité Google vérifiée auprès de Clerk ; profil Convex correspondant déjà admin. Comparaison sans divulgation : clés Clerk et URL Convex locales identiques à celles de production.
- [x] Astra : accepter le diff et les preuves.
- [x] Héberger Studio, configurer son URL et le rafraîchissement, déployer le résultat autorisé.
- [x] Vérifier politique de refus membre (tests locaux), refus anonyme distant, accès propriétaire distant et lecture Sanity ; archiver la fiche de test.
- [x] Archiver Luna après acceptation.

## Preuves de démarrage
Worker : 01a0c8b9-73de-7ce0-bde4-a646bfddd729. Métadonnée runtime turn_context contrôlée : gpt-5.6-luna / max, cwd du projet. Accusé goal actif/exact reçu avant implémentation. Studio dry-run compile ; exclusion du public/ du site demandée avant publication.

## Opérations distantes vérifiées
- Studio hébergé publié : https://animation-made.sanity.studio ; appId immcgmorj3khyr4qcpd4gvh3. Navigation réelle ouvre le Studio connecté sous Animation Made. Build sans public/addons ni HTML du site.
- SANITY_STUDIO_URL configurée sur Vercel production.
- Secret de signature configuré sur Vercel via API ; webhook sJ6KkxyANmykCRBz créé pour les types éditoriaux uniquement, gardé désactivé jusqu'au déploiement final. Valeur secrète jamais affichée.
- Lecture HTTP avec session propriétaire existante : bibliothèque 200, titres Ma bibliothèque/Ma semaine ; ancienne version ne montre pas encore la fiche test. L'ancien redéploiement seul ne constitue donc pas une preuve de rafraîchissement.
- Lecture Sanity distante indépendante : `npm run verify:sanity` PASS avec accès réseau, 19 documents éditoriaux lisibles.
- Reviewer persistant lancé par Luna : Ptolemy, 01a0c8d6-8209-72f0-b7c6-3443cfd0100c, gpt-6-astra / max. Revue cumulative en cours.
- Vercel est lié au dépôt GitHub animationmadecorp/part, branche de production main : la publication utilisera les fichiers suivis uniquement.
- Premier checkpoint reviewer NON PASS : matcher proxy /admin racine, rendu sans provider Clerk en configuration absente, variantes d'URL loopback, contrastes. Luna corrige avant nouvelle revue ; aucun déploiement du site à ce stade.
- Revue cumulative finale PASS après corrections, aucun constat actionnable. Build Next 16 webpack PASS, lint 0 erreur (5 avertissements Convex générés), vérificateurs admin/auth/propriétaire/fallback PASS, contrôle indépendant parent admin/auth/Sanity et diff-check PASS. Diff accepté pour publication.

## Recette distante terminée
- Commit applicatif cec1a9f poussé ; déploiement dpl_4BcRfWiiLv9hd9Ty5XiCQhbFFo7V READY (58 secondes), alias animation-made.com et www.animation-made.com.
- Session propriétaire existante : /admin HTTP 200 avec les 4 accès et URL Studio ; bibliothèque HTTP 200 avec entrée Administration. Sans connexion, aucune carte admin n'est exposée et un écran de connexion est rendu. Aucun rôle modifié.
- /api/sanity/status : publicReadReady et revalidationReady vrais, repli 60 secondes.
- Webhook sJ6KkxyANmykCRBz activé. Modification du titre de la fiche am-resource-addon-test-sanity-20260922 : notification HTTP 200, nouveau titre constaté dans la bibliothèque réelle. Puis statut archived : seconde notification HTTP 200, fiche absente de la bibliothèque. Archivage réversible, aucune vraie ressource supprimée.
- Logs Vercel du nouveau déploiement sur les 10 dernières minutes : zéro entrée de niveau erreur au contrôle.
- Worker accepté et archivé. Téléchargement d'un vrai ZIP add-on reste hors périmètre : Sanity gère ici sa présentation, pas encore la livraison d'un nouveau fichier.
