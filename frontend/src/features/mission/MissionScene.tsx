import { Line } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import { Box3, OrthographicCamera, PerspectiveCamera, Vector3, type BufferGeometry, type Group } from 'three'

type Point = [number, number, number]
type RouteLine = { geometry: { instanceCount: number } }
type Orbit = { target: Vector3; update: () => void }

function ease(value: number) {
  return value * value * (3 - 2 * value)
}

const viewDirection = new Vector3(0.66, 0.84, 0.96).normalize()
const screenRight = new Vector3(0, 1, 0).cross(viewDirection).normalize()
const screenUp = viewDirection.clone().cross(screenRight)

function fitPerspective(camera: PerspectiveCamera, bounds: Box3, aspect: number) {
  const focus = bounds.getCenter(new Vector3())
  const vertical = Math.tan(camera.fov * Math.PI / 360) * 0.78 / camera.zoom
  const horizontal = vertical * aspect
  let distance = 0

  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        const offset = new Vector3(x, y, z).sub(focus)
        distance = Math.max(distance, offset.dot(viewDirection) + Math.max(
          Math.abs(offset.dot(screenRight)) / horizontal,
          Math.abs(offset.dot(screenUp)) / vertical,
        ))
      }
    }
  }

  return { focus, end: focus.clone().addScaledVector(viewDirection, Math.max(35, distance)) }
}

export function TerrainFraming({ geometry }: { geometry: BufferGeometry }) {
  const { camera, controls, size } = useThree()
  const previousFit = useRef(0)
  const fittedCamera = useRef<PerspectiveCamera | null>(null)

  useLayoutEffect(() => {
    if (!size.width || !size.height) return
    const orbit = controls as Orbit | null
    if (!orbit?.target) return
    geometry.computeBoundingBox()
    const bounds = geometry.boundingBox
    if (!bounds || bounds.isEmpty()) return

    if (camera instanceof OrthographicCamera) {
      const extent = bounds.getSize(new Vector3())
      const fit = Math.min(size.width / extent.x, size.height / extent.z) * 0.72
      camera.zoom = previousFit.current ? camera.zoom * fit / previousFit.current : fit
      previousFit.current = fit
      camera.updateProjectionMatrix()
    } else if (camera instanceof PerspectiveCamera && fittedCamera.current !== camera) {
      const { focus, end } = fitPerspective(camera, bounds, size.width / size.height)
      camera.position.copy(end)
      orbit.target.copy(focus)
      orbit.update()
      fittedCamera.current = camera
    }
  }, [camera, controls, geometry, size.width, size.height])

  return null
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
    const orbit = controls as Orbit | null
    if (!(camera instanceof PerspectiveCamera) || !orbit?.target || !size.width || !size.height) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

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

    elapsed.current = reduced ? 1.65 : Math.min(1.65, elapsed.current + delta)
    if (shot.current && orbit?.target && elapsed.current <= 1.65) {
      const { origin, target, end, focus } = shot.current
      const t = ease(Math.min(1, elapsed.current / 1.15))
      if (reduced || elapsed.current - delta < 1.15) {
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
