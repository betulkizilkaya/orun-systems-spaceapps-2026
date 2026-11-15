import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const frontend = existsSync('frontend/src/App.tsx') ? 'frontend' : '.'
const appPath = join(frontend, 'src/App.tsx')
const cssPath = join(frontend, 'src/features/mission/JezeroRoutePanel.css')

const original = readFileSync(appPath, 'utf8')
let app = original.replaceAll('\r\n', '\n')

const cssImport = "import './features/mission/JezeroRoutePanel.css'"

if (app.includes(cssImport)) {
    console.log('Yuvarlak rota paneli zaten ekli.')
    process.exit(0)
}

const start = app.indexOf('<aside className="mission-console"')
const end = app.indexOf('</aside>', start)
const importAnchor = "import './features/mission/JezeroConsole.css'"

if (start === -1 || end === -1 || !app.includes(importAnchor)) {
    throw new Error('Sol panel veya CSS importu bulunamadı. App.tsx değişmedi.')
}

let panel = app.slice(start, end)

const oldActions = panel.match(
    /<header>[\s\S]*?<div className="mission-route-actions">[\s\S]*?<\/div>/,
)
const oldCompareButton = panel.match(
    /<button type="button" aria-pressed=\{compare\}[\s\S]*?<\/button>/,
)
const comparisonStart = /\{route && \(\s*<section className="route-comparison"/

if (!oldActions || !oldCompareButton || !comparisonStart.test(panel)) {
    throw new Error('Sol panelin mevcut yapısı farklı. App.tsx değişmedi.')
}

const newActions = `<header className="route-panel-header">
                            <h2>Rota planlama</h2>
                            <button
                                type="button"
                                className="route-panel-reset"
                                aria-label="Rotayı sıfırla"
                                title="Rotayı sıfırla"
                                onClick={resetPoints}
                                disabled={loadingExample || (!start && !end && selecting === null)}
                            >
                                <span aria-hidden="true">↶</span>
                            </button>
                        </header>

                        <div className="route-panel-track" aria-hidden="true">
                            <span>A</span>
                            <svg viewBox="0 0 300 46" preserveAspectRatio="none" focusable="false">
                                <path
                                    d="M 0 25 C 49 34 74 4 124 9 S 195 49 246 36 S 283 24 300 25"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    vectorEffect="non-scaling-stroke"
                                />
                            </svg>
                            <span>B</span>
                        </div>

                        <div className="route-panel-endpoints">
                            <button
                                type="button"
                                aria-pressed={selecting === 'start'}
                                disabled={!terrain || loadingExample}
                                onClick={() => setSelecting('start')}
                            >
                                {start ? 'Başlangıcı değiştir' : 'Başlangıç seç'}
                            </button>
                            <button
                                type="button"
                                aria-pressed={selecting === 'end'}
                                disabled={!terrain || loadingExample}
                                onClick={() => setSelecting('end')}
                            >
                                {end ? 'Bitişi değiştir' : 'Bitiş seç'}
                            </button>
                        </div>

                        {exampleStatus && <p role="alert">{exampleStatus}</p>}
                        {example && !verified && (
                            <p role="status">Hesaplanan rota doğrulama kaydıyla eşleşmedi.</p>
                        )}`

const footer = `<div className="route-panel-footer">
                            <button
                                type="button"
                                className="mission-example"
                                onClick={() => void openExample()}
                                disabled={!terrain || loadingExample}
                            >
                                {loadingExample ? 'Örnek yükleniyor…' : 'Örnek rotayı aç'}
                                <span aria-hidden="true">→</span>
                            </button>
                            {route && (
                                <button
                                    type="button"
                                    className="route-panel-compare"
                                    aria-expanded={compare}
                                    onClick={() => setCompare((visible) => !visible)}
                                >
                                    {compare ? 'Karşılaştırmayı kapat' : 'Karşılaştır'}
                                </button>
                            )}
                        </div>`

panel = panel
    .replace('className="mission-console"', 'className="mission-console route-panel-rounded"')
    .replace(oldActions[0], () => newActions)
    .replace(oldCompareButton[0], '')
    .replace(
        comparisonStart,
        (match) => footer + '\n\n                        ' +
            match.replace('{route &&', '{route && compare &&'),
    )

app = app.slice(0, start) + panel + app.slice(end)
app = app.replace(importAnchor, importAnchor + '\n' + cssImport)

const css = `
.map-page.jezero-console-page:not(.walk-open) .route-panel-rounded {
  --panel-cyan: #9cd9d7;
  --panel-peach: #ffc4ab;
  --panel-rule: #f5f1eb29;
  --route-panel-top: clamp(235px, 34vh, 365px);
  box-sizing: border-box;
  width: clamp(320px, 34vw, 565px);
  max-width: calc(100% - 2 * var(--jezero-gutter));
  margin-block-start: var(--route-panel-top);
  max-height: calc(100svh - var(--route-panel-top) - 22px);
  padding: clamp(17px, 2vw, 32px);
  gap: 0;
  color: #f5f1eb;
  border: 1px solid #f5f1eb2e;
  border-radius: clamp(30px, 4vw, 60px);
  background: radial-gradient(ellipse at 10% 0%, #343638, transparent 70%), #19191a;
  box-shadow: inset 0 1px 0 #ffffff12;
  scrollbar-width: thin;
}

.route-panel-rounded > * {
  flex-shrink: 0;
}

.jezero-console-page .route-panel-rounded .route-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 0;
  border: 0;
}

.jezero-console-page .route-panel-rounded .route-panel-header h2 {
  margin: 0;
  color: inherit;
  font: 500 clamp(1.2rem, 2vw, 2rem)/1.1 "Instrument Sans", "Segoe UI", sans-serif;
  letter-spacing: -.025em;
}

.jezero-console-page .route-panel-rounded .route-panel-reset {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  padding: 0;
  font: 400 1.45rem/1 system-ui, sans-serif;
  border-color: #ffffff20;
  background: #ffffff12;
}

.route-panel-rounded .route-panel-track {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  margin: clamp(13px, 2vh, 26px) 6px 10px;
  color: var(--panel-cyan);
}

.route-panel-track svg {
  display: block;
  width: 100%;
  height: 38px;
  overflow: visible;
}

.route-panel-track span {
  display: grid;
  place-items: center;
  width: 38px;
  aspect-ratio: 1;
  border: 2px solid currentColor;
  border-radius: 50%;
  background: #20292a;
  font: 500 1rem/1 "IBM Plex Mono", monospace;
}

.route-panel-track span:last-child {
  color: var(--panel-peach);
  background: #332923;
}

.route-panel-endpoints,
.route-panel-footer {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
  gap: clamp(8px, 1.4vw, 20px);
}

.jezero-console-page .route-panel-rounded .route-panel-endpoints button {
  min-height: 42px;
  padding: 6px 10px;
  border-color: #ffffff24;
  border-radius: 999px;
  background: #ffffff12;
  font-weight: 500;
}

.jezero-console-page .route-panel-rounded .route-panel-endpoints button[aria-pressed="true"] {
  border-color: var(--panel-cyan);
  color: var(--panel-cyan);
}

.map-page.jezero-console-page .route-panel-rounded .mission-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
  margin: 0 0 15px;
  padding: 14px 0;
  border: 0;
  border-top: 1px solid var(--panel-rule);
  background: transparent;
}

.map-page.jezero-console-page .route-panel-rounded .mission-metrics > div {
  display: flex;
  flex-direction: column-reverse;
  gap: 4px;
  padding: 0 8px;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.map-page.jezero-console-page .route-panel-rounded .mission-metrics > div + div {
  border-inline-start: 1px solid var(--panel-rule);
  padding-inline-start: clamp(10px, 1.5vw, 20px);
}

.map-page.jezero-console-page .route-panel-rounded .mission-metrics dd {
  margin: 0;
  color: #f5f1eb;
  font: 500 clamp(1.55rem, 3vw, 2.85rem)/1.1 "IBM Plex Mono", Consolas, monospace;
  white-space: nowrap;
}

.route-panel-rounded .mission-metrics dd small {
  color: inherit;
  font-size: .7em;
}

.route-panel-rounded .mission-status {
  margin: 9px 0;
  font-size: .8rem;
}

.jezero-console-page .route-panel-rounded .route-panel-footer .mission-example {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  min-height: 44px;
  gap: 8px;
  border: 1px solid #d9f6f44f;
  background: linear-gradient(#a7d8d5, #82b5b1);
  color: #101b1b;
}

.jezero-console-page .route-panel-rounded .route-panel-compare {
  padding-inline: 4px;
  border-color: transparent;
  background: transparent;
  color: #e2ddda;
}

.jezero-console-page .route-panel-rounded .route-comparison {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--panel-rule);
  overflow-x: auto;
}

@media (max-width: 760px) {
  .map-page.jezero-console-page:not(.walk-open) .route-panel-rounded {
    width: auto;
    max-width: none;
    max-height: none;
    margin: 14px var(--jezero-gutter);
  }
}
`

writeFileSync(cssPath, css.trimStart())
writeFileSync(appPath, original.includes('\r\n') ? app.replaceAll('\n', '\r\n') : app)

console.log('Yuvarlak Jezero rota paneli eklendi.')