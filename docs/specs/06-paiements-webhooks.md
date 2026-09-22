# SPEC-06 — Paiements Stripe et webhooks

- Priorité : P0
- Statut : spécifiée, à valider
- Dépendances : SPEC-03, SPEC-04, SPEC-05

## Objectif

Transformer de façon fiable un paiement Stripe en commande et droit d'accès Convex.

## Checkout

- Checkout Stripe, avec prix et produit sélectionnés côté serveur.
- Variante sélectionnée côté serveur à partir d'une liste autorisée.
- `clerkUserId` transmis en métadonnée lorsque disponible.
- URL de retour sur l'espace client avec état d'attente explicite.
- Aucun accès accordé sur la seule base du retour navigateur.

### Règle d'interface légale

- Les explications détaillées restent centralisées dans les CGV et la page Rétractation et remboursements ; elles ne sont pas répétées sur les fiches d'offre ou dans les questionnaires.
- Le bouton de paiement conserve un libellé court, par exemple `Payer 58 €`.
- Pour les prestations personnalisées livrées avant la fin du délai légal de rétractation, le checkout recueille une demande expresse de commencement anticipé et la reconnaissance de la perte du droit de rétractation après exécution complète. Cette preuve est horodatée et rattachée à la commande, puis reprise sur un support durable dans la confirmation.
- Cette demande est présentée une seule fois à l'étape finale de paiement, sans case précochée et sans mention dispersée ailleurs dans le parcours.
- Pour un cours réservé à une date ultérieure, les informations contractuelles indiquent la date d'exécution et les règles de report ; le traitement du droit de rétractation suit la situation réelle de la séance.

## Webhooks minimums

- Session de paiement terminée ou expirée.
- Paiement réussi, échoué, annulé ou remboursé.
- Chargeback si exposé par le fournisseur.

## Traitement

1. Lire le corps brut.
2. Vérifier la signature Stripe.
3. Enregistrer l'événement avec une clé d'idempotence.
4. Répondre rapidement au fournisseur.
5. Normaliser la commande ou l'abonnement.
6. Calculer le droit correspondant.
7. Journaliser le résultat et relancer les erreurs temporaires.

## Critères d'acceptation

- [ ] Un achat test crée exactement une commande et un droit.
- [ ] Un webhook dupliqué ne double aucun effet.
- [ ] Des événements désordonnés aboutissent au bon état final.
- [ ] Un remboursement applique la politique de révocation validée.
- [ ] Une annulation ou un remboursement produit l'état d'accès attendu pour l'offre concernée.
- [ ] La preuve du commencement anticipé est enregistrée et restituable avec la commande lorsqu'elle est nécessaire.
- [ ] Le support peut resynchroniser une commande de manière auditée.
- [ ] Aucun secret ou payload sensible n'apparaît dans les logs.

## Clôture de la spec

- [ ] Politique remboursement/chargeback validée.
- [ ] Tous les événements testés avec fixtures.
- [ ] Reprise d'erreur et alertes testées.
- [ ] Achat live contrôlé effectué avant lancement.
- [ ] Convention avec un médiateur de la consommation compétent signée et coordonnées ajoutées aux CGV avant la première vente B2C réelle.
- [ ] Sommaire maître mis à jour.
