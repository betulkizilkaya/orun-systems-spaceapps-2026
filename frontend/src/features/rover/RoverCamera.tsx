
import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { Quaternion, Vector3 } from 'three'

export type RoverCameraMode = 'orbit' | 'follow' | 'pov'

type Props = {
    position: Vector3
    direction: Vector3
    mode: RoverCameraMode
}

// Astronota yakın üçüncü şahıs kamerası
const FOLLOW_DISTANCE = 3
const FOLLOW_HEIGHT = 2.2
const FOLLOW_LOOK_HEIGHT = 1.65
const FOLLOW_LOOK_AHEAD = 0

// Astronotun göz hizasından kamera
const POV_HEIGHT = 1.7
const POV_LOOK_AHEAD = 20

export function RoverCamera({
                                position,
                                direction,
                                mode,
                            }: Props) {
    const { camera } = useThree()

    const previousMode = useRef<RoverCameraMode>('orbit')

    // Yumuşatılmış hareket yönü
    const smoothDirection = useRef(
        new Vector3(0, 0, 1)
    )

    // Yumuşatılmış bakış hedefi
    const smoothTarget = useRef(new Vector3())

    useFrame((_, delta) => {
        if (mode === 'orbit') {
            previousMode.current = 'orbit'
            return
        }

        const dt = Math.min(delta, 0.05)

        // Astronotun yatay hareket yönünü hesapla
        const desiredDirection = direction.clone()
        desiredDirection.y = 0

        if (desiredDirection.lengthSq() < 0.000001) {
            desiredDirection.set(0, 0, 1)
        } else {
            desiredDirection.normalize()
        }

        const directionAlpha =
            1 - Math.exp(-3 * dt)

        // Kamera modu değiştiğinde yönü güncelle
        if (previousMode.current !== mode) {
            smoothDirection.current.copy(desiredDirection)

            smoothTarget.current
                .copy(position)
                .add(new Vector3(0, 1.5, 0))

            previousMode.current = mode
        }

        smoothDirection.current
            .lerp(desiredDirection, directionAlpha)
            .normalize()

        const forward = smoothDirection.current

        const desiredPosition = new Vector3()
        const desiredTarget = new Vector3()

        if (mode === 'follow') {
            // Astronotun 2,5 metre arkasından takip
            desiredPosition
                .copy(position)
                .addScaledVector(
                    forward,
                    -FOLLOW_DISTANCE
                )
                .add(
                    new Vector3(0, FOLLOW_HEIGHT, 0)
                )

            // Astronotun üst gövdesine odaklan
            desiredTarget
                .copy(position)
                .addScaledVector(
                    forward,
                    FOLLOW_LOOK_AHEAD
                )
                .add(
                    new Vector3(0, FOLLOW_LOOK_HEIGHT, 0)
                )
        } else {
            // Birinci şahıs kamera
            desiredPosition
                .copy(position)
                .add(
                    new Vector3(0, POV_HEIGHT, 0)
                )

            desiredTarget
                .copy(position)
                .addScaledVector(
                    forward,
                    POV_LOOK_AHEAD
                )
                .add(
                    new Vector3(0, POV_HEIGHT, 0)
                )
        }

        // Kamera geçişlerinin yumuşaklığı
        const positionSpeed =
            mode === 'follow' ? 18 : 10

        const rotationSpeed =
            mode === 'follow' ? 12 : 8

        const positionAlpha =
            1 - Math.exp(-positionSpeed * dt)

        const rotationAlpha =
            1 - Math.exp(-rotationSpeed * dt)

        // Kamera konumunu yumuşakça güncelle
        if (mode === 'follow') {
            camera.position.copy(desiredPosition)
        } else {
            camera.position.lerp(
                desiredPosition,
                positionAlpha
            )
        }

        // Bakış hedefini yumuşakça güncelle
        if (mode === 'follow') {
            smoothTarget.current.copy(desiredTarget)
        } else {
            smoothTarget.current.lerp(
                desiredTarget,
                rotationAlpha
            )
        }

        // Hedef kamera yönelimini hesapla
        const tempCamera = camera.clone()

        tempCamera.position.copy(
            camera.position
        )

        tempCamera.lookAt(
            smoothTarget.current
        )

        const targetQuaternion =
            new Quaternion().copy(
                tempCamera.quaternion
            )

        if (mode === 'follow') {
            camera.quaternion.copy(targetQuaternion)
        } else {
            camera.quaternion.slerp(
                targetQuaternion,
                rotationAlpha
            )
        }

        camera.updateMatrixWorld()
    })

    return null
}
