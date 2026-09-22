# SPEC-13 — Qualité, sécurité et conformité

- Priorité : P0 transversal
- Statut : spécifiée, à valider
- Dépendances : toutes les specs concernées

## Objectif

Définir les exigences qui bloquent la livraison d'une fonctionnalité même si son interface semble fonctionner.

## Definition of Done commune

Une fonctionnalité est terminée si :

- sa spec et ses décisions sont validées ;
- le code est relu ;
- lint, types, tests et build passent ;
- les autorisations serveur sont testées ;
- les erreurs et états vides sont traités ;
- mobile, clavier et accessibilité principale sont vérifiés ;
- les données sensibles sont absentes des logs ;
- la documentation d'exploitation est mise à jour ;
- la recette est signée et le sommaire coché.

## Sécurité

- HTTPS et secrets chiffrés.
- Validation des entrées et fichiers.
- CSP et en-têtes de sécurité.
- HMAC, idempotence et anti-rejeu des webhooks.
- Limitation de débit des routes sensibles.
- Contrôle d'accès serveur systématique.
- Dépendances auditées et mises à jour.
- Sauvegarde et restauration testées.

## Tests transversaux

- Unitaires pour les règles métier.
- Intégration entre fournisseurs.
- E2E des parcours critiques.
- Test utilisateur A contre ressources de B.
- Tests webhook dupliqué, désordonné et en échec.
- Audit accessibilité WCAG 2.2 AA des parcours principaux.
- Vérification SEO et non-indexation du privé.

## Conformité

- Mentions légales, CGV, confidentialité et remboursement.
- Minimisation et durées de conservation.
- Export, rectification et suppression/anonymisation.
- Consentement marketing séparé.
- DPA et sous-traitants inventoriés.

## Critères d'acceptation

- [ ] Aucun test critique n'est ignoré.
- [ ] Les vulnérabilités bloquantes sont corrigées.
- [ ] Les parcours principaux respectent l'objectif AA.
- [ ] Une restauration a été exécutée, pas seulement documentée.
- [ ] Les pages légales sont validées avant vente réelle.
- [ ] Les durées de conservation sont implémentées.

## Clôture de la spec

- [ ] Audit technique signé.
- [ ] Audit fonctionnel signé.
- [ ] Audit légal/organisationnel terminé.
- [ ] Risques résiduels acceptés et documentés.
- [ ] Sommaire maître mis à jour.

