/** Building geometry generation and rendering for urban hexes and settlements.
 *  Pure canvas operations — no React or store imports. */

import type { UrbanStyle, SettlementTierStyle, Settlement, GeneratedHex } from '../store/mapStore'
import { mulberry32 } from './noise'
import { pointInPolygon } from './geometry'

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
type SettlementTier = 1 | 2 | 3 | 4

export type BuildingCmd = {
  dx: number; dy: number
  bw: number; bh: number
  angle: number
  isLShape: boolean
  wx: number; wh: number
}

export type DrawBuildingsParams = {
  hexes: GeneratedHex[]
  urbanHexes: { q: number; r: number }[]
  urbanStyle: UrbanStyle
  settlements: Settlement[]
  settlementTierStyles: Record<SettlementTier, SettlementTierStyle>
  roadChains: { tier: 0 | 1 | 2; chain: [number, number][] }[]
  roadTierStyles: [{ outerW: number }, { outerW: number }, { outerW: number }]
  hexBuildingGeoCache: Map<string, BuildingCmd[]>
  project: (lon: number, lat: number) => [number, number]
}

export function drawHexBuildings(
  bCtx: Ctx,
  hexQ: number,
  hexR: number,
  ts: UrbanStyle | SettlementTierStyle,
  hexes: GeneratedHex[],
  roadChains: DrawBuildingsParams['roadChains'],
  roadTierStyles: DrawBuildingsParams['roadTierStyles'],
  hexBuildingGeoCache: Map<string, BuildingCmd[]>,
  project: (lon: number, lat: number) => [number, number],
) {
  const hex = hexes.find(h => h.q === hexQ && h.r === hexR)
  if (!hex) return

  const hexVerts = hex.vertices.map((v: number[]) => project(v[0], v[1]) as [number, number])

  const hexKey = `${hexQ},${hexR}`
  const cachedCmds = hexBuildingGeoCache.get(hexKey)
  if (cachedCmds) {
    const [hcx, hcy] = project(hex.center[0], hex.center[1])
    for (const cmd of cachedCmds) {
      bCtx.save()
      bCtx.translate(hcx + cmd.dx, hcy + cmd.dy)
      bCtx.rotate(cmd.angle)
      bCtx.fillStyle = ts.buildingColor
      if (cmd.isLShape) {
        bCtx.fillRect(-cmd.bw / 2, -cmd.bh / 2, cmd.bw, cmd.bh)
        bCtx.fillRect(cmd.bw / 2 - cmd.wx, -cmd.bh / 2 - cmd.wh, cmd.wx, cmd.wh)
        if (ts.buildingStrokeWidth > 0) {
          bCtx.strokeStyle = ts.buildingStrokeColor; bCtx.lineWidth = ts.buildingStrokeWidth
          bCtx.strokeRect(-cmd.bw / 2, -cmd.bh / 2, cmd.bw, cmd.bh)
          bCtx.strokeRect(cmd.bw / 2 - cmd.wx, -cmd.bh / 2 - cmd.wh, cmd.wx, cmd.wh)
        }
      } else {
        bCtx.fillRect(-cmd.bw / 2, -cmd.bh / 2, cmd.bw, cmd.bh)
        if (ts.buildingStrokeWidth > 0) {
          bCtx.strokeStyle = ts.buildingStrokeColor; bCtx.lineWidth = ts.buildingStrokeWidth
          bCtx.strokeRect(-cmd.bw / 2, -cmd.bh / 2, cmd.bw, cmd.bh)
        }
      }
      bCtx.restore()
    }
    return
  }

  const inHex = (bpx: number, bpy: number) => pointInPolygon(bpx, bpy, hexVerts)

  const [hcx, hcy] = project(hex.center[0], hex.center[1])
  const rng = mulberry32(Math.abs((hexQ * 31 + hexR) | 0))

  type RoadSample = { x: number; y: number; s: number; tx: number; ty: number }
  type RoadInfo = { samples: RoadSample[]; totalLen: number; hw: number; idx: number }

  const roadInfos: RoadInfo[] = []
  let roadIdx = 0
  for (const { tier: roadTier, chain } of roadChains) {
    const hw = roadTierStyles[roadTier].outerW / 2
    const pts = chain.map(([lon, lat]) => project(lon, lat) as [number, number])
    if (pts.length < 2) continue
    const samples: RoadSample[] = []
    let acc = 0
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i]
      if (i > 0) { const [spx, spy] = pts[i - 1]; acc += Math.hypot(x - spx, y - spy) }
      const ni = Math.min(i + 1, pts.length - 1), pi = Math.max(i - 1, 0)
      const dx = pts[ni][0] - pts[pi][0], dy = pts[ni][1] - pts[pi][1]
      const len = Math.hypot(dx, dy) || 1
      samples.push({ x, y, s: acc, tx: dx / len, ty: dy / len })
    }
    roadInfos.push({ samples, totalLen: acc, hw, idx: roadIdx++ })
  }

  const anchorsByRoad: { roadIdx: number; s: number }[][] = roadInfos.map(() => [])

  const segCross = (
    ax0: number, ay0: number, ax1: number, ay1: number,
    bx0: number, by0: number, bx1: number, by1: number,
  ): { tA: number; tB: number } | null => {
    const r1x = ax1 - ax0, r1y = ay1 - ay0
    const r2x = bx1 - bx0, r2y = by1 - by0
    const d = r1x * r2y - r1y * r2x
    if (Math.abs(d) < 0.0001) return null
    const dx = bx0 - ax0, dy = by0 - ay0
    const tA = (dx * r2y - dy * r2x) / d
    const tB = (dx * r1y - dy * r1x) / d
    if (tA < 0 || tA > 1 || tB < 0 || tB > 1) return null
    return { tA, tB }
  }

  for (let i = 0; i < roadInfos.length; i++) {
    for (let j = i + 1; j < roadInfos.length; j++) {
      const A = roadInfos[i].samples, B = roadInfos[j].samples
      for (let ai = 1; ai < A.length; ai++) {
        for (let bi = 1; bi < B.length; bi++) {
          const c = segCross(A[ai-1].x, A[ai-1].y, A[ai].x, A[ai].y, B[bi-1].x, B[bi-1].y, B[bi].x, B[bi].y)
          if (!c) continue
          const cx = A[ai-1].x + c.tA * (A[ai].x - A[ai-1].x)
          const cy = A[ai-1].y + c.tA * (A[ai].y - A[ai-1].y)
          if (!inHex(cx, cy)) continue
          anchorsByRoad[i].push({ roadIdx: i, s: A[ai-1].s + c.tA * (A[ai].s - A[ai-1].s) })
          anchorsByRoad[j].push({ roadIdx: j, s: B[bi-1].s + c.tB * (B[bi].s - B[bi-1].s) })
        }
      }
    }
  }

  for (let i = 0; i < roadInfos.length; i++) {
    if (anchorsByRoad[i].length > 0) continue
    const ss = roadInfos[i].samples
    let firstIn = -1, lastIn = -1
    for (let k = 0; k < ss.length; k++) {
      if (inHex(ss[k].x, ss[k].y)) { if (firstIn === -1) firstIn = k; lastIn = k }
    }
    if (firstIn === -1) continue
    anchorsByRoad[i].push({ roadIdx: i, s: (ss[firstIn].s + ss[lastIn].s) / 2 })
  }

  const sampleAt = (info: RoadInfo, targetS: number): RoadSample | null => {
    if (targetS < 0 || targetS > info.totalLen) return null
    const ss = info.samples
    for (let k = 1; k < ss.length; k++) {
      if (ss[k].s >= targetS) {
        const a = ss[k-1], b = ss[k], f = (targetS - a.s) / (b.s - a.s || 1)
        return { x: a.x + f * (b.x - a.x), y: a.y + f * (b.y - a.y), s: targetS, tx: a.tx, ty: a.ty }
      }
    }
    return ss[ss.length - 1]
  }

  const placed: Array<{ cx: number; cy: number; r: number }> = []
  const buildingCmds: BuildingCmd[] = []

  const drawBuilding = (bx: number, by: number, bw: number, bh: number, angle: number, isLShape: boolean): void => {
    bCtx.save()
    bCtx.translate(bx, by)
    bCtx.rotate(angle)
    bCtx.fillStyle = ts.buildingColor
    let wx = 0, wh = 0
    if (isLShape) {
      bCtx.fillRect(-bw / 2, -bh / 2, bw, bh)
      wx = bw * (0.35 + rng() * 0.3); wh = bh * (0.35 + rng() * 0.3)
      bCtx.fillRect(bw / 2 - wx, -bh / 2 - wh, wx, wh)
      if (ts.buildingStrokeWidth > 0) {
        bCtx.strokeStyle = ts.buildingStrokeColor; bCtx.lineWidth = ts.buildingStrokeWidth
        bCtx.strokeRect(-bw / 2, -bh / 2, bw, bh)
        bCtx.strokeRect(bw / 2 - wx, -bh / 2 - wh, wx, wh)
      }
    } else {
      bCtx.fillRect(-bw / 2, -bh / 2, bw, bh)
      if (ts.buildingStrokeWidth > 0) {
        bCtx.strokeStyle = ts.buildingStrokeColor; bCtx.lineWidth = ts.buildingStrokeWidth
        bCtx.strokeRect(-bw / 2, -bh / 2, bw, bh)
      }
    }
    bCtx.restore()
    buildingCmds.push({ dx: bx - hcx, dy: by - hcy, bw, bh, angle, isLShape, wx, wh })
  }

  const tryPlace = (bx: number, by: number, bw: number, bh: number, angle: number, isLShape: boolean): boolean => {
    if (!inHex(bx, by)) return false
    const radius = Math.hypot(bw, bh) / 2 * 1.1
    for (const p of placed) {
      if (Math.hypot(bx - p.cx, by - p.cy) < radius + p.r) return false
    }
    const minClear = Math.min(bw, bh) / 2
    for (const info of roadInfos) {
      const ss = info.samples
      for (let k = 1; k < ss.length; k++) {
        const a = ss[k-1], b = ss[k]
        const dx = b.x - a.x, dy = b.y - a.y
        const len2 = dx * dx + dy * dy
        if (len2 < 0.0001) continue
        const t = Math.max(0, Math.min(1, ((bx - a.x) * dx + (by - a.y) * dy) / len2))
        if (Math.hypot(bx - (a.x + dx * t), by - (a.y + dy * t)) < info.hw + minClear + ts.roadSetback - 1) return false
      }
    }
    placed.push({ cx: bx, cy: by, r: radius })
    drawBuilding(bx, by, bw, bh, angle, isLShape)
    return true
  }

  type Slot = { x: number; y: number; tx: number; ty: number; side: 1 | -1; hw: number }
  const avgSize = (ts.buildingSizeMin + ts.buildingSizeMax) / 2
  const stepDist = avgSize * ts.slotSpacing
  const maxTiers = 30
  let placedCount = 0

  if (roadInfos.length > 0) {
    outer: for (let k = 1; k <= maxTiers; k++) {
      const tierSlots: Slot[] = []
      for (let ri = 0; ri < roadInfos.length; ri++) {
        const info = roadInfos[ri]
        for (const anchor of anchorsByRoad[ri]) {
          for (const dir of [-1, +1] as const) {
            const samp = sampleAt(info, anchor.s + dir * k * stepDist)
            if (!samp || !inHex(samp.x, samp.y)) continue
            for (const side of [-1, +1] as const)
              tierSlots.push({ x: samp.x, y: samp.y, tx: samp.tx, ty: samp.ty, side, hw: info.hw })
          }
        }
      }
      if (tierSlots.length === 0) break
      for (let i = tierSlots.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1))
        const tmp = tierSlots[i]; tierSlots[i] = tierSlots[j]; tierSlots[j] = tmp
      }
      for (const slot of tierSlots) {
        if (placedCount >= ts.buildingCount) break outer
        const bw = ts.buildingSizeMin + rng() * (ts.buildingSizeMax - ts.buildingSizeMin)
        const bh = ts.buildingSizeMin + rng() * (ts.buildingSizeMax - ts.buildingSizeMin)
        const nx = -slot.ty * slot.side, ny = slot.tx * slot.side
        const off = slot.hw + Math.min(bw, bh) / 2 + ts.roadSetback
        const bx = slot.x + nx * off, by = slot.y + ny * off
        const angle = Math.atan2(slot.ty, slot.tx) + (rng() - 0.5) * ts.angleJitter
        const isL = rng() < ts.lShapeProbability
        if (tryPlace(bx, by, bw, bh, angle, isL)) {
          placedCount++
          if (rng() < ts.backRowProbability && placedCount < ts.buildingCount) {
            const bw2 = ts.buildingSizeMin + rng() * (ts.buildingSizeMax - ts.buildingSizeMin)
            const bh2 = ts.buildingSizeMin + rng() * (ts.buildingSizeMax - ts.buildingSizeMin)
            const off2 = off + Math.min(bw, bh) / 2 + ts.backRowGap + Math.min(bw2, bh2) / 2
            if (tryPlace(slot.x + nx * off2, slot.y + ny * off2, bw2, bh2,
              angle + (rng() - 0.5) * ts.angleJitter * 0.5, rng() < ts.lShapeProbability)) placedCount++
          }
        }
      }
    }
  } else {
    for (let i = 0; i < ts.buildingCount * 3 && placedCount < ts.buildingCount; i++) {
      const dist = Math.sqrt(rng()) * 20
      const a = rng() * Math.PI * 2
      const bw = ts.buildingSizeMin + rng() * (ts.buildingSizeMax - ts.buildingSizeMin)
      const bh = ts.buildingSizeMin + rng() * (ts.buildingSizeMax - ts.buildingSizeMin)
      if (tryPlace(hcx + Math.cos(a) * dist, hcy + Math.sin(a) * dist, bw, bh, a, rng() < ts.lShapeProbability)) placedCount++
    }
  }

  hexBuildingGeoCache.set(hexKey, buildingCmds)
}

export function drawAllBuildings(bCtx: Ctx, params: DrawBuildingsParams) {
  const { hexes, urbanHexes, urbanStyle, settlements, settlementTierStyles, roadChains, roadTierStyles, hexBuildingGeoCache, project } = params

  for (const { q, r } of urbanHexes) {
    drawHexBuildings(bCtx, q, r, urbanStyle, hexes, roadChains, roadTierStyles, hexBuildingGeoCache, project)
  }

  for (const s of settlements) {
    if (!s.included || s.hex_q === null) continue
    const tier = (s.tier ?? (s.type === 'city' ? 1 : s.type === 'town' ? 3 : 4)) as SettlementTier
    const ts = settlementTierStyles[tier]
    if (ts.displayMode !== 'buildings' || ts.buildingAlgorithm === 'v2') continue
    drawHexBuildings(bCtx, s.hex_q, s.hex_r, ts, hexes, roadChains, roadTierStyles, hexBuildingGeoCache, project)
  }
}
