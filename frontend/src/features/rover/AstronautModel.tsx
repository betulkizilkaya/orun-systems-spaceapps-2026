
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import {
    Box3,
    Group,
    LoopRepeat,
    Vector3,
    type AnimationClip,
} from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'

type Props = {
    position: Vector3
    direction: Vector3
    playing: boolean
}

const ASTRONAUT_HEIGHT = 1.9

export function AstronautModel({
                                   position,
                                   direction,
                                   playing,
                               }: Props) {
    // Yalnızca rota konumunu ve yönünü yönetir
    const routeGroup = useRef<Group>(null)

    // Yalnızca karakter animasyonlarını yönetir
    const animationGroup = useRef<Group>(null)

    const { scene, animations } = useGLTF(
        '/models/astronaut.glb'
    )

    // İskeletli modelleri güvenli şekilde kopyala
    const model = useMemo(() => clone(scene), [scene])

    // Modelin başlangıç pozundaki boyutlarını ölç
    const modelInfo = useMemo(() => {
        model.updateMatrixWorld(true)

        const box = new Box3().setFromObject(model)

        const size = new Vector3()
        const center = new Vector3()

        box.getSize(size)
        box.getCenter(center)

        const scale =
            size.y > 0
                ? ASTRONAUT_HEIGHT / size.y
                : 1

        return {
            size,
            center,
            minY: box.min.y,
            scale,
        }
    }, [model])

    // Modelin dünya konumunu değiştiren animasyonları ayır
    const safeAnimations = useMemo(() => {
        return animations.map((clip: AnimationClip) => {
            const safeClip = clip.clone()

            safeClip.tracks = safeClip.tracks.filter((track) => {
                const path = track.name.toLowerCase()

                // Sahnenin veya model kökünün konum animasyonlarını
                // dışarıda bırak. Kemik hareketlerini koru.
                const isRootPosition =
                    path === '.position' ||
                    path === 'scene.position' ||
                    path === 'root.position'

                return !isRootPosition
            })

            return safeClip
        })
    }, [animations])

    const { actions, names } = useAnimations(
        safeAnimations,
        animationGroup
    )

    const walkName = useMemo(() => {
        return (
            names.find((name) =>
                /walk|walking|run|move/i.test(name)
            ) ?? names[0]
        )
    }, [names])

    useEffect(() => {
        console.log(
            'ASTRONAUT SIZE:',
            modelInfo.size.toArray()
        )

        console.log(
            'ASTRONAUT CENTER:',
            modelInfo.center.toArray()
        )

        console.log(
            'ASTRONAUT SCALE:',
            modelInfo.scale
        )

        console.log(
            'ASTRONAUT ANIMATIONS:',
            names
        )
    }, [modelInfo, names])

    // Animasyonu bir kez başlat
    useEffect(() => {
        if (!walkName) {
            console.warn(
                'No animation found in the astronaut model.'
            )
            return
        }

        const action = actions[walkName]

        if (!action) return

        action.reset()
        action.setLoop(LoopRepeat, Infinity)
        action.play()

        return () => {
            action.stop()
        }
    }, [actions, walkName])

    // Başlat / Duraklat
    useEffect(() => {
        if (!walkName) return

        const action = actions[walkName]

        if (action) {
            action.paused = !playing
        }
    }, [actions, walkName, playing])

    // Mars rotasındaki konumu ve yönü uygula
    useFrame(() => {
        if (!routeGroup.current) return

        routeGroup.current.position.copy(position)

        const heading = Math.atan2(
            direction.x,
            direction.z
        )

        // GLB modelinin ön yönünü rota yönüyle eşleştir
        routeGroup.current.rotation.y = heading
    })

    return (
        <group ref={routeGroup}>
            <group
                position={[
                    -modelInfo.center.x * modelInfo.scale,
                    -modelInfo.minY * modelInfo.scale,
                    -modelInfo.center.z * modelInfo.scale,
                ]}
            >
                <group
                    ref={animationGroup}
                    scale={modelInfo.scale}
                >
                    <primitive object={model} />
                </group>
            </group>
        </group>
    )
}

useGLTF.preload('/models/astronaut.glb')
