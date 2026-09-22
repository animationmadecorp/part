# Plan — calendrier intégré Animation Made

## Résultat attendu

Construire une interface de réservation intégrée au site, accessible depuis les offres qui comportent un rendez-vous, avec un calendrier mensuel, des créneaux disponibles, une sélection de créneau et une confirmation liée à l'offre choisie.

## Décisions

- Pas de plateforme de réservation secondaire visible par l'utilisateur.
- Reprise de la logique éprouvée de l'ancien calendrier : fuseau `Europe/Paris`, plages hebdomadaires, exceptions par date, délai minimal et protection contre les doubles réservations.
- Les durées sont configurables par offre : projet d'animation 20 minutes, direction de contenu 15–20 minutes, anglais selon le format choisi.
- Sanity reste la source éditoriale des contenus et des offres. En production, les disponibilités et les réservations relèvent de Convex ; ce branchement remplacera l'adaptateur local sans changer l'expérience du calendrier.
- Aucune mention de maquette ou de fonctionnalité « prochaine » dans l'interface.
- Le premier adaptateur est local et persiste les réservations sous la clé `animation-made:bookings:v1`. Si le stockage du navigateur est bloqué, la session conserve un repli mémoire sans changer le parcours.
- L'adaptateur local des disponibilités persiste les plages hebdomadaires et les exceptions sous la clé `animation-made:availability:v1`. Son contrat `getAvailability()` / `saveAvailability()` est isolé dans `app/nouveau/_booking/localAvailabilityAdapter.mjs` afin que Convex puisse le remplacer en production.
- La source de vérité pure se trouve dans `app/nouveau/_booking/bookingLogic.mjs` : elle résout les instants `Europe/Paris` avec les règles DST d'`Intl`, refuse les heures sautées, choisit la première occurrence d'une heure répétée et vérifie la fin réelle d'une séance.
- Le motif hebdomadaire local est mardi à jeudi, 09:00–12:00, avec une cadence de 20 minutes, un délai minimal de 24 heures et un horizon de 35 jours. Une exception explicite par date, y compris `[]`, remplace le motif.
- Les durées/cadences du catalogue sont : Projet d'animation 20 minutes, Direction de contenu 20 minutes (libellé commercial 15–20 minutes), Anglais solo/duo 60 minutes. Les séances d'une heure ont une cadence de départ d'une heure afin d'éviter les chevauchements locaux.

## Périmètre de cette étape

- Porter la logique de calcul des créneaux sans dépendance à l'ancien projet.
- Créer le composant calendrier Animation Made et sa page de réservation.
- Supporter les paramètres d'offre et de durée dans l'URL.
- Relier les boutons des offres avec rendez-vous au calendrier.
- Vérifier l'affichage desktop/mobile, la navigation mensuelle, la sélection de créneau et les états d'erreur.

## Livraison locale

- `app/nouveau/reserver/page.js` lit `offre` et `format` dans `searchParams`, puis transmet uniquement un objet d'offre sérialisable au composant client.
- `app/nouveau/reserver/BookingCalendar.js` porte l'expérience mensuelle : jours ouverts, créneaux, formulaire accessible, confirmation, repli de chargement, erreur de disponibilité et conflit de créneau.
- `app/nouveau/_booking/localAvailabilityAdapter.mjs` expose le contrat isolé des disponibilités : `getAvailability()`, `saveAvailability()` et `resetAvailability()`, avec `weeklyAvailability` et `dateExceptions` dans le snapshot.
- `app/nouveau/_booking/localBookingAdapter.js` compose ce contrat avec `createBooking(input)` et les réservations locales. Le composant accepte aussi un adaptateur client explicite pour les tests ou le futur branchement Convex.
- Le contrat de remplacement conserve les champs `offerKey`, `mode`, `date`, `time`, `name`, `email`, `message` en entrée et renvoie une réservation avec `startISO`, `durationMinutes` et `timezone`. Convex devra recalculer les créneaux côté serveur et réserver atomiquement ; Clerk fournira l'identité ; Stripe pourra fournir l'entitlement ou l'état de paiement avant l'appel, sans modifier l'interface.
- Les boutons Projet d'animation, Direction de contenu et Anglais pointent vers la route avec leur clé et, pour l'anglais, leur format solo/duo. Les offres Feedback et Review sans rendez-vous restent séparées du calendrier.

## Production

- Remplacer les adaptateurs locaux par Convex pour les disponibilités et les réservations.
- Laisser Sanity sur le périmètre éditorial : contenus, textes et offres.
- Vérifier l'identité Clerk et l'achat Stripe avant de réserver.
- Ajouter les tables `availability` et `bookings`, les mutations serveur transactionnelles et les notifications.
- Configurer les disponibilités réelles de Made.

## Validation

- `npm run lint`
- `npm run build`
- Vérification manuelle des routes `/nouveau/reserver?offre=projet-animation`, `contenu` et `anglais`.
- `node scripts/verify-booking.mjs` : fuseaux hiver/été, heures DST invalides/répétées, exceptions, délai, horizon, durées, cadence et chevauchements.
