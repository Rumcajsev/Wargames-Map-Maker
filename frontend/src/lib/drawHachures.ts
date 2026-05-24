/** Historical Simple style — hill hatching along group-boundary contours.
 *  Groups adjacent hill/mountain hexes, traces their outer boundary polygon,
 *  then draws outward quadratic-bezier hachure strokes along it. */

import type { GeneratedHex } from '../store/mapStore'
import { resampleClosed, gaussianSmoothClosed } from './drawHighlights'

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export type DrawHachuresParams = {
  projected: { hex: GeneratedHex; verts: [number, number][] }[]
  R: number
  hachureParams: { spacing: number; length: number; wobble: number; jitter: number; hillWidth: number; mtnWidth: number; smoothing: number }
}

const HEX_DIRS: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]
const SNAP = 2
const vk = ([x, y]: [number, number]) => `${Math.round(x / SNAP)},${Math.round(y / SNAP)}`

const RANK: Record<string, number> = { mountains: 2, hills: 1 }
function rank(cls: string | null | undefined): number { return RANK[cls ?? ''] ?? 0 }

function mulberry32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Positive = CW in canvas coords (Y-down)
function signedArea(pts: [number, number][]): number {
  let a = 0
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % n]
    a += x0 * y1 - x1 * y0
  }
  return a / 2
}

function drawRingHatching(
  ctx: Ctx,
  ring: [number, number][],
  isMtn: boolean,
  hp: { spacing: number; length: number; wobble: number; jitter: number; hillWidth: number; mtnWidth: number },
): void {
  const n = ring.length
  const seed = Math.abs(Math.round(ring[0][0] * 73 + ring[0][1] * 97))
  const rng = mulberry32(seed)

  // Outward normal: tangent rotated 90°, direction depends on winding.
  // CW polygon (area > 0 in canvas): outward = (tanY, -tanX)
  // CCW polygon (area < 0 in canvas): outward = (-tanY, tanX)
  const windSign = signedArea(ring) > 0 ? 1 : -1

  const baseSpacing = hp.spacing
  const baseLen = hp.length
  const wobble = hp.wobble
  const jitter = hp.jitter
  const baseWidth = isMtn ? hp.mtnWidth : hp.hillWidth

  let target = rng() * baseSpacing  // randomised start offset
  let arcSoFar = 0

  for (let i = 0; i < n; i++) {
    const a = ring[i], b = ring[(i + 1) % n]
    const dx = b[0] - a[0], dy = b[1] - a[1]
    const segLen = Math.hypot(dx, dy)
    if (segLen < 1e-6) continue
    const tx = dx / segLen, ty = dy / segLen

    const nx = windSign * ty
    const ny = windSign * (-tx)

    while (arcSoFar + segLen >= target) {
      const t = (target - arcSoFar) / segLen
      const px = a[0] + t * dx
      const py = a[1] + t * dy

      const angle = (rng() * 2 - 1) * jitter
      const cos = Math.cos(angle), sin = Math.sin(angle)
      const jnx = nx * cos - ny * sin
      const jny = nx * sin + ny * cos

      const len = baseLen * (0.875 + rng() * 0.25)

      const sx = px - jnx * len * 0.25 + (rng() - 0.5) * wobble
      const sy = py - jny * len * 0.25 + (rng() - 0.5) * wobble
      const ex = px + jnx * len * 0.75 + (rng() - 0.5) * wobble
      const ey = py + jny * len * 0.75 + (rng() - 0.5) * wobble

      const cpx = (sx + ex) / 2 + (rng() - 0.5) * wobble * 2.5
      const cpy = (sy + ey) / 2 + (rng() - 0.5) * wobble * 2.5

      ctx.globalAlpha = 0.55 + rng() * 0.33
      ctx.lineWidth = baseWidth * (0.625 + rng() * 0.75)

      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.quadraticCurveTo(cpx, cpy, ex, ey)
      ctx.stroke()

      target += baseSpacing * (0.75 + rng() * 0.6)
    }

    arcSoFar += segLen
  }
}

export function drawHachures(ctx: Ctx, params: DrawHachuresParams): void {
  const { projected, hachureParams, R } = params

  const hexMap = new Map<string, { hex: GeneratedHex; verts: [number, number][] }>()
  for (const p of projected) hexMap.set(`${p.hex.q},${p.hex.r}`, p)

  ctx.save()
  ctx.strokeStyle = '#3a2a14'
  ctx.lineCap = 'round'

  for (const elevClass of ['hills', 'mountains'] as const) {
    const isMtn = elevClass === 'mountains'
    const myRank = isMtn ? 2 : 1

    // Collect boundary edges: edges where the neighbour has a lower rank.
    // Hills: border against flat. Mountains: border against hills or flat.
    const vpos = new Map<string, [number, number]>()
    const adj = new Map<string, Set<string>>()

    for (const { hex, verts } of projected) {
      if (rank(hex.elevation_class) !== myRank) continue

      for (const [dq, dr] of HEX_DIRS) {
        const nb = hexMap.get(`${hex.q + dq},${hex.r + dr}`)
        if (!nb || rank(nb.hex.elevation_class) >= myRank) continue

        const nbKeys = new Set(nb.verts.map(vk))
        const shared = verts.filter(v => nbKeys.has(vk(v))) as [number, number][]
        if (shared.length < 2) continue

        const k0 = vk(shared[0]), k1 = vk(shared[1])
        if (!vpos.has(k0)) vpos.set(k0, shared[0])
        if (!vpos.has(k1)) vpos.set(k1, shared[1])
        if (!adj.has(k0)) adj.set(k0, new Set())
        if (!adj.has(k1)) adj.set(k1, new Set())
        adj.get(k0)!.add(k1)
        adj.get(k1)!.add(k0)
      }
    }

    // Trace closed rings from the boundary edge graph.
    const visitedEdges = new Set<string>()
    const visitedVerts = new Set<string>()

    for (const [startKey] of adj) {
      if (visitedVerts.has(startKey)) continue

      const ring: [number, number][] = []
      let cur = startKey

      for (;;) {
        visitedVerts.add(cur)
        ring.push(vpos.get(cur)!)
        let next: string | null = null
        for (const n of adj.get(cur) ?? []) {
          const ek = cur < n ? `${cur}|${n}` : `${n}|${cur}`
          if (!visitedEdges.has(ek)) { visitedEdges.add(ek); next = n; break }
        }
        if (!next || next === startKey) break
        cur = next
      }

      if (ring.length < 3) continue
      let contour: [number, number][] = ring
      if (hachureParams.smoothing > 0) {
        const resampled = resampleClosed(ring, R / 4)
        const sigma = Math.min(hachureParams.smoothing * 2, resampled.length / 10)
        contour = gaussianSmoothClosed(resampled, Math.max(1, sigma))
      }
      drawRingHatching(ctx, contour, isMtn, hachureParams)
    }
  }

  ctx.restore()
}
