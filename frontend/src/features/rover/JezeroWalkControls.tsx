import { useEffect, useMemo, useRef, useState } from 'react'
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
const speedFormat = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 })

function SpeedMenu({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  return (
    <div className="walk-speed" ref={root}>
      <span className="walk-label">Hız</span>
      <button
        type="button"
        className="walk-speed-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Oynatma hızı"
        onClick={() => setOpen((o) => !o)}
      >
        {speedFormat.format(value / 10)}× <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <ul className="walk-speed-menu" role="listbox" aria-label="Oynatma hızı">
          {speeds.map((speed) => (
            <li key={speed} role="option" aria-selected={speed === value}>
              <button type="button" onClick={() => { onChange(speed); setOpen(false) }}>
                {speedFormat.format(speed / 10)}×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

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
      y: 90 - (elevationM - low) / span * 78,
    }))
  }, [p.frames, p.totalDistanceM])

  const percent = p.totalDistanceM ? Math.max(0, Math.min(100, p.distanceM / p.totalDistanceM * 100)) : 0
  const next = profile.findIndex(({ x }) => x >= percent)
  const right = profile[next] ?? profile.at(-1)
  const left = profile[next - 1] ?? right
  const weight = left && right && right.x > left.x ? (percent - left.x) / (right.x - left.x) : 0
  const height = left && right ? left.y + (right.y - left.y) * weight : 90
  const points = profile.map(({ x, y }) => `${x},${y}`).join(' ')

  return (
    <>
      <div className="walk-main">
        <div className="walk-readout">
          <span className="walk-label">Kat edilen</span>
          <strong className="walk-distance">
            {integer.format(p.distanceM)}
            <small> / {integer.format(p.totalDistanceM)} m</small>
          </strong>
          <span className="walk-percent">%{integer.format(percent)} tamamlandı</span>
        </div>

        <div className="walk-profile">
          <div className="walk-plot">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polygon points={`0,100 ${points} 100,100`} fill="rgba(255,255,255,.05)" />
              <polyline points={points} fill="none" stroke="rgba(255,255,255,.28)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            </svg>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"
              style={{ clipPath: `inset(0 ${100 - percent}% 0 0)` }}>
              <polygon points={`0,100 ${points} 100,100`} fill="rgba(255,178,91,.22)" />
              <polyline points={points} fill="none" stroke="#ffb25b" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="walk-playhead" style={{ left: `${percent}%`, top: `${height}%` }} aria-hidden="true" />
            <input type="range" aria-label="Rota mesafesi" min={0} max={p.totalDistanceM}
              step="any" value={p.distanceM} onChange={(e) => p.setDistanceM(e.currentTarget.valueAsNumber)} />
          </div>
          <div className="walk-axis" aria-hidden="true">
            <span>A</span>
            <span>Yükseklik profili</span>
            <span>B</span>
          </div>
        </div>
      </div>

      <div className="walk-toolbar">
        <div className="walk-transport">
          <button type="button" className="walk-play" onClick={() => p.setPlaying(!p.playing)}
            aria-label={p.playing ? 'Duraklat' : 'Başlat'}>
            <span aria-hidden="true">{p.playing ? '❚❚' : '▶'}</span>
          </button>
          <button type="button" className="walk-reset" aria-label="Sıfırla"
            onClick={() => { p.setPlaying(false); p.setDistanceM(0) }}>
            <span aria-hidden="true">⟳</span>
          </button>
          <SpeedMenu value={p.speedMps} onChange={p.setSpeedMps} />
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