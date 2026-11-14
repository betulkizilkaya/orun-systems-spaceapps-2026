import { fromArrayBuffer } from 'geotiff'

export async function loadRouteGrid(signal: AbortSignal) {
  const response = await fetch(
    `${import.meta.env.BASE_URL}data/jezero-demo-slope.tif`,
    { signal: signal },
  )
  if (!response.ok) throw new Error('Slope raster unavailable')
  const tiff = await fromArrayBuffer(await response.arrayBuffer())
  const image = await tiff.getImage()
  if (image.getWidth() !== 1000 || image.getHeight() !== 1000) {
    throw new Error('Unexpected slope raster dimensions')
  }
  const values = await image.readRasters({ samples: [0], interleave: true })
  const noData = image.getGDALNoData()
  const cells = Array.from({ length: 100 }, (_, row) =>
    Array.from({ length: 100 }, (_, col) => {
      let max = 0
      for (let y = row * 10; y < row * 10 + 10; y++) {
        for (let x = col * 10; x < col * 10 + 10; x++) {
          const slope = values[y * 1000 + x]
          if (!Number.isFinite(slope) || slope === noData || slope < 0 || slope > 90) {
            return NaN
          }
          max = Math.max(max, slope)
        }
      }
      return max
    }),
  )
  return cells
}

type Point = [number, number, number]

export function shortestRoute(
  grid: number[][],
  start: Point,
  end: Point,
  bounds: number[],
  width: number,
  depth: number,
  project: (x: number, y: number) => Point | null,
) {
  const [west, south, east, north] = bounds
  const rows = grid.length
  const cols = grid[0].length
  const index = (fraction: number, count: number) =>
    Math.max(0, Math.min(count - 1, Math.floor(fraction * count)))
  const cell = ([x, , z]: Point) =>
    index(z / depth + 0.5, rows) * cols + index(x / width + 0.5, cols)
  const origin = cell(start)
  const destination = cell(end)
  const slopeAt = (id: number) => grid[Math.floor(id / cols)][id % cols]
  if (!Number.isFinite(slopeAt(origin)) || !Number.isFinite(slopeAt(destination))) return null

  // Orthogonal steps have equal length on the square Jezero grid.
  const previous = new Int32Array(rows * cols).fill(-1)
  previous[origin] = origin
  const queue = [origin]
  for (let head = 0; head < queue.length && previous[destination] === -1; head++) {
    const id = queue[head]
    const row = Math.floor(id / cols)
    const col = id % cols
    for (const [r, c] of [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]) {
      if (r < 0 || r >= rows || c < 0 || c >= cols) continue
      const next = r * cols + c
      if (previous[next] !== -1 || !Number.isFinite(slopeAt(next))) continue
      previous[next] = id
      queue.push(next)
    }
  }
  if (previous[destination] === -1) return null

  const cells = [destination]
  while (cells[cells.length - 1] !== origin) {
    cells.push(previous[cells[cells.length - 1]])
  }
  cells.reverse()

  const points = [start]
  let maxSlope = slopeAt(origin)
  for (const id of cells) {
    maxSlope = Math.max(maxSlope, slopeAt(id))
    if (cells.length === 1) continue
    const point = project(
      west + ((id % cols + 0.5) / cols) * (east - west),
      north - ((Math.floor(id / cols) + 0.5) / rows) * (north - south),
    )
    if (!point) return null
    points.push(point)
  }
  points.push(end)

  let distanceMeters = 0
  for (let i = 1; i < points.length; i++) {
    distanceMeters += Math.hypot(
      (points[i][0] - points[i - 1][0]) * (east - west) / width,
      (points[i][2] - points[i - 1][2]) * (north - south) / depth,
    )
  }
  return { points, distanceMeters, maxSlope }
}
