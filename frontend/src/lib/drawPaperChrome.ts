/** Paper background, shadow, margin indicator, and diptych seam. Pure canvas — no React or store imports. */

import { paperDimsMm, combinedDimsMm } from '../store/mapStore'

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export type DrawPaperBackgroundParams = {
  ctx: Ctx
  px: number
  py: number
  pw: number
  ph: number
  mapBgColor: string
}

export function drawPaperBackground(p: DrawPaperBackgroundParams): void {
  const { ctx, px, py, pw, ph, mapBgColor } = p
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 16
  ctx.fillStyle = mapBgColor
  ctx.fillRect(px, py, pw, ph)
  ctx.shadowBlur = 0
  ctx.shadowColor = 'transparent'
}

export type DrawPaperMarginParams = {
  ctx: Ctx
  px: number
  py: number
  pw: number
  ph: number
  mgPx: number
  zoom: number
  mapMode: string
  paperSize: string
  orientation: string
  diptychJoin: string
}

export function drawPaperMargin(p: DrawPaperMarginParams): void {
  const { ctx, px, py, pw, ph, mgPx, zoom, mapMode, paperSize, orientation, diptychJoin } = p

  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = 0.75
  ctx.setLineDash([4, 4])
  ctx.strokeRect(px + mgPx, py + mgPx, pw - mgPx * 2, ph - mgPx * 2)
  ctx.setLineDash([])

  if (mapMode === 'diptych') {
    const [spwMm, sphMm] = paperDimsMm(paperSize, orientation)
    const [scwMm] = combinedDimsMm(paperSize, orientation, mapMode, diptychJoin)
    const seamIsVertical = scwMm === 2 * spwMm
    ctx.strokeStyle = 'rgba(220, 60, 0, 0.9)'
    ctx.lineWidth = 2 / zoom
    ctx.beginPath()
    if (seamIsVertical) {
      ctx.moveTo(px + pw / 2, py)
      ctx.lineTo(px + pw / 2, py + ph)
    } else {
      ctx.moveTo(px, py + ph / 2)
      ctx.lineTo(px + pw, py + ph / 2)
    }
    ctx.stroke()
    void sphMm
  }
}
