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

const metric = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })
const coordinate = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

export function TerrainInspectionPanel({ inspection, onClose }: Props) {
    return (
        <section className="terrain-inspection" aria-label="Terrain inspection results">
            <header className="terrain-inspection__header">
                <div>
                    <span className="terrain-inspection__eyebrow">SURFACE / 01</span>
                    <h2>Terrain inspection</h2>
                </div>
                <button type="button" onClick={onClose} aria-label="Close terrain inspection">✕</button>
            </header>
            <div className="terrain-inspection__metrics">
                <div><span>DEM ELEVATION</span><strong>{metric.format(inspection.elevationM)} <small>m</small></strong></div>
                <div><span>SURFACE SLOPE</span><strong>{metric.format(inspection.slopeDeg)}<small>°</small></strong></div>
            </div>
            <dl className="terrain-inspection__coordinates">
                <div><dt>East (X)</dt><dd>{coordinate.format(inspection.easting)}</dd></div>
                <div><dt>North (Y)</dt><dd>{coordinate.format(inspection.northing)}</dd></div>
            </dl>
            <p className="terrain-inspection__note">Elevation and slope are read from the GeoTIFF raster cell at the selected location. Coordinates are in the raster's projection.</p>
        </section>
    )
}