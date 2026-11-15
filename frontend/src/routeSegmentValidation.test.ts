
import { describe, expect, it } from 'vitest'
import { findUnsafeRouteSegments } from './routeSegmentValidation'

type Point = [number, number, number]

describe('Martian Map - Route Segment Validation', () => {
    const width = 30
    const depth = 30

    it('güvenli hücrelerden geçen rotayı kabul eder', () => {
        const grid = [
            [0, 5, 0],
            [0, 0, 0],
            [0, 0, 0],
        ]

        const points: Point[] = [
            [-10, 0, -10],
            [0, 0, -10],
            [10, 0, -10],
        ]

        expect(
            findUnsafeRouteSegments(points, grid, width, depth),
        ).toEqual([])
    })

    it('25 derece eğimli hücreden geçen segmenti yakalar', () => {
        const grid = [
            [0, 25, 0],
            [0, 0, 0],
            [0, 0, 0],
        ]

        const points: Point[] = [
            [-10, 0, -10],
            [10, 0, -10],
        ]

        expect(
            findUnsafeRouteSegments(points, grid, width, depth),
        ).toEqual([0])
    })

    it('çapraz geçişte tehlikeli hücreyi yakalar', () => {
        const grid = [
            [0, 25, 0],
            [0, 0, 0],
            [0, 0, 0],
        ]

        const points: Point[] = [
            [-10, 0, -10],
            [10, 0, 0],
        ]

        expect(
            findUnsafeRouteSegments(points, grid, width, depth),
        ).toEqual([0])
    })

    it('geçersiz hücreyi güvensiz kabul eder', () => {
        const grid = [
            [0, null, 0],
            [0, 0, 0],
            [0, 0, 0],
        ]

        const points: Point[] = [
            [-10, 0, -10],
            [10, 0, -10],
        ]

        expect(
            findUnsafeRouteSegments(points, grid, width, depth),
        ).toEqual([0])
    })


    it('birden fazla segmentten yalnızca güvensizi işaretler', () => {
        const grid = [
            [0, 25, 0],
            [0, 0, 0],
            [0, 0, 0],
        ]

        const points: Point[] = [
            [-10, 0, 0],
            [0, 0, 0],
            [10, 0, 0],
            [10, 0, -10],
            [0, 0, -10],
        ]

        expect(
            findUnsafeRouteSegments(points, grid, width, depth),
        ).toEqual([3])
    })

})
