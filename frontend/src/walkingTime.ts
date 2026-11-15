/**
 * Ortalama bir insanın rotayı yürüyerek varış süresi.
 * Model: Tobler yürüyüş fonksiyonu
 *     v = 6 · exp(−3,5 · |tan θ + 0,05|)   [km/sa, yatay hız]
 * Düz zeminde ≈ 5 km/sa; yokuşta hızla düşer. Mola dahil değildir.
 */

const PEAK_SPEED_KMH = 6
const TOBLER_DECAY = 3.5
const TOBLER_OFFSET = 0.05

/** 1 = giysisiz ortalama yetişkin. Uzay giysisi için düşürülebilir (ör. 0,6). */
export const WALKER_FACTOR = 1

export type RoutePoint = readonly [x: number, y: number, z: number]

export type WalkingEstimate = {
    seconds: number
    averageSpeedKmh: number
    ascentMeters: number
    descentMeters: number
}

/** gradient = yükseklik farkı / yatay mesafe (yokuş yukarı pozitif) → m/sn */
export function walkingSpeedMps(gradient: number): number {
    const kmh = PEAK_SPEED_KMH * Math.exp(
        -TOBLER_DECAY * Math.abs(gradient + TOBLER_OFFSET),
    )
    return (kmh / 3.6) * WALKER_FACTOR
}

/** metersPerUnit: bir sahne biriminin metre karşılığı (x, y, z için aynı ölçek) */
export function estimateWalkingTime(
    points: readonly RoutePoint[],
    metersPerUnit: number,
): WalkingEstimate | null {
    if (points.length < 2 || !Number.isFinite(metersPerUnit) || metersPerUnit <= 0) {
        return null
    }

    let seconds = 0
    let horizontalMeters = 0
    let ascentMeters = 0
    let descentMeters = 0

    for (let i = 1; i < points.length; i++) {
        const run = Math.hypot(
            points[i][0] - points[i - 1][0],
            points[i][2] - points[i - 1][2],
        ) * metersPerUnit
        if (run <= 0) continue

        const rise = (points[i][1] - points[i - 1][1]) * metersPerUnit
        if (rise > 0) ascentMeters += rise
        else descentMeters -= rise

        horizontalMeters += run
        seconds += run / walkingSpeedMps(rise / run)
    }

    if (seconds <= 0) return null

    return {
        seconds,
        averageSpeedKmh: (horizontalMeters / seconds) * 3.6,
        ascentMeters,
        descentMeters,
    }
}

/** 45 s · 12 min 40 s · 1 h 05 min */
export function formatDuration(totalSeconds: number): string {
    const total = Math.max(0, Math.round(totalSeconds))
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    const seconds = total % 60

    if (hours > 0) return `${hours} h ${String(minutes).padStart(2, '0')} min`
    if (minutes > 0) return `${minutes} min ${String(seconds).padStart(2, '0')} s`
    return `${seconds} s`
}