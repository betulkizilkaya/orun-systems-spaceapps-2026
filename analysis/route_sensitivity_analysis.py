
import csv
import heapq
import json
import math
from pathlib import Path

import numpy as np
import rasterio

# ------------------------------------------------------------
# ORUN SYSTEMS | MARTIAN ROUTE SENSITIVITY ANALYSIS
# Experimental thresholds are NOT certified rover limits.
# ------------------------------------------------------------

ROOT = Path(__file__).resolve().parents[1]

DATA_DIR = (
    Path.home()
    / "OneDrive"
    / "Masaüstü"
    / "Orun-Systems-Resources"
    / "02_Mars_DEM"
)

SLOPE_PATH = DATA_DIR / "jezero_4camera_slope_1km.tif"
ROUTE_PATH = DATA_DIR / "jezero-test-rotasi.json"

OUTPUT_DIR = ROOT / "analysis" / "results"

CELL_SIZE = 10
THRESHOLDS = [10, 15, 20, 25]
WEIGHTS = [0, 0.5, 1, 2, 5]

# Same four-neighbor grid convention as previous analysis.
DIRECTIONS = [(1, 0), (-1, 0), (0, 1), (0, -1)]


def load_inputs():
    with open(ROUTE_PATH, "r", encoding="utf-8") as f:
        route = json.load(f)

    with rasterio.open(SLOPE_PATH) as src:
        slope = src.read(1, masked=True).filled(np.nan)
        transform = src.transform

    return route, slope, transform


def aggregate_slope(slope, cell_size):
    """Maximum valid 1 m slope within each 10 m grid cell."""
    height, width = slope.shape

    if height % cell_size or width % cell_size:
        raise ValueError("Raster dimensions must be divisible by cell size.")

    rows = height // cell_size
    cols = width // cell_size

    reshaped = slope.reshape(
        rows, cell_size, cols, cell_size
    )

    valid = np.isfinite(reshaped)

    maximum = np.where(valid, reshaped, -np.inf).max(axis=(1, 3))
    maximum[~valid.all(axis=(1, 3))] = np.nan

    return maximum


def astar(grid, start, goal, threshold, weight):
    rows, cols = grid.shape

    def allowed(r, c):
        return (
            0 <= r < rows
            and 0 <= c < cols
            and np.isfinite(grid[r, c])
            and grid[r, c] <= threshold
        )

    if not allowed(*start) or not allowed(*goal):
        return None

    def heuristic(node):
        return (
            abs(node[0] - goal[0])
            + abs(node[1] - goal[1])
        )

    queue = [(heuristic(start), 0.0, start)]
    costs = {start: 0.0}
    previous = {}

    while queue:
        _, current_cost, current = heapq.heappop(queue)

        if current_cost > costs.get(current, math.inf):
            continue

        if current == goal:
            path = [current]

            while current in previous:
                current = previous[current]
                path.append(current)

            return path[::-1]

        for dr, dc in DIRECTIONS:
            nr = current[0] + dr
            nc = current[1] + dc
            neighbor = (nr, nc)

            if not allowed(nr, nc):
                continue

            # Dimensionless experimental cost:
            # one grid step + slope penalty.
            step_cost = 1 + weight * (grid[nr, nc] / 15)
            new_cost = current_cost + step_cost

            if new_cost < costs.get(neighbor, math.inf):
                costs[neighbor] = new_cost
                previous[neighbor] = current

                priority = new_cost + heuristic(neighbor)
                heapq.heappush(
                    queue, (priority, new_cost, neighbor)
                )

    return None


def route_metrics(path, grid, threshold):
    if path is None:
        return {
            "found": False,
            "distance_m": None,
            "max_slope_deg": None,
            "exposure_cells": None,
            "exposure_distance_m": None,
            "exposure_percent": None,
        }

    # Exclude the start cell from traversal exposure.
    traversed = path[1:]
    slopes = [float(grid[r, c]) for r, c in traversed]

    exposure = sum(s > threshold for s in slopes)

    return {
        "found": True,
        "distance_m": len(traversed) * CELL_SIZE,
        "max_slope_deg": max(slopes) if slopes else float(grid[path[0]]),
        "exposure_cells": exposure,
        "exposure_distance_m": exposure * CELL_SIZE,
        "exposure_percent": (
            100 * exposure / len(traversed) if traversed else 0
        ),
    }


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    route, slope, transform = load_inputs()

    grid = aggregate_slope(slope, CELL_SIZE)

    start_point = route["points"][0]
    end_point = route["points"][-1]

    start = (
        int(start_point["routeCellRow"]),
        int(start_point["routeCellColumn"]),
    )

    goal = (
        int(end_point["routeCellRow"]),
        int(end_point["routeCellColumn"]),
    )

    print("START:", start)
    print("GOAL:", goal)
    print("GRID:", grid.shape)
    print("START SLOPE:", grid[start])
    print("GOAL SLOPE:", grid[goal])

    results = []
    paths = {}

    for threshold in THRESHOLDS:
        for weight in WEIGHTS:
            path = astar(grid, start, goal, threshold, weight)
            metrics = route_metrics(path, grid, threshold)

            record = {
                "threshold_deg": threshold,
                "slope_weight": weight,
                **metrics,
            }

            results.append(record)

            if path is not None:
                paths[f"threshold_{threshold}_weight_{weight}"] = [
                    {"row": r, "column": c}
                    for r, c in path
                ]

            status = (
                f"{metrics['distance_m']} m"
                if metrics["found"]
                else "NO ROUTE"
            )

            print(
                f"Threshold={threshold:>2}° "
                f"Weight={weight:<4} -> {status}"
            )

    csv_path = OUTPUT_DIR / "route_sensitivity_results.csv"
    json_path = OUTPUT_DIR / "route_sensitivity_results.json"

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=results[0].keys())
        writer.writeheader()
        writer.writerows(results)

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "study": "Jezero Route Sensitivity Analysis",
                "thresholds_degrees": THRESHOLDS,
                "slope_weights": WEIGHTS,
                "grid_cell_size_m": CELL_SIZE,
                "start_cell": list(start),
                "end_cell": list(goal),
                "method": "Four-neighbor A* with hard slope constraints",
                "slope_aggregation": "Maximum 1 m pixel slope per 10 m cell",
                "results": results,
                "paths": paths,
                "limitations": [
                    "Thresholds are experimental, not rover safety limits.",
                    "Distances are grid-center horizontal distances.",
                    "Results depend on DEM resolution and slope aggregation.",
                ],
            },
            f,
            indent=2,
            ensure_ascii=False,
        )

    print("\nANALYSIS COMPLETE")
    print("CSV:", csv_path)
    print("JSON:", json_path)


def run_weight_sensitivity():
    """
    Experiment 2:
    Compare slope-weighted routes without a hard slope limit.

    This experiment measures:
    - Horizontal distance
    - Maximum encountered cell slope
    - Exposure above 15, 20, and 25 degrees
    """

    route, slope, _ = load_inputs()
    grid = aggregate_slope(slope, CELL_SIZE)

    start_point = route["points"][0]
    end_point = route["points"][-1]

    start = (
        int(start_point["routeCellRow"]),
        int(start_point["routeCellColumn"]),
    )

    goal = (
        int(end_point["routeCellRow"]),
        int(end_point["routeCellColumn"]),
    )

    weights = [0, 0.5, 1, 2, 5, 10, 20]
    exposure_thresholds = [15, 20, 25]

    results = []
    paths = {}

    for weight in weights:
        # Infinite threshold means no hard slope restriction.
        path = astar(
            grid,
            start,
            goal,
            threshold=float("inf"),
            weight=weight,
        )

        if path is None:
            results.append({
                "weight": weight,
                "found": False,
                "distance_m": None,
                "max_slope_deg": None,
                "exposure_above_15_m": None,
                "exposure_above_20_m": None,
                "exposure_above_25_m": None,
            })
            print(f"Weight={weight}: NO ROUTE")
            continue

        traversed = path[1:]
        slopes = np.array(
            [grid[r, c] for r, c in traversed],
            dtype=float,
        )

        record = {
            "weight": weight,
            "found": True,
            "distance_m": len(traversed) * CELL_SIZE,
            "max_slope_deg": float(slopes.max()),
        }

        for threshold in exposure_thresholds:
            record[f"exposure_above_{threshold}_m"] = (
                int(np.sum(slopes > threshold)) * CELL_SIZE
            )

        results.append(record)

        paths[f"weight_{weight}"] = [
            {"row": r, "column": c}
            for r, c in path
        ]

        print(
            f"Weight={weight:<4} "
            f"Distance={record['distance_m']} m "
            f"MaxSlope={record['max_slope_deg']:.2f}° "
            f"Exposure>15°={record['exposure_above_15_m']} m "
            f"Exposure>20°={record['exposure_above_20_m']} m "
            f"Exposure>25°={record['exposure_above_25_m']} m"
        )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    csv_path = OUTPUT_DIR / "route_weight_sensitivity.csv"
    json_path = OUTPUT_DIR / "route_weight_sensitivity.json"

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=results[0].keys(),
        )
        writer.writeheader()
        writer.writerows(results)

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "study": "Slope Weight Sensitivity",
                "hard_slope_constraint": None,
                "weights": weights,
                "exposure_thresholds_degrees": exposure_thresholds,
                "grid_cell_size_m": CELL_SIZE,
                "results": results,
                "paths": paths,
                "limitations": [
                    "Weights are experimental parameters.",
                    "Slope is represented by the maximum "
                    "1 m pixel slope within each 10 m cell.",
                    "Distances are horizontal grid distances.",
                    "No rover-specific traction or terrain "
                    "mechanics are modeled.",
                ],
            },
            f,
            indent=2,
            ensure_ascii=False,
        )

    print("\nWEIGHT SENSITIVITY COMPLETE")
    print("CSV:", csv_path)
    print("JSON:", json_path)


if __name__ == "__main__":
    main()
    run_weight_sensitivity()
