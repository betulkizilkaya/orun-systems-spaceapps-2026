import { useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import { Box3, OrthographicCamera, PerspectiveCamera, Vector3, type BufferGeometry } from 'three'

type Orbit = { target: Vector3; update: () => void }

const viewDirection = new Vector3(0.64, 0.63, 1).normalize()
const screenRight = new Vector3(0, 1, 0).cross(viewDirection).normalize()
const screenUp = viewDirection.clone().cross(screenRight)

function fitPerspective(camera: PerspectiveCamera, bounds: Box3, aspect: number) {
  const focus = bounds.getCenter(new Vector3())
  const vertical = Math.tan(camera.fov * Math.PI / 360) * 0.89 / camera.zoom
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

