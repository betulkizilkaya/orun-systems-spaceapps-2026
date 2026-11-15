import { useEffect, useState } from 'react'
import './SlopeAnalysisPanel.css'
import {
  COMFORTABLE_MAX_DEG,
  RECOMMENDED_MAX_DEG,
  DANGEROUS_MIN_DEG,
  classifySlope,
  type DifficultyLevel,
} from './routeDifficulty'

// Same thresholds and colors as the route warnings.
const legend: { level: DifficultyLevel; range: string; label: string }[] = [
  { level: 'easy', range: `≤ ${COMFORTABLE_MAX_DEG}°`, label: 'Walkable' },
  { level: 'hard', range: `${COMFORTABLE_MAX_DEG}–${RECOMMENDED_MAX_DEG}°`, label: 'Challenging' },
  { level: 'discouraged', range: `${RECOMMENDED_MAX_DEG}–${DANGEROUS_MIN_DEG}°`, label: 'Not recommended' },
  { level: 'dangerous', range: `> ${DANGEROUS_MIN_DEG}°`, label: 'Dangerous' },
]

// Finds the level from the lower bound of the range: "20-30" → 20 → the first band above 20° counts as "not recommended".
function binLevel(range: string): DifficultyLevel {
  const lower = parseFloat(range)
  return classifySlope(Number.isFinite(lower) ? lower + 0.01 : 0)
}

const metrics = [
  ['mean', 'Mean'],
  ['median', 'Median'],
  ['p95', 'P95'],
  ['max', 'Maximum'],
] as const

type SlopeAnalysis = {
  statistics: Record<(typeof metrics)[number][0], number>
  distribution: { range: string; pixels: number; percentage: number }[]
}

const decimal = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const integer = new Intl.NumberFormat('en-US')
const dataUrl = `${import.meta.env.BASE_URL}data/jezero_4camera_slope_analysis.json`

function isSlopeAnalysis(value: unknown): value is SlopeAnalysis {
  if (!value || typeof value !== 'object') return false
  const { statistics, distribution } = value as Partial<SlopeAnalysis>
  return Boolean(
    statistics &&
      metrics.every(([key]) => Number.isFinite(statistics[key])) &&
      Array.isArray(distribution) &&
      distribution.length > 0 &&
      distribution.every(
        (bin) =>
          bin &&
          typeof bin.range === 'string' &&
          Number.isInteger(bin.pixels) &&
          bin.pixels >= 0 &&
          Number.isFinite(bin.percentage) &&
          bin.percentage >= 0 &&
          bin.percentage <= 100,
      ),
  )
}

export function SlopeAnalysisPanel({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<SlopeAnalysis | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const response = await fetch(dataUrl, { signal: controller.signal })
        if (!response.ok) throw new Error('Could not fetch the slope analysis file.')

        const result: unknown = await response.json()
        if (!isSlopeAnalysis(result)) throw new Error('Invalid slope analysis.')
        if (!controller.signal.aborted) setData(result)
      } catch {
        if (!controller.signal.aborted) setFailed(true)
      }
    }

    void load()
    return () => controller.abort()
  }, [])

  const pixels = data?.distribution.reduce((total, bin) => total + bin.pixels, 0)

  // Share of the terrain in each walking-difficulty band, summed from the distribution bins.
  const zones = data
    ? legend.map((item) => ({
        ...item,
        percentage: data.distribution
          .filter((bin) => binLevel(bin.range) === item.level)
          .reduce((total, bin) => total + bin.percentage, 0),
      }))
    : []

  return (
    <aside className="slope-panel" aria-labelledby="slope-panel-title">
      <header className="slope-head">
        <div>
          <p className="slope-eyebrow">TERRAIN ANALYSIS</p>
          <h2 id="slope-panel-title">Slope analysis</h2>
          {pixels !== undefined && (
            <p className="slope-meta">Jezero · 1 km² · {integer.format(pixels)} pixels</p>
          )}
        </div>
        <button type="button" className="slope-close" onClick={onClose} aria-label="Close slope analysis">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      {failed && <p className="slope-status" role="alert">Could not load the slope analysis. Check the data file.</p>}
      {!failed && !data && <p className="slope-status" role="status">Loading slope analysis…</p>}

      {data && (
        <>
          <dl className="slope-stats">
            {metrics.map(([key, label]) => (
              <div key={key} data-level={classifySlope(data.statistics[key])}>
                <dt>{label}</dt>
                <dd>
                  {decimal.format(data.statistics[key])}
                  <small>°</small>
                </dd>
              </div>
            ))}
          </dl>
          <p className="slope-lede">
            About 95% of pixels have a slope of <b>{decimal.format(data.statistics.p95)}°</b> or lower.
          </p>

          <h3 className="slope-section">Walking difficulty</h3>
          <div className="slope-zones" role="img"
               aria-label={zones.map((zone) => `${zone.label} ${decimal.format(zone.percentage)}%`).join(', ')}>
            {zones.map((zone) => (
              <span key={zone.level} data-level={zone.level} style={{ flexBasis: `${zone.percentage}%` }} />
            ))}
          </div>
          <ul className="slope-legend" aria-label="Walking difficulty thresholds">
            {zones.map((zone) => (
              <li key={zone.level} data-level={zone.level}>
                <i aria-hidden="true" />
                <span>
                  <b>{zone.label}</b>
                  <small>{zone.range}</small>
                </span>
                <strong>{decimal.format(zone.percentage)}%</strong>
              </li>
            ))}
          </ul>

          <h3 className="slope-section">Pixel slope distribution</h3>
          <ul className="slope-distribution">
            {data.distribution.map((bin) => (
              <li key={bin.range}>
                <span>{bin.range.replace('-', '–')}°</span>
                <span className="slope-track" aria-hidden="true">
                  <span data-level={binLevel(bin.range)} style={{ width: `${bin.percentage}%` }} />
                </span>
                <span>{decimal.format(bin.percentage)}%</span>
              </li>
            ))}
          </ul>

          <p className="slope-note">
            Thresholds are approximate; they are used in route warnings for a person walking in a spacesuit.
            Slope ranges describe the parcel. Rover safety limits must be verified separately.
          </p>
        </>
      )}
    </aside>
  )
}
