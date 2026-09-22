# Préflight d’authentification avant publication

La recette livraison, les étapes opérateur et les blocages DEV actuels sont regroupés dans [Livraison, préflight et mise en production contrôlée](./plan-livraison-preflight-2026-09-21.md).

Ce document décrit la préparation de publication de l’application Clerk/Convex. Il ne déclenche aucun déploiement, paiement, migration ou activation de clé live.

## Garde appliquée

La nouvelle application utilise Clerk pour l’identité et Convex pour les données membres. Les pages et routes qui appellent `lib/server-auth.js` vérifient la session Clerk côté serveur ; le proxy ne constitue jamais l’unique contrôle d’accès.

L’ancien modèle email/mot de passe et ses cookies `am_session`, `am_editor` et `am_admin` sont fermés dès que `NODE_ENV=production` ou `VERCEL_ENV=production`. Une valeur `SESSION_SECRET`, même présente, ne réactive pas ce modèle. Il n’existe plus de secret de repli dans le code.

En développement uniquement, les anciennes routes peuvent rester disponibles si un `SESSION_SECRET` local d’au moins 32 caractères est fourni. `LEGACY_AUTH_ENABLED=false` les ferme aussi localement. Ne jamais recopier cette configuration dans l’environnement de production.

## Variables attendues

À configurer dans le gestionnaire de variables du fournisseur, sans les committer :

| Variable | Exigence de publication |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | présente |
| `CLERK_SECRET_KEY` | présente, côté serveur uniquement |
| `NEXT_PUBLIC_CONVEX_URL` | présente et en HTTPS |
| `NEXT_PUBLIC_APP_URL` | présente et en HTTPS |
| `RESEND_APP_URL` | optionnelle si `NEXT_PUBLIC_APP_URL` est définie ; origine sûre et non locale pour les liens email |
| `RESEND_SEND_MODE` | `development` en local ; `production` explicitement dans la cible de production |
| `RESEND_SEND_ENABLED` | `false` par défaut ; aucun message n’est envoyé par le préflight |
| `RESEND_PRODUCTION_SEND_ENABLED` | `false` tant que la politique de destinataires n’est pas approuvée ; avec `RESEND_SEND_MODE=production`, ce second opt-in est obligatoire |
| `SESSION_SECRET` | inutile en production ; ne réactive pas l’auth legacy |
| `LEGACY_AUTH_ENABLED` | inutile en production ; l’auth legacy reste fermée |

Les secrets Stripe, Resend, Sanity et les paramètres Convex de production suivent leurs procédures dédiées et ne sont pas modifiés par ce garde-fou.

La promotion du propriétaire, si elle est approuvée séparément, passe uniquement par la mutation Convex interne `internal.ownerAdministration.promoteOwnerProfile`. Elle exige l’identifiant du profil existant, le `clerkUserId` et l’email attendus ; elle refuse toute correspondance absente ou ambiguë, ne crée aucun profil et retourne sans écriture si le profil est déjà administrateur. Aucun endpoint public, bootstrap par email ou auto-promotion n’existe. Cette opération n’est pas exécutée par la préparation de publication.

## Préflight sans divulgation

Depuis le commit à publier, exécuter avec les variables de l’environnement cible chargées par le shell ou le fournisseur :

```bash
npm ci
npm run preflight:production
npm run build
```

Le préflight n’imprime aucune valeur de variable. Il expose seulement des booléens, les noms de variables manquantes et la raison non secrète d’un refus. En production, `AM_PREFLIGHT_MODE=prepare npm run preflight:production` exige les préfixes de clés live Clerk, une URL Convex et une origine publique HTTPS, la configuration minimale Resend, le mode Resend `production` avec les deux gates fermées, et l’authentification legacy fermée. Il n’envoie aucun message. Après approbation distincte de la politique de destinataires, `AM_PREFLIGHT_MODE=live npm run preflight:production` vérifie la forme de l’activation avec les deux gates ouvertes, toujours sans appeler Resend ; le smoke test réel reste manuel. Les codes `[EMAIL_MODE]`, `[EMAIL_SEND_GATE]` et `[EMAIL_PROVIDER]` rendent les erreurs de configuration explicites sans divulguer de secret.

Le contrôle automatisé correspondant est :

```bash
npm run verify:legacy-auth
```

## Sauvegarde et restauration manuelles avant publication

Cette étape reste une procédure opérateur à faire valider par le propriétaire de l’hébergement et du compte admin. Le site n’est pas déployé par ce document, aucun compte fournisseur n’est présumé disponible et aucune sauvegarde automatique n’est déclarée ici.

Avant toute première mise en ligne :

1. Noter l’identifiant du déploiement, la date/heure UTC, l’opérateur et le périmètre exporté dans le journal de publication. Ne pas y copier de secret, cookie, token ou donnée personnelle brute.
2. Depuis l’interface officielle du fournisseur de données, produire une sauvegarde/export chiffré du périmètre réellement utilisé par l’application, puis conserver séparément son identifiant, sa taille, son empreinte et sa durée de conservation. Si l’export ou le snapshot n’est pas disponible, bloquer la publication et demander une décision au propriétaire.
3. Restaurer cette sauvegarde dans une cible isolée non publique, avec des identifiants de test distincts. Vérifier l’empreinte, l’ouverture de la cible et un échantillon structurel (collections, index, statuts et relations nécessaires) sans exposer de contenu dans les logs.
4. Faire vérifier le résultat par un second opérateur ou par le propriétaire, puis archiver la preuve de restauration et l’identifiant de la sauvegarde avec la fiche de publication. Ne jamais restaurer par-dessus la production pour effectuer ce test.
5. Documenter qui peut déclencher une restauration, qui l’autorise et le délai attendu. En l’absence de propriétaire ou de compte admin confirmé, conserver l’application hors trafic réel.

Cette procédure est une vérification manuelle : elle ne crée pas de job de sauvegarde, de migration ou de purge et ne constitue pas une preuve qu’un fournisseur a déjà été configuré. Les données de test doivent être minimisées et les preuves ne doivent contenir ni secret ni PII.

## Demandes de données et conservation

Les périodes validées et la formalité encore ouverte sont la source de vérité dans [Décisions légales et UX de lancement](./decisions-legales-lancement.md). À la date de ce document, aucune purge automatique n’est implémentée et aucune suppression destructive ne doit être lancée par le préflight ou le rollback.

Pour chaque demande d’accès, de rectification, de suppression ou d’export :

1. Enregistrer un identifiant interne, la date de réception, le canal, le périmètre demandé et le responsable assigné, sans mettre de PII ou de secret dans les logs techniques.
2. Vérifier l’identité du demandeur via le canal prévu et rechercher une obligation de conservation, une commande en cours ou un litige avant toute modification.
3. Préparer un export ou une réponse à partir des sources autorisées (Clerk, Convex, stockage de livrables et facturation selon le périmètre), faire valider l’action par le propriétaire, puis conserver uniquement la preuve minimale de traitement.
4. Si une suppression ou anonymisation est approuvée, consigner la décision, le périmètre et la date d’exécution dans le registre opérateur. Ne pas la simuler, l’automatiser ou l’exécuter dans le cadre de cette préparation.

Les repères actuellement validés sont : fichiers de travail/vidéos/pièces jointes six mois après la dernière livraison ; PDF finaux, annotations et livrables pendant l’existence du compte puis suppression sous 30 jours après fermeture ; questionnaires et suivi trois ans après la fin de commande ; factures et pièces comptables dix ans ; compte inactif, suppression possible après trois ans et avertissement ; données non légalement requises après fermeture, suppression ou anonymisation sous 30 jours. Ces délais ne remplacent pas la validation du propriétaire ni les obligations légales applicables au cas traité.

## Recette de publication

1. Vérifier le commit exact, l’absence de fichier `.env*` suivi par Git et la présence des variables uniquement dans le fournisseur.
2. Exécuter le préflight puis le build sur ce même commit. Ne pas lancer le trafic tant que l’un des deux échoue.
3. Vérifier anonymement une page publique, puis vérifier que `/login` et `/signup` redirigent vers Clerk et que `/editor/login` affiche la fermeture de l’ancien accès.
4. Vérifier que `POST /api/auth/login`, `POST /api/auth/signup` et `POST /api/editor/login` renvoient `410` sans écriture lorsque l’ancien accès est fermé.
5. Avec un compte Clerk de recette, vérifier la connexion, une page membre et une page admin autorisée. Avec un navigateur anonyme, vérifier le refus de ces mêmes scopes.
6. Vérifier les journaux de déploiement sans y trouver de clé, cookie signé ou valeur de variable. Ne pas considérer une recette preview comme une validation live.

### Retour depuis un domaine externe

Un retour top-level depuis un checkout ou un autre domaine peut arriver avant que Clerk ait restauré sa session côté navigateur. Si le serveur répond `unauthenticated` mais que Clerk confirme ensuite `isSignedIn`, `AccessBoundary` déclenche une seule revalidation serveur bornée par session et temporisation. Le navigateur ne reçoit jamais les données privées sur la seule base de cet état client : la page ne change que si le serveur accepte ensuite la session Clerk. Un visiteur réellement déconnecté reste sur le refus.

## Retour arrière

1. Identifier le dernier déploiement **déjà durci** qui contient la fermeture de l’auth legacy et le préflight ; ne pas revenir à un build antérieur qui contenait le secret de repli.
2. Utiliser le mécanisme de rollback du fournisseur vers ce déploiement immuable, sans modifier les données, le schéma Convex ou les paiements.
3. Conserver les variables Clerk/Convex et relancer le préflight sur le commit ciblé avant de réactiver le trafic.
4. Si une clé Clerk a été exposée, la révoquer et la remplacer dans le fournisseur avant la remise en ligne. Les anciens cookies legacy ne sont pas migrés et ne doivent pas être réactivés.
5. En cas de doute, laisser les routes membres fermées et corriger la configuration ; ne pas activer `SESSION_SECRET` ou un contournement legacy pour récupérer l’accès.

Un rollback ne constitue pas une autorisation de mettre en production les paiements, les emails, Sanity ou les autres intégrations : leurs décisions et recettes restent séparées.
