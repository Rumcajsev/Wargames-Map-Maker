/** River and canal layer rendering. Pure canvas operations — no React or store imports. */

import type { RiverStyleConfig } from '../store/mapStore'
import { riverSmooth, applyWobble, drawVariableWidthStroke } from './riverChains'

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

type SegProps = Record<string, { width?: number; taper?: number; taperRange?: [number, number] }>
type HopProps = { wiggleAmp?: number; wiggleFreq?: number; width?: number; taper?: number }

export type ChainEntry = {
  vertices: [number, number][]
  segKey: string
  hopKeys?: string[]
  hopRanges?: [number, number][]
}

export type DrawRiversParams = {
  riverChainData: ChainEntry[]
  canalChainData: ChainEntry[]
  riverHopProps?: Record<string, HopProps>
  selectedHopKey?: string | null
  riverSegProps: SegProps
  canalSegProps: SegProps
  riverStyle: RiverStyleConfig
  canalStyle: RiverStyleConfig
  selectedRiverKeys: Set<string>
  selectedCanalKeys: Set<string>
  riverBaseHW: number
  canalBaseHW: number
  lakeProjCenters: { px: number; py: number }[]
  smoothPasses: number
  wobbleBroad: number
  wobbleDetail: number
  R: number
  project: (lon: number, lat: number) => [number, number]
}

function makeSegHalfWidths(segProps: SegProps, baseHW: number) {
  const fixedHW = 1.4
  return (segKey: string): [number, number] => {
    const p = segProps[segKey]
    const taper = p?.taper ?? 0
    const [t0, t1] = p?.taperRange ?? [0, 1]
    const hwFull = p?.width !== undefined ? fixedHW * p.width : baseHW
    const hwNarrow = hwFull * (1 - taper * 0.85)
    return [hwNarrow + (hwFull - hwNarrow) * t0, hwNarrow + (hwFull - hwNarrow) * t1]
  }
}

function buildWidthMultipliers(
  pts: [number, number][],
  hopKeys: string[] | undefined,
  hopRanges: [number, number][] | undefined,
  hopProps: Record<string, HopProps> | undefined,
): number[] | undefined {
  if (!hopKeys || !hopRanges || !hopProps) return undefined
  const hasWidth = hopKeys.some(k => hopProps[k]?.width !== undefined || hopProps[k]?.taper !== undefined)
  if (!hasWidth) return undefined
  const mults = new Array(pts.length).fill(1)
  for (let h = 0; h < hopKeys.length; h++) {
    const hp = hopProps[hopKeys[h]]
    if (!hp?.width && !hp?.taper) continue
    const [s, e] = hopRanges[h]
    const w = hp.width ?? 1
    const taper = hp.taper ?? 0
    const len = e - s
    for (let i = s; i <= e; i++) {
      const t = len > 0 ? (i - s) / len : 0.5
      const taperFactor = 1 - taper * Math.sin(t * Math.PI) * 0.85
      mults[i] = w * taperFactor
    }
  }
  return mults
}

function drawRiverLayer(
  rCtx: Ctx,
  chainData: ChainEntry[],
  segProps: SegProps,
  style: RiverStyleConfig,
  selectedKeys: Set<string>,
  selectedHopKey: string | null | undefined,
  baseHW: number,
  drawMouths: boolean,
  lakeProjCenters: { px: number; py: number }[],
  R: number,
  smoothPasses: number,
  wobbleBroad: number,
  wobbleDetail: number,
  hopProps: Record<string, HopProps> | undefined,
  project: (lon: number, lat: number) => [number, number],
) {
  const segHalfWidths = makeSegHalfWidths(segProps, baseHW)

  const projected = chainData
    .filter(({ vertices }) => vertices.length >= 2)
    .map(({ vertices, segKey, hopKeys, hopRanges }) => {
      let pts = vertices.map(([lon, lat]) => project(lon, lat)) as [number, number][]
      if (smoothPasses > 0) pts = riverSmooth(pts, smoothPasses)
      if (wobbleBroad > 0 || wobbleDetail > 0) pts = applyWobble(pts, wobbleBroad, wobbleDetail, R, segKey)
      const widthMults = buildWidthMultipliers(pts, hopKeys, hopRanges, hopProps)
      return { pts, segKey, hw: segHalfWidths(segKey), hopKeys, hopRanges, widthMults }
    })

  // Pass 1: outline
  if (style.strokeEnabled) {
    for (const { pts, segKey, hw, widthMults } of projected) {
      if (selectedKeys.has(segKey)) continue
      const sw = hw[0] * style.strokeWidth
      const ew = hw[1] * style.strokeWidth
      drawVariableWidthStroke(rCtx, pts, hw[0] + sw, hw[1] + ew, style.strokeColor, widthMults)
    }
  }

  // Pass 2: fill
  for (const { pts, segKey, hw, widthMults } of projected) {
    if (selectedKeys.has(segKey)) continue
    drawVariableWidthStroke(rCtx, pts, hw[0], hw[1], style.color, widthMults)
  }

  // Pass 3: selected chains — outline → fill → glow → fill
  for (const { pts, segKey, hw, hopKeys, hopRanges, widthMults } of projected) {
    if (!selectedKeys.has(segKey)) continue
    if (style.strokeEnabled) {
      const sw = hw[0] * style.strokeWidth
      const ew = hw[1] * style.strokeWidth
      drawVariableWidthStroke(rCtx, pts, hw[0] + sw, hw[1] + ew, style.strokeColor, widthMults)
    }
    drawVariableWidthStroke(rCtx, pts, hw[0], hw[1], style.color, widthMults)
    drawVariableWidthStroke(rCtx, pts, hw[0] + 3, hw[1] + 3, 'rgba(100,180,255,0.35)', widthMults)
    drawVariableWidthStroke(rCtx, pts, hw[0], hw[1], style.color, widthMults)

    // Highlight selected hop within this chain
    if (selectedHopKey && hopKeys && hopRanges) {
      const hi = hopKeys.indexOf(selectedHopKey)
      if (hi >= 0) {
        const [s, e] = hopRanges[hi]
        const hopPts = pts.slice(s, e + 1)
        const hopMults = widthMults?.slice(s, e + 1)

        // Dim the non-selected portions so the hop stands out
        rCtx.save()
        rCtx.globalAlpha = 0.55
        if (s > 0)
          drawVariableWidthStroke(rCtx, pts.slice(0, s + 1), hw[0], hw[1], '#08101a', widthMults?.slice(0, s + 1))
        if (e < pts.length - 1)
          drawVariableWidthStroke(rCtx, pts.slice(e), hw[0], hw[1], '#08101a', widthMults?.slice(e))
        rCtx.restore()

        // Thin amber border, then hop fill — both use hopMults so they reflect current edits
        drawVariableWidthStroke(rCtx, hopPts, hw[0] + 1.5, hw[1] + 1.5, 'rgba(255,200,50,0.9)', hopMults)
        drawVariableWidthStroke(rCtx, hopPts, hw[0], hw[1], style.color, hopMults)

        // Boundary dots at hop endpoints
        rCtx.save()
        rCtx.fillStyle = 'rgba(255,200,50,0.9)'
        for (const [bx, by] of [hopPts[0], hopPts[hopPts.length - 1]] as [number, number][]) {
          rCtx.beginPath(); rCtx.arc(bx, by, 3, 0, Math.PI * 2); rCtx.fill()
        }
        rCtx.restore()
      }
    }
  }

  if (drawMouths) {
    const drawnEntryKeys = new Set<string>()
    for (const { pts: pxPts } of projected) {
      const check = (endPt: [number, number]) => {
        const [ex, ey] = endPt
        for (const { px: lpx, py: lpy } of lakeProjCenters) {
          if (Math.hypot(ex - lpx, ey - lpy) < R * 1.1) {
            const k = `${Math.round(ex * 10)},${Math.round(ey * 10)}`
            if (drawnEntryKeys.has(k)) break
            drawnEntryKeys.add(k)
            const dx = lpx - ex, dy = lpy - ey, len = Math.hypot(dx, dy)
            const flareLen = Math.min(len * 0.45, R * 0.45)
            rCtx.save(); rCtx.lineCap = 'round'
            rCtx.lineWidth = R * 0.22; rCtx.strokeStyle = style.color
            rCtx.beginPath(); rCtx.moveTo(ex, ey)
            rCtx.lineTo(ex + dx / len * flareLen, ey + dy / len * flareLen); rCtx.stroke()
            rCtx.restore(); break
          }
        }
      }
      check(pxPts[0]); check(pxPts[pxPts.length - 1])
    }
  }
}

export function drawRivers(rCtx: Ctx, params: DrawRiversParams) {
  const {
    riverChainData, canalChainData,
    riverSegProps, canalSegProps,
    riverStyle, canalStyle,
    selectedRiverKeys, selectedCanalKeys,
    riverBaseHW, canalBaseHW,
    lakeProjCenters, smoothPasses, wobbleBroad, wobbleDetail, R,
    riverHopProps, selectedHopKey,
    project,
  } = params

  drawRiverLayer(rCtx, canalChainData, canalSegProps, canalStyle, selectedCanalKeys,
    null, canalBaseHW, false, lakeProjCenters, R, smoothPasses, 0, 0, undefined, project)

  drawRiverLayer(rCtx, riverChainData, riverSegProps, riverStyle, selectedRiverKeys,
    selectedHopKey, riverBaseHW, true, lakeProjCenters, R, smoothPasses, wobbleBroad, wobbleDetail, riverHopProps, project)
}
