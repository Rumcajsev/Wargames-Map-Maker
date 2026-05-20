/** Mega hex grid overlay — draws a coarser hexagonal grid on top of the small hex grid.
 *
 *  Lattice math: for radius R, each mega hex contains 3R²+3R+1 small hexes.
 *  Basis vectors: a1=(2R+1, -R), a2=(R, R+1), det=3R²+3R+1.
 *  Inverse: i=((R+1)*dq - R*dr)/N,  j=(R*dq + (2R+1)*dr)/N
 *  where dq,dr are relative to the origin hex. */

import type { GeneratedHex } from '../store/mapStore'

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export interface MegaHexGridParams {
  projected: { hex: GeneratedHex; verts: [number, number][] }[]
  radius: number
  color: string
  opacity: number
  lineWidth: number
  lineScale: number
  originQ: number
  originR: number
  edgeMode: string
  inMargin: (verts: [number, number][]) => boolean
}

function latticeIndex(
  q: number, r: number,
  originQ: number, originR: number,
  R: number,
  N: number,
): [number, number] {
  const dq = q - originQ
  const dr = r - originR
  const iFrac = ((R + 1) * dq - R * dr) / N
  const jFrac = (R * dq + (2 * R + 1) * dr) / N

  // Simple rounding fails for non-orthogonal lattices — test all 4 candidates
  // and pick whichever lattice center is closest in the axial metric.
  const iF = Math.floor(iFrac)
  const jF = Math.floor(jFrac)
  const a1q = 2 * R + 1, a1r = -R
  const a2q = R,         a2r = R + 1
  let bestI = iF, bestJ = jF, bestDist = Infinity
  for (let di = 0; di <= 1; di++) {
    for (let dj = 0; dj <= 1; dj++) {
      const i = iF + di, j = jF + dj
      const cq = originQ + i * a1q + j * a2q
      const cr = originR + i * a1r + j * a2r
      const ddq = q - cq, ddr = r - cr
      const dist = (Math.abs(ddq) + Math.abs(ddr) + Math.abs(ddq + ddr)) / 2
      if (dist < bestDist) { bestDist = dist; bestI = i; bestJ = j }
    }
  }
  return [bestI, bestJ]
}

export function drawMegaHexGrid(ctx: Ctx, params: MegaHexGridParams): void {
  const { projected, radius: R, color, opacity, lineWidth, lineScale, originQ, originR, edgeMode, inMargin } = params
  if (!projected.length || opacity <= 0 || lineWidth <= 0) return

  const N = 3 * R * R + 3 * R + 1

  // Group projected hexes by their lattice index (i, j)
  const groups = new Map<string, { hex: GeneratedHex; verts: [number, number][] }[]>()
  for (const entry of projected) {
    const { hex, verts } = entry
    if (edgeMode === 'whole' && hex.partial) continue
    if (!hex.partial && !inMargin(verts)) continue
    const [i, j] = latticeIndex(hex.q, hex.r, originQ, originR, R, N)
    const key = `${i},${j}`
    let g = groups.get(key)
    if (!g) { g = []; groups.set(key, g) }
    g.push(entry)
  }

  // For each group, find outer edges (edges appearing exactly once)
  const vKey = (v: [number, number]) => `${Math.round(v[0] * 10)},${Math.round(v[1] * 10)}`
  type DirEdge = [[number, number], [number, number]]

  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth * lineScale
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.globalAlpha = opacity

  for (const entries of groups.values()) {
    if (entries.length === 0) continue

    const edgeCount = new Map<string, number>()
    const allDirEdges: DirEdge[] = []

    for (const { verts } of entries) {
      for (let i = 0; i < 6; i++) {
        const v1 = verts[i], v2 = verts[(i + 1) % 6]
        const k1 = vKey(v1), k2 = vKey(v2)
        const ek = k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`
        edgeCount.set(ek, (edgeCount.get(ek) ?? 0) + 1)
        allDirEdges.push([v1, v2])
      }
    }

    const outerEdges: DirEdge[] = allDirEdges.filter(([v1, v2]) => {
      const k1 = vKey(v1), k2 = vKey(v2)
      const ek = k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`
      return edgeCount.get(ek) === 1
    })
    if (outerEdges.length === 0) continue

    const edgeMap = new Map<string, DirEdge>()
    for (const e of outerEdges) edgeMap.set(vKey(e[0]), e)

    const remaining = new Set(edgeMap.keys())
    while (remaining.size > 0) {
      const startKey = remaining.values().next().value as string
      const poly: [number, number][] = []
      let key = startKey
      while (remaining.has(key)) {
        remaining.delete(key)
        const [from, to] = edgeMap.get(key)!
        poly.push(from)
        key = vKey(to)
      }
      if (poly.length < 3) continue
      ctx.beginPath()
      ctx.moveTo(poly[0][0], poly[0][1])
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1])
      ctx.closePath()
      ctx.stroke()
    }
  }

  ctx.restore()
}
