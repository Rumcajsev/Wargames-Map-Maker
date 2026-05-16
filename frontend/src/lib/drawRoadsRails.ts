/** Road and rail layer rendering. Pure canvas operations — no React or store imports. */

import type { RoadTierStyle, RailStyle } from '../store/mapStore'
import { offsetPolyline } from './geometry'

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export type DrawRoadsRailsParams = {
  roadChains: { tier: 0 | 1 | 2; chain: [number, number][] }[]
  junctions: { pos: [number, number]; tier: 0 | 1 | 2 }[]
  railChains: { chain: [number, number][]; isShared: boolean }[]
  tierStyles: [RoadTierStyle, RoadTierStyle, RoadTierStyle]
  railStyle: RailStyle
  project: (lon: number, lat: number) => [number, number]
}

export function drawRoadsAndRails(rCtx: Ctx, {
  roadChains, junctions, railChains, tierStyles, railStyle, project,
}: DrawRoadsRailsParams) {
  const drawChain = (chain: [number, number][]) => {
    const pts = chain.map(([lon, lat]) => project(lon, lat))
    if (pts.length < 2) return
    rCtx.beginPath()
    rCtx.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i++) rCtx.lineTo(pts[i][0], pts[i][1])
    rCtx.stroke()
  }

  if (roadChains.length > 0) {
    rCtx.lineCap = 'round'
    rCtx.lineJoin = 'round'
    for (const tier of [2, 1, 0] as const) {
      const s = tierStyles[tier]
      rCtx.strokeStyle = s.outer
      rCtx.lineWidth = s.outerW
      for (const { tier: t, chain } of roadChains) { if (t === tier) drawChain(chain) }
    }
    for (const { pos, tier } of junctions) {
      const [x, y] = project(pos[0], pos[1])
      const s = tierStyles[tier]
      rCtx.beginPath(); rCtx.arc(x, y, s.outerW / 2, 0, Math.PI * 2)
      rCtx.fillStyle = s.outer; rCtx.fill()
    }
    for (const tier of [2, 1, 0] as const) {
      const s = tierStyles[tier]
      rCtx.strokeStyle = s.inner
      rCtx.lineWidth = s.outerW * 0.5
      for (const { tier: t, chain } of roadChains) { if (t === tier) drawChain(chain) }
    }
    for (const { pos, tier } of junctions) {
      const [x, y] = project(pos[0], pos[1])
      const s = tierStyles[tier]
      rCtx.beginPath(); rCtx.arc(x, y, s.outerW * 0.25, 0, Math.PI * 2)
      rCtx.fillStyle = s.inner; rCtx.fill()
    }
  }

  if (railChains.length > 0) {
    const RAIL_OFFSET_PX = 5
    const geoKey = (p: [number, number]) => `${p[0]},${p[1]}`

    const sharedOffsetEnds = new Map<string, [number, number]>()
    for (const { chain, isShared } of railChains) {
      if (!isShared || chain.length < 2) continue
      const rawPts = chain.map(([lon, lat]) => project(lon, lat)) as [number, number][]
      const full = offsetPolyline(rawPts, RAIL_OFFSET_PX)
      sharedOffsetEnds.set(geoKey(chain[0] as [number, number]), full[0])
      sharedOffsetEnds.set(geoKey(chain[chain.length - 1] as [number, number]), full[full.length - 1])
    }

    const rs = railStyle
    for (const { chain, isShared } of railChains) {
      let pts = chain.map(([lon, lat]) => project(lon, lat)) as [number, number][]
      if (isShared) {
        pts = offsetPolyline(pts, RAIL_OFFSET_PX)
      } else {
        const s = sharedOffsetEnds.get(geoKey(chain[0] as [number, number]))
        const e = sharedOffsetEnds.get(geoKey(chain[chain.length - 1] as [number, number]))
        if (s) pts[0] = s
        if (e) pts[pts.length - 1] = e
      }
      if (pts.length < 2) continue

      if (rs.railStyle === 'cross') {
        rCtx.lineCap = 'round'; rCtx.lineJoin = 'round'
        rCtx.lineWidth = rs.thickness * 0.4; rCtx.strokeStyle = rs.outerColor
        rCtx.beginPath(); rCtx.moveTo(pts[0][0], pts[0][1])
        for (let i = 1; i < pts.length; i++) rCtx.lineTo(pts[i][0], pts[i][1])
        rCtx.stroke()
        const spacing = rs.thickness * 4, halfLen = rs.thickness * 1.2
        rCtx.lineCap = 'round'; rCtx.lineWidth = rs.thickness * 0.4; rCtx.strokeStyle = rs.outerColor
        let accumulated = 0, nextTie = spacing / 2
        for (let i = 1; i < pts.length; i++) {
          const dx = pts[i][0] - pts[i-1][0], dy = pts[i][1] - pts[i-1][1]
          const segLen = Math.hypot(dx, dy)
          if (segLen === 0) continue
          const nx = -dy / segLen, ny = dx / segLen
          while (accumulated + segLen >= nextTie) {
            const t = (nextTie - accumulated) / segLen
            const x = pts[i-1][0] + dx * t, y = pts[i-1][1] + dy * t
            rCtx.beginPath(); rCtx.moveTo(x - nx * halfLen, y - ny * halfLen)
            rCtx.lineTo(x + nx * halfLen, y + ny * halfLen); rCtx.stroke()
            nextTie += spacing
          }
          accumulated += segLen
        }
      } else {
        rCtx.lineCap = 'round'; rCtx.lineJoin = 'round'
        rCtx.lineWidth = rs.thickness; rCtx.strokeStyle = rs.outerColor
        rCtx.beginPath(); rCtx.moveTo(pts[0][0], pts[0][1])
        for (let i = 1; i < pts.length; i++) rCtx.lineTo(pts[i][0], pts[i][1])
        rCtx.stroke()
        rCtx.lineCap = 'butt'
        rCtx.lineWidth = rs.thickness * 0.48; rCtx.strokeStyle = rs.innerColor
        rCtx.setLineDash([7, 7])
        rCtx.beginPath(); rCtx.moveTo(pts[0][0], pts[0][1])
        for (let i = 1; i < pts.length; i++) rCtx.lineTo(pts[i][0], pts[i][1])
        rCtx.stroke()
        rCtx.setLineDash([])
      }
    }
  }
}
