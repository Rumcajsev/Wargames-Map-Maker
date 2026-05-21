/** Area layer rendering — organic boundary outlines and centered name labels.
 *  Pure canvas operations; no React or store imports. */

import type { MapArea, AreasStyle, GeneratedHex } from '../store/mapStore'
import { resampleClosed, gaussianSmoothClosed } from './drawHighlights'

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export type DrawAreasParams = {
  areas: MapArea[]
  areaHexes: Record<string, string>
  projected: { hex: GeneratedHex; verts: [number, number][] }[]
  edgeMode: string
  inMargin: (verts: [number, number][]) => boolean
  R: number
  style: AreasStyle
  lineScale?: number
}

const vKey = (v: [number, number]) => `${Math.round(v[0] * 10)},${Math.round(v[1] * 10)}`

export function drawAreas(ctx: Ctx, {
  areas, areaHexes, projected, edgeMode, inMargin, R, style, lineScale,
}: DrawAreasParams): void {
  if (areas.length === 0) return
  ctx.save()
  const ls = lineScale ?? 1

  // Pre-group: build vertex ring lists per area id
  const ringsByArea = new Map<string, [number, number][][]>()
  for (const area of areas) ringsByArea.set(area.id, [])

  for (const { hex, verts } of projected) {
    if (edgeMode === 'whole' && hex.partial) continue
    if (!hex.partial && !inMargin(verts)) continue
    const aId = areaHexes[`${hex.q},${hex.r}`]
    if (!aId || !ringsByArea.has(aId)) continue
    ringsByArea.get(aId)!.push(verts)
  }

  // Pre-compute canvas-space centroids per area
  const centroidByArea = new Map<string, [number, number]>()
  for (const { hex, verts } of projected) {
    const aId = areaHexes[`${hex.q},${hex.r}`]
    if (!aId) continue
    const hcx = verts.reduce((s, v) => s + v[0], 0) / 6
    const hcy = verts.reduce((s, v) => s + v[1], 0) / 6
    const prev = centroidByArea.get(aId)
    if (prev) {
      centroidByArea.set(aId, [prev[0] + hcx, prev[1] + hcy])
    } else {
      centroidByArea.set(aId, [hcx, hcy])
    }
  }

  // Count hexes per area for centroid averaging
  const hexCountByArea = new Map<string, number>()
  for (const aId of Object.values(areaHexes)) {
    hexCountByArea.set(aId, (hexCountByArea.get(aId) ?? 0) + 1)
  }

  // Draw each area: boundary outline then label
  for (const area of areas) {
    const hexVerts = ringsByArea.get(area.id)
    if (!hexVerts || hexVerts.length === 0) continue

    // ── Boundary extraction (joined edge walk) ──────────────────────────────
    type DirEdge = [[number, number], [number, number]]
    const edgeCount = new Map<string, number>()
    const allDirEdges: DirEdge[] = []

    for (const verts of hexVerts) {
      for (let i = 0; i < 6; i++) {
        const v1 = verts[i], v2 = verts[(i + 1) % 6]
        const k1 = vKey(v1), k2 = vKey(v2)
        const ek = k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`
        edgeCount.set(ek, (edgeCount.get(ek) ?? 0) + 1)
        allDirEdges.push([v1, v2])
      }
    }

    const outerEdges = allDirEdges.filter(([v1, v2]) => {
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

    // ── Smoothing: resample + Gaussian ─────────────────────────────────────
    const smoothed = polygons.map(poly => {
      const resampled = resampleClosed(poly, R / 3)
      return gaussianSmoothClosed(resampled, 2.5)
    })

    // ── Stroke boundary ─────────────────────────────────────────────────────
    ctx.save()
    ctx.strokeStyle = area.color
    ctx.lineWidth = style.borderWidth * ls
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    for (const poly of smoothed) {
      ctx.beginPath()
      ctx.moveTo(poly[0][0], poly[0][1])
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1])
      ctx.closePath()
      ctx.stroke()
    }
    ctx.restore()

    // ── Label ───────────────────────────────────────────────────────────────
    if (!area.name) continue
    const sumPt = centroidByArea.get(area.id)
    const count = hexCountByArea.get(area.id) ?? 1
    if (!sumPt) continue
    let lx = sumPt[0] / count
    let ly = sumPt[1] / count
    if (area.labelOffset) { lx += area.labelOffset[0]; ly += area.labelOffset[1] }

    const ptSize = Math.max(8, R * 0.28 * style.labelSize) * ls
    ctx.save()
    ctx.font = `italic ${ptSize}px "Palatino Linotype", Palatino, Georgia, serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // Halo
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'
    ctx.lineWidth = 3 * ls
    ctx.strokeText(area.name, lx, ly)
    // Fill
    ctx.fillStyle = area.color
    ctx.fillText(area.name, lx, ly)
    ctx.restore()
  }

  ctx.restore()
}
