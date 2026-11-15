import { useEffect, useMemo, useState } from 'react'
import { Line } from '@react-three/drei'
import type { loadJezeroTerrain } from './jezeroTerrain'

type Terrain = Awaited<ReturnType<typeof loadJezeroTerrain>>
type Coordinate = [easting: number, northing: number]
type ScenePoint = [x: number, y: number, z: number]

type GeologyData = {
  bounds: number[]
  units: {
    code: 'cr' | 'Nnp1'
    polygons: Coordinate[][][]
  }[]
}

export const GEOLOGY_UNITS = {
  cr: { label: 'Crater rim (cr)', color: '#ffd27a' },
  Nnp1: { label: 'Nili Planum 1 (Nnp1)', color: '#79e2ff' },
}

export function GeologyLayer({
  terrain,
  onError,
}: {
  terrain: Terrain
  onError: (message: string) => void
}) {
  const [data, setData] = useState<GeologyData | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      const response = await fetch(
        `${import.meta.env.BASE_URL}data/jezero-geology.json`,
        { signal: controller.signal },
      )

      if (!response.ok) {
        throw new Error(`Could not open the geology file (HTTP ${response.status}).`)
      }

      const geology: GeologyData = await response.json()

      const boundsMatch =
        geology.bounds.length === terrain.bounds.length &&
        geology.bounds.every(
          (value, index) => Math.abs(value - terrain.bounds[index]) < 0.01,
        )

      if (!boundsMatch) {
        throw new Error('The geology layer and the DEM cover different parcels.')
      }

      if (!controller.signal.aborted) setData(geology)
    }

    load().catch((error: unknown) => {
      if (controller.signal.aborted) return
      onError(error instanceof Error ? error.message : 'Could not load geology.')
    })

    return () => controller.abort()
  }, [terrain, onError])

  const outlines = useMemo(() => {
    if (!data) return []

    return data.units.flatMap((unit) =>
      unit.polygons.flatMap((polygon, polygonIndex) =>
        polygon.map((ring, ringIndex) => {
          const points: ScenePoint[] = []

          for (let index = 1; index < ring.length; index += 1) {
            const [x, y] = ring[index - 1]
            const [endX, endY] = ring[index]
            const dx = endX - x
            const dy = endY - y
            const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 3))

            for (let step = index === 1 ? 0 : 1; step <= steps; step += 1) {
              const t = step / steps
              const [sceneX, height, sceneZ] = terrain.projectToSurface(
                x + dx * t,
                y + dy * t,
              )

              points.push([sceneX, height + 0.3, sceneZ])
            }
          }

          return {
            id: `${unit.code}-${polygonIndex}-${ringIndex}`,
            color: GEOLOGY_UNITS[unit.code].color,
            points,
          }
        }),
      ),
    )
  }, [data, terrain])

  return (
    <>
      {outlines.map(({ id, color, points }) => (
        <Line
          key={id}
          points={points}
          color={color}
          lineWidth={2}
          depthWrite={false}
        />
      ))}
    </>
  )
}