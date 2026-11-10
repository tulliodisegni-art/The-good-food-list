# Good Food sur l'App Store et Google Play

## Le choix : Capacitor plutôt qu'une réécriture Expo

| | Capacitor (retenu) | Réécriture Expo (React Native) |
|---|---|---|
| Travail | L'appli web actuelle tourne telle quelle dans une coque iPhone / Android. Quelques jours. | Tout refaire : carte, filtres, fiches, amis, ajout par l'IA, hors connexion. Plusieurs semaines. |
| Une seule appli à faire vivre | Oui : le site et les applis partagent le même code. | Non : le site et l'appli divergent. |
| Fabriquer l'appli iPhone depuis Windows | GitHub Actions (Mac de GitHub, gratuit tant que le dépôt est public). | EAS Build, qui demande un compte Expo. |
| Risque de refus « simple site emballé » (règle 4.2 d'Apple) | Réel, mais couvert par : notifications, partage natif, position, suppression du compte, code de démonstration. | Plus faible. |
| Sensation « vraie appli » | Bonne (déjà pensée pour le téléphone). | Meilleure (animations natives). |

Expo vaudra le coup plus tard si Apple refuse malgré tout, ou si l'appli a besoin de fonctions natives poussées (widgets, extension de partage). Le travail fait ici (serveur, notifications, suppression de compte) resservira tel quel.

## Ce qui a été ajouté

- `package.json`, `capacitor.config.json`, dossiers `ios/` et `android/` : les projets des applis.
- `native.js` : ne fait rien sur le site. Dans l'appli, il prend la liste à jour sur le site (copie livrée en secours), active les notifications, gère le bouton retour d'Android et le partage.
- Réglages › Mon compte › **Supprimer mon compte** (obligatoire chez Apple et Google). Le compte est commun à Repz, Mijonote et Jobello : le message le dit.
- Réglages › **Notifications** : demandes d'abonnement, demandes acceptées, nouvelles adresses des amis (au plus une par ami et par heure).
- Fenêtre « Inviter » du propriétaire : bouton **Code pour la revue Apple / Google** (un code valable sur 50 appareils).
- Dans l'appli, plus d'astuce « Sur l'écran d'accueil » ni de clé d'IA à coller : l'appli passe par le serveur.
- `supabase/app-stores.sql` : fonction `delete_my_account` et déclencheurs des notifications Good Food.
- `supabase/functions/notifications` : la fonction d'envoi existante, qui sait maintenant écrire aux iPhone (APNs) et aux Android (Firebase), en plus des navigateurs.
- `.github/workflows/appli-mobile.yml` : fabrique à chaque envoi sur la branche une **APK Android** et une **appli iPhone pour simulateur** (rubrique « Artifacts » du passage).

Mettre à jour les applis après une modification du site : `npm run sync`. Refaire les icônes : `npm run icones`.

## À faire toi-même (comptes, clés, signature)

1. **Nom** : remplacer « Good Food » (conflit avec BBC Good Food) dans `capacitor.config.json` (`appName`), `ios/App/App/Info.plist` (`CFBundleDisplayName`) et `android/app/src/main/res/values/strings.xml`. L'identifiant `fr.officinadisegni.goodfood` est invisible pour les utilisateurs : on peut le garder.
2. ~~Supabase : installer `supabase/app-stores.sql` et déployer `supabase/functions/notifications`~~ : fait le 10/11/2026 (fonction en version 3, testée sur un compte fictif).
3. **Apple** (compte développeur) : créer l'identifiant `fr.officinadisegni.goodfood` avec « Push Notifications », une clé APNs (.p8), puis ajouter dans Supabase les secrets `APNS_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_TOPIC`. Pour TestFlight : une clé d'API App Store Connect dans les secrets GitHub, et on ajoutera l'étape de signature au workflow.
4. **Google** (Play Console + Firebase) : créer le projet Firebase, mettre `google-services.json` dans le secret GitHub `GOOGLE_SERVICES_JSON` et le compte de service dans le secret Supabase `FCM_SERVICE_ACCOUNT`. Une clé de signature pour la version Play Store.
5. **Revue** : dans l'appli, créer le code de revue (Inviter › Code pour la revue), créer un compte de démonstration (e-mail et mot de passe), puis donner les deux dans App Store Connect (« Informations de connexion » et « Notes ») et dans la Play Console (« Accès aux applis »). Supprimer le code après la validation.

## Rendre le dépôt privé ?

Recommandé, mais pas tout de suite :
- Sur un compte GitHub gratuit, un dépôt privé **coupe le site GitHub Pages**. L'appli web et la liste à jour lue par les applis s'arrêteraient. Il faut GitHub Pro (4 $/mois) ou un autre hébergeur.
- Les minutes GitHub Actions deviennent payantes au-delà du forfait. Une fabrication iPhone (Mac) compte 10 fois.
- Même privé, `data/places.json` reste téléchargeable par qui a l'appli ou le lien du site. Pour vraiment protéger la liste, il faudrait la servir depuis Supabase aux seuls membres invités.

Ordre conseillé : publier sur les stores, puis passer le dépôt en privé avec GitHub Pro, puis protéger la liste dans Supabase.
