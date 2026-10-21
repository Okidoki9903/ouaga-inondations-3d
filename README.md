# Ouaga Inondations 3D
Application web autonome : où l'eau de pluie s'accumule à Ouagadougou, heure par heure, en 3D, par scénario (événements 2020-2026 + pluies de projet), recherche par quartier.
- `prep/` : préparation (DEM Copernicus GLO-30 → 20 m, bâtiments Microsoft, OSM canaux/barrages, WorldCover) et solveur local-inertial (numba). `prep.py` → `solve.py <scénario>` → `post.py`.
Voir `docs/data/meta.json` (onglet « Sources et limites ») pour les sources et limites. Ce n'est pas une carte officielle de risque.

En ligne : https://ouaga-inondations-3d.akwalife.workers.dev (Cloudflare Workers + Static Assets)
