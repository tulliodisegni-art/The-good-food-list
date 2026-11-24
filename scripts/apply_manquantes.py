"""Recopie le résultat relu du robot « photos manquantes » (scripts/photos_manquantes.mjs) dans data/.
Usage : python3 scripts/apply_manquantes.py <dossier de l'essai> <rejets.json> [cassées gardées.json]
 - photos cassées (cassees.json) -> data/photos-cassees.json et retirées de data/photos.json ;
 - photos Google Maps relues à l'œil -> ajoutées à data/photos.json (rejets : {"id": [numéros] | "tout"})."""
import json, sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
run = Path(sys.argv[1])
rej = json.loads(Path(sys.argv[2]).read_text()) if len(sys.argv) > 2 else {}
spare = set(json.loads(Path(sys.argv[3]).read_text())) if len(sys.argv) > 3 else set()
gal = json.loads((DATA / "photos.json").read_text())
dead_file = DATA / "photos-cassees.json"
dead = set(json.loads(dead_file.read_text())) if dead_file.exists() else set()
if (run / "cassees.json").exists():
    dead |= set(json.loads((run / "cassees.json").read_text())) - spare
for pid in list(gal):
    gal[pid] = [u for u in gal[pid] if u not in dead]
    if not gal[pid]:
        del gal[pid]
added = 0
for pid, ph in json.loads((run / "photos.json").read_text()).items():
    bad = rej.get(pid, [])
    if bad == "tout":
        continue
    keep = [x["u"] for i, x in enumerate(ph) if i not in bad]
    if keep:
        gal[pid] = [u for u in gal.get(pid, []) if u not in keep] + keep
        added += 1
(DATA / "photos.json").write_text(json.dumps(gal, ensure_ascii=False, separators=(",", ":")))
dead_file.write_text(json.dumps(sorted(dead), ensure_ascii=False, indent=0))
print(f"{len(dead)} photos cassées écartées ; {added} fiches complétées ; {len(gal)} galeries")
