import { useMemo, useState } from 'react'
import './RouteProfile.css'

type Point = [number, number, number]
type Sample = { point: Point; distance: number; slope: number; row: number; col: number }

const format = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 })

export function RouteProfile({
  points, width, depth, distanceMeters, verified, onHighlight, grid, gridError,
}: {
  grid: number[][] | null
  gridError: boolean
  points: Point[]
  width: number
  depth: number
  distanceMeters: number
  verified: boolean
  onHighlight: (point: Point | null) => void
}) {
  const [selected, setSelected] = useState<number | null>(null)

  const samples = useMemo(() => {
    if (!grid) return null
    const index = (fraction: number) => Math.max(0, Math.min(99, Math.floor(fraction * 100)))
    const lengths = [0]
    for (let i = 1; i < points.length; i++) {
      lengths.push(lengths[i - 1] + Math.hypot(
        points[i][0] - points[i - 1][0],
        points[i][2] - points[i - 1][2],
      ))
    }

    // Multi-cell routes include the first and last cell centers.
    const indices = points.length > 2
      ? points.slice(1, -1).map((_, i) => i + 1)
      : [0]

    return indices.map((i): Sample => {
      const point = points[i]
      const col = index(point[0] / width + 0.5)
      const row = index(point[2] / depth + 0.5)
      const total = lengths[lengths.length - 1]
      return {
        point, row, col, slope: grid[row][col],
        distance: total > 0 ? lengths[i] / total * distanceMeters : 0,
      }
    })
  }, [grid, points, width, depth, distanceMeters])

  if (gridError || samples?.some(({ slope }) => !Number.isFinite(slope))) {
    return <p role="status">Rota eğim profili yüklenemedi.</p>
  }
  if (!samples?.length) return <p role="status">Eğim profili yükleniyor…</p>

  const peak = samples.reduce((best, sample, i) =>
    sample.slope > samples[best].slope ? i : best, 0)
  const current = samples[selected ?? peak]
  const ceiling = Math.max(10, Math.ceil(samples[peak].slope / 10) * 10)
  const x = (sample: Sample) => 36 + 264 * sample.distance / (distanceMeters || 1)
  const y = (sample: Sample) => 124 - 104 * sample.slope / ceiling

  function activate(i: number) {
    setSelected(i)
    onHighlight(samples?.[i]?.point ?? null)
  }

  return (
    <section aria-label="Rota eğim profili">
      <h3>Rota eğim profili</h3>
      {verified && <p className="route-verified">Dijkstra ile doğrulandı · {samples.length} hücre</p>}
      <svg className="route-chart" viewBox="0 0 320 150" aria-hidden="true"
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          const position = (event.clientX - rect.left) / rect.width * 320
          const nearest = samples.reduce((best, sample, i) =>
            Math.abs(x(sample) - position) < Math.abs(x(samples[best]) - position) ? i : best, 0)
          activate(nearest)
        }}>
        <path d="M36 20H300 M36 72H300 M36 124H300" className="route-chart-grid" />
        <text x="0" y="24">{ceiling}°</text>
        <text x="0" y="76">{ceiling / 2}°</text>
        <text x="0" y="128">0°</text>
        <polyline className="route-chart-line" points={samples.map((s) => `${x(s)},${y(s)}`).join(' ')} />
        <line className="route-chart-grid" x1={x(current)} x2={x(current)} y1="20" y2="124" />
        <circle cx={x(current)} cy={y(current)} r="4" fill="#78eadc" />
        <text x="36" y="145">0 m</text>
        <text x="300" y="145" textAnchor="end">{format.format(distanceMeters)} m</text>
      </svg>
      <label className="route-profile-slider">
        Rota hücresi
        <input type="range" min="0" max={samples.length - 1} value={selected ?? peak}
          disabled={samples.length === 1}
          onChange={(event) => activate(Number(event.target.value))} />
      </label>
      <p>{format.format(current.distance)} m · {format.format(current.slope)}° hücre maksimumu</p>
      <button type="button" onClick={() => activate(peak)}>En dik hücreyi göster</button>
    </section>
  )
}
