import type { GeneratedHex, ClassificationParams } from '../store/mapStore'

export function classifyElevation(
  hexes: GeneratedHex[],
  params: ClassificationParams,
): GeneratedHex[] {
  const active = hexes.filter(
    h => h.terrain !== 'sea' && !h.isLake && h.elevation_range_m != null
  )

  if (active.length === 0) {
    return hexes.map(h => ({ ...h, elevation_class: null }))
  }

  const sorted = [...active].sort((a, b) => a.elevation_range_m! - b.elevation_range_m!)
  const n = sorted.length

  // Index of the first hex in the top mountainsPct%
  const mIdx = Math.max(0, Math.floor(n * (1 - params.mountainsPct / 100)))
  // Index of the first hex in the top (mountainsPct + hillsPct)%
  const hIdx = Math.max(0, Math.floor(n * (1 - (params.mountainsPct + params.hillsPct) / 100)))

  const mountainsRangeMin = sorted[mIdx].elevation_range_m!
  const hillsRangeMin = sorted[hIdx].elevation_range_m!

  return hexes.map(h => {
    if (h.terrain === 'sea' || h.isLake || h.elevation_range_m == null) {
      return { ...h, elevation_class: null }
    }
    const range = h.elevation_range_m
    if (range >= mountainsRangeMin && range >= params.mountainsFloorM) {
      return { ...h, elevation_class: 'mountains' as const }
    }
    if (range >= hillsRangeMin && range >= params.hillsFloorM) {
      return { ...h, elevation_class: 'hills' as const }
    }
    return { ...h, elevation_class: 'flat' as const }
  })
}
