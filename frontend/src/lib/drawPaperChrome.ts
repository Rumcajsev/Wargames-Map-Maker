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
  const multiSheet = colWidths.length > 1 || rowHeights.length > 1

  // Keep line width and dash pattern constant in screen space regardless of zoom
  const lw = 1.5 / zoom
  const dash = 6 / zoom
  const gap = 4 / zoom
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)'
  ctx.lineWidth = lw
  ctx.setLineDash([dash, gap])

  if (!multiSheet) {
    ctx.strokeRect(px + mgPx, py + mgPx, pw - mgPx * 2, ph - mgPx * 2)
  } else {
    // One margin rect per sheet cell — the gap between adjacent rects shows the seam dead-zone
    let yAcc = 0
    for (let row = 0; row < rowHeights.length; row++) {
      const cellH = (ph * rowHeights[row]) / totalH
      const cellY = py + (ph * yAcc) / totalH
      let xAcc = 0
      for (let col = 0; col < colWidths.length; col++) {
        const cellW = (pw * colWidths[col]) / totalW
        const cellX = px + (pw * xAcc) / totalW
        ctx.strokeRect(cellX + mgPx, cellY + mgPx, cellW - mgPx * 2, cellH - mgPx * 2)
        xAcc += colWidths[col]
      }
      yAcc += rowHeights[row]
    }

    // Seam lines
    ctx.setLineDash([])
    ctx.strokeStyle = 'rgba(220, 60, 0, 0.9)'
    ctx.lineWidth = 2 / zoom
    ctx.beginPath()
    let xAcc2 = 0
    for (let i = 0; i < colWidths.length - 1; i++) {
      xAcc2 += colWidths[i]
      const x = px + (pw * xAcc2) / totalW
      ctx.moveTo(x, py)
      ctx.lineTo(x, py + ph)
    }
    let yAcc2 = 0
    for (let j = 0; j < rowHeights.length - 1; j++) {
      yAcc2 += rowHeights[j]
      const y = py + (ph * yAcc2) / totalH
      ctx.moveTo(px, y)
      ctx.lineTo(px + pw, y)
    }
    ctx.stroke()
  }

  ctx.setLineDash([])
}
