# Articles

Deux voies de création : dans Sanity Studio, ouvrir « Article », saisir titre, résumé, catégorie, corps rich-text (titres, paragraphes, listes, liens HTTPS, images avec alt), puis enregistrer ; ou fournir un JSON à la commande locale. Le corps est Portable Text natif : aucune syntaxe Markdown nécessaire dans Studio. Une image de couverture doit avoir un texte alternatif. Les images du corps sont téléversées dans Sanity.

Modèle JSON minimal dans `docs/article-model.json` (contenu illustratif à remplacer, ne pas publier tel quel) :

```json
{
  "title": "Titre à remplacer",
  "summary": "Résumé à remplacer",
  "category": "Catégorie à remplacer",
  "body": "Premier paragraphe à remplacer.\n\nDeuxième paragraphe à remplacer.",
  "coverPath": "./photo.jpg",
  "coverAlt": "Description de la photo"
}
```

`body` peut aussi être un tableau de blocs Portable Text Sanity. `coverPath` est optionnel et relatif au JSON. La commande téléverse JPG, PNG ou WebP lors d’un vrai import, jamais en dry-run.

```sh
node scripts/manage-article.mjs chemin/article.json --dry-run
node scripts/manage-article.mjs chemin/article.json
```

Par défaut, la commande crée ou modifie `drafts.<id>` : un article déjà public reste publié dans son ancienne version. Pour publier seulement après accord explicite : `node scripts/manage-article.mjs chemin/article.json --publish`. La publication utilise une transaction avec garde de révision ; en cas de conflit, vérifier dans Studio et relancer après validation. La commande utilise `SANITY_WRITE_TOKEN` s’il existe, sinon la session Sanity CLI déjà authentifiée. Ne jamais coller de secret dans le chat.

Dans Studio, le statut « Publié » et le bouton **Publish** sont tous deux nécessaires : le bouton publie le document Sanity, le statut contrôle sa visibilité publique. Un brouillon se consulte dans Studio ; aucune URL publique de prévisualisation n’est fournie. Une panne Sanity affiche une erreur plutôt qu’une fausse liste vide.
