"""Generate scientifically grounded rover route playback from Jezero route + DEM/slope.

Usage:
 python analysis/generate_rover_playback.py --route frontend/public/data/jezero-test-rotasi.json --dem frontend/public/data/jezero-demo-dem.tif --slope frontend/public/data/jezero-demo-slope.tif --output frontend/public/data/jezero-rover-playback.json

Requires: pip install rasterio numpy
"""
import argparse
import json
import math
from pathlib import Path

import numpy as np
import rasterio


def sample_bilinear(ds, x, y):
    """Sample raster with bilinear interpolation at projected world coordinates.

    Returns None if any contributing pixel is invalid/outside the raster.
    """
    inv = ~ds.transform
    col, row = inv * (x, y)
    col -= 0.5
    row -= 0.5
    c0, r0 = math.floor(col), math.floor(row)
    dc, dr = col - c0, row - r0
    if c0 < 0 or r0 < 0 or c0 + 1 >= ds.width or r0 + 1 >= ds.height:
        # Nearest pixel fallback at edge only
        rr, cc = ds.index(x, y)
        if not (0 <= rr < ds.height and 0 <= cc < ds.width):
            return None
        value = next(ds.sample([(x, y)], masked=True))[0]
        return float(value) if np.isfinite(value) and not np.ma.is_masked(value) and value != ds.nodata else None
    block = ds.read(1, window=((r0, r0 + 2), (c0, c0 + 2)), masked=True)
    if np.ma.getmaskarray(block).any() or not np.isfinite(np.asarray(block)).all():
        return None
    vals = np.asarray(block, dtype=float)
    return float((1-dr)*((1-dc)*vals[0,0]+dc*vals[0,1]) + dr*((1-dc)*vals[1,0]+dc*vals[1,1]))


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--route', type=Path, required=True)
    ap.add_argument('--dem', type=Path, required=True)
    ap.add_argument('--slope', type=Path, required=True)
    ap.add_argument('--output', type=Path, required=True)
    ap.add_argument('--spacing', type=float, default=2.0, help='Output point spacing in metres')
    args = ap.parse_args()
    if args.spacing <= 0:
        ap.error('--spacing must be positive')
    for path in (args.route, args.dem, args.slope):
        if not path.is_file():
            ap.error(f'Missing input: {path}')
    route = json.loads(args.route.read_text(encoding='utf-8'))
    points = route.get('points', [])
    if len(points) < 2:
        ap.error('Route needs at least two points')
    xy = [(float(p['projectedX']), float(p['projectedY'])) for p in points]
    cumulative = [0.0]
    for a, b in zip(xy, xy[1:]):
        d = math.hypot(b[0]-a[0], b[1]-a[1])
        if d <= 0:
            ap.error('Consecutive duplicate route points found')
        cumulative.append(cumulative[-1] + d)
    length = cumulative[-1]
    n = math.ceil(length / args.spacing)
    distances = np.linspace(0, length, n+1)
    positions = []
    segment = 0
    for dist in distances:
        while segment < len(xy)-2 and dist > cumulative[segment+1]:
            segment += 1
        frac = min(1.0, max(0.0, (dist-cumulative[segment])/(cumulative[segment+1]-cumulative[segment])))
        a, b = xy[segment], xy[segment+1]
        x, y = a[0]+frac*(b[0]-a[0]), a[1]+frac*(b[1]-a[1])
        # Heading convention: clockwise degrees from projected north (+Y).
        heading = (math.degrees(math.atan2(b[0]-a[0], b[1]-a[1]))+360) % 360
        positions.append((x,y,heading))

    with rasterio.open(args.dem) as dem, rasterio.open(args.slope) as slope:
        if dem.crs != slope.crs or dem.transform != slope.transform or dem.width != slope.width or dem.height != slope.height:
            ap.error('DEM and slope raster grids/CRS are not aligned')
        expected_bounds = route.get('demBounds')
        if expected_bounds:
            actual = dict(west=dem.bounds.left, south=dem.bounds.bottom, east=dem.bounds.right, north=dem.bounds.top)
            if any(abs(float(expected_bounds[k])-actual[k]) > 0.01 for k in actual):
                ap.error('DEM bounds differ from route metadata')
        frames = []
        for i, (dist, (x,y,heading)) in enumerate(zip(distances, positions)):
            elev = sample_bilinear(dem,x,y)
            sl = sample_bilinear(slope,x,y)
            if elev is None or sl is None:
                ap.error(f'Invalid DEM/slope at frame {i}: ({x}, {y})')
            frames.append({
                'index': i,
                'projectedX': round(x, 4),
                'projectedY': round(y, 4),
                'localX': round(x-dem.bounds.left, 4),
                'localY': round(y-dem.bounds.bottom, 4),
                'elevationM': round(elev, 4),
                'slopeDeg': round(sl, 4),
                'headingDeg': round(heading, 3),
                'distanceM': round(float(dist), 4),
                'progress': round(float(dist/length), 6)
            })
        output = {
            'metadata': {
                'mission': 'Orun Systems | Jezero Crater',
                'type': 'simulated_route_playback',
                'sourceRoute': args.route.name,
                'sourceDem': args.dem.name,
                'sourceSlope': args.slope.name,
                'crs': str(dem.crs),
                'units': {'horizontal': 'm', 'elevation': 'm', 'slope': 'degrees', 'heading': 'degrees_clockwise_from_projected_north'},
                'terrainBounds': {'west': dem.bounds.left, 'south': dem.bounds.bottom, 'east': dem.bounds.right, 'north': dem.bounds.top},
                'coordinateNotes': 'localX=projectedX-west; localY=projectedY-south. Apply the same terrain coordinate and vertical scale transforms in frontend.',
                'verticalDatum': 'Inherited from input DEM; not normalized to zero.',
                'spacingTargetM': args.spacing,
                'distanceM': round(length, 4),
                'frameCount': len(frames),
                'simulationDisclaimer': 'Illustrative route playback, not actual rover telemetry or a rover traversability certification.'
            },
            'frames': frames
        }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'OK: {len(frames)} frames, {length:.2f} m, saved to {args.output}')
    if abs(length-float(route.get('distanceMeters',length))) > 0.05:
        print('WARNING: Computed length differs from route distanceMeters metadata')


if __name__ == '__main__':
    main()
