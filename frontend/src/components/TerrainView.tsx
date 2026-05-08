import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import maplibregl from 'maplibre-gl'
import { useMapStore, TERRAIN_COLORS, riverEdgeCanonicalKey, HIGHWAY_TO_TIER, type GridMetadata, type GeneratedHex, type RiverFeature, type RoadTierStyle } from '../store/mapStore'

function seededRng(seed: number) {
  let s = (seed + 1) * 2654435761
  return () => {
    s ^= s << 13; s ^= s >> 17; s ^= s << 5
    return (s >>> 0) / 0xffffffff
  }
}

function perturbPoints(pts: [number, number][], amount: number, rng: () => number): [number, number][] {
  if (amount === 0 || pts.length < 3) return pts
  return pts.map((pt, i) => {
    if (i === 0 || i === pts.length - 1) return pt
    const prev = pts[i - 1], next = pts[i + 1]
    const dx = next[0] - prev[0], dy = next[1] - prev[1]
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len === 0) return pt
    const nx = -dy / len, ny = dx / len
    const offset = (rng() * 2 - 1) * amount
    return [pt[0] + nx * offset, pt[1] + ny * offset] as [number, number]
  })
}

function straightenPoints(pts: [number, number][], amount: number): [number, number][] {
  if (amount === 0 || pts.length < 3) return pts
  return pts.map((p, i) => {
    if (i === 0 || i === pts.length - 1) return p
    const prev = pts[i - 1], next = pts[i + 1]
    return [
      p[0] + ((prev[0] + next[0]) / 2 - p[0]) * amount,
      p[1] + ((prev[1] + next[1]) / 2 - p[1]) * amount,
    ]
  })
}

function offsetPolyline(pts: [number, number][], offset: number): [number, number][] {
  if (pts.length < 2 || offset === 0) return pts
  return pts.map((p, i) => {
    let nx = 0, ny = 0, cnt = 0
    if (i > 0) {
      const dx = p[0] - pts[i - 1][0], dy = p[1] - pts[i - 1][1]
      const len = Math.hypot(dx, dy)
      if (len > 1e-6) { nx += -dy / len; ny += dx / len; cnt++ }
    }
    if (i < pts.length - 1) {
      const dx = pts[i + 1][0] - p[0], dy = pts[i + 1][1] - p[1]
      const len = Math.hypot(dx, dy)
      if (len > 1e-6) { nx += -dy / len; ny += dx / len; cnt++ }
    }
    if (cnt === 0) return p
    const nlen = Math.hypot(nx, ny)
    if (nlen < 1e-6) return p
    return [p[0] + (nx / nlen) * offset, p[1] + (ny / nlen) * offset] as [number, number]
  })
}

function catmullRom(pts: [number, number][], steps: number): [number, number][] {
  if (pts.length < 2) return pts
  const ext: [number, number][] = [
    [2 * pts[0][0] - pts[1][0], 2 * pts[0][1] - pts[1][1]],
    ...pts,
    [2 * pts[pts.length - 1][0] - pts[pts.length - 2][0], 2 * pts[pts.length - 1][1] - pts[pts.length - 2][1]],
  ]
  const result: [number, number][] = []
  for (let i = 1; i < ext.length - 2; i++) {
    const [x0, y0] = ext[i - 1], [x1, y1] = ext[i], [x2, y2] = ext[i + 1], [x3, y3] = ext[i + 2]
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t
      result.push([
        0.5 * ((2 * x1) + (-x0 + x2) * t + (2 * x0 - 5 * x1 + 4 * x2 - x3) * t2 + (-x0 + 3 * x1 - 3 * x2 + x3) * t3),
        0.5 * ((2 * y1) + (-y0 + y2) * t + (2 * y0 - 5 * y1 + 4 * y2 - y3) * t2 + (-y0 + 3 * y1 - 3 * y2 + y3) * t3),
      ])
    }
  }
  result.push(pts[pts.length - 1])
  return result
}

// Maps terrain type → public tile URL. Add entries as assets are dropped into public/tiles/.
const TILE_MAP: Partial<Record<string, string>> = {
  // clear:   '/tiles/clear_01.png',
  // woods:   '/tiles/woods_01.png',
  // rough:   '/tiles/rough_01.png',
  // marsh:   '/tiles/marsh_01.png',
  // hills:   '/tiles/hills_01.png',
  // mountains: '/tiles/mountains_01.png',
  // lake:    '/tiles/lake_01.png',
  // sea:     '/tiles/sea_01.png',
  // urban:   '/tiles/urban_01.png',
  // river:   '/tiles/river_01.png',
}

function chaikinSmooth(pts: [number, number][], iterations = 2): [number, number][] {
  let r = pts
  for (let n = 0; n < iterations; n++) {
    const next: [number, number][] = [r[0]]
    for (let i = 0; i < r.length - 1; i++) {
      const [x0, y0] = r[i], [x1, y1] = r[i + 1]
      next.push([0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1])
      next.push([0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1])
    }
    next.push(r[r.length - 1])
    r = next
  }
  return r
}

// Render lowest tier first so higher-priority tiers draw on top
const TIER_RENDER_ORDER: (0 | 1 | 2)[] = [2, 1, 0]

function elevHeatColor(value: number, min: number, max: number): string {
  const t = max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0
  // green (low) → brown (mid) → white (high)
  if (t < 0.5) {
    const u = t * 2
    const r = Math.round(80 + u * (140 - 80))
    const g = Math.round(140 + u * (110 - 140))
    const b = Math.round(60 + u * (70 - 60))
    return `rgb(${r},${g},${b})`
  } else {
    const u = (t - 0.5) * 2
    const r = Math.round(140 + u * (220 - 140))
    const g = Math.round(110 + u * (200 - 110))
    const b = Math.round(70 + u * (190 - 70))
    return `rgb(${r},${g},${b})`
  }
}

function projectToSVG(
  lon: number,
  lat: number,
  meta: GridMetadata,
  svgW: number,
  svgH: number,
): [number, number] {
  const MPDEG = 111319
  const cosLat = Math.cos((meta.center[1] * Math.PI) / 180)
  const β = (meta.bearing * Math.PI) / 180
  const E_m = (lon - meta.center[0]) * cosLat * MPDEG
  const N_m = (lat - meta.center[1]) * MPDEG
  const px_m = E_m * Math.cos(β) - N_m * Math.sin(β)
  const py_m = E_m * Math.sin(β) + N_m * Math.cos(β)
  const scalePxPerM = svgW / (meta.scale_m_per_mm * meta.paper_mm[0])
  return [svgW / 2 + px_m * scalePxPerM, svgH / 2 - py_m * scalePxPerM]
}



function computeOverlayZoom(meta: GridMetadata, svgW: number): number {
  const widthM = meta.scale_m_per_mm * meta.paper_mm[0]
  const cosLat = Math.cos((meta.center[1] * Math.PI) / 180)
  return Math.log2((78271.516 * cosLat * svgW) / widthM)
}

export function TerrainView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [frameDims, setFrameDims] = useState({ w: 0, h: 0 })
  const [overlayHeld, setOverlayHeld] = useState(false)

  const holdStart = useCallback(() => setOverlayHeld(true), [])
  const holdEnd = useCallback(() => setOverlayHeld(false), [])

  const { generatedHexes, generatedMetadata, selectedHex, setSelectedHex, settlements, rawRoadWays, roadEdges, roadsDisplayMode, roadsVisibleTiers, rawRailWays, railEdges, railsDisplayMode, railPaintMode, railPaintEraser, addRailEdge, removeRailHexEdges, riverEdges, riverChains, riverFeatures, riversDisplayMode, hoveredRiverIndex, riverEditMode, toggleManualRiverEdge, elevationStatus, showReliefHeatmap, showElevHeatmap, elevationStyle, contourInterval, terrainPaintMode, terrainPaintBrush, overrideHexTerrain, elevationPaintMode, elevationPaintBrush, overrideHexElevation, roadPaintMode, roadPaintBrush, roadPaintEraser, addRoadEdge, removeRoadHexEdges, removeAllRoadHexEdges, settlementEditMode, settlementMoveIndex, setSettlementPlaceTarget, setSettlementEditMode, updateSettlement, setSettlementMoveIndex, pushUndoSnapshot, hexBorderMode, terrainDisplacement, terrainNoiseFrequency, terrainNoiseSeed, terrainNoiseOctaves, illustratedStyle, riverWidthScale, riverCurveSteps, riverMeander, riverMeanderSeed, riverStraighten, urbanHexStyle, woodsHexStyle, roadTierStyles } = useMapStore()
  const [hoveredEdgeKey, setHoveredEdgeKey] = useState<string | null>(null)
  const isPaintingRef = useRef(false)
  const roadPaintActionRef = useRef<'add' | 'remove' | null>(null)
  const lastRoadPaintHexRef = useRef<{ q: number; r: number } | null>(null)
  const railPaintActionRef = useRef<'add' | 'remove' | null>(null)
  const lastRailPaintHexRef = useRef<{ q: number; r: number } | null>(null)
  const [mapZoom, setMapZoom] = useState(1)
  const [mapPan, setMapPan] = useState({ x: 0, y: 0 })
  const mapZoomRef = useRef(1)
  const mapPanRef = useRef({ x: 0, y: 0 })
  const isMapPanningRef = useRef(false)
  const mapPanStartRef = useRef({ x: 0, y: 0 })
  const mapPanOriginRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const anyPaint = terrainPaintMode || elevationPaintMode || roadPaintMode || railPaintMode
    if (!anyPaint) {
      isPaintingRef.current = false
      roadPaintActionRef.current = null
      lastRoadPaintHexRef.current = null
      railPaintActionRef.current = null
      lastRailPaintHexRef.current = null
      return
    }
    const onUp = () => {
      isPaintingRef.current = false
      roadPaintActionRef.current = null
      lastRoadPaintHexRef.current = null
      railPaintActionRef.current = null
      lastRailPaintHexRef.current = null
    }
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
  }, [terrainPaintMode, roadPaintMode, railPaintMode])

  const resetMapView = useCallback(() => {
    mapZoomRef.current = 1
    mapPanRef.current = { x: 0, y: 0 }
    setMapZoom(1)
    setMapPan({ x: 0, y: 0 })
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const cx = e.clientX - rect.left - rect.width / 2
      const cy = e.clientY - rect.top - rect.height / 2
      const oldZoom = mapZoomRef.current
      const delta = e.deltaY < 0 ? 1.12 : 0.9
      const newZoom = Math.max(0.2, Math.min(6, oldZoom * delta))
      const factor = newZoom / oldZoom
      const oldPan = mapPanRef.current
      const newPan = {
        x: cx * (1 - factor) + oldPan.x * factor,
        y: cy * (1 - factor) + oldPan.y * factor,
      }
      mapZoomRef.current = newZoom
      mapPanRef.current = newPan
      setMapZoom(newZoom)
      setMapPan(newPan)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 1) return
      e.preventDefault()
      isMapPanningRef.current = true
      mapPanStartRef.current = { x: e.clientX, y: e.clientY }
      mapPanOriginRef.current = { ...mapPanRef.current }
      el.style.cursor = 'grabbing'
    }
    const onMouseMove = (e: MouseEvent) => {
      if (!isMapPanningRef.current) return
      const newPan = {
        x: mapPanOriginRef.current.x + e.clientX - mapPanStartRef.current.x,
        y: mapPanOriginRef.current.y + e.clientY - mapPanStartRef.current.y,
      }
      mapPanRef.current = newPan
      setMapPan(newPan)
    }
    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== 1) return
      isMapPanningRef.current = false
      el.style.cursor = ''
    }
    el.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      el.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const meta = generatedMetadata

  useEffect(() => {
    const el = containerRef.current
    if (!el || !meta) return

    const compute = () => {
      const vw = el.clientWidth
      const vh = el.clientHeight
      const [pwMm, phMm] = meta.paper_mm
      const aspect = pwMm / phMm
      const margin = 0.86

      let fw = vw * margin
      let fh = fw / aspect
      if (fh > vh * margin) {
        fh = vh * margin
        fw = fh * aspect
      }
      setFrameDims({ w: Math.round(fw), h: Math.round(fh) })
    }

    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [meta])

  // Map overlay lifecycle — mounts/unmounts with hold state
  useEffect(() => {
    if (!overlayHeld || !meta || frameDims.w === 0 || !mapContainerRef.current) return

    const zoom = computeOverlayZoom(meta, frameDims.w)

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      center: meta.center,
      zoom,
      bearing: meta.bearing,
      interactive: false,
      attributionControl: false,
    })

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [overlayHeld, meta, frameDims.w])

  if (!meta) return null

  const { w: svgW, h: svgH } = frameDims
  const scalePxPerMm = svgW > 0 ? svgW / meta.paper_mm[0] : 0
  const marginPx = meta.margin_mm * scalePxPerMm

  const toSVG = (lon: number, lat: number): [number, number] =>
    projectToSVG(lon, lat, meta, svgW, svgH)

  const buildRiverPath = (lonLatPts: [number, number][], seed: number): string | null => {
    const px = lonLatPts.map(([lon, lat]) => toSVG(lon, lat))
    if (px.length < 2) return null
    const straightened = straightenPoints(px, riverStraighten)
    const rng = seededRng(seed)
    const perturbed = perturbPoints(straightened, riverMeander, rng)
    const curved = catmullRom(perturbed, riverCurveSteps)
    return curved.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')
  }

  const hexIndex = new Map(generatedHexes.map((h) => [`${h.q},${h.r}`, h]))

  // Smooth road chains — built per tier from edge list
  const smoothedRoadData = useMemo(() => {
    if (roadsDisplayMode !== 'per_hex' || roadEdges.length === 0)
      return { chains: [] as { tier: 0 | 1 | 2; chain: [number, number][] }[], junctions: [] as { pos: [number, number]; tier: 0 | 1 | 2 }[] }

    const byTier = new Map<0 | 1 | 2, typeof roadEdges>()
    for (const e of roadEdges) {
      if (!roadsVisibleTiers[e.tier]) continue
      if (!byTier.has(e.tier)) byTier.set(e.tier, [])
      byTier.get(e.tier)!.push(e)
    }

    const hexIdx = new Map(generatedHexes.map((h) => [`${h.q},${h.r}`, h]))
    const chains: { tier: 0 | 1 | 2; chain: [number, number][] }[] = []
    const junctionMap = new Map<string, { pos: [number, number]; tier: 0 | 1 | 2 }>()

    // Track which tiers touch each hex — used to detect cross-tier junctions
    const hexTiers = new Map<string, Set<0 | 1 | 2>>()
    for (const e of roadEdges) {
      if (!roadsVisibleTiers[e.tier]) continue
      for (const k of [`${e.q1},${e.r1}`, `${e.q2},${e.r2}`]) {
        if (!hexTiers.has(k)) hexTiers.set(k, new Set())
        hexTiers.get(k)!.add(e.tier)
      }
    }
    const isGlobalJunction = (k: string) => (hexTiers.get(k)?.size ?? 0) > 1

    for (const [tier, edges] of byTier) {
      const adj = new Map<string, string[]>()
      for (const e of edges) {
        const k1 = `${e.q1},${e.r1}`, k2 = `${e.q2},${e.r2}`
        if (!adj.has(k1)) adj.set(k1, [])
        if (!adj.has(k2)) adj.set(k2, [])
        if (!adj.get(k1)!.includes(k2)) adj.get(k1)!.push(k2)
        if (!adj.get(k2)!.includes(k1)) adj.get(k2)!.push(k1)
      }

      const visitedPairs = new Set<string>()
      const isJunction = (k: string) => (adj.get(k) ?? []).length > 2 || isGlobalJunction(k)

      // Collect junction nodes — keep highest-priority (lowest tier number) at each point
      for (const [k] of adj) {
        if (isJunction(k)) {
          const h = hexIdx.get(k)
          if (h) {
            const existing = junctionMap.get(k)
            if (!existing || tier < existing.tier)
              junctionMap.set(k, { pos: [h.center[0], h.center[1]], tier })
          }
        }
      }

      const walk = (startKey: string): [number, number][] => {
        const h0 = hexIdx.get(startKey)
        if (!h0) return []
        const startDeg = (adj.get(startKey) ?? []).length
        const pts: [number, number][] = []
        if (startDeg !== 2 || isJunction(startKey)) pts.push([h0.center[0], h0.center[1]])
        let cur = startKey
        for (;;) {
          const next = (adj.get(cur) ?? []).find((nk) => {
            const ep = cur < nk ? `${cur}|${nk}` : `${nk}|${cur}`
            return !visitedPairs.has(ep)
          })
          if (!next) break
          const ep = cur < next ? `${cur}|${next}` : `${next}|${cur}`
          visitedPairs.add(ep)
          const h1 = hexIdx.get(cur), h2 = hexIdx.get(next)
          if (h1 && h2)
            pts.push([(h1.center[0] + h2.center[0]) / 2, (h1.center[1] + h2.center[1]) / 2])
          cur = next
          const curDeg = (adj.get(cur) ?? []).length
          if (curDeg === 1) {
            const he = hexIdx.get(cur)
            if (he) pts.push([he.center[0], he.center[1]])
            break
          }
          if (isJunction(cur)) {
            const hj = hexIdx.get(cur)
            if (hj) pts.push([hj.center[0], hj.center[1]])
            break
          }
        }
        return pts
      }

      for (const [k, nbs] of adj) {
        if (nbs.length === 1) {
          const pts = walk(k)
          if (pts.length >= 2) chains.push({ tier, chain: catmullRom(pts, 10) })
        }
      }
      for (const [k, nbs] of adj) {
        if (isJunction(k)) {
          for (const nk of nbs) {
            const ep = k < nk ? `${k}|${nk}` : `${nk}|${k}`
            if (!visitedPairs.has(ep)) {
              const pts = walk(k)
              if (pts.length >= 2) chains.push({ tier, chain: catmullRom(pts, 10) })
            }
          }
        }
      }
      for (const [k, nbs] of adj) {
        for (const nk of nbs) {
          const ep = k < nk ? `${k}|${nk}` : `${nk}|${k}`
          if (!visitedPairs.has(ep)) {
            const pts = walk(k)
            if (pts.length >= 2) chains.push({ tier, chain: catmullRom(pts, 10) })
          }
        }
      }
    }
    return { chains, junctions: Array.from(junctionMap.values()) }
  }, [roadsDisplayMode, roadEdges, roadsVisibleTiers, generatedHexes])

  // Smooth rail chains — split into per-segment sub-chains (shared vs unshared with roads)
  // so the offset only applies where rail and road share the same hex-pair.
  const smoothedRailChains = useMemo(() => {
    if (railsDisplayMode !== 'per_hex' || railEdges.length === 0)
      return [] as { chain: [number, number][]; isShared: boolean }[]

    const roadPairSet = new Set<string>()
    for (const e of roadEdges) {
      const a = `${e.q1},${e.r1}`, b = `${e.q2},${e.r2}`
      roadPairSet.add(a < b ? `${a}|${b}` : `${b}|${a}`)
    }

    const hexIdx = new Map(generatedHexes.map((h) => [`${h.q},${h.r}`, h]))
    const adj = new Map<string, string[]>()
    for (const e of railEdges) {
      const k1 = `${e.q1},${e.r1}`, k2 = `${e.q2},${e.r2}`
      if (!adj.has(k1)) adj.set(k1, [])
      if (!adj.has(k2)) adj.set(k2, [])
      if (!adj.get(k1)!.includes(k2)) adj.get(k1)!.push(k2)
      if (!adj.get(k2)!.includes(k1)) adj.get(k2)!.push(k1)
    }
    const visitedPairs = new Set<string>()
    const isJunction = (k: string) => (adj.get(k) ?? []).length > 2

    // Walk returns waypoints and per-point shared tag:
    // null = hex center (junction/endpoint anchor), boolean = midpoint shared status
    const walk = (startKey: string): { pts: [number, number][]; midShared: (boolean | null)[] } => {
      const h0 = hexIdx.get(startKey)
      if (!h0) return { pts: [], midShared: [] }
      const startDeg = (adj.get(startKey) ?? []).length
      const pts: [number, number][] = []
      const midShared: (boolean | null)[] = []
      if (startDeg !== 2 || isJunction(startKey)) { pts.push([h0.center[0], h0.center[1]]); midShared.push(null) }
      let cur = startKey
      for (;;) {
        const next = (adj.get(cur) ?? []).find((nk) => {
          const ep = cur < nk ? `${cur}|${nk}` : `${nk}|${cur}`
          return !visitedPairs.has(ep)
        })
        if (!next) break
        const ep = cur < next ? `${cur}|${next}` : `${next}|${cur}`
        visitedPairs.add(ep)
        const h1 = hexIdx.get(cur), h2 = hexIdx.get(next)
        if (h1 && h2) {
          pts.push([(h1.center[0] + h2.center[0]) / 2, (h1.center[1] + h2.center[1]) / 2])
          midShared.push(roadPairSet.has(ep))
        }
        cur = next
        const curDeg = (adj.get(cur) ?? []).length
        if (curDeg === 1) { const he = hexIdx.get(cur); if (he) { pts.push([he.center[0], he.center[1]]); midShared.push(null) } break }
        if (isJunction(cur)) { const hj = hexIdx.get(cur); if (hj) { pts.push([hj.center[0], hj.center[1]]); midShared.push(null) } break }
      }
      return { pts, midShared }
    }

    // Segment i (between pts[i] and pts[i+1]) is shared if the midpoint it leads into is shared.
    // Centers (null) inherit from the adjacent midpoint's status.
    function segmentShared(midShared: (boolean | null)[]): boolean[] {
      const r: boolean[] = []
      for (let i = 0; i < midShared.length - 1; i++) {
        const next = midShared[i + 1], cur = midShared[i]
        r.push(next !== null ? next : cur !== null ? cur : false)
      }
      return r
    }

    // Split pts into runs of same shared status; boundary waypoints are shared between runs
    function splitSubChains(pts: [number, number][], segSh: boolean[]): { pts: [number, number][]; isShared: boolean }[] {
      if (pts.length < 2 || segSh.length === 0) return []
      const result: { pts: [number, number][]; isShared: boolean }[] = []
      let runStart = 0, runShared = segSh[0]
      for (let i = 1; i <= segSh.length; i++) {
        const atEnd = i === segSh.length
        if (atEnd || segSh[i] !== runShared) {
          result.push({ pts: pts.slice(runStart, i + 1), isShared: runShared })
          runStart = i
          if (!atEnd) runShared = segSh[i]
        }
      }
      return result
    }

    const results: { chain: [number, number][]; isShared: boolean }[] = []
    const pushWalk = (startKey: string) => {
      const { pts, midShared } = walk(startKey)
      if (pts.length < 2) return
      for (const { pts: sub, isShared } of splitSubChains(pts, segmentShared(midShared))) {
        if (sub.length >= 2) results.push({ chain: catmullRom(sub, 10), isShared })
      }
    }
    for (const [k, nbs] of adj) { if (nbs.length === 1) pushWalk(k) }
    for (const [k, nbs] of adj) {
      if (isJunction(k)) {
        for (const nk of nbs) {
          const ep = k < nk ? `${k}|${nk}` : `${nk}|${k}`
          if (!visitedPairs.has(ep)) pushWalk(k)
        }
      }
    }
    for (const [k, nbs] of adj) {
      for (const nk of nbs) {
        const ep = k < nk ? `${k}|${nk}` : `${nk}|${k}`
        if (!visitedPairs.has(ep)) pushWalk(k)
      }
    }
    return results
  }, [railsDisplayMode, railEdges, roadEdges, generatedHexes])

  // Contour chains — elevation_m iso-contours, restricted to hills/mountains areas
  const contourData = useMemo(() => {
    if (elevationStatus !== 'done') return { levels: [] as { level: number; isMajor: boolean; chains: [number, number][][] }[], interval: 0 }

    const WATER = new Set(['sea', 'lake', 'river'])
    const EPS = 0.00015
    const vKey = (v: [number, number]) =>
      `${Math.round(v[0] / (EPS * 0.5))},${Math.round(v[1] / (EPS * 0.5))}`

    const edgeMap = new Map<string, { v0: [number, number]; v1: [number, number]; hexKeys: string[] }>()
    for (const hex of generatedHexes) {
      const n = hex.vertices.length
      for (let i = 0; i < n; i++) {
        const v0 = hex.vertices[i] as [number, number]
        const v1 = hex.vertices[(i + 1) % n] as [number, number]
        const vk0 = vKey(v0), vk1 = vKey(v1)
        const ek = vk0 < vk1 ? `${vk0}|${vk1}` : `${vk1}|${vk0}`
        if (!edgeMap.has(ek)) edgeMap.set(ek, { v0, v1, hexKeys: [`${hex.q},${hex.r}`] })
        else edgeMap.get(ek)!.hexKeys.push(`${hex.q},${hex.r}`)
      }
    }

    const hexIdx = new Map(generatedHexes.map((h) => [`${h.q},${h.r}`, h]))

    // Interval based on elevation range within elevated hexes only
    const elevValues = generatedHexes
      .filter((h) => !WATER.has(h.terrain) && (h.elevation_class === 'hills' || h.elevation_class === 'mountains') && h.elevation_m != null)
      .map((h) => h.elevation_m!)
    if (elevValues.length === 0) return { levels: [], interval: 0 }

    const minE = Math.min(...elevValues), maxE = Math.max(...elevValues)
    const range = maxE - minE
    const interval = contourInterval > 0 ? contourInterval
      : range < 100 ? 10 : range < 300 ? 25 : range < 600 ? 50
      : range < 1500 ? 100 : range < 3000 ? 200 : 500

    const firstLevel = Math.ceil(minE / interval) * interval
    const levels: number[] = []
    for (let l = firstLevel; l <= maxE; l += interval) levels.push(l)

    function buildChains(edges: { v0: [number, number]; v1: [number, number] }[]): [number, number][][] {
      const adj = new Map<string, string[]>()
      const coords = new Map<string, [number, number]>()
      for (const { v0, v1 } of edges) {
        const vk0 = vKey(v0), vk1 = vKey(v1)
        coords.set(vk0, v0); coords.set(vk1, v1)
        if (!adj.has(vk0)) adj.set(vk0, [])
        if (!adj.has(vk1)) adj.set(vk1, [])
        if (!adj.get(vk0)!.includes(vk1)) adj.get(vk0)!.push(vk1)
        if (!adj.get(vk1)!.includes(vk0)) adj.get(vk1)!.push(vk0)
      }
      const visited = new Set<string>()
      const chains: [number, number][][] = []
      const walk = (start: string): [number, number][] => {
        const chain: [number, number][] = [coords.get(start)!]
        let cur = start
        for (;;) {
          const next = (adj.get(cur) ?? []).find((vk) => {
            const ep = cur < vk ? `${cur}|${vk}` : `${vk}|${cur}`
            return !visited.has(ep)
          })
          if (!next) break
          const ep = cur < next ? `${cur}|${next}` : `${next}|${cur}`
          visited.add(ep)
          chain.push(coords.get(next)!)
          cur = next
        }
        return chain
      }
      for (const [vk, nbs] of adj) {
        if (nbs.length !== 2) { const c = walk(vk); if (c.length >= 2) chains.push(chaikinSmooth(c, 2)) }
      }
      for (const [vk, nbs] of adj) {
        for (const nk of nbs) {
          const ep = vk < nk ? `${vk}|${nk}` : `${nk}|${vk}`
          if (!visited.has(ep)) { const c = walk(vk); if (c.length >= 2) chains.push(chaikinSmooth(c, 2)) }
        }
      }
      return chains
    }

    const result = levels.map((level, li) => {
      const edges: { v0: [number, number]; v1: [number, number] }[] = []
      for (const [, edge] of edgeMap) {
        if (edge.hexKeys.length !== 2) continue
        const h1 = hexIdx.get(edge.hexKeys[0])
        const h2 = hexIdx.get(edge.hexKeys[1])
        if (!h1 || !h2) continue
        if (WATER.has(h1.terrain) || WATER.has(h2.terrain)) continue
        // Skip edges where both hexes are flat — contours only within elevated areas
        if (h1.elevation_class === 'flat' && h2.elevation_class === 'flat') continue
        const e1 = h1.elevation_m ?? 0, e2 = h2.elevation_m ?? 0
        if ((e1 < level) !== (e2 < level)) edges.push({ v0: edge.v0, v1: edge.v1 })
      }
      return { level, isMajor: li % 5 === 0, chains: buildChains(edges) }
    })

    return { levels: result, interval }
  }, [elevationStatus, generatedHexes, contourInterval])

  // All interior hex edges (shared by 2 hexes) — computed once, used for edit overlay
  const interiorEdges = useMemo(() => {
    if (!riverEditMode || generatedHexes.length === 0) return []
    const VK_EPS = 0.00015
    const vKey = (v: [number, number]) =>
      `${Math.round(v[0] / (VK_EPS * 0.5))},${Math.round(v[1] / (VK_EPS * 0.5))}`
    type EdgeEntry = { ek: string; v0: [number, number]; v1: [number, number]; q1: number; r1: number; q2: number; r2: number }
    const edgeMap = new Map<string, EdgeEntry>()
    for (const hex of generatedHexes) {
      const n = hex.vertices.length
      for (let i = 0; i < n; i++) {
        const v0 = hex.vertices[i] as [number, number]
        const v1 = hex.vertices[(i + 1) % n] as [number, number]
        const vk0 = vKey(v0), vk1 = vKey(v1)
        const ek = vk0 < vk1 ? `${vk0}|${vk1}` : `${vk1}|${vk0}`
        if (edgeMap.has(ek)) {
          edgeMap.get(ek)!.q2 = hex.q
          edgeMap.get(ek)!.r2 = hex.r
        } else {
          edgeMap.set(ek, { ek, v0, v1, q1: hex.q, r1: hex.r, q2: -999, r2: -999 })
        }
      }
    }
    return Array.from(edgeMap.values()).filter((e) => e.q2 !== -999)
  }, [riverEditMode, generatedHexes])

  // Fast lookup: which edges currently have a river
  const riverEdgeKeySet = useMemo(() => {
    const s = new Set<string>()
    for (const e of riverEdges) s.add(riverEdgeCanonicalKey(e.q1, e.r1, e.q2, e.r2))
    return s
  }, [riverEdges])

  // Urban cluster boundary — edges belonging to exactly one urban hex
  const urbanBoundaryEdges = useMemo(() => {
    const VK_EPS = 0.00015
    const vKey = (v: [number, number]) =>
      `${Math.round(v[0] / (VK_EPS * 0.5))},${Math.round(v[1] / (VK_EPS * 0.5))}`
    const edgeMap = new Map<string, { v0: [number, number]; v1: [number, number]; count: number }>()
    for (const hex of generatedHexes) {
      if (hex.terrain !== 'urban') continue
      const n = hex.vertices.length
      for (let i = 0; i < n; i++) {
        const v0 = hex.vertices[i] as [number, number]
        const v1 = hex.vertices[(i + 1) % n] as [number, number]
        const vk0 = vKey(v0), vk1 = vKey(v1)
        const ek = vk0 < vk1 ? `${vk0}|${vk1}` : `${vk1}|${vk0}`
        const e = edgeMap.get(ek)
        if (e) e.count++
        else edgeMap.set(ek, { v0, v1, count: 1 })
      }
    }
    return Array.from(edgeMap.values()).filter((e) => e.count === 1).map(({ v0, v1 }) => ({ v0, v1 }))
  }, [generatedHexes])


  const hexPath = (hex: GeneratedHex): string => {
    if (svgW === 0) return ''
    return hex.vertices
      .map((v, i) => {
        const [x, y] = toSVG(v[0], v[1])
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
      })
      .join(' ') + ' Z'
  }

  const hexIndicatorPos = (hex: GeneratedHex): [number, number] => {
    if (svgW === 0) return [0, 0]
    return toSVG(hex.center[0], hex.center[1])
  }

  const terrainOpacity = overlayHeld ? 0.3 : 1

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#2a2a35',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Floating hold-to-preview button — always visible regardless of sidebar tab */}
      <button
        onMouseDown={holdStart}
        onMouseUp={holdEnd}
        onMouseLeave={holdEnd}
        onTouchStart={(e) => { e.preventDefault(); holdStart() }}
        onTouchEnd={holdEnd}
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          zIndex: 20,
          padding: '7px 13px',
          background: overlayHeld ? 'rgba(30,60,90,0.92)' : 'rgba(18,19,26,0.82)',
          color: overlayHeld ? '#8ab8d8' : '#6a6a8a',
          border: `1px solid ${overlayHeld ? '#4a7aaa' : '#2a2a3a'}`,
          borderRadius: 6,
          cursor: 'pointer',
          fontFamily: 'ui-monospace, monospace',
          fontSize: 11,
          userSelect: 'none',
          backdropFilter: 'blur(4px)',
          transition: 'background 0.1s, color 0.1s, border-color 0.1s',
        }}
      >
        {overlayHeld ? '⊙ map visible' : '⊙ hold for map'}
      </button>

      {(mapZoom !== 1 || mapPan.x !== 0 || mapPan.y !== 0) && (
        <button
          onClick={resetMapView}
          style={{
            position: 'absolute',
            bottom: 54,
            right: 16,
            zIndex: 20,
            padding: '5px 11px',
            background: 'rgba(18,19,26,0.82)',
            color: '#8a9ab8',
            border: '1px solid #2a3a4a',
            borderRadius: 6,
            cursor: 'pointer',
            fontFamily: 'ui-monospace, monospace',
            fontSize: 11,
            userSelect: 'none',
            backdropFilter: 'blur(4px)',
          }}
        >
          {Math.round(mapZoom * 100)}% ↺
        </button>
      )}

      {svgW > 0 && (
        <div style={{ transform: `translate(${mapPan.x}px,${mapPan.y}px) scale(${mapZoom})`, transformOrigin: 'center' }}>
        <div
          style={{
            width: svgW,
            height: svgH,
            background: '#faf8f0',
            boxShadow: '0 4px 32px rgba(0,0,0,0.5)',
            position: 'relative',
            flexShrink: 0,
          }}
        >
          {/* MapLibre overlay */}
          {overlayHeld && (
            <div
              ref={mapContainerRef}
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 0,
                overflow: 'hidden',
              }}
            />
          )}

          <svg
            width={svgW}
            height={svgH}
            style={{ display: 'block', position: 'relative', zIndex: 1 }}
          >
            <defs>
              <clipPath id="paper-clip">
                <rect x={0} y={0} width={svgW} height={svgH} />
              </clipPath>
              {/* Hachure patterns — dark stroke so they're visible on any terrain colour */}
              <pattern id="hachure_light" x="0" y="0" width="8" height="6" patternUnits="userSpaceOnUse">
                <line x1="0" y1="3" x2="8" y2="0" stroke="#1a1a0a" strokeWidth="0.6" />
              </pattern>
              <pattern id="hachure_dense" x="0" y="0" width="6" height="5" patternUnits="userSpaceOnUse">
                <line x1="0" y1="2.5" x2="6" y2="0" stroke="#1a1a0a" strokeWidth="0.8" />
                <line x1="0" y1="5" x2="6" y2="2.5" stroke="#1a1a0a" strokeWidth="0.5" />
              </pattern>
              {urbanHexStyle === 'modern' && generatedHexes
                .filter(h => h.terrain === 'urban')
                .map(hex => (
                  <clipPath key={`urban-clip-${hex.q}-${hex.r}`} id={`urban-clip-${hex.q}-${hex.r}`}>
                    <path d={hexPath(hex)} />
                  </clipPath>
                ))
              }
              {woodsHexStyle !== 'default' && svgW > 0 && (
                <mask id="woods-combined-mask" maskUnits="userSpaceOnUse" x={0} y={0} width={svgW} height={svgH}>
                  {generatedHexes.filter(h => h.terrain === 'woods').map(hex => (
                    <path key={`wm-${hex.q}-${hex.r}`} d={hexPath(hex)} fill="white"
                      filter={terrainDisplacement > 0 ? 'url(#terrain-organic)' : undefined} />
                  ))}
                </mask>
              )}
              {terrainDisplacement > 0 && (
                <filter id="terrain-organic" x="-8%" y="-8%" width="116%" height="116%">
                  <feTurbulence
                    type="fractalNoise"
                    baseFrequency={terrainNoiseFrequency * 0.001}
                    numOctaves={terrainNoiseOctaves}
                    seed={terrainNoiseSeed}
                    result="noise"
                  />
                  <feDisplacementMap
                    in="SourceGraphic"
                    in2="noise"
                    scale={terrainDisplacement}
                    xChannelSelector="R"
                    yChannelSelector="G"
                  />
                </filter>
              )}
              {illustratedStyle && generatedHexes.map((hex) =>
                TILE_MAP[hex.terrain] ? (
                  <clipPath key={`clip-${hex.q}-${hex.r}`} id={`hex-clip-${hex.q}-${hex.r}`}>
                    <path d={hexPath(hex)} />
                  </clipPath>
                ) : null
              )}
            </defs>

            {/* Paper background — hidden when overlay is on */}
            {!overlayHeld && (
              <rect x={0} y={0} width={svgW} height={svgH} fill="#faf8f0" />
            )}

            {/* Terrain fills */}
            {illustratedStyle ? (
              <g clipPath="url(#paper-clip)">
                {generatedHexes.map((hex) => {
                  const tileUrl = TILE_MAP[hex.terrain]
                  const d = hexPath(hex)
                  if (!tileUrl) {
                    return (
                      <path
                        key={`fill-${hex.q}-${hex.r}`}
                        d={d}
                        fill={TERRAIN_COLORS[hex.terrain] ?? '#ede8d5'}
                        fillOpacity={terrainOpacity}
                        stroke="none"
                      />
                    )
                  }
                  const svgVerts = hex.vertices.map(([lon, lat]) => toSVG(lon as number, lat as number))
                  const xs = svgVerts.map(([x]) => x)
                  const ys = svgVerts.map(([, y]) => y)
                  const minX = Math.min(...xs), maxX = Math.max(...xs)
                  const minY = Math.min(...ys), maxY = Math.max(...ys)
                  const size = Math.max(maxX - minX, maxY - minY)
                  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
                  return (
                    <image
                      key={`tile-${hex.q}-${hex.r}`}
                      href={tileUrl}
                      x={cx - size / 2}
                      y={cy - size / 2}
                      width={size}
                      height={size}
                      clipPath={`url(#hex-clip-${hex.q}-${hex.r})`}
                      preserveAspectRatio="xMidYMid meet"
                    />
                  )
                })}
              </g>
            ) : (
              <>
                {/* Terrain fills — displacement applies to hex shapes/edges only; urban excluded (always sharp) */}
                <g clipPath="url(#paper-clip)" filter={terrainDisplacement > 0 ? 'url(#terrain-organic)' : undefined}>
                  {generatedHexes.map((hex) => {
                    if (hex.terrain === 'urban') return null
                    const d = hexPath(hex)
                    const fill = hex.terrain === 'woods' && woodsHexStyle === 'modern' ? '#2d5030'
                      : hex.terrain === 'woods' && woodsHexStyle === 'xix' ? '#e8ddb8'
                      : (TERRAIN_COLORS[hex.terrain] ?? '#ede8d5')
                    return <path key={`fill-${hex.q}-${hex.r}`} d={d} fill={fill} fillOpacity={terrainOpacity} stroke="none" />
                  })}
                </g>
                {/* Urban fills — always sharp, never displaced */}
                <g clipPath="url(#paper-clip)">
                  {generatedHexes.map((hex) => {
                    if (hex.terrain !== 'urban') return null
                    const d = hexPath(hex)
                    const fill = urbanHexStyle === 'modern' ? '#b0aca6' : (TERRAIN_COLORS.urban ?? '#b8a898')
                    return <path key={`urban-fill-${hex.q}-${hex.r}`} d={d} fill={fill} fillOpacity={terrainOpacity} stroke="none" />
                  })}
                </g>

                {/* Symbol overlay — outside displacement filter so symbols stay crisp */}
                {/* Urban symbol overlay — per-hex buildings, crisp */}
                {urbanHexStyle === 'modern' && (
                  <g clipPath="url(#paper-clip)" opacity={terrainOpacity}>
                    {generatedHexes.filter(h => h.terrain === 'urban').map((hex) => {
                      const [cx, cy] = toSVG(hex.center[0], hex.center[1])
                      const v0 = hex.vertices[0] as [number, number]
                      const [vx, vy] = toSVG(v0[0], v0[1])
                      const r = Math.sqrt((vx - cx) ** 2 + (vy - cy) ** 2)
                      const rng = seededRng(hex.q * 31337 + hex.r)
                      const count = 8 + Math.floor(rng() * 7)
                      const buildings = Array.from({ length: count }, () => {
                        const angle = rng() * Math.PI * 2
                        const dist = rng() * r * 0.62
                        const bw = r * (0.08 + rng() * 0.14)
                        const bh = r * (0.08 + rng() * 0.14)
                        const rot = (rng() - 0.5) * 70
                        return { x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist, w: bw, h: bh, rot }
                      })
                      return (
                        <g key={`sym-${hex.q}-${hex.r}`} clipPath={`url(#urban-clip-${hex.q}-${hex.r})`}>
                          {buildings.map((b, j) => (
                            <rect key={j} x={b.x - b.w / 2} y={b.y - b.h / 2} width={b.w} height={b.h}
                              fill="#787470" transform={`rotate(${b.rot},${b.x},${b.y})`} />
                          ))}
                        </g>
                      )
                    })}
                  </g>
                )}

                {/* Woods symbol overlay — single field across all woods hexes, masked to combined area */}
                {woodsHexStyle !== 'default' && svgW > 0 && (() => {
                  const woodsHexes = generatedHexes.filter(h => h.terrain === 'woods')
                  if (woodsHexes.length === 0) return null
                  const [cx0, cy0] = toSVG(woodsHexes[0].center[0], woodsHexes[0].center[1])
                  const v0 = woodsHexes[0].vertices[0] as [number, number]
                  const [vx0, vy0] = toSVG(v0[0], v0[1])
                  const r = Math.sqrt((vx0 - cx0) ** 2 + (vy0 - cy0) ** 2)
                  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
                  for (const hex of woodsHexes) {
                    const [cx, cy] = toSVG(hex.center[0], hex.center[1])
                    minX = Math.min(minX, cx - r); minY = Math.min(minY, cy - r)
                    maxX = Math.max(maxX, cx + r); maxY = Math.max(maxY, cy + r)
                  }
                  const seed = woodsHexes.reduce((acc, h) => acc + h.q * 31337 + h.r * 7919, 50000)
                  const rng = seededRng(seed)

                  if (woodsHexStyle === 'modern') {
                    const spacing = r * 0.18
                    const canopies: { x: number; y: number; cr: number }[] = []
                    let row = 0
                    for (let y = minY - r; y <= maxY + r; y += spacing * 0.866, row++) {
                      for (let x = minX - r + (row % 2 === 1 ? spacing / 2 : 0); x <= maxX + r; x += spacing) {
                        canopies.push({ x: x + (rng() - 0.5) * spacing * 0.5, y: y + (rng() - 0.5) * spacing * 0.5, cr: r * (0.07 + rng() * 0.06) })
                      }
                    }
                    return (
                      <g key="woods-modern-sym" mask="url(#woods-combined-mask)" opacity={terrainOpacity}>
                        {canopies.map((c, j) => <circle key={j} cx={c.x} cy={c.y} r={c.cr} fill="#4a7a50" />)}
                      </g>
                    )
                  }

                  // xix century
                  const spacing = r * 0.28
                  const trunkH = r * 0.09
                  const canopyR = r * 0.058
                  const sw = r * 0.013
                  const trees: { x: number; y: number }[] = []
                  let row = 0
                  for (let y = minY - r; y <= maxY + r; y += spacing * 0.866, row++) {
                    for (let x = minX - r + (row % 2 === 1 ? spacing / 2 : 0); x <= maxX + r; x += spacing) {
                      trees.push({ x: x + (rng() - 0.5) * spacing * 0.28, y: y + (rng() - 0.5) * spacing * 0.28 })
                    }
                  }
                  return (
                    <g key="woods-xix-sym" mask="url(#woods-combined-mask)" opacity={terrainOpacity}>
                      {trees.map((t, j) => (
                        <g key={j}>
                          <line x1={t.x} y1={t.y} x2={t.x} y2={t.y - trunkH} stroke="#4a6030" strokeWidth={sw} />
                          <circle cx={t.x} cy={t.y - trunkH} r={canopyR} fill="none" stroke="#4a6030" strokeWidth={sw} />
                        </g>
                      ))}
                    </g>
                  )
                })()}
              </>
            )}

            {/* Elevation heatmap — absolute elevation */}
            {showElevHeatmap && elevationStatus === 'done' && (() => {
              const vals = generatedHexes.map((h) => h.elevation_m).filter((v): v is number => v !== null && v !== undefined)
              if (vals.length === 0) return null
              const min = Math.min(...vals), max = Math.max(...vals)
              return (
                <g clipPath="url(#paper-clip)" style={{ pointerEvents: 'none' }}>
                  {generatedHexes.map((hex) => {
                    if (hex.elevation_m === null || hex.elevation_m === undefined) return null
                    return (
                      <path key={`eheat-${hex.q}-${hex.r}`} d={hexPath(hex)}
                        fill={elevHeatColor(hex.elevation_m, min, max)} fillOpacity={0.75} stroke="none" />
                    )
                  })}
                </g>
              )
            })()}

            {/* Relief heatmap — local relief */}
            {showReliefHeatmap && elevationStatus === 'done' && (() => {
              const vals = generatedHexes.map((h) => h.elevation_relief_m).filter((v): v is number => v !== null && v !== undefined)
              if (vals.length === 0) return null
              const min = 0, max = Math.max(...vals)
              return (
                <g clipPath="url(#paper-clip)" style={{ pointerEvents: 'none' }}>
                  {generatedHexes.map((hex) => {
                    if (hex.elevation_relief_m === null || hex.elevation_relief_m === undefined) return null
                    return (
                      <path key={`rheat-${hex.q}-${hex.r}`} d={hexPath(hex)}
                        fill={elevHeatColor(hex.elevation_relief_m, min, max)} fillOpacity={0.75} stroke="none" />
                    )
                  })}
                </g>
              )
            })()}

            {/* Elevation labels — shown when either heatmap is active */}
            {(showElevHeatmap || showReliefHeatmap) && elevationStatus === 'done' && (
              <g clipPath="url(#paper-clip)" style={{ pointerEvents: 'none' }}>
                {generatedHexes.map((hex) => {
                  const val = showElevHeatmap ? hex.elevation_m : hex.elevation_relief_m
                  if (val === null || val === undefined) return null
                  const [cx, cy] = toSVG(hex.center[0], hex.center[1])
                  const label = Math.round(val) + 'm'
                  return (
                    <text key={`elabel-${hex.q}-${hex.r}`}
                      x={cx} y={cy + 2}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize={6} fontFamily="ui-monospace, monospace"
                      fill="rgba(0,0,0,0.75)"
                      stroke="rgba(255,255,255,0.6)" strokeWidth={2} paintOrder="stroke"
                    >
                      {label}
                    </text>
                  )
                })}
              </g>
            )}

            {/* Hachure elevation overlay — hills and mountains */}
            {elevationStyle === 'hachure' && !showElevHeatmap && !showReliefHeatmap && elevationStatus === 'done' && (
              <g clipPath="url(#paper-clip)" style={{ pointerEvents: 'none' }}>
                {generatedHexes.map((hex) => {
                  if (!hex.elevation_class || hex.elevation_class === 'flat') return null
                  const patternId = hex.elevation_class === 'mountains' ? 'hachure_dense' : 'hachure_light'
                  const opacity = hex.elevation_class === 'mountains' ? 0.55 : 0.38
                  return (
                    <path key={`elev-${hex.q}-${hex.r}`} d={hexPath(hex)}
                      fill={`url(#${patternId})`} fillOpacity={opacity} stroke="none" />
                  )
                })}
              </g>
            )}

            {/* Contour lines — traditional cartographic style */}
            {elevationStyle === 'contour' && !showElevHeatmap && !showReliefHeatmap && elevationStatus === 'done' && (() => {
              const toD = (chain: [number, number][]) =>
                chain.map(([lon, lat]) => toSVG(lon, lat))
                  .map((p, j) => `${j === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')
              return (
                <g clipPath="url(#paper-clip)" style={{ pointerEvents: 'none' }}>
                  {contourData.levels.map(({ level, isMajor, chains }) =>
                    chains.map((chain, ci) => (
                      <path key={`c-${level}-${ci}`} d={toD(chain)} fill="none"
                        stroke={isMajor ? 'rgba(95,65,25,0.80)' : 'rgba(115,82,38,0.50)'}
                        strokeWidth={isMajor ? 1.2 : 0.65}
                        strokeLinecap="round" strokeLinejoin="round" />
                    ))
                  )}
                </g>
              )
            })()}

            {/* Rivers — raw OSM geometry or smoothed preview */}
            {(riversDisplayMode === 'raw' || riversDisplayMode === 'smoothed') && (
              <g clipPath="url(#paper-clip)">
                {riverFeatures.filter((r) => r.included).map((river: RiverFeature, ri) => {
                  const base = riversDisplayMode === 'smoothed' ? river.smoothedCoords : river.coords
                  const d = buildRiverPath(base, riverMeanderSeed + ri)
                  if (!d) return null
                  return (
                    <g key={ri} style={{ pointerEvents: 'none' }}>
                      <path d={d} fill="none" stroke="#a8d8f0" strokeWidth={4.5 * riverWidthScale} strokeLinecap="round" strokeLinejoin="round" />
                      <path d={d} fill="none" stroke="#4a88c0" strokeWidth={2.2 * riverWidthScale} strokeLinecap="round" strokeLinejoin="round" />
                    </g>
                  )
                })}
              </g>
            )}

            {/* Rivers — chains through hex-edge midpoints */}
            {riversDisplayMode === 'edges' && (
              <g clipPath="url(#paper-clip)">
                {riverChains.map((chain, ci) => {
                  const d = buildRiverPath(chain, riverMeanderSeed + ci)
                  if (!d) return null
                  return (
                    <g key={ci} style={{ pointerEvents: 'none' }}>
                      <path d={d} fill="none" stroke="#a8d8f0" strokeWidth={5.5 * riverWidthScale} strokeLinecap="round" strokeLinejoin="round" />
                      <path d={d} fill="none" stroke="#4a88c0" strokeWidth={2.8 * riverWidthScale} strokeLinecap="round" strokeLinejoin="round" />
                    </g>
                  )
                })}
              </g>
            )}

            {/* Road lines */}
            <g clipPath="url(#paper-clip)">
              {roadsDisplayMode === 'raw' && (
                [...rawRoadWays]
                  .sort((a, b) => (HIGHWAY_TO_TIER[b.highway] ?? 2) - (HIGHWAY_TO_TIER[a.highway] ?? 2))
                  .filter((w) => roadsVisibleTiers[HIGHWAY_TO_TIER[w.highway] ?? 2])
                  .map((way, i) => {
                    const s = roadTierStyles[HIGHWAY_TO_TIER[way.highway] ?? 2]
                    const pts = way.coords.map(([lon, lat]) => toSVG(lon, lat))
                    if (pts.length < 2) return null
                    const d = pts.map((p, j) => `${j === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')
                    return (
                      <g key={i} style={{ pointerEvents: 'none' }}>
                        <path d={d} fill="none" stroke={s.outer} strokeWidth={s.outerW} strokeLinecap="round" strokeLinejoin="round" />
                        <path d={d} fill="none" stroke={s.inner} strokeWidth={s.outerW * 0.5} strokeLinecap="round" strokeLinejoin="round" />
                      </g>
                    )
                  })
              )}

              {roadsDisplayMode === 'per_hex' && (() => {
                const { chains, junctions } = smoothedRoadData
                const toD = (chain: [number, number][]) => {
                  const pts = chain.map(([lon, lat]) => toSVG(lon, lat))
                  return pts.map((p, j) => `${j === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')
                }
                return (
                  <>
                    {/* Outer casings — tier 2 first so tier 0 draws on top */}
                    {TIER_RENDER_ORDER.flatMap((tier) =>
                      chains.filter((c) => c.tier === tier).map(({ tier: t, chain }, i) => {
                        const s = roadTierStyles[t]
                        return <path key={`outer-${tier}-${i}`} d={toD(chain)} fill="none"
                          stroke={s.outer} strokeWidth={s.outerW} strokeLinecap="round" strokeLinejoin="round"
                          style={{ pointerEvents: 'none' }} />
                      })
                    )}
                    {/* Junction outer discs */}
                    {junctions.map(({ pos, tier }, i) => {
                      const [x, y] = toSVG(pos[0], pos[1])
                      const s = roadTierStyles[tier]
                      return <circle key={`jout-${i}`} cx={x} cy={y} r={s.outerW / 2}
                        fill={s.outer} style={{ pointerEvents: 'none' }} />
                    })}
                    {/* Inner strokes */}
                    {TIER_RENDER_ORDER.flatMap((tier) =>
                      chains.filter((c) => c.tier === tier).map(({ tier: t, chain }, i) => {
                        const s = roadTierStyles[t]
                        return <path key={`inner-${tier}-${i}`} d={toD(chain)} fill="none"
                          stroke={s.inner} strokeWidth={s.outerW * 0.5} strokeLinecap="round" strokeLinejoin="round"
                          style={{ pointerEvents: 'none' }} />
                      })
                    )}
                    {/* Junction inner discs */}
                    {junctions.map(({ pos, tier }, i) => {
                      const [x, y] = toSVG(pos[0], pos[1])
                      const s = roadTierStyles[tier]
                      return <circle key={`jin-${i}`} cx={x} cy={y} r={s.outerW * 0.25}
                        fill={s.inner} style={{ pointerEvents: 'none' }} />
                    })}
                  </>
                )
              })()}
            </g>

            {/* Rail lines — offset only when sharing a hex-pair with a road; endpoints kept fixed so junctions stay clean */}
            <g clipPath="url(#paper-clip)">
              {railsDisplayMode === 'raw' && rawRailWays.map((way, i) => {
                const pts = way.coords.map(([lon, lat]) => toSVG(lon, lat))
                if (pts.length < 2) return null
                const d = pts.map((p, j) => `${j === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')
                return (
                  <g key={i} style={{ pointerEvents: 'none' }}>
                    <path d={d} fill="none" stroke="#1a1a1a" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                    <path d={d} fill="none" stroke="#ffffff" strokeWidth={1.2} strokeLinecap="butt" strokeLinejoin="round" strokeDasharray="7 7" />
                  </g>
                )
              })}
              {railsDisplayMode === 'per_hex' && smoothedRailChains.map(({ chain, isShared }, i) => {
                const svgPts = chain.map(([lon, lat]) => toSVG(lon, lat))
                let pts = svgPts
                if (isShared && svgPts.length >= 2) {
                  // 5px offset, tapering to 0 at both endpoints over ~8 catmullRom points
                  // so sub-chain boundaries (junctions / shared-unshared transitions) connect cleanly
                  const OFFSET = 5, TAPER = 8
                  const full = offsetPolyline(svgPts, OFFSET)
                  pts = svgPts.map((p, idx) => {
                    const factor = Math.min(1, idx / TAPER, (svgPts.length - 1 - idx) / TAPER)
                    return [p[0] + (full[idx][0] - p[0]) * factor, p[1] + (full[idx][1] - p[1]) * factor] as [number, number]
                  })
                }
                const d = pts.map((p, j) => `${j === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')
                return (
                  <g key={i} style={{ pointerEvents: 'none' }}>
                    <path d={d} fill="none" stroke="#1a1a1a" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                    <path d={d} fill="none" stroke="#ffffff" strokeWidth={1.2} strokeLinecap="butt" strokeLinejoin="round" strokeDasharray="7 7" />
                  </g>
                )
              })}
            </g>

            {/* Hovered river highlight — shows preview regardless of include/exclude state */}
            {hoveredRiverIndex !== null && riverFeatures[hoveredRiverIndex] && (() => {
              const river = riverFeatures[hoveredRiverIndex]
              const base = river.smoothedCoords.length >= 2 ? river.smoothedCoords : river.coords
              const d = buildRiverPath(base, riverMeanderSeed + hoveredRiverIndex)
              if (!d) return null
              return (
                <g clipPath="url(#paper-clip)" style={{ pointerEvents: 'none' }}>
                  <path d={d} fill="none" stroke="#ffffff" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={0.25} />
                  <path d={d} fill="none" stroke="#88ccff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={river.included ? 1 : 0.5} strokeDasharray={river.included ? undefined : '6,4'} />
                </g>
              )
            })()}

            {/* Urban cluster boundary */}
            {urbanBoundaryEdges.length > 0 && (
              <g clipPath="url(#paper-clip)" style={{ pointerEvents: 'none' }}>
                {urbanBoundaryEdges.map(({ v0, v1 }, i) => {
                  const [x0, y0] = toSVG(v0[0], v0[1])
                  const [x1, y1] = toSVG(v1[0], v1[1])
                  return (
                    <line
                      key={i}
                      x1={x0.toFixed(2)} y1={y0.toFixed(2)}
                      x2={x1.toFixed(2)} y2={y1.toFixed(2)}
                      stroke="#3a2e24"
                      strokeWidth={2.2}
                      strokeLinecap="square"
                      strokeOpacity={0.85}
                    />
                  )
                })}
              </g>
            )}

            {/* Hex outlines */}
            <g clipPath="url(#paper-clip)">
              {/* Vertex Y-marker mode — three-armed marks at each hex vertex */}
              {hexBorderMode === 'dots' && generatedHexes.map((hex) => {
                const verts = hex.vertices as [number, number][]
                const n = verts.length
                return verts.map((v, vi) => {
                  const vNext = verts[(vi + 1) % n]
                  const [vx, vy] = toSVG(v[0], v[1])
                  const [nx, ny] = toSVG(vNext[0], vNext[1])
                  const ARM = 0.3
                  const x2 = vx + (nx - vx) * ARM
                  const y2 = vy + (ny - vy) * ARM
                  return <line key={`ym-${hex.q}-${hex.r}-${vi}`}
                    x1={vx.toFixed(2)} y1={vy.toFixed(2)}
                    x2={x2.toFixed(2)} y2={y2.toFixed(2)}
                    stroke="rgba(60,50,40,0.45)" strokeWidth={0.7} strokeLinecap="round"
                    style={{ pointerEvents: 'none' }} />
                })
              })}
              {generatedHexes.map((hex) => {
                const d = hexPath(hex)
                const isSelected = selectedHex?.q === hex.q && selectedHex?.r === hex.r
                const anyPaintMode = terrainPaintMode || elevationPaintMode || roadPaintMode || railPaintMode
                const showStroke = isSelected || hexBorderMode === 'full'
                return (
                  <path
                    key={`outline-${hex.q}-${hex.r}`}
                    d={d}
                    fill={anyPaintMode || settlementEditMode ? 'transparent' : 'none'}
                    stroke={isSelected ? '#e04020' : (illustratedStyle || !showStroke) ? 'none' : 'rgba(60,50,40,0.35)'}
                    strokeWidth={isSelected ? 2 : illustratedStyle ? 0 : 0.7}
                    style={{ cursor: riverEditMode ? 'default' : anyPaintMode ? 'crosshair' : settlementEditMode ? 'cell' : 'pointer' }}
                    onClick={() => {
                      if (riverEditMode || anyPaintMode) return
                      if (settlementEditMode) {
                        if (settlementMoveIndex !== null) {
                          updateSettlement(settlementMoveIndex, { hex_q: hex.q, hex_r: hex.r })
                          setSettlementMoveIndex(null)
                          setSettlementEditMode(false)
                        } else {
                          setSettlementPlaceTarget({ q: hex.q, r: hex.r, vertices: hex.vertices as [number, number][] })
                        }
                        return
                      }
                      setSelectedHex(isSelected ? null : hex)
                    }}
                    onMouseDown={(e) => {
                      if (!anyPaintMode) return
                      e.preventDefault()
                      pushUndoSnapshot()
                      isPaintingRef.current = true
                      if (terrainPaintMode) {
                        overrideHexTerrain(hex.q, hex.r, terrainPaintBrush)
                      } else if (elevationPaintMode) {
                        overrideHexElevation(hex.q, hex.r, elevationPaintBrush)
                      } else if (roadPaintMode) {
                        if (roadPaintEraser) {
                          removeAllRoadHexEdges(hex.q, hex.r)
                          roadPaintActionRef.current = 'remove'
                        } else {
                          roadPaintActionRef.current = 'add'
                          lastRoadPaintHexRef.current = { q: hex.q, r: hex.r }
                        }
                      } else if (railPaintMode) {
                        if (railPaintEraser) {
                          removeRailHexEdges(hex.q, hex.r)
                          railPaintActionRef.current = 'remove'
                        } else {
                          railPaintActionRef.current = 'add'
                          lastRailPaintHexRef.current = { q: hex.q, r: hex.r }
                        }
                      }
                    }}
                    onMouseEnter={() => {
                      if (!anyPaintMode || !isPaintingRef.current) return
                      if (terrainPaintMode) {
                        overrideHexTerrain(hex.q, hex.r, terrainPaintBrush)
                      } else if (elevationPaintMode) {
                        overrideHexElevation(hex.q, hex.r, elevationPaintBrush)
                      } else if (roadPaintMode) {
                        if (roadPaintActionRef.current === 'add') {
                          const last = lastRoadPaintHexRef.current
                          if (last && !(last.q === hex.q && last.r === hex.r)) {
                            const dq = hex.q - last.q, dr = hex.r - last.r
                            const isAdj = Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr) === 2
                            if (isAdj) addRoadEdge(last.q, last.r, hex.q, hex.r, roadPaintBrush)
                          }
                          lastRoadPaintHexRef.current = { q: hex.q, r: hex.r }
                        } else if (roadPaintActionRef.current === 'remove') {
                          removeAllRoadHexEdges(hex.q, hex.r)
                        }
                      } else if (railPaintMode) {
                        if (railPaintActionRef.current === 'add') {
                          const last = lastRailPaintHexRef.current
                          if (last && !(last.q === hex.q && last.r === hex.r)) {
                            const dq = hex.q - last.q, dr = hex.r - last.r
                            const isAdj = Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr) === 2
                            if (isAdj) addRailEdge(last.q, last.r, hex.q, hex.r)
                          }
                          lastRailPaintHexRef.current = { q: hex.q, r: hex.r }
                        } else if (railPaintActionRef.current === 'remove') {
                          removeRailHexEdges(hex.q, hex.r)
                        }
                      }
                    }}
                  />
                )
              })}
            </g>

            {/* Override indicators */}
            <g clipPath="url(#paper-clip)">
              {generatedHexes
                .filter((hex) => hex.manual_override)
                .map((hex) => {
                  const [x, y] = hexIndicatorPos(hex)
                  return (
                    <circle
                      key={`override-${hex.q}-${hex.r}`}
                      cx={x}
                      cy={y}
                      r={3}
                      fill="#e09040"
                      stroke="rgba(0,0,0,0.3)"
                      strokeWidth={0.5}
                      style={{ pointerEvents: 'none' }}
                    />
                  )
                })}
            </g>

            {/* Settlement dots and labels */}
            <g clipPath="url(#paper-clip)">
              {settlements
                .filter((s) => s.included && s.hex_q !== null)
                .map((s, i) => {
                  const hex = hexIndex.get(`${s.hex_q},${s.hex_r}`)
                  const [cx, cy] = hex ? toSVG(hex.center[0], hex.center[1]) : toSVG(s.lon, s.lat)
                  const r = s.type === 'city' ? 5 : s.type === 'town' ? 3.5 : 2.5
                  const color = s.type === 'city' ? '#cc3333' : '#222222'
                  return (
                    <g key={i} style={{ pointerEvents: 'none' }}>
                      <circle cx={cx} cy={cy} r={r} fill={color} stroke="white" strokeWidth={0.8} />
                      <text
                        x={cx}
                        y={cy + r + 6}
                        textAnchor="middle"
                        fontSize={s.type === 'city' ? 7 : 5.5}
                        fill="#111"
                        fontFamily="Arial, sans-serif"
                        style={{ pointerEvents: 'none' }}
                      >
                        {s.name}
                      </text>
                    </g>
                  )
                })}
            </g>

            {/* Margin guide */}
            {marginPx > 0 && (
              <rect
                x={marginPx}
                y={marginPx}
                width={svgW - 2 * marginPx}
                height={svgH - 2 * marginPx}
                fill="none"
                stroke="rgba(220, 100, 0, 0.45)"
                strokeWidth={1}
                strokeDasharray="5,4"
              />
            )}

            {/* River edge edit overlay — topmost, intercepts all clicks */}
            {riverEditMode && (
              <g clipPath="url(#paper-clip)">
                {interiorEdges.map(({ ek, v0, v1, q1, r1, q2, r2 }) => {
                  const [x0, y0] = toSVG(v0[0], v0[1])
                  const [x1, y1] = toSVG(v1[0], v1[1])
                  const key = riverEdgeCanonicalKey(q1, r1, q2, r2)
                  const hasRiver = riverEdgeKeySet.has(key)
                  const isHov = hoveredEdgeKey === ek
                  const d = `M${x0.toFixed(2)},${y0.toFixed(2)}L${x1.toFixed(2)},${y1.toFixed(2)}`
                  // visible stroke: blue if has river, very faint otherwise; hover = action colour
                  const visStroke = isHov
                    ? (hasRiver ? '#ff5555' : '#55ee88')
                    : hasRiver
                      ? 'rgba(74,136,192,0.7)'
                      : 'rgba(100,140,200,0.13)'
                  const visW = isHov ? 3 : hasRiver ? 2.2 : 1
                  return (
                    <g
                      key={ek}
                      style={{ cursor: 'crosshair' }}
                      onMouseEnter={() => setHoveredEdgeKey(ek)}
                      onMouseLeave={() => setHoveredEdgeKey(null)}
                      onClick={() => toggleManualRiverEdge(q1, r1, q2, r2)}
                    >
                      {/* Wide transparent hit area */}
                      <path d={d} stroke="transparent" strokeWidth={10} fill="none" />
                      {/* Visible line */}
                      <path d={d} stroke={visStroke} strokeWidth={visW} strokeLinecap="round" fill="none" />
                    </g>
                  )
                })}
              </g>
            )}
          </svg>
        </div>
        </div>
      )}
    </div>
  )
}
