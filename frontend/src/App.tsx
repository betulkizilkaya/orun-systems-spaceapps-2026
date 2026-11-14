import { useEffect, useMemo, useState } from 'react'
import { Line, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { MOUSE, TOUCH } from 'three'
import { GeologyLayer, GEOLOGY_UNITS } from './GeologyLayer'
import { PanoramaLayer } from './PanoramaLayer'
import { loadJezeroTerrain } from './jezeroTerrain'
import { PanoramaDialog, type Panorama } from './PanoramaDialog'
import { MissionRoute, TerrainFraming, TerrainTarget } from './features/mission/MissionScene'
import { RouteProfile } from './features/mission/RouteProfile'
import './features/mission/MissionLayout.css'
import './features/mission/RouteComparison.css'
import './features/mission/JezeroOpening.css'
import { loadRouteGrid, shortestRoute } from './features/mission/routeGrid'
import { SlopeAnalysisPanel } from './SlopeAnalysisPanel'
import { RoverPlayback, type RoverTelemetry } from './features/rover/RoverPlayback'
import { RoverControls } from './features/rover/RoverControls'
import type { RoverCameraMode } from './features/rover/RoverCamera'
import { loadRoverPlayback, type RoverPlaybackData } from './features/rover/roverPlaybackData'

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
const distanceFormat = new Intl.NumberFormat('tr-TR', {
  maximumFractionDigits: 0,
})
const slopeFormat = new Intl.NumberFormat('tr-TR', {
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
    ? 'Yatay mesafeler metreye yuvarlandığında eşit.'
    : `Eğim ağırlıklı rota yatayda ${distanceFormat.format(Math.abs(distanceDifference))} m daha ${distanceDifference > 0 ? 'uzun' : 'kısa'}.`
  const slopeSummary = slopeDifference === 0
    ? 'Maksimum hücre eğimleri gösterilen hassasiyette eşit.'
    : `Eğim ağırlıklı rotanın maksimum hücre eğimi ${slopeFormat.format(Math.abs(slopeDifference) / 10)}° daha ${slopeDifference > 0 ? 'yüksek' : 'düşük'}.`

  return `${distanceSummary} ${slopeSummary}`
}

function overlayPosition([x, y, z]: MapPoint): MapPoint {
  return [x, y + MARKER_OFFSET, z]
}

function PointMarker({ point, color }: { point: MapPoint; color: string }) {
  return (
    <mesh position={overlayPosition(point)}>
      <sphereGeometry args={[1.2, 24, 16]} />
      <meshBasicMaterial color={color} />
    </mesh>
  )
}

export default function App() {
  const [exploring, setExploring] = useState(() => window.location.hash === '#harita')

  useEffect(() => {
    function syncScreen() {
      setExploring(window.location.hash === '#harita')
    }

    window.addEventListener('hashchange', syncScreen)
    return () => window.removeEventListener('hashchange', syncScreen)
  }, [])

  function enterMap() {
    window.location.hash = 'harita'
    setExploring(true)
  }
  const [view, setView] = useState<MapView>('2d')
  const [selecting, setSelecting] = useState<PointKind | null>(null)
  const [start, setStart] = useState<MapPoint | null>(null)
  const [end, setEnd] = useState<MapPoint | null>(null)
  const [terrain, setTerrain] = useState<JezeroTerrainData | null>(null)
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
  const roverOwnsCamera = roverVisible && Boolean(roverData) && roverCamera !== 'orbit'
  const roverTotal = roverData?.frames.at(-1)?.distanceM ?? 0

  useEffect(() => {
    if (!roverVisible || roverData) return
    const controller = new AbortController()

    loadRoverPlayback(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setRoverData(data)
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setRoverError(error instanceof Error ? error.message : 'Simülasyon rotası yüklenemedi.')
        }
      })

    return () => controller.abort()
  }, [roverVisible, roverData])

  const roverRoute = useMemo(() => {
    if (!terrain || !roverData) return []
    return roverData.frames.flatMap(({ projectedX, projectedY }) => {
      const point = terrain.projectToSurface(projectedX, projectedY)
      return point ? [[point[0], point[1] + 0.15, point[2]] as MapPoint] : []
    })
  }, [terrain, roverData])

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
    setShowRover(true)
  }

  function updateRoverDistance(distance: number) {
    setRoverDistance(distance)
    if (distance >= roverTotal) setRoverPlaying(false)
  }

  function updateRoverPlaying(playing: boolean) {
    if (playing && roverDistance >= roverTotal) setRoverDistance(0)
    setRoverPlaying(playing)
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
          error instanceof Error ? error.message : 'Jezero verisi okunamadı.',
        )
      })

    return () => {
      controller.abort()
      loadedTerrain?.geometry.dispose()
    }
  }, [])

  const route = useMemo(() => {
    if (!terrain || !start || !end) return null

    return terrain.getRoute(start, end)
  }, [terrain, start, end])

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
      const origin = terrain.projectToSurface(first.projectedX, first.projectedY)
      const destination = terrain.projectToSurface(last.projectedX, last.projectedY)
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
      setExampleStatus('Örnek rota yüklenemedi. Rota JSON dosyasını ve arazi verisini kontrol et.')
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
    ? 'Haritayı kaydırmak için sürükle. Yakınlaşmak için tekerleği kullan.'
    : 'Araziyi döndürmek için sürükle. Yakınlaşmak için tekerleği kullan.'

  if (selecting === 'start') {
    status = 'Başlangıç noktasını yerleştirmek için araziye tıkla.'
  } else if (selecting === 'end') {
    status = 'Bitiş noktasını yerleştirmek için araziye tıkla.'
  } else if (start && end) {
    status = route ? '' : 'Bu iki nokta arasında rota bulunamadı.'
  } else if (start) {
    status = 'Başlangıç yerleştirildi. Şimdi bitiş noktasını seç.'
  } else if (end) {
    status = 'Bitiş yerleştirildi. Şimdi başlangıç noktasını seç.'
  }

  return (
    <>
      <div
        className={`horizon-page ${exploring ? 'is-exploring' : 'is-intro'}`}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          pointerEvents: exploring ? 'none' : 'auto',
        }}
      >
        <section className="flight-cover opening-cover"
          style={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            opacity: exploring ? 0 : 1,
          }} inert={exploring} aria-hidden={exploring} aria-label="Jezero · Mars rota laboratuvarı">
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
            </svg>
            <img
              className="opening-logo"
              src={`${import.meta.env.BASE_URL}mission/orun-opening-logo.png`}
              alt="ORUN Systems"
              width={272}
              height={98}
            />
            <svg className="opening-instrument" viewBox="0 0 620 540" aria-hidden="true">
              <defs>
                <linearGradient id="jezero-arc">
                  <stop stopColor="#e9a96e" stopOpacity="0" />
                  <stop offset=".38" stopColor="#f4c594" />
                  <stop offset="1" stopColor="#d5b89c" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path className="opening-arc" d="M 50 153 C 76 63 182 -6 268 37 M 50 177 C 57 233 114 279 177 261" />
              <path className="opening-ticks" d="M 30 151 h 15 M 214 0 v 13 M 214 18 v 11 M 141 253 v 11 M 141 270 v 11 M 523 151 h 16 M 570 501 v -6 h 6 M 592 495 h 6 v 6 M 598 517 v 6 h -6 M 576 523 h -6 v -6" />
              <path className="opening-link" d="M 118 369 C 132 467 345 509 584 510" />
              <circle className="opening-beacon" cx="584" cy="510" r="2" />
            </svg>
            <div className="opening-copy">
              <h1 className="opening-heading">
                <img
                  src={`${import.meta.env.BASE_URL}mission/jezero-heading.png`}
                  alt="Jezero. Arazinin eğimini incele, yürüyüş rotanı çiz."
                  width={373}
                  height={142}
                />
              </h1>
              <button type="button" className="opening-button" disabled={!terrain}
                onClick={() => {
                  enterMap()
                  requestAnimationFrame(() => document.getElementById('jezero-map')?.focus())
                }}>
                <span className="opening-waypoint" aria-hidden="true" />
                Rota planlayıcıyı aç <span className="opening-arrow" aria-hidden="true">⟶</span>
              </button>
              {!terrain && (
                <p className="opening-status" role="status">
                  {terrainError ?? 'Arazi yükleniyor…'}
                </p>
              )}
            </div>
            <small className="opening-credit">Temsili görsel</small>
          </div>
        </section>
      </div>
      <main className="map-page mission-page" inert={!exploring}>
        <header className="map-header">
          <div className="mission-name">
            <p className="team-name">Orun Systems</p>
            <h1>Martian Map</h1>
          </div>
          <span className="terrain-label">Jezero Krateri <span aria-hidden="true">/</span> Mars</span>
        </header>

        <div className="mission-workspace">
          <section
            className="map-viewport slope-panel-host mission-viewport"
            id="jezero-map"
            tabIndex={-1}
            aria-label={
              isTopView
                ? 'Jezero demo alanının üstten görünümü'
                : 'Jezero demo alanının üç boyutlu görünümü'
            }
          >
            <Canvas
              key={view}
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
              dpr={[1, 1.5]}
              fallback={<p>Tarayıcıda harita açılamadı.</p>}
            >
              <color attach="background" args={['#0b111a']} />
              <ambientLight intensity={0.58} />
              <directionalLight position={[-45, 35, 25]} color="#ffe3ce" intensity={2.25} />
              <directionalLight position={[40, 28, -45]} color="#82b8df" intensity={0.48} />

              {terrain && (
                <mesh
                  geometry={terrain.geometry}
                  onClick={(event) => {
                    if (!selecting || roverOwnsCamera || event.delta > 4) return

                    event.stopPropagation()
                    pickPoint([event.point.x, event.point.y, event.point.z])
                  }}
                >
                  <meshStandardMaterial color="#b76543" roughness={0.95} />
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

              {start && <PointMarker point={start} color="#75e7c8" />}
              {end && <PointMarker point={end} color="#ffc475" />}

              {alternativePositions && (
                <Line points={alternativePositions} color="#ffc475" lineWidth={2}
                  dashed dashSize={1} gapSize={1.25} renderOrder={11}
                  depthTest={false} depthWrite={false} />
              )}

              {routePositions && (
                <MissionRoute
                  key={routeVersion}
                  points={routePositions}
                  cinematic={verified && !isTopView && !roverVisible}
                />
              )}

              {roverVisible && roverRoute.length > 1 && (
                <Line points={roverRoute} color="#ffc475" lineWidth={2} />
              )}

              {roverVisible && terrain && roverData && (
                <RoverPlayback
                  data={roverData}
                  projectToSurface={terrain.projectToSurface}
                  playing={roverPlaying}
                  speedMps={roverSpeed}
                  distanceM={roverDistance}
                  cameraMode={roverCamera}
                  onDistanceChange={updateRoverDistance}
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
            <div className="map-controls mission-tools">
            <button
              type="button"
              aria-pressed={isTopView}
              onClick={() => { closeRover(); setView('2d') }}
            >
              2B · Üstten
            </button>

            <button
              type="button"
              aria-pressed={!isTopView}
              onClick={() => setView('3d')}
            >
              3B · Arazi
            </button>

            <button
              type="button"
              aria-pressed={showGeology}
              disabled={!terrain}
              onClick={toggleGeology}
            >
              Jeoloji
            </button>

            <button
              type="button"
              aria-pressed={showPanoramas}
              disabled={!terrain}
              onClick={togglePanoramas}
            >
              Panoramalar
            </button>

            <button
              type="button"
              aria-expanded={showSlopeAnalysis}
              onClick={() => setShowSlopeAnalysis((visible) => !visible)}
            >
              Eğim analizi
            </button>

            </div>
            <div className="mission-map-scale">
              {isTopView ? 'Üstten görünüm' : 'Dikey ölçek 1×'}
            </div>
          </section>
          <aside className="mission-console" aria-label="Rota planlama ve astronot simülasyonu">
            <button
              type="button"
              aria-expanded={showRover}
              disabled={!terrain}
              onClick={toggleRover}
            >
              {showRover ? 'Simülasyonu kapat' : 'Astronot simülasyonunu aç'}
            </button>
            {showRover && (roverData ? (
              <RoverControls
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
              <p role="status">{roverError || 'Simülasyon rotası yükleniyor…'}</p>
            ))}

            <header>
              <h2>Rota planlama</h2>

            </header>
            <button type="button" className="mission-example" onClick={() => void openExample()}
              disabled={!terrain || loadingExample}>
              {loadingExample ? 'Örnek yükleniyor…' : 'Doğrulanmış örnek rotayı aç'}
            </button>
            {exampleStatus && <p role="alert">{exampleStatus}</p>}
            {example && !verified && <p role="status">Hesaplanan rota doğrulama kaydıyla eşleşmedi.</p>}
            <div className="mission-route-actions">

            <button
              type="button"
              aria-pressed={selecting === 'start'}
              disabled={!terrain || loadingExample}
              onClick={() => setSelecting('start')}
            >
              {start ? 'Başlangıcı değiştir' : 'Başlangıç seç'}
            </button>

            <button
              type="button"
              aria-pressed={selecting === 'end'}
              disabled={!terrain || loadingExample}
              onClick={() => setSelecting('end')}
            >
              {end ? 'Bitişi değiştir' : 'Bitiş seç'}
            </button>

            <button
              type="button"
              onClick={resetPoints}
              disabled={loadingExample || (!start && !end && selecting === null)}
            >
              Sıfırla
            </button>

            </div>

            <p className="mission-status" role="status">
              {terrainError ?? (terrain ? status : 'Jezero arazisi yükleniyor…')}
            </p>
            {route && (
              <dl className="mission-metrics">
                <div>
                  <dt>Yatay mesafe</dt>
                  <dd>{distanceFormat.format(route.distanceMeters)} <small>m</small></dd>
                </div>
                <div>
                  <dt>Maks. hücre eğimi</dt>
                  <dd>{slopeFormat.format(route.maxSlope)}<small>°</small></dd>
                </div>
              </dl>
            )}

            {route && (
              <section className="route-comparison" aria-label="Rota karşılaştırması">
                <button type="button" aria-pressed={compare}
                  onClick={() => setCompare((visible) => !visible)}>
                  {compare ? 'Karşılaştırmayı kapat' : 'Rotaları karşılaştır'}
                </button>
                {compare && !grid && (
                  <p role="status">{gridError ? 'Eğim verisi okunamadı.' : 'Eğim verisi yükleniyor…'}</p>
                )}
                {compare && grid && !alternative && <p role="status">Alternatif rota oluşturulamadı.</p>}
                {alternative && (
                  <>
                    <table>
                      <thead><tr><th scope="col">Rota</th><th scope="col">Yatay mesafe</th><th scope="col">Maks. eğim</th></tr></thead>
                      <tbody>
                        <tr><th scope="row"><i className="route-swatch route-swatch-weighted" />Eğim ağırlıklı</th>
                          <td>{distanceFormat.format(route.distanceMeters)} m</td>
                          <td>{slopeFormat.format(route.maxSlope)}°</td></tr>
                        <tr><th scope="row"><i className="route-swatch route-swatch-short" />Mesafe odaklı</th>
                          <td>{distanceFormat.format(alternative.distanceMeters)} m</td>
                          <td>{slopeFormat.format(alternative.maxSlope)}°</td></tr>
                      </tbody>
                    </table>
                    <p role="status">{describeRouteComparison(route, alternative)}</p>
                  </>
                )}
              </section>
            )}

            {route && terrain && (
              <RouteProfile key={routeVersion}
                grid={grid}
                gridError={gridError && !grid}
                points={route.points}
                width={terrain.geometry.parameters.width}
                depth={terrain.geometry.parameters.height}
                distanceMeters={route.distanceMeters}
                verified={verified}
                onHighlight={setHighlight}
              />
            )}

            {showGeology &&
              (geologyError ? (
                <span role="alert">{geologyError}</span>
              ) : (
                <span>
                  <span style={{ color: GEOLOGY_UNITS.cr.color }}>
                    {GEOLOGY_UNITS.cr.label}
                  </span>
                  {' · '}
                  <span style={{ color: GEOLOGY_UNITS.Nnp1.color }}>
                    {GEOLOGY_UNITS.Nnp1.label}
                  </span>
                </span>
              ))}

            {showPanoramas &&
              (panoramaError ? (
                <span role="alert">{panoramaError}</span>
              ) : (
                <span>360° pinler yaklaşık çekim konumlarını gösterir.</span>
              ))}
          </aside>
        </div>
        {activePanorama && (
          <PanoramaDialog
            panorama={activePanorama}
            onClose={() => setActivePanorama(null)}
          />
        )}
      </main>
    </>
  )
}
