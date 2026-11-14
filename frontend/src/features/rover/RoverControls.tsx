import type { RoverCameraMode } from './RoverCamera'
import type { RoverTelemetry } from './RoverPlayback'
import './RoverControls.css'

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

const speeds = [2, 5, 10, 20, 50, 100, 200]
const cameras: { mode: RoverCameraMode; label: string }[] = [
  { mode: 'orbit', label: 'Serbest' },
  { mode: 'follow', label: 'Takip' },
  { mode: 'pov', label: 'Astronot POV' },
]
const format = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 })

export function RoverControls({
  playing, setPlaying, distanceM, setDistanceM, totalDistanceM,
  speedMps, setSpeedMps, cameraMode, setCameraMode, telemetry,
}: Props) {
  const progress = totalDistanceM > 0 ? distanceM / totalDistanceM * 100 : 0

  return (
    <section className="rover-controls" aria-label="Astronot simülasyonu">
      <h2>Astronot simülasyonu</h2>
      <p>Haritadaki altın çizgi, simülasyonun kayıtlı Jezero rotasını gösterir.</p>
      <div className="rover-actions">
        <button type="button" onClick={() => setPlaying(!playing)}>
          {playing ? 'Duraklat' : 'Başlat'}
        </button>
        <button type="button" onClick={() => {
          setPlaying(false)
          setDistanceM(0)
        }}>
          Sıfırla
        </button>
      </div>
      <div className="rover-actions" role="group" aria-label="Kamera">
        {cameras.map(({ mode, label }) => (
          <button type="button" key={mode} aria-pressed={cameraMode === mode}
            onClick={() => setCameraMode(mode)}>
            {label}
          </button>
        ))}
      </div>
      <label className="rover-progress">
        <span>Rota ilerlemesi · %{format.format(progress)}</span>
        <input type="range" min={0} max={totalDistanceM} step="any" value={distanceM}
          onChange={(event) => setDistanceM(Number(event.target.value))} />
      </label>
      <label className="rover-speed">
        <span>Oynatma hızı</span>
        <select value={speedMps} onChange={(event) => setSpeedMps(Number(event.target.value))}>
          {speeds.map((speed) => <option key={speed} value={speed}>{speed} m/sn</option>)}
        </select>
      </label>
      {telemetry && (
        <dl className="rover-telemetry">
          <div><dt>Mesafe</dt><dd>{format.format(telemetry.distanceM)} m</dd></div>
          <div><dt>Kot</dt><dd>{format.format(telemetry.elevationM)} m</dd></div>
          <div><dt>Eğim</dt><dd>{format.format(telemetry.slopeDeg)}°</dd></div>
          <div><dt>Yön</dt><dd>{format.format(telemetry.headingDeg)}°</dd></div>
        </dl>
      )}
    </section>
  )
}
