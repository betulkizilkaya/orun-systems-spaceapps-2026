export type RoverFrame = {
  index: number
  projectedX: number
  projectedY: number
  elevationM: number
  slopeDeg: number
  headingDeg: number
  distanceM: number
  progress: number
}
export type RoverPlaybackData = {
  metadata: { distanceM: number; frameCount: number; type: string }
  frames: RoverFrame[]
}

export async function loadRoverPlayback(signal?: AbortSignal): Promise<RoverPlaybackData> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/jezero-rover-playback.json`, { signal })
  if (!response.ok) throw new Error(`Rover verisi okunamadı: HTTP ${response.status}`)
  const data: unknown = await response.json()
  if (!data || typeof data !== 'object' || !('frames' in data) || !Array.isArray(data.frames) || data.frames.length < 2) {
    throw new Error('Rover playback JSON yapısı geçersiz.')
  }
  const frames = data.frames as RoverFrame[]
  if (frames.some(f => ![f.projectedX, f.projectedY, f.elevationM, f.slopeDeg, f.distanceM].every(Number.isFinite))) {
    throw new Error('Rover verisinde geçersiz koordinat veya ölçüm var.')
  }
  for (let i = 1; i < frames.length; i++) {
    if (frames[i].distanceM <= frames[i - 1].distanceM) throw new Error('Rover mesafeleri artan sırada değil.')
  }
  return data as RoverPlaybackData
}

export function interpolateFrame(frames: RoverFrame[], distanceM: number): RoverFrame {
  const clamped = Math.max(frames[0].distanceM, Math.min(frames[frames.length - 1].distanceM, distanceM))
  let low = 0, high = frames.length - 1
  while (low < high) {
    const mid = (low + high) >>> 1
    if (frames[mid].distanceM < clamped) low = mid + 1
    else high = mid
  }
  const b = frames[low], a = frames[Math.max(0, low - 1)]
  if (a === b || b.distanceM === a.distanceM) return b
  const t = (clamped - a.distanceM) / (b.distanceM - a.distanceM)
  const mix = (x: number, y: number) => x + (y - x) * t
  const deltaHeading = ((b.headingDeg - a.headingDeg + 540) % 360) - 180
  return {
    index: a.index,
    projectedX: mix(a.projectedX, b.projectedX), projectedY: mix(a.projectedY, b.projectedY),
    elevationM: mix(a.elevationM, b.elevationM), slopeDeg: mix(a.slopeDeg, b.slopeDeg),
    headingDeg: (a.headingDeg + deltaHeading * t + 360) % 360,
    distanceM: clamped, progress: mix(a.progress, b.progress),
  }
}
