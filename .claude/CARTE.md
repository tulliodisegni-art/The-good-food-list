# Carte de gf

Générée le 2026-11-18 22:55 par carte.mjs, sur l'ordinateur et sans IA. 87 fichiers, 22 241 lignes.
Lis d'abord cette carte, puis n'ouvre que les fichiers utiles et, dans un long fichier, seulement les lignes indiquées (L = numéro de ligne).

## Fichiers les plus utilisés

- scripts/oh.mjs : utilisé par 2 fichiers

## Détail des fichiers

### APPLI-MOBILE.md · 45 lignes
- Titres : L1 # Cozy Spots sur l'App Store et Google Play · L3 ## Le choix : Capacitor plutôt qu'une réécriture Expo · L15 ## Ce qui a été ajouté · L29 ## À faire toi-même (comptes, clés, signature) · L37 ## Rendre le dépôt privé ?

### README.md · 18 lignes
- Titres : L1 # Cozy Spots · L7 ## Mettre à jour les adresses · L15 ## Horaires, lieux fermés et photos libres

### account.js · 153 lignes
- Sections : L17 envoi des modifications (avec file d'attente hors ligne) · L48 fichiers (photos) · L59 écran de connexion
- Fonctions et classes : okey (L14) · esc (L15) · push (L19) · flush (L24) · pullAll (L37) · pending (L45) · syncedKey (L46) · fpath (L49) · putBlob (L50) · getBlob (L51) · delBlob (L52) · listBlobs (L53) · login (L72) · start (L113) · signOut (L119) · deleteAccount (L124) · go (L149)

### android/app/src/androidTest/java/com/getcapacitor/myapp/ExampleInstrumentedTest.java · 27 lignes
- Fonctions et classes : ExampleInstrumentedTest (L17)

### android/app/src/main/assets/public/account.js · 153 lignes
- Sections : L17 envoi des modifications (avec file d'attente hors ligne) · L48 fichiers (photos) · L59 écran de connexion
- Fonctions et classes : okey (L14) · esc (L15) · push (L19) · flush (L24) · pullAll (L37) · pending (L45) · syncedKey (L46) · fpath (L49) · putBlob (L50) · getBlob (L51) · delBlob (L52) · listBlobs (L53) · login (L72) · start (L113) · signOut (L119) · deleteAccount (L124) · go (L149)

### android/app/src/main/assets/public/app.js · 1 369 lignes
- Sections : L6 Stockage local (sur le téléphone) · L19 Outils · L46 Données · L97 Listes · L135 Distances · L290 Fiche · L661 Navigation · L746 Carte · L925 Ajout · L953 Lecture par l'IA (Claude) · L1234 Compléter une nouvelle fiche · L1304 Démarrage
- Repères HTML : #arr-${arr} (L182) · #editInfo (L441) · #classForm (L484)
- Fonctions et classes : $ (L3) · $$ (L4) · esc (L20) · norm (L21) · arrLabel (L22) · arrHtml (L23) · street (L24) · uid (L26) · catKey (L39) · catVar (L44) · euros (L59) · rebuild (L61) · setEdit (L89) · filtered (L98) · checkBtn (L116) · thumbHtml (L120) · rowHtml (L125) · distM (L136) · fmtDist (L141) · walkMin (L142) · distLabel (L143) · groupBy (L145) · renderChips (L151) · renderParis (L159) · renderArrStrip (L200) · cell (L203) · precCat (L223) · universeOf (L225) · renderPrec (L227) · renderVilles (L253) · renderPending (L275) · renderAll (L283) · icon (L304) · igHandle (L308) · linkFor (L312) · q (L314) · openSheet (L337) · nearbyHtml (L468) · infoRow (L477) · classifyForm (L481) · opt (L483) · editField (L507) · closeSheet (L510) · mobile (L520) · toggleTested (L638) · headerBottom (L653) · toast (L656) · show (L670) · setDiet (L724) · setPrice (L730) · i (L738) · setMapTop (L750) · loadMapLibs (L755) · add (L758) · initMap (L765) · useBase (L781) · initTraficLayer (L818) · fillMapCats (L835) · markerFor (L842) · refreshMarkers (L849) (+ 31 autres)

### android/app/src/main/assets/public/cordova.js · 1 lignes

### android/app/src/main/assets/public/cordova_plugins.js · 1 lignes

### android/app/src/main/assets/public/extras.js · 828 lignes
- Sections : L10 Thème · L14 Position · L53 Partager · L63 Petites cartes · L91 Accueil · L185 Panneaux (dans la fiche) · L204 Au hasard · L249 Réglages · L330 Clics · L397 Liste partagée · L505 Avis des amis · L572 Liens manquants : les ajouter soi-même · L629 Ma position et itinéraire sur la carte · L784 Adresses publiées depuis l'appli (base Supabase) · L812 Compte : récupère ce qui a été fait sur un autre appareil
- Repères HTML : #avisForm (L537) · #needForm (L598)
- Fonctions et classes : greeting (L5) · applyTheme (L11) · startWatch (L20) · locateMe (L27) · sharePlace (L54) · cardHtml (L64) · carousel (L73) · placeSub (L74) · dailyPick (L77) · h (L79) · qi (L89) · renderHome (L92) · section (L133) · renderSearch (L176) · match (L177) · openPanel (L186) · openListPanel (L193) · openNear (L197) · pickPool (L207) · openPicker (L218) · toggle (L221) · drawPick (L230) · choose (L234) · show (L235) · openSettings (L250) · backup (L297) · restore (L306) · deleteAccount (L316) · SB (L398) · sbHead (L399) · ghHead (L404) · b64 (L405) · unb64 (L406) · checkToken (L408) · isOwner (L419) · ownerCode (L420) · shareApp (L426) · shareFix (L438) · publishFix (L444) · canPublish (L466) · publishPlace (L467) · avisHead (L508) · loadAvis (L509) · avisFor (L522) · ago (L523) · avisBlock (L527) · openInstagram (L574) · onHide (L578) · openNeed (L593) · cleanNeed (L604) · showMe (L631) · osrm (L648) · trafic (L662) · fmtMin (L673) · goLinks (L675) · g (L677) · apple (L678) · drawRoute (L687) · rushNote (L708) · renderRouteCard (L720) (+ 6 autres)

### android/app/src/main/assets/public/gate.js · 170 lignes
- Sections : L27 styles · L52 écran de verrouillage · L80 propriétaire · L97 inviter quelqu'un : un code à usage unique par personne · L155 démarrage
- Fonctions et classes : dev (L10) · head (L11) · rpc (L12) · adminKey (L17) · missing (L19) · localKeyOk (L20) · ownerMail (L22) · isOwner (L23) · allowed (L24) · esc (L25) · ov (L49) · q (L50) · lock (L54) · submit (L65) · unlock (L78) · ownerLogin (L81) · invite (L98) · draw (L120) · start (L156)

### android/app/src/main/assets/public/home.css · 134 lignes

### android/app/src/main/assets/public/home.js · 310 lignes
- Fonctions et classes : gfArr (L34) · gfCityOf (L35) · gfIsPrec (L36) · gfZone (L37) · gfSign (L51) · gfCord (L58) · gfCuis (L62) · gfOutOf (L63) · gfGroup (L64) · gfPool (L65) · gfSorties (L67) · gfInst (L69) · gfZones (L70) · gfZkeys (L71) · gfGoodPhoto (L78) · gfPhoto (L79) · gfBg (L80) · gfCount (L81) · gfWish (L83) · gfCard (L106) · gfGrouped (L113) · gfDark (L120) · gfHero (L121) · n (L124) · gfNear (L137) · gfNearSec (L142) · gfOpenNear (L148) · go (L149) · gfHomeBody (L155) · gfListBody (L183) · head (L185) · gfBody (L236) · gfOpenZone (L248) · gfOpen (L257) · gfRoute (L263)

### android/app/src/main/assets/public/index.html · 230 lignes
- Repères HTML : #view-accueil (L50) · #view-paris (L55) · #view-carte (L72) · #view-precieuses (L93) · #view-villes (L105) · #view-ajouter (L110) · #aiForm (L123) · #placeForm (L154)
- Bibliothèques : vendor/leaflet/leaflet.css, vendor/markercluster/MarkerCluster.css, vendor/markercluster/MarkerCluster.Default.css, style.css, home.css, plus.css, native.js, gate.js, vendor/supabase.js, account.js, plus.js, app.js, extras.js, home.js, social.js

### android/app/src/main/assets/public/native.js · 119 lignes
- Sections : L19 liste et plan à jour depuis le site, copie de l'appli en secours · L31 partage : Android n'a pas navigator.share dans la WebView · L38 bouton retour d'Android : ferme d'abord la fiche ou le panneau ouvert · L50 barre d'état assortie au thème · L60 notifications
- Fonctions et classes : plugin (L16) · syncBar (L52) · pushState (L64) · savePush (L65) · sendToken (L67) · enablePush (L89) · afterLogin (L106)

### android/app/src/main/assets/public/plus.css · 93 lignes

### android/app/src/main/assets/public/plus.js · 221 lignes
- Sections : L6 Horaires · L58 Fermé définitivement · L66 Collections perso · L152 Événements
- Repères HTML : #collNew (L80)
- Fonctions et classes : ohMin (L9) · ohSpans (L10) · ohFmt (L12) · ohDayTxt (L13) · hasOh (L14) · openState (L17) · ohLine (L34) · ohRow (L41) · ohTag (L52) · closedBanner (L59) · colls (L68) · saveColls (L69) · collOf (L70) · collLine (L71) · collPickHtml (L77) · collRail (L83) · listsBody (L90) · collBody (L112) · b64e (L127) · b64d (L128) · shareColl (L129) · collFromLink (L139)

### android/app/src/main/assets/public/social.js · 225 lignes
- Sections : L16 chargement · L37 ajout des adresses des gens suivis à la liste · L58 ce que je partage · L85 actions · L113 affichage · L127 carte : défiler les amis et voir leurs adresses en plus des miennes · L180 clics · L205 démarrage
- Fonctions et classes : meId (L10) · h (L11) · nameOf (L12) · accepted (L13) · requests (L14) · load (L17) · fromCache (L33) · decorate (L38) · match (L51) · publish (L61) · doPublish (L62) · handleOk (L86) · toHandle (L87) · setHandle (L88) · follow (L94) · answer (L103) · unfollow (L108) · removeFollower (L109) · refresh (L111) · barHtml (L114) · chip (L116) · renderBars (L119) · extras (L129) · mapBarHtml (L130) · chip (L132) · renderMapBar (L135) · mapMatch (L142) · sheetHtml (L143) · settingsHtml (L151)

### android/app/src/main/assets/public/style.css · 879 lignes
- Sections : L389 v2 : lignes avec coche, bande d'arrondissements, univers · L502 v3 : fiche détaillée · L592 v5 : accueil, vignettes, envies, panneaux

### android/app/src/main/java/fr/officinadisegni/goodfood/MainActivity.java · 6 lignes
- Fonctions et classes : MainActivity (L5)

### android/app/src/test/java/com/getcapacitor/myapp/ExampleUnitTest.java · 19 lignes
- Fonctions et classes : ExampleUnitTest (L12)

### app.js · 1 490 lignes
- Sections : L6 Stockage local (sur le téléphone) · L37 Outils · L64 Données · L115 Listes · L153 Distances · L313 Fiche · L359 Photos de la fiche (galerie à faire défiler) · L402 Liens vers l'extérieur (menu, réservation, itinéraires…) · L742 Navigation · L827 Carte · L1007 Ajout · L1035 Lecture par l'IA (Claude) · L1340 Compléter une nouvelle fiche · L1410 Démarrage
- Repères HTML : #arr-${arr} (L200) · #editInfo (L522) · #classForm (L565)
- Fonctions et classes : $ (L3) · $$ (L4) · forgetCustom (L19) · mergeCustom (L26) · at (L27) · esc (L38) · norm (L39) · arrLabel (L40) · arrHtml (L41) · street (L42) · uid (L44) · catKey (L57) · catVar (L62) · euros (L77) · rebuild (L79) · setEdit (L107) · filtered (L116) · checkBtn (L134) · thumbHtml (L138) · rowHtml (L143) · distM (L154) · fmtDist (L159) · walkMin (L160) · distLabel (L161) · groupBy (L163) · renderChips (L169) · renderParis (L177) · renderArrStrip (L218) · cell (L221) · precCat (L241) · universeOf (L243) · renderPrec (L245) · villeOf (L272) · renderVilles (L276) · renderPending (L298) · renderAll (L306) · icon (L327) · igHandle (L331) · linkFor (L335) · q (L337) · loadGallery (L363) · photosOf (L369) · heroHtml (L374) · galSync (L394) · openSheet (L421) · nearbyHtml (L549) · infoRow (L558) · classifyForm (L562) · opt (L564) · editField (L588) · closeSheet (L591) · mobile (L601) · toggleTested (L719) · headerBottom (L734) · toast (L737) · show (L751) · setDiet (L805) · setPrice (L811) · i (L819) · setMapTop (L831) (+ 41 autres)

### extras.js · 867 lignes
- Sections : L10 Thème · L14 Position · L67 Partager · L77 Petites cartes · L105 Accueil · L199 Panneaux (dans la fiche) · L218 Au hasard · L263 Réglages · L349 Clics · L417 Liste partagée · L525 Avis des amis · L592 Liens manquants : les ajouter soi-même · L649 Ma position et itinéraire sur la carte · L804 Adresses publiées depuis l'appli (base Supabase) · L832 Compte : récupère ce qui a été fait sur un autre appareil
- Repères HTML : #avisForm (L557) · #needForm (L618)
- Fonctions et classes : greeting (L5) · applyTheme (L11) · geoOk (L20) · savePos (L21) · startWatch (L27) · locateMe (L33) · autoLocateOnMap (L52) · center (L56) · sharePlace (L68) · cardHtml (L78) · carousel (L87) · placeSub (L88) · dailyPick (L91) · h (L93) · qi (L103) · renderHome (L106) · section (L147) · renderSearch (L190) · match (L191) · openPanel (L200) · openListPanel (L207) · openNear (L211) · pickPool (L221) · openPicker (L232) · toggle (L235) · drawPick (L244) · choose (L248) · show (L249) · openSettings (L264) · backup (L316) · restore (L325) · deleteAccount (L335) · SB (L418) · sbHead (L419) · ghHead (L424) · b64 (L425) · unb64 (L426) · checkToken (L428) · isOwner (L439) · ownerCode (L440) · shareApp (L446) · shareFix (L458) · publishFix (L464) · canPublish (L486) · publishPlace (L487) · avisHead (L528) · loadAvis (L529) · avisFor (L542) · ago (L543) · avisBlock (L547) · openInstagram (L594) · onHide (L598) · openNeed (L613) · cleanNeed (L624) · showMe (L651) · osrm (L668) · trafic (L682) · fmtMin (L693) · goLinks (L695) · g (L697) (+ 10 autres)

### gate.js · 170 lignes
- Sections : L27 styles · L52 écran de verrouillage · L80 propriétaire · L97 inviter quelqu'un : un code à usage unique par personne · L155 démarrage
- Fonctions et classes : dev (L10) · head (L11) · rpc (L12) · adminKey (L17) · missing (L19) · localKeyOk (L20) · ownerMail (L22) · isOwner (L23) · allowed (L24) · esc (L25) · ov (L49) · q (L50) · lock (L54) · submit (L65) · unlock (L78) · ownerLogin (L81) · invite (L98) · draw (L120) · start (L156)

### home.css · 141 lignes

### home.js · 391 lignes
- Fonctions et classes : gfArr (L34) · gfCityNorm (L40) · gfCityOf (L41) · gfCities (L51) · gfHidden (L57) · gfShown (L58) · gfVisible (L59) · gfSetHidden (L60) · gfCity (L67) · gfCitiesPanel (L68) · n (L70) · gfIsPrec (L76) · gfZone (L77) · gfSign (L103) · gfCord (L110) · gfMoment (L117) · gfCuis (L118) · gfOutOf (L119) · gfGroup (L120) · gfPool (L121) · gfSorties (L123) · gfInst (L126) · gfZones (L127) · gfZkeys (L128) · gfGoodPhoto (L135) · gfPhoto (L136) · gfBg (L137) · gfCount (L138) · gfWish (L140) · gfTownTag (L164) · gfCard (L170) · gfGrouped (L177) · gfDark (L184) · gfHero (L185) · n (L188) · gfNear (L201) · gfNearSec (L206) · gfOpenNear (L212) · go (L213) · gfHomeBody (L219) · gfListBody (L250) · head (L252) · gfBody (L304) · gfOpenZone (L316) · gfOpen (L325) · gfRoute (L331)

### index.html · 230 lignes
- Repères HTML : #view-accueil (L50) · #view-paris (L55) · #view-carte (L72) · #view-precieuses (L93) · #view-villes (L105) · #view-ajouter (L110) · #aiForm (L123) · #placeForm (L154)
- Bibliothèques : vendor/leaflet/leaflet.css, vendor/markercluster/MarkerCluster.css, vendor/markercluster/MarkerCluster.Default.css, style.css, home.css, plus.css, native.js, gate.js, vendor/supabase.js, account.js, plus.js, app.js, extras.js, home.js, social.js

### ios/App/App/AppDelegate.swift · 54 lignes
- Fonctions et classes : class AppDelegate (L5) · AppDelegate (L5) · application (L9) · applicationWillResignActive (L14) · applicationDidEnterBackground (L19) · applicationWillEnterForeground (L24) · applicationDidBecomeActive (L28) · applicationWillTerminate (L32) · application (L37) · application (L41) · application (L45)

### ios/App/App/SceneDelegate.swift · 25 lignes
- Fonctions et classes : class SceneDelegate (L4) · SceneDelegate (L4) · scene (L7) · scene (L17) · scene (L21)

### ios/App/App/public/account.js · 153 lignes
- Sections : L17 envoi des modifications (avec file d'attente hors ligne) · L48 fichiers (photos) · L59 écran de connexion
- Fonctions et classes : okey (L14) · esc (L15) · push (L19) · flush (L24) · pullAll (L37) · pending (L45) · syncedKey (L46) · fpath (L49) · putBlob (L50) · getBlob (L51) · delBlob (L52) · listBlobs (L53) · login (L72) · start (L113) · signOut (L119) · deleteAccount (L124) · go (L149)

### ios/App/App/public/app.js · 1 369 lignes
- Sections : L6 Stockage local (sur le téléphone) · L19 Outils · L46 Données · L97 Listes · L135 Distances · L290 Fiche · L661 Navigation · L746 Carte · L925 Ajout · L953 Lecture par l'IA (Claude) · L1234 Compléter une nouvelle fiche · L1304 Démarrage
- Repères HTML : #arr-${arr} (L182) · #editInfo (L441) · #classForm (L484)
- Fonctions et classes : $ (L3) · $$ (L4) · esc (L20) · norm (L21) · arrLabel (L22) · arrHtml (L23) · street (L24) · uid (L26) · catKey (L39) · catVar (L44) · euros (L59) · rebuild (L61) · setEdit (L89) · filtered (L98) · checkBtn (L116) · thumbHtml (L120) · rowHtml (L125) · distM (L136) · fmtDist (L141) · walkMin (L142) · distLabel (L143) · groupBy (L145) · renderChips (L151) · renderParis (L159) · renderArrStrip (L200) · cell (L203) · precCat (L223) · universeOf (L225) · renderPrec (L227) · renderVilles (L253) · renderPending (L275) · renderAll (L283) · icon (L304) · igHandle (L308) · linkFor (L312) · q (L314) · openSheet (L337) · nearbyHtml (L468) · infoRow (L477) · classifyForm (L481) · opt (L483) · editField (L507) · closeSheet (L510) · mobile (L520) · toggleTested (L638) · headerBottom (L653) · toast (L656) · show (L670) · setDiet (L724) · setPrice (L730) · i (L738) · setMapTop (L750) · loadMapLibs (L755) · add (L758) · initMap (L765) · useBase (L781) · initTraficLayer (L818) · fillMapCats (L835) · markerFor (L842) · refreshMarkers (L849) (+ 31 autres)

### ios/App/App/public/cordova.js · 1 lignes

### ios/App/App/public/cordova_plugins.js · 1 lignes

### ios/App/App/public/extras.js · 828 lignes
- Sections : L10 Thème · L14 Position · L53 Partager · L63 Petites cartes · L91 Accueil · L185 Panneaux (dans la fiche) · L204 Au hasard · L249 Réglages · L330 Clics · L397 Liste partagée · L505 Avis des amis · L572 Liens manquants : les ajouter soi-même · L629 Ma position et itinéraire sur la carte · L784 Adresses publiées depuis l'appli (base Supabase) · L812 Compte : récupère ce qui a été fait sur un autre appareil
- Repères HTML : #avisForm (L537) · #needForm (L598)
- Fonctions et classes : greeting (L5) · applyTheme (L11) · startWatch (L20) · locateMe (L27) · sharePlace (L54) · cardHtml (L64) · carousel (L73) · placeSub (L74) · dailyPick (L77) · h (L79) · qi (L89) · renderHome (L92) · section (L133) · renderSearch (L176) · match (L177) · openPanel (L186) · openListPanel (L193) · openNear (L197) · pickPool (L207) · openPicker (L218) · toggle (L221) · drawPick (L230) · choose (L234) · show (L235) · openSettings (L250) · backup (L297) · restore (L306) · deleteAccount (L316) · SB (L398) · sbHead (L399) · ghHead (L404) · b64 (L405) · unb64 (L406) · checkToken (L408) · isOwner (L419) · ownerCode (L420) · shareApp (L426) · shareFix (L438) · publishFix (L444) · canPublish (L466) · publishPlace (L467) · avisHead (L508) · loadAvis (L509) · avisFor (L522) · ago (L523) · avisBlock (L527) · openInstagram (L574) · onHide (L578) · openNeed (L593) · cleanNeed (L604) · showMe (L631) · osrm (L648) · trafic (L662) · fmtMin (L673) · goLinks (L675) · g (L677) · apple (L678) · drawRoute (L687) · rushNote (L708) · renderRouteCard (L720) (+ 6 autres)

### ios/App/App/public/gate.js · 170 lignes
- Sections : L27 styles · L52 écran de verrouillage · L80 propriétaire · L97 inviter quelqu'un : un code à usage unique par personne · L155 démarrage
- Fonctions et classes : dev (L10) · head (L11) · rpc (L12) · adminKey (L17) · missing (L19) · localKeyOk (L20) · ownerMail (L22) · isOwner (L23) · allowed (L24) · esc (L25) · ov (L49) · q (L50) · lock (L54) · submit (L65) · unlock (L78) · ownerLogin (L81) · invite (L98) · draw (L120) · start (L156)

### ios/App/App/public/home.css · 134 lignes

### ios/App/App/public/home.js · 310 lignes
- Fonctions et classes : gfArr (L34) · gfCityOf (L35) · gfIsPrec (L36) · gfZone (L37) · gfSign (L51) · gfCord (L58) · gfCuis (L62) · gfOutOf (L63) · gfGroup (L64) · gfPool (L65) · gfSorties (L67) · gfInst (L69) · gfZones (L70) · gfZkeys (L71) · gfGoodPhoto (L78) · gfPhoto (L79) · gfBg (L80) · gfCount (L81) · gfWish (L83) · gfCard (L106) · gfGrouped (L113) · gfDark (L120) · gfHero (L121) · n (L124) · gfNear (L137) · gfNearSec (L142) · gfOpenNear (L148) · go (L149) · gfHomeBody (L155) · gfListBody (L183) · head (L185) · gfBody (L236) · gfOpenZone (L248) · gfOpen (L257) · gfRoute (L263)

### ios/App/App/public/index.html · 230 lignes
- Repères HTML : #view-accueil (L50) · #view-paris (L55) · #view-carte (L72) · #view-precieuses (L93) · #view-villes (L105) · #view-ajouter (L110) · #aiForm (L123) · #placeForm (L154)
- Bibliothèques : vendor/leaflet/leaflet.css, vendor/markercluster/MarkerCluster.css, vendor/markercluster/MarkerCluster.Default.css, style.css, home.css, plus.css, native.js, gate.js, vendor/supabase.js, account.js, plus.js, app.js, extras.js, home.js, social.js

### ios/App/App/public/native.js · 119 lignes
- Sections : L19 liste et plan à jour depuis le site, copie de l'appli en secours · L31 partage : Android n'a pas navigator.share dans la WebView · L38 bouton retour d'Android : ferme d'abord la fiche ou le panneau ouvert · L50 barre d'état assortie au thème · L60 notifications
- Fonctions et classes : plugin (L16) · syncBar (L52) · pushState (L64) · savePush (L65) · sendToken (L67) · enablePush (L89) · afterLogin (L106)

### ios/App/App/public/plus.css · 93 lignes

### ios/App/App/public/plus.js · 221 lignes
- Sections : L6 Horaires · L58 Fermé définitivement · L66 Collections perso · L152 Événements
- Repères HTML : #collNew (L80)
- Fonctions et classes : ohMin (L9) · ohSpans (L10) · ohFmt (L12) · ohDayTxt (L13) · hasOh (L14) · openState (L17) · ohLine (L34) · ohRow (L41) · ohTag (L52) · closedBanner (L59) · colls (L68) · saveColls (L69) · collOf (L70) · collLine (L71) · collPickHtml (L77) · collRail (L83) · listsBody (L90) · collBody (L112) · b64e (L127) · b64d (L128) · shareColl (L129) · collFromLink (L139)

### ios/App/App/public/social.js · 225 lignes
- Sections : L16 chargement · L37 ajout des adresses des gens suivis à la liste · L58 ce que je partage · L85 actions · L113 affichage · L127 carte : défiler les amis et voir leurs adresses en plus des miennes · L180 clics · L205 démarrage
- Fonctions et classes : meId (L10) · h (L11) · nameOf (L12) · accepted (L13) · requests (L14) · load (L17) · fromCache (L33) · decorate (L38) · match (L51) · publish (L61) · doPublish (L62) · handleOk (L86) · toHandle (L87) · setHandle (L88) · follow (L94) · answer (L103) · unfollow (L108) · removeFollower (L109) · refresh (L111) · barHtml (L114) · chip (L116) · renderBars (L119) · extras (L129) · mapBarHtml (L130) · chip (L132) · renderMapBar (L135) · mapMatch (L142) · sheetHtml (L143) · settingsHtml (L151)

### ios/App/App/public/style.css · 879 lignes
- Sections : L389 v2 : lignes avec coche, bande d'arrondissements, univers · L502 v3 : fiche détaillée · L592 v5 : accueil, vignettes, envies, panneaux

### ios/App/CapApp-SPM/Package.swift · 36 lignes

### ios/App/CapApp-SPM/README.md · 6 lignes
- Titres : L1 # CapApp-SPM

### ios/App/CapApp-SPM/Sources/CapApp-SPM/CapApp-SPM.swift · 2 lignes

### native.js · 119 lignes
- Sections : L19 liste et plan à jour depuis le site, copie de l'appli en secours · L31 partage : Android n'a pas navigator.share dans la WebView · L38 bouton retour d'Android : ferme d'abord la fiche ou le panneau ouvert · L50 barre d'état assortie au thème · L60 notifications
- Fonctions et classes : plugin (L16) · syncBar (L52) · pushState (L64) · savePush (L65) · sendToken (L67) · enablePush (L89) · afterLogin (L106)

### package.json · 26 lignes

### plus.css · 93 lignes

### plus.js · 221 lignes
- Sections : L6 Horaires · L58 Fermé définitivement · L66 Collections perso · L152 Événements
- Repères HTML : #collNew (L80)
- Fonctions et classes : ohMin (L9) · ohSpans (L10) · ohFmt (L12) · ohDayTxt (L13) · hasOh (L14) · openState (L17) · ohLine (L34) · ohRow (L41) · ohTag (L52) · closedBanner (L59) · colls (L68) · saveColls (L69) · collOf (L70) · collLine (L71) · collPickHtml (L77) · collRail (L83) · listsBody (L90) · collBody (L112) · b64e (L127) · b64d (L128) · shareColl (L129) · collFromLink (L139)

### proto/index.html · 304 lignes
- Repères HTML : #hero (L135) · #main (L136) · #nav (L137)
- Fonctions et classes : NORM (L164) · wishSearch (L184) · $ (L202) · esc (L203) · arrH (L204) · cityOf (L205) · isPrec (L206) · zoneOf (L207) · sign (L212) · zkeysOf (L217) · cuisOf (L219) · outOf (L220) · grpOf (L221) · pool (L222) · photoOf (L223) · bg (L224) · renderHero (L225) · n (L229) · card (L236) · zones (L237) · renderHome (L238) · grouped (L259) · renderList (L261) · renderNav (L276) · render (L278) · open (L279)

### scripts/apply_galerie.py · 30 lignes

### scripts/build_data.py · 137 lignes
- Fonctions et classes : slug (L21) · parse (L26) · main (L62) · supabase_ajouts (L117)

### scripts/build_www.mjs · 34 lignes
- Bibliothèques : node:fs, node:path, node:url, native.js

### scripts/check_links.mjs · 108 lignes
- Fonctions et classes : norm (L9) · matches (L11) · get (L13) · widget (L26) · check (L67)
- Bibliothèques : node:fs/promises

### scripts/city_photos.mjs · 39 lignes
- Fonctions et classes : api (L11)
- Bibliothèques : node:fs/promises

### scripts/enrich.mjs · 170 lignes
- Fonctions et classes : siteOf (L11) · get (L19) · decode (L29) · ogImage (L31) · anyImage (L42) · textOf (L63) · phone (L68) · booking (L89) · subpage (L109) · instagram (L120) · worker (L141)
- Bibliothèques : node:fs/promises

### scripts/fill_ai.mjs · 307 lignes
- Fonctions et classes : missing (L14) · get (L16) · isUrl (L29) · ask (L33) · apply (L64) · html (L94) · ogImage (L103) · pageImages (L112) · okImage (L127) · norm (L134) · wikiPhoto (L135) · siteOf (L155) · picKey (L156)
- Bibliothèques : node:fs/promises

### scripts/geocode.mjs · 76 lignes
- Fonctions et classes : abroad (L13) · geocodeWorld (L14) · simple (L31) · geocodePlace (L32) · geocode (L47) · named (L67)
- Bibliothèques : node:fs/promises

### scripts/google_places.mjs · 68 lignes
- Fonctions et classes : search (L16) · photoUri (L30)
- Bibliothèques : node:fs/promises

### scripts/hours.mjs · 70 lignes
- Fonctions et classes : age (L15) · ask (L24)
- Utilise : scripts/oh.mjs
- Bibliothèques : node:fs/promises

### scripts/make_app_assets.mjs · 22 lignes
- Bibliothèques : sharp, node:fs, node:url, node:path

### scripts/make_icons.py · 24 lignes
- Fonctions et classes : icon (L8)

### scripts/menus_photos.mjs · 452 lignes
- Sections : L77 menu · L170 photos · L250 lieux · L324 recherche web (SEARCH=1)
- Fonctions et classes : sleep (L14) · norm (L15) · decode (L17) · text (L18) · get (L20) · fetchPage (L28) · getBrowser (L40) · renderPage (L47) · thin (L66) · page (L67) · menuScore (L84) · anchors (L90) · slug (L108) · cityOf (L109) · otherCity (L110) · rankMenu (L115) · findMenu (L134) · bestFromSrcset (L173) · images (L180) · add (L182) · key (L203) · display (L212) · probe (L225) · ham (L248) · siteOf (L251) · shared (L259) · work (L266) · searchLinks (L327) · wait (L328) · aboutPlace (L340) · searchPhotos (L354) · workSearch (L383) · keep (L396) · save (L424)
- Bibliothèques : node:fs/promises, node:child_process, node:crypto, playwright

### scripts/oh.mjs · 69 lignes
- Fonctions et classes : days (L8) · spans (L18) · pad (L23) · parseOsmHours (L30) · cleanWeek (L57)
- Utilisé par : scripts/hours.mjs, scripts/osm.mjs

### scripts/osm.mjs · 75 lignes
- Fonctions et classes : norm (L25) · dist (L27) · frPhone (L35) · osmPhoto (L44)
- Utilise : scripts/oh.mjs
- Bibliothèques : node:fs/promises

### scripts/photo_candidates.mjs · 120 lignes
- Fonctions et classes : sleep (L12) · norm (L13) · get (L17) · html (L25) · results (L30) · meta (L43) · ogImage (L48) · thumb (L51) · where (L67)
- Bibliothèques : node:fs/promises, node:child_process

### scripts/search.mjs · 92 lignes
- Fonctions et classes : norm (L11) · sleep (L16) · get (L17) · results (L29) · handleOf (L43) · close (L48)
- Bibliothèques : node:fs/promises

### social.js · 225 lignes
- Sections : L16 chargement · L37 ajout des adresses des gens suivis à la liste · L58 ce que je partage · L85 actions · L113 affichage · L127 carte : défiler les amis et voir leurs adresses en plus des miennes · L180 clics · L205 démarrage
- Fonctions et classes : meId (L10) · h (L11) · nameOf (L12) · accepted (L13) · requests (L14) · load (L17) · fromCache (L33) · decorate (L38) · match (L51) · publish (L61) · doPublish (L62) · handleOk (L86) · toHandle (L87) · setHandle (L88) · follow (L94) · answer (L103) · unfollow (L108) · removeFollower (L109) · refresh (L111) · barHtml (L114) · chip (L116) · renderBars (L119) · extras (L129) · mapBarHtml (L130) · chip (L132) · renderMapBar (L135) · mapMatch (L142) · sheetHtml (L143) · settingsHtml (L151)

### style.css · 893 lignes
- Sections : L401 v2 : lignes avec coche, bande d'arrondissements, univers · L514 v3 : fiche détaillée · L604 v5 : accueil, vignettes, envies, panneaux

### supabase/app-stores.sql · 68 lignes

### supabase/functions/ia/index.ts · 163 lignes
- Fonctions et classes : json (L11) · get (L14) · decode (L22) · meta (L26) · caption (L33) · gemini (L55) · claude (L84) · run (L122) · save (L131)

### supabase/functions/notifications/index.ts · 190 lignes
- Sections : L46 Web Push (RFC 8291 aes128gcm + VAPID RFC 8292), avec WebCrypto · L90 Clés privées au format PEM (fichier .p8 d'Apple, compte de service Google) · L98 iPhone : Apple Push Notification service (HTTP/2, jeton ES256 valable 1 h) · L121 Android : Firebase Cloud Messaging (API v1, jeton OAuth du compte de service) · L147 Fichier calendrier (.ics) : l'iPhone propose « Ajouter au calendrier »
- Fonctions et classes : rpc (L17) · envoyer (L25) · b64u (L48) · unb64u (L49) · cat (L50) · hkdf (L51) · generateVapid (L54) · encrypt (L59) · vapid (L75) · enc (L76) · sendPush (L83) · pemToDer (L91) · jwt (L92) · enc (L93) · apnsToken (L100) · sendApns (L106) · fcmToken (L123) · sendFcm (L134) · icsEsc (L148) · fold (L149) · calendrier (L150)

### supabase/functions/trafic/index.ts · 44 lignes
- Fonctions et classes : json (L10) · num (L12)

### supabase/social.sql · 76 lignes

### sw.js · 49 lignes
- Fonctions et classes : req (L32) · net (L33)

### www/account.js · 153 lignes
- Sections : L17 envoi des modifications (avec file d'attente hors ligne) · L48 fichiers (photos) · L59 écran de connexion
- Fonctions et classes : okey (L14) · esc (L15) · push (L19) · flush (L24) · pullAll (L37) · pending (L45) · syncedKey (L46) · fpath (L49) · putBlob (L50) · getBlob (L51) · delBlob (L52) · listBlobs (L53) · login (L72) · start (L113) · signOut (L119) · deleteAccount (L124) · go (L149)

### www/app.js · 1 369 lignes
- Sections : L6 Stockage local (sur le téléphone) · L19 Outils · L46 Données · L97 Listes · L135 Distances · L290 Fiche · L661 Navigation · L746 Carte · L925 Ajout · L953 Lecture par l'IA (Claude) · L1234 Compléter une nouvelle fiche · L1304 Démarrage
- Repères HTML : #arr-${arr} (L182) · #editInfo (L441) · #classForm (L484)
- Fonctions et classes : $ (L3) · $$ (L4) · esc (L20) · norm (L21) · arrLabel (L22) · arrHtml (L23) · street (L24) · uid (L26) · catKey (L39) · catVar (L44) · euros (L59) · rebuild (L61) · setEdit (L89) · filtered (L98) · checkBtn (L116) · thumbHtml (L120) · rowHtml (L125) · distM (L136) · fmtDist (L141) · walkMin (L142) · distLabel (L143) · groupBy (L145) · renderChips (L151) · renderParis (L159) · renderArrStrip (L200) · cell (L203) · precCat (L223) · universeOf (L225) · renderPrec (L227) · renderVilles (L253) · renderPending (L275) · renderAll (L283) · icon (L304) · igHandle (L308) · linkFor (L312) · q (L314) · openSheet (L337) · nearbyHtml (L468) · infoRow (L477) · classifyForm (L481) · opt (L483) · editField (L507) · closeSheet (L510) · mobile (L520) · toggleTested (L638) · headerBottom (L653) · toast (L656) · show (L670) · setDiet (L724) · setPrice (L730) · i (L738) · setMapTop (L750) · loadMapLibs (L755) · add (L758) · initMap (L765) · useBase (L781) · initTraficLayer (L818) · fillMapCats (L835) · markerFor (L842) · refreshMarkers (L849) (+ 31 autres)

### www/extras.js · 828 lignes
- Sections : L10 Thème · L14 Position · L53 Partager · L63 Petites cartes · L91 Accueil · L185 Panneaux (dans la fiche) · L204 Au hasard · L249 Réglages · L330 Clics · L397 Liste partagée · L505 Avis des amis · L572 Liens manquants : les ajouter soi-même · L629 Ma position et itinéraire sur la carte · L784 Adresses publiées depuis l'appli (base Supabase) · L812 Compte : récupère ce qui a été fait sur un autre appareil
- Repères HTML : #avisForm (L537) · #needForm (L598)
- Fonctions et classes : greeting (L5) · applyTheme (L11) · startWatch (L20) · locateMe (L27) · sharePlace (L54) · cardHtml (L64) · carousel (L73) · placeSub (L74) · dailyPick (L77) · h (L79) · qi (L89) · renderHome (L92) · section (L133) · renderSearch (L176) · match (L177) · openPanel (L186) · openListPanel (L193) · openNear (L197) · pickPool (L207) · openPicker (L218) · toggle (L221) · drawPick (L230) · choose (L234) · show (L235) · openSettings (L250) · backup (L297) · restore (L306) · deleteAccount (L316) · SB (L398) · sbHead (L399) · ghHead (L404) · b64 (L405) · unb64 (L406) · checkToken (L408) · isOwner (L419) · ownerCode (L420) · shareApp (L426) · shareFix (L438) · publishFix (L444) · canPublish (L466) · publishPlace (L467) · avisHead (L508) · loadAvis (L509) · avisFor (L522) · ago (L523) · avisBlock (L527) · openInstagram (L574) · onHide (L578) · openNeed (L593) · cleanNeed (L604) · showMe (L631) · osrm (L648) · trafic (L662) · fmtMin (L673) · goLinks (L675) · g (L677) · apple (L678) · drawRoute (L687) · rushNote (L708) · renderRouteCard (L720) (+ 6 autres)

### www/gate.js · 170 lignes
- Sections : L27 styles · L52 écran de verrouillage · L80 propriétaire · L97 inviter quelqu'un : un code à usage unique par personne · L155 démarrage
- Fonctions et classes : dev (L10) · head (L11) · rpc (L12) · adminKey (L17) · missing (L19) · localKeyOk (L20) · ownerMail (L22) · isOwner (L23) · allowed (L24) · esc (L25) · ov (L49) · q (L50) · lock (L54) · submit (L65) · unlock (L78) · ownerLogin (L81) · invite (L98) · draw (L120) · start (L156)

### www/home.css · 134 lignes

### www/home.js · 310 lignes
- Fonctions et classes : gfArr (L34) · gfCityOf (L35) · gfIsPrec (L36) · gfZone (L37) · gfSign (L51) · gfCord (L58) · gfCuis (L62) · gfOutOf (L63) · gfGroup (L64) · gfPool (L65) · gfSorties (L67) · gfInst (L69) · gfZones (L70) · gfZkeys (L71) · gfGoodPhoto (L78) · gfPhoto (L79) · gfBg (L80) · gfCount (L81) · gfWish (L83) · gfCard (L106) · gfGrouped (L113) · gfDark (L120) · gfHero (L121) · n (L124) · gfNear (L137) · gfNearSec (L142) · gfOpenNear (L148) · go (L149) · gfHomeBody (L155) · gfListBody (L183) · head (L185) · gfBody (L236) · gfOpenZone (L248) · gfOpen (L257) · gfRoute (L263)

### www/index.html · 230 lignes
- Repères HTML : #view-accueil (L50) · #view-paris (L55) · #view-carte (L72) · #view-precieuses (L93) · #view-villes (L105) · #view-ajouter (L110) · #aiForm (L123) · #placeForm (L154)
- Bibliothèques : vendor/leaflet/leaflet.css, vendor/markercluster/MarkerCluster.css, vendor/markercluster/MarkerCluster.Default.css, style.css, home.css, plus.css, native.js, gate.js, vendor/supabase.js, account.js, plus.js, app.js, extras.js, home.js, social.js

### www/native.js · 119 lignes
- Sections : L19 liste et plan à jour depuis le site, copie de l'appli en secours · L31 partage : Android n'a pas navigator.share dans la WebView · L38 bouton retour d'Android : ferme d'abord la fiche ou le panneau ouvert · L50 barre d'état assortie au thème · L60 notifications
- Fonctions et classes : plugin (L16) · syncBar (L52) · pushState (L64) · savePush (L65) · sendToken (L67) · enablePush (L89) · afterLogin (L106)

### www/plus.css · 93 lignes

### www/plus.js · 221 lignes
- Sections : L6 Horaires · L58 Fermé définitivement · L66 Collections perso · L152 Événements
- Repères HTML : #collNew (L80)
- Fonctions et classes : ohMin (L9) · ohSpans (L10) · ohFmt (L12) · ohDayTxt (L13) · hasOh (L14) · openState (L17) · ohLine (L34) · ohRow (L41) · ohTag (L52) · closedBanner (L59) · colls (L68) · saveColls (L69) · collOf (L70) · collLine (L71) · collPickHtml (L77) · collRail (L83) · listsBody (L90) · collBody (L112) · b64e (L127) · b64d (L128) · shareColl (L129) · collFromLink (L139)

### www/social.js · 225 lignes
- Sections : L16 chargement · L37 ajout des adresses des gens suivis à la liste · L58 ce que je partage · L85 actions · L113 affichage · L127 carte : défiler les amis et voir leurs adresses en plus des miennes · L180 clics · L205 démarrage
- Fonctions et classes : meId (L10) · h (L11) · nameOf (L12) · accepted (L13) · requests (L14) · load (L17) · fromCache (L33) · decorate (L38) · match (L51) · publish (L61) · doPublish (L62) · handleOk (L86) · toHandle (L87) · setHandle (L88) · follow (L94) · answer (L103) · unfollow (L108) · removeFollower (L109) · refresh (L111) · barHtml (L114) · chip (L116) · renderBars (L119) · extras (L129) · mapBarHtml (L130) · chip (L132) · renderMapBar (L135) · mapMatch (L142) · sheetHtml (L143) · settingsHtml (L151)

### www/style.css · 879 lignes
- Sections : L389 v2 : lignes avec coche, bande d'arrondissements, univers · L502 v3 : fiche détaillée · L592 v5 : accueil, vignettes, envies, panneaux
