# Audit avant intégrations — 16 septembre 2026

## Conclusion opérationnelle

La nouvelle zone est une maquette navigable et cohérente sur son périmètre éditorial visible : les quatre offres sont accessibles, les tarifs affichés correspondent aux décisions actuelles et les quatre onglets du client sont présents. Les connexions peuvent commencer progressivement, mais les boutons de réservation et le paiement réel doivent rester désactivés : les parcours croisés de la bibliothèque sont incorrects et les frontières compte, droits, fichiers, suivi, paiement et réservation restent à brancher.

Le point de navigation est un défaut visible reproductible. Les éléments fictifs, boutons désactivés, état local du semainier et absence de téléchargement réel sont, eux, documentés comme limites de la maquette ; ils sont listés ci-dessous comme travaux avant production, pas comme preuves d'une fuite de données ou d'un paiement défaillant.

## Périmètre et méthode

Pages auditées :

- `/nouveau`
- `/nouveau/feedback`
- `/nouveau/review`
- `/nouveau/visibilite`
- `/nouveau/anglais`
- `/nouveau/bibliotheque`, avec `?profil=review`, `?onglet=tableau-de-bord` et `?onglet=compte`

Sources de référence utilisées : `docs/specs/00-cadrage-nouvelle-version.md`, `docs/specs/points-restants-offres.md`, `docs/specs/mon-compte.md`, `docs/specs/semainier-ajout-tache-plan.md` et les décisions complémentaires validées dans la session (notamment délai maximal d'une semaine et retour unique Feedback). Les documents historiques et le PRD non harmonisé ont seulement servi à repérer les restes de prototype, pas à remplacer ces décisions.

Contrôles réalisés : réponses HTTP 200 sur les routes ciblées, lint ciblé `npx eslint app/nouveau`, inspection du code, et recette navigateur réalisée dans la session d'origine. La recette navigateur a notamment vérifié le passage sur mobile à 390 px sans débordement horizontal, les quatre onglets, les filtres, le mauvais parcours Anglais, la modal de téléchargement sans fichier et l'état désactivé du compte. Aucun achat, compte réel, réservation ou connexion externe n'a été effectué.

Limite importante : l'audit n'a pas testé un backend déployé, Stripe, Clerk, Convex, Sanity, les droits serveur, l'isolation entre comptes, les webhooks, les emails, les téléchargements signés ou la sécurité des fichiers. Les constats d'intégration ci-dessous sont donc des gaps vérifiés dans le prototype, pas une certification de sécurité.

## Constats priorisés

### P2 — Les CTA Anglais et Contenu/visibilité de la bibliothèque renvoient vers la mauvaise fiche

Dans `app/nouveau/bibliotheque/Library.js:35`, les ressources verrouillées Anglais et visibilité construisent un lien vers `/nouveau/review?offre=anglais` ou `/nouveau/review?offre=visibilite`. `app/nouveau/review/page.js:25` affiche alors « Sa fiche viendra ensuite » et la fiche Review à 28 €, alors que les deux fiches existent déjà. Le parcours Anglais a été reproduit par clic dans le navigateur ; le parcours Contenu/visibilité est établi par le code et l'inspection DOM du même CTA.

Action : relier chaque CTA à sa fiche réelle (`/nouveau/anglais` et `/nouveau/visibilite`), supprimer le message de chantier générique ou le réserver à une vraie offre non publiée, puis ajouter un test de correspondance offre → route.

### Décision à synchroniser — Le wording Review/Feedback doit être recopié dans la source de référence

La fiche Review affiche un « PDF personnalisé sous sept jours » dans `app/nouveau/review/page.js:16` et `:38`, et la fiche Feedback affiche « Un seul passage de correction » dans `app/nouveau/feedback/page.js:25`. Ces deux éléments sont validés par les décisions complémentaires de la session ; leur absence du fichier `docs/specs/points-restants-offres.md` est donc une documentation incomplète, pas une incohérence produit établie.

Action : synchroniser ces engagements dans la fiche type, le checkout, les emails et les CGV. Garder ouvertes les décisions explicitement non tranchées : volume/modalités du second retour Review, délai de livraison Contenu/visibilité, niveaux et disponibilités Anglais, duo, annulation et politique de remboursement.

### P1 — La source de contenu contient une fiche Review obsolète et contradictoire

L'export `review` de `app/nouveau/_data/content.js:8-14` contient encore « 60 minutes », « 1 séance individuelle », « 60 € » et « en visio », alors que la fiche rendue affiche 28 €, sans visio. L'export semble inutilisé par les routes actuelles, donc l'écart n'est pas visible dans la recette ; il deviendra dangereux lors du branchement CMS ou d'une réutilisation du fixture.

Action : supprimer ou marquer explicitement ce fixture comme historique, conserver une seule source de vérité par offre et ajouter un contrôle empêchant qu'un tarif ou une modalité divergente soit réintroduit.

### P2 — Le catalogue gratuit promis sur la landing ne correspond pas encore au catalogue visible

La landing annonce des « add-ons Blender » et donne comme exemple un add-on pour installer un éclairage et ajuster le fond dans `app/nouveau/page.js:15`. La bibliothèque ne propose actuellement que « Ton mini-kit de poses » et une fiche de routine dans `app/nouveau/_data/content.js:19-20`. Ce n'est pas un simple oubli de fixture : le catalogue gratuit et la promesse « Vie professionnelle gratuite après inscription » (`docs/specs/mon-compte.md:23`) doivent être définis ensemble, alors qu'aucune ressource « Vie professionnelle » n'apparaît dans ce jeu de données.

Action : choisir les cadeaux réellement livrés au lancement, aligner le texte de la landing, les collections et les identifiants de ressources, puis renseigner dans Sanity les métadonnées de compatibilité, de licence et la référence du fichier privé ; conserver le fichier dans un stockage protégé.

### P0 — Gate d'intégration : l'entrée gratuite et le profil Review sont encore une démonstration publique

`app/nouveau/page.js:15` et le lien d'espace dans `app/nouveau/_components/Shared.js:4` ouvrent directement `/nouveau/bibliotheque`. `app/nouveau/bibliotheque/page.js:2` accepte `?profil=review`, et `app/nouveau/bibliotheque/Library.js:11,28,31-33` maintient le profil, l'identité « Léa », les droits et l'état dans le navigateur. Cela permet de simuler l'accès Review dans l'URL publique ; aucune fuite de donnée réelle n'a été démontrée puisque les données sont fictives et aucun backend d'entitlement n'est branché.

Action avant de rendre disponible un contenu payant : faire passer création/connexion par Clerk, calculer les droits côté serveur à partir de la commande Stripe et des données privées Convex, supprimer le switch de profil et le paramètre public de démonstration, puis tester l'isolation entre comptes. Si une preview publique est conservée, l'identifier explicitement comme telle ; `PreviewNote` existe dans `app/nouveau/_components/Shared.js:6` mais n'est pas monté dans les pages auditées.

### P1 — Les fichiers, le suivi et les livrables ne sont pas encore reliés

Pour une ressource accessible, `app/nouveau/bibliotheque/Library.js:35,37` ouvre une modal qui affiche « Aucun fichier disponible pour cette ressource. » ; le clic sur le mini-kit gratuit l'a confirmé. L'onglet Mon suivi est encore un texte de prévisualisation dans `Library.js:35`, sans statut de commande, questionnaire, rendez-vous, livrable ou PDF.

Action : définir dans Sanity les métadonnées éditoriales et les références de ressources, dans Convex les données privées et les états de livraison, et conserver les fichiers payants dans un stockage protégé hors dataset public, avec entitlement et URL signée. Construire ensuite le suivi Review/Feedback/Projet/Visibilité, les uploads/questionnaires et les livraisons PDF avant d'activer les CTA.

### P1 — Le semainier et les états de bibliothèque sont volatils

`app/nouveau/bibliotheque/Planner.js:82-84` initialise les tâches en mémoire ; les changements disparaissent au rechargement. C'est conforme à la maquette approuvée par `docs/specs/semainier-ajout-tache-plan.md:22`, mais pas à un espace client intégré. Le cadrage actuel mentionne calendrier, tâches et raccourcis utiles ; les raccourcis et la persistance restent à confirmer/compléter.

Action : persister les tâches par utilisateur dans Convex, gérer fuseau horaire, récurrence, rechargement et autorisations, puis conserver les comportements déjà validés (semaine, ajout, impression, absence de faux rendez-vous).

### Décision à reconfirmer — Le lien GPT externe de l'offre Anglais

Le cadrage prévoit un lien externe vers GPT, sans intégration de chat. `app/nouveau/anglais/page.js` ne rend aucun lien GPT ; le lien existant est dans l'ancienne page `app/anglais/page.js:46-57`. Le choix de la surface et du maintien de ce lien doit être reconfirmé avant de le raccorder ; ce n'est pas une anomalie bloquante du prototype actuel.

Action : si le choix est confirmé, décider où le lien doit apparaître (fiche publique, bibliothèque ou espace membre), le relier explicitement à l'offre Anglais et vérifier qu'il reste externe, avec les protections de navigation appropriées.

### P2 — Onglet actif et navigation légale ne sont pas encore prêts pour une ouverture publique

`app/nouveau/bibliotheque/page.js:2` lit seulement à l'initialisation les paramètres `compte` et `tableau-de-bord`; il ne synchronise aucun changement d'onglet dans l'URL. Les quatre onglets restent un état client dans `app/nouveau/bibliotheque/Library.js:11,32-35` et sont perdus au rechargement, qui revient au paramètre initial ou à la bibliothèque. Le cadrage prévoit aussi « Contact et pages légales », mais `app/nouveau/_components/Shared.js:4-5` ne propose actuellement que les ancres programmes/à propos/cadeaux et le retour à l'accueil. Enfin, `app/nouveau/layout.js:2` force `noindex`, ce qui est adapté à la maquette mais devra être retiré au lancement si la zone publique doit être indexable.

Action : décider si les onglets doivent avoir des URLs partageables et, si oui, synchroniser les quatre états ; ajouter contact, confidentialité, CGV et autres pages légales réellement validées avant production. Retirer `noindex` uniquement au moment du lancement éditorial décidé.

### P0 — Gate d'architecture : le prototype conserve les briques historiques

Le dépôt contient encore l'adaptateur local et l'ancien modèle d'accès (`lib/store/index.js:1-19`, `lib/auth.js`), un webhook Lemon Squeezy (`app/api/webhooks/lemonsqueezy/route.js:4-10`), ainsi que des références Supabase/Lemon dans `.env.example` et `README.md:6-9,35-47`. La cible actuelle est Stripe + Clerk + Convex privé/membre + Sanity éditorial ; aucune intégration n'est comptée comme faite dans les spécifications.

Action : décider la frontière entre prototype historique et nouvelle version, implémenter les adaptateurs Stripe/Clerk/Convex/Sanity, le suivi commandes/factures/taxes/remboursements et l'administration Sanity, puis réécrire ou archiver les références Lemon et l'ancien modèle Free/Pro/Extra. Ne pas réutiliser l'ancien accès `extra/pro` pour la nouvelle logique d'entitlements.

## Éléments conformes ou volontairement en placeholder

- Landing et quatre fiches accessibles ; tarifs visibles conformes aux décisions : Review 28 € jusqu'au 31/12/2026 sans prix barré, Feedback 38 €, Projet 88 €, Contenu/visibilité 68 €, Anglais 48 € solo et 68 € duo. Le deuxième retour Review est annoncé comme offert ; son volume et ses modalités restent à préciser.
- Les limites et modalités principales visibles correspondent au cadrage : Feedback jusqu'à trois plans/quinze secondes cumulées, Projet questionnaire + trois séances de vingt minutes, Contenu questionnaire + entretien de quinze à vingt minutes + fiche, Anglais une heure.
- Les quatre onglets fixes sont présents : Tableau de bord, Ma bibliothèque, Mon suivi, Mon compte.
- Les réservations sont désactivées, les actions de compte sont désactivées et aucun achat n'est simulé comme réel ; c'est conforme à `docs/specs/mon-compte.md` et aux limites de maquette.
- Le profil « Léa », les ressources fictives, l'état local et l'absence de fichiers sont des placeholders connus. Ils deviennent des gates d'intégration dès qu'un contenu ou une donnée réelle est introduit.
- La faible lisibilité déjà connue du texte clair sur jaune/lavande n'est pas répétée comme nouvelle découverte.
- Les routes ciblées répondent HTTP 200 et le lint ciblé passe ; la recette mobile à 390 px de la landing et de la bibliothèque n'a pas relevé de débordement horizontal.

## Ordre de travail recommandé

### À finaliser avant les premiers branchements éditoriaux

1. Corriger les routes de CTA de la bibliothèque et retirer les messages de chantier périmés.
2. Aligner le catalogue gratuit landing/bibliothèque, choisir les cadeaux réels et représenter « Vie professionnelle » si cette décision est maintenue.
3. Synchroniser les engagements validés et geler les décisions commerciales encore ouvertes.
4. Décider le comportement d'URL des onglets, la navigation Contact/légal et le calendrier de retrait de `noindex`.

### À brancher progressivement

1. Sanity pour les offres, métadonnées de ressources, relations entre offres et aperçus publics ; les fichiers payants doivent rester dans un stockage protégé, référencé mais non exposé dans un dataset public.
2. Clerk + Convex pour le compte gratuit, les profils, les sessions, les droits, les tâches et Mon suivi.
3. Le stockage protégé, les questionnaires/uploads, la livraison PDF et le fournisseur de réservation/agenda.
4. Le lien GPT externe, seulement après reconfirmation de sa surface.

### Avant mise en production et paiement réel

1. Stripe pour paiement, taxes, factures, remboursements et confirmation serveur des droits ; paramétrer côté serveur l'expiration du tarif Review à la date prévue et désactiver ce tarif à échéance tant que le tarif suivant n'est pas validé.
2. Construire et tester les parcours Review/Feedback/Projet/Visibilité/Anglais, y compris annulation, duo, disponibilité et livrables.
3. Exécuter les tests de bout en bout : compte gratuit, achat par offre, droit/refus de ressource, téléchargement, renouvellement de session, isolation entre comptes, mobile, accessibilité, emails et cas d'échec de paiement.

## Connexions restant à réaliser

Stripe pour paiement, taxes, factures, remboursements et déclenchement des droits ; Clerk pour identité, sessions et profil ; Convex pour commandes côté serveur, suivi, tâches, questionnaires, références de fichiers privés et isolation membre ; Sanity pour offres, métadonnées de ressources et relations entre offres ; fournisseur de réservation/agenda et notifications pour les entretiens et séances ; stockage protégé et livraison PDF ; lien externe GPT pour Anglais si ce choix est reconfirmé ; consentements, politique de confidentialité, export/suppression des données et préférences cookies ; outillage admin pour contenu, élèves et ventes.

## Verdict

Acceptable comme maquette locale à montrer et à poursuivre. Non acceptable comme parcours de vente ou espace membre de production tant que le défaut de navigation n'est pas corrigé et que les gates d'identité, droits, contenu privé, paiement, livraison, suivi, réservation et persistance ne sont pas traités.
