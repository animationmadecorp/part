# Socle réutilisable : réservation, disponibilités et tarifs

Ce document décrit le premier découpage réalisé dans Animation Made. Il sert de guide pour reprendre ces fonctions dans un futur template. Les composants visuels sont prêts à être déplacés, mais les adaptateurs et le contrat de données restent propres à ce site.

## Frontières des composants

| Élément | Fichier | Responsabilité |
| --- | --- | --- |
| Calendrier public | `components/booking/BookingSlotPicker.js` | Afficher les jours, créneaux et choix fournis en props. |
| Horaires administrateur | `components/booking/AvailabilityEditor.js` | Modifier visuellement les plages hebdomadaires et les exceptions datées. |
| Tarifs administrateur | `components/pricing/PriceEditor.js` | Éditer un catalogue de montants avec contrôle de version. |
| Adaptateurs du site | `app/nouveau/reserver/BookingCalendar.js`, `app/admin/disponibilites/AvailabilityManager.js`, `app/admin/tarifs/PricingManager.js` | Charger les données Convex, vérifier l'accès, gérer l'état et appeler les mutations. |

Les composants de présentation ne connaissent ni Convex, ni Clerk, ni Sanity. Ils réutilisent toutefois les classes CSS et les libellés français du site. `components/booking/README.md` précise les feuilles de style nécessaires au calendrier et aux horaires. `PriceEditor` dépend de `app/admin/tarifs/pricing.css` et des tokens communs de l'administration. Le prochain template pourra remplacer les adaptateurs et les styles sans recopier le parcours de paiement.

## Contrat de disponibilité

Les horaires habituels sont des plages par jour de semaine ; une exception remplace entièrement ces plages pour une date. L'adaptateur conserve un brouillon local jusqu'à l'enregistrement. Le serveur valide les plages, le fuseau et les collisions avec les réservations avant de proposer des créneaux. Le calendrier ne doit jamais être considéré comme la preuve qu'un créneau est encore libre : la création de la réservation revérifie la disponibilité côté serveur.

## Contrat de prix

`lib/pricing-core.mjs` définit huit clés stables et leurs montants initiaux. `convex/pricing.js` expose un catalogue public, un catalogue réservé à l'administrateur et une mutation de modification. Chaque tarif a une version. L'éditeur transmet la version vue par l'administrateur : si une autre modification a eu lieu entre-temps, le serveur refuse l'écriture et demande de recharger la valeur.

Les pages publiques lisent le catalogue publié. Lorsqu'un visiteur crée une réservation ou un dossier, il transmet la version affichée. Le serveur refuse une version dépassée, puis inscrit le montant dans la réservation ou le dossier. Les étapes ultérieures de paiement utilisent ce montant enregistré. Une modification de tarif ne change donc pas une commande déjà créée. Les anciennes commandes sans montant explicite conservent leur montant historique par défaut.

Pour reprendre ce module dans un autre produit, conserver ces invariants : validation du montant en centimes, devise explicite, version du devis, contrôle administrateur côté serveur, montant figé à la création de commande, et paiement fondé sur cette commande.

## Place de Sanity

Sanity reste la source des descriptions, pages et autres contenus éditoriaux. La page `/admin/tarifs` offre une interface directe à une personne qui n'utilise pas Sanity ; elle écrit dans Convex, la source des montants contractuels. Il n'y a pas de prix à maintenir en double dans Sanity.

Une future interface unique peut enregistrer les champs éditoriaux dans Sanity et les montants dans Convex derrière les mêmes formulaires. Avant d'introduire cette passerelle, prévoir une gestion explicite des deux états de publication, des droits, des échecs partiels, des reprises et des mises à jour concurrentes. Faire de Sanity la source des prix exigerait en plus une projection fiable vers Convex avant toute ouverture de commande ; ce n'est pas implémenté ici.

## Reprise dans la boilerplate

1. Copier les composants de présentation et leurs styles, puis remplacer les textes et le design si nécessaire.
2. Définir les variantes commerciales dans le catalogue et adapter les formulaires de l'administration.
3. Fournir les adaptateurs de disponibilité, de réservation, d'authentification et de paiement du nouveau site.
4. Conserver les tests du contrat de prix et les scénarios de changement de prix entre affichage, création de commande et paiement.

Le code actuel constitue une base extraite et branchée sur Animation Made, pas encore un package indépendant publié. Aucun tarif ni contenu n'a été modifié dans les services hébergés par ce travail.
