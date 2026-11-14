import { findRoute } from './routePlanner'
import { getSampleElevation } from './sampleTerrain'

type ScenePoint = [x: number, y: number, z: number]

const GRID_SIZE = 48
const HALF_EXTENT = 60
const CELL_SIZE = (2 * HALF_EXTENT) / GRID_SIZE

function cellCenter(index: number) {
  return -HALF_EXTENT + (index + 0.5) * CELL_SIZE
}

function sceneToCellIndex(coordinate: number) {
  const index = Math.floor((coordinate + HALF_EXTENT) / CELL_SIZE)
  return Math.max(0, Math.min(GRID_SIZE - 1, index))
}

const sampleSlopes = Array.from({ length: GRID_SIZE }, (_, row) =>
  Array.from({ length: GRID_SIZE }, (_, col) => {
    const x = cellCenter(col)
    const z = cellCenter(row)
    const halfStep = CELL_SIZE / 2

    const dx =
      (getSampleElevation(x + halfStep, z) -
        getSampleElevation(x - halfStep, z)) / CELL_SIZE

    const dz =
      (getSampleElevation(x, z + halfStep) -
        getSampleElevation(x, z - halfStep)) / CELL_SIZE

    return Math.atan(Math.hypot(dx, dz)) * (180 / Math.PI)
  }),
)

export function getSampleRoute(start: ScenePoint, end: ScenePoint) {
  const cells = findRoute(
    sampleSlopes,
    [sceneToCellIndex(start[2]), sceneToCellIndex(start[0])],
    [sceneToCellIndex(end[2]), sceneToCellIndex(end[0])],
  )

  if (!cells) return null

  const path = cells.map(([row, col]): ScenePoint => {
    const x = cellCenter(col)
    const z = cellCenter(row)
    return [x, getSampleElevation(x, z), z]
  })

  return [start, ...path, end]
}