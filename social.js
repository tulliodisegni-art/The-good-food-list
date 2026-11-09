/* Good Food : suivre des gens (sur demande, à accepter) et voir leurs adresses.
   Chacun a un pseudo. Ce qui est partagé avec ses abonnés : les adresses qu'on a ajoutées, et pour les autres
   « testé » et la note en étoiles. Les commentaires et les envies restent privés ; une adresse peut être cachée.
   Tout nouveau membre suit Tullio d'office (sa liste est la base de l'appli). Tables : supabase/social.sql. */
(function () {
  const Acc = window.Account;
  if (!Acc) return;
  const sb = Acc.sb;
  const SO = { me: null, profiles: new Map(), follows: [], rows: [], ownerId: null, who: "", ready: false };
  const meId = () => (Acc.user ? Acc.user.id : null);
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const nameOf = (uid) => { const p = SO.profiles.get(uid); return p ? (p.name || "@" + p.handle) : "?"; };
  const accepted = () => SO.follows.filter((f) => f.follower === meId() && f.status === "accepted").map((f) => f.followee);
  const requests = () => SO.follows.filter((f) => f.followee === meId() && f.status === "pending");

  /* ---------- chargement ---------- */
  async function load() {
    await Acc.ready; const me = meId(); if (!me) return;
    const [{ data: mine }, { data: fol }] = await Promise.all([
      sb.from("gf_profiles").select("*").eq("user_id", me).maybeSingle(),
      sb.from("gf_follows").select("*").or(`follower.eq.${me},followee.eq.${me}`),
    ]);
    SO.me = mine || null; SO.follows = fol || [];
    const ids = new Set(SO.follows.flatMap((f) => [f.follower, f.followee]));
    const { data: profs } = await sb.from("gf_profiles").select("user_id,handle,name,is_owner").or(`is_owner.eq.true${ids.size ? `,user_id.in.(${[...ids].join(",")})` : ""}`);
    SO.profiles = new Map((profs || []).map((p) => [p.user_id, p])); if (SO.me) SO.profiles.set(me, SO.me);
    SO.ownerId = (profs || []).find((p) => p.is_owner)?.user_id || null;
    const fids = accepted();
    if (fids.length) { const { data: rows } = await sb.from("gf_shared").select("owner,id,data").in("owner", fids); SO.rows = rows || []; } else SO.rows = [];
    try { localStorage.setItem("gfl.socialCache", JSON.stringify({ follows: SO.follows, profiles: [...SO.profiles.values()], rows: SO.rows, ownerId: SO.ownerId, me: SO.me })); } catch (e) {}
    SO.ready = true;
  }
  function fromCache() {
    try { const c = JSON.parse(localStorage.getItem("gfl.socialCache") || "null"); if (!c) return; SO.follows = c.follows || []; SO.profiles = new Map((c.profiles || []).map((p) => [p.user_id, p])); SO.rows = c.rows || []; SO.ownerId = c.ownerId; SO.me = c.me; } catch (e) {}
  }

  /* ---------- ajout des adresses des gens suivis à la liste ---------- */
  function decorate(places) {
    SO.baseIds = new Set(S.base.map((p) => p.id));
    const by = new Map(places.map((p) => [p.id, p]));
    // « à moi » = ce que j'ai fait moi-même (pas les ✅ hérités de la liste de base)
    const custom = new Set(store.get("custom", []).map((p) => p.id)), ed = store.get("edits", {});
    for (const p of places) { const e = ed[p.id] || {}; p.mine = custom.has(p.id) || !!e.tested || !!e.rating || !!e.want; p.friends = []; }
    for (const r of SO.rows) {
      if (r.owner === meId() || !r.data) continue;
      let p = by.get(r.id);
      if (!p && r.data.place && r.data.place.name) { p = { ...r.data.place, id: r.id, fromFriend: r.owner, tested: false, rating: 0, want: false, mine: false, friends: [] }; places.push(p); by.set(r.id, p); }
      if (p) p.friends.push({ uid: r.owner, tested: !!r.data.tested, rating: r.data.rating || 0, added: !!r.data.place });
    }
  }
  function match(p) {
    const w = SO.who; if (!w) return true;
    if (w === "me") return !!p.mine && !p.fromFriend;
    if ((p.friends || []).some((f) => f.uid === w)) return true;
    return w === SO.ownerId && !p.fromFriend && !p.custom && !p.friendsOnly && SO.baseIds && SO.baseIds.has(p.id);
  }

  /* ---------- ce que je partage ---------- */
  const STRIP = ["comment", "want", "hidden", "friends", "fromFriend", "mine", "tested", "rating"];
  let pubT = null;
  function publish() { clearTimeout(pubT); pubT = setTimeout(doPublish, 1500); }
  async function doPublish() {
    const me = meId(); if (!me || !SO.me) return;
    const custom = new Map(store.get("custom", []).map((p) => [p.id, p]));
    const out = {};
    const ed = store.get("edits", {});
    for (const p of S.places) {
      if (p.fromFriend || p.hidden) continue;
      const isCustom = custom.has(p.id), e = isCustom ? custom.get(p.id) : (ed[p.id] || {});
      if (!isCustom && !e.tested && !e.rating) continue;
      const d = { tested: !!e.tested, rating: e.rating || 0 };
      if (isCustom) { const c = { ...custom.get(p.id) }; for (const k of STRIP) delete c[k]; d.place = c; }
      out[p.id] = d;
    }
    let prev = {}; try { prev = JSON.parse(localStorage.getItem("gfl.socialPushed." + me) || "{}"); } catch (e) {}
    const up = Object.entries(out).filter(([id, d]) => JSON.stringify(prev[id]) !== JSON.stringify(d)).map(([id, data]) => ({ owner: me, id, data, updated_at: new Date().toISOString() }));
    const del = Object.keys(prev).filter((id) => !out[id]);
    try {
      for (let i = 0; i < up.length; i += 200) { const r = await sb.from("gf_shared").upsert(up.slice(i, i + 200)); if (r.error) throw r.error; }
      if (del.length) { const r = await sb.from("gf_shared").delete().eq("owner", me).in("id", del); if (r.error) throw r.error; }
      localStorage.setItem("gfl.socialPushed." + me, JSON.stringify(out));
    } catch (e) { /* réessai au prochain changement */ }
  }

  /* ---------- actions ---------- */
  const handleOk = (x) => /^[a-z0-9._]{3,20}$/.test(x);
  const toHandle = (x) => String(x || "").trim().toLowerCase().replace(/^@/, "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9._]/g, "");
  async function setHandle(raw, name) {
    const handle = toHandle(raw); if (!handleOk(handle)) throw new Error("Pseudo : 3 à 20 lettres, chiffres, points ou _.");
    const r = SO.me ? await sb.from("gf_profiles").update({ handle, name: name || SO.me.name }).eq("user_id", meId()) : await sb.from("gf_profiles").insert({ handle, name: name || null });
    if (r.error) throw new Error(/duplicate|unique/i.test(r.error.message) ? "Ce pseudo est déjà pris." : "Impossible d'enregistrer le pseudo.");
    await load(); publish(); refresh();
  }
  async function follow(raw) {
    const handle = toHandle(raw); if (!handleOk(handle)) throw new Error("Pseudo invalide.");
    const { data: p } = await sb.from("gf_profiles").select("user_id,handle,name").eq("handle", handle).maybeSingle();
    if (!p) throw new Error("Personne avec ce pseudo.");
    if (p.user_id === meId()) throw new Error("C'est toi !");
    const r = await sb.from("gf_follows").insert({ follower: meId(), followee: p.user_id });
    if (r.error && !/duplicate/i.test(r.error.message)) throw new Error("Demande impossible.");
    await load(); refresh(); return p;
  }
  async function answer(follower, ok) {
    if (ok) await sb.from("gf_follows").update({ status: "accepted" }).eq("follower", follower).eq("followee", meId());
    else await sb.from("gf_follows").delete().eq("follower", follower).eq("followee", meId());
    await load(); refresh();
  }
  async function unfollow(uid) { await sb.from("gf_follows").delete().eq("follower", meId()).eq("followee", uid); if (SO.who === uid) SO.who = ""; await load(); refresh(); }
  async function removeFollower(uid) { await sb.from("gf_follows").delete().eq("follower", uid).eq("followee", meId()); await load(); refresh(); }

  function refresh() { if (!S.base.length) return; rebuild(); renderAll(); if (document.querySelector("[data-social]")) { const s = document.querySelector("[data-social]"); s.outerHTML = settingsHtml(); } }

  /* ---------- affichage ---------- */
  function barHtml() {
    const ids = accepted(); if (!ids.length) return "";
    const chip = (v, label) => `<button class="chip ${SO.who === v ? "on" : ""}" data-who="${h(v)}">${h(label)}</button>`;
    return chip("", "Tout le monde") + chip("me", "Moi") + ids.sort((a, b) => (b === SO.ownerId) - (a === SO.ownerId) || nameOf(a).localeCompare(nameOf(b))).map((u) => chip(u, nameOf(u))).join("");
  }
  function renderBars() {
    renderMapBar();
    for (const [anchor, id] of [["#chipsParis", "whoParis"], ["#univPrec", "whoPrec"]]) {
      const a = document.querySelector(anchor); if (!a) continue;
      let el = document.getElementById(id); if (!el) { el = document.createElement("div"); el.id = id; el.className = "chips who-bar"; el.setAttribute("aria-label", "Adresses de qui"); a.parentNode.insertBefore(el, a); }
      el.innerHTML = barHtml(); el.hidden = !el.innerHTML;
    }
  }
  /* ---------- carte : défiler les amis et voir leurs adresses en plus des miennes ---------- */
  SO.mapWho = "";
  const extras = (uid) => (S.places || []).filter((p) => p.fromFriend === uid && p.lat);
  function mapBarHtml() {
    const ids = accepted().filter((u) => u !== SO.ownerId); if (!ids.length) return "";
    const chip = (v, label, n) => `<button class="chip ${SO.mapWho === v ? "on" : ""}" data-map-who="${h(v)}">${h(label)}${n != null ? ` <small>${n}</small>` : ""}</button>`;
    return chip("", "Ma carte") + ids.sort((a, b) => nameOf(a).localeCompare(nameOf(b))).map((u) => chip(u, nameOf(u), extras(u).length)).join("");
  }
  function renderMapBar() {
    const ui = document.querySelector("#view-carte .map-ui"); if (!ui) return;
    let el = document.getElementById("mapWho");
    if (!el) { el = document.createElement("div"); el.id = "mapWho"; el.className = "map-who"; el.setAttribute("aria-label", "Carte de mes amis"); ui.appendChild(el); }
    el.innerHTML = mapBarHtml(); el.hidden = !el.innerHTML;
  }
  // Sur la carte, un ami choisi : seulement ses adresses que je n'ai pas.
  function mapMatch(p) { return SO.mapWho ? p.fromFriend === SO.mapWho : null; }
  function sheetHtml(p) {
    const fr = (p.friends || []).filter((f) => f.tested || f.rating || f.added);
    const mineLine = !p.fromFriend && (p.tested || p.rating || store.get("custom", []).some((c) => c.id === p.id))
      ? `<button class="btn ghost small" data-share-toggle="${h(p.id)}">${p.hidden ? "🔒 Caché à mes abonnés · montrer" : "👥 Visible par mes abonnés · cacher"}</button>` : "";
    if (!fr.length && !mineLine && !p.fromFriend) return "";
    const lines = fr.map((f) => `<li><b>${h(nameOf(f.uid))}</b> ${f.added ? "l'a ajoutée" : ""}${f.tested ? (f.added ? " · " : "") + "a testé" : ""}${f.rating ? ` · ${"★".repeat(f.rating)}` : ""}</li>`).join("");
    return `<div class="friends-box">${p.fromFriend ? `<p class="muted small">Adresse de <b>${h(nameOf(p.fromFriend))}</b>.</p>` : ""}${lines ? `<ul>${lines}</ul>` : ""}${mineLine}</div>`;
  }
  function settingsHtml() {
    const me = SO.me, req = requests(), ids = accepted();
    const pend = SO.follows.filter((f) => f.follower === meId() && f.status === "pending");
    const followers = SO.follows.filter((f) => f.followee === meId() && f.status === "accepted");
    const link = me ? `${location.origin}${location.pathname}?suivre=${encodeURIComponent(me.handle)}` : "";
    return `<section class="block" data-social><h3>Mes amis</h3>
      ${me ? `<p class="muted small">Ton pseudo : <b>@${h(me.handle)}</b>. Ceux qui te suivent voient les adresses que tu as ajoutées et celles que tu as testées, avec ta note. Tes commentaires et tes envies restent privés.</p>
        <div class="row-actions"><button class="btn primary" data-social-link="${h(link)}">Envoyer mon profil</button><button class="btn ghost" data-social-rename>Changer de pseudo</button></div>`
      : `<p class="muted small">Choisis un pseudo pour que tes amis puissent te suivre.</p><div class="row-actions"><button class="btn primary" data-social-rename>Choisir mon pseudo</button></div>`}
      ${req.length ? `<h4>Demandes reçues</h4><ul class="social-list">${req.map((f) => `<li><span>${h(nameOf(f.follower))}</span><span><button class="btn primary small" data-social-ok="${f.follower}">Accepter</button> <button class="btn ghost small" data-social-no="${f.follower}">Refuser</button></span></li>`).join("")}</ul>` : ""}
      <h4>Je suis</h4>
      <div class="row-actions"><input id="socialFollow" placeholder="Pseudo d'un ami (ex. karim)" autocapitalize="off" autocomplete="off" style="flex:1;min-width:0"><button class="btn" data-social-follow>Suivre</button></div>
      <ul class="social-list">${ids.map((u) => `<li><span>${h(nameOf(u))}</span>${u === SO.ownerId ? `<span class="muted small">liste de base</span>` : `<button class="btn ghost small" data-social-unfollow="${u}">Ne plus suivre</button>`}</li>`).join("")}
        ${pend.map((f) => `<li><span>${h(nameOf(f.followee))}</span><span class="muted small">demande envoyée · <button class="linkish" data-social-unfollow="${f.followee}">annuler</button></span></li>`).join("")}</ul>
      ${followers.length ? `<h4>Me suivent</h4><ul class="social-list">${followers.map((f) => `<li><span>${h(nameOf(f.follower))}</span><button class="btn ghost small" data-social-remove="${f.follower}">Retirer</button></li>`).join("")}</ul>` : ""}
    </section>`;
  }

  const css = `.who-bar{margin-bottom:4px}.who-bar[hidden]{display:none}
.friends-box{border:1px solid var(--line,#e5e5e5);border-radius:14px;padding:10px 12px;display:grid;gap:8px}
.friends-box ul{margin:0;padding-left:18px;display:grid;gap:3px;font-size:.92rem}
.social-list{list-style:none;margin:6px 0 0;padding:0;display:grid;gap:6px}
.social-list li{display:flex;justify-content:space-between;align-items:center;gap:8px;border:1px solid var(--line,#e5e5e5);border-radius:12px;padding:8px 10px}
.map-who{display:flex;gap:6px;overflow-x:auto;width:100%;padding:2px 0 4px;scrollbar-width:none;-webkit-overflow-scrolling:touch}.map-who::-webkit-scrollbar{display:none}
.map-who .chip{flex:none;box-shadow:var(--shadow);background:var(--surface,#fff);white-space:nowrap}.map-who .chip.on{background:var(--plaque,#1d3b78);color:#fff}.map-who .chip small{opacity:.7;font-weight:700}
[data-social] h4{margin:12px 0 4px;font-size:.9rem} .linkish{background:none;border:0;padding:0;color:inherit;text-decoration:underline;cursor:pointer;font:inherit}`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  /* ---------- clics ---------- */
  document.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-map-who],[data-who],[data-share-toggle],[data-social-rename],[data-social-follow],[data-social-ok],[data-social-no],[data-social-unfollow],[data-social-remove],[data-social-link]");
    if (!t) return;
    try {
      if (t.dataset.mapWho !== undefined) {
        SO.mapWho = t.dataset.mapWho; renderMapBar(); refreshMarkers();
        const pts = SO.mapWho ? extras(SO.mapWho) : [];
        if (pts.length && typeof map !== "undefined" && map) map.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lng])), { padding: [50, 50], maxZoom: 15 });
        else if (SO.mapWho) toast(`${nameOf(SO.mapWho)} n'a pas encore d'adresse en plus des tiennes`);
        return;
      }
      if (t.dataset.who !== undefined) { SO.who = t.dataset.who; rebuild(); renderAll(); return; }
      if (t.dataset.shareToggle) { const p = S.places.find((x) => x.id === t.dataset.shareToggle); setEdit(p.id, { hidden: !p.hidden }); publish(); renderAll(); openSheet(p.id, true); return; }
      if (t.hasAttribute("data-social-rename")) { const v = prompt("Ton pseudo (3 à 20 lettres ou chiffres)", SO.me ? SO.me.handle : toHandle(store.get("name", "") || (Acc.user.email || "").split("@")[0])); if (v) { await setHandle(v); toast("Pseudo enregistré"); } return; }
      if (t.hasAttribute("data-social-follow")) { const i = document.getElementById("socialFollow"); const p = await follow(i.value); toast(`Demande envoyée à ${p.name || "@" + p.handle}`); return; }
      if (t.dataset.socialOk) { await answer(t.dataset.socialOk, true); toast("Demande acceptée"); return; }
      if (t.dataset.socialNo) { await answer(t.dataset.socialNo, false); return; }
      if (t.dataset.socialUnfollow) { await unfollow(t.dataset.socialUnfollow); return; }
      if (t.dataset.socialRemove) { await removeFollower(t.dataset.socialRemove); return; }
      if (t.dataset.socialLink) { const url = t.dataset.socialLink, text = "Suis-moi sur The Good Food List pour voir mes adresses :"; try { if (navigator.share) { await navigator.share({ title: "Mon profil", text, url }); return; } } catch (x) { if (x && x.name === "AbortError") return; } try { await navigator.clipboard.writeText(text + " " + url); toast("Lien copié"); } catch (x) { prompt("Lien de ton profil", url); } return; }
    } catch (x) { toast(x.message || "Pas de connexion"); }
  });

  /* ---------- démarrage ---------- */
  fromCache();
  window.Social = { decorate, match, mapMatch, publish, renderBars, sheetHtml, settingsHtml, state: SO };
  (async () => {
    await Acc.ready;
    try { await load(); } catch (e) { return; }
    // première fois : choisir son pseudo
    if (!SO.me) {
      const sug = toHandle(store.get("name", "") || (Acc.user.email || "").split("@")[0]).slice(0, 20);
      const v = prompt("Choisis ton pseudo pour que tes amis puissent te suivre (lettres, chiffres, points)", handleOk(sug) ? sug : "");
      if (v) try { await setHandle(v); } catch (x) { toast(x.message); }
    }
    // lien de profil reçu : ?suivre=pseudo
    const q = new URLSearchParams(location.search).get("suivre");
    if (q) { try { history.replaceState(null, "", location.pathname + location.hash); } catch (x) {} if (confirm(`Demander à suivre @${toHandle(q)} ?`)) try { const p = await follow(q); toast(`Demande envoyée à ${p.name || "@" + p.handle}`); } catch (x) { toast(x.message); } }
    const n = requests().length; if (n) toast(n === 1 ? `${nameOf(requests()[0].follower)} veut te suivre : Réglages › Mes amis` : `${n} demandes d'amis : Réglages › Mes amis`);
    refresh(); publish();
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") load().then(refresh).catch(() => {}); });
  })();
})();
