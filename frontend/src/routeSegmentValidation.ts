
type Point = [number, number, number]

export function findUnsafeRouteSegments(
    points: Point[],
    grid: (number | null)[][],
    sceneWidth: number,
    sceneDepth: number,
    maxAllowedSlopeDeg = 20,
): number[] {
    const rows = grid.length
    const cols = grid[0]?.length ?? 0

    if (!rows || !cols || sceneWidth <= 0 || sceneDepth <= 0) {
        return points.length > 1 ? [0] : []
    }

    function isSafe(x: number, z: number): boolean {
        const col = Math.floor((x / sceneWidth + 0.5) * cols)
        const row = Math.floor((z / sceneDepth + 0.5) * rows)

        if (row < 0 || row >= rows || col < 0 || col >= cols) {
            return false
        }

        const slope = grid[row][col]

        return (
            slope !== null &&
            Number.isFinite(slope) &&
            slope >= 0 &&
            slope <= maxAllowedSlopeDeg
        )
    }

    const unsafe: number[] = []
    const cellWidth = sceneWidth / cols
    const cellDepth = sceneDepth / rows

    for (let i = 1; i < points.length; i++) {
        const [x1, , z1] = points[i - 1]
        const [x2, , z2] = points[i]

        const steps = Math.max(
            1,
            Math.ceil(
                4 *
                Math.max(
                    Math.abs(x2 - x1) / cellWidth,
                    Math.abs(z2 - z1) / cellDepth,
                ),
            ),
        )

        let segmentSafe = true

        for (let step = 0; step <= steps; step++) {
            const t = step / steps
            const x = x1 + (x2 - x1) * t
            const z = z1 + (z2 - z1) * t

            if (!isSafe(x, z)) {
                segmentSafe = false
                break
            }
        }

        if (!segmentSafe) unsafe.push(i - 1)
    }

    return unsafe
}
