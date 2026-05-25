import { useEffect, useRef, useMemo, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  useMapStore, pageGridTotalMm, FRAME_MARGIN,
  validColWidthsForRows, validRowHeightsForCols, cellPaperInfo,
  type HexEdgeMode,
} from '../store/mapStore'

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

type Edge = 'left' | 'right' | 'top' | 'bottom'

export function MapView({ editable = false }: { editable?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const frameRef = useRef<HTMLDivElement>(null)

  const [frameDims, setFrameDims] = useState({ w: 0, h: 0 })
  const [containerDims, setContainerDims] = useState({ w: 0, h: 0 })
  const [hoveredEdge, setHoveredEdge] = useState<Edge | null>(null)
  const [hoveredCell, setHoveredCell] = useState<{ col: number; row: number } | null>(null)
  const [pickerEdge, setPickerEdge] = useState<Edge | null>(null)

  const { pageGrid, hexSizeMm, hexOrientation, marginMm, hexEdgeMode, center, setMapState, setFramePixelWidth, flyTarget, clearFlyTarget, setPageGrid } = useMapStore()
  const [cwMm, chMm] = pageGridTotalMm(pageGrid)

  // Recompute frame pixel size when viewport or paper settings change
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const compute = () => {
      const vw = el.clientWidth
      const vh = el.clientHeight
      setContainerDims({ w: vw, h: vh })
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

  // ── Editable-mode geometry ──────────────────────────────────────────────────

  const EDGE_ZONE = 52
  const fw = frameDims.w, fh = frameDims.h
  const fx = (containerDims.w - fw) / 2
  const fy = (containerDims.h - fh) / 2

  // Pixel boundaries of each column / row, relative to container
  const colBounds = pageGrid.colWidths.reduce<number[]>(
    (acc, w) => [...acc, acc[acc.length - 1] + fw * w / cwMm], [fx]
  )
  const rowBounds = pageGrid.rowHeights.reduce<number[]>(
    (acc, h) => [...acc, acc[acc.length - 1] + fh * h / chMm], [fy]
  )

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!editable || fw === 0) return
    const rect = containerRef.current!.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (x >= fx && x <= fx + fw && y >= fy && y <= fy + fh) {
      if (!pickerEdge) setHoveredEdge(null)
      let col = pageGrid.colWidths.length - 1
      for (let c = 0; c < colBounds.length - 1; c++) {
        if (x < colBounds[c + 1]) { col = c; break }
      }
      let row = pageGrid.rowHeights.length - 1
      for (let r = 0; r < rowBounds.length - 1; r++) {
        if (y < rowBounds[r + 1]) { row = r; break }
      }
      setHoveredCell({ col, row })
      return
    }
    setHoveredCell(null)
    if (pickerEdge) return
    const inYBand = y >= fy && y <= fy + fh
    const inXBand = x >= fx && x <= fx + fw
    if (x >= fx - EDGE_ZONE && x < fx && inYBand) setHoveredEdge('left')
    else if (x > fx + fw && x <= fx + fw + EDGE_ZONE && inYBand) setHoveredEdge('right')
    else if (y >= fy - EDGE_ZONE && y < fy && inXBand) setHoveredEdge('top')
    else if (y > fy + fh && y <= fy + fh + EDGE_ZONE && inXBand) setHoveredEdge('bottom')
    else setHoveredEdge(null)
  }

  function handleMouseLeave() {
    if (!pickerEdge) { setHoveredEdge(null); setHoveredCell(null) }
  }

  function edgeSizeLabel(isCol: boolean, mm: number) {
    const info = isCol ? cellPaperInfo(mm, pageGrid.rowHeights[0]) : cellPaperInfo(pageGrid.colWidths[0], mm)
    return info ? `${info.size} ${info.orientation === 'landscape' ? '↔' : '↕'}` : `${mm}mm`
  }

  function handleAddClick(edge: Edge) {
    const isCol = edge === 'left' || edge === 'right'
    const opts = isCol ? validColWidthsForRows(pageGrid.rowHeights) : validRowHeightsForCols(pageGrid.colWidths)
    if (opts.length === 0) return
    if (opts.length === 1) { applyAdd(edge, opts[0]); return }
    setPickerEdge(edge)
  }

  function applyAdd(edge: Edge, mm: number) {
    const g = pageGrid
    if (edge === 'left') setPageGrid({ ...g, colWidths: [mm, ...g.colWidths] })
    else if (edge === 'right') setPageGrid({ ...g, colWidths: [...g.colWidths, mm] })
    else if (edge === 'top') setPageGrid({ ...g, rowHeights: [mm, ...g.rowHeights] })
    else setPageGrid({ ...g, rowHeights: [...g.rowHeights, mm] })
    setPickerEdge(null); setHoveredEdge(null)
  }

  function removeCol(col: number) {
    setPageGrid({ ...pageGrid, colWidths: pageGrid.colWidths.filter((_, i) => i !== col) })
    setHoveredCell(null)
  }
  function removeRow(row: number) {
    setPageGrid({ ...pageGrid, rowHeights: pageGrid.rowHeights.filter((_, i) => i !== row) })
    setHoveredCell(null)
  }

  // ── Overlay element positions ───────────────────────────────────────────────

  const BTN = 28
  const addBtnCenter: Record<Edge, { x: number; y: number }> = {
    left:   { x: fx - BTN / 2 - 10, y: fy + fh / 2 },
    right:  { x: fx + fw + BTN / 2 + 10, y: fy + fh / 2 },
    top:    { x: fx + fw / 2, y: fy - BTN / 2 - 10 },
    bottom: { x: fx + fw / 2, y: fy + fh + BTN / 2 + 10 },
  }

  const pickerPos: Record<Edge, React.CSSProperties> = {
    left:   { right: containerDims.w - fx + 4, top: fy + fh / 2 - 40 },
    right:  { left: fx + fw + BTN + 18, top: fy + fh / 2 - 40 },
    top:    { left: fx + fw / 2 - 50, bottom: containerDims.h - fy + 4 },
    bottom: { left: fx + fw / 2 - 50, top: fy + fh + BTN + 18 },
  }

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
      onMouseMove={editable ? handleMouseMove : undefined}
      onMouseLeave={editable ? handleMouseLeave : undefined}
    >
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
        {pageGrid.colWidths.slice(0, -1).reduce<{ seams: number[]; acc: number }>(
          ({ seams, acc }, w) => ({ seams: [...seams, acc + w], acc: acc + w }), { seams: [], acc: 0 }
        ).seams.map((xMm, i) => (
          <div key={`sv-${i}`} style={{
            position: 'absolute',
            left: `${xMm / cwMm * 100}%`,
            top: 0, width: 0, height: '100%',
            borderLeft: '2px solid rgba(220, 60, 0, 0.9)',
            pointerEvents: 'none',
          }} />
        ))}
        {pageGrid.rowHeights.slice(0, -1).reduce<{ seams: number[]; acc: number }>(
          ({ seams, acc }, h) => ({ seams: [...seams, acc + h], acc: acc + h }), { seams: [], acc: 0 }
        ).seams.map((yMm, j) => (
          <div key={`sh-${j}`} style={{
            position: 'absolute',
            left: 0, top: `${yMm / chMm * 100}%`,
            width: '100%', height: 0,
            borderTop: '2px solid rgba(220, 60, 0, 0.9)',
            pointerEvents: 'none',
          }} />
        ))}
      </div>

      {/* ── Page-grid edit overlays ── */}
      {editable && fw > 0 && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 6 }}>

          {/* + buttons on edges */}
          {(['left', 'right', 'top', 'bottom'] as Edge[]).map(edge => {
            if (hoveredEdge !== edge && pickerEdge !== edge) return null
            const isCol = edge === 'left' || edge === 'right'
            const opts = isCol ? validColWidthsForRows(pageGrid.rowHeights) : validRowHeightsForCols(pageGrid.colWidths)
            if (opts.length === 0) return null
            const { x, y } = addBtnCenter[edge]
            return (
              <div
                key={edge}
                onClick={() => handleAddClick(edge)}
                style={{
                  position: 'absolute',
                  left: x - BTN / 2, top: y - BTN / 2,
                  width: BTN, height: BTN,
                  borderRadius: '50%',
                  background: 'rgba(220,60,0,0.88)',
                  color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, fontWeight: 300, lineHeight: 1,
                  cursor: 'pointer', userSelect: 'none', pointerEvents: 'auto',
                }}
              >+</div>
            )
          })}

          {/* Size picker */}
          {pickerEdge && (() => {
            const isCol = pickerEdge === 'left' || pickerEdge === 'right'
            const opts = isCol ? validColWidthsForRows(pageGrid.rowHeights) : validRowHeightsForCols(pageGrid.colWidths)
            return (
              <div style={{
                position: 'absolute',
                ...pickerPos[pickerEdge],
                background: 'rgba(22,18,16,0.96)',
                border: '1px solid rgba(220,60,0,0.5)',
                borderRadius: 4,
                padding: 5,
                display: 'flex',
                flexDirection: isCol ? 'column' : 'row',
                gap: 4,
                pointerEvents: 'auto',
              }}>
                {opts.map(mm => (
                  <button
                    key={mm}
                    onClick={() => applyAdd(pickerEdge, mm)}
                    style={{
                      padding: '4px 10px',
                      background: 'rgba(220,60,0,0.15)',
                      border: '1px solid rgba(220,60,0,0.4)',
                      borderRadius: 3,
                      color: '#ffd0b0',
                      cursor: 'pointer',
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: 11, whiteSpace: 'nowrap',
                    }}
                  >{edgeSizeLabel(isCol, mm)}</button>
                ))}
              </div>
            )
          })()}

          {/* × remove column */}
          {hoveredCell && hoveredCell.col > 0 && (() => {
            const col = hoveredCell.col
            const cx = (colBounds[col] + colBounds[col + 1]) / 2
            return (
              <div
                onClick={() => removeCol(col)}
                style={{
                  position: 'absolute',
                  left: cx - BTN / 2, top: fy + 14,
                  width: BTN, height: BTN,
                  borderRadius: '50%',
                  background: 'rgba(200,50,50,0.88)',
                  color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, cursor: 'pointer', userSelect: 'none', pointerEvents: 'auto',
                }}
              >×</div>
            )
          })()}

          {/* × remove row */}
          {hoveredCell && hoveredCell.row > 0 && (() => {
            const row = hoveredCell.row
            const cy = (rowBounds[row] + rowBounds[row + 1]) / 2
            return (
              <div
                onClick={() => removeRow(row)}
                style={{
                  position: 'absolute',
                  left: fx + 14, top: cy - BTN / 2,
                  width: BTN, height: BTN,
                  borderRadius: '50%',
                  background: 'rgba(200,50,50,0.88)',
                  color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, cursor: 'pointer', userSelect: 'none', pointerEvents: 'auto',
                }}
              >×</div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
