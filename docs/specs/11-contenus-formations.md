# SPEC-11 — Articles, ressources et formations

- Priorité : P1 pour articles/ressources, P2 pour vidéo
- Statut : spécifiée, à valider
- Dépendances : SPEC-02, SPEC-04, SPEC-08

## Objectif

Faire évoluer la boutique vers une plateforme de ressources publiques, gratuites, payantes ou incluses dans un abonnement.

## Règles d'accès

- Public.
- Membre gratuit.
- Abonné Pro.
- Acheteur d'un produit déterminé.
- Accès manuel temporaire ou permanent.

Sanity décrit la règle attendue ; Convex vérifie le droit effectif.

## Structure pédagogique

- Formation → modules → leçons → ressources.
- Progression enregistrée dans Convex.
- Leçon marquée terminée explicitement ou selon une règle définie.
- Reprise au dernier contenu consulté.
- Articles publics indexables ; contenus privés protégés au serveur et `noindex`.

## Vidéo

- Aucun fichier vidéo privé servi depuis `/public` ou Sanity.
- Fournisseur de streaming privé requis avant la phase vidéo.
- URL/token de lecture court et vérifié côté serveur.
- Sous-titres ou transcription requis pour les contenus publiés.

## Critères d'acceptation

- [ ] Un article public peut être publié sans code.
- [ ] Une ressource membre est inaccessible déconnecté.
- [ ] Un contenu Pro disparaît après expiration effective du droit.
- [ ] La progression est propre à chaque utilisateur.
- [ ] Les contenus privés ne sont ni indexés ni présents dans un payload public.
- [ ] La vidéo fonctionne sur mobile avec sous-titres avant lancement de la phase P2.

## Clôture de la spec

- [ ] Taxonomie et règles d'accès validées.
- [ ] Parcours gratuit et Pro recettés.
- [ ] Fournisseur vidéo validé avant implémentation P2.
- [ ] Sommaire maître mis à jour.

