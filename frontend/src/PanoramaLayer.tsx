import { useEffect, useState } from 'react'
import { Html } from '@react-three/drei'
import type { loadJezeroTerrain } from './jezeroTerrain'
import type { Panorama } from './PanoramaDialog'
import './PanoramaLayer.css'

type Terrain = Awaited<ReturnType<typeof loadJezeroTerrain>>

type PanoramaPoint = {
  id: string
  projectedX: number
  projectedY: number
}

const PANORAMAS: Record<string, Panorama> = {
  'broom-point': {
    name: 'Broom Point',
    sol: '1438–1443',
    url: 'https://maps.planet.fu-berlin.de/jezero/360/44',
  },
  'south-arm': {
    name: 'South Arm',
    sol: '1412',
    url: 'https://maps.planet.fu-berlin.de/jezero/360/43',
  },
  'trout-river-shallow-bay': {
    name: 'Trout River / Shallow Bay',
    sol: '1399',
    url: 'https://maps.planet.fu-berlin.de/jezero/360/42',
  },
  'lookout-hill': {
    name: 'Jezero Crater Rim Crest at Lookout Hill',
    sol: '1356–1358',
    url: 'https://maps.planet.fu-berlin.de/jezero/360/41',
  },
}

export function PanoramaLayer({
  terrain,
  onError,
  onSelect,
}: {
  terrain: Terrain
  onError: (message: string) => void
  onSelect: (panorama: Panorama) => void
}) {
  const [points, setPoints] = useState<PanoramaPoint[]>([])

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      const response = await fetch(
        `${import.meta.env.BASE_URL}data/jezero_4camera_positions.json`,
        { signal: controller.signal },
      )

      if (!response.ok) {
        throw new Error(`Panorama konumları yüklenemedi (HTTP ${response.status}).`)
      }

      const data: PanoramaPoint[] = await response.json()
      const [west, south, east, north] = terrain.bounds

      if (
        !Array.isArray(data) ||
        data.length !== 4 ||
        new Set(data.map((point) => point.id)).size !== 4 ||
        data.some(
          (point) =>
            !Object.hasOwn(PANORAMAS, point.id) ||
            !Number.isFinite(point.projectedX) ||
            !Number.isFinite(point.projectedY) ||
            point.projectedX < west ||
            point.projectedX > east ||
            point.projectedY < south ||
            point.projectedY > north,
        )
      ) {
        throw new Error('Panorama konumları bu parselin verisiyle eşleşmiyor.')
      }

      if (!controller.signal.aborted) setPoints(data)
    }

    load().catch((error: unknown) => {
      if (controller.signal.aborted) return
      onError(error instanceof Error ? error.message : 'Panorama konumları okunamadı.')
    })

    return () => controller.abort()
  }, [terrain, onError])

  return (
    <>
      {points.map(({ id, projectedX, projectedY }) => {
        const panorama = PANORAMAS[id]
        const [x, y, z] = terrain.projectToSurface(projectedX, projectedY)
        const label = `${panorama.name} · Yaklaşık çekim konumu`

        return (
          // Pin, yer noktasına oturur: alt-orta nokta araziye değer, chip direğin ucunda durur.
          <Html key={id} position={[x, y + 0.4, z]} zIndexRange={[10, 0]}>
            <div className="pano-pin">
              <button
                type="button"
                className="pano-chip"
                aria-label={`${label} · Panoramayı görüntüle`}
                aria-haspopup="dialog"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  onSelect(panorama)
                }}
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <ellipse cx="12" cy="12" rx="10" ry="4.5" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span className="pano-tip" role="tooltip">
                  <strong>{panorama.name}</strong>
                  <small>360° · Sol {panorama.sol}</small>
                </span>
              </button>
              <i className="pano-stem" aria-hidden="true" />
              <i className="pano-ground" aria-hidden="true" />
            </div>
          </Html>
        )
      })}
    </>
  )
}