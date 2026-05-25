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
  pageGrid: { colWidths: number[]; rowHeights: number[] }
}

export function drawPaperMargin(p: DrawPaperMarginParams): void {
  const { ctx, px, py, pw, ph, mgPx, zoom, pageGrid } = p
  const { colWidths, rowHeights } = pageGrid
  const totalW = colWidths.reduce((a, b) => a + b, 0)
  const totalH = rowHeights.reduce((a, b) => a + b, 0)

  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = 0.75
  ctx.setLineDash([4, 4])
  ctx.strokeRect(px + mgPx, py + mgPx, pw - mgPx * 2, ph - mgPx * 2)
  ctx.setLineDash([])

  if (colWidths.length > 1 || rowHeights.length > 1) {
    ctx.strokeStyle = 'rgba(220, 60, 0, 0.9)'
    ctx.lineWidth = 2 / zoom
    ctx.beginPath()
    let xAcc = 0
    for (let i = 0; i < colWidths.length - 1; i++) {
      xAcc += colWidths[i]
      const x = px + (pw * xAcc) / totalW
      ctx.moveTo(x, py)
      ctx.lineTo(x, py + ph)
    }
    let yAcc = 0
    for (let j = 0; j < rowHeights.length - 1; j++) {
      yAcc += rowHeights[j]
      const y = py + (ph * yAcc) / totalH
      ctx.moveTo(px, y)
      ctx.lineTo(px + pw, y)
    }
    ctx.stroke()
  }
}
