"""Convertit les notes texte (data/*.txt) en data/places.json.

Format des notes :
  # 12              -> arrondissement (liste Paris)
  ## Italien        -> catégorie
  Nom | adresse | marque [arrondissement réel] | note
Les coordonnées déjà trouvées dans places.json sont conservées.
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
MARKS = {"*": "✅", "!": "🤌"}


def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def parse(path, list_id):
    places, arr, cat = [], None, None
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("## "):
            cat = line[3:].strip()
            continue
        if line.startswith("# "):
            arr = int(line[2:])
            continue
        parts = [p.strip() for p in line.split("|")] + ["", "", ""]
        name, addr, extra, note = parts[0], parts[1], parts[2], parts[3]
        mark, real_arr = "", arr
        for tok in extra.split():
            if tok.isdigit():
                real_arr = int(tok)
            else:
                mark = MARKS.get(tok, tok)
        if addr and list_id == "paris" and "750" not in addr:
            addr = f"{addr}, 750{real_arr:02d} Paris"
        m = re.search(r"750(\d\d)", addr)
        places.append({
            "id": f"{list_id}-{arr or 0}-{slug(cat)}-{slug(name)}",
            "list": list_id,
            "arr": arr if arr else (int(m.group(1)) if m else None),
            "cat": cat,
            "name": name,
            "address": addr,
            "mark": mark,
            **({"note": note} if note else {}),
        })
    return places


def main():
    out = DATA / "places.json"
    old = {}
    if out.exists():
        old = {p["id"]: p for p in json.loads(out.read_text(encoding="utf-8"))}
    places = parse(DATA / "paris.txt", "paris") + parse(DATA / "precieuses.txt", "precieuses")
    # Adresses publiées depuis l'appli (bouton « Publier pour tous »).
    shared = DATA / "ajouts.json"
    if shared.exists():
        places += [{**p, "shared": True} for p in json.loads(shared.read_text(encoding="utf-8"))]
    seen = set()
    for p in places:
        while p["id"] in seen:
            p["id"] += "-2"
        seen.add(p["id"])
        prev = old.get(p["id"], {})
        # Garde les infos enrichies à la main ou par le géocodage.
        for key, val in prev.items():
            if val and not p.get(key):
                p[key] = val
    # Corrections publiées depuis l'appli (classement, infos) : elles priment sur les notes.
    fixes = DATA / "modifs.json"
    if fixes.exists():
        mods = json.loads(fixes.read_text(encoding="utf-8"))
        for p in places:
            for key, val in mods.get(p["id"], {}).items():
                if val in ("", None, 0) and key in ("prec", "city", "arr", "price"):
                    p.pop(key, None)
                else:
                    p[key] = val
    places = [p for p in places if not p.get("removed")]
    out.write_text(json.dumps(places, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(places)} lieux -> {out}", file=sys.stderr)


if __name__ == "__main__":
    main()
