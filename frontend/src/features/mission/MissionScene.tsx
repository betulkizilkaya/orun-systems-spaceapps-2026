
import { Html, Line } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import {
    Box3,
    Color,
    OrthographicCamera,
    PerspectiveCamera,
    Vector3,
    type BufferGeometry,
    type Group,
} from 'three'
import {
    Line2,
    LineSegments2,
    OrbitControls as OrbitControlsImpl,
} from 'three-stdlib'

import { smoothRoute } from '../../routeSmoothing'

type Point = [number, number, number]
type RouteLine = Line2 | LineSegments2

function ease(value: number) {
    return value * value * (3 - 2 * value)
}

const viewDirection = new Vector3(0.66, 0.84, 0.96).normalize()
const screenRight = new Vector3(0, 1, 0)
    .cross(viewDirection)
    .normalize()
const screenUp = viewDirection.clone().cross(screenRight)

function fitPerspective(
    camera: PerspectiveCamera,
    bounds: Box3,
    aspect: number,
) {
    const focus = bounds.getCenter(new Vector3())
    const vertical =
        Math.tan((camera.fov * Math.PI) / 360) * 0.78 / camera.zoom
    const horizontal = vertical * aspect

    let distance = 0

    for (const x of [bounds.min.x, bounds.max.x]) {
        for (const y of [bounds.min.y, bounds.max.y]) {
            for (const z of [bounds.min.z, bounds.max.z]) {
                const offset = new Vector3(x, y, z).sub(focus)

                distance = Math.max(
                    distance,
                    offset.dot(viewDirection) +
                    Math.max(
                        Math.abs(offset.dot(screenRight)) / horizontal,
                        Math.abs(offset.dot(screenUp)) / vertical,
                    ),
                )
            }
        }
    }

    return {
        focus,
        end: focus
            .clone()
            .addScaledVector(viewDirection, Math.max(35, distance)),
    }
}

export function TerrainFraming({
    geometry,
}: {
    geometry: BufferGeometry
}) {
    const { camera, controls, size } = useThree()
    const previousFit = useRef(0)
    const fittedCamera = useRef<PerspectiveCamera | null>(null)

    useLayoutEffect(() => {
        if (!size.width || !size.height) return

        const orbit =
            controls instanceof OrbitControlsImpl ? controls : null

        if (!orbit) return

        geometry.computeBoundingBox()
        const bounds = geometry.boundingBox

        if (!bounds || bounds.isEmpty()) return

        if (camera instanceof OrthographicCamera) {
            const extent = bounds.getSize(new Vector3())
            const fit =
                Math.min(
                    size.width / extent.x,
                    size.height / extent.z,
                ) * 0.72

            camera.zoom = previousFit.current
                ? (camera.zoom * fit) / previousFit.current
                : fit

            previousFit.current = fit
            camera.updateProjectionMatrix()
        } else if (
            camera instanceof PerspectiveCamera &&
            fittedCamera.current !== camera
        ) {
            const { focus, end } = fitPerspective(
                camera,
                bounds,
                size.width / size.height,
            )

            camera.position.copy(end)
            orbit.target.copy(focus)
            orbit.update()

            fittedCamera.current = camera
        }
    }, [camera, controls, geometry, size.width, size.height])

    return null
}

// Both the 3D terrain line and the console trace use this same progress clock.
const ROUTE_DRAW_SECONDS = 4

// Ardışık segment indekslerini [ilk, son] aralıklarına böler.
function segmentRuns(indices: readonly number[]) {
    const runs: { first: number; last: number }[] = []
    for (const index of [...indices].sort((a, b) => a - b)) {
        const run = runs[runs.length - 1]
        if (run && index === run.last + 1) run.last = index
        else runs.push({ first: index, last: index })
    }
    return runs
}

// Şeffaf kalın çizgiler köşelerde üst üste binip "boncuk" yapıyordu;
// bu yüzden tüm katmanlar opak ve renk geçişi ışıkla değil renkle veriliyor.
const ROUTE_LAYERS = [
    { color: '#04161c', width: 9.5, order: 9 },   // koyu kontur: turuncu zeminde ayırır
    { color: '#7ff0e2', width: 4.2, order: 10 },  // ana gövde
    { color: '#effffb', width: 1.7, order: 11 },  // iç parlak şerit
] as const
const WARN_LIGHT = new Color('#ffe2bd')
const FLOW_SECONDS = 6

export function MissionRoute({
    points,
    cinematic,
    onProgress,
    steepSegments = [],
    dangerousSegments = [],
}: {
    points: Point[]
    cinematic: boolean
    onProgress?: (progress: number) => void
    /** 20°'yi aşan segmentler: rota üzerinde turuncu ile vurgulanır. */
    steepSegments?: readonly number[]
    /** 30°'yi aşan segmentler: rota üzerinde kırmızı ile vurgulanır. */
    dangerousSegments?: readonly number[]
}) {
    // Çizim yumuşatılmış çizgiyle yapılır; rota hesabı ve yürüyüş verisi değişmez.
    const smooth = useMemo(
        () => smoothRoute(points, steepSegments, dangerousSegments),
        [points, steepSegments, dangerousSegments],
    )
    const line = smooth.points

    const lengths = useMemo(() => {
        const total = [0]
        for (let i = 1; i < line.length; i++) {
            total.push(total[i - 1] + Math.hypot(
                line[i][0] - line[i - 1][0],
                line[i][1] - line[i - 1][1],
                line[i][2] - line[i - 1][2],
            ))
        }
        return total
    }, [line])

    const warnings = useMemo(() => [
        ...segmentRuns(smooth.steepSegments).map((run) => ({
            ...run, color: '#ff8a3d', base: new Color('#ff8a3d'),
        })),
        ...segmentRuns(smooth.dangerousSegments).map((run) => ({
            ...run, color: '#ff4d4d', base: new Color('#ff4d4d'),
        })),
    ], [smooth])

    const baseLines = useRef<(RouteLine | null)[]>([])
    const warningGroups = useRef<(Group | null)[]>([])
    const warningCores = useRef<(RouteLine | null)[]>([])
    const flowDot = useRef<Group>(null)
    const elapsed = useRef(0)
    const lastProgress = useRef(-1)

    const shot = useRef<{
        origin: Vector3
        target: Vector3
        end: Vector3
        focus: Vector3
    } | null>(null)

    // Drei's Line starts with all segments visible. Hide them before the first paint.
    useLayoutEffect(() => {
        for (const item of baseLines.current) {
            if (item) item.geometry.instanceCount = 0
        }
        for (const group of warningGroups.current) if (group) group.visible = false
        if (flowDot.current) flowDot.current.visible = false
        elapsed.current = 0
        lastProgress.current = -1
        onProgress?.(0)
    }, [points])

    useFrame(({ camera, controls, size, clock }, delta) => {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        elapsed.current = reduced
            ? ROUTE_DRAW_SECONDS
            : Math.min(ROUTE_DRAW_SECONDS, elapsed.current + delta)

        // Linear drawing gives an even, readable traversal from A to B.
        const progress = Math.min(1, elapsed.current / ROUTE_DRAW_SECONDS)
        const segmentCount = Math.max(0, line.length - 1)
        const visibleCount = progress >= 1
            ? segmentCount
            : Math.floor(progress * segmentCount)

        for (const item of baseLines.current) {
            if (item) item.geometry.instanceCount = visibleCount
        }

        // Uyarı çizgileri, ana rota o segmente ulaşınca görünür ve renkte nabız atar.
        warnings.forEach((run, i) => {
            const group = warningGroups.current[i]
            if (group) group.visible = visibleCount > run.last

            const core = warningCores.current[i]
            if (core) {
                const k = reduced ? 0.2 : (Math.sin(clock.elapsedTime * 3) + 1) * 0.25
                core.material.color.copy(run.base).lerp(WARN_LIGHT, k)
            }
        })

        // Rota tamamlanınca A'dan B'ye sürekli akan bir ışık noktası.
        const dot = flowDot.current
        if (dot) {
            if (progress < 1 || reduced || line.length < 2) {
                dot.visible = false
            } else {
                dot.visible = true
                const total = lengths[lengths.length - 1]
                const target = ((clock.elapsedTime / FLOW_SECONDS) % 1) * total
                let lo = 0
                let hi = lengths.length - 1
                while (hi - lo > 1) {
                    const mid = (lo + hi) >> 1
                    if (lengths[mid] <= target) lo = mid
                    else hi = mid
                }
                const span = lengths[hi] - lengths[lo] || 1
                const f = (target - lengths[lo]) / span
                dot.position.set(
                    line[lo][0] + (line[hi][0] - line[lo][0]) * f,
                    line[lo][1] + (line[hi][1] - line[lo][1]) * f,
                    line[lo][2] + (line[hi][2] - line[lo][2]) * f,
                )
            }
        }

        if (progress !== lastProgress.current) {
            lastProgress.current = progress
            onProgress?.(progress)
        }

        // Keep the original cinematic camera framing, independently of drawing.
        if (!cinematic || elapsed.current > 1.65) return
        const orbit = controls instanceof OrbitControlsImpl ? controls : null
        if (!(camera instanceof PerspectiveCamera) || !orbit || !size.width || !size.height) return

        if (!shot.current) {
            const bounds = new Box3()
            for (const point of points) bounds.expandByPoint(new Vector3(...point))
            bounds.expandByScalar(3)
            const { focus, end } = fitPerspective(camera, bounds, size.width / size.height)
            shot.current = {
                origin: camera.position.clone(),
                target: orbit.target.clone(),
                end,
                focus,
            }
        }

        const { origin, target, end, focus } = shot.current
        const t = ease(Math.min(1, elapsed.current / 1.15))
        if (elapsed.current <= 1.15 || reduced) {
            camera.position.lerpVectors(origin, end, t)
            orbit.target.lerpVectors(target, focus, t)
            orbit.update()
        }
    }, -2)

    return (
        <>
            {ROUTE_LAYERS.map((layer, i) => (
                <Line
                    key={layer.color}
                    ref={(value) => { baseLines.current[i] = value }}
                    points={line}
                    color={layer.color}
                    lineWidth={layer.width}
                    renderOrder={layer.order}
                    depthTest={false}
                    depthWrite={false}
                />
            ))}

            {warnings.map((run, i) => {
                const segment = line.slice(run.first, run.last + 2)
                return (
                    <group
                        key={`${run.color}-${run.first}-${run.last}`}
                        ref={(value) => { warningGroups.current[i] = value }}
                        visible={false}
                    >
                        <Line points={segment} color="#1a0800" lineWidth={11.5}
                            renderOrder={12} depthTest={false} depthWrite={false} />
                        <Line
                            ref={(value) => { warningCores.current[i] = value }}
                            points={segment} color={run.color} lineWidth={6.5}
                            renderOrder={13} depthTest={false} depthWrite={false} />
                    </group>
                )
            })}

            <group ref={flowDot} visible={false}>
                <mesh renderOrder={15}>
                    <sphereGeometry args={[1.5, 16, 12]} />
                    <meshBasicMaterial color="#7ff0e2" transparent opacity={0.28}
                        depthTest={false} depthWrite={false} />
                </mesh>
                <mesh renderOrder={16}>
                    <sphereGeometry args={[0.6, 16, 12]} />
                    <meshBasicMaterial color="#ffffff" depthTest={false} depthWrite={false} />
                </mesh>
            </group>
        </>
    )
}

const BEAM_HEIGHT = 7

/** Başlangıç (A) ve bitiş (B) işaretçisi: zemin halkası, ışık direği ve harf etiketi. */
export function RouteEndpoint({
    point,
    color,
    label,
}: {
    point: Point
    color: string
    label: string
}) {
    const pulse = useRef<Group>(null)

    useFrame(({ clock }) => {
        if (!pulse.current) return
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        pulse.current.scale.setScalar(
            reduced ? 1 : 1.15 + Math.sin(clock.elapsedTime * 2.4) * 0.18,
        )
    })

    return (
        <group position={point}>
            <group rotation={[-Math.PI / 2, 0, 0]}>
                <mesh renderOrder={13}>
                    <ringGeometry args={[1.5, 1.9, 48]} />
                    <meshBasicMaterial color={color} depthTest={false} depthWrite={false} />
                </mesh>
                <group ref={pulse}>
                    <mesh renderOrder={12}>
                        <ringGeometry args={[2.3, 2.5, 48]} />
                        <meshBasicMaterial color={color} transparent opacity={0.4}
                            depthTest={false} depthWrite={false} />
                    </mesh>
                </group>
            </group>

            <Line points={[[0, 0, 0], [0, BEAM_HEIGHT, 0]]} color="#04161c" lineWidth={5}
                renderOrder={13} depthTest={false} depthWrite={false} />
            <Line points={[[0, 0, 0], [0, BEAM_HEIGHT, 0]]} color={color} lineWidth={2}
                renderOrder={14} depthTest={false} depthWrite={false} />

            <mesh position={[0, BEAM_HEIGHT, 0]} renderOrder={15}>
                <sphereGeometry args={[0.85, 20, 14]} />
                <meshBasicMaterial color={color} depthTest={false} depthWrite={false} />
            </mesh>

            <Html
                position={[0, BEAM_HEIGHT + 2.6, 0]}
                center
                zIndexRange={[20, 0]}
                style={{ pointerEvents: 'none' }}
            >
                <div
                    style={{
                        width: 26,
                        height: 26,
                        display: 'grid',
                        placeItems: 'center',
                        borderRadius: '50%',
                        background: 'rgba(6, 10, 14, .85)',
                        border: `1.5px solid ${color}`,
                        color,
                        font: "600 12px 'IBM Plex Mono', monospace",
                        boxShadow: `0 0 12px ${color}66`,
                    }}
                >
                    {label}
                </div>
            </Html>
        </group>
    )
}

export function TerrainTarget({
    point,
}: {
    point: Point
}) {
    const pulse = useRef<Group>(null)

    useFrame(({ clock }) => {
        if (!pulse.current) return

        const reduced = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        ).matches

        const scale = reduced
            ? 1
            : 1 + (1 + Math.sin(clock.elapsedTime * 4)) * 0.18

        pulse.current.scale.setScalar(scale)
    })

    return (
        <group position={[point[0], point[1] + 1.6, point[2]]}>
            <group
                ref={pulse}
                rotation={[-Math.PI / 2, 0, 0]}
            >
                <mesh renderOrder={13}>
                    <ringGeometry args={[2.1, 2.46, 48]} />
                    <meshBasicMaterial
                        color="#83fcef"
                        depthTest={false}
                        depthWrite={false}
                    />
                </mesh>

                <mesh renderOrder={12}>
                    <ringGeometry args={[2.52, 3.05, 48]} />
                    <meshBasicMaterial
                        color="#70f6e8"
                        transparent
                        opacity={0.24}
                        depthTest={false}
                        depthWrite={false}
                    />
                </mesh>
            </group>

            <mesh renderOrder={14}>
                <sphereGeometry args={[0.55, 12, 8]} />
                <meshBasicMaterial
                    color="#eafffc"
                    depthTest={false}
                    depthWrite={false}
                />
            </mesh>
        </group>
    )
}

export function InspectionTarget({
    point,
}: {
    point: Point
}) {
    const pulse = useRef<Group>(null)

    useFrame(({ clock }) => {
        if (!pulse.current) return

        const reduced = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        ).matches

        const scale = reduced
            ? 1
            : 1 + Math.sin(clock.elapsedTime * 3) * 0.08

        pulse.current.scale.setScalar(scale)
    })

    return (
        <group position={[point[0], point[1] + 0.18, point[2]]}>
            <group
                ref={pulse}
                rotation={[-Math.PI / 2, 0, 0]}
            >
                <mesh renderOrder={15}>
                    <ringGeometry args={[1.2, 1.45, 48]} />
                    <meshBasicMaterial
                        color="#78eadc"
                        transparent
                        opacity={0.95}
                        depthTest={false}
                        depthWrite={false}
                    />
                </mesh>

                <mesh renderOrder={14}>
                    <ringGeometry args={[1.65, 1.72, 48]} />
                    <meshBasicMaterial
                        color="#78eadc"
                        transparent
                        opacity={0.35}
                        depthTest={false}
                        depthWrite={false}
                    />
                </mesh>
            </group>

            <mesh renderOrder={16}>
                <sphereGeometry args={[0.32, 16, 12]} />
                <meshBasicMaterial
                    color="#eafffc"
                    depthTest={false}
                    depthWrite={false}
                />
            </mesh>
        </group>
    )
}
