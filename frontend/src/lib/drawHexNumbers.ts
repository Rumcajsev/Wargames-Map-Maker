/** Hex COLROW number rendering. Pure canvas — no React or store imports. */

import type { GeneratedHex } from '../store/mapStore'

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export type HexNumberParams = {
  ctx: Ctx
  projected: { hex: GeneratedHex; verts: [number, number][] }[]
  numberMap: Map<string, string>
  /** 0–5 = edge index, 6 = center */
  edgeIndex: number
  color: string
  fontScale: number
  R: number
  edgeMode: string
  inMargin: (verts: [number, number][]) => boolean
}

function axialToOffset(q: number, r: number, flatTop: boolean): { col: number; row: number } {
  if (flatTop) {
    return { col: q, row: r + (q >> 1) }
  } else {
    return { col: q + (r >> 1), row: r }
  }
}

export function buildHexNumberMap(
  hexes: GeneratedHex[],
  hexOrientation: 'flat' | 'pointy',
  startCorner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
): Map<string, string> {
  const flatTop = hexOrientation === 'flat'
  const offsets = hexes.map(h => ({ hex: h, ...axialToOffset(h.q, h.r, flatTop) }))

  let minCol = Infinity, maxCol = -Infinity
  let minRow = Infinity, maxRow = -Infinity
  for (const { col, row } of offsets) {
    if (col < minCol) minCol = col
    if (col > maxCol) maxCol = col
    if (row < minRow) minRow = row
    if (row > maxRow) maxRow = row
  }

  const flipCol = startCorner === 'top-right' || startCorner === 'bottom-right'
  const flipRow = startCorner === 'bottom-left' || startCorner === 'bottom-right'

  const result = new Map<string, string>()
  for (const { hex, col, row } of offsets) {
    const c = flipCol ? maxCol - col + 1 : col - minCol + 1
    const r = flipRow ? maxRow - row + 1 : row - minRow + 1
    result.set(`${hex.q},${hex.r}`, String(c).padStart(2, '0') + String(r).padStart(2, '0'))
  }
  return result
}

/**
 * Compute the rotation angle and text baseline for a label placed at a hex edge.
 *
 * Strategy:
 *   1. Take the edge direction angle (V[i] → V[i+1]).
 *   2. Normalise to (−π/2, π/2] so text always reads left-to-right.
 *   3. Determine whether the text's natural "up" direction (perpendicular to
 *      the normalised edge, rotated 90° CCW) faces toward or away from the edge.
 *      If toward → baseline='top' (top of glyphs hugs the edge).
 *      If away   → baseline='bottom' (bottom of glyphs hugs the edge, text
 *                  hangs inward and stays readable after the flip).
 */
function edgeTransform(
  cx: number, cy: number,
  verts: [number, number][],
  edgeIndex: number,
): { angle: number; baseline: CanvasTextBaseline } {
  const n = verts.length
  const v0 = verts[edgeIndex % n]
  const v1 = verts[(edgeIndex + 1) % n]

  let angle = Math.atan2(v1[1] - v0[1], v1[0] - v0[0])

  // Normalise so cos(angle) ≥ 0 (text reads left-to-right)
  if (Math.cos(angle) < 0) angle += Math.PI

  // Text "up" direction after rotation: (sin θ, −cos θ) in canvas space
  const upX = Math.sin(angle)
  const upY = -Math.cos(angle)

  // Outward normal: from hex centre toward edge midpoint
  const mx = (v0[0] + v1[0]) / 2
  const my = (v0[1] + v1[1]) / 2
  const onX = mx - cx
  const onY = my - cy

  // If text "up" aligns with outward normal, top of text faces the edge
  const dot = upX * onX + upY * onY
  const baseline: CanvasTextBaseline = dot >= 0 ? 'top' : 'bottom'

  return { angle, baseline }
}

export function drawHexNumbers(params: HexNumberParams) {
  const { ctx, projected, numberMap, edgeIndex, color, fontScale, R, edgeMode, inMargin } = params

  const fontSize = Math.max(1, R * 0.12 * fontScale)
  ctx.save()
  ctx.font = `${fontSize}px Georgia, serif`
  ctx.fillStyle = color
  ctx.textAlign = 'center'

  for (const { hex, verts } of projected) {
    if (edgeMode === 'whole' && hex.partial) continue
    if (!hex.partial && !inMargin(verts)) continue

    const label = numberMap.get(`${hex.q},${hex.r}`)
    if (!label) continue

    const n = verts.length
    let cx = 0, cy = 0
    for (const [x, y] of verts) { cx += x; cy += y }
    cx /= n; cy /= n

    if (edgeIndex === 6) {
      ctx.textBaseline = 'middle'
      ctx.fillText(label, cx, cy)
      continue
    }

    const v0 = verts[edgeIndex % n]
    const v1 = verts[(edgeIndex + 1) % n]
    const mx = (v0[0] + v1[0]) / 2
    const my = (v0[1] + v1[1]) / 2

    // Anchor: edge midpoint pulled slightly inward so text doesn't overlap the border line
    const inset = 0.06
    const tx = mx + (cx - mx) * inset
    const ty = my + (cy - my) * inset

    const { angle, baseline } = edgeTransform(cx, cy, verts, edgeIndex)

    ctx.save()
    ctx.translate(tx, ty)
    ctx.rotate(angle)
    ctx.textBaseline = baseline
    ctx.fillText(label, 0, 0)
    ctx.restore()
  }

  ctx.restore()
}
