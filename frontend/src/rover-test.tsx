
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

import { loadJezeroTerrain } from './jezeroTerrain'

import {
    RoverPlayback,
    type RoverTelemetry,
} from './features/rover/RoverPlayback'

import { RoverControls } from './features/rover/RoverControls'

import {
    loadRoverPlayback,
    type RoverPlaybackData,
} from './features/rover/roverPlaybackData'

import type { RoverCameraMode } from './features/rover/RoverCamera'

import './index.css'

type Terrain = Awaited<ReturnType<typeof loadJezeroTerrain>>

function RoverTest() {
    const [terrain, setTerrain] = useState<Terrain | null>(null)
    const [data, setData] = useState<RoverPlaybackData | null>(null)
    const [error, setError] = useState('')

    const [playing, setPlaying] = useState(false)
    const [distance, setDistance] = useState(0)
    const [speed, setSpeed] = useState(10)

    const [cameraMode, setCameraMode] =
        useState<RoverCameraMode>('orbit')

    const [telemetry, setTelemetry] =
        useState<RoverTelemetry | null>(null)

    useEffect(() => {
        const controller = new AbortController()
        let loadedTerrain: Terrain | null = null

        async function load() {
            try {
                const [terrainResult, playbackResult] = await Promise.all([
                    loadJezeroTerrain(controller.signal),
                    loadRoverPlayback(controller.signal),
                ])

                if (controller.signal.aborted) {
                    terrainResult.geometry.dispose()
                    return
                }

                loadedTerrain = terrainResult
                setTerrain(terrainResult)
                setData(playbackResult)
            } catch (err) {
                if (!controller.signal.aborted) {
                    setError(err instanceof Error ? err.message : String(err))
                }
            }
        }

        void load()

        return () => {
            controller.abort()
            loadedTerrain?.geometry.dispose()
        }
    }, [])

    return (
        <main
            style={{
                minHeight: '100vh',
                background: '#080d14',
                color: '#e9f2fa',
                fontFamily: 'Arial, sans-serif',
                padding: 24,
                boxSizing: 'border-box',
            }}
        >
            <p
                style={{
                    letterSpacing: 3,
                    color: '#75e7c8',
                }}
            >
                ORUN SYSTEMS
            </p>

            <h1>Jezero Rover Simulation</h1>

            <p>
                DEM-based route playback · Experimental simulation
            </p>

            {error && (
                <p
                    role="alert"
                    style={{ color: '#ff8989' }}
                >
                    {error}
                </p>
            )}

            <div
                style={{
                    height: '65vh',
                    minHeight: 400,
                    border: '1px solid #304454',
                    borderRadius: 14,
                    overflow: 'hidden',
                    background: '#0b111a',
                }}
            >
                <Canvas
                    camera={{
                        position: [85, 72, 92],
                        fov: 40,
                        near: 0.1,
                        far: 1500,
                    }}
                >
                    <color
                        attach="background"
                        args={['#0b111a']}
                    />

                    <ambientLight intensity={0.8} />

                    <directionalLight
                        position={[-45, 65, 25]}
                        intensity={2.2}
                        color="#ffe3ce"
                    />

                    {terrain && (
                        <mesh geometry={terrain.geometry}>
                            <meshStandardMaterial
                                color="#b76543"
                                roughness={0.95}
                            />
                        </mesh>
                    )}

                    {terrain && data && (
                        <RoverPlayback
                            data={data}
                            projectToSurface={terrain.projectToSurface}
                            playing={playing}
                            speedMps={speed}
                            distanceM={distance}
                            cameraMode={cameraMode}
                            onDistanceChange={setDistance}
                            onTelemetry={setTelemetry}
                        />
                    )}

                    <OrbitControls
                        makeDefault
                        enabled={cameraMode === 'orbit'}
                        enableDamping
                        minDistance={3}
                        maxDistance={450}
                    />
                </Canvas>
            </div>

            {data ? (
                <RoverControls
                    playing={playing}
                    setPlaying={setPlaying}
                    distanceM={distance}
                    setDistanceM={setDistance}
                    totalDistanceM={
                        data.frames[data.frames.length - 1].distanceM
                    }
                    speedMps={speed}
                    setSpeedMps={setSpeed}
                    cameraMode={cameraMode}
                    setCameraMode={setCameraMode}
                    telemetry={telemetry}
                />
            ) : (
                <p>
                    {error || 'Loading Mars terrain and rover data...'}
                </p>
            )}
        </main>
    )
}

createRoot(document.getElementById('root')!).render(
    <RoverTest />
)
