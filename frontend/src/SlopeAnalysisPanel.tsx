import { useEffect, useState } from 'react'
import './SlopeAnalysisPanel.css'
import {
  COMFORTABLE_MAX_DEG,
  RECOMMENDED_MAX_DEG,
  DANGEROUS_MIN_DEG,
  classifySlope,
  type DifficultyLevel,
} from './routeDifficulty'

// Rota uyarısıyla aynı eşikler ve renkler.
const legend: { level: DifficultyLevel; range: string; label: string }[] = [
  { level: 'easy', range: `≤ ${COMFORTABLE_MAX_DEG}°`, label: 'Yürünebilir' },
  { level: 'hard', range: `${COMFORTABLE_MAX_DEG}–${RECOMMENDED_MAX_DEG}°`, label: 'Zorlu' },
  { level: 'discouraged', range: `${RECOMMENDED_MAX_DEG}–${DANGEROUS_MIN_DEG}°`, label: 'Önerilmez' },
  { level: 'dangerous', range: `> ${DANGEROUS_MIN_DEG}°`, label: 'Tehlikeli' },
]

// Aralığın alt sınırından seviyeyi bulur: "20-25" → 20 → 20°'yi aşan ilk dilim önerilmez sayılır.
function binLevel(range: string): DifficultyLevel {
  const lower = parseFloat(range)
  return classifySlope(Number.isFinite(lower) ? lower + 0.01 : 0)
}

const metrics = [
  ['mean', 'Ortalama'],
  ['median', 'Medyan'],
  ['p95', 'P95'],
  ['max', 'Maksimum'],
] as const

type SlopeAnalysis = {
  statistics: Record<(typeof metrics)[number][0], number>
  distribution: { range: string; pixels: number; percentage: number }[]
}

const decimal = new Intl.NumberFormat('tr-TR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const integer = new Intl.NumberFormat('tr-TR')
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
        if (!response.ok) throw new Error('Eğim analizi dosyası alınamadı.')

        const result: unknown = await response.json()
        if (!isSlopeAnalysis(result)) throw new Error('Geçersiz eğim analizi.')
        if (!controller.signal.aborted) setData(result)
      } catch {
        if (!controller.signal.aborted) setFailed(true)
      }
    }

    void load()
    return () => controller.abort()
  }, [])

  const pixels = data?.distribution.reduce((total, bin) => total + bin.pixels, 0)

  return (
    <aside className="slope-panel" aria-labelledby="slope-panel-title">
      <header className="slope-panel-header">
        <div>
          <h2 id="slope-panel-title">Eğim analizi</h2>
          {pixels !== undefined && <p>Jezero · 1 km² · {integer.format(pixels)} piksel</p>}
        </div>
        <button type="button" onClick={onClose}>Kapat</button>
      </header>

      {failed && <p role="alert">Eğim analizi yüklenemedi. Veri dosyasını kontrol et.</p>}
      {!failed && !data && <p role="status">Eğim analizi yükleniyor…</p>}

      {data && (
        <>
          <dl className="slope-metrics">
            {metrics.map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>{decimal.format(data.statistics[key])}°</dd>
              </div>
            ))}
          </dl>
          <p>Piksellerin yaklaşık %95’i {decimal.format(data.statistics.p95)}° veya daha düşük eğime sahip.</p>

          <h3>Piksellerin eğim dağılımı</h3>
          <ul className="slope-distribution">
            {data.distribution.map((bin) => (
              <li key={bin.range}>
                <span>{bin.range.replace('-', '–')}°</span>
                <span className="slope-track" aria-hidden="true">
                  <span data-level={binLevel(bin.range)} style={{ width: `${bin.percentage}%` }} />
                </span>
                <span>%{decimal.format(bin.percentage)}</span>
              </li>
            ))}
          </ul>
          <ul className="slope-legend" aria-label="Yürüyüş zorluğu eşikleri">
            {legend.map((item) => (
              <li key={item.level} data-level={item.level}>
                <i aria-hidden="true" />
                <b>{item.range}</b> {item.label}
              </li>
            ))}
          </ul>
          <p>Eşikler yaklaşık değerlerdir; uzay giysili insan yürüyüşü için rota uyarılarında kullanılır.</p>
          <p>Eğim aralıkları parseli betimler. Rover güvenlik sınırları ayrıca doğrulanmalıdır.</p>
        </>
      )}
    </aside>
  )
}
