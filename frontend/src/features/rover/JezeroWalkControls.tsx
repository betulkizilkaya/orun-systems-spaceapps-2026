import { useMemo } from 'react'
import type { RoverCameraMode } from './RoverCamera'
import type { RoverTelemetry } from './RoverPlayback'
import type { RoverPlaybackData } from './roverPlaybackData'
import './JezeroWalk.css'

type Props = {
  frames: RoverPlaybackData['frames']
  playing: boolean
  setPlaying: (value: boolean) => void
  distanceM: number
  setDistanceM: (value: number) => void
  totalDistanceM: number
  speedMps: number
  setSpeedMps: (value: number) => void
  cameraMode: RoverCameraMode
  setCameraMode: (value: RoverCameraMode) => void
  telemetry: RoverTelemetry | null
}

const modes = [
  ['orbit', 'Serbest'],
  ['follow', 'Takip'],
  ['pov', 'Astronot POV'],
] as const
const speeds = [2, 5, 10, 20, 50, 100, 200]
const integer = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 })
const decimal = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export function JezeroWalkControls(p: Props) {
  const profile = useMemo(() => {
    let low = Infinity
    let high = -Infinity
    for (const { elevationM } of p.frames) {
      low = Math.min(low, elevationM)
      high = Math.max(high, elevationM)
    }
    const span = Math.max(1, high - low)
    return p.frames.map(({ distanceM, elevationM }) => ({
      x: p.totalDistanceM ? distanceM / p.totalDistanceM * 100 : 0,
      y: 93 - (elevationM - low) / span * 86,
    }))
  }, [p.frames, p.totalDistanceM])
  const percent = p.totalDistanceM ? Math.max(0, Math.min(100, p.distanceM / p.totalDistanceM * 100)) : 0
  const next = profile.findIndex(({ x }) => x >= percent)
  const right = profile[next] ?? profile.at(-1)
  const left = profile[next - 1] ?? right
  const weight = left && right && right.x > left.x ? (percent - left.x) / (right.x - left.x) : 0
  const height = left && right ? left.y + (right.y - left.y) * weight : 93
  const points = profile.map(({ x, y }) => `${x},${y}`).join(' ')

  return (
    <>
      <div className="walk-profile">
        <output style={{ left: `clamp(5rem, ${percent}%, calc(100% - 5rem))` }}>
          {integer.format(p.distanceM)} m / {integer.format(p.totalDistanceM)} m
        </output>
        <div className="walk-plot">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polygon points={`0,100 ${points} 100,100`} fill="#242321" />
            <polyline points={points} fill="none" stroke="#76716b" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </svg>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"
            style={{ clipPath: `inset(0 ${100 - percent}% 0 0)` }}>
            <polygon points={`0,100 ${points} 100,100`} fill="#47321c" />
            <polyline points={points} fill="none" stroke="#f7ae4c" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="walk-playhead" style={{ left: `${percent}%`, top: `${height}%` }} aria-hidden="true" />
          <input type="range" aria-label="Rota mesafesi" min={0} max={p.totalDistanceM}
            step="any" value={p.distanceM} onChange={(e) => p.setDistanceM(e.currentTarget.valueAsNumber)} />
        </div>
      </div>

      <div className="walk-toolbar">
        <div className="walk-transport">
          <button type="button" onClick={() => p.setPlaying(!p.playing)} aria-label={p.playing ? 'Duraklat' : 'Başlat'}>
            <span aria-hidden="true">{p.playing ? '❚❚' : '▶'}</span>
          </button>
          <button type="button" aria-label="Sıfırla" onClick={() => { p.setPlaying(false); p.setDistanceM(0) }}>
            <span aria-hidden="true">⟳</span>
          </button>
          <select value={p.speedMps} aria-label="Oynatma hızı" onChange={(e) => p.setSpeedMps(Number(e.target.value))}>
            {speeds.map((speed) => <option key={speed} value={speed}>{speed / 10}×</option>)}
          </select>
        </div>
        <div className="walk-modes" role="group" aria-label="Kamera modu">
          {modes.map(([mode, label]) => (
            <button key={mode} type="button" aria-pressed={mode === p.cameraMode} onClick={() => p.setCameraMode(mode)}>
              {label}
            </button>
          ))}
        </div>
        <dl className="walk-telemetry">
          <div><dt>Kot</dt><dd>{p.telemetry ? `${integer.format(p.telemetry.elevationM)} m` : '—'}</dd></div>
          <div><dt>Eğim</dt><dd>{p.telemetry ? `${decimal.format(p.telemetry.slopeDeg)}°` : '—'}</dd></div>
          <div><dt>Yön</dt><dd>{p.telemetry ? `${String(Math.round((p.telemetry.headingDeg + 360) % 360) % 360).padStart(3, '0')}°` : '—'}</dd></div>
        </dl>
      </div>
    </>
  )
}
