<div align="center">

# ORUN SYSTEMS
### MARTIAN MAP | JEZERO MISSION ROUTE CONTROL

**Explore the terrain. Understand the risk. Visualize the journey.**

**NASA Space Apps Challenge 2026** · **Interplanetary Survival Guide: Martian Map** · **Sakarya Local Event (Online)**

[Challenge](https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/) · [Sources & references](#18-sources-scientific-references-and-visual-attribution) · [Run locally](#getting-started) · [Validation](#scientific-validation-and-results)

</div>

> **Research and educational prototype.** The application demonstrates terrain visualization, exploratory route planning, and simulated astronaut traversal. It does **not** provide flight-qualified navigation, certified slope limits, astronaut safety guidance, or verified field observations.

## 1. Mission overview

**Martian Map** is an interactive, browser-based exploration and route-planning prototype focused on a **1 km × 1 km study area in Jezero Crater, Mars**. Built by **Orun Systems** during NASA Space Apps Challenge 2026, it connects Mars elevation and slope data, mapped geological units, pathfinding experiments, and a terrain-following astronaut visualization in a mission-control-inspired interface.

The motivating question is: **How can an explorer understand Martian terrain and compare potential traverses before attempting to move across it?** Our approach makes terrain evidence visible and interactive while keeping experimental planning assumptions distinct from operational safety claims.

### Core capabilities

- **Interactive Mars terrain:** browser-rendered 3D terrain derived from a digital elevation model (DEM), with map inspection and camera interaction.
- **Terrain inspection:** point-and-inspect slope and elevation readouts linked to the underlying datasets.
- **Slope-aware route planning:** grid-based A* pathfinding, optional hard slope constraints, and slope-dependent movement costs.
- **Route comparison and profiles:** compare route choices and inspect route-related elevation and slope information.
- **Geological context:** two mapped units within the working study area, with spatially validated polygon coverage.
- **Science waypoints:** three illustrative observation locations associated with route frames, elevations, slopes, and geological membership.
- **Animated astronaut playback:** a 3D avatar aligned with DEM terrain, route-following animation, telemetry, and orbit/follow/POV camera experiences.
- **Panorama context:** approximate markers associated with the FU Berlin Jezero panorama viewer.
- **Mission interface:** responsive cinematic opening, luminous route animation, mission controls, and interaction sounds.

## 2. Technology stack

| Layer | Technologies |
|---|---|
| Web application | React 19, TypeScript, Vite 8 |
| 3D rendering | Three.js, React Three Fiber, React Three Drei |
| Raster loading | GeoTIFF JavaScript library |
| Route planning | TypeScript A* implementation, four-neighbor grid traversal, binary min-heap priority queue |
| Terrain and geology preparation / scientific validation | GDAL, QGIS/Python, Shapely, geospatial analysis scripts and exported results |
| Tests and quality tools | Vitest, TypeScript compiler, Oxlint |
| Data interchange | GeoTIFF, JSON, GLB, raster-derived textures |

The frontend runs in the browser. Scientific processing and validation scripts are separate from the interactive application.

## 3. System architecture

```text
Mars source elevation + geology
          |
          v
Geospatial preprocessing / CRS alignment
          |
          +--> 1 m DEM + 1 m slope raster
          +--> projected geological polygons
          +--> panorama / waypoint / playback JSON
          |
          v
React + TypeScript application
          |
          +--> Three.js terrain scene and exploration
          +--> grid generation and slope-aware routing
          +--> route comparison / profiles / telemetry
          +--> astronaut animation and camera controllers
          +--> science and geology overlays
          |
          v
Interactive mission-planning demonstration
```

### Important implementation modules

| File / directory | Responsibility |
|---|---|
| `frontend/src/App.tsx` | Main application composition and mission interaction |
| `frontend/src/jezeroTerrain.ts` | Terrain loading, mesh construction, and surface projection |
| `frontend/src/routePlanner.ts` | Slope-aware A* pathfinding |
| `frontend/src/routeDifficulty.ts` | Prototype route difficulty categories |
| `frontend/src/routeSegmentValidation.ts` | Route segment validation logic |
| `frontend/src/features/mission/routeGrid.ts` | Planning-grid operations |
| `frontend/src/features/mission/MissionScene.tsx` | 3D mission-scene elements |
| `frontend/src/features/mission/TerrainInspectionPanel.tsx` | Terrain inspection interface |
| `frontend/src/features/mission/RouteProfile.tsx` | Route profile presentation |
| `frontend/src/GeologyLayer.tsx` | Geological overlay |
| `frontend/src/PanoramaLayer.tsx` and `PanoramaDialog.tsx` | Panorama markers and viewer |
| `frontend/src/features/rover/AstronautModel.tsx` | GLB astronaut and embedded animation |
| `frontend/src/features/rover/RoverPlayback.tsx` | Route-based character playback and telemetry |
| `frontend/src/features/rover/RoverCamera.tsx` | Camera behavior |
| `frontend/src/features/rover/JezeroWalkControls.tsx` | Integrated walk controls |
| `frontend/src/features/rover/roverPlaybackData.ts` | Playback data parsing and interpolation |
| `frontend/src/useMissionAudio.ts` | Mission sound integration |
| `analysis/route_sensitivity_analysis.py` | Route sensitivity experiments |
| `analysis/generate_rover_playback.py` | Playback data generation |

## 4. Getting started

### Requirements

- Node.js version compatible with the checked-in Vite 8 and TypeScript 7 toolchain (use a current supported Node.js release).
- npm
- Modern browser with WebGL support

```bash
git clone <YOUR-REPOSITORY-URL>
cd orun-systems-spaceapps-2026/frontend
npm ci
npm run dev
```

Open the local URL printed by Vite (typically `http://localhost:5173`).

### Production build

```bash
cd frontend
npm run build
npm run preview
```

### Static checks

```bash
cd frontend
npm run lint
npx vitest run
```

`npm run build` performs TypeScript project compilation followed by a Vite production build. The repository includes unit-test files for route planning, route segment validation, and mission grid logic. **Commands above describe how to run checks; they are not a claim that every check passed on the final release commit.**

### Runtime data and assets

Vite serves the assets in `frontend/public/` at the site root. Keep the public data and model files in place, particularly:

```text
frontend/public/
├── data/
│   ├── jezero-demo-dem.tif
│   ├── jezero-demo-slope.tif
│   ├── jezero-geology.json
│   ├── jezero_4camera_positions.json
│   ├── jezero-science-waypoints.json
│   ├── jezero-rover-playback.json
│   ├── jezero-test-rotasi.json
│   └── jezero_4camera_slope_analysis.json
├── models/
│   └── astronaut.glb
├── mission/
│   └── [mission imagery and opening-screen assets]
└── audio/
    └── [interface and mission audio assets]
```

The source ZIP also contains development/build outputs; `node_modules/` and `dist/` should generally **not** be committed as source files. Confirm your `.gitignore` before pushing.

## 5. Scientific data and provenance

### Study area

| Property | Working dataset |
|---|---|
| Location | Jezero Crater region, Mars |
| Study footprint | 1,000 m × 1,000 m |
| DEM resolution / shape | 1 m pixels; 1,000 × 1,000 |
| Slope raster | Pixel-aligned with DEM; 1,000 × 1,000 |
| Working projection | Mars equirectangular / Equidistant Cylindrical |
| Mars reference radius | 3,396,190 m |
| Projected X bounds | 4,579,240–4,580,240 m |
| Projected Y bounds | 1,093,741–1,094,741 m |
| Geological units | `cr` (crater rim), `Nnp1` (Nili Planum 1) |

Working CRS:

```text
+proj=eqc +lat_ts=0 +lat_0=0 +lon_0=0 +R=3396190 +units=m
```

**These are Mars-projected coordinates, not Earth GPS coordinates.** Distances and planar polygon areas are interpreted in the working projection.

### Source datasets

1. **USGS Mars Sample Return HiRISE terrain-relative-navigation DTM mosaic:** source for the processed DEM. [USGS dataset](https://astrogeology.usgs.gov/search/map/mars-sample-return-terrain-relative-navigation-hirise-dtm-mosaic).
2. **USGS Scientific Investigations Map 3464:** source geological mapping (`GeoUnits_v1`, Nili geodatabase). [Publication](https://pubs.usgs.gov/publication/sim3464) · [Explanatory pamphlet](https://pubs.usgs.gov/sim/3464/sim3464_pamphlet.pdf).
3. **FU Berlin Jezero map and panoramas:** external context for approximate panorama markers. [Viewer](https://maps.planet.fu-berlin.de/jezero/).
4. **NASA/JPL-Caltech Mars 2020 imagery:** reference imagery where applicable. [NASA Mars 2020 raw images](https://mars.nasa.gov/mars2020/multimedia/raw-images/).

Original DEM mosaic identified in the validation report:

```text
MSR_hirise_soc_003_DTM_MOLATopography_DeltaGeoid_1m_Eqc_latTs0_lon0_Blend40.tif
```

Processed study-area DEM: `jezero_4camera_dem_1km.tif`. Processed geological layer: `jezero_4camera_geology_1km.gpkg`. The deployed frontend uses browser-oriented derivatives of the source geospatial files.

## 6. Terrain processing and visualization

The application loads elevation and slope raster derivatives, constructs an interactive 3D terrain surface, and maps projected terrain positions into the rendered scene. Elevation determines the surface position; slope supports inspection, visualization, and planning costs. The geology overlay provides mapped-unit context, not a substitute for geological fieldwork.

A pointer-based exploration tool displays the modeled elevation and slope of selected terrain locations. The values depend on raster sampling and the application's coordinate transform. This interaction is **not** an independently calibrated measuring instrument.

### Terrain-wide slope summary from the supplied analysis artifact

| Statistic | Reported slope |
|---|---:|
| Mean | 15.18° |
| Median | 14.95° |
| 95th percentile | 25.86° |
| Maximum | 47.13° |

These statistics are recorded in the project's historical analysis artifact. **Recompute them against the final shipped slope raster before using them as independently verified final-release statistics.**

## 7. Route planning methodology

### Grid and search model

The documented application demonstration derives a **100 × 100 planning grid** from aligned **1 m DEM and slope rasters**. Each planning cell represents a **10 m × 10 m** region, and its representative slope is the **maximum** of the constituent 1 m slope pixels. This is a conservative aggregation rule within the prototype, not a physical hazard certification.

Routing uses **A*** with **four-neighbor** (north/south/east/west) movement. The TypeScript implementation supports slope-based movement penalties and an optional maximum-allowed-slope parameter. Hard constraints reject inadmissible cells; soft penalties influence the preferred path without necessarily forbidding steep cells.

The heuristic is based on Manhattan grid distance. The application also exposes route comparison and profile information to help communicate trade-offs between distance and modeled slope exposure.

### Final documented application route: 830 m

| Metric | Value |
|---|---:|
| Planning grid | 100 × 100 cells |
| Cell size | 10 m |
| Search | Four-neighbor A* |
| Experimental maximum cell slope | 20° |
| Start cell | (31, 6) |
| Destination cell | (99, 19) |
| Projected start | (4,579,305 m, 1,094,426 m) |
| Projected destination | (4,579,435 m, 1,093,746 m) |
| Horizontal grid-route distance | **830 m** |
| Maximum encountered cell slope | **19.237327575683594°** |
| Traversed cells | **84** |
| Saved coordinate records | **86**, including duplicated endpoint cell centers |

The route is stored as `frontend/public/data/jezero-test-rotasi.json`. The application-level comparison checked record count, distance (0.001 m tolerance), maximum slope (0.00001° tolerance), and projected route coordinates (0.001 m tolerance). A browser verification message reported **84 cells**, **830 m**, and **19.2°**.

**Important:** A UI message mentioned Dijkstra verification, but the documented planner is A*. Matching a saved route establishes application-level reproducibility; it does **not** independently prove Dijkstra optimality.

### Earlier route prototype: separate experimental scenario

The original profile and slope-exposure analysis describes a **different** route, with different endpoints and assumptions:

| Metric | Historical prototype |
|---|---:|
| Ordered vertices | 111 |
| Horizontal length | 1,087.59 m |
| Start / end elevation | −1,971.98 m / −1,770.49 m |
| Net elevation change | +201.49 m |
| Cumulative ascent / descent | 202.77 m / 1.28 m |
| Cells at slope ≥15° | 64/109 (58.72%) |
| Cells at slope ≥20° | 25/109 (22.94%) |
| Cells at slope ≥30° | 4/109 (3.67%) |

The slope percentages above count **unique route cells**, not continuous distance-weighted exposure. **Do not interpret the historical 1,087.59 m route as the final 830 m route.** Likewise, the prerecorded astronaut playback is a separate data asset; the two route coordinate sequences should not be assumed identical without explicit comparison.

## 8. Scientific validation and results

The following summarizes the team's 13-page technical evidence report dated 14–15 November 2026. Evidence strength and limitations are stated alongside results.

### 8.1 DEM provenance sampling

- **25/25** corresponding sample elevations agreed between the processed DEM and original mosaic.
- Maximum absolute difference: **0.0 m**.
- Mean absolute difference: **0.0 m**.
- **Scope:** this is a 25-location sample comparison, **not** proof that all source and processed DEM pixels are identical.

### 8.2 Slope raster reproducibility

The slope raster was independently recomputed from the processed DEM with **GDAL `DEMProcessing`**, **Horn algorithm**, **degrees**, and **`computeEdges=True`**.

- Compared valid pixels: **1,000,000 / 1,000,000**.
- Mean absolute slope difference: **0.0°**.
- Maximum absolute slope difference: **0.0°**.
- Pixels within 0.1°: **100%**.

This validates numerical agreement with the **tested processing method**, not independent accuracy of the underlying Mars terrain measurements.

### 8.3 Geology provenance and topology

The two processed geological features were transformed back into their source Mars Transverse Mercator projection and compared against the matching USGS source feature IDs.

| Geological unit | Source ID | Working-area coverage | Share | Source-feature overlap |
|---|---:|---:|---:|---:|
| Crater rim (`cr`) | 1004 | 865,681.17 m² | 86.57% | 100% |
| Nili Planum 1 (`Nnp1`) | 1028 | 134,318.83 m² | 13.43% | 100% |
| **Total** | | **1,000,000 m²** | **100%** | **0 m² mutual overlap** |

The polygon union matches the study rectangle, with **0 m² gap** and **0 m² intersection** between the final units. Area comparisons across projections must account for projection-dependent planar measurements. Geometric provenance does not independently certify geological interpretation.

### 8.4 Hard slope-limit sensitivity experiment

A separate study used 10 m maximum-slope cells, four-neighbor A*, start **(31, 6)** and destination **(85, 60)**, with slope-cost weights **0, 0.5, 1, 2, 5**.

| Hard maximum | Result |
|---|---|
| 10° | No route; start cell exceeds limit |
| 15° | No route; start cell slope is 18.56° |
| 20° | Both endpoints admissible but disconnected |
| 25° | Route found: 1,120 m at weights 0–2; 1,140 m at weight 5 |

At 25°, the reported maximum encountered slope was **24.50°** for weights 0–2 and **23.42°** for weight 5.

**Independent connectivity cross-check:** breadth-first search (BFS) found **1,849** cells reachable from the start under the 20° threshold, excluding the destination; under 25°, **8,110** cells were reachable and the destination was included. This supports the connectivity conclusion under the same grid assumptions.

The 20° threshold in this historical experiment **does not conflict** with the successful 830 m / 20° application demonstration: **the destination is different**.

### 8.5 Soft slope-penalty sensitivity experiment

A second experiment removed the hard slope cap and varied the slope weight from **0 to 20**. The reported grid-step distance remained **1,080 m** across tested configurations.

| Metric | Weight 0 (distance only) | Weights 0.5–20 |
|---|---:|---:|
| Horizontal grid distance | 1,080 m | 1,080 m |
| Maximum encountered cell slope | 35.25° | 33.49° |
| Modeled exposure above 15° | 960 m | 630 m |
| Modeled exposure above 20° | 580 m | 250 m |
| Modeled exposure above 25° | 190 m | 80 m |

**Result:** the reported exposure above 20° fell by **330 m (56.9%)** without increasing grid-step distance. These exposure distances are derived from counts of 10 m cells; they are not direct high-resolution continuous terrain exposure measurements. Similar reported summary metrics do not establish identical path geometries.

Experiment outputs:

```text
analysis/results/route_sensitivity_results.csv
analysis/results/route_sensitivity_results.json
analysis/results/route_weight_sensitivity.csv
analysis/results/route_weight_sensitivity.json
```

The hard-limit and soft-penalty studies use different optimization conditions and should not be conflated.

## 9. Astronaut simulation

The integrated mission view includes a 3D animated astronaut traveling along a **precomputed route** over the DEM surface.

### How playback works

1. Load the animated GLB model from `frontend/public/models/astronaut.glb`.
2. Load route frames from `frontend/public/data/jezero-rover-playback.json`.
3. Interpolate between ordered route positions.
4. Convert projected route positions into scene coordinates.
5. Use terrain surface projection to align the avatar vertically with the rendered DEM.
6. Orient the avatar according to the travel direction.
7. Play/pause the model's embedded animation with playback state.
8. Update distance, elevation, slope, heading, and camera state in the interface.

### Camera modes and controls

| Mode | Behavior |
|---|---|
| Orbit | Free terrain inspection |
| Follow | Third-person tracking from behind |
| POV | First-person-style directional view |
| Playback | Play, pause, reset, speed adjustment, and camera switching |

The original technical report documented successful standalone integration testing. A later application addendum documented the astronaut rendered in the primary interface and a user-observed complete traversal that stopped at the end of the playback sequence.

**Simulation boundary:** animation and playback speed are presentation features. The application does not simulate suit biomechanics, traction, collisions, foot placement, life-support consumption, or actual astronaut locomotion dynamics. Accelerated playback is not a plausible human walking-speed prediction.

## 10. Science waypoints

Three illustrative observation stops are associated with the **recorded playback route**, not asserted as completed scientific fieldwork.

| ID | Proposed activity | Playback frame | Distance along playback | Slope | DEM elevation |
|---|---|---:|---:|---:|---:|
| WP-01 | Surface reconnaissance | 100 | 199.9243 m | 10.2730° | −1,958.6002 m |
| WP-02 | Terrain-gradient survey | 270 | 539.7957 m | 13.4817° | −1,867.2047 m |
| WP-03 | Geomorphology observation | 440 | 879.6670 m | 16.0420° | −1,790.6871 m |

All three waypoints intersect the mapped **`cr` (crater rim)** geological unit. The team checked **545 playback frames**, finding **0 frame positions** within `Nnp1`. This frame-sampling result does **not** prove every continuous segment between frames avoids `Nnp1`.

The team also compared seven numeric fields for each waypoint against its indexed playback frame (`projectedX`, `projectedY`, `elevationM`, `slopeDeg`, `distanceM`, `localX`, `localY`) with a **0.001-unit tolerance**. **All three passed**. This is internal dataset consistency, not independent survey-grade validation.

Waypoint dataset: `frontend/public/data/jezero-science-waypoints.json`.

## 11. Panorama and geological context

Four approximate panorama references are associated with the FU Berlin Jezero viewer:

| Marker | Panorama location |
|---|---|
| #44 | Broom Point |
| #43 | South Arm |
| #42 | Trout River / Shallow Bay |
| #41 | Lookout Hill |

Marker coordinates and elevations are **approximate DEM-linked visualization inputs**, not independently verified survey-grade camera positions. Confirm original image licensing and authoritative localization before using imagery or marker positions in other products.

## 12. User experience and accessibility

The project includes a mission-control-style opening experience, terrain and route panels, animated visual transitions, and audio feedback for selected interactions. The opening uses a stylized Mars background, transparent JEZERO heading art, and a repeating luminous route-path effect. The continuous opening animation is disabled when the user requests reduced motion through `prefers-reduced-motion`.

Some mission imagery is **illustrative or AI-generated**, rather than direct observational imagery. These visuals should remain labeled accordingly wherever their origin could be misunderstood.

## 13. Repository structure

```text
orun-systems-spaceapps-2026/
├── README.md
├── analysis/
│   ├── generate_rover_playback.py
│   ├── route_sensitivity_analysis.py
│   └── results/
│       ├── route_sensitivity_results.csv
│       ├── route_sensitivity_results.json
│       ├── route_weight_sensitivity.csv
│       └── route_weight_sensitivity.json
└── frontend/
    ├── public/
    │   ├── audio/
    │   ├── data/
    │   ├── mission/
    │   └── models/
    ├── src/
    │   ├── features/
    │   │   ├── mission/
    │   │   └── rover/
    │   ├── App.tsx
    │   ├── jezeroTerrain.ts
    │   ├── routePlanner.ts
    │   ├── GeologyLayer.tsx
    │   └── PanoramaLayer.tsx
    ├── package.json
    ├── package-lock.json
    └── vite.config.ts
```

This is a condensed map of important source files, not a complete inventory.

## 14. Reproducibility and evidence levels

| Claim | Evidence | Interpretation |
|---|---|---|
| Processed DEM matches source at sampled locations | 25 matching samples | Sample-level provenance only |
| Slope calculation is reproducible | 1,000,000 matching pixels using GDAL Horn | Algorithm-specific numerical reproducibility |
| Mapped geological units cover the working area | Polygon union and intersection tests | Spatial/topological consistency |
| Route feasibility changes with hard slope threshold | A* and independent BFS experiments | Valid under the tested grid model |
| Soft slope penalty reduces modeled steep-cell exposure | Parameter sensitivity experiment | Comparative model result |
| 830 m example matches saved route | Frontend coordinate/distance/slope checks | Application-level reproducibility |
| Waypoints agree with playback records | Seven-field checks for all three stops | Internal dataset consistency |
| Astronaut reaches the end of playback | Browser-level visual acceptance observation | UI behavior, not physical validation |
| Terrain inspection exposes slope and elevation | User-reported interaction | Exploratory display, not calibrated measurement |

The full **Orun Systems Scientific Data Validation** report (13 pages, 14–15 November 2026) documents original methods, experimental conditions, outputs, and limitations. Include the report in the public repository if its contents and embedded material have been cleared for redistribution, then link its actual committed path here.

## 15. Known limitations

- **No certified traversability:** slope thresholds are experimental application parameters, not NASA-approved astronaut or rover operating limits.
- **Coarse planning model:** 10 m cells, maximum-pixel slope aggregation, and four-neighbor movement simplify the terrain.
- **No physical hazards model:** rock size, traction, regolith bearing strength, wheel–soil mechanics, suit biomechanics, uncertainty, and dynamic stability are not simulated.
- **Source uncertainty:** agreement between processed data and source data does not establish the original measurements' absolute accuracy.
- **Geological interpretation:** geometric consistency does not independently prove the scientific correctness of mapped units.
- **Waypoints:** proposed observation locations are not actual scientific observations or samples.
- **Route separation:** historical route experiments, the 830 m frontend route, and astronaut playback are distinct datasets unless explicitly matched.
- **Panorama positions:** approximate visualization markers, not authoritative camera geolocation.
- **Verification scope:** final production deployment and independent end-to-end regression testing are not established by the supplied scientific report.

## 16. Future work

Potential next steps include eight-neighbor and continuous-space routing; multi-objective optimization; uncertainty-aware elevation and hazard modeling; more realistic terrain mobility constraints; automated geospatial regression tests; explicit comparison between planned and playback routes; richer science-point interactions; and deployment-level performance/accessibility audits.

These are **future directions**, not claims about current functionality.

## 17. Credits and third-party attribution

**Project:** Orun Systems · NASA Space Apps Challenge 2026 · Sakarya local event (online)

**Team:** Selin (full-stack development and interface integration); Betül (machine learning/data analysis and geospatial/scientific work). The project was developed collaboratively; the labels describe primary focus areas rather than exclusive ownership of every contribution.

**Scientific datasets and context:** USGS Astrogeology Science Center, USGS Scientific Investigations Map 3464, NASA/JPL-Caltech Mars 2020 resources, and Freie Universität Berlin Jezero viewer. Credit and redistribution requirements for each source must be checked individually.

**Astronaut asset:** [“Tripo Astronaut (animated)” by Jungle Jim on Sketchfab](https://sketchfab.com/3d-models/tripo-astronaut-animated-bf065335fc194bfeac12439b804f6135). The development report identified the asset as Creative Commons Attribution; **verify the asset's current license and conditions before redistributing its GLB**. Preserve author credit and a link to the applicable license; disclose modifications where required.

**Audio and artwork:** Original, generated, and externally sourced assets should be identified in a separate attribution inventory before public reuse. Do not assume that a license covering original code also covers every asset.

**NASA affiliation disclaimer:** Participation in NASA Space Apps Challenge does not imply NASA endorsement, certification, or sponsorship of this particular application.

## 18. Sources, scientific references and visual attribution

The references below distinguish **datasets actually used for the terrain prototype**, **scientific background literature**, and **visual presentation assets**. A citation to a scientific publication does not mean that its results were directly implemented or experimentally validated in this application.

### 18.1 Mars imagery, maps and application visuals

| Source | Credit and purpose | Link |
| --- | --- | --- |
| NASA / JPL-Caltech, Mars 2020 | Mars mission imagery and visual reference; image-specific credits and use conditions still apply | [Mars 2020 raw images](https://mars.nasa.gov/mars2020/multimedia/raw-images/) |
| Freie Universität Berlin (FU Berlin) | Jezero maps and panorama visualization references; approximate markers are not survey-grade positions | [Jezero maps and panoramas](https://maps.planet.fu-berlin.de/jezero/) |
| Orun Systems | Screenshots captured from the team's Martian Map application; original interface work, subject to any visible third-party assets | Project-generated screenshots |
| AI-generated imagery | Artistic, illustrative representations of Mars, **not** observational photographs or scientific terrain evidence | AI-generated presentation artwork; identify the generating service and applicable terms in the asset inventory if available |

### 18.2 Scientific literature and astronaut mobility context

1. **Minetti et al. (2002), _Energy Cost of Walking on Slopes_.** Background reference on the energetics of inclined walking. [DOI: 10.1152/japplphysiol.01177.2001](https://doi.org/10.1152/japplphysiol.01177.2001). This terrestrial study is contextual literature, **not** a validated Mars EVA energy-consumption model for this application.
2. **NASA, _Apollo 11 Preliminary Science Report_.** Historical lunar EVA and mission science context. [NASA PDF](https://www.nasa.gov/wp-content/uploads/static/history/alsj/a11/as11psr.pdf). Apollo lunar observations do not establish Mars-specific mobility limits.
3. **_Slopes along Apollo EVAs_ (2024).** Background reference on slope exposure during Apollo extravehicular activities. [DOI: 10.1016/j.actaastro.2024.07.006](https://doi.org/10.1016/j.actaastro.2024.07.006). Cited for research context, not as validation of the prototype's 20° configuration.

### 18.3 Geospatial datasets and technical sources

- **USGS Mars Sample Return HiRISE terrain-relative-navigation DTM mosaic:** [USGS source](https://astrogeology.usgs.gov/search/map/mars-sample-return-terrain-relative-navigation-hirise-dtm-mosaic).
- **USGS Scientific Investigations Map 3464:** [Publication](https://pubs.usgs.gov/publication/sim3464) and [explanatory pamphlet](https://pubs.usgs.gov/sim/3464/sim3464_pamphlet.pdf). Source for the geological mapping used in the study area.
- **GDAL DEMProcessing (Horn slope method):** numerical procedure used for the slope-raster reproducibility check; see the validation section and the technical report for the parameters.
- **Project validation artifacts:** `DATA_README.md`, route analysis outputs, waypoint/playback JSON, and the team's **Orun Systems scientific validation report** (add the PDF to `docs/` if distributing it).
- **Third-party astronaut model:** [“Tripo Astronaut (animated)” by Jungle Jim, Sketchfab](https://sketchfab.com/3d-models/tripo-astronaut-animated-bf065335fc194bfeac12439b804f6135). Confirm the license and preserve the attribution and any modification notices required by the asset's terms.

**Attribution and reuse note:** Public access to these URLs does not by itself authorize redistribution of every associated image, map, model, or dataset. Keep original creator credits and review the applicable terms asset by asset. NASA participation is not an endorsement of this project.

## 19. License and reuse

### MIT License

Copyright (c) 2026 Selin Kübra Şimşek and Betül Kızılkaya

The original source code developed by **Orun Systems** for the NASA Space Apps Challenge 2026 is licensed under the **MIT License**.

See the [LICENSE](LICENSE) file for the complete license terms.

### Third-party assets and attribution

The MIT License applies only to the original source code authored by the project contributors.

Third-party assets, including NASA/JPL-Caltech imagery, USGS datasets, FU Berlin resources, 3D models, sound effects, and other externally sourced materials, remain subject to their respective licenses and usage conditions.

AI-generated imagery is used for illustrative and presentation purposes and does not represent scientifically verified Martian terrain.

All external resources and scientific references are acknowledged in the **Sources, Scientific References and Visual Attribution** section above.

**Orun Systems does not claim ownership of third-party materials or grant additional rights to redistribute them.**

---

---

<div align="center">

**ORUN SYSTEMS · MARTIAN MAP**

*An interactive research prototype for understanding a small piece of the Martian surface.*

</div>
