import { findRoute } from '../../routePlanner'
import { loadRouteGrid } from './routeGrid'

export type ScienceWaypointData = {
  id: string
  name: string
  projectedX: number
  projectedY: number
  scienceObjective: string
  observationTask: string
  geologicalUnit: string
}

type ScienceWaypointsFile = {
  waypoints: ScienceWaypointData[]
}

export async function loadScienceWaypoints(): Promise<ScienceWaypointData[]> {
  const response = await fetch(
    `${import.meta.env.BASE_URL}data/jezero-science-waypoints.json`,
  )

  if (!response.ok) {
    throw new Error("Science waypoint data could not be loaded")
  }

  const data: ScienceWaypointsFile = await response.json()

  if (!Array.isArray(data.waypoints) || data.waypoints.length !== 3) {
    throw new Error("Invalid science waypoint data")
  }

  return data.waypoints
}

export type ScienceWaypoint = {
  id: string
  name: string
  projectedX: number
  projectedY: number
}

export type MissionGridCell = readonly [row: number, col: number]
export type MissionProjectedPoint = { projectedX: number; projectedY: number }
export type MissionSegment = {
  from: string
  to: string
  cells: MissionGridCell[]
  distanceM: number
  maxSlopeDeg: number
}
export type ScienceMissionRoute = {
  cells: MissionGridCell[]
  projectedPoints: MissionProjectedPoint[]
  segments: MissionSegment[]
  waypointCellIndices: Record<string, number>
  distanceM: number
  maxSlopeDeg: number
  experimentalSlopeLimitDeg: number
}

/** Bounds are in the Mars projected CRS, in [west, south, east, north] order. */
export function projectedToMissionCell(
  point: MissionProjectedPoint,
  bounds: readonly [number, number, number, number],
  rows: number,
  cols: number,
): MissionGridCell {
  const [west, south, east, north] = bounds
  if (!Number.isFinite(point.projectedX) || !Number.isFinite(point.projectedY) ||
      point.projectedX < west || point.projectedX >= east ||
      point.projectedY <= south || point.projectedY > north) {
    throw new Error('Science waypoint is outside the DEM planning grid.')
  }
  return [
    Math.min(rows - 1, Math.floor((north - point.projectedY) / (north - south) * rows)),
    Math.min(cols - 1, Math.floor((point.projectedX - west) / (east - west) * cols)),
  ]
}

export function missionCellToProjected(
  [row, col]: MissionGridCell,
  bounds: readonly [number, number, number, number],
  rows: number,
  cols: number,
): MissionProjectedPoint {
  const [west, south, east, north] = bounds
  return {
    projectedX: west + (col + 0.5) * (east - west) / cols,
    projectedY: north - (row + 0.5) * (north - south) / rows,
  }
}

/**
 * Routes through all science waypoints in order using the existing slope-aware A*.
 * No waypoint relocation or silent slope-limit relaxation is performed.
 * All returned path coordinates are planning-cell centers, not exact waypoint positions.
 */
export function planScienceMission(
  grid: readonly (readonly (number | null)[])[],
  bounds: readonly [number, number, number, number],
  start: MissionProjectedPoint,
  waypoints: readonly ScienceWaypoint[],
  maxSlopeDeg = 25,
): ScienceMissionRoute {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  if (!rows || !cols || grid.some(row => row.length !== cols)) {
    throw new Error('Invalid planning grid.')
  }
  if (!waypoints.length) throw new Error('No science waypoints provided.')
  if (!Number.isFinite(maxSlopeDeg) || maxSlopeDeg < 0 || maxSlopeDeg > 90) {
    throw new Error('Invalid experimental slope limit.')
  }
  const [west, south, east, north] = bounds
  if (![west, south, east, north].every(Number.isFinite) || west >= east || south >= north) {
    throw new Error('Invalid Mars DEM bounds.')
  }

  const stops = [{ id: 'START', ...start }, ...waypoints]
  const cells: MissionGridCell[] = []
  const segments: MissionSegment[] = []
  const waypointCellIndices: Record<string, number> = {}
  const stepX = (east - west) / cols
  const stepY = (north - south) / rows
  let distanceM = 0
  let maxSlope = 0

  for (let i = 1; i < stops.length; i++) {
    const from = stops[i - 1]
    const to = stops[i]
    const origin = projectedToMissionCell(from, bounds, rows, cols)
    const destination = projectedToMissionCell(to, bounds, rows, cols)
    const segmentCells = findRoute(grid, origin, destination, {
      maxAllowedSlopeDeg: maxSlopeDeg,
    })
    if (!segmentCells) {
      throw new Error(`No route from ${from.id} to ${to.id} at ${maxSlopeDeg}° experimental slope limit.`)
    }
    let segmentDistance = 0
    let segmentMaxSlope = 0
    for (let j = 0; j < segmentCells.length; j++) {
      const [row, col] = segmentCells[j]
      const slope = grid[row]?.[col]
      if (typeof slope !== 'number' || !Number.isFinite(slope) || slope > maxSlopeDeg) {
        throw new Error(`Invalid slope cell on ${from.id} → ${to.id}.`)
      }
      segmentMaxSlope = Math.max(segmentMaxSlope, slope)
      if (j > 0) {
        const previous = segmentCells[j - 1]
        segmentDistance += Math.hypot((col - previous[1]) * stepX, (row - previous[0]) * stepY)
      }
    }
    segments.push({ from: from.id, to: to.id, cells: segmentCells, distanceM: segmentDistance, maxSlopeDeg: segmentMaxSlope })
    if (i === 1) cells.push(...segmentCells)
    else cells.push(...segmentCells.slice(1))
    waypointCellIndices[to.id] = cells.length - 1
    distanceM += segmentDistance
    maxSlope = Math.max(maxSlope, segmentMaxSlope)
  }
  return {
    cells,
    projectedPoints: cells.map(cell => missionCellToProjected(cell, bounds, rows, cols)),
    segments,
    waypointCellIndices,
    distanceM,
    maxSlopeDeg: maxSlope,
    experimentalSlopeLimitDeg: maxSlopeDeg,
  }
}

export async function createScienceMissionRoute(
  signal: AbortSignal,
  start: MissionProjectedPoint,
): Promise<ScienceMissionRoute> {
  const [grid, waypoints] = await Promise.all([
    loadRouteGrid(signal),
    loadScienceWaypoints(),
  ])

  if (signal.aborted) {
    throw new DOMException('Mission planning cancelled', 'AbortError')
  }

  const bounds: readonly [number, number, number, number] = [
    4579240,
    1093741,
    4580240,
    1094741,
  ]

  return planScienceMission(
    grid,
    bounds,
    start,
    waypoints,
    25,
  )
}