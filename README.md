# Ouaga Inondations 3D
Application web autonome : où l'eau de pluie s'accumule à Ouagadougou, heure par heure, en 3D, par scénario (événements 2020-2026 + pluies de projet), recherche par quartier.
- `prep/` : préparation (DEM Copernicus GLO-30 → 20 m, bâtiments Microsoft, OSM canaux/barrages, WorldCover) et solveur local-inertial (numba). `prep.py` → `solve.py <scénario>` → `post.py`.
- `docs/` : front statique MapLibre + deck.gl + PMTiles (servi par GitHub Pages, derrière un Worker Cloudflare `worker.js`).
Voir `docs/data/meta.json` (onglet « Sources et limites ») pour les sources et limites. Ce n'est pas une carte officielle de risque.
