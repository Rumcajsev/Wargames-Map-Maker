/** River and canal layer rendering. Pure canvas operations — no React or store imports. */

import type { RiverStyleConfig } from '../store/mapStore'
import { riverSmooth, applyWobble, drawVariableWidthStroke } from './riverChains'

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

type SegProps = Record<string, { width?: number; taper?: number; taperRange?: [number, number] }>

export type DrawRiversParams = {
  riverChainData: { vertices: [number, number][]; segKey: string }[]
  canalChainData: { vertices: [number, number][]; segKey: string }[]
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

function drawRiverLayer(
  rCtx: Ctx,
  chainData: { vertices: [number, number][]; segKey: string }[],
  segProps: SegProps,
  style: RiverStyleConfig,
  selectedKeys: Set<string>,
  baseHW: number,
  drawMouths: boolean,
  lakeProjCenters: { px: number; py: number }[],
  R: number,
  smoothPasses: number,
  wobbleBroad: number,
  wobbleDetail: number,
  project: (lon: number, lat: number) => [number, number],
) {
  const segHalfWidths = makeSegHalfWidths(segProps, baseHW)

  const projected = chainData
    .filter(({ vertices }) => vertices.length >= 2)
    .map(({ vertices, segKey }) => {
      let pts = vertices.map(([lon, lat]) => project(lon, lat)) as [number, number][]
      if (smoothPasses > 0) pts = riverSmooth(pts, smoothPasses)
      if (wobbleBroad > 0 || wobbleDetail > 0) pts = applyWobble(pts, wobbleBroad, wobbleDetail, R, segKey)
      return { pts, segKey, hw: segHalfWidths(segKey) }
    })

  // Pass 1: outline (fill covers it, leaving only the visible border)
  if (style.strokeEnabled) {
    for (const { pts, segKey, hw } of projected) {
      if (selectedKeys.has(segKey)) continue
      const sw = hw[0] * style.strokeWidth
      const ew = hw[1] * style.strokeWidth
      drawVariableWidthStroke(rCtx, pts, hw[0] + sw, hw[1] + ew, style.strokeColor)
    }
  }

  // Pass 2: fill
  for (const { pts, segKey, hw } of projected) {
    if (selectedKeys.has(segKey)) continue
    drawVariableWidthStroke(rCtx, pts, hw[0], hw[1], style.color)
  }

  // Pass 3: selected chains — outline → fill → glow → fill
  for (const { pts, segKey, hw } of projected) {
    if (!selectedKeys.has(segKey)) continue
    if (style.strokeEnabled) {
      const sw = hw[0] * style.strokeWidth
      const ew = hw[1] * style.strokeWidth
      drawVariableWidthStroke(rCtx, pts, hw[0] + sw, hw[1] + ew, style.strokeColor)
    }
    drawVariableWidthStroke(rCtx, pts, hw[0], hw[1], style.color)
    drawVariableWidthStroke(rCtx, pts, hw[0] + 3, hw[1] + 3, 'rgba(100,180,255,0.35)')
    drawVariableWidthStroke(rCtx, pts, hw[0], hw[1], style.color)
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
    lakeProjCenters, smoothPasses, wobbleBroad, wobbleDetail, R, project,
  } = params

  // Canals first (underneath rivers)
  drawRiverLayer(rCtx, canalChainData, canalSegProps, canalStyle, selectedCanalKeys,
    canalBaseHW, false, lakeProjCenters, R, smoothPasses, 0, 0, project)

  // Rivers on top with organic wobble
  drawRiverLayer(rCtx, riverChainData, riverSegProps, riverStyle, selectedRiverKeys,
    riverBaseHW, true, lakeProjCenters, R, smoothPasses, wobbleBroad, wobbleDetail, project)
}
