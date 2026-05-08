import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import maplibregl from 'maplibre-gl'
import { useMapStore, TERRAIN_COLORS, riverEdgeCanonicalKey, type GridMetadata, type GeneratedHex, type RiverFeature } from '../store/mapStore'

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

const ROAD_STYLES: Record<string, { outer: string; inner: string; outerW: number; innerW: number }> = {
  motorway:  { outer: '#ffd0a0', inner: '#c05818', outerW: 5.0, innerW: 2.5 },
  trunk:     { outer: '#ffe8a8', inner: '#b07820', outerW: 4.0, innerW: 2.0 },
  primary:   { outer: '#f5e8c0', inner: '#8a5c2a', outerW: 3.0, innerW: 1.5 },
  secondary: { outer: '#e8e8c0', inner: '#6a7040', outerW: 2.5, innerW: 1.2 },
  tertiary:  { outer: '#d8d8c0', inner: '#606060', outerW: 2.0, innerW: 1.0 },
}
const DEFAULT_ROAD_STYLE = { outer: '#d0d0c0', inner: '#606060', outerW: 2.0, innerW: 1.0 }
// Render order: lowest priority first so higher-priority roads draw on top
const HIGHWAY_RENDER_ORDER = ['tertiary', 'secondary', 'primary', 'trunk', 'motorway']

const RAIL_STYLES: Record<string, { color: string; width: number; dasharray?: string }> = {
  rail:         { color: '#6a6a8a', width: 2.5 },
  narrow_gauge: { color: '#5a7a5a', width: 2.0 },
  light_rail:   { color: '#3a7a8a', width: 1.8, dasharray: '6,3' },
}
const DEFAULT_RAIL_STYLE = { color: '#6a6a8a', width: 2.0 }
const RAIL_RENDER_ORDER = ['light_rail', 'narrow_gauge', 'rail']

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

  const { generatedHexes, generatedMetadata, selectedHex, setSelectedHex, settlements, rawRoadWays, roadEdges, roadsDisplayMode, roadsVisibleTypes, riverEdges, riverChains, riverFeatures, riversDisplayMode, hoveredRiverIndex, riverEditMode, toggleManualRiverEdge, elevationStatus, showReliefHeatmap, showElevHeatmap, terrainPaintMode, terrainPaintBrush, overrideHexTerrain, roadPaintMode, roadPaintBrush, roadPaintEraser, addRoadEdge, removeAllRoadHexEdges, railEdges, railsVisibleTypes, railPaintMode, railPaintBrush, railPaintEraser, addRailEdge, removeAllRailHexEdges, settlementEditMode, settlementMoveIndex, setSettlementPlaceTarget, setSettlementEditMode, updateSettlement, setSettlementMoveIndex, pushUndoSnapshot, terrainDisplacement, terrainNoiseFrequency, terrainNoiseSeed, terrainNoiseOctaves } = useMapStore()
  const [hoveredEdgeKey, setHoveredEdgeKey] = useState<string | null>(null)
  const isPaintingRef = useRef(false)
  const roadPaintActionRef = useRef<'add' | 'remove' | null>(null)
  const lastRoadPaintHexRef = useRef<{ q: number; r: number } | null>(null)
  const [mapZoom, setMapZoom] = useState(1)
  const [mapPan, setMapPan] = useState({ x: 0, y: 0 })
  const mapZoomRef = useRef(1)
  const mapPanRef = useRef({ x: 0, y: 0 })
  const isMapPanningRef = useRef(false)
  const mapPanStartRef = useRef({ x: 0, y: 0 })
  const mapPanOriginRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const anyPaint = terrainPaintMode || roadPaintMode || railPaintMode
    if (!anyPaint) {
      isPaintingRef.current = false
      roadPaintActionRef.current = null
      lastRoadPaintHexRef.current = null
      return
    }
    const onUp = () => {
      isPaintingRef.current = false
      roadPaintActionRef.current = null
      lastRoadPaintHexRef.current = null
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

  const hexIndex = new Map(generatedHexes.map((h) => [`${h.q},${h.r}`, h]))

  // Smooth road chains — built per highway type from edge list, Chaikin-smoothed
  const smoothedRoadChains = useMemo(() => {
    if (roadsDisplayMode !== 'per_hex' || roadEdges.length === 0) return []

    const byHighway = new Map<string, typeof roadEdges>()
    for (const e of roadEdges) {
      if (!roadsVisibleTypes.includes(e.highway)) continue
      if (!byHighway.has(e.highway)) byHighway.set(e.highway, [])
      byHighway.get(e.highway)!.push(e)
    }

    const hexIdx = new Map(generatedHexes.map((h) => [`${h.q},${h.r}`, h]))
    const result: { highway: string; chain: [number, number][] }[] = []

    // Track which highway types touch each hex — used to detect cross-type junctions
    const hexHighways = new Map<string, Set<string>>()
    for (const e of roadEdges) {
      if (!roadsVisibleTypes.includes(e.highway)) continue
      for (const k of [`${e.q1},${e.r1}`, `${e.q2},${e.r2}`]) {
        if (!hexHighways.has(k)) hexHighways.set(k, new Set())
        hexHighways.get(k)!.add(e.highway)
      }
    }
    // A hex touched by 2+ road types is a global junction — all types must stop there
    const isGlobalJunction = (k: string) => (hexHighways.get(k)?.size ?? 0) > 1

    for (const [highway, edges] of byHighway) {
      const adj = new Map<string, string[]>()
      for (const e of edges) {
        const k1 = `${e.q1},${e.r1}`, k2 = `${e.q2},${e.r2}`
        if (!adj.has(k1)) adj.set(k1, [])
        if (!adj.has(k2)) adj.set(k2, [])
        if (!adj.get(k1)!.includes(k2)) adj.get(k1)!.push(k2)
        if (!adj.get(k2)!.includes(k1)) adj.get(k2)!.push(k1)
      }

      const visitedPairs = new Set<string>()
      // Junction = degree>2 within this type, OR touches another road type
      const isJunction = (k: string) => (adj.get(k) ?? []).length > 2 || isGlobalJunction(k)

      const walk = (startKey: string): [number, number][] => {
        const h0 = hexIdx.get(startKey)
        if (!h0) return []
        const startDeg = (adj.get(startKey) ?? []).length
        const pts: [number, number][] = []
        // Anchor hex center only for endpoints (deg 1) and junctions (deg 3+)
        // — NOT for degree-2 through-hexes (they cause zigzag)
        if (startDeg !== 2) pts.push([h0.center[0], h0.center[1]])
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
            // Only the border midpoint — skip hex centers for through-hexes
            pts.push([(h1.center[0] + h2.center[0]) / 2, (h1.center[1] + h2.center[1]) / 2])
          }
          cur = next
          const curDeg = (adj.get(cur) ?? []).length
          if (curDeg === 1) {
            // Terminal endpoint — anchor its center
            const he = hexIdx.get(cur)
            if (he) pts.push([he.center[0], he.center[1]])
            break
          }
          if (isJunction(cur)) {
            // Junction — all branches from here share this center as terminal
            const hj = hexIdx.get(cur)
            if (hj) pts.push([hj.center[0], hj.center[1]])
            break
          }
          // degree-2 through-hex: keep walking, don't add its center
        }
        return pts
      }

      // Endpoints first, then junction branch starts, then any loops
      for (const [k, nbs] of adj) {
        if (nbs.length === 1) {
          const pts = walk(k)
          if (pts.length >= 2) result.push({ highway, chain: chaikinSmooth(pts, 2) })
        }
      }
      for (const [k, nbs] of adj) {
        if (isJunction(k)) {
          for (const nk of nbs) {
            const ep = k < nk ? `${k}|${nk}` : `${nk}|${k}`
            if (!visitedPairs.has(ep)) {
              const pts = walk(k)
              if (pts.length >= 2) result.push({ highway, chain: chaikinSmooth(pts, 2) })
            }
          }
        }
      }
      for (const [k, nbs] of adj) {
        for (const nk of nbs) {
          const ep = k < nk ? `${k}|${nk}` : `${nk}|${k}`
          if (!visitedPairs.has(ep)) {
            const pts = walk(k)
            if (pts.length >= 2) result.push({ highway, chain: chaikinSmooth(pts, 2) })
          }
        }
      }
    }
    return result
  }, [roadsDisplayMode, roadEdges, roadsVisibleTypes, generatedHexes])

  // Smooth rail chains — same algorithm as roads but for rail edges
  const smoothedRailChains = useMemo(() => {
    if (railEdges.length === 0) return []

    const byType = new Map<string, typeof railEdges>()
    for (const e of railEdges) {
      if (!railsVisibleTypes.includes(e.rail_type)) continue
      if (!byType.has(e.rail_type)) byType.set(e.rail_type, [])
      byType.get(e.rail_type)!.push(e)
    }

    const hexIdx = new Map(generatedHexes.map((h) => [`${h.q},${h.r}`, h]))
    const result: { rail_type: string; chain: [number, number][] }[] = []

    for (const [rail_type, edges] of byType) {
      const adj = new Map<string, string[]>()
      for (const e of edges) {
        const k1 = `${e.q1},${e.r1}`, k2 = `${e.q2},${e.r2}`
        if (!adj.has(k1)) adj.set(k1, [])
        if (!adj.has(k2)) adj.set(k2, [])
        if (!adj.get(k1)!.includes(k2)) adj.get(k1)!.push(k2)
        if (!adj.get(k2)!.includes(k1)) adj.get(k2)!.push(k1)
      }

      const visitedPairs = new Set<string>()
      const isJunction = (k: string) => (adj.get(k) ?? []).length > 2

      const walk = (startKey: string): [number, number][] => {
        const h0 = hexIdx.get(startKey)
        if (!h0) return []
        const startDeg = (adj.get(startKey) ?? []).length
        const pts: [number, number][] = []
        if (startDeg !== 2) pts.push([h0.center[0], h0.center[1]])
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
          }
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
          if (pts.length >= 2) result.push({ rail_type, chain: chaikinSmooth(pts, 2) })
        }
      }
      for (const [k, nbs] of adj) {
        if (isJunction(k)) {
          for (const nk of nbs) {
            const ep = k < nk ? `${k}|${nk}` : `${nk}|${k}`
            if (!visitedPairs.has(ep)) {
              const pts = walk(k)
              if (pts.length >= 2) result.push({ rail_type, chain: chaikinSmooth(pts, 2) })
            }
          }
        }
      }
      for (const [k, nbs] of adj) {
        for (const nk of nbs) {
          const ep = k < nk ? `${k}|${nk}` : `${nk}|${k}`
          if (!visitedPairs.has(ep)) {
            const pts = walk(k)
            if (pts.length >= 2) result.push({ rail_type, chain: chaikinSmooth(pts, 2) })
          }
        }
      }
    }
    return result
  }, [railEdges, railsVisibleTypes, generatedHexes])


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
            </defs>

            {/* Paper background — hidden when overlay is on */}
            {!overlayHeld && (
              <rect x={0} y={0} width={svgW} height={svgH} fill="#faf8f0" />
            )}

            {/* Terrain fills */}
            <g clipPath="url(#paper-clip)" filter={terrainDisplacement > 0 ? 'url(#terrain-organic)' : undefined}>
              {generatedHexes.map((hex) => {
                const d = hexPath(hex)
                const fill = TERRAIN_COLORS[hex.terrain] ?? '#ede8d5'
                return (
                  <path
                    key={`fill-${hex.q}-${hex.r}`}
                    d={d}
                    fill={fill}
                    fillOpacity={terrainOpacity}
                    stroke="none"
                  />
                )
              })}
            </g>

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

            {/* Hachure elevation overlay — hills and mountains */}
            {!showElevHeatmap && !showReliefHeatmap && elevationStatus === 'done' && (
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

            {/* Rivers — raw OSM geometry or smoothed preview */}
            {(riversDisplayMode === 'raw' || riversDisplayMode === 'smoothed') && (
              <g clipPath="url(#paper-clip)">
                {riverFeatures.filter((r) => r.included).map((river: RiverFeature, ri) => {
                  const coords = riversDisplayMode === 'smoothed' ? river.smoothedCoords : river.coords
                  if (coords.length < 2) return null
                  const d = coords
                    .map(([lon, lat], i) => {
                      const [x, y] = toSVG(lon, lat)
                      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
                    })
                    .join(' ')
                  return (
                    <g key={ri} style={{ pointerEvents: 'none' }}>
                      <path d={d} fill="none" stroke="#a8d8f0" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
                      <path d={d} fill="none" stroke="#4a88c0" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                    </g>
                  )
                })}
              </g>
            )}

            {/* Rivers — chains through hex-edge midpoints (Chaikin-smoothed) */}
            {riversDisplayMode === 'edges' && (
              <g clipPath="url(#paper-clip)">
                {riverChains.map((chain, ci) => {
                  const pts = chain.map(([lon, lat]) => toSVG(lon, lat))
                  if (pts.length < 2) return null
                  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')
                  return (
                    <g key={ci} style={{ pointerEvents: 'none' }}>
                      <path d={d} fill="none" stroke="#a8d8f0" strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" />
                      <path d={d} fill="none" stroke="#4a88c0" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
                    </g>
                  )
                })}
              </g>
            )}

            {/* Road lines */}
            <g clipPath="url(#paper-clip)">
              {roadsDisplayMode === 'raw' && (
                [...rawRoadWays]
                  .sort((a, b) => HIGHWAY_RENDER_ORDER.indexOf(b.highway) - HIGHWAY_RENDER_ORDER.indexOf(a.highway))
                  .filter((w) => roadsVisibleTypes.includes(w.highway))
                  .map((way, i) => {
                    const s = ROAD_STYLES[way.highway] ?? DEFAULT_ROAD_STYLE
                    const pts = way.coords.map(([lon, lat]) => toSVG(lon, lat))
                    if (pts.length < 2) return null
                    const d = pts.map((p, j) => `${j === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')
                    return (
                      <g key={i} style={{ pointerEvents: 'none' }}>
                        <path d={d} fill="none" stroke={s.outer} strokeWidth={s.outerW} strokeLinecap="round" strokeLinejoin="round" />
                        <path d={d} fill="none" stroke={s.inner} strokeWidth={s.innerW} strokeLinecap="round" strokeLinejoin="round" />
                      </g>
                    )
                  })
              )}

              {roadsDisplayMode === 'per_hex' && (
                HIGHWAY_RENDER_ORDER.flatMap((hwType) =>
                  smoothedRoadChains
                    .filter((c) => c.highway === hwType)
                    .map(({ highway, chain }, i) => {
                      const s = ROAD_STYLES[highway] ?? DEFAULT_ROAD_STYLE
                      const pts = chain.map(([lon, lat]) => toSVG(lon, lat))
                      if (pts.length < 2) return null
                      const d = pts.map((p, j) => `${j === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')
                      return (
                        <g key={`${hwType}-${i}`} style={{ pointerEvents: 'none' }}>
                          <path d={d} fill="none" stroke={s.outer} strokeWidth={s.outerW} strokeLinecap="round" strokeLinejoin="round" />
                          <path d={d} fill="none" stroke={s.inner} strokeWidth={s.innerW} strokeLinecap="round" strokeLinejoin="round" />
                        </g>
                      )
                    })
                )
              )}
            </g>

            {/* Rail lines */}
            <g clipPath="url(#paper-clip)">
              {RAIL_RENDER_ORDER.flatMap((rtType) =>
                smoothedRailChains
                  .filter((c) => c.rail_type === rtType)
                  .map(({ rail_type, chain }, i) => {
                    const s = RAIL_STYLES[rail_type] ?? DEFAULT_RAIL_STYLE
                    const pts = chain.map(([lon, lat]) => toSVG(lon, lat))
                    if (pts.length < 2) return null
                    const d = pts.map((p, j) => `${j === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')
                    return (
                      <g key={`${rtType}-${i}`} style={{ pointerEvents: 'none' }}>
                        <path d={d} fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth={s.width + 1.5} strokeLinecap="round" strokeLinejoin="round" />
                        <path d={d} fill="none" stroke={s.color} strokeWidth={s.width} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={s.dasharray} />
                      </g>
                    )
                  })
              )}
            </g>

            {/* Hovered river highlight — shows preview regardless of include/exclude state */}
            {hoveredRiverIndex !== null && riverFeatures[hoveredRiverIndex] && (() => {
              const river = riverFeatures[hoveredRiverIndex]
              const coords = river.smoothedCoords.length >= 2 ? river.smoothedCoords : river.coords
              if (coords.length < 2) return null
              const d = coords
                .map(([lon, lat], i) => {
                  const [x, y] = toSVG(lon, lat)
                  return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
                })
                .join(' ')
              return (
                <g clipPath="url(#paper-clip)" style={{ pointerEvents: 'none' }}>
                  <path d={d} fill="none" stroke="#ffffff" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={0.25} />
                  <path d={d} fill="none" stroke="#88ccff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={river.included ? 1 : 0.5} strokeDasharray={river.included ? undefined : '6,4'} />
                </g>
              )
            })()}

            {/* Hex outlines */}
            <g clipPath="url(#paper-clip)">
              {generatedHexes.map((hex) => {
                const d = hexPath(hex)
                const isSelected = selectedHex?.q === hex.q && selectedHex?.r === hex.r
                const anyPaintMode = terrainPaintMode || roadPaintMode || railPaintMode
                return (
                  <path
                    key={`outline-${hex.q}-${hex.r}`}
                    d={d}
                    fill={anyPaintMode || settlementEditMode ? 'transparent' : 'none'}
                    stroke={isSelected ? '#e04020' : 'rgba(60,50,40,0.35)'}
                    strokeWidth={isSelected ? 2 : 0.7}
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
                          removeAllRailHexEdges(hex.q, hex.r)
                          roadPaintActionRef.current = 'remove'
                        } else {
                          roadPaintActionRef.current = 'add'
                          lastRoadPaintHexRef.current = { q: hex.q, r: hex.r }
                        }
                      }
                    }}
                    onMouseEnter={() => {
                      if (!anyPaintMode || !isPaintingRef.current) return
                      if (terrainPaintMode) {
                        overrideHexTerrain(hex.q, hex.r, terrainPaintBrush)
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
                        if (roadPaintActionRef.current === 'add') {
                          const last = lastRoadPaintHexRef.current
                          if (last && !(last.q === hex.q && last.r === hex.r)) {
                            const dq = hex.q - last.q, dr = hex.r - last.r
                            const isAdj = Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr) === 2
                            if (isAdj) addRailEdge(last.q, last.r, hex.q, hex.r, railPaintBrush)
                          }
                          lastRoadPaintHexRef.current = { q: hex.q, r: hex.r }
                        } else if (roadPaintActionRef.current === 'remove') {
                          removeAllRailHexEdges(hex.q, hex.r)
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
