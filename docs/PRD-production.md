# PRD — Animation Made, plateforme commerciale de production

> Version historique partiellement remplacée par le [cadrage de la nouvelle version](specs/00-cadrage-nouvelle-version.md). Les références à Lemon Squeezy, à la conservation obligatoire du prototype et aux anciens paliers doivent être révisées avant implémentation. Stripe est désormais le fournisseur retenu.

- Version : 1.0
- Date : 2 septembre 2026
- Statut : prêt pour chiffrage et découpage technique
- Produit : Animation Made
- Cible de lancement : production commerciale
- Stack : Next.js, Vercel, Sanity, Convex, Clerk, Lemon Squeezy
- Suivi d'exécution : [sommaire des spécifications](specs/00-SOMMAIRE.md)

## 1. Résumé exécutif

Animation Made doit devenir un site unique où une personne peut comprendre l'offre, consulter des articles et ressources, créer un compte, acheter un produit numérique ou un service, retrouver ses achats et accéder à des contenus réservés.

La plateforme doit permettre à la fondatrice de gérer les contenus et les produits sans modifier le code. L'IA peut l'assister grâce aux CLI et MCP officiels, mais les paiements, droits d'accès et données clients restent protégés par des règles serveur, des webhooks signés et des validations automatiques.

Le lancement initial couvre :

- un site vitrine éditable ;
- des articles et ressources publics ou réservés ;
- des add-ons gratuits et payants ;
- des cours collectifs en visioconférence et des reviews de books ;
- des comptes clients ;
- des achats ponctuels et abonnements ;
- un espace client avec bibliothèque et statut d'abonnement ;
- une fondation compatible avec de futures formations vidéo.

## 2. Problème à résoudre

Les solutions tout-en-un sont simples mais coûteuses ou rigides. Une solution entièrement codée peut être moins chère et plus personnalisable, mais devient risquée si son administration, sa sécurité et ses procédures de production dépendent d'un développeur unique.

Le produit doit donc réunir :

- une expérience d'achat fluide ;
- une administration accessible sans coder ;
- une architecture dont chaque service a une responsabilité claire ;
- une automatisation par IA sans accès incontrôlé aux données sensibles ;
- une exploitation documentée, testable et transférable à un autre développeur.

## 3. Vision produit

Une personne arrive sur Animation Made, comprend immédiatement la proposition de valeur, découvre des ressources adaptées à son niveau, achète si elle le souhaite et retrouve tout dans un espace personnel cohérent. La plateforme évolue ensuite vers un hub de formation et de ressources pour les artistes de l'animation.

### Principes

1. Un seul domaine et une seule navigation visibles pour le client.
2. Une seule identité client, gérée par Clerk.
3. Un seul système de référence pour chaque type de donnée.
4. Aucun fichier payant accessible par une URL publique permanente.
5. Toute décision d'accès est vérifiée côté serveur.
6. Les contenus courants sont administrables dans Sanity ou par son MCP.
7. L'IA propose et exécute les tâches réversibles ; l'humain confirme les opérations sensibles.

## 4. Objectifs et indicateurs

### Objectifs de lancement

- Publier le site commercial sur le domaine principal.
- Permettre un achat de bout en bout sans intervention manuelle.
- Donner immédiatement accès au bon produit après confirmation du paiement.
- Permettre à la fondatrice de publier une page, un article ou une fiche produit sans déploiement de code.
- Permettre au support de diagnostiquer une commande et de restaurer un droit sans accéder aux données bancaires.

### Indicateurs à suivre

| Indicateur | Cible initiale |
|---|---|
| Disponibilité mensuelle du parcours d'achat | ≥ 99,5 % |
| Webhooks traités avec succès | ≥ 99,9 %, reprises comprises |
| Délai paiement → accès | moins de 60 secondes dans 95 % des cas |
| Taux d'erreur du checkout imputable au site | < 1 % |
| Pages publiques conformes Core Web Vitals | 75 % ou plus des visites « bonnes » |
| Actions critiques couvertes par tests E2E | 100 % |
| Publication d'un article sans développeur | moins de 15 minutes |

## 5. Hors périmètre du premier lancement

- Marketplace multi-vendeurs.
- Application mobile native.
- Hébergement et streaming vidéo maison.
- Paiement fractionné personnalisé ou portefeuille interne.
- Gestion comptable complète.
- Réseau social ou messagerie temps réel entre membres.
- Modification autonome des prix Lemon Squeezy par une IA en production.

## 6. Utilisateurs et rôles

### Visiteur

Consulte les pages, articles, offres et ressources publiques. Peut commencer un achat ou créer un compte.

### Membre gratuit

Accède aux ressources gratuites réservées, à sa bibliothèque et à son profil.

### Client ponctuel

Accède aux add-ons, formations ou services achetés tant que la licence le permet.

### Abonné Pro

Accède aux contenus inclus dans son abonnement pendant sa période active ou de grâce.

### Cliente Extra / Review

Peut déposer les informations et fichiers nécessaires à une review, suivre son statut et consulter le livrable.

### Éditrice

Crée et publie les pages, articles, fiches produits, ressources et contenus pédagogiques dans Sanity.

### Support

Consulte les commandes, abonnements, événements et droits ; peut déclencher une resynchronisation auditée.

### Administratrice technique

Gère les déploiements, secrets, schémas, migrations, incidents et connexions MCP.

## 7. Périmètre fonctionnel

### 7.1 Site public

Le site comprend au minimum :

- accueil ;
- à propos ;
- catalogue/boutique ;
- fiche produit ;
- offres de cours collectifs ;
- offre de review de book ;
- articles et ressources ;
- page d'abonnement ;
- FAQ ;
- contact ;
- mentions légales, CGV, politique de confidentialité et politique de remboursement.

Chaque page éditoriale gère un titre, un slug, des blocs de contenu, des médias, un statut, une date de publication, les métadonnées SEO et un aperçu social.

### 7.2 Catalogue

Types de produits requis :

- add-on gratuit ;
- add-on à achat unique ;
- cours collectif à date définie ;
- séance ou review à achat unique ;
- formation numérique à achat unique ;
- abonnement mensuel ou annuel ;
- ressource incluse dans un palier d'abonnement.

Une fiche produit contient dans Sanity la présentation commerciale. Lemon Squeezy reste la référence du prix facturé, de la devise, de la variante vendue et de la fiscalité.

### 7.3 Compte et authentification

- Inscription et connexion par Clerk.
- Vérification d'adresse e-mail.
- Réinitialisation et sécurité des sessions gérées par Clerk.
- Profil client minimal : nom public, langue, fuseau horaire et consentements.
- Rattachement fiable entre `clerkUserId`, client Lemon Squeezy et enregistrement Convex.
- Possibilité d'acheter avant ou après création du compte, avec réconciliation contrôlée par adresse e-mail vérifiée et identifiant transmis au checkout.

### 7.4 Espace client

L'espace client affiche :

- les achats et leur statut ;
- la bibliothèque de fichiers et contenus accessibles ;
- les abonnements, renouvellements et annulations ;
- un lien vers le portail de facturation Lemon Squeezy ;
- les inscriptions aux cours et informations pratiques ;
- les demandes de review et leurs statuts ;
- la progression des formations ;
- les paramètres du compte.

L'interface ne considère jamais un simple affichage comme preuve d'autorisation : chaque téléchargement et chaque contenu privé est vérifié côté serveur.

### 7.5 Add-ons et téléchargements

- Un add-on gratuit peut exiger un compte ou être public selon sa configuration.
- Un add-on payant est accessible uniquement après confirmation serveur de la commande.
- Les fichiers actuellement placés dans `/public/addons` doivent être migrés avant lancement.
- Une URL de téléchargement est courte, signée, révocable et liée à un droit valide.
- Chaque téléchargement est journalisé sans stocker plus de données personnelles que nécessaire.
- Une limite raisonnable et un contrôle anti-abus sont appliqués.
- Une nouvelle version du fichier peut être publiée sans casser l'historique des commandes.

Décision de lancement : fichiers privés dans un stockage contrôlé par Convex si les volumes restent dans le budget. Lemon Squeezy peut servir de solution de livraison de secours. Les deux systèmes ne doivent jamais être simultanément considérés comme source de vérité du même fichier.

### 7.6 Abonnements et contenus réservés

- Les paliers initiaux sont Free et Pro ; Extra correspond à un service ou achat additionnel sauf décision commerciale contraire.
- Un contenu Sanity indique sa règle d'accès : public, membre, Pro, achat d'un produit donné ou accès manuel.
- Convex calcule les droits effectifs à partir des abonnements et commandes confirmés.
- L'annulation conserve l'accès jusqu'à la fin de la période payée.
- Les paiements échoués suivent une période de grâce configurable.
- Un remboursement ou chargeback retire le droit concerné selon la politique commerciale.

### 7.7 Cours collectifs

- Une session possède une date, un fuseau horaire, une capacité, un prix, un intervenant et des instructions.
- L'achat crée une inscription après webhook confirmé.
- Le lien de visioconférence n'est visible que par les personnes inscrites et à une période définie autour du cours.
- Les e-mails de confirmation et de rappel sont transactionnels et testés.
- La gestion avancée des disponibilités peut être confiée ultérieurement à un outil de réservation ; le MVP gère des sessions prédéfinies.

### 7.8 Reviews de books

- L'achat ouvre une demande de review.
- La cliente remplit un brief et dépose ses fichiers ou liens.
- La demande suit les états : à compléter, reçue, en analyse, livrée, révision demandée, clôturée.
- Les fichiers privés ont une durée de conservation documentée.
- Le livrable est accessible uniquement à la cliente et à l'équipe autorisée.

### 7.9 Formations vidéo

- Sanity décrit cours, modules, leçons et supports.
- Convex stocke inscriptions et progression.
- Les vidéos ne sont pas stockées dans Sanity ni servies comme fichiers publics.
- Avant l'ouverture des formations vidéo, un fournisseur de streaming privé avec URLs signées doit être sélectionné. Convex ne doit pas être utilisé comme CDN vidéo sans validation de coût et de performance.

### 7.10 Articles et ressources

- Articles publics indexables.
- Ressources gratuites accessibles après connexion si configuré.
- Articles ou leçons réservés aux abonnés.
- Brouillon, aperçu, programmation et archivage.
- Catégories, auteurs, recherche simple et contenus associés.

### 7.11 Administration assistée par IA

L'administratrice peut demander à l'IA de :

- créer un brouillon d'article ou de fiche produit ;
- modifier une page Sanity ;
- préparer un schéma ou une migration ;
- analyser les journaux d'un déploiement ;
- lancer les tests et préparer une prévisualisation ;
- diagnostiquer un événement webhook dans un environnement autorisé.

Une confirmation humaine est obligatoire pour publier en production, modifier un prix, rembourser, accorder ou retirer un droit, supprimer une donnée client, changer un secret ou promouvoir un déploiement.

## 8. Architecture cible

```text
Navigateur
   │
   ▼
Next.js sur Vercel ─────► Sanity (contenu public et structure éditoriale)
   │
   ├───────────────► Clerk (identité et session)
   │
   ├───────────────► Convex (données métier, droits, progression, fichiers privés)
   │
   └───────────────► Lemon Squeezy Checkout
                            │
                            ▼ webhook signé
                    Route serveur Vercel
                            │
                            ▼
                    Convex (événement idempotent → commande → droit)
```

### Sources de vérité

| Domaine | Source de vérité | Copie éventuelle |
|---|---|---|
| Identité et session | Clerk | Profil métier minimal dans Convex |
| Contenu et présentation produit | Sanity | Cache Next.js |
| Prix, paiement, facture, abonnement | Lemon Squeezy | Miroir normalisé dans Convex |
| Droits d'accès | Convex | Aucun état d'autorisation dans le navigateur |
| Progression et inscriptions | Convex | Aucun |
| Fichiers privés | Stockage sélectionné dans Convex | Sauvegarde/export contrôlé |
| Déploiement | Vercel | GitHub pour le code |

### Règles d'intégration

- Sanity ne contient aucune donnée personnelle client ni aucun secret.
- Clerk ne décide pas qu'un utilisateur a payé ; les métadonnées de session ne sont pas la source de vérité des achats.
- Lemon Squeezy ne pilote pas directement l'interface : ses événements sont validés et normalisés.
- Convex n'enregistre aucune donnée de carte bancaire.
- Le navigateur ne reçoit jamais de clé secrète ni d'URL privée durable.

## 9. Modèle de données

### 9.1 Documents Sanity

- `siteSettings`
- `navigation`
- `page`
- `post`
- `author`
- `category`
- `productPresentation`
- `coursePresentation`
- `module`
- `lesson`
- `resourcePresentation`
- `faq`
- `legalDocument`

Les documents vendables contiennent un identifiant métier stable et les identifiants de variantes Lemon Squeezy nécessaires, mais pas le prix comme valeur contractuelle.

### 9.2 Tables Convex

- `users` : lien Clerk et profil métier.
- `billingCustomers` : correspondance Clerk/Lemon.
- `orders` et `orderItems` : miroir des commandes.
- `subscriptions` : état normalisé et dates.
- `entitlements` : sujet, ressource, origine, dates et statut.
- `webhookEvents` : identifiant fournisseur, type, empreinte, état, tentatives et erreur.
- `digitalAssets` : fichier, version, visibilité et règle d'accès.
- `downloadEvents` : audit et lutte anti-abus.
- `courseEnrollments` et `lessonProgress`.
- `liveSessions` et `sessionRegistrations`.
- `reviewRequests` et `reviewFiles`.
- `manualGrants` : droits exceptionnels avec auteur, motif et expiration.
- `auditEvents` : actions administratives sensibles.

### Contraintes

- Unicité des identifiants d'événements Lemon Squeezy.
- Index sur `clerkUserId`, `lemonCustomerId`, `orderId`, `subscriptionId` et `resourceKey`.
- Historique des transitions importantes, pas seulement le dernier état.
- Suppression ou anonymisation conforme à la politique de conservation.

## 10. Paiement et cycle de vie des droits

### Achat

1. Le serveur crée ou configure le checkout Lemon Squeezy avec l'identifiant interne du produit et, si disponible, le `clerkUserId` dans les données personnalisées.
2. Lemon Squeezy collecte le paiement et gère la taxe en tant que Merchant of Record.
3. Le webhook est reçu sur une route serveur dédiée.
4. La signature est vérifiée sur le corps brut avant toute désérialisation métier.
5. L'identifiant d'événement est enregistré ; un doublon devient une réussite sans double effet.
6. La commande et le client sont réconciliés dans Convex.
7. Le droit correspondant est créé ou mis à jour.
8. L'espace client se rafraîchit et affiche l'accès.

### Événements minimums

- commande créée ;
- commande remboursée ;
- abonnement créé, mis à jour, annulé et expiré ;
- paiement d'abonnement réussi, échoué et récupéré ;
- événements de chargeback disponibles et pertinents.

### Résilience

- Réponse HTTP rapide après validation et enregistrement de l'événement.
- Traitement métier relançable.
- Backoff sur les erreurs temporaires.
- Vue support des événements en erreur.
- Commande de resynchronisation depuis l'API Lemon Squeezy.
- Alerte si un événement reste en échec au-delà du seuil défini.

## 11. Sécurité et conformité

### Contrôles obligatoires

- HTTPS partout en production.
- Secrets uniquement dans les variables chiffrées des plateformes.
- Séparation stricte développement, prévisualisation et production.
- Autorisation dans chaque fonction Convex sensible.
- Validation des entrées et limites de taille/type pour les fichiers.
- Signature HMAC des webhooks et comparaison résistante au timing.
- Idempotence et protection contre le rejeu.
- En-têtes de sécurité, politique CSP et limitation des routes sensibles.
- Journaux sans secrets, tokens, corps de fichiers ou données bancaires.
- Dépendances auditées et mises à jour planifiées.
- Sauvegarde et procédure de restauration testée.

### MCP

- Utiliser exclusivement les endpoints ou packages officiels.
- Connexion OAuth nominative lorsque disponible.
- Scoper Vercel MCP au projet et Convex au déploiement visé.
- Accès production en lecture seule par défaut.
- Aucune clé de production dans un prompt, fichier versionné ou journal.
- Confirmation humaine avant une mutation de production.
- Relecture du diff et passage de la CI avant déploiement.
- Révocation immédiate d'une connexion MCP non utilisée ou suspecte.

### Données personnelles

- Inventaire des données, finalités et durées de conservation.
- Consentement marketing séparé du compte nécessaire au service.
- Export, rectification et suppression/anonymisation sur demande.
- Contrats et DPA vérifiés avec chaque fournisseur.
- Bandeau cookies uniquement pour les traceurs non essentiels réellement utilisés.

## 12. Environnements et configuration

| Environnement | Vercel | Sanity | Convex | Clerk | Lemon Squeezy |
|---|---|---|---|---|---|
| Local | serveur local | dataset dev | déploiement dev | instance dev | mode test |
| Preview PR | URL éphémère | dataset dev | déploiement dev/preview contrôlé | instance dev | mode test |
| Staging | domaine privé | dataset staging ou dev dédié | staging | instance dev dédiée | mode test |
| Production | domaine public | dataset production | production | instance production | mode live |

Les variables sont documentées par nom dans `.env.example`, sans valeur secrète. Les clés serveur ne portent jamais le préfixe d'exposition client.

Variables attendues, à confirmer pendant l'implémentation :

- URLs et identifiants de projet Sanity ;
- URL de déploiement Convex ;
- clés publique et secrète Clerk ;
- identifiants de boutique/variantes, clé API et secret webhook Lemon Squeezy ;
- URL publique canonique ;
- secrets de prévisualisation et de revalidation.

## 13. Administration, CLI et MCP

### Sanity

- Studio intégré ou hébergé pour l'administration humaine.
- CLI pour schémas, datasets et déploiements.
- MCP officiel pour manipuler documents, schémas, assets et releases.
- Brouillon obligatoire avant publication assistée par IA.

### Convex

- CLI pour développement, déploiement et inspection.
- MCP officiel lancé localement et attaché explicitement au bon déploiement.
- Les mutations de production sont limitées à des outils administratifs conçus et audités, jamais à une mutation générique exposée sans garde-fou.

### Vercel

- CLI pour lier, prévisualiser, déployer et consulter les journaux.
- MCP officiel avec OAuth et URL contextualisée au projet.
- Promotion production après CI et approbation.

### Clerk

- CLI pour initialisation, diagnostic et déploiement.
- MCP officiel principalement documentaire : snippets et patterns à jour.
- Les opérations sur les utilisateurs passent par le dashboard, la CLI ou l'API avec un rôle approprié et un audit.

### Lemon Squeezy

- Intégration via API, SDK, checkout hébergé et webhooks.
- Aucun MCP tiers ne reçoit de clé de production.
- Création des produits/prix dans le dashboard ou par une procédure API explicitement approuvée.

## 14. Expérience éditoriale

- Aperçu fidèle du site avant publication.
- Validation des slugs et détection des liens cassés.
- Composants éditoriaux limités à une bibliothèque cohérente.
- Champs SEO obligatoires avec valeurs par défaut.
- Historique et possibilité de revenir à une version précédente.
- La suppression d'une fiche produit vendue l'archive au lieu de casser les droits existants.
- Une publication Sanity déclenche une revalidation ciblée du cache Next.js.

## 15. Exigences non fonctionnelles

### Performance

- Pages publiques statiques ou mises en cache lorsque possible.
- Images optimisées et dimensions réservées.
- JavaScript client limité sur les pages marketing.
- Téléchargements servis hors du runtime Next.js lorsque le stockage le permet.

### Accessibilité

- Cible WCAG 2.2 niveau AA sur les parcours principaux.
- Navigation clavier, focus visible, contrastes, labels et messages d'erreur explicites.
- Sous-titres ou transcription pour les contenus pédagogiques vidéo publiés.

### SEO

- Métadonnées, canonicals, sitemap et robots configurables.
- Données structurées pertinentes pour articles, produits et organisation.
- Redirections conservées lors de tout changement de slug.
- Pages privées exclues de l'indexation et protégées au serveur.

### Compatibilité

- Versions récentes de Chrome, Safari, Firefox et Edge.
- Parcours critique fonctionnel sur mobile à partir de 320 px.

## 16. Qualité et tests

### Tests automatiques

- Unitaires : règles d'accès, états d'abonnement, mapping produit et validation.
- Intégration : Clerk ↔ Convex, requêtes Sanity, webhooks Lemon Squeezy.
- Contrat : exemples réels anonymisés de chaque type de webhook.
- E2E : inscription, achat test, accès, téléchargement, annulation et remboursement.
- Sécurité : utilisateur A incapable d'accéder aux ressources de B.
- Régression visuelle des pages commerciales principales.
- Accessibilité automatisée complétée par une vérification manuelle.

### Scénarios obligatoires avant lancement

1. Achat ponctuel réussi.
2. Webhook dupliqué sans double droit.
3. Webhook dans le désordre.
4. Paiement échoué puis récupéré.
5. Annulation avec accès jusqu'à échéance.
6. Remboursement et retrait correct du droit.
7. Achat avec e-mail existant mais utilisateur déconnecté.
8. Téléchargement refusé sans droit ou après expiration.
9. Publication et dépublication Sanity.
10. Déploiement rollbacké sans perte de données.

## 17. CI/CD et exploitation

### Pipeline de pull request

1. Installation verrouillée des dépendances.
2. Lint et vérification des types.
3. Tests unitaires et intégration.
4. Build Next.js de production.
5. Déploiement Preview Vercel.
6. Tests E2E sur la Preview.
7. Revue humaine et fusion protégée vers `main`.

### Déploiement production

- Migration de schéma compatible vers l'avant.
- Déploiement des fonctions Convex avant le frontend qui les consomme.
- Vérification des webhooks et secrets live.
- Smoke test après promotion.
- Rollback Vercel immédiat si le frontend est fautif.
- Procédure spécifique si une migration de données doit être annulée.

### Observabilité

- Logs corrélés par request ID et webhook event ID.
- Tableau de bord : erreurs, latence, webhooks échoués, téléchargements anormaux et quota des fournisseurs.
- Alerte sur échec du checkout, hausse des erreurs serveur et saturation de quota.
- Outil d'erreur applicative type Sentry recommandé avant lancement, sous réserve du budget et du consentement nécessaire.

## 18. Coûts de lancement

Estimation des coûts fixes minimums selon les tarifs officiels consultés le 2 septembre 2026 :

| Service | Offre de départ | Coût fixe indicatif | Limite/décision |
|---|---|---:|---|
| Vercel | Pro | 20 USD/mois | Hobby n'est pas autorisé pour ce site commercial |
| Sanity | Free | 0 USD | dataset public : contenu éditorial uniquement |
| Convex | Free/Starter | 0 USD au départ | surveiller stockage, bande passante et appels |
| Clerk | Hobby | 0 USD | branding et sessions selon les limites de l'offre |
| Lemon Squeezy | sans abonnement | 0 USD fixe | 5 % + 0,50 USD par transaction, suppléments possibles |

Budget fixe de départ : environ 20 USD/mois, hors domaine, e-mail transactionnel, éventuel streaming vidéo, dépassements et commissions par transaction.

Seuils de réévaluation :

- stockage privé Convex proche de 70 % du quota ;
- bande passante fichiers proche de 70 % ;
- besoin de sauvegardes quotidiennes automatiques ;
- besoin de dataset Sanity privé ;
- volume de ventes pour lequel les frais Lemon Squeezy dépassent le bénéfice opérationnel du Merchant of Record ;
- lancement d'une vidéothèque nécessitant un CDN spécialisé.

## 19. Plan de réalisation

### Phase 0 — Cadrage et fondations

- Valider cette PRD et l'ADR boilerplate.
- Inventorier les fonctionnalités déjà présentes et décider ce qui est conservé.
- Créer les projets dev et production chez chaque fournisseur.
- Documenter les propriétaires de comptes, accès et moyens de récupération.
- Installer la CI, les environnements et `.env.example`.

### Phase 1 — CMS et site public

- Installer Sanity et les schémas.
- Migrer les pages, articles, FAQ et présentations produits.
- Mettre en place aperçu, revalidation, SEO et Studio.
- Conserver l'apparence existante pendant la migration.

### Phase 2 — Identité et données métier

- Intégrer Clerk.
- Installer Convex et son schéma.
- Migrer les données locales nécessaires.
- Créer l'espace client et les règles d'autorisation.

### Phase 3 — Vente et livraison

- Configurer Lemon Squeezy test puis live.
- Implémenter checkout, webhooks idempotents et portail client.
- Migrer les add-ons hors de `/public`.
- Tester achats, remboursements, abonnements et téléchargements.

### Phase 4 — Services et contenus réservés

- Cours collectifs et inscriptions.
- Workflow de review de book.
- Articles réservés et abonnement Pro.
- E-mails transactionnels et support.

### Phase 5 — Production

- Audit sécurité et accessibilité.
- Tests de charge ciblés et restauration de sauvegarde.
- CGV, confidentialité, remboursements et consentements validés.
- Passage live, smoke tests, surveillance renforcée 72 heures.

### Phase 6 — Formation vidéo

- Choisir le fournisseur de streaming privé.
- Ajouter lecteur sécurisé, progression et règles d'accès.
- Tester coûts, sous-titres, mobile et partage abusif.

## 20. Critères d'acceptation de la mise en production

La version est livrable lorsque :

- toutes les pages indispensables sont éditables sans code ;
- l'inscription, la connexion et la récupération de compte fonctionnent ;
- un achat test puis live contrôlé crée exactement le bon droit ;
- un remboursement, une annulation et un paiement échoué produisent l'état attendu ;
- aucun fichier payant n'est présent sous une URL publique ;
- les autorisations sont testées côté serveur ;
- les webhooks sont signés, idempotents, observables et relançables ;
- les environnements et secrets sont séparés ;
- la CI bloque un build ou des tests défaillants ;
- le rollback et la restauration sont documentés et testés ;
- les pages légales sont publiées ;
- les responsables savent diagnostiquer une commande sans dépendre du développeur initial ;
- les MCP de production sont officiels, limités et révocables.

## 21. Risques et réponses

| Risque | Impact | Réponse |
|---|---|---|
| Complexité de cinq services | Maintenance difficile | Responsabilités strictes, documentation, tests d'intégration et runbooks |
| Webhook perdu ou désordonné | Accès absent ou incorrect | Idempotence, historique, reprise et resynchronisation API |
| IA avec trop de droits | Modification dangereuse | Moindre privilège, lecture seule, confirmation humaine et audit |
| Fichier payant exposé | Piratage et perte de confiance | Stockage privé, URLs signées, contrôle serveur et anti-abus |
| Dataset Sanity public | Fuite de données | Contenu public uniquement ; PII dans Convex/Clerk |
| Dépendance au développeur | Blocage opérationnel | Studio Sanity, runbooks, comptes détenus par l'entreprise, CI et transfert |
| Coût stockage/vidéo | Dépassement rapide | Quotas, alertes, politique de rétention et fournisseur vidéo dédié |
| Synchronisation catalogue/prix | Prix incohérent | Lemon source contractuelle, validation automatisée des identifiants |
| Frais Lemon sur petits produits | Marge réduite | Packs, prix minimum, comparaison périodique avec autre MoR/Stripe |

## 22. Décisions encore nécessaires

Ces choix ne bloquent pas la fondation, mais doivent être tranchés avant la fonctionnalité concernée :

- politique précise de remboursement et de révocation des fichiers ;
- seuil de prix minimum des add-ons compte tenu des frais fixes par transaction ;
- outil d'e-mail transactionnel ;
- fournisseur de visioconférence et mode de génération des liens ;
- durée de conservation des fichiers de review ;
- fournisseur de streaming vidéo ;
- besoin d'un palier annuel Pro ;
- domaines exacts pour le site, Sanity Studio et éventuel portail client.

## 23. Checklist de lancement

- [ ] Propriétaire et double authentification configurés sur chaque compte fournisseur.
- [ ] Domaine, DNS et HTTPS validés.
- [ ] Vercel Pro actif pour l'usage commercial.
- [ ] Secrets live créés, séparés et documentés sans leurs valeurs.
- [ ] Dataset Sanity audité : aucune donnée privée.
- [ ] Schéma Convex et index déployés.
- [ ] Clerk production configuré avec URLs et e-mails corrects.
- [ ] Lemon Squeezy live approuvé, produits et variantes vérifiés.
- [ ] Signature et reprise des webhooks testées.
- [ ] Fichiers payants retirés du dossier public.
- [ ] Achat réel à faible montant testé puis remboursé.
- [ ] E-mails transactionnels et liens de support testés.
- [ ] CGV, confidentialité et remboursements publiés.
- [ ] Analytics et consentements vérifiés.
- [ ] Alertes, sauvegardes et restauration testées.
- [ ] Runbooks support et incident disponibles.
- [ ] MCP de production limités, audités et révocables.
- [ ] Plan de rollback validé.

## 24. Références techniques

### Boilerplates et SDK officiels

- [Convex Next.js + Clerk starter](https://github.com/get-convex/template-nextjs-clerk)
- [Convex templates](https://github.com/get-convex/templates)
- [next-sanity](https://github.com/sanity-io/next-sanity)
- [Lemon Squeezy Next.js billing starter](https://github.com/lmsqueezy/nextjs-billing)

### MCP et CLI officiels

- [Sanity MCP](https://www.sanity.io/docs/ai/mcp-server)
- [Convex MCP](https://docs.convex.dev/ai/convex-mcp-server)
- [Vercel MCP](https://vercel.com/docs/agent-resources/vercel-mcp)
- [Clerk MCP](https://clerk.com/docs/guides/ai/mcp/clerk-mcp-server)
- [Clerk CLI](https://clerk.com/docs/cli)

### Paiement et coûts

- [Lemon Squeezy pricing](https://www.lemonsqueezy.com/pricing)
- [Lemon Squeezy webhooks](https://docs.lemonsqueezy.com/help/webhooks)
- [Vercel pricing](https://vercel.com/pricing)
- [Sanity pricing](https://www.sanity.io/pricing)
- [Convex pricing](https://www.convex.dev/pricing)
- [Clerk pricing](https://clerk.com/pricing)
