import type { PaperSize, Orientation, HexOrientation, MapMode, DiptychJoin } from '../store/mapStore'
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
  paperSize, orientation, mapMode, diptychJoin,
  marginMm, hexSizeMm, hexOrientation,
  hexKm = 0,
  maxW = 260, maxH = 280,
  colors = PAPER_PREVIEW_DARK,
}: {
  paperSize: PaperSize; orientation: Orientation
  mapMode: MapMode; diptychJoin: DiptychJoin
  marginMm: number; hexSizeMm: number; hexOrientation: HexOrientation
  hexKm?: number
  maxW?: number; maxH?: number
  colors?: PaperPreviewColors
}) {
  const [pwMm, phMm] = paperDimsMm(paperSize, orientation)

  let totalWMm = pwMm, totalHMm = phMm
  if (mapMode === 'diptych') {
    if (diptychJoin === 'long') totalWMm = 2 * pwMm
    else totalHMm = 2 * phMm
  }

  const scale = Math.min(maxW / totalWMm, maxH / totalHMm)
  const totalW = Math.round(totalWMm * scale)
  const totalH = Math.round(totalHMm * scale)
  const sheetW = Math.round(pwMm * scale)
  const sheetH = Math.round(phMm * scale)
  const marginPx = marginMm * scale
  const hexR = Math.max(3.5, Math.min(14, (hexSizeMm / Math.sqrt(3)) * scale))

  const sq3 = Math.sqrt(3)
  const R_mm = hexSizeMm / sq3
  const iWMm = pwMm - 2 * marginMm
  const iHMm = phMm - 2 * marginMm
  let cols: number, rows: number
  if (hexOrientation === 'flat') {
    const maxQ = Math.max(0, Math.floor((iWMm / 2 - R_mm) / (1.5 * R_mm)))
    const maxR = Math.max(0, Math.floor((iHMm / 2 - (sq3 / 2) * R_mm) / (sq3 * R_mm)))
    cols = 2 * maxQ + 1; rows = 2 * maxR + 1
  } else {
    const maxR = Math.max(0, Math.floor((iHMm / 2 - R_mm) / (1.5 * R_mm)))
    const maxQ = Math.max(0, Math.floor((iWMm / 2 - (sq3 / 2) * R_mm) / (sq3 * R_mm)))
    cols = 2 * maxQ + 1; rows = 2 * maxR + 1
  }

  const sheets = mapMode === 'diptych'
    ? diptychJoin === 'long'
      ? [{ x: 0, y: 0 }, { x: sheetW, y: 0 }]
      : [{ x: 0, y: 0 }, { x: 0, y: sheetH }]
    : [{ x: 0, y: 0 }]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <svg width={totalW} height={totalH} style={{ overflow: 'visible' }}>
        {sheets.map((s, i) => (
          <SheetPreview
            key={i}
            id={`sheet-${i}`}
            x={s.x} y={s.y}
            w={sheetW} h={sheetH}
            margin={marginPx}
            hexR={hexR}
            hexOrientation={hexOrientation}
            colors={colors}
          />
        ))}
        {mapMode === 'diptych' && (
          <line
            x1={diptychJoin === 'long' ? sheetW : 0}
            y1={diptychJoin === 'long' ? 0 : sheetH}
            x2={diptychJoin === 'long' ? sheetW : totalW}
            y2={diptychJoin === 'long' ? totalH : sheetH}
            stroke={colors.margin} strokeWidth={1} strokeDasharray="3,2"
          />
        )}
      </svg>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <div style={{ color: colors.labelPrimary, fontSize: 11 }}>
          {paperSize} · {orientation}{mapMode === 'diptych' ? ' · ×2' : ''}
        </div>
        <div style={{ color: colors.labelSecondary, fontSize: 10 }}>
          {cols} × {rows} hexes{hexKm > 0 ? ` · ${hexKm.toFixed(1)} km each` : ''}
        </div>
      </div>
    </div>
  )
}

function SheetPreview({ id, x, y, w, h, margin, hexR, hexOrientation, colors }: {
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
