import { useEffect, useRef, useMemo, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useMapStore, paperDimsMm, type HexEdgeMode } from '../store/mapStore'

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

  const hexHW = flat ? R : (sq3 / 2) * R
  const hexHH = flat ? (sq3 / 2) * R : R

  // Offset coordinates — columns and rows are independent axes so the grid
  // fills a rectangle (axial coords would shear the whole grid diagonally).
  // Flat-top  even-col offset: odd columns shift down by sq3/2·R
  // Pointy-top even-row offset: odd rows shift right by sq3/2·R
  // Math.abs() keeps negative col/row indices correct (JS % can be negative).
  const posX = (col: number, row: number) =>
    flat
      ? 1.5 * R * col
      : sq3 * R * col + (Math.abs(row) % 2 === 1 ? (sq3 / 2) * R : 0)
  const posY = (col: number, row: number) =>
    flat
      ? sq3 * R * row + (Math.abs(col) % 2 === 1 ? (sq3 / 2) * R : 0)
      : 1.5 * R * row

  // ── Step 1: how many complete hexes fit in the inner area ──────────────
  let cols: number, rows: number
  if (flat) {
    cols = Math.max(1, Math.floor((iW - 0.5 * R) / (1.5 * R)))
    rows = Math.max(1, cols > 1
      ? Math.floor((iH - (sq3 / 2) * R) / (sq3 * R))
      : Math.floor(iH / (sq3 * R)))
  } else {
    rows = Math.max(1, Math.floor((iH - 0.5 * R) / (1.5 * R)))
    cols = Math.max(1, rows > 1
      ? Math.floor((iW - (sq3 / 2) * R) / (sq3 * R))
      : Math.floor(iW / (sq3 * R)))
  }

  // ── Step 2: bounding box of col=0..cols-1, row=0..rows-1 ──────────────
  // Using offset coords, the box edges are analytical:
  //   flat-top:   gridR = R·(1.5·cols − 0.5),  gridB = sq3·R·(rows + 0.5·(cols>1))
  //   pointy-top: gridB = R·(1.5·rows − 0.5),  gridR = sq3·R·(cols + 0.5·(rows>1))
  const gridL = -hexHW
  const gridT = -hexHH
  const gridR = flat
    ? 1.5 * R * (cols - 1) + hexHW
    : sq3 * R * (cols - 1) + (rows > 1 ? (sq3 / 2) * R : 0) + hexHW
  const gridB = flat
    ? sq3 * R * (rows - 1) + (cols > 1 ? (sq3 / 2) * R : 0) + hexHH
    : 1.5 * R * (rows - 1) + hexHH

  // ── Step 3: centre that bounding box within the margin area ────────────
  const originX = marginPx + (iW - (gridR - gridL)) / 2 - gridL
  const originY = marginPx + (iH - (gridB - gridT)) / 2 - gridT

  // ── Step 4: generate hexes ─────────────────────────────────────────────
  // 'whole': exactly the complete rectangle — no clipping needed
  // 'half':  two extra rings in every direction, clipped at margin boundary
  const ext = mode === 'half' ? 2 : 0
  const colMin = -ext, colMax = cols - 1 + ext
  const rowMin = -ext, rowMax = rows - 1 + ext

  const clipL = marginPx, clipR = marginPx + iW
  const clipT = marginPx, clipB = marginPx + iH

  const hexPoints: string[] = []
  for (let col = colMin; col <= colMax; col++) {
    for (let row = rowMin; row <= rowMax; row++) {
      const cx = posX(col, row) + originX
      const cy = posY(col, row) + originY

      if (cx + hexHW < clipL || cx - hexHW > clipR) continue
      if (cy + hexHH < clipT || cy - hexHH > clipB) continue

      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = ((base + 60 * i) * Math.PI) / 180
        return `${cx + R * Math.cos(a)},${cy + R * Math.sin(a)}`
      }).join(' ')

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
      <g clipPath="url(#margin-clip)">
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

  const { paperSize, orientation, hexSizeMm, hexOrientation, marginMm, hexEdgeMode, center, setMapState, setFramePixelWidth } = useMapStore()
  const [pwMm, phMm] = paperDimsMm(paperSize, orientation)

  // Recompute frame pixel size when viewport or paper settings change
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const compute = () => {
      const vw = el.clientWidth
      const vh = el.clientHeight
      const aspect = pwMm / phMm
      const margin = 0.86

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
  }, [pwMm, phMm, setFramePixelWidth])

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
          paperWidthMm={pwMm}
          hexSizeMm={hexSizeMm}
          hexOrientation={hexOrientation}
          marginMm={marginMm}
          hexEdgeMode={hexEdgeMode}
        />
      </div>
    </div>
  )
}
