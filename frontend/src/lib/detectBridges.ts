/** Detects road–river and rail–river visual crossings and returns bridge points.
 *
 *  All chain coordinates are in geographic (lon/lat) space.
 *  The returned BridgePoint positions are also in lon/lat so they can be
 *  projected with the same `project` function used everywhere else. */

export type CrossingType = 'road-0' | 'road-1' | 'road-2' | 'rail'

export interface BridgePoint {
  id: string
  pos: [number, number]    // lon/lat of crossing
  dirA: [number, number]   // road/rail segment start (lon/lat) — used for angle at draw time
  dirB: [number, number]   // road/rail segment end  (lon/lat)
  waterA: [number, number] // water segment start (lon/lat) — used for crossing angle
  waterB: [number, number] // water segment end  (lon/lat)
  riverHW: number          // actual rendered half-width of the crossed river (canvas units, lineScale=1)
  crossingType: CrossingType
}

function segSegIntersect(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): [number, number] | null {
  const d1x = bx - ax, d1y = by - ay
  const d2x = dx - cx, d2y = dy - cy
  const denom = d1x * d2y - d1y * d2x
  if (Math.abs(denom) < 1e-18) return null
  const t = ((cx - ax) * d2y - (cy - ay) * d2x) / denom
  const u = ((cx - ax) * d1y - (cy - ay) * d1x) / denom
  if (t <= 0 || t >= 1 || u <= 0 || u >= 1) return null
  return [ax + t * d1x, ay + t * d1y]
}

/** Squared lon/lat distance below which two crossings are considered duplicates (~8 m). */
const DEDUP_SQ = 8e-9

export function detectBridges(
  roadChains: { tier: 0 | 1 | 2; chain: [number, number][] }[],
  railChains: { chain: [number, number][] }[],
  waterChains: { vertices: [number, number][]; halfWidth?: number }[],
): BridgePoint[] {
  const bridges: BridgePoint[] = []

  const isDup = (pt: [number, number]) =>
    bridges.some(b => {
      const dx = b.pos[0] - pt[0], dy = b.pos[1] - pt[1]
      return dx * dx + dy * dy < DEDUP_SQ
    })

  for (const road of roadChains) {
    const rc = road.chain
    const crossingType: CrossingType = road.tier === 0 ? 'road-0' : road.tier === 1 ? 'road-1' : 'road-2'
    for (let i = 0; i < rc.length - 1; i++) {
      const [ax, ay] = rc[i], [bx, by] = rc[i + 1]
      for (const water of waterChains) {
        const wc = water.vertices
        for (let j = 0; j < wc.length - 1; j++) {
          const [cx, cy] = wc[j], [dx, dy] = wc[j + 1]
          const pt = segSegIntersect(ax, ay, bx, by, cx, cy, dx, dy)
          if (!pt || isDup(pt)) continue
          const id = `br|${Math.round(pt[0] / 1e-7)},${Math.round(pt[1] / 1e-7)}`
          bridges.push({ id, pos: pt, dirA: rc[i], dirB: rc[i + 1], waterA: wc[j], waterB: wc[j + 1], riverHW: water.halfWidth ?? 1.4, crossingType })
        }
      }
    }
  }

  for (const rail of railChains) {
    const rc = rail.chain
    for (let i = 0; i < rc.length - 1; i++) {
      const [ax, ay] = rc[i], [bx, by] = rc[i + 1]
      for (const water of waterChains) {
        const wc = water.vertices
        for (let j = 0; j < wc.length - 1; j++) {
          const [cx, cy] = wc[j], [dx, dy] = wc[j + 1]
          const pt = segSegIntersect(ax, ay, bx, by, cx, cy, dx, dy)
          if (!pt || isDup(pt)) continue
          const id = `rl|${Math.round(pt[0] / 1e-7)},${Math.round(pt[1] / 1e-7)}`
          bridges.push({ id, pos: pt, dirA: rc[i], dirB: rc[i + 1], waterA: wc[j], waterB: wc[j + 1], riverHW: water.halfWidth ?? 1.4, crossingType: 'rail' })
        }
      }
    }
  }

  return bridges
}
