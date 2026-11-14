
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'

import {
    RoverCamera,
    type RoverCameraMode,
} from './RoverCamera'

import { AstronautModel } from './AstronautModel'

import {
    interpolateFrame,
    type RoverFrame,
    type RoverPlaybackData,
} from './roverPlaybackData'

export type RoverTelemetry = Pick<
    RoverFrame,
    | 'distanceM'
    | 'elevationM'
    | 'slopeDeg'
    | 'headingDeg'
    | 'progress'
>

type Props = {
    data: RoverPlaybackData

    projectToSurface: (
        x: number,
        y: number
    ) => [number, number, number] | null

    playing: boolean
    speedMps: number
    distanceM: number
    cameraMode: RoverCameraMode

    onDistanceChange?: (distanceM: number) => void
    onTelemetry?: (telemetry: RoverTelemetry) => void
}

/**
 * Mars yüzeyinde astronot rota simülasyonu.
 *
 * Mevcut Canvas içine yerleştirilir.
 * App.tsx dosyasını değiştirmez.
 */
export function RoverPlayback({
                                  data,
                                  projectToSurface,
                                  playing,
                                  speedMps,
                                  distanceM,
                                  cameraMode,
                                  onDistanceChange,
                                  onTelemetry,
                              }: Props) {
    const frames = data.frames

    const distanceRef = useRef(distanceM)

    const [renderDistance, setRenderDistance] =
        useState(distanceM)

    const lastReported = useRef(-1)

    // Dışarıdan gelen mesafe değişikliklerini uygula
    useEffect(() => {
        distanceRef.current = distanceM
        setRenderDistance(distanceM)
    }, [distanceM])

    // Rota boyunca simülasyon hareketi
    useFrame((_, delta) => {
        if (!playing || frames.length === 0) return

        const lastDistance =
            frames[frames.length - 1].distanceM

        const nextDistance = Math.min(
            lastDistance,
            distanceRef.current +
            Math.min(delta, 0.1) * speedMps
        )

        distanceRef.current = nextDistance
        setRenderDistance(nextDistance)

        if (
            nextDistance !== lastReported.current &&
            (
                Math.abs(
                    nextDistance - lastReported.current
                ) >= 0.2 ||
                nextDistance === lastDistance
            )
        ) {
            lastReported.current = nextDistance
            onDistanceChange?.(nextDistance)
        }
    })

    // Mevcut rota noktası
    const current = useMemo(
        () => interpolateFrame(frames, renderDistance),
        [frames, renderDistance]
    )

    // Mars koordinatlarını 3D sahne koordinatlarına dönüştür
    const position = useMemo(() => {
        const projected = projectToSurface(
            current.projectedX,
            current.projectedY
        )

        if (!projected) return null

        return new Vector3(...projected)
    }, [
        current.projectedX,
        current.projectedY,
        projectToSurface,
    ])

    // Astronotun ilerleme yönünü hesapla
    const direction = useMemo(() => {
        const totalDistance =
            frames[frames.length - 1].distanceM

        const ahead = interpolateFrame(
            frames,
            Math.min(totalDistance, renderDistance + 2)
        )

        const behind = interpolateFrame(
            frames,
            Math.max(0, renderDistance - 2)
        )

        const aheadPosition = projectToSurface(
            ahead.projectedX,
            ahead.projectedY
        )

        const behindPosition = projectToSurface(
            behind.projectedX,
            behind.projectedY
        )

        if (!aheadPosition || !behindPosition) {
            return new Vector3(0, 0, 1)
        }

        const vector = new Vector3(
            aheadPosition[0] - behindPosition[0],
            0,
            aheadPosition[2] - behindPosition[2]
        )

        if (vector.lengthSq() > 0.000001) {
            return vector.normalize()
        }

        return new Vector3(0, 0, 1)
    }, [
        frames,
        renderDistance,
        projectToSurface,
    ])

    // Telemetriyi güncelle
    useEffect(() => {
        onTelemetry?.(current)
    }, [current, onTelemetry])

    if (!position) return null

    return (
        <>
            {/* Astronot modeli: POV modunda gizlenir */}
            {cameraMode !== 'pov' && (
                <Suspense fallback={null}>
                    <AstronautModel
                        position={position}
                        direction={direction}
                        playing={playing}
                    />
                </Suspense>
            )}

            {/* Serbest, takip ve POV kameraları */}
            <RoverCamera
                position={position}
                direction={direction}
                mode={cameraMode}
            />
        </>
    )
}
