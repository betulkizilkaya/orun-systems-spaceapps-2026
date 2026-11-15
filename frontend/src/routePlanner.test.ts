
import { describe, expect, it } from 'vitest'
import { findRoute } from './routePlanner'

describe('Martian Map - A* Scientific Validation', () => {
    it('düz arazide en kısa rotayı bulur', () => {
        const grid = [
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0],
        ]

        const route = findRoute(grid, [0, 0], [0, 2])

        expect(route).toEqual([
            [0, 0],
            [0, 1],
            [0, 2],
        ])
    })

    it('20 dereceden yüksek eğimli hücrelerden geçmez', () => {
        const grid = [
            [0, 25, 0],
            [0, 25, 0],
            [0, 0, 0],
        ]

        const route = findRoute(grid, [0, 0], [0, 2])

        expect(route).not.toBeNull()

        for (const [row, col] of route!) {
            expect(grid[row][col]).toBeLessThanOrEqual(20)
        }
    })

    it('geçersiz hücrelerden geçmez', () => {
        const grid = [
            [0, null, 0],
            [0, null, 0],
            [0, 0, 0],
        ]

        const route = findRoute(grid, [0, 0], [0, 2])

        expect(route).not.toBeNull()

        for (const [row, col] of route!) {
            expect(grid[row][col]).not.toBeNull()
        }
    })

    it('başlangıç eğimi sınırı aşıyorsa rota oluşturmaz', () => {
        const grid = [
            [30, 0],
            [0, 0],
        ]

        expect(findRoute(grid, [0, 0], [1, 1], { maxAllowedSlopeDeg: 20 })).toBeNull()
    })

    it('bitiş eğimi sınırı aşıyorsa rota oluşturmaz', () => {
        const grid = [
            [0, 0],
            [0, 30],
        ]

        expect(findRoute(grid, [0, 0], [1, 1], { maxAllowedSlopeDeg: 20 })).toBeNull()
    })

    it('sert sınır yoksa dik başlangıç/bitiş hücresine de rota çizer', () => {
        const grid = [
            [30, 0],
            [0, 40],
        ]

        expect(findRoute(grid, [0, 0], [1, 1])).not.toBeNull()
    })

    it('tamamen dik bir duvar varsa rota yine oluşur ve duvardan geçer', () => {
        const grid = [
            [0, 25, 0],
            [0, 25, 0],
            [0, 25, 0],
        ]

        const route = findRoute(grid, [0, 0], [0, 2])

        expect(route).not.toBeNull()
        expect(route).toContainEqual([0, 1])
        expect(findRoute(grid, [0, 0], [0, 2], { maxAllowedSlopeDeg: 20 })).toBeNull()
    })

    it('mümkünse dik hücre yerine dolambaçlı düz yolu seçer', () => {
        const grid = [
            [0, 35, 0],
            [0, 0, 0],
        ]

        const route = findRoute(grid, [0, 0], [0, 2])

        expect(route).not.toContainEqual([0, 1])
    })

    it('eğim cezası olmadan en kısa hücre yolunu seçer', () => {
        const grid = [
            [0, 15, 0],
            [0, 0, 0],
            [0, 0, 0],
        ]

        const route = findRoute(
            grid,
            [0, 0],
            [0, 2],
            { slopePenalty: 0 },
        )

        expect(route).toEqual([
            [0, 0],
            [0, 1],
            [0, 2],
        ])
    })

    it('eğim cezası yüksek olduğunda daha düz yolu tercih eder', () => {
        const grid = [
            [0, 15, 0],
            [0, 0, 0],
            [0, 0, 0],
        ]

        const route = findRoute(
            grid,
            [0, 0],
            [0, 2],
            { slopePenalty: 1 },
        )

        expect(route).not.toBeNull()
        expect(route).not.toContainEqual([0, 1])
    })


    it('rota ardışık hücreler arasında çapraz hareket yapmaz', () => {
        const grid = [
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0],
        ]

        const route = findRoute(grid, [0, 0], [2, 2])

        expect(route).not.toBeNull()

        for (let i = 1; i < route!.length; i++) {
            const [previousRow, previousCol] = route![i - 1]
            const [currentRow, currentCol] = route![i]

            const movement =
                Math.abs(currentRow - previousRow) +
                Math.abs(currentCol - previousCol)

            expect(movement).toBe(1)
        }
    })


    it('gerçek Jezero rasterındaki önerilen rota için hazırlık', () => {
        const start: [number, number] = [31, 6]
        const end: [number, number] = [99, 19]

        expect(start).not.toEqual(end)
        expect(start[0]).toBeGreaterThanOrEqual(0)
        expect(end[0]).toBeLessThan(100)
    })


})
