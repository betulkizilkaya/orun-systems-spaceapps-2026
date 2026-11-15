import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Quaternion, Vector3 } from 'three'

export type RoverCameraMode = 'orbit' | 'follow' | 'pov'

type Props = {
    position: Vector3
    direction: Vector3
    mode: RoverCameraMode
    onApproachStart?: () => void
}

type CameraApproach = {
    startTime: number
    position: Vector3
    rotation: Quaternion
}

const FOLLOW_DISTANCE = 3
const FOLLOW_HEIGHT = 1.65
const POV_HEIGHT = 1.7
const MOUSE_SENSITIVITY = 0.003
const MAX_PITCH = Math.PI / 2 - 0.12
const APPROACH_DURATION_SECONDS = 1.07

export function RoverCamera({
    position,
    direction,
    mode,
    onApproachStart,
}: Props) {
    const { camera, gl } = useThree()
    const previousMode = useRef<RoverCameraMode>('orbit')
    const smoothDirection = useRef(new Vector3(0, 0, 1))
    const smoothTarget = useRef(new Vector3())
    const yawOffset = useRef(0)
    const pitch = useRef(0)
    const dragging = useRef(false)
    const lastPointer = useRef({ x: 0, y: 0 })
    const firstApproachStarted = useRef(false)
    const approach = useRef<CameraApproach | null>(null)

    useEffect(() => {
        if (mode === 'orbit') return

        const canvas = gl.domElement

        const onPointerDown = (event: PointerEvent) => {
            if (event.button !== 0) return
            dragging.current = true
            lastPointer.current = { x: event.clientX, y: event.clientY }
            canvas.setPointerCapture(event.pointerId)
        }

        const onPointerMove = (event: PointerEvent) => {
            if (!dragging.current) return
            const dx = event.clientX - lastPointer.current.x
            const dy = event.clientY - lastPointer.current.y
            lastPointer.current = { x: event.clientX, y: event.clientY }
            yawOffset.current -= dx * MOUSE_SENSITIVITY
            pitch.current = Math.max(
                -MAX_PITCH,
                Math.min(MAX_PITCH, pitch.current - dy * MOUSE_SENSITIVITY),
            )
        }

        const onPointerUp = () => {
            dragging.current = false
        }

        canvas.addEventListener('pointerdown', onPointerDown)
        canvas.addEventListener('pointermove', onPointerMove)
        canvas.addEventListener('pointerup', onPointerUp)
        canvas.addEventListener('pointercancel', onPointerUp)
        canvas.addEventListener('lostpointercapture', onPointerUp)

        return () => {
            dragging.current = false
            canvas.removeEventListener('pointerdown', onPointerDown)
            canvas.removeEventListener('pointermove', onPointerMove)
            canvas.removeEventListener('pointerup', onPointerUp)
            canvas.removeEventListener('pointercancel', onPointerUp)
            canvas.removeEventListener('lostpointercapture', onPointerUp)
        }
    }, [gl, mode])

    useFrame(({ clock }, delta) => {
        if (mode === 'orbit') {
            approach.current = null
            previousMode.current = 'orbit'
            return
        }

        const dt = Math.min(delta, 0.05)
        const desiredDirection = direction.clone()
        desiredDirection.y = 0

        if (desiredDirection.lengthSq() < 0.000001) {
            desiredDirection.copy(smoothDirection.current)
        } else {
            desiredDirection.normalize()
        }

        if (previousMode.current !== mode) {
            approach.current = null
            smoothDirection.current.copy(desiredDirection)
            yawOffset.current = 0
            pitch.current = 0
            smoothTarget.current.copy(position).add(new Vector3(0, POV_HEIGHT, 0))
            previousMode.current = mode

            if (mode === 'follow' && !firstApproachStarted.current) {
                firstApproachStarted.current = true

                const reducedMotion = window.matchMedia(
                    '(prefers-reduced-motion: reduce)',
                ).matches

                if (!reducedMotion) {
                    approach.current = {
                        startTime: clock.elapsedTime,
                        position: camera.position.clone(),
                        rotation: camera.quaternion.clone(),
                    }
                    onApproachStart?.()
                }
            }
        }

        smoothDirection.current.lerp(
            desiredDirection,
            1 - Math.exp(-3 * dt),
        ).normalize()

        const baseYaw = Math.atan2(smoothDirection.current.x, smoothDirection.current.z)
        const yaw = baseYaw + yawOffset.current
        const cosPitch = Math.cos(pitch.current)
        const lookDirection = new Vector3(
            Math.sin(yaw) * cosPitch,
            Math.sin(pitch.current),
            Math.cos(yaw) * cosPitch,
        )

        const desiredPosition = new Vector3()
        const desiredTarget = new Vector3()

        if (mode === 'follow') {
            desiredTarget.copy(position).add(new Vector3(0, FOLLOW_HEIGHT, 0))
            desiredPosition.copy(desiredTarget).addScaledVector(lookDirection, -FOLLOW_DISTANCE)
        } else {
            desiredPosition.copy(position).add(new Vector3(0, POV_HEIGHT, 0))
            desiredTarget.copy(desiredPosition).addScaledVector(lookDirection, 20)
        }

        const tempCamera = camera.clone()
        const activeApproach = approach.current

        if (activeApproach) {
            const progress = Math.min(
                1,
                (clock.elapsedTime - activeApproach.startTime) / APPROACH_DURATION_SECONDS,
            )
            const eased = progress * progress * (3 - 2 * progress)

            tempCamera.position.copy(desiredPosition)
            tempCamera.lookAt(desiredTarget)

            camera.position.lerpVectors(activeApproach.position, desiredPosition, eased)
            camera.quaternion.slerpQuaternions(
                activeApproach.rotation,
                tempCamera.quaternion,
                eased,
            )
            smoothTarget.current.copy(desiredTarget)

            if (progress >= 1) approach.current = null
        } else {
            const positionAlpha = 1 - Math.exp(-(mode === 'follow' ? 18 : 10) * dt)
            const rotationAlpha = 1 - Math.exp(-(mode === 'follow' ? 12 : 8) * dt)

            camera.position.lerp(desiredPosition, positionAlpha)
            smoothTarget.current.lerp(desiredTarget, rotationAlpha)

            tempCamera.position.copy(camera.position)
            tempCamera.lookAt(smoothTarget.current)
            camera.quaternion.slerp(tempCamera.quaternion, rotationAlpha)
        }

        camera.updateMatrixWorld()
    })

    return null
}