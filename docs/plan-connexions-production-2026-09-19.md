# Plan des connexions de production — 19 septembre 2026

## But

Brancher la nouvelle expérience `/nouveau` sans reconstruire ses interfaces et sans réintroduire les anciennes offres Free/Pro/Extra ou Lemon Squeezy.

Ce document est la feuille de route opérationnelle des intégrations. Il applique le cadrage actuel : Next.js/Vercel, Sanity, Clerk, Convex et Stripe.

## État de départ

- Les pages publiques, questionnaires, réservation, récapitulatif de paiement, confirmation, bibliothèque, suivi, demandes et studio de review existent côté interface.
- Les brouillons, disponibilités et réservations de démonstration reposent encore sur `localStorage` ou sur des fixtures locales.
- Aucun compte, paiement, droit d'accès, fichier privé ou envoi transactionnel de production n'est encore branché.
- Les pages légales existent. Le choix d'un médiateur reste une formalité à arbitrer avant l'ouverture réelle des paiements B2C ; aucune fausse coordonnée ne doit être publiée.

## Sources de vérité retenues

| Domaine | Source de vérité |
|---|---|
| Pages, offres, textes, FAQ, aperçus de ressources | Sanity |
| Identité, connexion, session, e-mail vérifié | Clerk |
| Profils métier, demandes, questionnaires, tâches, réservations, droits et historique | Convex |
| Prix facturé, paiement, facture, remboursement | Stripe |
| Fichiers de travail et livrables privés | Stockage privé relié à Convex |
| Site, routes serveur, webhooks, rendu | Next.js sur Vercel |

## Ordre obligatoire

### 0. Harmoniser les specs et le registre des variables

- Remplacer les références actives à Lemon Squeezy par Stripe.
- Retirer les anciens paliers et anciens produits des spécifications opérationnelles.
- Décrire les environnements local, preview et production.
- Créer le registre des variables d'environnement sans secrets.

**Preuve de fin :** un développeur ne peut plus hésiter entre deux fournisseurs ou deux modèles commerciaux.

### 1. Installer la fondation Clerk + Convex

- Ajouter les dépendances officielles compatibles avec la version actuelle de Next.js.
- Créer les providers et la configuration d'environnement.
- Implémenter inscription, connexion, déconnexion et e-mail vérifié.
- Synchroniser un profil minimal dans Convex.
- Protéger `/nouveau/bibliotheque`, `/nouveau/demandes` et `/nouveau/studio`.
- Supprimer les identités fictives et les profils activables par paramètre d'URL.

**Preuve de fin :** deux comptes de test distincts existent et aucun ne peut lire le profil de l'autre.

### 2. Modéliser les données métier Convex

- Utilisateurs et rôles administratifs.
- Offres internes stables et droits d'accès.
- Questionnaires et pièces jointes.
- Demandes, étapes, livrables et historique.
- Disponibilités, créneaux, réservations et rendez-vous.
- Tâches du semainier et récurrence.
- Commandes miroir, événements Stripe et journal d'audit.

**Preuve de fin :** les interfaces actuelles lisent et écrivent des données persistantes isolées par compte, sans `localStorage` comme source de vérité.

### 3. Brancher Sanity sur l'éditorial public

- Schémas des pages, offres, ressources, FAQ et documents légaux.
- Identifiants internes stables pour relier Sanity à Convex et Stripe.
- Aperçu des brouillons et revalidation après publication.
- Migration des textes actuels vers Sanity sans changer le design validé.

**Preuve de fin :** une offre peut être modifiée et publiée depuis Sanity sans déploiement du site.

### 4. Brancher les formulaires et le stockage privé

- Sauvegarde automatique serveur des questionnaires après connexion.
- Téléversements privés avec types, tailles et quotas validés.
- Liens Drive/YouTube/Vimeo conservés comme références externes.
- Reprise d'un brouillon sur un autre appareil.
- Accès propriétaire et administratrice uniquement.

**Preuve de fin :** un questionnaire et ses fichiers survivent au changement d'appareil et restent invisibles depuis un autre compte.

### 5. Brancher la réservation

- Remplacer les adaptateurs locaux par Convex en conservant leur contrat d'interface.
- Écran privé d'administration des disponibilités, absences et exceptions.
- Réservation atomique empêchant deux personnes de prendre le même créneau.
- Fuseau horaire, report et annulation selon les règles de chaque offre.
- Google Meet reste provisoirement manuel tant que son automatisation n'est pas confirmée.

**Preuve de fin :** une disponibilité créée dans l'administration peut être réservée une seule fois et apparaît dans le suivi des deux côtés.

### 6. Brancher Stripe en mode test

- Créer les produits/prix Stripe correspondant aux offres validées.
- Créer la Checkout Session uniquement côté serveur à partir d'une liste autorisée.
- Enregistrer la demande expresse de commencement anticipé lorsqu'elle est nécessaire.
- Vérifier les webhooks signés et les rendre idempotents.
- Créer la commande Convex et accorder le bon droit après confirmation serveur uniquement.
- Gérer paiement échoué, annulation et remboursement.

**Preuve de fin :** chaque offre est achetée une fois en test ; facture, commande, droit et remboursement sont cohérents, y compris avec un webhook rejoué.

### 7. Brancher les livraisons et notifications

- E-mails transactionnels de confirmation, réservation, rappel et livraison.
- Dépôt d'un PDF ou d'une review annotée par l'administratrice.
- Notification et téléchargement privé côté cliente.
- Durées de conservation et suppression prévues dans la politique actuelle.

**Preuve de fin :** une demande complète traverse tous ses états, du paiement à la livraison, sans échange de fichier public.

### 8. Construire l'administration métier

- Vue élèves et demandes.
- Vue calendrier et disponibilités.
- Vue ventes avec liens Stripe pour les opérations sensibles.
- Accès à Sanity Studio pour l'éditorial.
- Rôle administrateur vérifié côté serveur et actions auditées.

**Preuve de fin :** le fonctionnement quotidien ne demande ni modification du code ni ouverture directe de Convex.

### 9. Recette et production

- Tests complets pour chaque offre, en solo et duo lorsque pertinent.
- Isolation entre comptes, mobile, clavier, accessibilité, erreurs et états vides.
- Export/suppression de compte, cookies et politiques de conservation.
- Variables Vercel séparées entre preview et production.
- Retrait de `noindex` uniquement pour les pages publiques au lancement.
- Arbitrage du médiateur et ajout éventuel de ses coordonnées avant le premier paiement B2C réel.

**Preuve de fin :** un achat réel contrôlé fonctionne de bout en bout et les pages privées restent non indexables et non accessibles sans droit.

## Première tranche à exécuter

### Workflow d'exécution

Astra Orchestrator demandé explicitement : exécution en tâche Luna Max, objectif exact et revue Astra persistante, puis acceptation ici. Apex absent des chemins `/Users/kaolla/.codex/skills/apex` et `/Users/kaolla/.agents/skills/apex` ; workflow Markdown Analyze → Plan → Execute → eXamine retenu.

Première livraison locale : préparer le socle Clerk/Convex et sa configuration documentée, vérifier les protections et préserver le fonctionnement public sans secrets. La connexion réelle et le test de deux comptes nécessitent les projets de développement des fournisseurs ; ces vérifications ne seront pas déclarées réussies sans accès réel.

Tâche d'origine : `01a05cb8-2f96-7333-b548-a7534450cf3c`. Exécution : `01a0b9f6-8fa3-7bb1-872f-27892456da47`. Runtime vérifié dans le `turn_context` du journal local le 19 septembre : modèle `gpt-5.6-luna`, effort `max`, dossier AM-PLATEFORM.

La première tranche est **Clerk + Convex, compte gratuit**. Elle débloque ensuite la sauvegarde automatique, les questionnaires, la réservation, le suivi, les fichiers privés et Stripe. Sanity peut avancer en parallèle, mais ne doit pas retarder cette fondation métier.

Avant l'installation, il faut disposer de projets de développement Clerk et Convex, ainsi que de leurs variables non productives. Aucune clé de production ne doit être utilisée localement.

## Checkpoint local — socle Clerk + Convex

- [x] SDK officiels ajoutés : `@clerk/nextjs` 7.9.4 et `convex` 1.46.0.
- [x] Provider Clerk/Convex conditionnel et `proxy.js` compatible Next 16 ajoutés ; sans configuration, le public reste rendu sans session fictive.
- [x] Profil Convex privé (`users`) et fonctions `getCurrentProfile`, `ensureCurrentProfile`, `updateCurrentProfile` ajoutés. Le rôle n’est ni dérivé d’un e-mail ni accepté dans les arguments client ; une création démarre toujours `member`.
- [x] `/nouveau/bibliotheque` est membre ; `/nouveau/demandes` et `/nouveau/studio` sont administrateur avec vérification du rôle côté Convex via token Clerk `convex`.
- [x] Exemple d’environnement sans valeurs et documentation des identifiants manquants : [socle Clerk + Convex](clerk-convex-local.md).
- [x] Vérifications locales : policy/refus et absence de rôle client, lint ciblé, syntaxe Convex, build Next sans clés et contrôle HTTP local sans configuration.
- [ ] Codegen/déploiement Convex, connexion Clerk, vérification e-mail et isolation de deux comptes : indisponibles tant que les identifiants de développement ne sont pas fournis ; ils ne sont pas déclarés réussis.
