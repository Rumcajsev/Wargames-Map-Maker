import type { Settlement, GridMetadata } from '../store/mapStore'

export interface NominatimResult {
  name?: string
  address?: Record<string, string>
  boundingbox?: [string, string, string, string]
}

const UGLY_SUFFIXES = [
  'Voivodeship', 'Oblast', 'Raion', 'Okrug', 'Prefecture',
  'Arrondissement', 'Comarca', 'Gmina', 'Powiat', 'Kraj',
  'Subprefecture', 'Municipality',
]

const CONTINENTAL_ZONES: Array<{
  name: string; latMin: number; latMax: number; lonMin: number; lonMax: number
}> = [
  { name: 'Scandinavia',         latMin: 55,  latMax: 71,  lonMin:   5, lonMax:  32 },
  { name: 'British Isles',       latMin: 50,  latMax: 61,  lonMin: -11, lonMax:   2 },
  { name: 'Western Europe',      latMin: 44,  latMax: 55,  lonMin:  -5, lonMax:  10 },
  { name: 'Central Europe',      latMin: 46,  latMax: 55,  lonMin:  10, lonMax:  25 },
  { name: 'Eastern Europe',      latMin: 46,  latMax: 58,  lonMin:  25, lonMax:  42 },
  { name: 'The Balkans',         latMin: 39,  latMax: 47,  lonMin:  14, lonMax:  28 },
  { name: 'Mediterranean',       latMin: 35,  latMax: 44,  lonMin:  -5, lonMax:  36 },
  { name: 'North Africa',        latMin: 20,  latMax: 35,  lonMin: -17, lonMax:  42 },
  { name: 'Middle East',         latMin: 28,  latMax: 42,  lonMin:  34, lonMax:  60 },
  { name: 'Central Asia',        latMin: 35,  latMax: 55,  lonMin:  52, lonMax:  87 },
  { name: 'East Asia',           latMin: 20,  latMax: 55,  lonMin: 100, lonMax: 145 },
  { name: 'South Asia',          latMin:  5,  latMax: 37,  lonMin:  60, lonMax: 100 },
  { name: 'Southeast Asia',      latMin: -10, latMax: 25,  lonMin:  95, lonMax: 140 },
  { name: 'Sub-Saharan Africa',  latMin: -35, latMax: 20,  lonMin: -18, lonMax:  52 },
  { name: 'North America',       latMin: 25,  latMax: 72,  lonMin:-168, lonMax: -50 },
  { name: 'Central America',     latMin:  7,  latMax: 25,  lonMin: -95, lonMax: -60 },
  { name: 'South America',       latMin: -56, latMax: 13,  lonMin: -82, lonMax: -34 },
  { name: 'Australia',           latMin: -45, latMax: -10, lonMin: 112, lonMax: 155 },
]

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * 111
  const dLon = (lon2 - lon1) * 111 * Math.cos((lat1 * Math.PI) / 180)
  return Math.sqrt(dLat * dLat + dLon * dLon)
}

function directionLabel(fromLat: number, fromLon: number, toLat: number, toLon: number): string {
  const dLat = (toLat - fromLat) * 111
  const dLon = (toLon - fromLon) * 111 * Math.cos((fromLat * Math.PI) / 180)
  const angle = Math.atan2(dLon, dLat) * (180 / Math.PI)
  if (angle > -22.5  && angle <=  22.5) return 'North'
  if (angle >  22.5  && angle <=  67.5) return 'North-east'
  if (angle >  67.5  && angle <= 112.5) return 'East'
  if (angle > 112.5  && angle <= 157.5) return 'South-east'
  if (Math.abs(angle) > 157.5)          return 'South'
  if (angle > -157.5 && angle <= -112.5) return 'South-west'
  if (angle > -112.5 && angle <=  -67.5) return 'West'
  return 'North-west'
}

function cardinalPrefix(
  centerLat: number, centerLon: number,
  bb: [string, string, string, string],
  adminWidthKm: number,
  mapWidthKm: number,
): string {
  // Skip cardinal if the map covers most of the admin unit — too ambiguous
  if (mapWidthKm > adminWidthKm * 0.5) return ''

  const latMin = Number(bb[0]), latMax = Number(bb[1])
  const lonMin = Number(bb[2]), lonMax = Number(bb[3])
  const relLat = (centerLat - latMin) / (latMax - latMin)
  const relLon = (centerLon - lonMin) / (lonMax - lonMin)

  const ns = relLat > 0.65 ? 'Northern' : relLat < 0.35 ? 'Southern' : ''
  const ew = relLon > 0.65 ? 'Eastern'  : relLon < 0.35 ? 'Western'  : ''

  if (ns && ew) {
    const nsShort = ns.replace('ern', '')
    return `${nsShort}-${ew.toLowerCase()}`
  }
  return ns || ew
}

function bestSettlement(settlements: Settlement[]): Settlement | null {
  const rank: Record<string, number> = { city: 0, town: 1, village: 2 }
  const pool = settlements.filter(s => s.type in rank)
  if (pool.length === 0) return null
  return pool.sort((a, b) => {
    const tr = (rank[a.type] ?? 9) - (rank[b.type] ?? 9)
    return tr !== 0 ? tr : b.population - a.population
  })[0]
}

export function generateMapTitle(
  settlements: Settlement[],
  metadata: GridMetadata,
  nominatim?: NominatimResult,
): string {
  const widthKm = (metadata.scale_m_per_mm * metadata.paper_mm[0]) / 1000
  const [centerLon, centerLat] = metadata.center

  // --- Small maps: settlements are the ground truth ---
  if (widthKm < 100) {
    const best = bestSettlement(settlements)
    if (best) {
      const distKm = distanceKm(centerLat, centerLon, best.lat, best.lon)
      if (distKm > widthKm * 0.3) {
        const dir = directionLabel(best.lat, best.lon, centerLat, centerLon)
        return `${dir} of ${best.name}`
      }
      return best.name
    }
    // No settlements — fall back to Nominatim name if available
    const a = nominatim?.address ?? {}
    return nominatim?.name || a['city'] || a['town'] || a['village'] || ''
  }

  // --- Continental scale: named geographic zone ---
  if (widthKm > 1500) {
    const zone = CONTINENTAL_ZONES.find(z =>
      centerLat >= z.latMin && centerLat < z.latMax &&
      centerLon >= z.lonMin && centerLon < z.lonMax,
    )
    if (zone) return zone.name
    return nominatim?.address?.['country'] || ''
  }

  // --- Medium / large: Nominatim admin boundary + cardinal prefix ---
  if (!nominatim) return ''

  const adminName = nominatim.name || ''
  const address   = nominatim.address ?? {}
  const bb        = nominatim.boundingbox
  const country   = address['country'] || ''

  let adminWidthKm = Infinity
  if (bb) {
    const latMid = (Number(bb[0]) + Number(bb[1])) / 2
    adminWidthKm = distanceKm(latMid, Number(bb[2]), latMid, Number(bb[3]))
  }

  const nameIsUgly = UGLY_SUFFIXES.some(s => adminName.includes(s))

  if (!adminName || nameIsUgly) {
    // Ugly or missing name: cardinal + country ("Southern Poland")
    const prefix = bb ? cardinalPrefix(centerLat, centerLon, bb, adminWidthKm, widthKm) : ''
    return [prefix, country].filter(Boolean).join(' ')
  }

  const prefix   = bb ? cardinalPrefix(centerLat, centerLon, bb, adminWidthKm, widthKm) : ''
  const baseName = [prefix, adminName].filter(Boolean).join(' ')

  // Append country for regional names so "Bavaria" becomes "Bavaria, Germany"
  // Skip for country-scale maps (widthKm >= 500) where adminName IS the country
  if (widthKm < 500 && country && adminName !== country) {
    return `${baseName}, ${country}`
  }
  return baseName
}

/** Return the Nominatim zoom level appropriate for the map's width in km. */
export function nominatimZoomForWidth(widthKm: number): number {
  if (widthKm < 100)  return 10
  if (widthKm < 500)  return 6
  return 4
}
