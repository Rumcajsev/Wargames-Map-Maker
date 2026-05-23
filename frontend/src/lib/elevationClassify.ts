import type { GeneratedHex, ClassificationParams } from '../store/mapStore'

type ElevClass = 'flat' | 'hills' | 'mountains'
const RANK: Record<ElevClass, number> = { flat: 0, hills: 1, mountains: 2 }

function pctThreshold(sorted: number[], topPct: number): number {
  const idx = Math.max(0, Math.floor(sorted.length * (1 - topPct / 100)))
  return sorted[idx]
}

export function classifyElevation(
  hexes: GeneratedHex[],
  params: ClassificationParams,
): GeneratedHex[] {
  const active = hexes.filter(
    h => h.terrain !== 'sea' && !h.isLake
      && h.elevation_range_m != null
      && h.elevation_median_m != null
  )

  if (active.length === 0) {
    return hexes.map(h => ({ ...h, elevation_class: null }))
  }

  // Build sorted arrays for each signal
  const rangesSorted = active.map(h => h.elevation_range_m!).sort((a, b) => a - b)
  const mediansSorted = active.map(h => h.elevation_median_m!).sort((a, b) => a - b)

  // Range thresholds (ruggedness)
  const mRangeMin = pctThreshold(rangesSorted, params.mountainsPct)
  const hRangeMin = pctThreshold(rangesSorted, params.mountainsPct + params.hillsPct)

  // Median thresholds (absolute height)
  const mMedianMin = pctThreshold(mediansSorted, params.mountainsMedianPct)
  const hMedianMin = pctThreshold(mediansSorted, params.mountainsMedianPct + params.hillsMedianPct)

  return hexes.map(h => {
    if (
      h.terrain === 'sea' || h.isLake
      || h.elevation_range_m == null
      || h.elevation_median_m == null
    ) {
      return { ...h, elevation_class: null }
    }

    const range = h.elevation_range_m
    const median = h.elevation_median_m

    // Classify by ruggedness
    let byRange: ElevClass = 'flat'
    if (range >= mRangeMin && range >= params.mountainsFloorM) byRange = 'mountains'
    else if (range >= hRangeMin && range >= params.hillsFloorM) byRange = 'hills'

    // Classify by absolute height
    let byMedian: ElevClass = 'flat'
    if (median >= mMedianMin && median >= params.mountainsMedianFloorM) byMedian = 'mountains'
    else if (median >= hMedianMin && median >= params.hillsMedianFloorM) byMedian = 'hills'

    // Take the higher of the two
    const result: ElevClass = RANK[byRange] >= RANK[byMedian] ? byRange : byMedian
    return { ...h, elevation_class: result }
  })
}
