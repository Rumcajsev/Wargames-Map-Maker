/** Road-aligned building placement V2.
 *  Phase 1: corner seeds at each junction wedge bisector.
 *  Phase 2: curve-following chains — buildings placed at a fixed perpendicular setback
 *  from the actual curved road centreline on both sides, so distance to road stays
 *  constant even as the road bends.
 *  Pure canvas — no React or store imports except types. */

import type { Settlement, GeneratedHex, SettlementTierStyle, UrbanStyle } from '../store/mapStore'
import type { SettlementTier } from '../store/mapStore'
import { pointInPolygon } from './geometry'

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
type Vec2 = [number, number]

export type DrawBuildingsV2Params = {
  hexes: GeneratedHex[]
  urbanHexes: { q: number; r: number }[]
  urbanStyle: UrbanStyle
  settlements: Settlement[]
  settlementTierStyles: Record<SettlementTier, SettlementTierStyle>
  roadChains: { tier: 0 | 1 | 2; chain: [number, number][] }[]
  roadTierStyles: [{ outerW: number }, { outerW: number }, { outerW: number }]
  project: (lon: number, lat: number) => [number, number]
}

type ProjectedChain = { pts: Vec2[]; hw: number }
type Arm = { dir: Vec2; hw: number }
type JunctionSeed = { x: number; y: number; arms: Arm[] }

type Candidate = { x: number; y: number; angle: number; level: number; w: number; h: number }

// Strictly interior segment intersection — excludes hits at or near endpoints (tA/tB near 0 or 1).
function segIntersectMid(
  ax0: number, ay0: number, ax1: number, ay1: number,
  bx0: number, by0: number, bx1: number, by1: number,
): { x: number; y: number } | null {
  const r1x = ax1 - ax0, r1y = ay1 - ay0
  const r2x = bx1 - bx0, r2y = by1 - by0
  const d = r1x * r2y - r1y * r2x
  if (Math.abs(d) < 0.0001) return null
  const dx = bx0 - ax0, dy = by0 - ay0
  const tA = (dx * r2y - dy * r2x) / d
  const tB = (dx * r1y - dy * r1x) / d
  if (tA < 0.05 || tA > 0.95 || tB < 0.05 || tB > 0.95) return null
  return { x: ax0 + tA * r1x, y: ay0 + tA * r1y }
}

function norm(dx: number, dy: number): Vec2 {
  const len = Math.hypot(dx, dy)
  return len < 0.0001 ? [1, 0] : [dx / len, dy / len]
}

// Deterministic [0,1) value from a canvas position — keeps merge decisions stable across frames.
function posRand(x: number, y: number, salt: number): number {
  const s = Math.sin(x * 0.1271 + y * 0.3117 + salt * 0.7431) * 43758.5453
  return s - Math.floor(s)
}

function placeBuilding(
  ctx: Ctx,
  cx: number, cy: number,
  w: number, h: number,
  angle: number,
  color: string, strokeColor: string, strokeWidth: number,
): void {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(angle)
  ctx.fillStyle = color
  ctx.fillRect(-w / 2, -h / 2, w, h)
  if (strokeWidth > 0) {
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = strokeWidth
    ctx.strokeRect(-w / 2, -h / 2, w, h)
  }
  ctx.restore()
}

// Interpolate position + tangent at arc-length s along a polyline with precomputed cumulative lengths.
function atArc(
  pts: Vec2[], cumLen: number[], s: number,
): { x: number; y: number; tx: number; ty: number } {
  const clamped = Math.max(0, Math.min(cumLen[cumLen.length - 1], s))
  let si = 0
  while (si < pts.length - 2 && cumLen[si + 1] < clamped) si++
  const segLen = cumLen[si + 1] - cumLen[si]
  const t = segLen > 0 ? (clamped - cumLen[si]) / segLen : 0
  const p0 = pts[si], p1 = pts[si + 1]
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1]
  const tlen = Math.hypot(dx, dy)
  return {
    x: p0[0] + dx * t, y: p0[1] + dy * t,
    tx: tlen > 0 ? dx / tlen : 1,
    ty: tlen > 0 ? dy / tlen : 0,
  }
}

function collectCandidates(
  seeds: JunctionSeed[],
  chains: ProjectedChain[],
  buildingSize: number,
  buildingSpacing: number,
  mergeChance: number,
  inHex: (x: number, y: number) => boolean,
): Candidate[] {
  const step = buildingSize + buildingSpacing
  const candidates: Candidate[] = []

  // ── Phase 1: corner seeds at each junction wedge bisector ──────────────────
  for (const seed of seeds) {
    const sorted = seed.arms
      .map(a => ({ ...a, angle: Math.atan2(a.dir[1], a.dir[0]) }))
      .sort((a, b) => a.angle - b.angle)

    for (let k = 0; k < sorted.length; k++) {
      const armA = sorted[k]
      const armB = sorted[(k + 1) % sorted.length]

      let angA = armA.angle
      let angB = armB.angle
      if (angB <= angA) angB += Math.PI * 2

      const halfGap = (angB - angA) / 2
      const cornerAngle = angA + halfGap

      const hw = Math.max(armA.hw, armB.hw)
      const d = hw + buildingSize * 0.5
      const sinHG = Math.sin(halfGap)
      const cornerDist = sinHG > 0.05 ? Math.min(d / sinHG, d * 6) : d * 6

      const sx = seed.x + Math.cos(cornerAngle) * cornerDist
      const sy = seed.y + Math.sin(cornerAngle) * cornerDist
      if (!inHex(sx, sy)) continue

      candidates.push({ x: sx, y: sy, angle: cornerAngle, level: 0, w: buildingSize, h: buildingSize })
    }
  }

  // ── Phase 2: curve-following chains ────────────────────────────────────────
  // Walk each road chain at arc-length intervals and place buildings at a constant
  // perpendicular setback on both sides of the centreline.
  for (let ci = 0; ci < chains.length; ci++) {
    const chain = chains[ci]
    const setback = chain.hw + buildingSize / 2

    // Precompute cumulative arc lengths
    const cumLen = [0]
    for (let i = 1; i < chain.pts.length; i++) {
      const d = Math.hypot(
        chain.pts[i][0] - chain.pts[i - 1][0],
        chain.pts[i][1] - chain.pts[i - 1][1],
      )
      cumLen.push(cumLen[i - 1] + d)
    }
    const totalLen = cumLen[cumLen.length - 1]
    if (totalLen < step / 2) continue

    // Walk left (+90°) and right (−90°) sides independently so merge applies per-side.
    // Align the grid to the chain midpoint so buildings accumulate from the centre outward.
    const halfLen = totalLen / 2
    const centreAlignedStart = halfLen % step || step

    for (const side of [1, -1] as const) {
      let dist = centreAlignedStart

      while (dist < totalLen) {
        const { x: bx, y: by, tx, ty } = atArc(chain.pts, cumLen, dist)
        // Perpendicular offset: side=1 → left, side=−1 → right
        const cx = bx - ty * side * setback
        const cy = by + tx * side * setback

        if (!inHex(cx, cy)) { dist += step; continue }

        const angle = Math.atan2(ty, tx)
        // Level: if junctions exist, grow outward from them; otherwise grow from chain centre.
        const level = seeds.length > 0
          ? Math.round(Math.min(...seeds.map(s => Math.hypot(bx - s.x, by - s.y))) / step)
          : 1 + Math.round(Math.abs(dist - totalLen / 2) / step)

        // Merge look-ahead: peek one step ahead on this side
        const nextDist = dist + step
        if (mergeChance > 0 && nextDist < totalLen) {
          const { x: nbx, y: nby, tx: ntx, ty: nty } = atArc(chain.pts, cumLen, nextDist)
          const ncx = nbx - nty * side * setback
          const ncy = nby + ntx * side * setback
          if (inHex(ncx, ncy) && posRand(cx, cy, ci * 100 + (side > 0 ? 0 : 50)) < mergeChance) {
            const mcx = (cx + ncx) / 2, mcy = (cy + ncy) / 2
            const mangle = Math.atan2((ty + nty) / 2, (tx + ntx) / 2)
            candidates.push({ x: mcx, y: mcy, angle: mangle, level, w: 2 * buildingSize, h: buildingSize })
            dist += step * 2
            continue
          }
        }

        candidates.push({ x: cx, y: cy, angle, level, w: buildingSize, h: buildingSize })
        dist += step
      }
    }
  }

  return candidates
}

function buildSeeds(
  chains: ProjectedChain[],
  inHex: (x: number, y: number) => boolean,
): JunctionSeed[] {
  const SNAP = 1.0

  type End = { x: number; y: number; dir: Vec2; hw: number }
  const ends: End[] = []
  for (const chain of chains) {
    const n = chain.pts.length
    if (n < 2) continue
    ends.push({
      x: chain.pts[0][0], y: chain.pts[0][1],
      dir: norm(chain.pts[1][0] - chain.pts[0][0], chain.pts[1][1] - chain.pts[0][1]),
      hw: chain.hw,
    })
    ends.push({
      x: chain.pts[n - 1][0], y: chain.pts[n - 1][1],
      dir: norm(chain.pts[n - 2][0] - chain.pts[n - 1][0], chain.pts[n - 2][1] - chain.pts[n - 1][1]),
      hw: chain.hw,
    })
  }

  const seeds: JunctionSeed[] = []
  const used = new Set<number>()

  for (let i = 0; i < ends.length; i++) {
    if (used.has(i)) continue
    used.add(i)
    const group: End[] = [ends[i]]
    for (let j = i + 1; j < ends.length; j++) {
      if (used.has(j)) continue
      if (Math.hypot(ends[j].x - ends[i].x, ends[j].y - ends[i].y) < SNAP) {
        group.push(ends[j])
        used.add(j)
      }
    }
    if (!inHex(ends[i].x, ends[i].y)) continue

    if (group.length >= 2) {
      seeds.push({ x: ends[i].x, y: ends[i].y, arms: group.map(e => ({ dir: e.dir, hw: e.hw })) })
    } else {
      const e = ends[i]
      seeds.push({
        x: e.x, y: e.y,
        arms: [{ dir: e.dir, hw: e.hw }, { dir: [-e.dir[0], -e.dir[1]] as Vec2, hw: e.hw }],
      })
    }
  }

  // Phase 2 — mid-segment crossings (roads crossing without a shared OSM node).
  const junctionPositions = seeds.map(s => [s.x, s.y] as Vec2)
  const NEAR_JUNC = SNAP * 8

  for (let i = 0; i < chains.length; i++) {
    for (let j = i + 1; j < chains.length; j++) {
      const A = chains[i], B = chains[j]
      for (let ai = 1; ai < A.pts.length; ai++) {
        for (let bi = 1; bi < B.pts.length; bi++) {
          const hit = segIntersectMid(
            A.pts[ai - 1][0], A.pts[ai - 1][1], A.pts[ai][0], A.pts[ai][1],
            B.pts[bi - 1][0], B.pts[bi - 1][1], B.pts[bi][0], B.pts[bi][1],
          )
          if (!hit || !inHex(hit.x, hit.y)) continue
          if (junctionPositions.some(([jx, jy]) => Math.hypot(hit.x - jx, hit.y - jy) < NEAR_JUNC)) continue
          seeds.push({
            x: hit.x, y: hit.y,
            arms: [
              { dir: norm(A.pts[ai][0] - A.pts[ai-1][0], A.pts[ai][1] - A.pts[ai-1][1]), hw: A.hw },
              { dir: norm(A.pts[ai-1][0] - A.pts[ai][0], A.pts[ai-1][1] - A.pts[ai][1]), hw: A.hw },
              { dir: norm(B.pts[bi][0] - B.pts[bi-1][0], B.pts[bi][1] - B.pts[bi-1][1]), hw: B.hw },
              { dir: norm(B.pts[bi-1][0] - B.pts[bi][0], B.pts[bi-1][1] - B.pts[bi][1]), hw: B.hw },
            ],
          })
        }
      }
    }
  }

  // Fallback — road passes through hex but junction endpoint is outside.
  if (seeds.length === 0) {
    for (const chain of chains) {
      const inPts = chain.pts.filter(([x, y]) => inHex(x, y))
      if (inPts.length < 2) continue
      const mid = Math.floor(inPts.length / 2)
      const fwd = norm(inPts[mid][0] - inPts[mid - 1][0], inPts[mid][1] - inPts[mid - 1][1])
      seeds.push({
        x: inPts[mid][0], y: inPts[mid][1],
        arms: [{ dir: fwd, hw: chain.hw }, { dir: [-fwd[0], -fwd[1]] as Vec2, hw: chain.hw }],
      })
    }
  }

  return seeds
}

function drawHexBuildingsV2(
  ctx: Ctx,
  hex: GeneratedHex,
  allChains: ProjectedChain[],
  buildingSize: number,
  buildingCount: number,
  buildingSpacing: number,
  mergeChance: number,
  buildingColor: string,
  buildingStrokeColor: string,
  buildingStrokeWidth: number,
  project: (lon: number, lat: number) => [number, number],
): void {
  const hexVerts = hex.vertices.map(v => project(v[0], v[1]) as Vec2)
  const inHex = (x: number, y: number) => pointInPolygon(x, y, hexVerts)

  const chains = allChains.filter(c => c.pts.some(([x, y]) => inHex(x, y)))
  if (chains.length === 0) return

  const seeds = buildSeeds(chains, inHex)
  const candidates = collectCandidates(seeds, chains, buildingSize, buildingSpacing, mergeChance, inHex)
  candidates.sort((a, b) => a.level - b.level)

  const minDist = buildingSize * 0.9
  const placed: Vec2[] = []
  let placedCount = 0

  for (const c of candidates) {
    if (placedCount >= buildingCount) break
    if (placed.some(([px, py]) => Math.hypot(c.x - px, c.y - py) < minDist)) continue
    placeBuilding(ctx, c.x, c.y, c.w, c.h, c.angle, buildingColor, buildingStrokeColor, buildingStrokeWidth)
    placed.push([c.x, c.y])
    placedCount++
  }
}

export function drawAllBuildingsV2(ctx: Ctx, params: DrawBuildingsV2Params): void {
  const { hexes, settlements, settlementTierStyles, roadChains, roadTierStyles, project } = params

  const chains: ProjectedChain[] = roadChains.map(({ tier, chain }) => ({
    pts: chain.map(([lon, lat]) => project(lon, lat) as Vec2),
    hw: roadTierStyles[tier].outerW / 2,
  }))

  for (const s of settlements) {
    if (!s.included || s.hex_q === null) continue
    const tier = (s.tier ?? (s.type === 'city' ? 1 : s.type === 'town' ? 3 : 4)) as SettlementTier
    const ts = settlementTierStyles[tier]
    if (ts.displayMode !== 'buildings' || ts.buildingAlgorithm !== 'v2') continue

    const hex = hexes.find(h => h.q === s.hex_q && h.r === s.hex_r)
    if (!hex) continue

    drawHexBuildingsV2(
      ctx, hex, chains,
      ts.buildingV2Size,
      ts.buildingCount,
      ts.buildingV2Spacing,
      ts.buildingV2MergeChance,
      ts.buildingColor,
      ts.buildingStrokeColor,
      ts.buildingStrokeWidth,
      project,
    )
  }
}
