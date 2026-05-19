/** Highlight layer rendering — area fills, joined borders, and line-pattern decorators.
 *  All functions are pure canvas operations; no React or store imports. */

import type { HexHighlight, GeneratedHex } from '../store/mapStore'

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
type LinePattern = 'dotted' | 'dashed' | 'dashdot'

// ── Path sampler ─────────────────────────────────────────────────────────────

export type PathSampler = {
  totalLen: number
  pointAt: (d: number, perpOffset: number, rightSign: number) => [number, number]
  tangentAt: (d: number) => { ux: number; uy: number }
  segStarts: number[]
  cornerDs: number[]
}

export function buildPathSampler(pts: [number, number][], closed: boolean): PathSampler | null {
  if (pts.length < 2) return null
  const segs: { cumStart: number; a: [number, number]; ux: number; uy: number }[] = []
  let totalLen = 0
  const n = pts.length
  const limit = closed ? n : n - 1
  for (let i = 0; i < limit; i++) {
    const a = pts[i], b = pts[(i + 1) % n]
    const dx = b[0] - a[0], dy = b[1] - a[1]
    const len = Math.hypot(dx, dy)
    if (len < 1e-6) continue
    segs.push({ cumStart: totalLen, a, ux: dx / len, uy: dy / len })
    totalLen += len
  }
  if (totalLen < 1e-6 || segs.length === 0) return null
  const findSeg = (dd: number) => {
    let seg = segs[segs.length - 1]
    for (let i = 0; i < segs.length - 1; i++) {
      if (segs[i + 1].cumStart > dd) { seg = segs[i]; break }
    }
    return seg
  }
  const wrap = (d: number) =>
    closed ? ((d % totalLen) + totalLen) % totalLen : Math.max(0, Math.min(d, totalLen - 1e-6))
  const pointAt = (d: number, perpOffset: number, rightSign: number): [number, number] => {
    const seg = findSeg(wrap(d))
    const t = wrap(d) - seg.cumStart
    return [
      seg.a[0] + seg.ux * t + (-seg.uy) * perpOffset * rightSign,
      seg.a[1] + seg.uy * t + ( seg.ux) * perpOffset * rightSign,
    ]
  }
  const tangentAt = (d: number) => { const seg = findSeg(wrap(d)); return { ux: seg.ux, uy: seg.uy } }
  const segStarts = segs.map(s => s.cumStart)
  const CORNER_COS = Math.cos(Math.PI / 12)
  const cornerDs: number[] = []
  for (let i = 1; i < segs.length; i++) {
    const dot = segs[i - 1].ux * segs[i].ux + segs[i - 1].uy * segs[i].uy
    if (dot < CORNER_COS) cornerDs.push(segs[i].cumStart)
  }
  return { totalLen, pointAt, tangentAt, segStarts, cornerDs }
}

// ── Polygon resampling / smoothing ───────────────────────────────────────────

export function resampleClosed(pts: [number, number][], spacing: number): [number, number][] {
  const n = pts.length
  const result: [number, number][] = []
  let carry = 0
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n]
    const dx = b[0] - a[0], dy = b[1] - a[1]
    const len = Math.hypot(dx, dy)
    if (len < 1e-6) continue
    const ux = dx / len, uy = dy / len
    let t = carry
    while (t < len) {
      result.push([a[0] + ux * t, a[1] + uy * t])
      t += spacing
    }
    carry = t - len
  }
  return result
}

/** Gaussian low-pass filter on a closed polygon treated as a periodic 1D signal.
 *  Unlike Chaikin this does not shrink the shape — it just removes high-frequency bumps. */
export function gaussianSmoothClosed(pts: [number, number][], sigma: number): [number, number][] {
  const n = pts.length
  const radius = Math.ceil(sigma * 3)
  const result: [number, number][] = []
  for (let i = 0; i < n; i++) {
    let sx = 0, sy = 0, w = 0
    for (let j = -radius; j <= radius; j++) {
      const k = ((i + j) % n + n) % n
      const weight = Math.exp(-(j * j) / (2 * sigma * sigma))
      sx += pts[k][0] * weight
      sy += pts[k][1] * weight
      w += weight
    }
    result.push([sx / w, sy / w])
  }
  return result
}

export function resampleOpen(pts: [number, number][], spacing: number): [number, number][] {
  if (pts.length < 2) return pts
  const result: [number, number][] = [pts[0]]
  let carry = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    const dx = b[0] - a[0], dy = b[1] - a[1]
    const len = Math.hypot(dx, dy)
    if (len < 1e-6) continue
    const ux = dx / len, uy = dy / len
    let t = carry + spacing
    while (t < len) {
      result.push([a[0] + ux * t, a[1] + uy * t])
      t += spacing
    }
    carry = t - len
  }
  result.push(pts[pts.length - 1])
  return result
}

export function gaussianSmoothOpen(pts: [number, number][], sigma: number): [number, number][] {
  const n = pts.length
  const radius = Math.ceil(sigma * 3)
  return pts.map((_, i) => {
    let sx = 0, sy = 0, w = 0
    for (let j = Math.max(0, i - radius); j <= Math.min(n - 1, i + radius); j++) {
      const weight = Math.exp(-((j - i) ** 2) / (2 * sigma * sigma))
      sx += pts[j][0] * weight
      sy += pts[j][1] * weight
      w += weight
    }
    return [sx / w, sy / w] as [number, number]
  })
}

// ── Area fill helpers ─────────────────────────────────────────────────────────

function makeHatchFillPattern(ctx: Ctx, color: string, R: number, spacingMult: number): CanvasPattern | null {
  const baseSpacing = Math.max(4, R * 0.18) * Math.max(0.3, spacingMult)
  const dpr = Math.abs(ctx.getTransform().a) || 1
  const s = Math.ceil(baseSpacing * dpr)
  const tile = new OffscreenCanvas(s, s)
  const tc = tile.getContext('2d')!
  tc.strokeStyle = color
  tc.lineWidth = Math.max(1, dpr * 0.9)
  tc.beginPath()
  tc.moveTo(0, s); tc.lineTo(s, 0)
  tc.moveTo(-s, s); tc.lineTo(0, 0)
  tc.moveTo(s, s); tc.lineTo(s * 2, 0)
  tc.stroke()
  const pat = ctx.createPattern(tile, 'repeat')
  pat?.setTransform(new DOMMatrix().scale(1 / dpr, 1 / dpr))
  return pat
}

// ── Pattern renderers ─────────────────────────────────────────────────────────

function drawDotted(ctx: Ctx, s: PathSampler, sw: number, sm: number) {
  const r = sw * 0.65, spacing = sw * 2.2 * sm
  ctx.fillStyle = ctx.strokeStyle as string
  let d = spacing * 0.5
  while (d < s.totalLen) {
    const p = s.pointAt(d, 0, 1)
    ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2); ctx.fill()
    d += spacing
  }
}

function drawDashed(ctx: Ctx, s: PathSampler, sw: number, sm: number) {
  const dashLen = sw * 2.5, gapLen = sw * 2.5 * sm, period = dashLen + gapLen
  const prevCap = ctx.lineCap; ctx.lineCap = 'butt'
  ctx.beginPath()
  let d = 0
  while (d < s.totalLen) {
    const dEnd = Math.min(d + dashLen, s.totalLen)
    const a = s.pointAt(d, 0, 1), b = s.pointAt(dEnd, 0, 1)
    ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1])
    d += period
  }
  ctx.stroke(); ctx.lineCap = prevCap
}

function drawDashDot(ctx: Ctx, s: PathSampler, sw: number, sm: number) {
  const dashLen = sw * 2.5
  const dotR = Math.max(0.5, sw * 0.5)
  const gap = sw * 1.0 * sm
  const period = dashLen + gap + dotR * 2 + gap

  const prevCap = ctx.lineCap
  ctx.lineCap = 'butt'
  ctx.beginPath()
  let d = 0
  while (d < s.totalLen) {
    const dashEnd = Math.min(d + dashLen, s.totalLen)
    const a = s.pointAt(d, 0, 1), b = s.pointAt(dashEnd, 0, 1)
    ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1])
    d += period
  }
  ctx.stroke()
  ctx.lineCap = prevCap

  ctx.fillStyle = ctx.strokeStyle as string
  d = dashLen + gap + dotR
  while (d < s.totalLen) {
    const p = s.pointAt(d, 0, 1)
    ctx.beginPath(); ctx.arc(p[0], p[1], dotR, 0, Math.PI * 2); ctx.fill()
    d += period
  }
}

export function drawPatternAlongPath(
  ctx: Ctx,
  pts: [number, number][],
  pattern: LinePattern,
  strokeWidth: number,
  closed: boolean,
  spacingMult: number,
) {
  const s = buildPathSampler(pts, closed)
  if (!s) return
  switch (pattern) {
    case 'dotted':  return drawDotted(ctx, s, strokeWidth, spacingMult)
    case 'dashed':  return drawDashed(ctx, s, strokeWidth, spacingMult)
    case 'dashdot': return drawDashDot(ctx, s, strokeWidth, spacingMult)
  }
}

// ── Main highlights draw function ────────────────────────────────────────────

export type HighlightsParams = {
  highlights: HexHighlight[]
  highlightedHexes: Record<string, string>
  highlightLines: Record<string, string[][]>
  highlightEdgePaths: Record<string, [number, number][][]>
  projected: { hex: GeneratedHex; verts: [number, number][] }[]
  edgeMode: string
  R: number
  project: (lon: number, lat: number) => [number, number]
  inMargin: (verts: [number, number][]) => boolean
}

export function drawHighlights(
  hCtx: Ctx,
  { highlights, highlightedHexes, highlightLines, highlightEdgePaths, projected, edgeMode, R, project, inMargin }: HighlightsParams,
) {
  const hlMap = new Map(highlights.map(h => [h.id, h]))
  const hlHexes = highlightedHexes
  const vKey = (v: [number, number]) => `${Math.round(v[0] * 10)},${Math.round(v[1] * 10)}`

  // Per-hex pass: fill + non-joined stroke
  const hatchPatternCache = new Map<string, CanvasPattern | null>()
  for (const { hex, verts } of projected) {
    if (edgeMode === 'whole' && hex.partial) continue
    if (!hex.partial && !inMargin(verts)) continue
    const hlId = hlHexes[`${hex.q},${hex.r}`]
    if (!hlId) continue
    const hl = hlMap.get(hlId)
    if (!hl) continue

    if (hl.fillEnabled && hl.fillOpacity > 0) {
      hCtx.beginPath()
      hCtx.moveTo(verts[0][0], verts[0][1])
      for (let i = 1; i < verts.length; i++) hCtx.lineTo(verts[i][0], verts[i][1])
      hCtx.closePath()
      hCtx.globalAlpha = hl.fillOpacity
      if ((hl.fillPattern ?? 'none') === 'hatched') {
        const cacheKey = `${hl.id}-${hl.color}-${hl.patternSpacing ?? 1}`
        if (!hatchPatternCache.has(cacheKey)) {
          hatchPatternCache.set(cacheKey, makeHatchFillPattern(hCtx, hl.color, R, hl.patternSpacing ?? 1))
        }
        hCtx.fillStyle = hatchPatternCache.get(cacheKey) ?? hl.color
      } else {
        hCtx.fillStyle = hl.color
      }
      hCtx.fill()
      hCtx.globalAlpha = 1
    }

    if (hl.joinNeighbors) continue
    if (!hl.strokeEnabled || hl.strokeOpacity <= 0 || hl.strokeWidth <= 0) continue

    hCtx.save()
    hCtx.beginPath()
    hCtx.moveTo(verts[0][0], verts[0][1])
    for (let i = 1; i < verts.length; i++) hCtx.lineTo(verts[i][0], verts[i][1])
    hCtx.closePath()
    hCtx.clip('evenodd')
    hCtx.beginPath()
    hCtx.moveTo(verts[0][0], verts[0][1])
    for (let i = 1; i < verts.length; i++) hCtx.lineTo(verts[i][0], verts[i][1])
    hCtx.closePath()
    hCtx.globalAlpha = hl.strokeOpacity
    hCtx.strokeStyle = hl.color
    hCtx.lineWidth = hl.strokeWidth * 2
    hCtx.lineJoin = 'round'
    hCtx.stroke()
    hCtx.globalAlpha = 1
    hCtx.restore()
  }

  // Joined stroke pass
  for (const hl of highlights) {
    if (!hl.joinNeighbors) continue
    if (!hl.strokeEnabled || hl.strokeOpacity <= 0 || hl.strokeWidth <= 0) continue

    const edgeCount = new Map<string, number>()
    type DirEdge = [[number, number], [number, number]]
    const allDirEdges: DirEdge[] = []

    for (const { hex, verts } of projected) {
      if (edgeMode === 'whole' && hex.partial) continue
      if (!hex.partial && !inMargin(verts)) continue
      if (hlHexes[`${hex.q},${hex.r}`] !== hl.id) continue
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
    const polygons: [number, number][][] = []
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
      if (poly.length >= 3) polygons.push(poly)
    }
    if (polygons.length === 0) continue

    const s = hl.smoothing ?? 0
    const smoothed = polygons.map(poly => {
      if (s < 1.5) return poly
      const passes = Math.max(1, Math.round(s - 1))
      const resampled = resampleClosed(poly, R / 4)
      const sigma = Math.min(passes * 2, resampled.length / 10)
      return gaussianSmoothClosed(resampled, Math.max(1, sigma))
    })

    const _areaPatternSuppresses = ['dashed', 'dotted', 'dashdot'].includes(hl.linePattern ?? 'none')
    if (!_areaPatternSuppresses) {
      hCtx.save()
      hCtx.beginPath()
      for (const poly of smoothed) {
        hCtx.moveTo(poly[0][0], poly[0][1])
        for (let i = 1; i < poly.length; i++) hCtx.lineTo(poly[i][0], poly[i][1])
        hCtx.closePath()
      }
      hCtx.clip('evenodd')

      hCtx.globalAlpha = hl.strokeOpacity
      hCtx.strokeStyle = hl.color
      hCtx.lineWidth = hl.strokeWidth * 2
      hCtx.lineJoin = s < 0.5 ? 'miter' : 'round'
      hCtx.lineCap = s < 0.5 ? 'butt' : 'round'

      for (const poly of smoothed) {
        hCtx.beginPath()
        hCtx.moveTo(poly[0][0], poly[0][1])
        for (let i = 1; i < poly.length; i++) hCtx.lineTo(poly[i][0], poly[i][1])
        hCtx.closePath()
        hCtx.stroke()
      }

      hCtx.globalAlpha = 1
      hCtx.restore()
    }

    const areaPattern = hl.linePattern ?? 'none'
    if (areaPattern !== 'none') {
      hCtx.save()
      hCtx.globalAlpha = hl.strokeOpacity
      hCtx.strokeStyle = hl.color
      hCtx.fillStyle = hl.color
      hCtx.lineWidth = hl.strokeWidth
      hCtx.lineCap = 'round'
      hCtx.lineJoin = 'round'
      for (const poly of smoothed) {
        drawPatternAlongPath(hCtx, poly, areaPattern as LinePattern, hl.strokeWidth, true, hl.patternSpacing ?? 1)
      }
      hCtx.globalAlpha = 1
      hCtx.restore()
    }
  }

  // Line highlights
  {
    const hexCenterMap = new Map<string, [number, number]>()
    for (const { hex, verts } of projected) {
      const cx = verts.reduce((s, v) => s + v[0], 0) / 6
      const cy = verts.reduce((s, v) => s + v[1], 0) / 6
      hexCenterMap.set(`${hex.q},${hex.r}`, [cx, cy])
    }

    const buildLinePts = (raw: [number, number][], s: number): [number, number][] => {
      if (raw.length < 1) return raw
      if (s >= 1.5 && raw.length >= 2) {
        const passes = Math.max(1, Math.round(s - 1))
        const resampled = resampleOpen(raw, R / 4)
        const sigma = Math.min(passes * 2, resampled.length / 6)
        const smoothedPts = gaussianSmoothOpen(resampled, Math.max(1, sigma))
        smoothedPts[0] = raw[0]
        smoothedPts[smoothedPts.length - 1] = raw[raw.length - 1]
        return smoothedPts
      }
      return raw
    }

    const drawLinePath = (pts: [number, number][]) => {
      if (pts.length < 1) return
      hCtx.beginPath()
      hCtx.moveTo(pts[0][0], pts[0][1])
      for (let i = 1; i < pts.length; i++) hCtx.lineTo(pts[i][0], pts[i][1])
      hCtx.stroke()
    }

    for (const hl of highlights) {
      if (hl.mode === 'area') continue
      if (!hl.strokeEnabled || hl.strokeOpacity <= 0 || hl.strokeWidth <= 0) continue

      const s = hl.smoothing ?? 0
      hCtx.save()
      hCtx.globalAlpha = hl.strokeOpacity
      hCtx.strokeStyle = hl.color
      hCtx.lineWidth = hl.strokeWidth
      hCtx.lineJoin = s < 0.5 ? 'miter' : 'round'
      hCtx.lineCap = s < 0.5 ? 'butt' : 'round'

      const pattern = hl.linePattern ?? 'none'
      hCtx.fillStyle = hl.color

      const renderLinePts = (raw: [number, number][]) => {
        if (raw.length < 2) return
        const pts = buildLinePts(raw, s)
        const suppressBackbone = ['dashed', 'dotted', 'dashdot'].includes(pattern)
        if (!suppressBackbone) drawLinePath(pts)
        if (pattern !== 'none') drawPatternAlongPath(hCtx, pts, pattern as LinePattern, hl.strokeWidth, false, hl.patternSpacing ?? 1)
      }

      if (hl.mode === 'edge') {
        const edgeSegs = highlightEdgePaths[hl.id] ?? []
        for (const geoPath of edgeSegs) {
          if (geoPath.length >= 2) {
            const raw = geoPath.map(([lon, lat]) => project(lon, lat)) as [number, number][]
            renderLinePts(raw)
          }
        }
      } else {
        for (const lineKeys of highlightLines[hl.id] ?? []) {
          if (lineKeys.length >= 1) {
            const raw: [number, number][] = lineKeys
              .map(k => hexCenterMap.get(k))
              .filter((c): c is [number, number] => !!c)
            renderLinePts(raw)
          }
        }
      }

      hCtx.globalAlpha = 1
      hCtx.restore()
    }
  }
}
