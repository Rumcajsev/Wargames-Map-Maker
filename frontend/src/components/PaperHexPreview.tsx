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

export function PaperHexPreview({
  pageGrid,
  marginMm, hexSizeMm, hexOrientation,
  hexKm = 0,
  maxW = 260, maxH = 280,
  colors = PAPER_PREVIEW_DARK,
}: {
  pageGrid: PageGrid
  marginMm: number; hexSizeMm: number; hexOrientation: HexOrientation
  hexKm?: number
  maxW?: number; maxH?: number
  colors?: PaperPreviewColors
}) {
  const [totalWMm, totalHMm] = pageGridTotalMm(pageGrid)
  const scale = Math.min(maxW / totalWMm, maxH / totalHMm)

  // Pixel sizes per column and row
  const colPx = pageGrid.colWidths.map(w => Math.round(w * scale))
  const rowPx = pageGrid.rowHeights.map(h => Math.round(h * scale))
  const totalW = colPx.reduce((a, b) => a + b, 0)
  const totalH = rowPx.reduce((a, b) => a + b, 0)

  const marginPx = marginMm * scale
  const hexR = Math.max(3.5, Math.min(14, (hexSizeMm / Math.sqrt(3)) * scale))

  // Hex count label from first cell
  const firstCW = pageGrid.colWidths[0]
  const firstRH = pageGrid.rowHeights[0]
  const sq3 = Math.sqrt(3)
  const R_mm = hexSizeMm / sq3
  const iWMm = firstCW - 2 * marginMm
  const iHMm = firstRH - 2 * marginMm
  let hexCols: number, hexRows: number
  if (hexOrientation === 'flat') {
    hexCols = 2 * Math.max(0, Math.floor((iWMm / 2 - R_mm) / (1.5 * R_mm))) + 1
    hexRows = 2 * Math.max(0, Math.floor((iHMm / 2 - (sq3 / 2) * R_mm) / (sq3 * R_mm))) + 1
  } else {
    hexRows = 2 * Math.max(0, Math.floor((iHMm / 2 - R_mm) / (1.5 * R_mm))) + 1
    hexCols = 2 * Math.max(0, Math.floor((iWMm / 2 - (sq3 / 2) * R_mm) / (sq3 * R_mm))) + 1
  }

  // Label: uniform or mixed
  const allSameSize = pageGrid.colWidths.every(w => w === firstCW) && pageGrid.rowHeights.every(h => h === firstRH)
  const firstInfo = cellPaperInfo(firstCW, firstRH)
  const totalPages = pageGrid.colWidths.length * pageGrid.rowHeights.length
  const sizeLabel = allSameSize && firstInfo
    ? `${firstInfo.size} · ${firstInfo.orientation}${totalPages > 1 ? ` · ${pageGrid.colWidths.length}×${pageGrid.rowHeights.length}` : ''}`
    : `${totalPages} pages`

  // Cumulative x/y offsets
  const xOffsets = colPx.reduce<number[]>((acc, _w) => [...acc, (acc[acc.length - 1] ?? 0) + (acc.length > 0 ? colPx[acc.length - 1] : 0)], [0]).slice(0, colPx.length)
  const yOffsets = rowPx.reduce<number[]>((acc, _h) => [...acc, (acc[acc.length - 1] ?? 0) + (acc.length > 0 ? rowPx[acc.length - 1] : 0)], [0]).slice(0, rowPx.length)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <svg width={totalW} height={totalH} style={{ overflow: 'visible' }}>
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
        {/* Vertical seams */}
        {colPx.slice(0, -1).map((_, col) => {
          const x = xOffsets[col + 1]
          return <line key={`sv-${col}`} x1={x} y1={0} x2={x} y2={totalH} stroke={colors.margin} strokeWidth={1} strokeDasharray="3,2" />
        })}
        {/* Horizontal seams */}
        {rowPx.slice(0, -1).map((_, row) => {
          const y = yOffsets[row + 1]
          return <line key={`sh-${row}`} x1={0} y1={y} x2={totalW} y2={y} stroke={colors.margin} strokeWidth={1} strokeDasharray="3,2" />
        })}
      </svg>

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
