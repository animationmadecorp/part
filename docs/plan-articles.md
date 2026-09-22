# Circuit articles

Objectif : préparer la création d'articles par conversation ou via une fiche Sanity, sans publier de contenu fictif. Publication réelle du premier article après réception et validation du contenu par la propriétaire.

Workflow léger Analyze → Plan → Execute → eXamine ; Apex absent (inspection effectuée précédemment). Un worker Sol-low, parent responsable de la recette et des opérations distantes.

- [x] Modèle Article et formulaire Studio en français.
- [x] Liste et page d'article, rendu sûr, SEO, brouillons exclus.
- [x] Commande de brouillon/publication explicite et consigne réutilisable.
- [x] Tests, revue parent et compilation.
- [x] Déployer Studio/site et étendre le webhook existant aux articles.
- [x] Vérifier l'état vide et les brouillons sans publier de fixture.

Worker : 01a0c90d-3853-7a91-a43b-67a8bec717fb. Aucune modification des comptes, paiements ou ressources existantes.

## Contrôles parent
- Catalogue initial : aucun article ni brouillon article existant.
- Commande dry-run : validation réussie, cloudWrite=false.
- Commande réelle avec session CLI existante : création de drafts.article-verification-brouillon-20260922, statut draft, document public absent. Ce brouillon temporaire doit être retiré à la fin du contrôle, sans publication.
- Choix : corps Portable Text natif pour édition manuelle sans Markdown ; images locales possibles via la commande ; conservation de la version publique pendant les corrections.

## Livraison du 22 septembre 2026
- 7 tests unitaires PASS ; lint sans erreur (5 avertissements Convex générés préexistants) ; build PASS.
- Code livré : 67b1f2b ; Vercel dpl_4x8oRvWpiww4BmLEA2kve2YpMVc9 READY.
- Studio permanent déployé ; entrée Article visible dans le navigateur authentifié.
- Webhook existant étendu à article, autres types conservés.
- Production : /nouveau/articles HTTP 200 ; URL du brouillon HTTP 404 ; texte du brouillon absent des deux réponses.
- Brouillon technique supprimé après contrôle ; aucun document Article restant, aucune publication fictive.
- Reste éditorial : recevoir le premier contenu réel, préparer son brouillon, validation propriétaire puis première publication et contrôle de son rendu réel.
