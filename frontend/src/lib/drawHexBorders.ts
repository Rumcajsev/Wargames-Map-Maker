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
    } else {
      bCtx.fillStyle = 'rgba(0,0,0,0.5)'
      for (const [x, y] of verts) {
        bCtx.beginPath()
        bCtx.arc(x, y, 1, 0, Math.PI * 2)
        bCtx.fill()
      }
    }
  }
}
