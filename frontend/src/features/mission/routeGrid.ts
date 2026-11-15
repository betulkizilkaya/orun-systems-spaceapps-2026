
import { fromArrayBuffer } from 'geotiff'

/** Sert eğim sınırı yok; mesafe odaklı alternatif, istenirse sınır parametresiyle kısıtlanır. */
export const MAX_ALLOWED_SLOPE_DEG = Infinity

type Point = [number, number, number]

export async function loadRouteGrid(signal: AbortSignal) {
    const response = await fetch(
        `${import.meta.env.BASE_URL}data/jezero-demo-slope.tif`,
        { signal },
    )

    if (!response.ok) {
        throw new Error('Slope raster unavailable')
    }

    const tiff = await fromArrayBuffer(await response.arrayBuffer())
    const image = await tiff.getImage()

    const width = image.getWidth()
    const height = image.getHeight()

    const values = await image.readRasters({
        samples: [0],
        interleave: true,
    })

    const noData = image.getGDALNoData()
    const cellSize = 10

    const rows = Math.ceil(height / cellSize)
    const cols = Math.ceil(width / cellSize)

    return Array.from({ length: rows }, (_, row) =>
        Array.from({ length: cols }, (_, col) => {
            let maxSlope = 0

            for (
                let y = row * cellSize;
                y < Math.min((row + 1) * cellSize, height);
                y++
            ) {
                for (
                    let x = col * cellSize;
                    x < Math.min((col + 1) * cellSize, width);
                    x++
                ) {
                    const slope = values[y * width + x]

                    if (
                        !Number.isFinite(slope) ||
                        slope === noData ||
                        slope < 0 ||
                        slope > 90
                    ) {
                        return NaN
                    }

                    maxSlope = Math.max(maxSlope, slope)
                }
            }

            return maxSlope
        }),
    )
}

export function shortestRoute(
    grid: number[][],
    start: Point,
    end: Point,
    bounds: number[],
    width: number,
    depth: number,
    project: (x: number, y: number) => Point | null,
    maxSlopeDeg: number = MAX_ALLOWED_SLOPE_DEG,
) {
    if (!grid.length || !grid[0]?.length) return null

    const [west, south, east, north] = bounds
    const rows = grid.length
    const cols = grid[0].length

    const index = (fraction: number, count: number) =>
        Math.max(0, Math.min(count - 1, Math.floor(fraction * count)))

    const cell = ([x, , z]: Point) =>
        index(z / depth + 0.5, rows) * cols +
        index(x / width + 0.5, cols)

    const origin = cell(start)
    const destination = cell(end)

    const slopeAt = (id: number) =>
        grid[Math.floor(id / cols)][id % cols]

    const canVisit = (id: number) => {
        const slope = slopeAt(id)

        return (
            Number.isFinite(slope) &&
            slope >= 0 &&
            slope <= maxSlopeDeg
        )
    }

    if (!canVisit(origin) || !canVisit(destination)) {
        return null
    }

    const previous = new Int32Array(rows * cols).fill(-1)
    previous[origin] = origin

    const queue = [origin]

    for (
        let head = 0;
        head < queue.length && previous[destination] === -1;
        head++
    ) {
        const id = queue[head]
        const row = Math.floor(id / cols)
        const col = id % cols

        const neighbors = [
            [row - 1, col],
            [row + 1, col],
            [row, col - 1],
            [row, col + 1],
        ]

        for (const [r, c] of neighbors) {
            if (r < 0 || r >= rows || c < 0 || c >= cols) {
                continue
            }

            const next = r * cols + c

            if (previous[next] !== -1 || !canVisit(next)) {
                continue
            }

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

    const points: Point[] = [start]
    let maxSlope = slopeAt(origin)

    for (const id of cells) {
        maxSlope = Math.max(maxSlope, slopeAt(id))

        if (cells.length === 1) continue

        const point = project(
            west + ((id % cols + 0.5) / cols) * (east - west),
            north -
            ((Math.floor(id / cols) + 0.5) / rows) *
            (north - south),
        )

        if (!point) return null

        points.push(point)
    }

    points.push(end)

    let distanceMeters = 0

    for (let i = 1; i < points.length; i++) {
        distanceMeters += Math.hypot(
            (points[i][0] - points[i - 1][0]) *
            (east - west) / width,
            (points[i][2] - points[i - 1][2]) *
            (north - south) / depth,
        )
    }

    return { points, distanceMeters, maxSlope }
}

