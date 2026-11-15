import { RECOMMENDED_MAX_DEG, DANGEROUS_MIN_DEG } from './routeDifficulty'

type Cell = readonly [row: number, col: number]

export type RouteOptions = {
    maxAllowedSlopeDeg?: number
    slopePenalty?: number
}

/** Hücre başına adım maliyeti: düz zeminde 1, dikleştikçe hızla artar. */
function stepCost(slope: number, slopePenalty: number) {
    let cost = 1 + slope * slopePenalty
    if (slope > RECOMMENDED_MAX_DEG) cost += (slope - RECOMMENDED_MAX_DEG) * 2
    if (slope > DANGEROUS_MIN_DEG) cost += (slope - DANGEROUS_MIN_DEG) * 10
    return cost
}

type QueueItem = { cell: Cell; cost: number; priority: number }

class MinHeap {
    private items: QueueItem[] = []
    get size() { return this.items.length }
    push(item: QueueItem) {
        const a = this.items
        a.push(item)
        let i = a.length - 1
        while (i > 0) {
            const parent = (i - 1) >> 1
            if (a[parent].priority <= a[i].priority) break
            ;[a[parent], a[i]] = [a[i], a[parent]]
            i = parent
        }
    }
    pop(): QueueItem | undefined {
        const a = this.items
        if (!a.length) return undefined
        const top = a[0]
        const last = a.pop()!
        if (a.length) {
            a[0] = last
            let i = 0
            for (;;) {
                const l = i * 2 + 1, r = l + 1
                let m = i
                if (l < a.length && a[l].priority < a[m].priority) m = l
                if (r < a.length && a[r].priority < a[m].priority) m = r
                if (m === i) break
                ;[a[m], a[i]] = [a[i], a[m]]
                i = m
            }
        }
        return top
    }
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
    // Varsayılan: sert üst sınır yok. Dik hücreler yasak değil, çok pahalıdır;
    // rota mümkünse onlardan kaçar, mecbursa geçer (ve çağıran taraf uyarır).
    // Sert sınır istenirse maxAllowedSlopeDeg verilir.
    const {
        maxAllowedSlopeDeg = 90,
        slopePenalty = 1 / 15,
    } = options

    if (
        !Number.isFinite(maxAllowedSlopeDeg) ||
        maxAllowedSlopeDeg < 0 ||
        maxAllowedSlopeDeg > 90 ||
        !Number.isFinite(slopePenalty) ||
        slopePenalty < 0
    ) {
        throw new Error('Invalid route planning parameters.')
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

    const open = new MinHeap()
    open.push({
        cell: start,
        cost: 0,
        priority: estimate(start),
    })

    while (open.size > 0) {
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

            const movementCost = stepCost(slope, slopePenalty)
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