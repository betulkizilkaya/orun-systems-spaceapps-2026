export function getSampleElevation(x: number, z: number): number {
  const distance = Math.hypot(x + 6, z - 4)
  const craterFloor = -8 * Math.exp(-((distance / 18) ** 2))
  const craterRim = 5 * Math.exp(-(((distance - 24) / 5) ** 2))
  const ridges = 1.6 * Math.sin(x * 0.12) * Math.cos(z * 0.1)

  return craterFloor + craterRim + ridges
}