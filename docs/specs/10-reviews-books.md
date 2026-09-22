# SPEC-10 — Reviews de books

- Priorité : P1
- Statut : spécifiée, à valider
- Dépendances : SPEC-06, SPEC-07, SPEC-08

## Objectif

Transformer l'achat d'une review en workflow privé, traçable et simple pour la cliente et l'équipe.

## États

`à compléter` → `reçue` → `en analyse` → `livrée` → `révision demandée` ou `clôturée`.

## Données

- Commande source et propriétaire.
- Brief structuré.
- Liens et fichiers entrants.
- Échéance annoncée.
- Statut et historique.
- Livrable et éventuelle demande de révision.
- Date d'expiration/suppression des fichiers.

## Règles

- La demande est créée après paiement confirmé.
- Seuls la cliente et les membres autorisés accèdent aux fichiers.
- Les types, tailles et quantités sont limités.
- Toute transition administrative importante est auditée.
- Les fichiers expirés suivent une suppression ou anonymisation documentée.

## Critères d'acceptation

- [ ] L'achat ouvre une seule demande.
- [ ] La cliente peut compléter son brief et reprendre plus tard.
- [ ] Les fichiers sont privés et scannés/validés selon le risque retenu.
- [ ] Chaque changement de statut est visible et horodaté.
- [ ] Le livrable est téléchargeable uniquement par la bonne cliente.
- [ ] La rétention et la suppression sont vérifiables.

## Clôture de la spec

- [ ] Brief validé.
- [ ] Délais et révisions définis.
- [ ] Politique de conservation validée.
- [ ] Workflow complet recetté.
- [ ] Sommaire maître mis à jour.

