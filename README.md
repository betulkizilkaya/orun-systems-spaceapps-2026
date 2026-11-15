<div align="center">

# MARTIAN MAP
### Jezero Mission Route Control

**Explore the terrain. Evaluate the route. Simulate the mission.**

**Orun Systems · NASA Space Apps Challenge 2026**  
*Interplanetary Survival Guide: Martian Map*

[Challenge](https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/) · [GitHub Repository](https://github.com/betulkizilkaya/orun-systems-spaceapps-2026) · [MIT License](LICENSE)

</div>

## Overview

**Martian Map** is an interactive, terrain-aware exploration and route-planning prototype focused on a **1 km × 1 km area of Jezero Crater, Mars**. It brings digital elevation and slope data, geological context, A* route planning, point-based terrain inspection, and an animated astronaut into a unified 3D mission-control interface.

The project was developed by **Orun Systems** for the **NASA Space Apps Challenge 2026**. It is an educational and research-oriented demonstration, **not** a flight-qualified navigation system or a certified astronaut safety assessment.

## What the application does

- **3D and overhead terrain exploration:** Render a Jezero terrain mesh from GeoTIFF elevation data, with interactive navigation and a 2D/3D viewing experience.
- **Terrain-aware A* planning:** Choose route endpoints and compute a four-neighbor grid path. The main planner applies slope-sensitive movement costs and flags steep sections; it does **not** universally prohibit slopes above 20°.
- **Route assessment:** Display route length, maximum encountered slope, and indicative difficulty warnings. These are prototype heuristics, not validated human-mobility limits.
- **Route comparison:** Compare the slope-aware route with an alternative distance-focused route, including distance and maximum-slope metrics.
- **Interactive terrain inspection:** Inspect local elevation, slope, and projected coordinates by pointing at the surface.
- **Slope statistics:** Explore mean, median, 95th-percentile, and maximum slope, plus the distribution of slope values across the study area.
- **Geological and panorama overlays:** Explore mapped geology and contextual Jezero imagery.
- **Scientific waypoints:** Display three proposed observation stops with modeled terrain and geological context.
- **Astronaut simulation:** Animate an astronaut along a **currently planned route** when one is selected. A prerecorded route is also available as fallback demonstration data. Playback includes Orbit, Follow, and POV camera modes and interactive controls.
- **Mission interface and audio:** Use a cinematic mission console with optional interface, transition, and voice cues.

## Technical approach

### Terrain data and visualization

The working DEM and slope GeoTIFFs cover **1,000 × 1,000 pixels** at approximately **1 m per pixel**, representing a **1 km²** Jezero study area. The application reads these rasters in the browser using `geotiff`, constructs a Three.js terrain mesh, and samples the original rasters for local elevation and slope readouts.

The working data use a **Mars equirectangular projected coordinate system**. Coordinates shown in the application are Mars-projected coordinates, **not Earth GPS coordinates**.

### Route planning

The principal route planner is implemented in `frontend/src/routePlanner.ts` and integrated through `frontend/src/jezeroTerrain.ts`.

1. The slope raster is aggregated into **10 m route cells**; the maximum valid slope within each cell is retained.
2. A* searches **four-connected neighbors** (no diagonal cell transitions).
3. The default planner assigns higher movement costs to steeper terrain, including additional penalties above indicative 20° and 30° thresholds.
4. An **optional hard maximum-slope constraint** is supported by the planning function. If no route meets a requested constraint, planning may fail.
5. Route diagnostics identify sections above the configured indicative thresholds and provide warnings.

**Important distinction:** The app's default interactive A* planner uses *soft slope penalties*. A separately saved **830 m demonstration route** was generated under a **20° hard cell-slope constraint**. These are not interchangeable claims about every route the app produces.

### Astronaut playback

`frontend/src/features/rover/createRoutePlayback.ts` converts the selected planned route into playback frames, samples terrain elevations and slopes, and calculates distance/progress for animation. The application preferentially uses this generated playback data; when no route is selected, it can load the prerecorded `jezero-rover-playback.json` demonstration. The 3D astronaut asset is a separately attributed third-party model.

### Scientific exploration

Three **illustrative, simulated** scientific observation stops are defined in `frontend/public/data/jezero-science-waypoints.json`:

| ID | Proposed observation | DEM-derived slope | Geological unit |
|---|---|---:|---|
| WP-01 | Surface Reconnaissance | 10.27° | Crater rim (`cr`) |
| WP-02 | Terrain Gradient Survey | 13.48° | Crater rim (`cr`) |
| WP-03 | Geomorphology Observation | 16.04° | Crater rim (`cr`) |

These are **proposed mission observations**, not sites sampled by an actual mission or certified safe destinations. The waypoint dataset is associated with the prerecorded demonstration route; do not assume its coordinates coincide with every newly generated interactive route.

## Validation and results

The project includes analytical artifacts, reference route data, and automated unit tests. The following results describe **specific documented checks**, not a blanket certification of the entire application:

| Check | Documented result | Scope / interpretation |
|---|---|---|
| DEM source comparison | **25 / 25** sampled points matched | Sample-based fidelity check, not an exhaustive pixel comparison |
| Slope raster reproducibility | **1,000,000 / 1,000,000** valid pixels matched | Recomputed using the same GDAL Horn method; confirms numerical reproducibility, not physical ground truth |
| Hard-constrained A* example | **830 m** route; **19.24°** maximum encountered route-cell slope | Saved reference example with a 20° maximum-cell-slope setting; not a universal interactive-route result |
| Route planner tests | Test cases for path selection, steep-cell penalties, optional hard constraints, invalid cells, and four-neighbor connectivity | Source-level tests; execute locally to confirm current pass status |

The saved 830 m example is available in `frontend/public/data/jezero-test-rotasi.json`. Earlier exploratory experiments use **different endpoints, parameters, or route definitions**, so their route lengths must not be presented as direct before/after comparisons.

The slope thresholds are **experimental interface and planning parameters**. The model does not fully simulate astronaut biomechanics, traction, loose-regolith failure, obstacles, or operational mission risk.

## Technology stack

| Layer | Technologies |
|---|---|
| UI | React 19, TypeScript, Vite |
| 3D rendering | Three.js, React Three Fiber, Drei |
| Terrain data | GeoTIFF, `geotiff` |
| Routing | Custom A* implementation and grid-based comparison logic |
| Testing | Vitest; Oxlint for linting |
| Analysis scripts | Python scripts and stored sensitivity-analysis results in `analysis/` |

## Getting started

### Prerequisites

- Node.js and npm compatible with the installed Vite toolchain (use a current supported Node.js release).
- Git.
- A modern browser with WebGL support.

### Install and run

```bash
git clone https://github.com/betulkizilkaya/orun-systems-spaceapps-2026.git
cd orun-systems-spaceapps-2026
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite (typically `http://localhost:5173`).

### Build, lint, and test

```bash
npm run build
npm run lint
npx vitest run
```

Run these commands **from `frontend/`**, after following the installation steps above. The ZIP snapshot was inspected for this README update; the commands above have not been executed as part of this documentation revision.

## Repository structure

```text
orun-systems-spaceapps-2026/
├── analysis/                         # Python analysis scripts and sensitivity results
├── frontend/
│   ├── public/
│   │   ├── audio/                   # Mission sound effects and voice cues
│   │   ├── data/                    # Jezero GeoTIFFs, geology, routes, waypoints
│   │   ├── mission/                 # Mission interface visuals
│   │   └── models/                  # Astronaut 3D model
│   ├── src/
│   │   ├── features/mission/        # Route/grid and mission interface components
│   │   ├── features/rover/          # Astronaut playback and cameras
│   │   ├── App.tsx                  # Integrated mission application
│   │   ├── jezeroTerrain.ts         # Terrain loading and route integration
│   │   ├── routePlanner.ts          # Slope-aware A* algorithm
│   │   ├── SlopeAnalysisPanel.tsx    # Regional slope statistics
│   │   └── useMissionAudio.ts       # Audio controls
│   └── package.json
├── LICENSE                           # MIT license for original project code
└── README.md
```

## Data, imagery, and research credits

**Terrain and geology**

- [USGS / Mars Sample Return: HiRISE DTM mosaic](https://astrogeology.usgs.gov/search/map/mars-sample-return-terrain-relative-navigation-hirise-dtm-mosaic) — source terrain elevation data.
- [USGS Scientific Investigations Map 3464](https://pubs.usgs.gov/publication/sim3464) — mapped geological units.
- [Freie Universität Berlin: Jezero maps and panoramas](https://maps.planet.fu-berlin.de/jezero/) — geographical and visual context.

**Mission imagery and third-party assets**

- [“Tripo Astronaut (animated)” by Jungle Jim, Sketchfab](https://sketchfab.com/3d-models/tripo-astronaut-animated-bf065335fc194bfeac12439b804f6135) — third-party astronaut model. **Verify and comply with the model's specific license and attribution requirements before redistribution.**
- Some illustrative Mars visuals were AI-generated; these are **artistic representations**, not scientific observations.
- Mission audio and other visual assets should be reviewed individually for their original licenses and attribution requirements.

**Scientific background**

- [Minetti et al. (2002), energy cost of walking on slopes](https://doi.org/10.1152/japplphysiol.01177.2001).
- [NASA, Apollo 11 Preliminary Science Report](https://www.nasa.gov/wp-content/uploads/static/history/alsj/a11/as11psr.pdf).
- [Slopes along Apollo EVAs (2024)](https://doi.org/10.1016/j.actaastro.2024.07.006).

These references provide context for terrain mobility and exploration; they do **not** establish a universal 20° safety limit for Mars surface travel.

## Team

**Orun Systems**

- **Selin Kübra Şimşek** — full-stack development, interface and integration.
- **Betül Kızılkaya** — terrain analysis, routing, scientific data and validation.

Developed for **NASA Space Apps Challenge 2026**, Sakarya local event (online participation).

## Licensing and use

Original source code developed by **Orun Systems** is released under the **MIT License**. See the repository [LICENSE](LICENSE) file for the complete terms.

**Copyright (c) 2026 Selin Kübra Şimşek and Betül Kızılkaya.**

The MIT License applies to the team's original source code only. It does not automatically cover third-party datasets, USGS/FU Berlin imagery and other materials, the Sketchfab astronaut model, AI-generated visual assets, or audio. These remain subject to their respective owners' licensing and attribution requirements.

**Disclaimer:** Martian Map is a prototype for exploration, education, and research communication. Route warnings and scientific waypoints are illustrative and must not be used for real mission safety decisions.
