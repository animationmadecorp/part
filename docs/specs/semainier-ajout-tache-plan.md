# Semainier : ajout en fenêtre

Origine : 01a05cb8-2f96-7333-b548-a7534450cf3c. Worker : 01a0aa88-6d7c-70d2-8aee-976cc4ce9c24, « Semainier — ajout de tâches simplifié », local AM-PLATEFORM.
Workflow : Apex Essentials, Apex absent de /Users/kaolla/.codex/skills/apex/SKILL.md et /Users/kaolla/.agents/skills/apex/SKILL.md ; absent du catalogue.

## But et décisions
- Garder les sept jours sur une ligne, les couleurs et l’impression paysage.
- Supprimer le formulaire permanent, « Cette semaine » et la phrase décorative en bas ; aucun commentaire de chantier visible.
- Barre avec bouton lavande « Imprimer / Enregistrer » et « Ajouter une tâche » à côté.
- Fenêtre accessible : titre requis, sous-titre facultatif, date via petit calendrier natif (« Définir le jour »), heure facultative, case « Tâche récurrente ». Récurrence hebdomadaire au même jour et à la même heure, explicitée dans la fenêtre ; pas de fin inventée. Cocher/supprimer une occurrence ne doit pas altérer les autres semaines, suppression de série explicite si proposée.
- Préserver stockage temporaire actuel en mémoire ; pas de backend ou faux rendez-vous. Date choisie hors semaine : afficher la semaine correspondante après création.

## Acceptation
- [x] Contexte et surfaces : Planner.js, planner.css, Library.js pour intégration si nécessaire.
- [x] Luna Max confirmé dans turn_context du journal runtime (model gpt-5.6-luna, effort max). Objectif actif et exact confirmé par accusé worker.
- [x] Revue Astra persistante vérifiée : agent 01a0aa92-46be-7d92-bc64-d322ce6ac9d9, gpt-6-astra/max.
- [x] Implémentation, lint ciblé, création date/heure/titre/sous-titre, récurrence, complétion/suppression isolée, clavier/focus et mobile testés dans le navigateur. Impression vérifiée par CSS uniquement, pas de PDF rendu.
- [x] Revue cumulative PASS checkpoint 2 ; intégration acceptée par Astra après lecture source, DOM et capture du dialogue centré.
- [x] Worker goal complete, tâche terminée puis archivée avec confirmation outil.

## Limites conservées
- Tâches en mémoire uniquement : perdues au rechargement, futur branchement compte nécessaire.
- Palette approuvée texte blanc sur lavande/jaune : contraste insuffisant WCAG (2,20:1 / 1,94:1), à arbitrer séparément.
- Lint global : erreurs préexistantes hors périmètre ; lint Planner propre. Build complet interrompu après attente sans résultat, route dev fonctionnelle.

Respecter tous les changements existants ; ne pas modifier offres, tarifs ou compte. Pas de commit large, push ou déploiement.

## Correction couleur demandée
Apex toujours absent des deux chemins ci-dessus. Même worker repris : imposer le blanc aux jours et dates sur jaune/lavande du semainier, préserver boutons déjà blancs, palette et impression. Contrôle CSS ciblé et revue Astra avant acceptation. Aucun changement de comportement.
- [x] Texte blanc vérifié dans CSS et mesures IAB h3/dates/boutons ; revue Astra PASS (01a0aaa1-ef6f-7ef2-aeb5-d40c23016cb0), worker terminé et archivé. Mise en page et impression préservées.
