| Quartier signalé | Événement | Prof. max simulée (m) | ha >20 cm (r=400 m) | Médiane ha tous quartiers |
|---|---|---|---|---|
| Bonheur Ville | 2-3 août 2026 | 0.67 | 1.2 | 1.2 |
| Kalgodin | 24 juil. 2025 | 0.79 | 3.1 | 2.6 |
| Kalgondin | 24 juil. 2025 | 0.61 | 2.3 | 2.6 |
| Nagrin | 2-3 août 2026 | 0.56 | 0.6 | 1.2 |
| Nioko | 5 sept. 2020 | 1.45 | 12.0 | 6.3 |
| Rimkiéta | 16 août 2024 | 2.05 | 4.9 | 5.0 |
| Somgande | 5 sept. 2020 | 1.18 | 5.7 | 6.3 |
| Somgandé | 5 sept. 2020 | 1.18 | 5.7 | 6.3 |
| Tanghin | 5 sept. 2020 | 1.01 | 5.4 | 6.3 |
| Toécin | 16 août 2024 | 1.41 | 6.5 | 5.0 |
| Wemtenga | 3 août 2022 | 0.56 | 2.1 | 1.7 |
| Zone 1 | 5 sept. 2020 | 1.98 | 7.2 | 6.3 |
| Zone 1 | 3 août 2022 | 1.14 | 2.3 | 1.7 |

## v2 (21 oct. 2026) – rues abaissées, pluies observées, toits Google

Changements : rues OSM abaissées (40 cm primaires/secondaires/trunk, 30 cm tertiaires, 20 cm résidentielles/service ; 421 708 mailles), infiltration routes ≤ 2 mm/h, Manning 0,02 ; couverture de toits = max(Microsoft, Google Open Buildings v3 conf ≥ 0,7) → fraction moyenne 0,087 → 0,123 ; pluies : SYNOP 65503 (OGIMET) + METAR DFFD (Iowa Mesonet), fichiers bruts dans prep/obs/.

| Événement | Cumul v1 → v2 (mm) | Source v2 |
|---|---|---|
| 5 sept. 2020 | 90,5 → 90,5 | Somgandé conservé (aéroport : 62 mm 06-18 UTC + 6 mm avant) |
| 3 août 2022 | 47 → 31 | SYNOP 24 h observé ; forme horaire ERA5 (repli) |
| 16 août 2024 | 50 → 58 | SYNOP horaire observé (29/24/5 mm) |
| 24 juil. 2025 | 35 → 37 | SYNOP horaire observé |
| 2-3 août 2026 | 45 → 24,4 | SYNOP horaire observé (11 + 10 mm à 03-05 UTC) |

Repli ERA5 conservé lorsque la SYNOP n'a pas de cumul horaire (2022). Une seule station (aéroport) : les quartiers sinistrés ont pu recevoir davantage (2026 : 24 mm à l'aéroport pour un événement très médiatisé).

Validation quartiers signalés (table ci-dessus, v2) vs v1 : rapport moyen ha>20 cm / médiane tous quartiers 1,10 → 1,09 ; quartiers signalés au-dessus de la médiane 8/13 → 6/13 (Kalgondin, Rimkiéta passent juste sous la médiane). Profondeurs max aux sites signalés : 2024 en hausse (Rimkiéta 1,38 → 2,05 m ; Toécin 1,14 → 1,41 m), 2022 en baisse (cumul observé plus faible).

Ouaga 2000 (commissariat / Palais des Sports, r = 300 m, mailles « rue ») : p90 rues 16 août 2024 0,07 → 0,15 m (commissariat) et 0,06 → 0,23 m (Palais) ; max rues 0,63 → 0,87 m. Toujours en dessous des 50-70 cm signalés dans les rues lors des fortes pluies ordinaires.

Canal (stream OSM, tête -1,5025/12,3198 → pont N5 « Route de Pô ») : bassin versant D8 au pont N5 13,6 km² ; coefficient d'écoulement simulé 0-3 % pour les pluies de 24-58 mm, 18 % pour 90 mm, même à 0-12 % sans infiltration → l'eau est piégée dans les cuvettes du DSM GLO-30 (arbres/toits). Ce n'est pas la section du canal qui limite : approfondir/élargir le canal brûlé n'est pas justifié ; priorité = MNT sans sursol (FABDEM) ou levé drone. Détails : prep/canal_all_inf1.0.json.
