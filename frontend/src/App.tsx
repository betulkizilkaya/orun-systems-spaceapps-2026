import { useEffect, useMemo, useState } from 'react'
import { Line, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { MOUSE, TOUCH } from 'three'
import { loadJezeroTerrain } from './jezeroTerrain'

type MapPoint = [x: number, y: number, z: number]
type PointKind = 'start' | 'end'
type MapView = '2d' | '3d'
type JezeroTerrainData = Awaited<ReturnType<typeof loadJezeroTerrain>>

const MARKER_OFFSET = 1.2

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

  function pickPoint(point: MapPoint) {
    if (!selecting) return

    if (selecting === 'start') {
      setStart(point)
    } else {
      setEnd(point)
    }

    setSelecting(null)
  }

  function resetPoints() {
    setStart(null)
    setEnd(null)
    setSelecting(null)
  }

  let status = isTopView
    ? 'Haritayı kaydırmak için sürükle. Yakınlaşmak için tekerleği kullan.'
    : 'Araziyi döndürmek için sürükle. Yakınlaşmak için tekerleği kullan.'

  if (selecting === 'start') {
    status = 'Başlangıç noktasını yerleştirmek için araziye tıkla.'
  } else if (selecting === 'end') {
    status = 'Bitiş noktasını yerleştirmek için araziye tıkla.'
  } else if (start && end) {
    status = route
      ? `Rota hücrelerinde en yüksek eğim: ${route.maxSlope.toLocaleString('tr-TR', {
          maximumFractionDigits: 1,
        })}°`
      : 'Bu iki nokta arasında rota bulunamadı.'
  } else if (start) {
    status = 'Başlangıç yerleştirildi. Şimdi bitiş noktasını seç.'
  } else if (end) {
    status = 'Bitiş yerleştirildi. Şimdi başlangıç noktasını seç.'
  }

  return (
    <main className="map-page">
      <header className="map-header">
        <div>
          <p className="team-name">Orun Systems</p>
          <h1>Martian Map</h1>
        </div>
        <span className="terrain-label">Jezero · Demo alanı</span>
      </header>

      <section
        className="map-viewport"
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
                  zoom: 2.5,
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
          fallback={<p>Tarayıcıda 3B harita açılamadı.</p>}
        >
          <color attach="background" args={['#101318']} />
          <ambientLight intensity={0.7} />
          <directionalLight position={[-45, 35, 25]} intensity={2.4} />

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

          {start && <PointMarker point={start} color="#75e7c8" />}
          {end && <PointMarker point={end} color="#ffc475" />}

          {routePositions && (
            <Line
              points={routePositions}
              color="#f4eee8"
              lineWidth={2.5}
              renderOrder={10}
              depthTest={false}
              depthWrite={false}
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
              maxZoom={10}
            />
          ) : (
            <OrbitControls
              makeDefault
              enableDamping
              target={[0, 0, 0]}
              minDistance={25}
              maxDistance={240}
              maxPolarAngle={Math.PI / 2 - 0.06}
            />
          )}
        </Canvas>
      </section>

      <div className="map-controls">
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

        {!isTopView && <span>Dikey ölçek 1×</span>}

        <button
          type="button"
          aria-pressed={selecting === 'start'}
          disabled={!terrain}
          onClick={() => setSelecting('start')}
        >
          {start ? 'Başlangıcı değiştir' : 'Başlangıç seç'}
        </button>

        <button
          type="button"
          aria-pressed={selecting === 'end'}
          disabled={!terrain}
          onClick={() => setSelecting('end')}
        >
          {end ? 'Bitişi değiştir' : 'Bitiş seç'}
        </button>

        <button
          type="button"
          onClick={resetPoints}
          disabled={!start && !end && selecting === null}
        >
          Sıfırla
        </button>

        <span role="status">
          {terrainError ?? (terrain ? status : 'Jezero arazisi yükleniyor…')}
        </span>
      </div>
    </main>
  )
}