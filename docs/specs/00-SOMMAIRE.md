# Sommaire des spécifications — Animation Made

> Point de départ actuel : [cadrage de la nouvelle version](00-cadrage-nouvelle-version.md). Il consigne Stripe, les quatre accompagnements, les quatre onglets fixes et l'administration centralisée. Les specs ci-dessous sont des brouillons historiques à harmoniser avant implémentation ; « spécifiée » ne signifie pas à jour ni validée.

- Document maître : [PRD Production](../PRD-production.md)
- Décision d'architecture : [ADR-001](../ADR-001-boilerplate-production.md)
- Plan opérationnel actuel : [connexions de production — 19 septembre 2026](../plan-connexions-production-2026-09-19.md)
- Dernière mise à jour : 2 septembre 2026
- Responsable du suivi : équipe Animation Made

## Comment utiliser ce dossier

Chaque fonctionnalité passe par quatre états indépendants :

1. **Spécifiée** : comportement, données, sécurité et critères d'acceptation sont écrits.
2. **Validée** : la fondatrice et le responsable technique approuvent la spec.
3. **Implémentée** : le code est terminé et relu.
4. **Recettée** : les critères d'acceptation ont été vérifiés sur l'environnement prévu.

Une fonctionnalité n'est considérée comme terminée que lorsque ses quatre cases sont cochées. La mise à jour du présent sommaire fait partie de la Definition of Done de chaque lot.

## Légende des priorités

- **P0** : indispensable avant toute vente réelle.
- **P1** : indispensable au lancement commercial complet.
- **P2** : peut être livré après le premier lancement.

## Suivi global

Premiers écrans construits localement : [livraison et limites](01-premiers-ecrans-livraison.md). La maquette est à relire ; aucune intégration métier ci-dessous n'est déclarée terminée.

| ID | Spécification | Priorité | Dépendances | Spécifiée | Validée | Implémentée | Recettée |
|---|---|---:|---|:---:|:---:|:---:|:---:|
| SPEC-01 | [Architecture et environnements](01-architecture-environnements.md) | P0 | — | [x] | [ ] | [ ] | [ ] |
| SPEC-02 | [CMS Sanity et contenu public](02-cms-sanity-contenu.md) | P0 | 01 | [x] | [ ] | [ ] | [ ] |
| SPEC-03 | [Authentification Clerk et utilisateurs](03-authentification-utilisateurs.md) | P0 | 01 | [x] | [ ] | [ ] | [ ] |
| SPEC-04 | [Données Convex et autorisations](04-convex-donnees-autorisations.md) | P0 | 01, 03 | [x] | [ ] | [ ] | [ ] |
| SPEC-05 | [Catalogue et produits](05-catalogue-produits.md) | P0 | 02, 04 | [x] | [ ] | [ ] | [ ] |
| SPEC-06 | [Paiements Stripe — réécriture requise](06-paiements-webhooks.md) | P0 | 03, 04, 05 | [ ] | [ ] | [ ] | [ ] |
| SPEC-07 | [Add-ons, fichiers privés et téléchargements](07-addons-telechargements.md) | P0 | 04, 05, 06 | [x] | [ ] | [ ] | [ ] |
| SPEC-08 | [Espace client, droits et abonnements](08-espace-client-abonnements.md) | P1 | 03, 04, 06, 07 | [x] | [ ] | [ ] | [ ] |
| SPEC-09 | [Cours collectifs et réservations](09-cours-collectifs.md) | P1 | 05, 06, 08 | [x] | [ ] | [ ] | [ ] |
| SPEC-10 | [Reviews de books](10-reviews-books.md) | P1 | 06, 07, 08 | [x] | [ ] | [ ] | [ ] |
| SPEC-11 | [Articles, ressources et formations](11-contenus-formations.md) | P1/P2 | 02, 04, 08 | [x] | [ ] | [ ] | [ ] |
| SPEC-12 | [MCP, CLI et administration IA](12-mcp-cli-administration.md) | P0 | 01–06 | [x] | [ ] | [ ] | [ ] |
| SPEC-13 | [Qualité, sécurité et conformité](13-qualite-securite-conformite.md) | P0 | toutes | [x] | [ ] | [ ] | [ ] |
| SPEC-14 | [Déploiement, observabilité et lancement](14-deploiement-production.md) | P0 | toutes P0/P1 | [x] | [ ] | [ ] | [ ] |

## Ordre de réalisation recommandé

```text
01 Architecture
 ├─ 02 Sanity ── 05 Catalogue ───────────────┐
 └─ 03 Clerk ── 04 Convex ── 06 Paiements ──┼─ 07 Fichiers ── 08 Espace client
                                              │                    ├─ 09 Cours
                                              │                    ├─ 10 Reviews
                                              │                    └─ 11 Formations
                                              └─ 12 MCP/CLI

13 Qualité et sécurité s'applique à chaque lot
14 Production clôt le lancement
```

## Décisions produit à obtenir

- [ ] Politique de remboursement des produits numériques.
- [ ] Prix minimum ou système de packs pour les add-ons à faible prix.
- [ ] Prix, séances incluses et durée des accès des quatre accompagnements ; abonnements éventuels à confirmer.
- [ ] Fournisseur d'e-mails transactionnels.
- [ ] Fournisseur et organisation des cours en visioconférence.
- [ ] Durée de conservation des fichiers de review.
- [ ] Fournisseur vidéo des futures formations.
- [ ] Domaine principal et sous-domaines d'administration.

## Journal de progression

Ajouter une ligne lors de chaque validation ou clôture.

| Date | Spec | Changement | Validé par | Preuve |
|---|---|---|---|---|
| 2026-09-02 | Toutes | Création du découpage initial depuis la PRD | — | PRD v1.0 |
