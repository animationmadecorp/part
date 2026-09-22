# Circuit articles

Objectif : préparer la création d'articles par conversation ou via une fiche Sanity, sans publier de contenu fictif. Publication réelle du premier article après réception et validation du contenu par la propriétaire.

Workflow léger Analyze → Plan → Execute → eXamine ; Apex absent (inspection effectuée précédemment). Un worker Sol-low, parent responsable de la recette et des opérations distantes.

- [ ] Modèle Article et formulaire Studio en français.
- [ ] Liste et page d'article, rendu sûr, SEO, brouillons exclus.
- [ ] Commande de brouillon/publication explicite et consigne réutilisable.
- [ ] Tests, revue parent et compilation.
- [ ] Déployer Studio/site et étendre le webhook existant aux articles.
- [ ] Vérifier l'état vide et les brouillons sans publier de fixture.

Worker : 01a0c90d-3853-7a91-a43b-67a8bec717fb. Aucune modification des comptes, paiements ou ressources existantes.

## Contrôles parent
- Catalogue initial : aucun article ni brouillon article existant.
- Commande dry-run : validation réussie, cloudWrite=false.
- Commande réelle avec session CLI existante : création de drafts.article-verification-brouillon-20260922, statut draft, document public absent. Ce brouillon temporaire doit être retiré à la fin du contrôle, sans publication.
- Choix : corps Portable Text natif pour édition manuelle sans Markdown ; images locales possibles via la commande ; conservation de la version publique pendant les corrections.
