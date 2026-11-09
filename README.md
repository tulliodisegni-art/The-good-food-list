# The Good Food List

Mes adresses à Paris, classées par arrondissement et par type, avec une carte, la liste « Les Précieuses » et un onglet pour les autres villes.

C'est une appli web installable : ouvrir le lien dans Safari, puis Partager → « Sur l'écran d'accueil ».

## Mettre à jour les adresses

1. Modifier `data/paris.txt` ou `data/precieuses.txt` (format décrit en tête de `scripts/build_data.py`).
2. Lancer `python3 scripts/build_data.py` pour regénérer `data/places.json`.
3. Pousser sur `main` : la mise en ligne place les nouvelles adresses sur la carte et publie l'appli.

Les liens de menu, photos, résumés et liens Instagram se renseignent dans `data/places.json` (`menu`, `photo`, `summary`, `source`) et sont conservés quand on regénère le fichier.

## Horaires, lieux fermés et photos libres

À chaque mise en ligne, `scripts/osm.mjs` reprend les horaires d'OpenStreetMap, puis `scripts/hours.mjs` cherche sur le web ceux qui manquent (et repère les lieux fermés définitivement), par petits lots gratuits. Les horaires sont rangés dans `oh` (7 jours, du lundi au dimanche, ex. `"12:00-14:30,19:00-22:30"`, vide = fermé).
