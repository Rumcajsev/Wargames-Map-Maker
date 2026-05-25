/** Paper background, shadow, margin indicator, and page-grid seams. Pure canvas — no React or store imports. */

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
  pageGrid: { cols: number; rows: number }
}

export function drawPaperMargin(p: DrawPaperMarginParams): void {
  const { ctx, px, py, pw, ph, mgPx, zoom, pageGrid } = p
  const { cols, rows } = pageGrid

  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = 0.75
  ctx.setLineDash([4, 4])
  ctx.strokeRect(px + mgPx, py + mgPx, pw - mgPx * 2, ph - mgPx * 2)
  ctx.setLineDash([])

  if (cols > 1 || rows > 1) {
    ctx.strokeStyle = 'rgba(220, 60, 0, 0.9)'
    ctx.lineWidth = 2 / zoom
    ctx.beginPath()
    for (let i = 1; i < cols; i++) {
      const x = px + (pw * i) / cols
      ctx.moveTo(x, py)
      ctx.lineTo(x, py + ph)
    }
    for (let j = 1; j < rows; j++) {
      const y = py + (ph * j) / rows
      ctx.moveTo(px, y)
      ctx.lineTo(px + pw, y)
    }
    ctx.stroke()
  }
}
