export type RoutePoint = [number, number, number]

/**
 * Izgara rotasının 90° basamaklarını Chaikin köşe kesmesiyle yumuşatır (sadece görsel).
 * Her yeni nokta, kaynak rotadaki konumunu (tag) taşır; böylece dik/tehlikeli
 * segment işaretleri yumuşatılmış çizgiye doğru aktarılabilir.
 */
export function smoothRoute(
    points: readonly RoutePoint[],
    steepSegments: readonly number[] = [],
    dangerousSegments: readonly number[] = [],
    iterations = 2,
) {
    type Node = { p: RoutePoint; tag: number }
    let nodes: Node[] = points.map((p, i) => ({ p, tag: i }))

    const mix = (a: Node, b: Node, t: number): Node => ({
        p: [
            a.p[0] + (b.p[0] - a.p[0]) * t,
            a.p[1] + (b.p[1] - a.p[1]) * t,
            a.p[2] + (b.p[2] - a.p[2]) * t,
        ],
        tag: a.tag + (b.tag - a.tag) * t,
    })

    for (let it = 0; it < iterations && nodes.length > 2; it++) {
        const next: Node[] = [nodes[0]]
        for (let i = 0; i < nodes.length - 1; i++) {
            if (i > 0) next.push(mix(nodes[i], nodes[i + 1], 0.25))
            if (i < nodes.length - 2) next.push(mix(nodes[i], nodes[i + 1], 0.75))
        }
        next.push(nodes[nodes.length - 1])
        nodes = next
    }

    const original = Math.max(0, points.length - 1)
    const steep = new Set(steepSegments)
    const dangerous = new Set(dangerousSegments)
    const steepOut: number[] = []
    const dangerousOut: number[] = []

    for (let j = 0; j < nodes.length - 1; j++) {
        const source = Math.min(
            Math.floor((nodes[j].tag + nodes[j + 1].tag) / 2),
            original - 1,
        )
        if (steep.has(source)) steepOut.push(j)
        if (dangerous.has(source)) dangerousOut.push(j)
    }

    return {
        points: nodes.map((n) => n.p),
        steepSegments: steepOut,
        dangerousSegments: dangerousOut,
    }
}
