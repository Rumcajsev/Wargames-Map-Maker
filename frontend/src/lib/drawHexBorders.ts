/** Hex grid border rendering. Pure canvas operations — no React or store imports. */

import type { GeneratedHex } from '../store/mapStore'

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export function drawHexBorders(
  bCtx: Ctx,
  projected: { hex: GeneratedHex; verts: [number, number][] }[],
  borderMode: string,
  edgeMode: string,
  inMargin: (verts: [number, number][]) => boolean,
) {
  for (const { hex, verts } of projected) {
    if (edgeMode === 'whole' && hex.partial) continue
    if (!hex.partial && !inMargin(verts)) continue
    if (borderMode === 'full') {
      bCtx.beginPath()
      bCtx.moveTo(verts[0][0], verts[0][1])
      for (let i = 1; i < verts.length; i++) bCtx.lineTo(verts[i][0], verts[i][1])
      bCtx.closePath()
      bCtx.strokeStyle = 'rgba(0,0,0,0.35)'
      bCtx.lineWidth = 0.5
      bCtx.stroke()
    } else if (borderMode === 'stubs') {
      bCtx.strokeStyle = 'rgba(0,0,0,0.35)'
      bCtx.lineWidth = 0.5
      for (let i = 0; i < verts.length; i++) {
        const [x0, y0] = verts[i]
        const [x1, y1] = verts[(i + 1) % verts.length]
        const t = 0.22
        bCtx.beginPath()
        bCtx.moveTo(x0, y0)
        bCtx.lineTo(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)
        bCtx.stroke()
        bCtx.beginPath()
        bCtx.moveTo(x1 + (x0 - x1) * t, y1 + (y0 - y1) * t)
        bCtx.lineTo(x1, y1)
        bCtx.stroke()
      }
    }
  }
}
