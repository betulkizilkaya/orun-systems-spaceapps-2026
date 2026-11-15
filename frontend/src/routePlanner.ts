
type Cell = readonly [row: number, col: number]

export type RouteOptions = {
    maxAllowedSlopeDeg?: number
    slopePenalty?: number
}

const neighbors: readonly Cell[] = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
]

export function findRoute(
    slopes: readonly (readonly (number | null)[])[],
    start: Cell,
    end: Cell,
    options: RouteOptions = {},
): Cell[] | null {
    const {
        maxAllowedSlopeDeg = 20,
        slopePenalty = 1 / 15,
    } = options

    if (
        !Number.isFinite(maxAllowedSlopeDeg) ||
        maxAllowedSlopeDeg < 0 ||
        maxAllowedSlopeDeg > 90 ||
        !Number.isFinite(slopePenalty) ||
        slopePenalty < 0
    ) {
        throw new Error('Geçersiz rota planlama parametreleri.')
    }

    const key = ([row, col]: Cell) => `${row},${col}`

    const slopeAt = ([row, col]: Cell) =>
        slopes[row]?.[col]

    const canVisit = (
        slope: number | null | undefined,
    ): slope is number =>
        typeof slope === 'number' &&
        Number.isFinite(slope) &&
        slope >= 0 &&
        slope <= maxAllowedSlopeDeg

    const estimate = ([row, col]: Cell) =>
        Math.abs(end[0] - row) +
        Math.abs(end[1] - col)

    if (!canVisit(slopeAt(start)) || !canVisit(slopeAt(end))) {
        return null
    }

    const startKey = key(start)
    const endKey = key(end)

    const costs = new Map<string, number>([[startKey, 0]])
    const cameFrom = new Map<string, Cell>()

    const open = [{
        cell: start,
        cost: 0,
        priority: estimate(start),
    }]

    while (open.length > 0) {
        open.sort((a, b) => b.priority - a.priority)

        const current = open.pop()
        if (!current) break

        const currentKey = key(current.cell)

        if (current.cost !== costs.get(currentKey)) {
            continue
        }

        if (currentKey === endKey) {
            const route: Cell[] = [current.cell]
            let previous = cameFrom.get(currentKey)

            while (previous) {
                route.push(previous)
                previous = cameFrom.get(key(previous))
            }

            return route.reverse()
        }

        for (const [rowOffset, colOffset] of neighbors) {
            const next: Cell = [
                current.cell[0] + rowOffset,
                current.cell[1] + colOffset,
            ]

            const slope = slopeAt(next)

            if (!canVisit(slope)) continue

            const nextKey = key(next)

            const movementCost = 1 + slope * slopePenalty
            const newCost = current.cost + movementCost

            if (newCost >= (costs.get(nextKey) ?? Infinity)) {
                continue
            }

            costs.set(nextKey, newCost)
            cameFrom.set(nextKey, current.cell)

            open.push({
                cell: next,
                cost: newCost,
                priority: newCost + estimate(next),
            })
        }
    }

    return null
}
