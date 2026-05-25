import type { PaperSize, Orientation, HexOrientation, PageGrid } from '../store/mapStore'
import { paperDimsMm } from '../store/mapStore'

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

export function PaperHexPreview({
  paperSize, orientation, pageGrid,
  marginMm, hexSizeMm, hexOrientation,
  hexKm = 0,
  maxW = 260, maxH = 280,
  colors = PAPER_PREVIEW_DARK,
}: {
  paperSize: PaperSize; orientation: Orientation
  pageGrid: PageGrid
  marginMm: number; hexSizeMm: number; hexOrientation: HexOrientation
  hexKm?: number
  maxW?: number; maxH?: number
  colors?: PaperPreviewColors
}) {
  const [pwMm, phMm] = paperDimsMm(paperSize, orientation)

  const scale = Math.min(maxW / (pwMm * pageGrid.cols), maxH / (phMm * pageGrid.rows))
  const sheetW = Math.round(pwMm * scale)
  const sheetH = Math.round(phMm * scale)
  const totalW = sheetW * pageGrid.cols
  const totalH = sheetH * pageGrid.rows
  const marginPx = marginMm * scale
  const hexR = Math.max(3.5, Math.min(14, (hexSizeMm / Math.sqrt(3)) * scale))

  const sq3 = Math.sqrt(3)
  const R_mm = hexSizeMm / sq3
  const iWMm = pwMm - 2 * marginMm
  const iHMm = phMm - 2 * marginMm
  let hexCols: number, hexRows: number
  if (hexOrientation === 'flat') {
    const maxQ = Math.max(0, Math.floor((iWMm / 2 - R_mm) / (1.5 * R_mm)))
    const maxR = Math.max(0, Math.floor((iHMm / 2 - (sq3 / 2) * R_mm) / (sq3 * R_mm)))
    hexCols = 2 * maxQ + 1; hexRows = 2 * maxR + 1
  } else {
    const maxR = Math.max(0, Math.floor((iHMm / 2 - R_mm) / (1.5 * R_mm)))
    const maxQ = Math.max(0, Math.floor((iWMm / 2 - (sq3 / 2) * R_mm) / (sq3 * R_mm)))
    hexCols = 2 * maxQ + 1; hexRows = 2 * maxR + 1
  }

  const totalPages = pageGrid.cols * pageGrid.rows

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <svg width={totalW} height={totalH} style={{ overflow: 'visible' }}>
        {Array.from({ length: pageGrid.rows }, (_, row) =>
          Array.from({ length: pageGrid.cols }, (_, col) => (
            <SheetPreview
              key={`${col}-${row}`}
              id={`sheet-${col}-${row}`}
              x={col * sheetW} y={row * sheetH}
              w={sheetW} h={sheetH}
              margin={marginPx}
              hexR={hexR}
              hexOrientation={hexOrientation}
              colors={colors}
            />
          ))
        )}
        {Array.from({ length: pageGrid.cols - 1 }, (_, col) => (
          <line
            key={`sv-${col}`}
            x1={(col + 1) * sheetW} y1={0}
            x2={(col + 1) * sheetW} y2={totalH}
            stroke={colors.margin} strokeWidth={1} strokeDasharray="3,2"
          />
        ))}
        {Array.from({ length: pageGrid.rows - 1 }, (_, row) => (
          <line
            key={`sh-${row}`}
            x1={0} y1={(row + 1) * sheetH}
            x2={totalW} y2={(row + 1) * sheetH}
            stroke={colors.margin} strokeWidth={1} strokeDasharray="3,2"
          />
        ))}
      </svg>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <div style={{ color: colors.labelPrimary, fontSize: 11 }}>
          {paperSize} · {orientation}{totalPages > 1 ? ` · ${pageGrid.cols}×${pageGrid.rows} pages` : ''}
        </div>
        <div style={{ color: colors.labelSecondary, fontSize: 10 }}>
          {hexCols} × {hexRows} hexes{hexKm > 0 ? ` · ${hexKm.toFixed(1)} km each` : ''}
        </div>
      </div>
    </div>
  )
}

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
