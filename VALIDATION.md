| Quartier signalé | Événement | Prof. max simulée (m) | ha >20 cm (r=400 m) | Médiane ha tous quartiers |
|---|---|---|---|---|
| Bonheur Ville | 2-3 août 2026 | 0.3 | 0.2 | 0.1 |
| Kalgodin | 24 juil. 2025 | 0.38 | 0.5 | 0.4 |
| Kalgondin | 24 juil. 2025 | 0.25 | 0.2 | 0.4 |
| Nagrin | 2-3 août 2026 | 0.36 | 0.4 | 0.1 |
| Nioko | 5 sept. 2020 | 0.81 | 10.6 | 1.0 |
| Rimkiéta | 16 août 2024 | 2.91 | 12.8 | 0.8 |
| Somgande | 5 sept. 2020 | 0.3 | 0.3 | 1.0 |
| Somgandé | 5 sept. 2020 | 0.3 | 0.3 | 1.0 |
| Tanghin | 5 sept. 2020 | 0.3 | 0.8 | 1.0 |
| Toécin | 16 août 2024 | 0.54 | 1.7 | 0.8 |
| Wemtenga | 3 août 2022 | 0.13 | 0.0 | 0.2 |
| Zone 1 | 5 sept. 2020 | 0.41 | 2.6 | 1.0 |
| Zone 1 | 3 août 2022 | 0.36 | 0.5 | 0.2 |

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


## v3 (21 oct. 2026) – relief FABDEM V1-2

Relief : FABDEM V1-2 (Copernicus GLO-30 sans bâtiments ni arbres, Univ. Bristol/Fathom, CC BY-NC-SA 4.0, non commercial) à la place du DSM GLO-30. Rues abaissées, canaux brûlés, pluies observées et toits inchangés par rapport à v2. Aucune calibration supplémentaire : la cible citoyenne est atteinte sans retouche (voir ci-dessous) ; on n'a pas modifié la section du canal ni des dalots faute de mesures.

Le tableau en tête de fichier est celui de v3. Quartiers signalés au-dessus de la médiane : v2 6/13 → v3 8/13 ; rapport moyen ha>20 cm / médiane : 1,09 → 3,3 (les fausses cuvettes du DSM disparaissent, la médiane baisse, l'eau se concentre dans les talwegs). Profondeurs max plus faibles hors talwegs (Somgandé, Tanghin, Wemtenga : 0,1-0,3 m, sous-estimation probable).

### Point de validation citoyen (anonymisé) – ruelle près du canal, Ouaga 2000

Signalement d'un habitant (~40-60 m du canal, près du commissariat de Ouaga 2000) : lors des fortes pluies, toute la ruelle de 6 m, de la maison jusqu'au goudron, est sous 50-70 cm d'eau, alimentée par le débordement du canal (juillet 2026 et années précédentes). Ruelle en terre OSM d'environ 68 m (4 mailles de 20 m) :

| Scénario (pluie) | v2 (GLO-30) moy / max | v3 (FABDEM) moy / max | part de la ruelle > 30 cm (v3) |
|---|---|---|---|
| 2-3 août 2026 (24 mm aéroport) | 0,00 / 0,01 m | 0,06 / 0,15 m | 0 % |
| 3 août 2022 (31 mm) | 0,00 / 0,01 m | 0,07 / 0,16 m | 0 % |
| 24 juil. 2025 (37 mm) | 0,00 / 0,01 m | 0,11 / 0,20 m | 0 % |
| 16 août 2024 (58 mm) | 0,00 / 0,01 m | **0,44 / 0,52 m** | 100 % |
| 5 sept. 2020 (90,5 mm) | 0,01 / 0,01 m | **0,60 / 0,68 m** | 100 % |
| T10 (100 mm) | 0,01 / 0,01 m | 0,63 / 0,71 m | 100 % |

Ruelle voisine N-S (canal → route secondaire) en v3 : 2024 moy 0,50 / max 0,59 m ; 2020 0,65 / 0,74 m. → Concordance pour les orages ≥ ~58 mm ; pour 24-37 mm (cumuls de l'aéroport, peut-être inférieurs à la pluie locale) le modèle reste sous la cible.

Canal (bassin versant au pont N5 / rond-point Biim de Karpala : 17,1 km² en v3) : coefficient d'écoulement 0,03 → 0,57 (2024), 0,00 → 0,38 (2025), 0,00 → 0,24 (2026) ; débit de pointe 2024 3,5 → 69 m³/s. Détails : prep/canal_all_inf1.0.json.
