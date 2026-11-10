// Accueil Cozy Spots : une ville à la fois (photo d'ambiance), plaques d'arrondissement ou de quartier,
// « Une envie ? » en texte libre, cuisines, régimes. Onglet Précieuses = même page en noir et or.
const GF = { city: store.get("gfCity", "paris"), prec: false, list: null };
const GF_CITIES = [
  { id: "paris", name: "Paris", kick: "Ce soir à Paris", zoneTitle: "Par arrondissement" },
  { id: "ny", name: "New York", kick: "Tonight in New York", zoneTitle: "Par quartier" },
  { id: "tlv", name: "Tel-Aviv", kick: "Ce soir à Tel-Aviv", zoneTitle: "Par quartier" },
  { id: "jer", name: "Jérusalem", kick: "Ce soir à Jérusalem", zoneTitle: "Par quartier" },
];
const GF_CREDIT = { paris: "Photo Terragio67, CC BY-SA 4.0", ny: "Photo King of Hearts, CC BY-SA 4.0", tlv: "Photo Shaulinb, CC BY-SA 3.0", jer: "Photo Radosław Botev, CC BY 3.0", nuit: "Photo Pierre Blaché, CC0" };
const GF_PAL = ["#1d3b78", "#2c7a4b", "#c23b3b", "#d0782a", "#7a4ea3", "#0f7c8a", "#a86a1f", "#b03a6f"];
const GF_OUT = { "Resto festif": "Restos festifs", "Soirée": "Soirées", "Rooftop": "Rooftops", "Boire un verre": "Bars", "Stand-up": "Stand-up", "Activité": "Activités", "Salon de thé": "Salons de thé", "Café": "Cafés", "À tester": "À tester" };
const GF_CONCEPTS = [
  { w: /chaleur|cosy|cocoon|convivial|reconfort|gourmand|genereu|copieu|comfort|familial|maison/, label: "chaleureux & gourmand", cat: /Français|Italien|Oriental|Burger|Coréen|Africain|Street|Libanais|Grec|Argentin|Polonais|Russe/, txt: /chaleur|famil|genereu|gourmand|reconfort|bistrot|maison|institution|copieu|cantine/ },
  { w: /leger|healthy|sain|frais|fraich|equilibr|veg/, label: "léger & frais", cat: /Japonais|Vegan|Poisson|Israélien|Brunch|Grec|Vietnam|Libanais/, txt: /frais|leger|vege|vegan|poisson|salade/ },
  { w: /romanti|date|amoureu|intime|intimiste|en couple|tete a tete/, label: "romantique", price: 3, txt: /date|romanti|intim|cadre|chic|amoureu|cache/ },
  { w: /chic|classe|gastro|etoile|exception|luxe|haut de gamme|occasion/, label: "chic", price: 4, prec: 1 },
  { w: /pas cher|petit prix|budget|econom|bon marche|abordable/, label: "petit prix", maxPrice: 1 },
  { w: /festi|fete|danse|ambiance|soiree|amis|ca bouge|bouge/, label: "festif", cat: /Soirée|festif|Bar|Tapas|Rooftop/, txt: /festi|dj|fete|ambiance/ },
  { w: /terrasse|dehors|soleil|rooftop|vue|exterieur|jardin|peniche|eau/, label: "terrasse & vue", cat: /Rooftop/, txt: /terrasse|rooftop|vue|peniche|jardin|seine|bord de l.eau|ile/ },
  { w: /rapide|sur le pouce|vite|emporter|street|sandwich/, label: "sur le pouce", cat: /Street|Burger|Sandwich|Deli/ },
  { w: /sucre|dessert|patiss|gateau|glace|cookie|gouter|donut/, label: "sucré", cat: /Pâtisserie|Glacier|Café|Salon de thé/, txt: /cookie|patiss|glace|dessert|donut|chou/ },
  { w: /brunch|petit.dej|matin/, label: "brunch", cat: /Brunch|Café/ },
  { w: /epice|spicy|piment|releve/, label: "épicé", cat: /Coréen|Thaï|Indien|Chinois|Mexicain|Sichuan/, txt: /epic|spicy|piment|mala/ },
  { w: /sushi|japon|ramen|udon|onigiri/, label: "japonais", cat: /Japonais/ }, { w: /pizza|pate|italie|burrata/, label: "italien", cat: /Italien/ },
  { w: /burger/, label: "burger", cat: /Burger/ }, { w: /coree|coreen|bibimbap/, label: "coréen", cat: /Coréen/ }, { w: /chin|ravioli|dumpling/, label: "chinois", cat: /Chinois/ },
  { w: /couscous|tajine|maroc|oriental/, label: "oriental", cat: /Oriental/ }, { w: /liban|houmous|hummus|falafel/, label: "libanais", cat: /Libanais|Israélien|Oriental/ },
  { w: /mexi|taco/, label: "mexicain", cat: /Mexicain/ }, { w: /indien|curry/, label: "indien", cat: /Indien/ }, { w: /thai/, label: "thaï", cat: /Thaï/ },
  { w: /francais|bistro|brasserie/, label: "français", cat: /Français/ }, { w: /viande|steak|grill|boeuf/, label: "viande", cat: /Steakhouse|Argentin|Viande/, txt: /viande|steak|boeuf|grill/ },
  { w: /poisson|fruits de mer|huitre/, label: "mer", cat: /Poisson/, txt: /poisson|mer|huitre/ }, { w: /cocktail|verre|bar\b/, label: "un verre", cat: /Bar|Boire un verre/ },
  { w: /kasher|casher|cacher/, label: "kasher", flag: "kasher" }, { w: /halal/, label: "halal", flag: "halal" },
];

const gfArr = (n) => (n === 1 ? "1<sup>er</sup>" : `${n}<sup>e</sup>`);
const gfCityOf = (p) => (p.list === "villes" ? ({ "New York": "ny", "Tel-Aviv": "tlv", "Jérusalem": "jer", "Autour de Paris": "paris" }[p.city] || "other") : "paris");
const gfIsPrec = (p) => p.list === "precieuses" || !!p.prec || (p.list === "villes" && p.price >= 4);
function gfZone(p) {
  const a = p.address || "";
  if (gfCityOf(p) === "paris") return p.list === "villes" ? "Autour de Paris" : p.arr ? String(p.arr) : "";
  if (p.city === "New York") {
    if (/Brooklyn/i.test(a)) return "Brooklyn";
    if (/Queens|Flushing|Astoria|Long Island City|Jackson Heights/i.test(a)) return "Queens";
    if (/Bronx/i.test(a)) return "Bronx";
    if (/Staten/i.test(a)) return "Staten Island";
    return a && a !== "New York" ? "Manhattan" : "";
  }
  if (p.city === "Tel-Aviv") { if (/Jaffa|Yafo|HaDolfin/i.test(a)) return "Jaffa"; if (/Ramat Gan/i.test(a)) return "Ramat Gan"; if (/Herzliya/i.test(a)) return "Herzliya"; return "Centre"; }
  if (p.city === "Jérusalem") return /Vieille ville|Old City/i.test(a) ? "Vieille ville" : "Centre-ville";
  return "";
}
function gfSign(z) {
  const num = /^\d+$/.test(z);
  const kick = GF.city === "paris" ? (num ? "Arrt" : "Île-de-France") : GF.city === "ny" ? "NYC" : GF.city === "tlv" ? "Tel-Aviv" : "Jérusalem";
  return `<span class="sign ${num ? "" : "txt"}"><span class="k">${kick}</span><span class="n">${num ? gfArr(+z) : esc(z)}</span></span>`;
}
// Ordre des cuisines = ordre de la note (Français, Italien, Japonais…).
let GF_CORD = null;
const gfCord = (c) => {
  if (!GF_CORD) { GF_CORD = {}; S.places.forEach((p) => { if (p.cat && !(p.cat in GF_CORD)) GF_CORD[p.cat] = Object.keys(GF_CORD).length; }); }
  return c in GF_CORD ? GF_CORD[c] : 999;
};
const gfCuis = (p) => (GF.prec && p.list === "precieuses" ? p.cuisine || null : p.cat);
const gfOutOf = (p) => { const c = p.list === "precieuses" || p.list === "sorties" ? p.cat : p.prec; return c && GF_OUT[c] ? c : null; };
const gfGroup = (p) => gfCuis(p) || GF_OUT[gfOutOf(p)] || "Autres";
const gfPool = () => S.places.filter((p) => gfCityOf(p) === GF.city && (GF.prec ? gfIsPrec(p) : p.list !== "precieuses" && p.list !== "sorties"));
// Sorties & activités : à part des Précieuses (réservées au haut de gamme) et des restos.
const gfSorties = () => S.places.filter((p) => gfCityOf(p) === GF.city && p.list === "sorties");
// Les institutions : brasseries mythiques et adresses légendaires, toutes listes confondues.
const gfInst = () => S.places.filter((p) => p.institution && gfCityOf(p) === GF.city);
const gfZones = (P) => { const m = {}; P.forEach((p) => { const z = gfZone(p); if (z) m[z] = (m[z] || 0) + 1; }); return m; };
function gfZkeys(P) {
  const Z = gfZones(P);
  const ks = GF.city === "paris"
    ? [...Array.from({ length: 20 }, (_, i) => String(i + 1)).filter((k) => Z[k]), ...(Z["Autour de Paris"] ? ["Autour de Paris"] : [])]
    : Object.keys(Z).sort((a, b) => Z[b] - Z[a]);
  return { Z, ks };
}
const gfGoodPhoto = (u) => u && !/logo|icon|favicon|placeholder|\.svg|\d{3,4}x\d{3,4}/i.test(u);
const gfPhoto = (arr, seed = 0) => { const w = arr.filter((p) => gfGoodPhoto(p.photo)); return w.length ? w[seed % w.length].photo : ""; };
const gfBg = (u) => (u ? `style="background-image:url('${esc(u)}')"` : "");
const gfCount = (n) => `${n} adresse${n > 1 ? "s" : ""}`;

function gfWish(q, P) {
  const n = norm(q), hit = GF_CONCEPTS.filter((c) => c.w.test(n));
  const arr = (n.match(/\b(\d{1,2})\s*(e|eme|er)\b/) || [])[1];
  const res = P.filter((p) => !p.closed).map((p) => {
    let sc = 0; const why = []; const txt = norm(`${p.summary || ""} ${p.name} ${p.note || ""} ${p.comment || ""}`);
    for (const c of hit) {
      let ok = false;
      if (c.flag) { if (p[c.flag]) ok = true; else sc -= 99; }
      if (c.cat && c.cat.test(`${p.cat || ""} ${p.cuisine || ""}`)) ok = true;
      if (c.txt && c.txt.test(txt)) { ok = true; sc += 1; }
      if (c.price && p.price >= c.price) ok = true;
      if (c.prec && gfIsPrec(p)) ok = true;
      if (c.maxPrice) { if (p.price && p.price <= c.maxPrice) ok = true; else sc -= 2; }
      if (ok) { sc += 3; why.push(c.label); }
    }
    if (arr && String(p.arr) !== arr) sc -= 99;
    if (!hit.length && txt.includes(n)) sc += 3;
    if (p.photo) sc += 0.3; if (p.mark) sc += 0.5;
    return { p, sc, why };
  }).filter((x) => x.sc >= 3).sort((a, b) => b.sc - a.sc);
  return { res, labels: hit.map((c) => c.label) };
}

function gfCard(p, why, m) {
  const addr = p.address ? " · " + esc(String(p.address).replace(/,?\s*750\d\d Paris$/, "")) : "";
  return `<button class="pcard${p.closed ? " gone" : ""}" data-gf-id="${esc(p.id)}"><div class="ph" ${gfBg(gfGoodPhoto(p.photo) ? p.photo : "")}>${gfGoodPhoto(p.photo) ? "" : esc((p.name || "?")[0])}</div>
    <div style="min-width:0"><b>${esc(p.name)}</b><small>${esc(gfCuis(p) || p.cat || "")}${addr}</small>
    <div class="tags">${m != null ? `<span class="tag near">${fmtDist(m)} · ${walkMin(m)} min à pied</span>` : ""}${ohTag(p)}${p.price ? `<span class="tag">${"€".repeat(p.price)}</span>` : ""}${p.tested ? '<span class="tag ok">Testé</span>' : ""}${p.kasher ? '<span class="tag k">Kasher</span>' : ""}${p.halal ? '<span class="tag h">Halal</span>' : ""}</div>
    ${why && why.length ? `<div class="why">✓ ${esc(why.join(" · "))}</div>` : ""}</div>${p.want ? '<span class="heart">♥</span>' : ""}</button>`;
}
function gfGrouped(items) {
  const g = {};
  items.forEach((p) => { const k = gfGroup(p); (g[k] = g[k] || []).push(p); });
  return Object.entries(g).sort((a, b) => gfCord(a[0]) - gfCord(b[0])).map(([cat, arr], i) =>
    `<div class="subhead" style="--sc:${GF_PAL[i % GF_PAL.length]}"><h3>${esc(cat)}</h3><i></i><span>${arr.length}</span></div><div class="cards">${arr.map((p) => gfCard(p)).join("")}</div>`).join("");
}

const gfDark = () => { const t = store.get("theme", ""); return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches; };
function gfHero() {
  const c = GF_CITIES.find((x) => x.id === GF.city);
  const img = GF.prec ? "images/cities/nuit.jpg" : `images/cities/${GF.city}.jpg`;
  const n = (id) => S.places.filter((p) => gfCityOf(p) === id && (GF.prec ? gfIsPrec(p) : p.list !== "precieuses")).length;
  return `<header class="gf-hero" style="background-image:url('${img}')">
    <div class="gtop"><div class="brand"><small>${GF.prec ? "Les Précieuses" : esc(c.kick)}</small><h1>Cozy Spots</h1></div>
    <div class="acts"><button class="ibtn" data-share-app aria-label="Envoyer l'appli"><svg viewBox="0 0 24 24"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg></button>
    <button class="ibtn" data-gf-dark aria-label="Mode sombre"><svg viewBox="0 0 24 24">${gfDark() ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>' : '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>'}</svg></button>
    <a class="ibtn add" href="#ajouter" aria-label="Ajouter"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></a></div></div>
    <div class="cities">${GF_CITIES.map((x) => `<button class="city ${x.id === GF.city ? "on" : ""}" data-gf-city="${x.id}">${esc(x.name)}<b>${n(x.id)}</b></button>`).join("")}</div>
    <span class="credit">${esc(GF_CREDIT[GF.prec ? "nuit" : GF.city])}</span>
    <label class="gsearch"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="gfQ" type="search" enterkeyhint="search" placeholder="Un resto, une envie, un quartier…" value="${esc(GF.list?.q || "")}"></label>
  </header>`;
}

// Autour de moi : les adresses les plus proches, toutes listes confondues (seulement les Précieuses en mode Précieuses).
function gfNear() {
  if (!S.me) return [];
  return (GF.prec ? gfPool() : S.places).filter((p) => !p.closed && (!GF.openOnly || openState(p)?.open))
    .map((p) => ({ p, m: distM(S.me, p) })).filter((x) => x.m != null).sort((a, b) => a.m - b.m);
}
function gfNearSec() {
  const N = gfNear().filter((x) => x.m < 1500).slice(0, 8);
  if (!S.me) return `<section class="sec"><button class="near-cta" data-gf-near><span class="pin">◎</span><span><b>Autour de moi</b><small>Localise-toi pour voir les bonnes adresses à côté</small></span><i>›</i></button></section>`;
  return `<section class="sec"><div class="sec-h"><h2>Autour de moi</h2><button class="all" data-gf-near>${N.length ? "Tout voir ›" : "Actualiser ›"}</button></div>
    ${N.length ? `<div class="cards">${N.slice(0, 4).map((x) => gfCard(x.p, null, x.m)).join("")}</div>` : `<p class="none" style="margin:0">Rien à moins de 1,5 km. Touche « Actualiser » pour voir les plus proches.</p>`}</section>`;
}
function gfOpenNear() {
  const go = () => gfOpen({ near: 1 });
  if (S.me && Date.now() - S.me.t < 5 * 60000) return go();
  toast("Je te localise…");
  locateMe(true).then(go).catch(() => {});
}

function gfHomeBody() {
  const P = gfPool(), c = GF_CITIES.find((x) => x.id === GF.city);
  const { Z, ks } = gfZkeys(P);
  const cats = Object.entries(P.reduce((a, p) => { const k = gfCuis(p); if (k) a[k] = (a[k] || 0) + 1; return a; }, {})).sort((a, b) => gfCord(a[0]) - gfCord(b[0]));
  const outs = Object.keys(GF_OUT).map((n) => [n, P.filter((p) => gfOutOf(p) === n).length]).filter((x) => x[1]);
  const SO_ = GF.prec ? [] : gfSorties();
  const souts = ["Activité", "Soirée", "Boire un verre", "Rooftop", "Stand-up", "Resto festif", "Salon de thé", "Café", "À tester"].map((n) => [n, SO_.filter((p) => gfOutOf(p) === n).length]).filter((x) => x[1]);
  const k = P.filter((p) => p.kasher).length, h = P.filter((p) => p.halal).length;
  const INS = gfInst().sort((a, b) => (gfGoodPhoto(b.photo) ? 1 : 0) - (gfGoodPhoto(a.photo) ? 1 : 0));
  return `<div style="height:34px"></div>
  ${gfNearSec()}
  <section class="sec"><div class="sec-h"><h2>${esc(c.zoneTitle)}</h2><span>${gfCount(P.length)}</span></div>
    <div class="zrail">${ks.map((z) => `<button class="zp" data-gf-zone="${esc(z)}">${gfSign(z)}<small>${gfCount(Z[z])}</small></button>`).join("")}</div></section>
  ${!GF.prec && INS.length ? `<section class="sec"><div class="sec-h"><h2>Les institutions</h2><button class="all" data-gf-inst>Tout voir ›</button></div>
    <div class="rail">${INS.slice(0, 12).map((p, i) => `<button class="tile cuis" data-gf-id="${esc(p.id)}" ${gfBg(gfGoodPhoto(p.photo) ? p.photo : gfPhoto([p], i))}><div class="t"><h3>${esc(p.name)}</h3><p>${esc(p.cat || "")}</p></div></button>`).join("")}</div></section>` : ""}
  <section class="sec"><div class="sec-h"><h2>Une envie ?</h2></div>
    <div class="wish"><textarea id="gfWish" rows="2" placeholder="Décris ce dont tu as envie… ex. un resto chaleureux, cuisine réconfortante et gourmande"></textarea><button data-gf-wish>Trouver</button></div>
    <div class="ex">${["Chaleureux, réconfortant et gourmand", "Léger et frais, pas cher", "Romantique avec une belle vue", "Festif entre amis, ça bouge", "Sushi de qualité", "Sucré pour le goûter"].map((x) => `<button data-gf-ex="${esc(x)}">${esc(x)}</button>`).join("")}</div></section>
  ${cats.length ? `<section class="sec"><div class="sec-h"><h2>Par cuisine</h2><button class="all" data-gf-allcats>Tout voir ›</button></div>
    <div class="rail">${cats.slice(0, 10).map(([n, v], i) => `<button class="tile cuis" data-gf-cat="${esc(n)}" ${gfBg(gfPhoto(P.filter((p) => gfCuis(p) === n), i))}><div class="t"><h3>${esc(n)}</h3><p>${gfCount(v)}</p></div></button>`).join("")}</div></section>` : ""}
  ${GF.prec && outs.length ? `<section class="sec"><div class="sec-h"><h2>Soirées, rooftops & bars chic</h2></div>
    <div class="rail">${outs.map(([n, v], i) => `<button class="tile cuis" data-gf-out="${esc(n)}" ${gfBg(gfPhoto(P.filter((p) => gfOutOf(p) === n), i + 3))}><div class="t"><h3>${esc(GF_OUT[n])}</h3><p>${gfCount(v)}</p></div></button>`).join("")}</div></section>` : ""}
  ${!GF.prec && SO_.length ? `<section class="sec"><div class="sec-h"><h2>Sorties & activités</h2><span>${gfCount(SO_.length)}</span></div>
    <div class="rail">${souts.map(([n, v], i) => `<button class="tile cuis" data-gf-out="${esc(n)}" ${gfBg(gfPhoto(SO_.filter((p) => gfOutOf(p) === n), i + 5))}><div class="t"><h3>${esc(GF_OUT[n])}</h3><p>${gfCount(v)}</p></div></button>`).join("")}</div></section>` : ""}
  ${k || h ? `<section class="sec"><div class="sec-h"><h2>Régimes</h2></div><div class="diet">${k ? `<button data-gf-diet="kasher"><span class="seal" style="background:#1d3b78">K</span><span><b>Kasher</b><small>${gfCount(k)}</small></span></button>` : ""}${h ? `<button data-gf-diet="halal"><span class="seal" style="background:#2c7a4b">H</span><span><b>Halal</b><small>${gfCount(h)}</small></span></button>` : ""}</div></section>` : ""}
  <div style="height:20px"></div>`;
}

function gfListBody() {
  const L = GF.list, P = L.all ? S.places : gfPool();
  const head = (t, extra = "") => `<div style="height:30px"></div><div class="list-h"><button class="back" data-gf-back aria-label="Retour">‹</button><h2>${t}</h2></div>${extra}`;
  if (L.coll || L.sharedColl) return collBody(L, head);
  if (L.allcats) {
    const cats = Object.entries(P.reduce((a, p) => { const k = gfCuis(p); if (k) a[k] = (a[k] || 0) + 1; return a; }, {})).sort((a, b) => gfCord(a[0]) - gfCord(b[0]));
    return head("Toutes les cuisines") + `<div class="grid2">${cats.map(([n, v], i) => `<button class="tile" data-gf-cat="${esc(n)}" ${gfBg(gfPhoto(P.filter((p) => gfCuis(p) === n), i))}><div class="t"><h3>${esc(n)}</h3><p>${v}</p></div></button>`).join("")}</div>`;
  }
  if (L.zone) {
    const { ks } = gfZkeys(P), items = P.filter((p) => gfZone(p) === L.zone);
    return `<div class="zbar${GF.grow ? " grow" : ""}" id="gfZone"><div class="list-h" style="margin:0 0 8px"><button class="back" data-gf-back aria-label="Retour">‹</button><h2>${/^\d+$/.test(L.zone) ? `Paris ${gfArr(+L.zone)}` : esc(L.zone)}</h2><span style="margin-left:auto;color:var(--muted);font-weight:700;font-size:12px">${gfCount(items.length)}</span></div>
      <div class="zrail" id="gfZbar">${ks.map((z) => `<button class="zp ${z === L.zone ? "on" : ""}" data-gf-zone="${esc(z)}">${gfSign(z)}</button>`).join("")}</div></div>${gfGrouped(items)}`;
  }
  if (L.wish != null) {
    const { res, labels } = gfWish(L.wish, P);
    return head("Ton envie", `<p style="margin:0 0 4px;color:var(--muted)">« ${esc(L.wish)} »</p>${labels.length ? `<div class="tags" style="margin-bottom:12px">${labels.map((l) => `<span class="tag">${esc(l)}</span>`).join("")}</div>` : ""}`)
      + `<div class="cards">${res.slice(0, 40).map((x) => gfCard(x.p, x.why)).join("") || `<p class="none">Rien trouvé, essaie avec d'autres mots.</p>`}</div>`;
  }
  if (L.near) {
    const N = gfNear(), bands = [["À 5 min à pied", 450], ["À 10 min", 900], ["À 20 min", 1800], ["Un peu plus loin", 4000]];
    let from = 0;
    const out = bands.map(([t, max]) => { const g = N.filter((x) => x.m >= from && x.m < max); from = max; return g.length ? `<div class="subhead" style="--sc:var(--accent)"><h3>${t}</h3><i></i><span>${g.length}</span></div><div class="cards">${g.slice(0, 40).map((x) => gfCard(x.p, null, x.m)).join("")}</div>` : ""; }).join("");
    const far = !N.some((x) => x.m < 4000);
    return head("Autour de moi", `<div class="near-acts"><button class="btn" data-gf-near>◎ Actualiser</button><button class="btn oh-toggle ${GF.openOnly ? "on" : ""}" data-gf-open aria-pressed="${!!GF.openOnly}"><i></i>Ouvert maintenant</button></div>${GF.openOnly ? `<p class="oh-note">Seulement les adresses dont on connaît les horaires.</p>` : ""}`)
      + (out || "") + (GF.openOnly && !N.length ? `<p class="none">Aucune adresse ouverte connue autour de toi pour l'instant.</p>` : far ? `<p class="none">Rien à moins de 4 km. Voici les plus proches :</p><div class="cards">${N.slice(0, 10).map((x) => gfCard(x.p, null, x.m)).join("")}</div>` : "");
  }
  if (L.want) return listsBody(L, head);
  let items = [], title = "", flat = false;
  if (L.diet) { items = P.filter((p) => p[L.diet]); title = L.diet === "kasher" ? "Kasher" : "Halal"; }
  if (L.out) { items = (GF.prec ? P : gfSorties()).filter((p) => gfOutOf(p) === L.out); title = esc(GF_OUT[L.out]); flat = true; }
  if (L.cat) { items = P.filter((p) => gfCuis(p) === L.cat); title = esc(L.cat); flat = true; }
  if (L.inst) { items = gfInst(); title = "Les institutions"; flat = true; }
  if (L.q != null) {
    const q = norm(L.q).trim();
    items = S.places.filter((p) => norm(`${p.name} ${p.cat} ${p.cuisine || ""} ${p.address || ""} ${p.city || ""} ${p.summary || ""}`).includes(q));
    title = q ? `« ${esc(L.q)} »` : "Toutes les adresses";
  }
  const body = flat ? `<div class="cards" style="margin-top:14px">${items.map((p) => gfCard(p)).join("")}</div>` : gfGrouped(items);
  return head(title) + (items.length ? body : `<p class="none">Rien ici pour l'instant.</p>`);
}

renderHome = function () {
  const home = $("#home");
  if (!home) return;
  GF_CORD = null;
  const res = $("#homeResults"); if (res) res.hidden = true;
  home.hidden = false;
  home.className = "gf";
  home.innerHTML = gfHero() + `<div class="gf-main">${GF.list?.zone ? '<div style="height:34px"></div>' : ""}${GF.list ? gfListBody() : gfHomeBody()}</div>`;
  if (GF.list && GF.list.zone) { const on = $("#gfZbar .zp.on"); if (on) on.scrollIntoView({ inline: "center", block: "nearest" }); }
  gfBody();
};

function gfBody() {
  const on = S.view === "accueil";
  const b = document.body.classList;
  b.toggle("gf-on", on);
  b.toggle("gf-prec", on && GF.prec);
  for (const id of ["paris", "ny", "tlv", "jer"]) b.toggle(`gf-${id}`, on && GF.city === id);
  for (const a of $$(".tabs a")) {
    const t = a.dataset.tab;
    a.classList.toggle("on", on ? (t === "precieuses" ? GF.prec : t === "envies" ? !!(GF.list?.want || GF.list?.coll) : t === "accueil" && !GF.prec && !GF.list?.want && !GF.list?.coll) : t === S.view);
  }
}
// Toucher une plaque : la page glisse vers le haut, les plaques rétrécissent et restent en haut, les restos apparaissent dessous.
function gfOpenZone(z) {
  const from = window.scrollY, first = !GF.list?.zone;
  GF.list = { zone: z }; GF.grow = first; renderHome(); GF.grow = false;
  const bar = $("#gfZone"); if (!bar) return;
  const top = bar.getBoundingClientRect().top + window.scrollY;
  if (!first) { window.scrollTo({ top }); return; }
  window.scrollTo({ top: from });
  requestAnimationFrame(() => requestAnimationFrame(() => { bar.classList.remove("grow"); window.scrollTo({ top, behavior: "smooth" }); }));
}
function gfOpen(l, keep) {
  GF.list = l; renderHome();
  if (!keep) window.scrollTo({ top: l && !l.zone ? 300 : 0 });
}

// Les onglets Précieuses et Mes listes s'affichent dans l'accueil.
function gfRoute(view) {
  if (view === "precieuses") { GF.prec = true; GF.list = null; return true; }
  if (view === "envies") { GF.prec = false; GF.list = { want: 1 }; return true; }
  // Les anciens écrans Paris et Villes mènent aussi à l'accueil (une ville à la fois).
  if (view === "accueil" || view === "paris" || view === "villes" || !view) { GF.prec = false; GF.list = null; return true; }
  return false;
}

document.addEventListener("click", (e) => {
  const t = e.target;
  if (!t.closest || !t.closest("#home")) return;
  let b;
  if ((b = t.closest("[data-gf-id]"))) { openSheet(b.dataset.gfId); return; }
  if ((b = t.closest("[data-gf-city]"))) { GF.city = b.dataset.gfCity; store.set("gfCity", GF.city); gfOpen(null); return; }
  if (t.closest("[data-gf-dark]")) { const th = gfDark() ? "light" : "dark"; store.set("theme", th); applyTheme(th); renderHome(); return; }
  if ((b = t.closest("[data-gf-zone]"))) { gfOpenZone(b.dataset.gfZone); return; }
  if ((b = t.closest("[data-gf-cat]"))) { gfOpen({ cat: b.dataset.gfCat }); return; }
  if ((b = t.closest("[data-gf-out]"))) { gfOpen({ out: b.dataset.gfOut }); return; }
  if ((b = t.closest("[data-gf-diet]"))) { gfOpen({ diet: b.dataset.gfDiet }); return; }
  if (t.closest("[data-gf-near]")) { gfOpenNear(); return; }
  if (t.closest("[data-gf-open]")) { GF.openOnly = !GF.openOnly; gfOpen(GF.list, true); return; }
  if (t.closest("[data-gf-inst]")) { gfOpen({ inst: 1 }); return; }
  if (t.closest("[data-gf-allcats]")) { gfOpen({ allcats: 1 }); return; }
  if (t.closest("[data-gf-wish]")) { const v = $("#gfWish").value.trim(); if (v) gfOpen({ wish: v }); return; }
  if ((b = t.closest("[data-gf-ex]"))) { gfOpen({ wish: b.dataset.gfEx }); return; }
  if (t.closest("[data-gf-back]")) {
    if (GF.list?.coll) { gfOpen({ want: 1, tab: "colls" }); return; }
    const w = GF.list?.want, z = GF.list?.zone; GF.list = null; if (w) location.hash = "accueil"; renderHome();
    // Retour d'un arrondissement : on revient en douceur sur les plaques.
    const rail = z && $(".gf .zrail"); window.scrollTo({ top: rail ? Math.max(0, rail.getBoundingClientRect().top + window.scrollY - 120) : 0, behavior: z ? "smooth" : "auto" });
  }
});
document.addEventListener("keydown", (e) => { if (e.target.id === "gfQ" && e.key === "Enter") { e.target.blur(); gfOpen({ q: e.target.value.trim() }); } });

// Glisser à gauche ou à droite dans un arrondissement : arrondissement suivant ou précédent.
let gfTx = null, gfTy = 0;
document.addEventListener("touchstart", (e) => {
  if (!GF.list?.zone || S.view !== "accueil" || e.target.closest(".zrail,.rail,.sheet")) { gfTx = null; return; }
  gfTx = e.touches[0].clientX; gfTy = e.touches[0].clientY;
}, { passive: true });
document.addEventListener("touchend", (e) => {
  if (gfTx == null || !GF.list?.zone) return;
  const dx = e.changedTouches[0].clientX - gfTx, dy = e.changedTouches[0].clientY - gfTy; gfTx = null;
  if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
  const { ks } = gfZkeys(gfPool()); const z = ks[ks.indexOf(GF.list.zone) + (dx < 0 ? 1 : -1)];
  if (z) gfOpenZone(z);
}, { passive: true });
