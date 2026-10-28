# The Good Food List

Mes adresses à Paris, classées par arrondissement et par type, avec une carte, la liste « Les Précieuses » et un onglet pour les autres villes.

C'est une appli web installable : ouvrir le lien dans Safari, puis Partager → « Sur l'écran d'accueil ».

## Mettre à jour les adresses

1. Modifier `data/paris.txt` ou `data/precieuses.txt` (format décrit en tête de `scripts/build_data.py`).
2. Lancer `python3 scripts/build_data.py` pour regénérer `data/places.json`.
3. Pousser sur `main` : la mise en ligne place les nouvelles adresses sur la carte et publie l'appli.

Les liens de menu, photos, résumés et liens Instagram se renseignent dans `data/places.json` (`menu`, `photo`, `summary`, `source`) et sont conservés quand on regénère le fichier.
