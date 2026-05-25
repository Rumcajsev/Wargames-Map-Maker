import { useEffect, useRef, useMemo, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useMapStore, paperDimsMm, combinedDimsMm, FRAME_MARGIN, type HexEdgeMode } from '../store/mapStore'

const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxzoom: 19,
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
}

// ---------------------------------------------------------------------------
// Hex layout engine — pure screen-space geometry, three edge modes
// ---------------------------------------------------------------------------

function computeHexLayout(
  frameW: number,
  frameH: number,
  marginPx: number,
  R: number,
  flat: boolean,
  mode: HexEdgeMode,
): { hexPoints: string[]; marginPx: number } {
  const sq3 = Math.sqrt(3)
  const base = flat ? 0 : 30
  const iW = frameW - 2 * marginPx
  const iH = frameH - 2 * marginPx
  const hw = iW / 2
  const hh = iH / 2
  // Paper centre in screen space — q=0,r=0 is placed here, matching the backend
  const cx0 = marginPx + hw
  const cy0 = marginPx + hh

  // Axial hex centre offset from the paper centre (identical to backend hex_grid.py)
  const axDx = (q: number, r: number) =>
    flat ? 1.5 * R * q : sq3 * R * q + (sq3 / 2) * R * r
  const axDy = (q: number, r: number) =>
    flat ? (sq3 / 2) * R * q + sq3 * R * r : 1.5 * R * r

  const sweep = Math.ceil((Math.max(iW, iH) / 2 + R) / R) + 1

  const hexPoints: string[] = []
  for (let q = -sweep; q <= sweep; q++) {
    for (let r = -sweep; r <= sweep; r++) {
      const dx = axDx(q, r)
      const dy = axDy(q, r)

      // Quick cull: centre must be reachable from the inner area
      if (Math.abs(dx) > hw + R || Math.abs(dy) > hh + R) continue

      // Vertex offsets relative to the paper centre
      const verts = Array.from({ length: 6 }, (_, i) => {
        const a = ((base + 60 * i) * Math.PI) / 180
        return [dx + R * Math.cos(a), dy + R * Math.sin(a)] as [number, number]
      })

      const isPartial = verts.some(([vx, vy]) => Math.abs(vx) > hw || Math.abs(vy) > hh)
      if (mode === 'whole' && isPartial) continue

      const pts = verts.map(([vx, vy]) => `${cx0 + vx},${cy0 + vy}`).join(' ')
      hexPoints.push(pts)
    }
  }

  return { hexPoints, marginPx }
}

// ---------------------------------------------------------------------------
// SVG component — renders the layout and the margin guide line
// ---------------------------------------------------------------------------

interface HexPreviewProps {
  frameW: number
  frameH: number
  paperWidthMm: number
  hexSizeMm: number
  hexOrientation: 'flat' | 'pointy'
  marginMm: number
  hexEdgeMode: HexEdgeMode
}

function HexPreviewSVG({ frameW, frameH, paperWidthMm, hexSizeMm, hexOrientation, marginMm, hexEdgeMode }: HexPreviewProps) {
  const result = useMemo(() => {
    if (frameW === 0 || frameH === 0) return null
    const scalePxPerMm = frameW / paperWidthMm
    const R = (hexSizeMm / 2) * scalePxPerMm * 2 / Math.sqrt(3)
    const marginPx = marginMm * scalePxPerMm
    return computeHexLayout(frameW, frameH, marginPx, R, hexOrientation === 'flat', hexEdgeMode)
  }, [frameW, frameH, paperWidthMm, hexSizeMm, hexOrientation, marginMm, hexEdgeMode])

  if (!result) return null
  const { hexPoints, marginPx: mp } = result
  const iW = frameW - 2 * mp
  const iH = frameH - 2 * mp

  return (
    <svg
      width={frameW}
      height={frameH}
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
    >
      <defs>
        <clipPath id="margin-clip">
          <rect x={mp} y={mp} width={iW} height={iH} />
        </clipPath>
      </defs>

      {/* Hex grid clipped at margin boundary */}
      <g clipPath="url(#margin-clip)" opacity={0.75}>
        {hexPoints.map((pts, i) => (
          <polygon
            key={i}
            points={pts}
            fill="none"
            stroke="rgba(40, 70, 30, 0.6)"
            strokeWidth={1}
          />
        ))}
      </g>

      {/* Margin guide — dashed inset line */}
      {mp > 0 && (
        <rect
          x={mp} y={mp} width={iW} height={iH}
          fill="none"
          stroke="rgba(220, 100, 0, 0.45)"
          strokeWidth={1}
          strokeDasharray="5,4"
        />
      )}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Main map view
// ---------------------------------------------------------------------------

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const frameRef = useRef<HTMLDivElement>(null)

  const [frameDims, setFrameDims] = useState({ w: 0, h: 0 })

  const { paperSize, orientation, pageGrid, hexSizeMm, hexOrientation, marginMm, hexEdgeMode, center, setMapState, setFramePixelWidth, flyTarget, clearFlyTarget } = useMapStore()
  const [pwMm, phMm] = paperDimsMm(paperSize, orientation)
  const [cwMm, chMm] = combinedDimsMm(paperSize, orientation, pageGrid)

  // Recompute frame pixel size when viewport or paper settings change
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const compute = () => {
      const vw = el.clientWidth
      const vh = el.clientHeight
      const aspect = cwMm / chMm
      const margin = FRAME_MARGIN

      let fw = vw * margin
      let fh = fw / aspect
      if (fh > vh * margin) {
        fh = vh * margin
        fw = fh * aspect
      }

      fw = Math.round(fw)
      fh = Math.round(fh)

      if (frameRef.current) {
        frameRef.current.style.width = `${fw}px`
        frameRef.current.style.height = `${fh}px`
      }
      setFrameDims({ w: fw, h: fh })
      setFramePixelWidth(fw)
    }

    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [cwMm, chMm, setFramePixelWidth])

  // Adjust zoom when combined dims change to preserve km/hex scale
  const prevCombinedRef = useRef<[number, number] | null>(null)
  useEffect(() => {
    const prev = prevCombinedRef.current
    prevCombinedRef.current = [cwMm, chMm]
    if (!prev || !mapRef.current || !containerRef.current) return
    const [prevCw, prevCh] = prev
    if (prevCw === cwMm && prevCh === chMm) return

    const el = containerRef.current
    const vw = el.clientWidth
    const vh = el.clientHeight
    const calcFw = (cw: number, ch: number) => {
      let fw = vw * FRAME_MARGIN
      let fh = fw / (cw / ch)
      if (fh > vh * FRAME_MARGIN) { fh = vh * FRAME_MARGIN; fw = fh * (cw / ch) }
      return Math.round(fw)
    }

    const oldFw = calcFw(prevCw, prevCh)
    const newFw = calcFw(cwMm, chMm)
    if (oldFw === 0 || newFw === 0) return

    const newZoom = mapRef.current.getZoom() + Math.log2((newFw * prevCw) / (oldFw * cwMm))
    mapRef.current.setZoom(newZoom)
  }, [cwMm, chMm])

  // Fly to target when set from outside (search / quick jumps)
  useEffect(() => {
    if (!flyTarget || !mapRef.current) return
    mapRef.current.flyTo({ center: flyTarget.center, zoom: flyTarget.zoom, duration: 1200 })
    clearFlyTarget()
  }, [flyTarget?.id])

  // Init MapLibre once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: center,
      zoom: 7,
      bearing: 0,
    })

    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right')

    const onMove = () => {
      const c = map.getCenter()
      setMapState(map.getBearing(), [c.lng, c.lat], map.getZoom())
    }
    map.on('moveend', onMove)
    map.on('load', onMove)

    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      {/* Paper frame — stays fixed on screen while map rotates beneath */}
      <div
        ref={frameRef}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          border: '2px solid rgba(220, 60, 0, 0.9)',
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.30)',
          pointerEvents: 'none',
          zIndex: 2,
          overflow: 'hidden',
        }}
      >
        <HexPreviewSVG
          frameW={frameDims.w}
          frameH={frameDims.h}
          paperWidthMm={cwMm}
          hexSizeMm={hexSizeMm}
          hexOrientation={hexOrientation}
          marginMm={marginMm}
          hexEdgeMode={hexEdgeMode}
        />
        {pageGrid.cols > 1 && Array.from({ length: pageGrid.cols - 1 }, (_, i) => (
          <div key={`sv-${i}`} style={{
            position: 'absolute',
            left: `${(i + 1) / pageGrid.cols * 100}%`,
            top: 0,
            width: 0,
            height: '100%',
            borderLeft: '2px solid rgba(220, 60, 0, 0.9)',
            pointerEvents: 'none',
          }} />
        ))}
        {pageGrid.rows > 1 && Array.from({ length: pageGrid.rows - 1 }, (_, j) => (
          <div key={`sh-${j}`} style={{
            position: 'absolute',
            left: 0,
            top: `${(j + 1) / pageGrid.rows * 100}%`,
            width: '100%',
            height: 0,
            borderTop: '2px solid rgba(220, 60, 0, 0.9)',
            pointerEvents: 'none',
          }} />
        ))}
      </div>
    </div>
  )
}
