import type { RoverFrame, RoverPlaybackData } from './roverPlaybackData'

type ScenePoint = [number, number, number]
type TerrainBounds = [number, number, number, number]
type TerrainSample = { elevationM: number; slopeDeg: number } | null

/** Route frames use original GeoTIFF values, not mesh-relative heights. */
export function createRoutePlayback(
    points: ScenePoint[],
    bounds: TerrainBounds,
    sceneWidth: number,
    sceneDepth: number,
    sampleTerrain: (easting: number, northing: number) => TerrainSample,
): RoverPlaybackData | null {
    if (points.length < 2 || sceneWidth <= 0 || sceneDepth <= 0) return null
    const [west, south, east, north] = bounds
    const scaleX = (east - west) / sceneWidth
    const scaleZ = (north - south) / sceneDepth
    if (![scaleX, scaleZ].every(v => Number.isFinite(v) && v > 0)) return null

    const frames: RoverFrame[] = []
    let distanceM = 0
    for (const [x, , z] of points) {
        const projectedX = west + (x + sceneWidth / 2) * scaleX
        const projectedY = north - (z + sceneDepth / 2) * scaleZ
        const sample = sampleTerrain(projectedX, projectedY)
        if (!sample || !Number.isFinite(sample.elevationM) || !Number.isFinite(sample.slopeDeg)) return null
        const previous = frames[frames.length - 1]
        if (previous) {
            const step = Math.hypot(projectedX - previous.projectedX, projectedY - previous.projectedY)
            if (step < 0.000001) continue
            distanceM += step
        }
        frames.push({
            index: frames.length,
            projectedX,
            projectedY,
            elevationM: sample.elevationM,
            slopeDeg: sample.slopeDeg,
            headingDeg: 0,
            distanceM,
            progress: 0,
        })
    }
    if (frames.length < 2 || distanceM <= 0) return null
    for (let i = 0; i < frames.length; i++) {
        const previous = frames[Math.max(0, i - 1)]
        const next = frames[Math.min(frames.length - 1, i + 1)]
        const dx = next.projectedX - previous.projectedX
        const dy = next.projectedY - previous.projectedY
        frames[i].headingDeg = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360
        frames[i].progress = frames[i].distanceM / distanceM
    }
    return { metadata: { distanceM, frameCount: frames.length, type: 'user_planned_route_simulation' }, frames }
}
