
import { describe, expect, it } from 'vitest'
import { shortestRoute } from './routeGrid'

type Point = [number, number, number]

const bounds = [0, 0, 30, 30]
const width = 30
const depth = 30

function project(easting: number, northing: number): Point {
    return [easting - 15, 0, 15 - northing]
}

function point(row: number, col: number): Point {
    return [
        (col + 0.5) * 10 - 15,
        0,
        (row + 0.5) * 10 - 15,
    ]
}

function route(
    grid: number[][],
    start: Point,
    end: Point,
) {
    return shortestRoute(
        grid,
        start,
        end,
        bounds,
        width,
        depth,
        project,
    )
}

describe('Martian Map - BFS Scientific Validation', () => {
    it('düz arazide en kısa yolu bulur', () => {
        const grid = [
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0],
        ]

        const result = route(grid, point(0, 0), point(0, 2))

        expect(result).not.toBeNull()
        expect(result!.distanceMeters).toBeCloseTo(20, 5)
        expect(result!.maxSlope).toBe(0)
    })

    it('20 dereceden yüksek eğimi engeller', () => {
        const grid = [
            [0, 25, 0],
            [0, 25, 0],
            [0, 0, 0],
        ]

        const result = route(grid, point(0, 0), point(0, 2))

        expect(result).not.toBeNull()
        expect(result!.maxSlope).toBeLessThanOrEqual(20)
    })

    it('tamamen kapalı bir geçitte rota oluşturmaz', () => {
        const grid = [
            [0, 30, 0],
            [0, 30, 0],
            [0, 30, 0],
        ]

        expect(
            route(grid, point(0, 0), point(0, 2)),
        ).toBeNull()
    })

    it('başlangıç eğimi sınırı aşıyorsa reddeder', () => {
        const grid = [
            [25, 0],
            [0, 0],
        ]

        expect(
            route(grid, point(0, 0), point(1, 1)),
        ).toBeNull()
    })

    it('bitiş eğimi sınırı aşıyorsa reddeder', () => {
        const grid = [
            [0, 0],
            [0, 25],
        ]

        expect(
            route(grid, point(0, 0), point(1, 1)),
        ).toBeNull()
    })

    it('başlangıç hücresinin eğimini maksimuma dahil eder', () => {
        const grid = [
            [18, 2, 3],
            [0, 0, 0],
            [0, 0, 0],
        ]

        const result = route(grid, point(0, 0), point(0, 2))

        expect(result).not.toBeNull()
        expect(result!.maxSlope).toBe(18)
    })
})
