import { useState } from 'react'
import type { HexOrientation, PageGrid } from '../store/mapStore'
import {
  pageGridTotalMm, cellPaperInfo,
  validColWidthsForRows, validRowHeightsForCols,
} from '../store/mapStore'

export interface PaperPreviewColors {
  paper: string
  border: string
  hex: string
  margin: string
  labelPrimary: string
  labelSecondary: string
}

export const PAPER_PREVIEW_DARK: PaperPreviewColors = {
  paper: '#161720',
  border: '#2a2a40',
  hex: '#263830',
  margin: '#2a3a30',
  labelPrimary: '#5a7a68',
  labelSecondary: '#3a4a40',
}

// ── PaperHexPreview ───────────────────────────────────────────────────────────

type Edge = 'left' | 'right' | 'top' | 'bottom'

export function PaperHexPreview({
  pageGrid,
  marginMm, hexSizeMm, hexOrientation,
  hexKm = 0,
  maxW = 260, maxH = 280,
  colors = PAPER_PREVIEW_DARK,
  setPageGrid,
}: {
  pageGrid: PageGrid
  marginMm: number; hexSizeMm: number; hexOrientation: HexOrientation
  hexKm?: number
  maxW?: number; maxH?: number
  colors?: PaperPreviewColors
  setPageGrid?: (g: PageGrid) => void
}) {
  const [hoveredEdge, setHoveredEdge] = useState<Edge | null>(null)
  const [hoveredCell, setHoveredCell] = useState<{ col: number; row: number } | null>(null)
  const [pickerEdge, setPickerEdge] = useState<Edge | null>(null)

  const [totalWMm, totalHMm] = pageGridTotalMm(pageGrid)
  const scale = Math.min(maxW / totalWMm, maxH / totalHMm)

  const colPx = pageGrid.colWidths.map(w => Math.round(w * scale))
  const rowPx = pageGrid.rowHeights.map(h => Math.round(h * scale))
  const totalW = colPx.reduce((a, b) => a + b, 0)
  const totalH = rowPx.reduce((a, b) => a + b, 0)
  const marginPx = marginMm * scale
  const hexR = Math.max(3.5, Math.min(14, (hexSizeMm / Math.sqrt(3)) * scale))

  // Cumulative column/row boundaries in SVG coords (px)
  const xOffsets: number[] = []
  let xAcc = 0
  for (const w of colPx) { xOffsets.push(xAcc); xAcc += w }
  const yOffsets: number[] = []
  let yAcc = 0
  for (const h of rowPx) { yOffsets.push(yAcc); yAcc += h }
  // Boundary arrays including the far edge
  const xBounds = [...xOffsets, totalW]
  const yBounds = [...yOffsets, totalH]

  // Hex count from first cell
  const sq3 = Math.sqrt(3)
  const R_mm = hexSizeMm / sq3
  const iWMm = pageGrid.colWidths[0] - 2 * marginMm
  const iHMm = pageGrid.rowHeights[0] - 2 * marginMm
  let hexCols: number, hexRows: number
  if (hexOrientation === 'flat') {
    hexCols = 2 * Math.max(0, Math.floor((iWMm / 2 - R_mm) / (1.5 * R_mm))) + 1
    hexRows = 2 * Math.max(0, Math.floor((iHMm / 2 - (sq3 / 2) * R_mm) / (sq3 * R_mm))) + 1
  } else {
    hexRows = 2 * Math.max(0, Math.floor((iHMm / 2 - R_mm) / (1.5 * R_mm))) + 1
    hexCols = 2 * Math.max(0, Math.floor((iWMm / 2 - (sq3 / 2) * R_mm) / (sq3 * R_mm))) + 1
  }

  const allSameSize = pageGrid.colWidths.every(w => w === pageGrid.colWidths[0]) &&
                      pageGrid.rowHeights.every(h => h === pageGrid.rowHeights[0])
  const firstInfo = cellPaperInfo(pageGrid.colWidths[0], pageGrid.rowHeights[0])
  const totalPages = pageGrid.colWidths.length * pageGrid.rowHeights.length
  const sizeLabel = allSameSize && firstInfo
    ? `${firstInfo.size} · ${firstInfo.orientation}${totalPages > 1 ? ` · ${pageGrid.colWidths.length}×${pageGrid.rowHeights.length}` : ''}`
    : `${totalPages} pages`

  // ── Interactive mode ──────────────────────────────────────────────────────

  const PAD = 48   // space around SVG for labels + buttons
  const ZONE = 40  // hover detection zone outside paper
  const BTN = 26   // button diameter

  const validColW = setPageGrid ? validColWidthsForRows(pageGrid.rowHeights) : []
  const validRowH = setPageGrid ? validRowHeightsForCols(pageGrid.colWidths) : []

  function edgeSizeLabel(isCol: boolean, mm: number) {
    const info = isCol ? cellPaperInfo(mm, pageGrid.rowHeights[0]) : cellPaperInfo(pageGrid.colWidths[0], mm)
    return info ? `${info.size} ${info.orientation === 'landscape' ? '↔' : '↕'}` : `${mm}mm`
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!setPageGrid || pickerEdge) return
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    const svgX = e.clientX - rect.left - PAD
    const svgY = e.clientY - rect.top - PAD

    if (svgX >= 0 && svgX <= totalW && svgY >= 0 && svgY <= totalH) {
      setHoveredEdge(null)
      let col = colPx.length - 1
      for (let c = 0; c < xBounds.length - 1; c++) {
        if (svgX < xBounds[c + 1]) { col = c; break }
      }
      let row = rowPx.length - 1
      for (let r = 0; r < yBounds.length - 1; r++) {
        if (svgY < yBounds[r + 1]) { row = r; break }
      }
      setHoveredCell({ col, row })
      return
    }
    setHoveredCell(null)
    const inYBand = svgY >= 0 && svgY <= totalH
    const inXBand = svgX >= 0 && svgX <= totalW
    if (svgX >= -ZONE && svgX < 0 && inYBand) setHoveredEdge('left')
    else if (svgX > totalW && svgX <= totalW + ZONE && inYBand) setHoveredEdge('right')
    else if (svgY >= -ZONE && svgY < 0 && inXBand) setHoveredEdge('top')
    else if (svgY > totalH && svgY <= totalH + ZONE && inXBand) setHoveredEdge('bottom')
    else setHoveredEdge(null)
  }

  function handleMouseLeave() {
    if (!pickerEdge) { setHoveredEdge(null); setHoveredCell(null) }
  }

  function handleAddClick(edge: Edge) {
    if (!setPageGrid) return
    const isCol = edge === 'left' || edge === 'right'
    const opts = isCol ? validColW : validRowH
    if (opts.length === 0) return
    if (opts.length === 1) { applyAdd(edge, opts[0]); return }
    setPickerEdge(edge)
  }

  function applyAdd(edge: Edge, mm: number) {
    if (!setPageGrid) return
    const g = pageGrid
    if (edge === 'left') setPageGrid({ ...g, colWidths: [mm, ...g.colWidths] })
    else if (edge === 'right') setPageGrid({ ...g, colWidths: [...g.colWidths, mm] })
    else if (edge === 'top') setPageGrid({ ...g, rowHeights: [mm, ...g.rowHeights] })
    else setPageGrid({ ...g, rowHeights: [...g.rowHeights, mm] })
    setPickerEdge(null); setHoveredEdge(null)
  }

  function removeCol(col: number) {
    if (!setPageGrid) return
    setPageGrid({ ...pageGrid, colWidths: pageGrid.colWidths.filter((_, i) => i !== col) })
    setHoveredCell(null)
  }
  function removeRow(row: number) {
    if (!setPageGrid) return
    setPageGrid({ ...pageGrid, rowHeights: pageGrid.rowHeights.filter((_, i) => i !== row) })
    setHoveredCell(null)
  }

  // Button positions in wrapper-div space (SVG coords + PAD offset)
  const btnCx = (svgX: number) => PAD + svgX - BTN / 2
  const btnCy = (svgY: number) => PAD + svgY - BTN / 2
  const addBtnPos: Record<Edge, { left: number; top: number }> = {
    left:   { left: btnCx(-BTN / 2 - 10), top: btnCy(totalH / 2) },
    right:  { left: btnCx(totalW + BTN / 2 + 10), top: btnCy(totalH / 2) },
    top:    { left: btnCx(totalW / 2), top: btnCy(-BTN / 2 - 10) },
    bottom: { left: btnCx(totalW / 2), top: btnCy(totalH + BTN / 2 + 10) },
  }
  const pickerStyle: Record<Edge, React.CSSProperties> = {
    left:   { left: addBtnPos.left.left, top: addBtnPos.left.top + BTN + 6 },
    right:  { left: addBtnPos.right.left + BTN + 6, top: addBtnPos.right.top },
    top:    { left: addBtnPos.top.left - 10, top: addBtnPos.top.top - 70 },
    bottom: { left: addBtnPos.bottom.left - 10, top: addBtnPos.bottom.top + BTN + 6 },
  }

  const MARK = 14  // corner mark length outside paper

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div
        style={{ position: 'relative', width: totalW + PAD * 2, height: totalH + PAD * 2, flexShrink: 0 }}
        onMouseMove={setPageGrid ? handleMouseMove : undefined}
        onMouseLeave={setPageGrid ? handleMouseLeave : undefined}
      >
        {/* ── Paper SVG ── */}
        <svg
          width={totalW} height={totalH}
          style={{ position: 'absolute', left: PAD, top: PAD, overflow: 'visible', display: 'block' }}
        >
          {/* Sheet cells */}
          {pageGrid.rowHeights.map((_, row) =>
            pageGrid.colWidths.map((_, col) => (
              <SheetPreview
                key={`${col}-${row}`}
                id={`sheet-${col}-${row}`}
                x={xOffsets[col]} y={yOffsets[row]}
                w={colPx[col]} h={rowPx[row]}
                margin={marginPx} hexR={hexR}
                hexOrientation={hexOrientation}
                colors={colors}
              />
            ))
          )}

          {/* Seam lines */}
          {xOffsets.slice(1).map((x, i) => (
            <line key={`sv-${i}`} x1={x} y1={0} x2={x} y2={totalH} stroke={colors.margin} strokeWidth={1} strokeDasharray="3,2" />
          ))}
          {yOffsets.slice(1).map((y, i) => (
            <line key={`sh-${i}`} x1={0} y1={y} x2={totalW} y2={y} stroke={colors.margin} strokeWidth={1} strokeDasharray="3,2" />
          ))}

          {/* Corner registration marks */}
          <g stroke={colors.border} strokeWidth={1} fill="none" opacity={0.7}>
            <line x1={-MARK} y1={0} x2={0} y2={0} /><line x1={0} y1={-MARK} x2={0} y2={0} />
            <line x1={totalW} y1={0} x2={totalW + MARK} y2={0} /><line x1={totalW} y1={-MARK} x2={totalW} y2={0} />
            <line x1={-MARK} y1={totalH} x2={0} y2={totalH} /><line x1={0} y1={totalH} x2={0} y2={totalH + MARK} />
            <line x1={totalW} y1={totalH} x2={totalW + MARK} y2={totalH} /><line x1={totalW} y1={totalH} x2={totalW} y2={totalH + MARK} />
          </g>

          {/* Seam tick marks */}
          {xOffsets.slice(1).map((x, i) => (
            <g key={`tx-${i}`} stroke={colors.border} strokeWidth={0.75} opacity={0.5}>
              <line x1={x} y1={-7} x2={x} y2={0} />
              <line x1={x} y1={totalH} x2={x} y2={totalH + 7} />
            </g>
          ))}
          {yOffsets.slice(1).map((y, i) => (
            <g key={`ty-${i}`} stroke={colors.border} strokeWidth={0.75} opacity={0.5}>
              <line x1={-7} y1={y} x2={0} y2={y} />
              <line x1={totalW} y1={y} x2={totalW + 7} y2={y} />
            </g>
          ))}

          {/* Dimension labels */}
          <text
            x={totalW / 2} y={-PAD / 2}
            textAnchor="middle" dominantBaseline="middle"
            fill={colors.labelSecondary} fontSize={10}
            style={{ userSelect: 'none', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.5px' }}
          >{Math.round(totalWMm)} mm</text>
          <text
            x={-PAD / 2} y={totalH / 2}
            textAnchor="middle" dominantBaseline="middle"
            fill={colors.labelSecondary} fontSize={10}
            transform={`rotate(-90, ${-PAD / 2}, ${totalH / 2})`}
            style={{ userSelect: 'none', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.5px' }}
          >{Math.round(totalHMm)} mm</text>
        </svg>

        {/* ── Interactive overlays (only when setPageGrid provided) ── */}
        {setPageGrid && (
          <>
            {/* Edge + buttons */}
            {(['left', 'right', 'top', 'bottom'] as Edge[]).map(edge => {
              if (hoveredEdge !== edge && pickerEdge !== edge) return null
              const isCol = edge === 'left' || edge === 'right'
              const opts = isCol ? validColW : validRowH
              if (opts.length === 0) return null
              return (
                <div
                  key={edge}
                  onClick={() => handleAddClick(edge)}
                  style={{
                    position: 'absolute', ...addBtnPos[edge],
                    width: BTN, height: BTN, borderRadius: '50%',
                    background: 'rgba(220,60,0,0.88)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, fontWeight: 300, lineHeight: 1,
                    cursor: 'pointer', userSelect: 'none',
                  }}
                >+</div>
              )
            })}

            {/* Size picker */}
            {pickerEdge && (() => {
              const isCol = pickerEdge === 'left' || pickerEdge === 'right'
              const opts = isCol ? validColW : validRowH
              return (
                <div style={{
                  position: 'absolute', ...pickerStyle[pickerEdge],
                  background: 'rgba(22,18,16,0.96)',
                  border: '1px solid rgba(220,60,0,0.5)',
                  borderRadius: 4, padding: 5,
                  display: 'flex', flexDirection: isCol ? 'column' : 'row', gap: 4,
                  zIndex: 10,
                }}>
                  {opts.map(mm => (
                    <button key={mm} onClick={() => applyAdd(pickerEdge, mm)} style={{
                      padding: '4px 10px',
                      background: 'rgba(220,60,0,0.15)', border: '1px solid rgba(220,60,0,0.4)',
                      borderRadius: 3, color: '#ffd0b0', cursor: 'pointer',
                      fontFamily: 'ui-monospace, monospace', fontSize: 11, whiteSpace: 'nowrap',
                    }}>{edgeSizeLabel(isCol, mm)}</button>
                  ))}
                </div>
              )
            })()}

            {/* × remove column */}
            {hoveredCell && hoveredCell.col > 0 && (() => {
              const col = hoveredCell.col
              const cx = PAD + (xBounds[col] + xBounds[col + 1]) / 2 - BTN / 2
              return (
                <div onClick={() => removeCol(col)} style={{
                  position: 'absolute', left: cx, top: PAD + 12,
                  width: BTN, height: BTN, borderRadius: '50%',
                  background: 'rgba(200,50,50,0.88)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, cursor: 'pointer', userSelect: 'none',
                }}>×</div>
              )
            })()}

            {/* × remove row */}
            {hoveredCell && hoveredCell.row > 0 && (() => {
              const row = hoveredCell.row
              const cy = PAD + (yBounds[row] + yBounds[row + 1]) / 2 - BTN / 2
              return (
                <div onClick={() => removeRow(row)} style={{
                  position: 'absolute', left: PAD + 12, top: cy,
                  width: BTN, height: BTN, borderRadius: '50%',
                  background: 'rgba(200,50,50,0.88)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, cursor: 'pointer', userSelect: 'none',
                }}>×</div>
              )
            })()}
          </>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <div style={{ color: colors.labelPrimary, fontSize: 11 }}>{sizeLabel}</div>
        <div style={{ color: colors.labelSecondary, fontSize: 10 }}>
          {hexCols} × {hexRows} hexes{hexKm > 0 ? ` · ${hexKm.toFixed(1)} km each` : ''}
        </div>
      </div>
    </div>
  )
}

// ── SheetPreview ──────────────────────────────────────────────────────────────

export function SheetPreview({ id, x, y, w, h, margin, hexR, hexOrientation, colors }: {
  id: string; x: number; y: number; w: number; h: number
  margin: number; hexR: number; hexOrientation: HexOrientation
  colors: PaperPreviewColors
}) {
  const iX = x + margin, iY = y + margin
  const iW = w - 2 * margin, iH = h - 2 * margin

  const hexes: { cx: number; cy: number }[] = []
  const sq3 = Math.sqrt(3)

  if (hexOrientation === 'flat') {
    const colSpacing = 1.5 * hexR
    const rowSpacing = sq3 * hexR
    for (let q = -1; q * colSpacing < iW + hexR * 2; q++) {
      const cx = iX + hexR + q * colSpacing
      const offset = q % 2 !== 0 ? rowSpacing / 2 : 0
      for (let r = -1; r * rowSpacing < iH + rowSpacing; r++) {
        const cy = iY + hexR * (sq3 / 2) + r * rowSpacing - offset
        hexes.push({ cx, cy })
      }
    }
  } else {
    const rowSpacing = 1.5 * hexR
    const colSpacing = sq3 * hexR
    for (let r = -1; r * rowSpacing < iH + hexR * 2; r++) {
      const cy = iY + hexR + r * rowSpacing
      const offset = r % 2 !== 0 ? colSpacing / 2 : 0
      for (let q = -1; q * colSpacing < iW + colSpacing; q++) {
        const cx = iX + hexR * (sq3 / 2) + q * colSpacing - offset
        hexes.push({ cx, cy })
      }
    }
  }

  const clipId = `clip-${id}`

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <rect x={iX} y={iY} width={Math.max(0, iW)} height={Math.max(0, iH)} />
        </clipPath>
      </defs>
      <rect x={x} y={y} width={w} height={h} fill={colors.paper} stroke={colors.border} strokeWidth={1} rx={1.5} />
      <g clipPath={`url(#${clipId})`}>
        {hexes.map((hex, i) => {
          const angles = hexOrientation === 'flat'
            ? [0, 60, 120, 180, 240, 300]
            : [30, 90, 150, 210, 270, 330]
          const pts = angles.map(a => {
            const rad = (a * Math.PI) / 180
            return `${hex.cx + hexR * Math.cos(rad)},${hex.cy + hexR * Math.sin(rad)}`
          }).join(' ')
          return <polygon key={i} points={pts} fill="none" stroke={colors.hex} strokeWidth={0.7} />
        })}
      </g>
      {margin > 0.5 && (
        <rect x={iX} y={iY} width={Math.max(0, iW)} height={Math.max(0, iH)}
          fill="none" stroke={colors.margin} strokeWidth={0.5} strokeDasharray="2,2" />
      )}
    </g>
  )
}

// ── PageGridEditor ────────────────────────────────────────────────────────────
// Interactive page-grid editor: click edge zones to add a column/row,
// hover the last page to reveal a × badge that removes it.
// When multiple valid sizes exist for an edge, a size picker appears.

export interface PageGridEditorColors extends PaperPreviewColors {
  addZone: string    // semi-transparent fill on hover, e.g. 'rgba(58,122,74,0.18)'
  addText: string    // opaque "+" glyph color
  removeZone: string // semi-transparent red overlay on hover
}

export const PAGE_GRID_EDITOR_DARK: PageGridEditorColors = {
  ...PAPER_PREVIEW_DARK,
  addZone:    'rgba(58,122,74,0.18)',
  addText:    '#5a9e6f',
  removeZone: 'rgba(200,60,60,0.07)',
}

type AddEdge = 'right' | 'left' | 'bottom' | 'top'

export function PageGridEditor({
  pageGrid, setPageGrid,
  marginMm, hexSizeMm, hexOrientation, hexKm = 0,
  maxW = 230, maxH = 230, zone = 22,
  colors = PAGE_GRID_EDITOR_DARK,
}: {
  pageGrid: PageGrid; setPageGrid: (v: PageGrid) => void
  marginMm: number; hexSizeMm: number; hexOrientation: HexOrientation
  hexKm?: number
  maxW?: number; maxH?: number; zone?: number
  colors?: PageGridEditorColors
}) {
  const [totalWMm, totalHMm] = pageGridTotalMm(pageGrid)
  const scale = Math.min(maxW / totalWMm, maxH / totalHMm)

  const colPx = pageGrid.colWidths.map(w => Math.round(w * scale))
  const rowPx = pageGrid.rowHeights.map(h => Math.round(h * scale))
  const totalW = colPx.reduce((a, b) => a + b, 0)
  const totalH = rowPx.reduce((a, b) => a + b, 0)
  const marginPx = marginMm * scale
  const hexR = Math.max(3.5, Math.min(14, (hexSizeMm / Math.sqrt(3)) * scale))

  // Cumulative offsets
  const xOffsets: number[] = []
  let xAcc = 0
  for (const w of colPx) { xOffsets.push(xAcc); xAcc += w }
  const yOffsets: number[] = []
  let yAcc = 0
  for (const h of rowPx) { yOffsets.push(yAcc); yAcc += h }

  const [hoveredSheet, setHoveredSheet] = useState<{ col: number; row: number } | null>(null)
  const [hoveredEdge, setHoveredEdge] = useState<AddEdge | null>(null)

  const canAddCol = pageGrid.colWidths.length < 4
  const canAddRow = pageGrid.rowHeights.length < 4
  const canRemoveCol = pageGrid.colWidths.length > 1
  const canRemoveRow = pageGrid.rowHeights.length > 1
  const totalPages = pageGrid.colWidths.length * pageGrid.rowHeights.length

  // Valid options for each add edge
  const validColW = validColWidthsForRows(pageGrid.rowHeights)
  const validRowH = validRowHeightsForCols(pageGrid.colWidths)

  const svgW = totalW + zone * 2
  const svgH = totalH + zone * 2

  // Option picker button geometry
  const OBTN_W = 58, OBTN_H = 18, OBTN_GAP = 4

  function addCol(w: number) {
    setPageGrid({ colWidths: [...pageGrid.colWidths, w], rowHeights: pageGrid.rowHeights })
    setHoveredEdge(null)
  }
  function addRow(h: number) {
    setPageGrid({ colWidths: pageGrid.colWidths, rowHeights: [...pageGrid.rowHeights, h] })
    setHoveredEdge(null)
  }

  function OptionButtons({ options, x, y, dir, onPick }: {
    options: number[]
    x: number; y: number
    dir: 'col' | 'row'
    onPick: (v: number) => void
  }) {
    const count = options.length
    const totalLen = count * OBTN_H + (count - 1) * OBTN_GAP
    const startY = y - totalLen / 2
    return (
      <g>
        {options.map((v, i) => {
          const info = dir === 'col'
            ? cellPaperInfo(v, pageGrid.rowHeights[0])
            : cellPaperInfo(pageGrid.colWidths[0], v)
          const label = info
            ? `${info.size} ${info.orientation === 'portrait' ? '↕' : '↔'}`
            : `${Math.round(v)}`
          const bx = x
          const by = startY + i * (OBTN_H + OBTN_GAP)
          return (
            <g key={v} style={{ cursor: 'pointer' }} onClick={() => onPick(v)}>
              <rect x={bx} y={by} width={OBTN_W} height={OBTN_H}
                fill={colors.paper} stroke={colors.addText} strokeWidth={1} rx={2} />
              <text x={bx + OBTN_W / 2} y={by + OBTN_H / 2}
                textAnchor="middle" dominantBaseline="central"
                fill={colors.addText} fontSize={9.5} style={{ userSelect: 'none', pointerEvents: 'none' }}>
                {label}
              </text>
            </g>
          )
        })}
      </g>
    )
  }

  function AddZone({ edge }: { edge: AddEdge }) {
    const isHoriz = edge === 'right' || edge === 'left'
    const isActive = hoveredEdge === edge
    const validOpts = isHoriz ? validColW : validRowH
    const canAdd = isHoriz ? canAddCol : canAddRow
    if (!canAdd) return null

    let rx = 0, ry = 0, rw = 0, rh = 0
    let plusX = 0, plusY = 0
    let btnX = 0, btnY = 0

    if (edge === 'right') {
      rx = zone + totalW; ry = zone; rw = zone; rh = totalH
      plusX = zone + totalW + zone / 2; plusY = zone + totalH / 2
      btnX = zone + totalW + zone + 4; btnY = zone + totalH / 2
    } else if (edge === 'left') {
      rx = 0; ry = zone; rw = zone; rh = totalH
      plusX = zone / 2; plusY = zone + totalH / 2
      btnX = -OBTN_W - 4; btnY = zone + totalH / 2
    } else if (edge === 'bottom') {
      rx = zone; ry = zone + totalH; rw = totalW; rh = zone
      plusX = zone + totalW / 2; plusY = zone + totalH + zone / 2
      btnY = zone + totalH + zone + 4
      btnX = zone + totalW / 2 - (validOpts.length * (OBTN_W + OBTN_GAP) - OBTN_GAP) / 2
    } else {
      rx = zone; ry = 0; rw = totalW; rh = zone
      plusX = zone + totalW / 2; plusY = zone / 2
      const totalBtnsH = validOpts.length * (OBTN_H + OBTN_GAP) - OBTN_GAP
      btnY = -totalBtnsH - 4
      btnX = zone + totalW / 2 - (validOpts.length * (OBTN_W + OBTN_GAP) - OBTN_GAP) / 2
    }

    const onSingleClick = () => {
      if (validOpts.length === 1) {
        isHoriz ? addCol(validOpts[0]) : addRow(validOpts[0])
      }
    }

    return (
      <g>
        <rect x={rx} y={ry} width={rw} height={rh}
          fill={isActive ? colors.addZone : 'transparent'}
          style={{ cursor: validOpts.length === 1 ? 'pointer' : 'default' }}
          onMouseEnter={() => setHoveredEdge(edge)}
          onMouseLeave={() => setHoveredEdge(null)}
          onClick={onSingleClick}
        />
        {isActive && !isHoriz && validOpts.length > 1 ? (
          // Horizontal options for top/bottom: render row by row
          <g onMouseEnter={() => setHoveredEdge(edge)} onMouseLeave={() => setHoveredEdge(null)}>
            {validOpts.map((v, i) => {
              const info = cellPaperInfo(pageGrid.colWidths[0], v)
              const label = info ? `${info.size} ${info.orientation === 'portrait' ? '↕' : '↔'}` : `${Math.round(v)}`
              const bx = btnX + i * (OBTN_W + OBTN_GAP)
              const by = btnY
              return (
                <g key={v} style={{ cursor: 'pointer' }} onClick={() => addRow(v)}>
                  <rect x={bx} y={by} width={OBTN_W} height={OBTN_H}
                    fill={colors.paper} stroke={colors.addText} strokeWidth={1} rx={2} />
                  <text x={bx + OBTN_W / 2} y={by + OBTN_H / 2}
                    textAnchor="middle" dominantBaseline="central"
                    fill={colors.addText} fontSize={9.5} style={{ userSelect: 'none', pointerEvents: 'none' }}>
                    {label}
                  </text>
                </g>
              )
            })}
          </g>
        ) : isActive && isHoriz && validOpts.length > 1 ? (
          // Vertical options for left/right
          <g onMouseEnter={() => setHoveredEdge(edge)} onMouseLeave={() => setHoveredEdge(null)}>
            <OptionButtons options={validOpts} x={btnX} y={btnY} dir="col" onPick={addCol} />
          </g>
        ) : isActive ? (
          <text x={plusX} y={plusY}
            textAnchor="middle" dominantBaseline="central"
            fill={colors.addText} fontSize={14} fontWeight="bold"
            style={{ pointerEvents: 'none', userSelect: 'none' }}>+</text>
        ) : null}
      </g>
    )
  }

  // Label
  const allSameSize = pageGrid.colWidths.every(w => w === pageGrid.colWidths[0]) &&
                      pageGrid.rowHeights.every(h => h === pageGrid.rowHeights[0])
  const firstInfo = cellPaperInfo(pageGrid.colWidths[0], pageGrid.rowHeights[0])
  const sizeLabel = allSameSize && firstInfo
    ? `${firstInfo.size} · ${firstInfo.orientation}${totalPages > 1 ? ` · ${pageGrid.colWidths.length}×${pageGrid.rowHeights.length}` : ''}`
    : `Custom · ${totalPages} pages`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <svg width={svgW} height={svgH} style={{ overflow: 'visible' }}>
        {/* Sheet cells */}
        {pageGrid.rowHeights.map((_, row) =>
          pageGrid.colWidths.map((_, col) => {
            const x = zone + xOffsets[col]
            const y = zone + yOffsets[row]
            const isLastCol = col === pageGrid.colWidths.length - 1
            const isLastRow = row === pageGrid.rowHeights.length - 1
            const canRemove = (isLastCol && canRemoveCol) || (isLastRow && canRemoveRow)
            const isHovered = hoveredSheet?.col === col && hoveredSheet?.row === row

            function handleRemove() {
              if (isLastCol && canRemoveCol) setPageGrid({ colWidths: pageGrid.colWidths.slice(0, -1), rowHeights: pageGrid.rowHeights })
              else if (isLastRow && canRemoveRow) setPageGrid({ colWidths: pageGrid.colWidths, rowHeights: pageGrid.rowHeights.slice(0, -1) })
            }

            return (
              <g key={`${col}-${row}`}>
                <SheetPreview
                  id={`pge-${col}-${row}`}
                  x={x} y={y} w={colPx[col]} h={rowPx[row]}
                  margin={marginPx} hexR={hexR}
                  hexOrientation={hexOrientation}
                  colors={colors}
                />
                <rect
                  x={x} y={y} width={colPx[col]} height={rowPx[row]}
                  fill={isHovered && canRemove ? colors.removeZone : 'transparent'}
                  rx={1.5}
                  style={{ cursor: canRemove ? 'pointer' : 'default' }}
                  onMouseEnter={() => setHoveredSheet({ col, row })}
                  onMouseLeave={() => setHoveredSheet(null)}
                  onClick={handleRemove}
                />
                {isHovered && canRemove && (
                  <g transform={`translate(${x + colPx[col] - 10},${y + 10})`} style={{ pointerEvents: 'none' }}>
                    <circle r={7} fill={colors.paper} stroke={colors.border} strokeWidth={1} />
                    <text textAnchor="middle" dominantBaseline="central"
                      fill={colors.addText} fontSize={10} fontWeight="bold" style={{ userSelect: 'none' }}>×</text>
                  </g>
                )}
              </g>
            )
          })
        )}

        {/* Seam lines */}
        {colPx.slice(0, -1).map((_, col) => {
          const x = zone + xOffsets[col + 1]
          return <line key={`sv-${col}`} x1={x} y1={zone} x2={x} y2={zone + totalH} stroke={colors.margin} strokeWidth={1} strokeDasharray="3,2" />
        })}
        {rowPx.slice(0, -1).map((_, row) => {
          const y = zone + yOffsets[row + 1]
          return <line key={`sh-${row}`} x1={zone} y1={y} x2={zone + totalW} y2={y} stroke={colors.margin} strokeWidth={1} strokeDasharray="3,2" />
        })}

        <AddZone edge="right" />
        <AddZone edge="left" />
        <AddZone edge="bottom" />
        <AddZone edge="top" />
      </svg>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <div style={{ color: colors.labelPrimary, fontSize: 11 }}>{sizeLabel}</div>
        {hexKm > 0 && (
          <div style={{ color: colors.labelSecondary, fontSize: 10 }}>{hexKm.toFixed(1)} km / hex</div>
        )}
        <div style={{ color: colors.labelSecondary, fontSize: 10, opacity: 0.7, marginTop: 2 }}>
          Click edges to add · hover to remove
        </div>
      </div>
    </div>
  )
}
