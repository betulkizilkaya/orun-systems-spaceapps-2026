import { useEffect, useMemo, useState } from 'react'
import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { MOUSE, TOUCH } from 'three'
import { GeologyLayer, GEOLOGY_UNITS } from './GeologyLayer'
import { PanoramaLayer } from './PanoramaLayer'
import { loadJezeroTerrain } from './jezeroTerrain'
import { PanoramaDialog, type Panorama } from './PanoramaDialog'
import { MissionRoute, TerrainFraming, TerrainTarget } from './features/mission/MissionScene'
import { RouteProfile } from './features/mission/RouteProfile'
import './features/mission/MissionLayout.css'
import { SlopeAnalysisPanel } from './SlopeAnalysisPanel'

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

  const isTopView = view === '2d'

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
    <main className="map-page mission-page">
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
                  if (!selecting || event.delta > 4) return

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

            {routePositions && (
              <MissionRoute
                key={routeVersion}
                points={routePositions}
                cinematic={verified && !isTopView}
              />
            )}

            {isTopView ? (
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
                minDistance={25}
                maxDistance={450}
                maxPolarAngle={Math.PI / 2 - 0.06}
              />
            )}
            {terrain && <TerrainFraming geometry={terrain.geometry} />}
          </Canvas>
          {showSlopeAnalysis && (
            <SlopeAnalysisPanel onClose={() => setShowSlopeAnalysis(false)} />
          )}

          <div className="mission-frame" aria-hidden="true" />
          <div className="map-controls mission-tools">
          <button
            type="button"
            aria-pressed={isTopView}
            onClick={() => setView('2d')}
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
        <aside className="mission-console" aria-label="Rota planlama">
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

          {route && terrain && (
            <RouteProfile key={routeVersion}
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
  )
}
