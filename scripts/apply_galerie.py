"""Recopie le résultat relu du robot (scripts/menus_photos.mjs) dans data/menus.json et data/photos.json.
Usage : python3 scripts/apply_galerie.py <dossier du robot> <rejets.json>
rejets.json : {"id": [numéros de photos refusées] | "tout", "menu:id": "google"}  (relu à l'œil sur les planches)."""
import json, sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
src, rej = Path(sys.argv[1]), json.loads(Path(sys.argv[2]).read_text()) if len(sys.argv) > 2 else {}
menus = json.loads((src / "menus.json").read_text())
photos = json.loads((src / "photos.json").read_text())
manual = json.loads((DATA / "menus-manuels.json").read_text()) if (DATA / "menus-manuels.json").exists() else {}
out_m = {}
for pid, m in menus.items():
    if rej.get("menu:" + pid) == "google":
        m = {"menu": "", "how": "google"}
    out_m[pid] = {"menu": m.get("menu", ""), "how": m.get("how", "")}
out_m.update(manual)
out_p = {}
for pid, ph in photos.items():
    bad = rej.get(pid, [])
    if bad == "tout":
        continue
    keep = [x["u"] for i, x in enumerate(ph) if i not in bad]
    if keep:
        out_p[pid] = keep
(DATA / "menus.json").write_text(json.dumps(out_m, ensure_ascii=False, indent=1))
(DATA / "photos.json").write_text(json.dumps(out_p, ensure_ascii=False, separators=(",", ":")))
print(len(out_m), "menus,", sum(1 for m in out_m.values() if m["menu"]), "liens ;", len(out_p), "galeries,", sum(map(len, out_p.values())), "photos")
