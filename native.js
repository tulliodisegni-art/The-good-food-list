/* Appli iPhone / Android (Capacitor) : ce fichier ne fait rien dans Safari ou Chrome.
   Dans l'appli installée depuis l'App Store ou Google Play, il :
   - va chercher la liste à jour (data/…) et le plan de Paris (tiles/…) sur le site, avec la copie livrée dans l'appli en secours ;
   - active les notifications (demandes d'abonnement, nouvelles adresses des amis) ;
   - gère le bouton retour d'Android, le partage et la barre d'état.
   Chargé en premier, avant gate.js. */
(function () {
  const Cap = window.Capacitor;
  const native = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  window.GF_NATIVE = native;
  if (!native) return;

  const platform = Cap.getPlatform(); // "ios" ou "android"
  const SITE = "https://tulliodisegni-art.github.io/The-good-food-list/";
  const CFG = window.GF_NATIVE_CFG || {}; // écrit par scripts/build_www.mjs (ex. { fcm: true } quand Firebase est configuré)
  const plugin = (n) => (Cap.Plugins && Cap.Plugins[n]) || (Cap.registerPlugin ? Cap.registerPlugin(n) : null);
  document.documentElement.classList.add("native", "native-" + platform);

  /* ---------- liste et plan à jour depuis le site, copie de l'appli en secours ---------- */
  const realFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : input && input.url;
    const rel = url && /^(\.\/)?(data|tiles)\//.test(url) ? url.replace(/^\.\//, "") : null;
    if (!rel) return realFetch(input, init);
    const opts = Object.assign({}, init); delete opts.cache; // « no-cache » gêne certaines WebView
    return realFetch(SITE + rel + (rel.startsWith("data/") ? (rel.includes("?") ? "&" : "?") + "t=" + Date.now() : ""), opts)
      .then((r) => (r.ok || r.status === 206 ? r : Promise.reject(new Error("HTTP " + r.status))))
      .catch(() => realFetch(input, init));
  };

  /* ---------- partage : Android n'a pas navigator.share dans la WebView ---------- */
  const Share = plugin("Share");
  if (Share) {
    navigator.share = (d) => Share.share({ title: d && d.title, text: d && d.text, url: d && d.url, dialogTitle: "Partager" })
      .catch((e) => { const err = new Error(String((e && e.message) || e)); if (/cancel/i.test(err.message)) err.name = "AbortError"; throw err; });
  }

  /* ---------- bouton retour d'Android : ferme d'abord la fiche ou le panneau ouvert ---------- */
  const App = plugin("App");
  if (App && platform === "android") {
    App.addListener("backButton", (ev) => {
      const ov = document.querySelector(".gt-ov.light"); // fenêtre du propriétaire (pas l'écran du code d'invitation)
      if (ov) { ov.remove(); return; }
      const sheet = document.getElementById("sheet");
      if (sheet && !sheet.hidden) { (document.getElementById("backdrop") || sheet).click(); return; }
      if (ev && ev.canGoBack) history.back(); else App.exitApp();
    });
  }

  /* ---------- barre d'état assortie au thème ---------- */
  const Bar = plugin("StatusBar");
  const syncBar = () => {
    if (!Bar) return;
    const dark = document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
    Bar.setStyle({ style: dark ? "DARK" : "LIGHT" }).catch(() => {});
  };
  syncBar(); matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", syncBar);
  new MutationObserver(syncBar).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  /* ---------- notifications ---------- */
  const Push = plugin("PushNotifications");
  const pushReady = Push && (platform === "ios" || CFG.fcm === true); // Android : il faut le fichier google-services.json (Firebase)
  const LSK = "gfl.push";
  const pushState = () => { try { return JSON.parse(localStorage.getItem(LSK) || "{}"); } catch (e) { return {}; } };
  const savePush = (o) => { try { localStorage.setItem(LSK, JSON.stringify(Object.assign(pushState(), o))); } catch (e) {} };

  async function sendToken(token) {
    const acc = window.Account;
    if (!acc || !acc.user || !acc.sb) return;
    const { error } = await acc.sb.rpc("push_register", {
      p_app: "goodfood", p_endpoint: platform + ":" + token,
      p_sub: { type: platform === "ios" ? "apns" : "fcm", token }, p_prefs: {}, p_appareil: platform === "ios" ? "iPhone" : "Android",
    });
    if (!error) savePush({ token, user: acc.user.id });
  }
  if (pushReady) {
    Push.addListener("registration", (t) => { sendToken(t.value).catch(() => {}); });
    Push.addListener("registrationError", (e) => { console.log("notifications indisponibles", e && e.error); });
    // Touché une notification : on ouvre l'endroit indiqué (ex. « #envies »)
    Push.addListener("pushNotificationActionPerformed", (a) => {
      const d = (a && a.notification && a.notification.data) || {};
      const url = d.url || "";
      if (url.startsWith("#")) location.hash = url.slice(1);
      else if (/^\.?\/?\?/.test(url)) location.href = "index.html" + url.replace(/^\.?\/?/, "");
      if (d.kind === "social" && typeof window.openSettings === "function") setTimeout(() => window.openSettings(), 400);
    });
  }

  async function enablePush(ask) {
    if (!pushReady) return "indisponible";
    let p = await Push.checkPermissions();
    if (p.receive === "prompt" || p.receive === "prompt-with-rationale") { if (!ask) return "a-demander"; p = await Push.requestPermissions(); }
    if (p.receive !== "granted") return "refusee";
    await Push.register();
    return "ok";
  }
  window.GFPush = {
    available: !!pushReady,
    enable: () => enablePush(true),
    status: async () => (pushReady ? (await Push.checkPermissions()).receive : "indisponible"),
    test: async () => { const acc = window.Account; if (acc && acc.sb) await acc.sb.rpc("push_test", { p_app: "goodfood", p_title: "Cozy Spots", p_body: "Les notifications marchent." }); },
    forget: async () => { const s = pushState(); if (s.token && window.Account && window.Account.sb) { try { await window.Account.sb.from("push_subs").delete().eq("endpoint", platform + ":" + s.token); } catch (e) {} } savePush({ token: null }); },
  };

  // Une fois connecté : on réenregistre le téléphone (le jeton peut changer), et on propose les notifications une seule fois.
  const afterLogin = () => {
    const acc = window.Account;
    if (!acc || !acc.ready) return;
    acc.ready.then((u) => {
      if (!u || !pushReady) return;
      setTimeout(() => {
        const s = pushState();
        enablePush(!s.asked).then(() => savePush({ asked: true })).catch(() => {});
      }, 2500);
    });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", afterLogin); else afterLogin();
})();
