import { Line, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { MOUSE, TOUCH, TextureLoader, SRGBColorSpace } from 'three'
import { useLoader } from '@react-three/fiber'
import { GeologyLayer, GEOLOGY_UNITS } from './GeologyLayer'
import { PanoramaLayer } from './PanoramaLayer'
import { loadJezeroTerrain } from './jezeroTerrain'
import { PanoramaDialog, type Panorama } from './PanoramaDialog'
import { RouteProfile } from './features/mission/RouteProfile'
import './features/mission/MissionLayout.css'
import './features/mission/RouteComparison.css'
import './features/mission/JezeroOpening.css'
import './features/mission/JezeroConsole.css'
import './features/mission/JezeroLayoutFix.css'
import './features/mission/JezeroArrival.css'   // YENİ
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMissionAudio } from './useMissionAudio'
import { TerrainInspectionPanel, type TerrainInspection } from './features/mission/TerrainInspectionPanel'
import {
    TerrainFraming,
    MissionRoute,
    TerrainTarget,
    InspectionTarget,
    RouteEndpoint,
} from './features/mission/MissionScene'
import './features/mission/TerrainInspectionPanel.css'
import { loadRouteGrid, shortestRoute } from './features/mission/routeGrid'
import { SlopeAnalysisPanel } from './SlopeAnalysisPanel'
import { RoverPlayback, type RoverTelemetry } from './features/rover/RoverPlayback'
import { JezeroWalkControls } from './features/rover/JezeroWalkControls'
import type { RoverCameraMode } from './features/rover/RoverCamera'
import { loadRoverPlayback, type RoverPlaybackData } from './features/rover/roverPlaybackData'
import { createRoutePlayback } from './features/rover/createRoutePlayback'
import { formatDuration } from './walkingTime' // YENİ

type MapPoint = [x: number, y: number, z: number]
type ExampleRoute = {
    demBounds: { west: number; south: number; east: number; north: number }
    distanceMeters: number
    maxSlopeDegrees: number
    points: { projectedX: number; projectedY: number }[]
}

type PointKind = 'start' | 'end'
type MapView = '2d' | '3d'
type JezeroTerrainData = Awaited<ReturnType<typeof loadJezeroTerrain>>

const MARKER_OFFSET = 1.2
const distanceFormat = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
})
const slopeFormat = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
})

function describeRouteComparison(
    weighted: { distanceMeters: number; maxSlope: number },
    distanceFocused: { distanceMeters: number; maxSlope: number },
) {
    const distanceDifference =
        Math.round(weighted.distanceMeters) - Math.round(distanceFocused.distanceMeters)
    const slopeDifference =
        Math.round(weighted.maxSlope * 10) - Math.round(distanceFocused.maxSlope * 10)

    const distanceSummary = distanceDifference === 0
        ? 'Horizontal distances are equal when rounded to the nearest meter.'
        : `The slope-weighted route is ${distanceFormat.format(Math.abs(distanceDifference))} m ${distanceDifference > 0 ? 'longer' : 'shorter'} horizontally.`
    const slopeSummary = slopeDifference === 0
        ? 'Maximum cell slopes are equal at the precision shown.'
        : `The slope-weighted route's maximum cell slope is ${slopeFormat.format(Math.abs(slopeDifference) / 10)}° ${slopeDifference > 0 ? 'higher' : 'lower'}.`

    return `${distanceSummary} ${slopeSummary}`
}

function formatEta(seconds: number) {
    const total = Math.max(0, Math.round(seconds))
    const mm = String(Math.floor(total / 60)).padStart(2, '0')
    const ss = String(total % 60).padStart(2, '0')
    return `T+${mm}:${ss}`
}

function overlayPosition([x, y, z]: MapPoint): MapPoint {
    return [x, y + MARKER_OFFSET, z]
}

function TerrainMaterial() {
    const texture = useLoader(
        TextureLoader,
        `${import.meta.env.BASE_URL}mission/jezero-terrain-tinted.webp`
    )

    texture.colorSpace = SRGBColorSpace

    return (
        <meshStandardMaterial
            map={texture}
            roughness={1}
            metalness={0}
        />
    )
}

function PointMarker({ point, color, label }: { point: MapPoint; color: string; label: string }) {
    return <RouteEndpoint point={overlayPosition(point)} color={color} label={label} />
}

export default function App() {
    const {
        soundEnabled,
        toggleSound,
        playUiClick,
        playInitialization,
        playCameraTransition,
        playRouteCalculated,
        playDestinationReached,
    } = useMissionAudio()
    const [exploring, setExploring] = useState(() => window.location.hash === '#harita')

    useEffect(() => {
        function syncScreen() {
            setExploring(window.location.hash === '#harita')
        }

        window.addEventListener('hashchange', syncScreen)
        return () => window.removeEventListener('hashchange', syncScreen)
    }, [])

    function enterMap() {
        closeRover()
        window.location.hash = 'harita'
        setExploring(true)
    }
    const [view, setView] = useState<MapView>('2d')
    const switchingView = useRef(false)

    async function switchMapView(next: MapView) {
        if (next === view || switchingView.current) return

        const canvas = document.querySelector('#jezero-map canvas')
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

        switchingView.current = true
        try {
            if (canvas && !reducedMotion) {
                await canvas.animate(
                    [{ opacity: 1 }, { opacity: 0 }],
                    { duration: 140, easing: 'ease-in', fill: 'forwards' },
                ).finished
            }

            if (next === '2d') closeRover()
            setView(next)
        } finally {
            switchingView.current = false
        }
    }
    const [selecting, setSelecting] = useState<PointKind | null>(null)
    const [start, setStart] = useState<MapPoint | null>(null)
    const [end, setEnd] = useState<MapPoint | null>(null)
    const [terrain, setTerrain] = useState<JezeroTerrainData | null>(null)
    const [inspection, setInspection] = useState<TerrainInspection | null>(null)
    const [terrainError, setTerrainError] = useState<string | null>(null)
    const [showGeology, setShowGeology] = useState(false)
    const [geologyError, setGeologyError] = useState<string | null>(null)
    const [showPanoramas, setShowPanoramas] = useState(false)
    const [panoramaError, setPanoramaError] = useState<string | null>(null)
    const [activePanorama, setActivePanorama] = useState<Panorama | null>(null)
    const [showSlopeAnalysis, setShowSlopeAnalysis] = useState(false)

    const [example, setExample] = useState<ExampleRoute | null>(null)
    const [exampleStatus, setExampleStatus] = useState('')
    const [loadingExample, setLoadingExample] = useState(false)
    const [highlight, setHighlight] = useState<MapPoint | null>(null)
    const [routeVersion, setRouteVersion] = useState(0)

    const [grid, setGrid] = useState<number[][] | null>(null)
    const [gridError, setGridError] = useState(false)
    const [compare, setCompare] = useState(false)

    const [showRover, setShowRover] = useState(false)
    const [roverData, setRoverData] = useState<RoverPlaybackData | null>(null)
    const [roverError, setRoverError] = useState('')
    const [roverPlaying, setRoverPlaying] = useState(false)
    const [roverDistance, setRoverDistance] = useState(0)
    const [roverSpeed, setRoverSpeed] = useState(10)
    const [roverCamera, setRoverCamera] = useState<RoverCameraMode>('orbit')
    const [roverTelemetry, setRoverTelemetry] = useState<RoverTelemetry | null>(null)

    const isTopView = view === '2d'
    const roverVisible = exploring && showRover && !isTopView

    const route = useMemo(() => {
        if (!terrain || !start || !end) return null

        return terrain.getRoute(start, end)
    }, [terrain, start, end])

    const lastAnnouncedRoute = useRef<typeof route>(null)

    useEffect(() => {
        if (!exploring || !route || lastAnnouncedRoute.current === route) return

        lastAnnouncedRoute.current = route
        playRouteCalculated()
    }, [exploring, route, playRouteCalculated])

    const selectedRoverData = useMemo(() => {
        if (!route || !terrain) return null

        const [west, south, east, north] = terrain.bounds
        const sceneWidth = terrain.geometry.parameters.width
        const sceneDepth = terrain.geometry.parameters.height

        return createRoutePlayback(
            route.points,
            [west, south, east, north],
            sceneWidth,
            sceneDepth,
            terrain.sampleTerrain,
        )

    }, [route, terrain])

    useEffect(() => {
        if (!roverVisible || roverData || selectedRoverData) return

        const controller = new AbortController()

        loadRoverPlayback(controller.signal)
            .then((data) => {
                if (!controller.signal.aborted) setRoverData(data)
            })
            .catch((error: unknown) => {
                if (!controller.signal.aborted) {
                    setRoverError(
                        error instanceof Error
                            ? error.message
                            : 'Could not load the simulation route.',
                    )
                }
            })

        return () => controller.abort()
    }, [roverVisible, roverData, selectedRoverData])

    function closeRover() {
        setShowRover(false)
        setRoverPlaying(false)
        setRoverCamera('orbit')
    }

    function toggleRover() {
        if (showRover) {
            closeRover()
            return
        }
        setRoverError('')
        setSelecting(null)
        setView('3d')
        setShowSlopeAnalysis(false)
        setRoverCamera('follow')
        setShowRover(true)
    }

    useEffect(() => {
        const controller = new AbortController()
        let loadedTerrain: JezeroTerrainData | undefined

        loadJezeroTerrain(controller.signal)
            .then((result) => {
                if (controller.signal.aborted) {
                    result.geometry.dispose()
                    return
                }

                loadedTerrain = result
                setTerrain(result)
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) return

                setTerrainError(
                    error instanceof Error ? error.message : 'Could not read the Jezero data.',
                )
            })

        return () => {
            controller.abort()
            loadedTerrain?.geometry.dispose()
        }
    }, [])

    useEffect(() => {
        setRoverPlaying(false)
        setRoverDistance(0)
        setRoverTelemetry(null)
    }, [selectedRoverData])

    const activeRoverData = selectedRoverData ?? roverData

    const roverOwnsCamera =
        roverVisible &&
        Boolean(activeRoverData) &&
        roverCamera !== 'orbit'

    const roverTotal =
        activeRoverData?.frames.at(-1)?.distanceM ?? 0

    const roverRoute = useMemo(() => {
        if (!terrain || !activeRoverData) return []

        return activeRoverData.frames.flatMap(
            ({ projectedX, projectedY }) => {
                const point = terrain.projectToSurface(
                    projectedX,
                    projectedY,
                )

                return point
                    ? [[point[0], point[1] + 0.15, point[2]] as MapPoint]
                    : []
            },
        )
    }, [terrain, activeRoverData])

    function updateRoverDistance(distance: number) {
        setRoverDistance(distance)
        if (distance >= roverTotal) setRoverPlaying(false)
    }

    function updatePlaybackDistance(distance: number) {
        const reachedEnd =
            roverPlaying && roverTotal > 0 &&
            roverDistance < roverTotal && distance >= roverTotal

        updateRoverDistance(distance)

        if (reachedEnd) playDestinationReached()
    }

    function updateRoverPlaying(playing: boolean) {
        if (playing && roverDistance >= roverTotal) setRoverDistance(0)
        setRoverPlaying(playing)
    }

    const needsGrid = Boolean(route)

    useEffect(() => {
        if (!needsGrid || grid) return
        const controller = new AbortController()
        loadRouteGrid(controller.signal).then((result) => {
            if (!controller.signal.aborted) setGrid(result)
        }).catch(() => {
            if (!controller.signal.aborted) setGridError(true)
        })
        return () => controller.abort()
    }, [needsGrid, grid])

    const alternative = useMemo(() => {
        if (!compare || !grid || !route || !terrain || !start || !end) return null
        const { width, height } = terrain.geometry.parameters
        return shortestRoute(grid, start, end, terrain.bounds, width, height, terrain.projectToSurface)
    }, [compare, grid, route, terrain, start, end])

    const alternativePositions = useMemo(
        () => alternative?.points.map(overlayPosition) ?? null,
        [alternative],
    )

    const routePositions = useMemo(
        () => route?.points.map(overlayPosition) ?? null,
        [route],
    )

    const verified = Boolean(
        example && route && terrain &&
        route.points.length === example.points.length &&
        Math.abs(route.distanceMeters - example.distanceMeters) < 0.001 &&
        Math.abs(route.maxSlope - example.maxSlopeDegrees) < 0.00001 &&
        route.points.every(([x, , z], i) => {
            const [west, south, east, north] = terrain.bounds
            const { width, height } = terrain.geometry.parameters
            return Math.abs(west + (x / width + 0.5) * (east - west) - example.points[i].projectedX) < 0.001 &&
                Math.abs(north - (z / height + 0.5) * (north - south) - example.points[i].projectedY) < 0.001
        }),
    )

    async function openExample() {
        if (!terrain) return
        setLoadingExample(true)
        setExampleStatus('')
        try {
            const response = await fetch(`${import.meta.env.BASE_URL}data/jezero-test-rotasi.json`)
            if (!response.ok) throw new Error('Example unavailable')
            const data = (await response.json()) as ExampleRoute
            const { west, south, east, north } = data.demBounds
            if (!terrain.bounds.every((value, i) => value === [west, south, east, north][i])) {
                throw new Error('Unexpected terrain bounds')
            }

            const first = data.points[0]
            const last = data.points[data.points.length - 1]

            const origin = terrain.projectToSurface(
                first.projectedX,
                first.projectedY
            )

            const destination = terrain.projectToSurface(
                last.projectedX,
                last.projectedY
            )

            if (!origin || !destination) throw new Error('Example outside terrain')
            setStart(origin)
            setEnd(destination)
            setSelecting(null)
            setHighlight(null)
            setRouteVersion((version) => version + 1)
            setExample(data)
            setView('3d')
            setShowSlopeAnalysis(false)
        } catch {
            setExampleStatus('Could not load the example route. Check the route JSON file and the terrain data.')
        } finally {
            setLoadingExample(false)
        }
    }

    function pickPoint(point: MapPoint) {
        if (!selecting || loadingExample) return

        setExample(null)
        setExampleStatus('')
        setHighlight(null)
        setRouteVersion((version) => version + 1)

        if (selecting === 'start') {
            setStart(point)
        } else {
            setEnd(point)
        }

        setSelecting(null)
    }

    function resetPoints() {
        setExample(null)
        setExampleStatus('')
        setHighlight(null)
        setStart(null)
        setEnd(null)
        setSelecting(null)
        setCompare(false)

        // Astronot simülasyonunu temizle
        setShowRover(false)
        setRoverPlaying(false)
        setRoverDistance(0)
        setRoverTelemetry(null)
        setRoverCamera('orbit')
    }

    function toggleGeology() {
        setGeologyError(null)
        setShowGeology((visible) => !visible)
    }

    function togglePanoramas() {
        setPanoramaError(null)
        setShowPanoramas((visible) => !visible)
    }

    let status = isTopView
        ? 'Drag to pan the map. Use the wheel to zoom.'
        : 'Drag to rotate the terrain. Use the wheel to zoom.'

    if (selecting === 'start') {
        status = 'Click the terrain to place the start point.'
    } else if (selecting === 'end') {
        status = 'Click the terrain to place the end point.'
    } else if (start && end) {
        status = route ? '' : 'No route found between these two points.'
    } else if (start) {
        status = 'Start placed. Now pick the end point.'
    } else if (end) {
        status = 'End placed. Now pick the start point.'
    }

    return (
        <>
            <button
                type="button"
                aria-label="Mission sounds"
                aria-pressed={soundEnabled}
                onClick={toggleSound}
                style={{
                    position: 'fixed',
                    top: 16,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 201,
                    padding: '8px 14px',
                    border: '1px solid #ffffff40',
                    borderRadius: 999,
                    background: '#101112e6',
                    color: '#f5f1eb',
                    cursor: 'pointer',
                }}
            >
                {soundEnabled ? 'Sound on' : 'Sound off'}
            </button>
            <div
                className={`horizon-page ${exploring ? 'is-exploring' : 'is-intro'}`}
                style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 200,
                    pointerEvents: exploring ? 'none' : 'auto',
                }}
            >
                <section className="flight-cover opening-cover"
                         style={{
                             position: 'absolute',
                             inset: 0,
                             overflow: 'hidden',
                             opacity: exploring ? 0 : 1,
                         }} inert={exploring} aria-hidden={exploring} aria-label="Jezero · Mars route lab">
                    <div className="opening-frame">
                        <img className="opening-image"
                             src={`${import.meta.env.BASE_URL}mission/jezero-opening.png`}
                             width={1672}
                             height={941}
                             fetchPriority="high"
                             alt=""
                        />
                        <svg
                            className="opening-route"
                            viewBox="0 0 1672 941"
                            preserveAspectRatio="xMidYMid slice"
                            aria-hidden="true"
                        >
                            <path
                                pathLength="100"
                                d="M 1044 681
                   C 1017 684 994 685 969 680
                   C 950 677 968 668 961 659
                   C 957 653 952 648 947 641
                   C 925 634 872 629 841 612
                   C 839 609 852 603 864 590
                   C 880 578 849 576 820 571
                   C 786 562 750 574 711 563
                   C 693 560 675 557 676 553
                   C 679 550 711 539 721 534
                   C 720 531 701 526 700 523
                   C 700 519 726 515 745 513
                   C 780 510 815 513 857 497
                   C 862 494 856 487 854 485
                   C 851 480 890 477 910 472
                   C 932 467 953 461 950 456
                   C 946 451 945 447 938 444
                   C 927 441 917 438 910 434"
                            />
                            <g className="opening-tag" aria-hidden="true">
                                <line x1="1044" y1="693" x2="1044" y2="722" />
                                <circle cx="1044" cy="681" r="11" fill="none" />
                                <circle cx="1044" cy="681" r="4" />
                                <rect x="860" y="722" width="224" height="54" rx="12" />
                                <text x="878" y="745">ROUTE PREVIEW</text>
                                <text x="878" y="765">START → END</text>
                            </g>
                        </svg>
                        <img
                            className="opening-logo"
                            src={`${import.meta.env.BASE_URL}mission/orun-opening-logo.png`}
                            alt="ORUN Systems"
                            width={272}
                            height={98}
                        />
                        <div className="opening-meta" aria-hidden="true">
                            <span>18.38° N · 77.58° E</span>
                            <span>JEZERO CRATER · MARS</span>
                        </div>
                        <div className="opening-copy">
                            <p className="opening-eyebrow">
                                <span className="opening-eyebrow-line" aria-hidden="true" />
                                TERRAIN ANALYSIS
                            </p>

                            <h1 className="opening-heading">
                                <img
                                    src={`${import.meta.env.BASE_URL}mission/jezero-heading.png`}
                                    alt="Jezero. Inspect the terrain slope, plan your walking route."
                                    width={466}
                                    height={178}
                                />
                            </h1>

                            <p className="opening-description" aria-hidden="true">
                                Inspect the slope of the terrain,<br />plan your walking route.
                            </p>

                            <button type="button" className="opening-button" disabled={!terrain}
                                    onClick={() => {
                                        playInitialization()
                                        enterMap()
                                        requestAnimationFrame(() => {
                                            document.getElementById('jezero-map')?.focus({ preventScroll: true })
                                        })
                                    }}>
                                <span className="opening-waypoint" aria-hidden="true" />
                                Open route planner
                                <svg className="opening-arrow" viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M3 12h17M14 6l6 6-6 6" />
                                </svg>
                            </button>
                            {!terrain && (
                                <p className="opening-status" role="status">
                                    {terrainError ?? 'Loading terrain…'}
                                </p>
                            )}
                        </div>
                        <ol className="opening-steps" aria-hidden="true">
                            <li><b>01</b>Inspect slope</li>
                            <li><b>02</b>Plan your route</li>
                            <li><b>03</b>Watch the walk</li>
                        </ol>
                        <small className="opening-credit">This image was generated by AI</small>
                    </div>
                </section>
            </div>
            <main className={`map-page mission-page jezero-console-page${roverVisible ? ' walk-open' : ''}`} inert={!exploring}>
                <div className="mission-workspace">
                    <section
                        className="map-viewport slope-panel-host mission-viewport"
                        id="jezero-map"
                        tabIndex={-1}
                        aria-label={
                            isTopView
                                ? 'Top-down view of the Jezero demo area'
                                : '3D view of the Jezero demo area'
                        }
                    >

                        <Canvas
                            key={view}
                            className="jezero-canvas"
                            orthographic={isTopView}
                            camera={
                                isTopView
                                    ? {
                                        position: [0, 150, 0],
                                        up: [0, 0, -1],
                                        zoom: 1,
                                        near: 0.1,
                                        far: 500,
                                    }
                                    : {
                                        position: [85, 72, 92],
                                        fov: 46,
                                        near: 0.1,
                                        far: 500,
                                    }
                            }
                            gl={{ alpha: true }}
                            onCreated={({ gl }) => gl.setClearAlpha(0)}
                            dpr={[1, 1.5]}
                            fallback={<p>The map could not be opened in this browser.</p>}
                        >
                            <ambientLight intensity={0.58} />
                            <directionalLight position={[-45, 35, 25]} color="#ffe3ce" intensity={2.25} />
                            <directionalLight position={[40, 28, -45]} color="#82b8df" intensity={0.48} />

                            {terrain && (
                                <mesh
                                    geometry={terrain.geometry}

                                    onClick={(event) => {
                                        if (!terrain || roverOwnsCamera || event.delta > 4) return

                                        event.stopPropagation()

                                        const point: MapPoint = [
                                            event.point.x,
                                            event.point.y,
                                            event.point.z,
                                        ]

                                        if (selecting) {
                                            setInspection(null)
                                            pickPoint(point)
                                            return
                                        }

                                        const [west, , east, north] = terrain.bounds
                                        const width = terrain.geometry.parameters.width
                                        const depth = terrain.geometry.parameters.height

                                        const easting =
                                            west + (point[0] / width + 0.5) * (east - west)

                                        const northing =
                                            north - (point[2] / depth + 0.5) *
                                            (north - terrain.bounds[1])

                                        const sample = terrain.sampleTerrain(easting, northing)

                                        if (!sample) {
                                            setInspection(null)
                                            return
                                        }

                                        setInspection({
                                            easting,
                                            northing,
                                            elevationM: sample.elevationM,
                                            slopeDeg: sample.slopeDeg,
                                        })
                                    }}

                                >
                                    <TerrainMaterial />
                                </mesh>
                            )}

                            {terrain && showGeology && (
                                <GeologyLayer terrain={terrain} onError={setGeologyError} />
                            )}

                            {terrain && showPanoramas && (
                                <PanoramaLayer
                                    terrain={terrain}
                                    onError={setPanoramaError}
                                    onSelect={setActivePanorama}
                                />
                            )}

                            {highlight && <TerrainTarget point={highlight} />}

                            {inspection && terrain && !selecting && (
                                <InspectionTarget
                                    point={terrain.projectToSurface(
                                        inspection.easting,
                                        inspection.northing
                                    )}
                                />
                            )}

                            {start && <PointMarker point={start} color="#7fd8ff" label="A" />}
                            {end && <PointMarker point={end} color="#ffb25b" label="B" />}

                            {alternativePositions && !roverVisible && (
                                <Line points={alternativePositions} color="#ffc475" lineWidth={2}
                                      dashed dashSize={1} gapSize={1.25} renderOrder={11}
                                      depthTest={false} depthWrite={false} />
                            )}

                            {routePositions && !roverVisible && (
                                <MissionRoute
                                    key={routeVersion}
                                    points={routePositions}
                                    steepSegments={route?.steepSegments}
                                    dangerousSegments={route?.dangerousSegments}
                                    cinematic={verified && !isTopView && !roverVisible}
                                />
                            )}

                            {roverVisible && roverRoute.length > 1 && (
                                <Line points={roverRoute} color="#ffc475" lineWidth={2} />
                            )}

                            {roverVisible && terrain && activeRoverData && (
                                <RoverPlayback
                                    data={activeRoverData}
                                    projectToSurface={terrain.projectToSurface}
                                    playing={roverPlaying}
                                    speedMps={roverSpeed}
                                    distanceM={roverDistance}
                                    cameraMode={roverCamera}
                                    onApproachStart={playCameraTransition}
                                    onDistanceChange={updatePlaybackDistance}
                                    onTelemetry={setRoverTelemetry}
                                />
                            )}

                            {!roverOwnsCamera && (isTopView ? (
                                <OrbitControls
                                    makeDefault
                                    enableRotate={false}
                                    mouseButtons={{
                                        LEFT: MOUSE.PAN,
                                        MIDDLE: MOUSE.DOLLY,
                                        RIGHT: MOUSE.PAN,
                                    }}
                                    touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_PAN }}
                                    minZoom={1}
                                    maxZoom={40}
                                />
                            ) : (
                                <OrbitControls
                                    makeDefault
                                    enableDamping
                                    target={[0, 0, 0]}
                                    minDistance={roverVisible ? 3 : 25}
                                    maxDistance={450}
                                    maxPolarAngle={Math.PI / 2 - 0.06}
                                />
                            ))}
                            {terrain && !roverOwnsCamera && <TerrainFraming geometry={terrain.geometry} />}
                        </Canvas>
                        {showSlopeAnalysis && (
                            <SlopeAnalysisPanel onClose={() => setShowSlopeAnalysis(false)} />
                        )}

                        <div className="mission-frame" aria-hidden="true" />
                        {inspection && !selecting && (
                            <TerrainInspectionPanel
                                inspection={inspection}
                                onClose={() => setInspection(null)}
                            />
                        )}
                        <div className="map-controls mission-tools">
                            <button
                                type="button"
                                aria-pressed={isTopView}
                                onClick={() => void switchMapView('2d')}
                            >
                                2D · Top-down
                            </button>

                            <button
                                type="button"
                                aria-pressed={!isTopView}
                                onClick={() => {
                                    if (view !== '3d') playUiClick()
                                    void switchMapView('3d')
                                }}
                            >
                                3D · Terrain
                            </button>

                            <button
                                type="button"
                                aria-pressed={showGeology}
                                disabled={!terrain}
                                onClick={toggleGeology}
                            >
                                Geology
                            </button>

                            <button
                                type="button"
                                aria-pressed={showPanoramas}
                                disabled={!terrain}
                                onClick={togglePanoramas}
                            >
                                Panoramas
                            </button>

                            <button
                                type="button"
                                aria-expanded={showSlopeAnalysis}
                                onClick={() => setShowSlopeAnalysis((visible) => !visible)}
                            >
                                Slope analysis
                            </button>

                        </div>
                        <div className="mission-map-scale">
                            {isTopView ? 'Top-down view' : 'Vertical scale 1×'}
                        </div>
                    </section>
                    <div className="jezero-side-stack">
                    <header className="map-header">
                        <div className="mission-name">
                            <img className="jezero-brand" src={`${import.meta.env.BASE_URL}mission/orun-opening-logo.png`} alt="ORUN Systems" />
                            <h1 className="jz-sr-only">Jezero</h1>
                        </div>
                    </header>
                        <aside className="jz-panel" aria-label="Route planning and astronaut simulation">
                            <div className="jz-top">
                                <span className="jz-label">Mission 01</span>
                                <span className="jz-label jz-state" data-ready={Boolean(route)}>
                                    <i aria-hidden="true" /> {route ? 'Route ready' : 'Awaiting route'}
                                </span>
                            </div>
                            <p className="jz-label jz-kicker">1 km² area · 18.38° N · 77.58° E</p>
                            <h2 className="jz-title">Exploration route</h2>

                            <div className="jz-route">
                                <span className="jz-spine" aria-hidden="true">
                                    <span
                                        key={`spine-${routeVersion}-${route ? 'on' : 'off'}`}
                                        className={`jz-spine-fill${route ? ' is-drawn' : ''}`}
                                    />
                                </span>
                                <i className="jz-node jz-node-a" data-set={Boolean(start)} aria-hidden="true" />
                                <i className="jz-node jz-node-b" data-set={Boolean(end)} aria-hidden="true" />

                                <div className="jz-endpoint">
                                    <span className="jz-label">A · Start</span>
                                    <button
                                        type="button"
                                        className="jz-pill"
                                        aria-pressed={selecting === 'start'}
                                        disabled={!terrain || loadingExample}
                                        onClick={() => setSelecting('start')}
                                    >
                                        {start ? 'Change' : 'Select'}
                                    </button>
                                </div>

                                <dl className="jz-metrics">
                                    <div className="jz-metric">
                                        <dt className="jz-label">Horizontal distance</dt>
                                        <dd className="jz-big">
                                            {route ? distanceFormat.format(route.distanceMeters) : '—'}
                                            <small> m</small>
                                        </dd>
                                    </div>
                                    <div className="jz-metric jz-gauge">
                                        <dt className="jz-label">Max. slope</dt>
                                        <dd>
                                            <svg
                                                width="118"
                                                height="68"
                                                viewBox="0 0 120 68"
                                                role="img"
                                                aria-label={route ? `Maximum slope ${slopeFormat.format(route.maxSlope)} degrees` : 'No slope data'}
                                            >
                                                <path className="jz-gauge-track" d="M10 62A50 50 0 0 1 110 62" pathLength={100} />
                                                <path
                                                    className="jz-gauge-value"
                                                    d="M10 62A50 50 0 0 1 110 62"
                                                    pathLength={100}
                                                    data-level={route?.assessment.level}
                                                    strokeDasharray={`${route ? Math.min(route.maxSlope / 40, 1) * 100 : 0} 100`}
                                                />
                                                <text x="60" y="56" textAnchor="middle">
                                                    {route ? `${slopeFormat.format(route.maxSlope)}°` : '—'}
                                                </text>
                                            </svg>
                                        </dd>
                                    </div>
                                </dl>

                                <div className="jz-endpoint">
                                    <span className="jz-label">B · End</span>
                                    <button
                                        type="button"
                                        className="jz-pill"
                                        aria-pressed={selecting === 'end'}
                                        disabled={!terrain || loadingExample}
                                        onClick={() => setSelecting('end')}
                                    >
                                        {end ? 'Change' : 'Select'}
                                    </button>
                                </div>
                            </div>

                            {/* Estimated arrival time card */}
                            {route?.walking && (
                                <div className="jz-arrival" role="status">
                                    <span className="jz-label">Estimated arrival time</span>
                                    <strong className="jz-arrival-time">
                                        {formatDuration(route.walking.seconds)}
                                    </strong>
                                    <span className="jz-arrival-detail">
                                        Avg. {slopeFormat.format(route.walking.averageSpeedKmh)} km/h
                                        {' · '}↑ {distanceFormat.format(route.walking.ascentMeters)} m
                                        {' · '}↓ {distanceFormat.format(route.walking.descentMeters)} m
                                    </span>
                                    <span className="jz-arrival-detail">
                                        Average adult walking pace, adjusted for slope; breaks not included.
                                    </span>
                                </div>
                            )}

                            {route && (route.assessment.discouraged || route.assessment.level === 'hard') && (
                                <div
                                    className="jz-warning"
                                    data-level={route.assessment.level}
                                    role="status"
                                >
                                    <strong>{route.assessment.title}</strong>
                                    <p>{route.assessment.reason}</p>
                                </div>
                            )}
                            {exampleStatus && <p className="jz-note" role="alert">{exampleStatus}</p>}
                            {example && !verified && (
                                <p className="jz-note" role="status">The calculated route did not match the verification record.</p>
                            )}
                            <p className="jz-note mission-status" role="status">
                                {terrainError ?? (terrain ? status : 'Loading Jezero terrain…')}
                            </p>

                            {route && terrain && (
                                <details className="jz-profile">
                                    <summary className="jz-label">Slope profile</summary>
                                    <RouteProfile
                                        key={routeVersion}
                                        grid={grid}
                                        gridError={gridError && !grid}
                                        points={route.points}
                                        width={terrain.geometry.parameters.width}
                                        depth={terrain.geometry.parameters.height}
                                        distanceMeters={route.distanceMeters}
                                        verified={verified}
                                        onHighlight={setHighlight}
                                    />
                                </details>
                            )}

                            {route && compare && (
                                <section className="route-comparison" aria-label="Route comparison">
                                    {!grid && (
                                        <p role="status">{gridError ? 'Could not read the slope data.' : 'Loading slope data…'}</p>
                                    )}
                                    {grid && !alternative && <p role="status">Could not create an alternative route.</p>}
                                    {alternative && (
                                        <>
                                            <table>
                                                <thead><tr><th scope="col">Route</th><th scope="col">Horizontal distance</th><th scope="col">Max. slope</th></tr></thead>
                                                <tbody>
                                                <tr><th scope="row"><i className="route-swatch route-swatch-weighted" />Slope-weighted</th>
                                                    <td>{distanceFormat.format(route.distanceMeters)} m</td>
                                                    <td>{slopeFormat.format(route.maxSlope)}°</td></tr>
                                                <tr><th scope="row"><i className="route-swatch route-swatch-short" />Distance-focused</th>
                                                    <td>{distanceFormat.format(alternative.distanceMeters)} m</td>
                                                    <td>{slopeFormat.format(alternative.maxSlope)}°</td></tr>
                                                </tbody>
                                            </table>
                                            <p role="status">{describeRouteComparison(route, alternative)}</p>
                                        </>
                                    )}
                                </section>
                            )}

                            {showGeology &&
                                (geologyError ? (
                                    <p className="jz-note" role="alert">{geologyError}</p>
                                ) : (
                                    <p className="jz-note">
                                        <span style={{ color: GEOLOGY_UNITS.cr.color }}>{GEOLOGY_UNITS.cr.label}</span>
                                        {' · '}
                                        <span style={{ color: GEOLOGY_UNITS.Nnp1.color }}>{GEOLOGY_UNITS.Nnp1.label}</span>
                                    </p>
                                ))}

                            {showPanoramas &&
                                (panoramaError ? (
                                    <p className="jz-note" role="alert">{panoramaError}</p>
                                ) : (
                                    <p className="jz-note">360° pins show approximate capture locations.</p>
                                ))}

                            <div className="jz-actions">
                                <button type="button" className="jz-primary" disabled={!terrain} onClick={toggleRover}>
                                    <span>▶ Start walk</span>
                                    <span className="jz-eta">{route ? formatEta(route.distanceMeters / roverSpeed) : 'T+--:--'}</span>
                                </button>
                                <div className="jz-secondary">
                                    <button
                                        type="button"
                                        className="jz-pill"
                                        onClick={() => void openExample()}
                                        disabled={!terrain || loadingExample}
                                    >
                                        {loadingExample ? 'Loading…' : 'Open example route'}
                                    </button>
                                    {route && (
                                        <button
                                            type="button"
                                            className="jz-pill"
                                            aria-expanded={compare}
                                            onClick={() => setCompare((visible) => !visible)}
                                        >
                                            {compare ? 'Close comparison' : 'Compare'}
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className="jz-pill"
                                        onClick={resetPoints}
                                        disabled={loadingExample || (!start && !end && selecting === null)}
                                    >
                                        ↶ Reset
                                    </button>
                                </div>
                            </div>
                        </aside>
                    </div>

                </div>
                {activePanorama && (
                    <PanoramaDialog
                        panorama={activePanorama}
                        onClose={() => setActivePanorama(null)}
                    />
                )}
                {roverVisible && (
                    <>
                        <header className="walk-header">
                            <span className="walk-wordmark">ORUN SYSTEMS</span>
                            <div className="walk-heading">
                                <h1>Jezero</h1>
                                <p>Walk simulation</p>
                            </div>
                            <button type="button" className="walk-exit" onClick={closeRover}>
                                Exit <span aria-hidden="true">↗</span>
                            </button>
                        </header>
                        <section className="walk-dock" aria-label="Walk controls">
                            {activeRoverData ? (
                                <JezeroWalkControls
                                    frames={activeRoverData.frames}
                                    playing={roverPlaying}
                                    setPlaying={updateRoverPlaying}
                                    distanceM={roverDistance}
                                    setDistanceM={updateRoverDistance}
                                    totalDistanceM={roverTotal}
                                    speedMps={roverSpeed}
                                    setSpeedMps={setRoverSpeed}
                                    cameraMode={roverCamera}
                                    setCameraMode={setRoverCamera}
                                    telemetry={roverTelemetry}
                                />
                            ) : (
                                <p role="status">{roverError || 'Loading simulation route…'}</p>
                            )}
                        </section>
                    </>
                )}
            </main>
        </>
    )
}