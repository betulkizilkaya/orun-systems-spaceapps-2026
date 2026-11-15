export type TerrainInspection = {
    easting: number
    northing: number
    elevationM: number
    slopeDeg: number
}

type Props = {
    inspection: TerrainInspection
    onClose: () => void
}

const metric = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 })
const coordinate = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 })

export function TerrainInspectionPanel({ inspection, onClose }: Props) {
    return (
        <section className="terrain-inspection" aria-label="Arazi inceleme sonuçları">
            <header className="terrain-inspection__header">
                <div>
                    <span className="terrain-inspection__eyebrow">SURFACE / 01</span>
                    <h2>Arazi inceleme</h2>
                </div>
                <button type="button" onClick={onClose} aria-label="Arazi incelemesini kapat">✕</button>
            </header>
            <div className="terrain-inspection__metrics">
                <div><span>DEM KOTU</span><strong>{metric.format(inspection.elevationM)} <small>m</small></strong></div>
                <div><span>YÜZEY EĞİMİ</span><strong>{metric.format(inspection.slopeDeg)}<small>°</small></strong></div>
            </div>
            <dl className="terrain-inspection__coordinates">
                <div><dt>Doğu (X)</dt><dd>{coordinate.format(inspection.easting)}</dd></div>
                <div><dt>Kuzey (Y)</dt><dd>{coordinate.format(inspection.northing)}</dd></div>
            </dl>
            <p className="terrain-inspection__note">Kot ve eğim, seçilen konumdaki GeoTIFF raster hücresinden okunur. Koordinatlar rasterın projeksiyonundadır.</p>
        </section>
    )
}