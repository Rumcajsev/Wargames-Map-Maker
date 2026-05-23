/** Historical Simple style — hachure strokes on downslope hex edges.
 *  For each elevated hex, finds edges where the neighbour is lower-ranked,
 *  then fans short strokes outward along those edges. */

import type { GeneratedHex } from '../store/mapStore'

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export type DrawHachuresParams = {
  projected: { hex: GeneratedHex; verts: [number, number][] }[]
  R: number
}

const HEX_DIRS: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]
const SNAP = 2
const vk = ([x, y]: [number, number]) => `${Math.round(x / SNAP)},${Math.round(y / SNAP)}`

const RANK: Record<string, number> = { mountains: 2, hills: 1, flat: 0 }
function rank(cls: string | null | undefined): number { return RANK[cls ?? ''] ?? 0 }

export function drawHachures(ctx: Ctx, params: DrawHachuresParams): void {
  const { projected, R } = params

  const hexMap = new Map<string, { hex: GeneratedHex; verts: [number, number][] }>()
  for (const p of projected) hexMap.set(`${p.hex.q},${p.hex.r}`, p)

  ctx.save()
  ctx.strokeStyle = '#3a2a14'
  ctx.lineCap = 'round'

  for (const { hex, verts } of projected) {
    const myRank = rank(hex.elevation_class)
    if (myRank === 0) continue

    const isMtn = hex.elevation_class === 'mountains'

    // Hex centre in canvas space
    const cx = verts.reduce((s, v) => s + v[0], 0) / 6
    const cy = verts.reduce((s, v) => s + v[1], 0) / 6

    for (const [dq, dr] of HEX_DIRS) {
      const nb = hexMap.get(`${hex.q + dq},${hex.r + dr}`)
      if (nb && rank(nb.hex.elevation_class) >= myRank) continue // same or higher — no slope

      // Find the two shared vertices between this hex and the neighbour.
      // If neighbour is off-map we skip (boundary edge — no hachures there).
      if (!nb) continue
      const nbKeys = new Set(nb.verts.map(vk))
      const shared = verts.filter(v => nbKeys.has(vk(v))) as [number, number][]
      if (shared.length < 2) continue

      const [v0, v1] = shared

      // Outward normal: from hex centre through edge midpoint
      const mx = (v0[0] + v1[0]) / 2
      const my = (v0[1] + v1[1]) / 2
      const ox = mx - cx, oy = my - cy
      const ol = Math.hypot(ox, oy)
      const nx = ox / ol, ny = oy / ol // unit outward normal (= downhill)

      // ── Primary row ────────────────────────────────────────────────────────
      const count = isMtn ? 8 : 5
      const strokeLen = isMtn ? R * 0.36 : R * 0.26
      ctx.lineWidth = R * (isMtn ? 0.028 : 0.022)

      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count
        const taper = Math.sin(t * Math.PI) // longer in centre, shorter near corners
        const len = strokeLen * (0.55 + 0.45 * taper)
        const sx = v0[0] + t * (v1[0] - v0[0])
        const sy = v0[1] + t * (v1[1] - v0[1])
        ctx.beginPath()
        ctx.moveTo(sx, sy)
        ctx.lineTo(sx + nx * len, sy + ny * len)
        ctx.stroke()
      }

      // ── Second inner row for mountains ────────────────────────────────────
      if (isMtn) {
        const inset = R * 0.09 // step back from edge toward hex centre
        const count2 = 5
        const len2 = strokeLen * 0.5
        ctx.lineWidth = R * 0.018

        for (let i = 0; i < count2; i++) {
          const t = (i + 0.5) / count2
          const taper = Math.sin(t * Math.PI)
          const len = len2 * (0.55 + 0.45 * taper)
          const sx = v0[0] + t * (v1[0] - v0[0]) - nx * inset
          const sy = v0[1] + t * (v1[1] - v0[1]) - ny * inset
          ctx.beginPath()
          ctx.moveTo(sx, sy)
          ctx.lineTo(sx + nx * len, sy + ny * len)
          ctx.stroke()
        }
      }
    }
  }

  ctx.restore()
}
