import type { GeneratedHex } from '../store/mapStore'

export interface DrawElevationDebugParams {
  ctx: CanvasRenderingContext2D
  projected: Array<{ hex: GeneratedHex; verts: [number, number][] }>
  R: number
}

const CLASS_BG: Record<string, string> = {
  flat:      'rgba(30,80,30,0.72)',
  hills:     'rgba(90,80,20,0.72)',
  mountains: 'rgba(110,50,15,0.72)',
}
const DEFAULT_BG = 'rgba(0,0,0,0.60)'

export function drawElevationDebug({ ctx, projected, R }: DrawElevationDebugParams): void {
  const fontSize = Math.min(7, Math.max(4, Math.round(R * 0.038)))
  ctx.save()
  ctx.font = `${fontSize}px ui-monospace, monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (const { hex, verts } of projected) {
    if (hex.elevation_avg_m == null && hex.elevation_max_m == null) continue

    let cx = 0, cy = 0
    for (const [x, y] of verts) { cx += x; cy += y }
    cx /= verts.length
    cy /= verts.length

    const avgText = hex.elevation_avg_m != null ? `avg ${Math.round(hex.elevation_avg_m)}m` : ''
    const maxText = hex.elevation_max_m != null ? `max ${Math.round(hex.elevation_max_m)}m` : ''
    const lineH = fontSize + 1
    const totalH = (avgText && maxText ? 2 : 1) * lineH
    const w = Math.max(
      ctx.measureText(avgText).width,
      ctx.measureText(maxText).width,
    ) + 4

    ctx.fillStyle = hex.elevation_class ? (CLASS_BG[hex.elevation_class] ?? DEFAULT_BG) : DEFAULT_BG
    ctx.fillRect(cx - w / 2, cy - totalH / 2 - 1, w, totalH + 2)

    ctx.fillStyle = '#e8e8ff'
    if (avgText && maxText) {
      ctx.fillText(avgText, cx, cy - lineH / 2)
      ctx.fillText(maxText, cx, cy + lineH / 2)
    } else {
      ctx.fillText(avgText || maxText, cx, cy)
    }
  }

  ctx.restore()
}
