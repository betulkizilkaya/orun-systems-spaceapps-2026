import { Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { Vector3, type Group } from 'three'

type Point = [number, number, number]
type RouteLine = { geometry: { instanceCount: number } }
type Orbit = { target: Vector3; update: () => void }

function ease(value: number) {
  return value * value * (3 - 2 * value)
}

export function MissionRoute({
  points, cinematic,
}: {
  points: Point[]
  cinematic: boolean
}) {
  const core = useRef<RouteLine | null>(null)
  const glow = useRef<RouteLine | null>(null)
  const elapsed = useRef(0)
  const shot = useRef<{
    origin: Vector3
    target: Vector3
    end: Vector3
    focus: Vector3
  } | null>(null)

  useFrame(({ camera, controls, size }, delta) => {
    if (!cinematic || elapsed.current >= 1.65) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const orbit = controls as Orbit | null
    if (!shot.current && orbit?.target) {
      const focus = new Vector3()
      const minimum = new Vector3(Infinity, Infinity, Infinity)
      const maximum = new Vector3(-Infinity, -Infinity, -Infinity)
      for (const point of points) {
        const vertex = new Vector3(...point)
        minimum.min(vertex)
        maximum.max(vertex)
      }
      focus.addVectors(minimum, maximum).multiplyScalar(0.5)
      const span = Math.max(maximum.x - minimum.x, maximum.z - minimum.z)
      const distance = Math.max(96, span * 1.7 / Math.min(1, size.width / size.height))
      const offset = new Vector3(0.66, 0.84, 0.96).normalize().multiplyScalar(Math.min(distance, 224))
      shot.current = {
        origin: camera.position.clone(),
        target: orbit.target.clone(),
        end: focus.clone().add(offset),
        focus,
      }
    }

    elapsed.current = Math.min(1.65, elapsed.current + delta)
    if (shot.current && orbit?.target && elapsed.current <= 1.65) {
      const { origin, target, end, focus } = shot.current
      const t = ease(Math.min(1, elapsed.current / 1.15))
      if (elapsed.current - delta < 1.15) {
        camera.position.lerpVectors(origin, end, t)
        orbit.target.lerpVectors(target, focus, t)
        orbit.update()
      }
    }

    const progress = ease(Math.max(0, Math.min(1, (elapsed.current - 0.12) / 1.53)))
    const count = Math.floor(progress * (points.length - 1))
    if (core.current) core.current.geometry.instanceCount = count
    if (glow.current) glow.current.geometry.instanceCount = count
  }, -2)

  return (
    <>
      <Line ref={(value) => { glow.current = value }}
        points={points} color="#3ce6dc" lineWidth={9} transparent opacity={0.24}
        renderOrder={9} depthTest={false} depthWrite={false} />
      <Line ref={(value) => { core.current = value }}
        points={points} color="#d8fff5" lineWidth={3.2}
        renderOrder={10} depthTest={false} depthWrite={false} />
    </>
  )
}

export function TerrainTarget({ point }: { point: Point }) {
  const pulse = useRef<Group>(null)

  useFrame(({ clock }) => {
    if (!pulse.current) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const scale = reduced ? 1 : 1 + (1 + Math.sin(clock.elapsedTime * 4)) * 0.18
    pulse.current.scale.setScalar(scale)
  })

  return (
    <group position={[point[0], point[1] + 1.6, point[2]]}>
      <group ref={pulse} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh renderOrder={13}>
          <ringGeometry args={[2.1, 2.46, 48]} />
          <meshBasicMaterial color="#83fcef" depthTest={false} depthWrite={false} />
        </mesh>
        <mesh renderOrder={12}>
          <ringGeometry args={[2.52, 3.05, 48]} />
          <meshBasicMaterial color="#70f6e8" transparent opacity={0.24} depthTest={false} depthWrite={false} />
        </mesh>
      </group>
      <mesh renderOrder={14}>
        <sphereGeometry args={[0.55, 12, 8]} />
        <meshBasicMaterial color="#eafffc" depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  )
}
