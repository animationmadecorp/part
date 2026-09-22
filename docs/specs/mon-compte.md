# Mon compte — interface et branchements

Interface visible via /nouveau/bibliotheque?onglet=compte et l’onglet Mon compte.
Profil, sécurité, achats et factures, communications, données personnelles.
Les actions sont désactivées : aucune persistance, consentement, export ou suppression n’est simulé.
L’état vide des commandes ne lit pas encore Stripe. Pas de facture ni d’identité inventée dans le composant du compte.

## Avant production
- Brancher profil et sessions sur Clerk, selon les méthodes d’authentification effectivement activées ; réauthentifier les changements sensibles.
- Lire uniquement les commandes et factures de l’utilisateur authentifié, via le serveur ; aucun identifiant client fourni par le navigateur ne doit suffire à autoriser l’accès.
- Enregistrer les préférences de communication et les preuves de consentement, avec retrait simple ; pas de case marketing précochée.
- Brancher la politique réelle : responsable, contact, finalités et bases légales, destinataires, transferts éventuels, durées, droits et réclamation CNIL. Ne pas publier une politique générique présentée comme conforme.
- Mettre en place le traitement sécurisé des demandes d’accès, correction, portabilité lorsque applicable, opposition/limitation et effacement ; confirmation de réception distincte de l’exécution.
- Définir la suppression coordonnée Clerk/Convex/fichiers, la confirmation, l’impact sur les achats et les exceptions légales de conservation. Ne pas supprimer automatiquement les factures.
- Prévoir les préférences cookies si des traceurs facultatifs sont effectivement utilisés.
- Tester les contrôles d’accès intercomptes et les parcours d’erreur avant d’activer les boutons.

Références :
- https://www.cnil.fr/fr/comprendre-mes-droits/le-droit-leffacement-supprimer-vos-donnees-en-ligne
- https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre3
- https://cnil.fr/fr/la-prospection-commerciale-par-courrier-electronique-sms-mms-et-automate-dappel

Décisions bibliothèque : Vie professionnelle gratuite après inscription. Mon suivi permettra consultation des PDF et téléchargement, à construire séparément.
