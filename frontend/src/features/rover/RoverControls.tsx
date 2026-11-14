
import type { RoverCameraMode } from './RoverCamera'
import type { RoverTelemetry } from './RoverPlayback'

type Props = {
    playing: boolean
    setPlaying: (value: boolean) => void

    distanceM: number
    setDistanceM: (value: number) => void
    totalDistanceM: number

    speedMps: number
    setSpeedMps: (value: number) => void

    cameraMode: RoverCameraMode
    setCameraMode: (mode: RoverCameraMode) => void

    telemetry: RoverTelemetry | null
}

const speedOptions = [2, 5, 10, 20, 50, 100, 200]

const cameraModes: {
    mode: RoverCameraMode
    label: string
}[] = [
    { mode: 'orbit', label: 'Serbest' },
    { mode: 'follow', label: 'Takip' },
    { mode: 'pov', label: 'Rover POV' },
]

export function RoverControls(p: Props) {
    const progress =
        p.totalDistanceM > 0
            ? (p.distanceM / p.totalDistanceM) * 100
            : 0

    return (
        <section
            aria-label="Rover simülasyonu"
            style={{
                padding: 12,
                display: 'grid',
                gap: 14,
            }}
        >
            <strong>
                ROVER SIMULATION · DEM-based playback
            </strong>

            {/* Oynatma kontrolleri */}
            <div
                style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                }}
            >
                <button
                    type="button"
                    onClick={() => p.setPlaying(!p.playing)}
                >
                    {p.playing ? 'Duraklat' : 'Başlat'}
                </button>

                <button
                    type="button"
                    onClick={() => {
                        p.setPlaying(false)
                        p.setDistanceM(0)
                    }}
                >
                    Sıfırla
                </button>
            </div>

            {/* Kamera modları */}
            <div
                style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                }}
            >
                {cameraModes.map(({ mode, label }) => (
                    <button
                        key={mode}
                        type="button"
                        aria-pressed={p.cameraMode === mode}
                        onClick={() => p.setCameraMode(mode)}
                        style={{
                            border:
                                p.cameraMode === mode
                                    ? '1px solid #75e7c8'
                                    : '1px solid #425364',
                            background:
                                p.cameraMode === mode
                                    ? '#17433e'
                                    : '#182331',
                            color: '#ffffff',
                            borderRadius: 6,
                            padding: '8px 12px',
                            cursor: 'pointer',
                        }}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Rota ilerlemesi */}
            <label
                style={{
                    display: 'grid',
                    gap: 6,
                }}
            >
        <span>
          Rota ilerlemesi: {progress.toFixed(1)}%
        </span>

                <input
                    type="range"
                    min={0}
                    max={p.totalDistanceM}
                    step={0.1}
                    value={Math.min(
                        Math.max(p.distanceM, 0),
                        p.totalDistanceM
                    )}
                    onChange={(event) => {
                        p.setDistanceM(Number(event.target.value))
                    }}
                    style={{ width: '100%' }}
                />
            </label>

            {/* Simülasyon hızı */}
            <label
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                }}
            >
                <span>Simülasyon hızı</span>

                <select
                    value={p.speedMps}
                    onChange={(event) => {
                        p.setSpeedMps(Number(event.target.value))
                    }}
                    style={{
                        background: '#182331',
                        color: '#ffffff',
                        border: '1px solid #425364',
                        borderRadius: 6,
                        padding: '8px 12px',
                        cursor: 'pointer',
                    }}
                >
                    {speedOptions.map((speed) => (
                        <option key={speed} value={speed}>
                            {speed} m/sn
                        </option>
                    ))}
                </select>
            </label>

            {/* Canlı telemetri */}
            {p.telemetry && (
                <div
                    style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 16,
                        padding: 12,
                        border: '1px solid #304454',
                        borderRadius: 8,
                        background: '#101c28',
                    }}
                >
          <span>
            Mesafe: {p.telemetry.distanceM.toFixed(1)} m
          </span>

                    <span>
            Yükseklik: {p.telemetry.elevationM.toFixed(1)} m
          </span>

                    <span>
            Eğim: {p.telemetry.slopeDeg.toFixed(1)}°
          </span>

                    <span>
            İlerleme: {(p.telemetry.progress * 100).toFixed(1)}%
          </span>
                </div>
            )}

            <small style={{ color: '#9aaebf' }}>
                Görsel rota simülasyonudur. Gerçek rover telemetrisi
                veya sürüş güvenliği doğrulaması değildir.
                Hız değerleri simülasyon oynatma hızını temsil eder.
            </small>
        </section>
    )
}
