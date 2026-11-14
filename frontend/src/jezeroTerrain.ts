import { fromArrayBuffer } from 'geotiff'
import { PlaneGeometry } from 'three'
import { findRoute } from './routePlanner'

type Point = [x: number, y: number, z: number]

type JezeroRoute = {
  points: Point[]
  maxSlope: number
}

const SCENE_WIDTH = 120
const SEGMENTS = 160
const PIXELS_PER_ROUTE_CELL = 10

async function readRaster(name: 'dem' | 'slope', signal: AbortSignal) {
  const url = `${import.meta.env.BASE_URL}data/jezero-demo-${name}.tif`
  const response = await fetch(url, { signal })

  if (!response.ok) {
    throw new Error(
      `Jezero ${name} dosyası yüklenemedi (HTTP ${response.status}).`,
    )
  }

  const tiff = await fromArrayBuffer(await response.arrayBuffer())
  const image = await tiff.getImage()
  const values = await image.readRasters({
    samples: [0],
    interleave: true,
  })

  return {
    width: image.getWidth(),
    height: image.getHeight(),
    bounds: image.getBoundingBox(),
    resolution: image.getResolution().slice(0, 2),
    noData: image.getGDALNoData(),
    values,
  }
}

function matches(first: number[], second: number[]) {
  return (
    first.length === second.length &&
    first.every((value, index) => Math.abs(value - second[index]) <= 1e-6)
  )
}

function cellIndex(fraction: number, count: number) {
  return Math.max(0, Math.min(count - 1, Math.floor(fraction * count)))
}

export async function loadJezeroTerrain(signal: AbortSignal) {
  const [dem, slope] = await Promise.all([
    readRaster('dem', signal),
    readRaster('slope', signal),
  ])

  signal.throwIfAborted()

  if (
    dem.width !== slope.width ||
    dem.height !== slope.height ||
    !matches(dem.bounds, slope.bounds) ||
    !matches(dem.resolution, slope.resolution)
  ) {
    throw new Error('DEM ve eğim rasterı aynı piksel ızgarasında değil.')
  }

  let minimum = Infinity

  for (const elevation of dem.values) {
    if (!Number.isFinite(elevation) || elevation === dem.noData) {
      throw new Error('Bu DEM’de veri boşluğu var. Arazi maskesi gerekiyor.')
    }

    minimum = Math.min(minimum, elevation)
  }

  const rows = Math.ceil(dem.height / PIXELS_PER_ROUTE_CELL)
  const cols = Math.ceil(dem.width / PIXELS_PER_ROUTE_CELL)
  const grid = Array.from({ length: rows }, () =>
    Array<number | null>(cols).fill(0),
  )

  for (let row = 0; row < dem.height; row += 1) {
    const gridRow = cellIndex((row + 0.5) / dem.height, rows)

    for (let col = 0; col < dem.width; col += 1) {
      const gridCol = cellIndex((col + 0.5) / dem.width, cols)
      const degrees = slope.values[row * dem.width + col]
      const previous = grid[gridRow][gridCol]

      if (
        !Number.isFinite(degrees) ||
        degrees === slope.noData ||
        degrees < 0 ||
        degrees > 90
      ) {
        grid[gridRow][gridCol] = null
      } else if (previous !== null) {
        grid[gridRow][gridCol] = Math.max(previous, degrees)
      }
    }
  }

  const [west, south, east, north] = dem.bounds
  const scale = SCENE_WIDTH / (east - west)
  const sceneDepth = (north - south) * scale
  const geometry = new PlaneGeometry(SCENE_WIDTH, sceneDepth, SEGMENTS, SEGMENTS)

  geometry.rotateX(-Math.PI / 2)

  const vertices = geometry.attributes.position
  const stride = SEGMENTS + 1

  for (let row = 0; row <= SEGMENTS; row += 1) {
    const rasterRow = cellIndex(row / SEGMENTS, dem.height)

    for (let col = 0; col <= SEGMENTS; col += 1) {
      const rasterCol = cellIndex(col / SEGMENTS, dem.width)
      const elevation = dem.values[rasterRow * dem.width + rasterCol]

      vertices.setY(row * stride + col, (elevation - minimum) * scale)
    }
  }

  geometry.computeVertexNormals()

  function sceneToCell([x, , z]: Point): [number, number] {
    return [
      cellIndex(z / sceneDepth + 0.5, rows),
      cellIndex(x / SCENE_WIDTH + 0.5, cols),
    ]
  }

  function surfaceHeight(x: number, z: number) {
    const meshCol = (x / SCENE_WIDTH + 0.5) * SEGMENTS
    const meshRow = (z / sceneDepth + 0.5) * SEGMENTS
    const col = cellIndex(meshCol / SEGMENTS, SEGMENTS)
    const row = cellIndex(meshRow / SEGMENTS, SEGMENTS)
    const u = meshCol - col
    const v = meshRow - row
    const topLeft = row * stride + col

    const a = vertices.getY(topLeft)
    const b = vertices.getY(topLeft + stride)
    const c = vertices.getY(topLeft + stride + 1)
    const d = vertices.getY(topLeft + 1)

    if (u + v <= 1) {
      return a * (1 - u - v) + d * u + b * v
    }

    return b * (1 - u) + d * (1 - v) + c * (u + v - 1)
  }

  function getRoute(start: Point, end: Point): JezeroRoute | null {
    const cells = findRoute(grid, sceneToCell(start), sceneToCell(end))
    if (!cells) return null

    let maxSlope = 0

    for (const [row, col] of cells) {
      const degrees = grid[row][col]

      if (degrees !== null) {
        maxSlope = Math.max(maxSlope, degrees)
      }
    }

    if (cells.length === 1) {
      return { points: [start, end], maxSlope }
    }

    const path = cells.map(([row, col]): Point => {
      const x = ((col + 0.5) / cols - 0.5) * SCENE_WIDTH
      const z = ((row + 0.5) / rows - 0.5) * sceneDepth

      return [x, surfaceHeight(x, z), z]
    })

    return { points: [start, ...path, end], maxSlope }
  }

  return { geometry, getRoute }
}