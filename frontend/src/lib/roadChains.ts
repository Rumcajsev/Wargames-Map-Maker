/** Road and rail chain building utilities.
 *  Converts hex-edge graphs into smooth polyline chains for rendering. */

import { catmullRom } from './geometry'
import { seededRandom } from './noise'

export function edgeCpKey(k1: string, k2: string): string {
  return `em|${k1 < k2 ? k1 : k2}|${k1 < k2 ? k2 : k1}`
}

export function juncCpKey(k: string): string {
  return `ja|${k}`
}

/** Key for a branch arm's terminal point override: the point where branch neighbor `nk` meets junction hex `k`. */
export function branchCpKey(k: string, nk: string): string {
  return `jb|${k}|${nk}`
}

export function buildRoadChains(
  roadEdges: { q1: number; r1: number; q2: number; r2: number; tier: 0 | 1 | 2 }[],
  hexIdx: Map<string, { center: [number, number] }>,
  overrides: Record<string, [number, number]>,
  globalBendiness: number,
  hexBendiness: Record<string, number>,
): { chains: { tier: 0 | 1 | 2; chain: [number, number][] }[]; junctions: { pos: [number, number]; tier: 0 | 1 | 2 }[]; controlPoints: { key: string; pos: [number, number] }[] } {
  if (roadEdges.length === 0) return { chains: [], junctions: [], controlPoints: [] }

  let interHexDist = 0, hexScaleSamples = 0
  for (const e of roadEdges.slice(0, 8)) {
    const h1 = hexIdx.get(`${e.q1},${e.r1}`), h2 = hexIdx.get(`${e.q2},${e.r2}`)
    if (h1 && h2) { interHexDist += Math.hypot(h2.center[0] - h1.center[0], h2.center[1] - h1.center[1]); hexScaleSamples++ }
  }
  interHexDist = hexScaleSamples > 0 ? interHexDist / hexScaleSamples : 0
  const hexScale = interHexDist * 0.28
  const MAX_BEND = interHexDist * 0.35

  const globalAdj = new Map<string, Set<string>>()
  for (const e of roadEdges) {
    const k1 = `${e.q1},${e.r1}`, k2 = `${e.q2},${e.r2}`
    if (!globalAdj.has(k1)) globalAdj.set(k1, new Set())
    if (!globalAdj.has(k2)) globalAdj.set(k2, new Set())
    globalAdj.get(k1)!.add(k2); globalAdj.get(k2)!.add(k1)
  }

  const edgeMinTier = new Map<string, 0 | 1 | 2>()
  for (const e of roadEdges) {
    const k1 = `${e.q1},${e.r1}`, k2 = `${e.q2},${e.r2}`
    const ek = k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`
    const existing = edgeMinTier.get(ek)
    if (existing === undefined || e.tier < existing) edgeMinTier.set(ek, e.tier)
  }

  const junctionPositions = new Map<string, [number, number]>()
  for (const [k] of globalAdj) {
    const isJunc = (globalAdj.get(k)?.size ?? 0) > 2
    if (!isJunc) continue
    const h = hexIdx.get(k); if (!h) continue
    let minTier: 0 | 1 | 2 = 2
    for (const nk of globalAdj.get(k) ?? []) {
      const ek = k < nk ? `${k}|${nk}` : `${nk}|${k}`
      const t = edgeMinTier.get(ek)
      if (t !== undefined && t < minTier) minTier = t
    }
    let sumX = 0, sumY = 0, count = 0
    for (const nk of globalAdj.get(k) ?? []) {
      const ek = k < nk ? `${k}|${nk}` : `${nk}|${k}`
      if (edgeMinTier.get(ek) !== minTier) continue
      const hn = hexIdx.get(nk); if (!hn) continue
      sumX += (h.center[0] + hn.center[0]) / 2
      sumY += (h.center[1] + hn.center[1]) / 2
      count++
    }
    junctionPositions.set(k, count > 0 ? [sumX / count, sumY / count] : [h.center[0], h.center[1]])
  }

  for (const [ok, pos] of Object.entries(overrides)) {
    if (ok.startsWith('ja|')) junctionPositions.set(ok.slice(3), pos)
  }

  // --- Staggered spine model ---
  // For each junction hex, find the two most collinear neighbors (the "spine").
  // All other neighbors are "branches" that get slightly offset terminal points
  // along the spine, creating staggered junctions instead of a single star-burst.

  const spineNeighbors = new Map<string, [string, string]>() // hexKey → [spineA, spineB]
  // armTerminals: "hexKey|neighborKey" → terminal lon/lat position for that arm
  const armTerminals = new Map<string, [number, number]>()

  for (const [k] of globalAdj) {
    const neighbors = [...(globalAdj.get(k) ?? [])]
    if (neighbors.length <= 2) continue
    const h = hexIdx.get(k); if (!h) continue
    const jc = junctionPositions.get(k) ?? h.center

    // Find the most collinear pair of neighbors (dot product closest to -1)
    let bestPair: [string, string] | null = null
    let bestDot = 1
    for (let i = 0; i < neighbors.length; i++) {
      for (let j = i + 1; j < neighbors.length; j++) {
        const ni = hexIdx.get(neighbors[i]), nj = hexIdx.get(neighbors[j])
        if (!ni || !nj) continue
        const dx1 = ni.center[0] - h.center[0], dy1 = ni.center[1] - h.center[1]
        const dx2 = nj.center[0] - h.center[0], dy2 = nj.center[1] - h.center[1]
        const len1 = Math.hypot(dx1, dy1), len2 = Math.hypot(dx2, dy2)
        if (len1 < 1e-6 || len2 < 1e-6) continue
        const dot = (dx1 * dx2 + dy1 * dy2) / (len1 * len2)
        if (dot < bestDot) { bestDot = dot; bestPair = [neighbors[i], neighbors[j]] }
      }
    }
    if (!bestPair) continue
    spineNeighbors.set(k, bestPair)

    // Spine arms: terminal at junction center (unchanged behaviour)
    armTerminals.set(`${k}|${bestPair[0]}`, jc)
    armTerminals.set(`${k}|${bestPair[1]}`, jc)

    // Branch arms: offset from junction center toward the branch neighbor direction
    const branchOffset = interHexDist * 0.10
    for (const bn of neighbors) {
      if (bn === bestPair[0] || bn === bestPair[1]) continue
      const hn = hexIdx.get(bn)
      if (!hn) { armTerminals.set(`${k}|${bn}`, jc); continue }
      const dx = hn.center[0] - h.center[0], dy = hn.center[1] - h.center[1]
      const len = Math.hypot(dx, dy)
      if (len < 1e-6) { armTerminals.set(`${k}|${bn}`, jc); continue }
      armTerminals.set(`${k}|${bn}`, [jc[0] + (dx / len) * branchOffset, jc[1] + (dy / len) * branchOffset])
    }
  }

  // Apply jb| overrides to individual branch arm terminals
  for (const [ok, pos] of Object.entries(overrides)) {
    if (!ok.startsWith('jb|')) continue
    const parts = ok.split('|') // ["jb", hexKey, neighborKey]
    if (parts.length === 3) armTerminals.set(`${parts[1]}|${parts[2]}`, pos)
  }

  const chains: { tier: 0 | 1 | 2; chain: [number, number][] }[] = []
  const junctionMap = new Map<string, { pos: [number, number]; tier: 0 | 1 | 2 }>()
  const controlPoints: { key: string; pos: [number, number] }[] = []
  const seenEdges = new Set<string>()

  const byTier = new Map<0 | 1 | 2, typeof roadEdges>()
  for (const e of roadEdges) {
    if (!byTier.has(e.tier)) byTier.set(e.tier, [])
    byTier.get(e.tier)!.push(e)
  }

  for (const [tier, edges] of byTier) {
    const adj = new Map<string, string[]>()
    for (const e of edges) {
      const k1 = `${e.q1},${e.r1}`, k2 = `${e.q2},${e.r2}`
      if (!adj.has(k1)) adj.set(k1, [])
      if (!adj.has(k2)) adj.set(k2, [])
      if (!adj.get(k1)!.includes(k2)) adj.get(k1)!.push(k2)
      if (!adj.get(k2)!.includes(k1)) adj.get(k2)!.push(k1)
    }

    const visitedPairs = new Set<string>()
    const isJunction = (k: string) => (globalAdj.get(k)?.size ?? 0) > 2

    for (const [k] of adj) {
      if (isJunction(k)) {
        const h = hexIdx.get(k)
        if (h) {
          const existing = junctionMap.get(k)
          if (!existing || tier < existing.tier)
            junctionMap.set(k, { pos: junctionPositions.get(k) ?? h.center, tier })
        }
      }
    }

    // Returns the terminal position for a road entering junction hex `k` from neighbor `fromNbr`.
    // Uses the per-arm staggered position for branch arms, junction center for spine arms.
    const jPos = (k: string, h: { center: [number, number] }, fromNbr?: string): [number, number] => {
      if (fromNbr) {
        const arm = armTerminals.get(`${k}|${fromNbr}`)
        if (arm) return arm
      }
      return junctionPositions.get(k) ?? h.center
    }

    const walk = (startKey: string): [number, number][] => {
      const h0 = hexIdx.get(startKey)
      if (!h0) return []
      const startDeg = (adj.get(startKey) ?? []).length
      const pts: [number, number][] = []
      let firstStep = true
      let prevKey = startKey
      let cur = startKey
      for (;;) {
        const next = (adj.get(cur) ?? []).find(nk => {
          const ep = cur < nk ? `${cur}|${nk}` : `${nk}|${cur}`
          return !visitedPairs.has(ep)
        })
        if (!next) break
        // Defer pushing the start junction point until we know the outgoing direction
        if (firstStep) {
          firstStep = false
          if (startDeg !== 2 || isJunction(startKey)) pts.push(jPos(startKey, h0, next))
        }
        const ep = cur < next ? `${cur}|${next}` : `${next}|${cur}`
        visitedPairs.add(ep)
        const h1 = hexIdx.get(cur), h2 = hexIdx.get(next)
        if (h1 && h2) {
          const ek = edgeCpKey(cur, next)
          let mid: [number, number]
          if (overrides[ek]) {
            mid = overrides[ek]
          } else {
            const mx = (h1.center[0] + h2.center[0]) / 2
            const my = (h1.center[1] + h2.center[1]) / 2
            const dx = h2.center[0] - h1.center[0], dy = h2.center[1] - h1.center[1]
            const len = Math.hypot(dx, dy)
            const [qa, ra] = (cur < next ? cur : next).split(',').map(Number)
            const [qb, rb] = (cur < next ? next : cur).split(',').map(Number)
            const bend = ((hexBendiness[cur] ?? globalBendiness) + (hexBendiness[next] ?? globalBendiness)) / 2
            const perp = (seededRandom(qa + qb, ra + rb, 5) - 0.5) * 2 * MAX_BEND * bend * 0.4
            mid = len > 1e-6 ? [mx + (-dy / len) * perp, my + (dx / len) * perp] : [mx, my]
          }
          pts.push(mid)
          if (!seenEdges.has(ek)) { seenEdges.add(ek); controlPoints.push({ key: ek, pos: mid }) }
        }
        prevKey = cur
        cur = next
        const curDeg = (adj.get(cur) ?? []).length
        if (curDeg === 1) { const he = hexIdx.get(cur); if (he) pts.push(he.center); break }
        if (isJunction(cur)) { const hj = hexIdx.get(cur); if (hj) pts.push(jPos(cur, hj, prevKey)); break }
      }
      return pts
    }

    for (const [k, nbs] of adj) { if (nbs.length === 1) { const pts = walk(k); if (pts.length >= 2) chains.push({ tier, chain: catmullRom(pts, 10) }) } }
    for (const [k, nbs] of adj) {
      if (isJunction(k)) {
        for (const nk of nbs) {
          const ep = k < nk ? `${k}|${nk}` : `${nk}|${k}`
          if (!visitedPairs.has(ep)) { const pts = walk(k); if (pts.length >= 2) chains.push({ tier, chain: catmullRom(pts, 10) }) }
        }
      }
    }
    for (const [k, nbs] of adj) {
      for (const nk of nbs) {
        const ep = k < nk ? `${k}|${nk}` : `${nk}|${k}`
        if (!visitedPairs.has(ep)) { const pts = walk(k); if (pts.length >= 2) chains.push({ tier, chain: catmullRom(pts, 10) }) }
      }
    }
  }

  // Add stub chains connecting each branch arm terminal back to the spine junction center.
  // These short segments visually close the gap between a staggered branch and the spine.
  for (const [k, spinePair] of spineNeighbors) {
    const h = hexIdx.get(k); if (!h) continue
    const jc = junctionPositions.get(k) ?? h.center
    for (const bn of globalAdj.get(k) ?? []) {
      if (bn === spinePair[0] || bn === spinePair[1]) continue
      const bt = armTerminals.get(`${k}|${bn}`)
      if (!bt) continue
      // Skip if the branch terminal is already at the junction center (no gap to close)
      if (Math.hypot(bt[0] - jc[0], bt[1] - jc[1]) < 1e-9) continue
      const ek = k < bn ? `${k}|${bn}` : `${bn}|${k}`
      const stubTier = edgeMinTier.get(ek) ?? 2
      chains.push({ tier: stubTier, chain: [bt, jc] })
    }
  }

  // Add branch arm terminals as extra junction dots and draggable control points
  for (const [k, spinePair] of spineNeighbors) {
    const h = hexIdx.get(k); if (!h) continue
    const jc = junctionPositions.get(k) ?? h.center
    for (const bn of globalAdj.get(k) ?? []) {
      if (bn === spinePair[0] || bn === spinePair[1]) continue
      const bt = armTerminals.get(`${k}|${bn}`)
      if (!bt || Math.hypot(bt[0] - jc[0], bt[1] - jc[1]) < 1e-9) continue
      const ek = k < bn ? `${k}|${bn}` : `${bn}|${k}`
      const branchTier = edgeMinTier.get(ek) ?? 2
      junctionMap.set(`${k}|br|${bn}`, { pos: bt, tier: branchTier })
      controlPoints.push({ key: branchCpKey(k, bn), pos: bt })
    }
  }

  for (const [k, entry] of junctionMap) {
    // Only emit the control point for real junction hexes (not branch-arm entries)
    if (!k.includes('|br|')) controlPoints.push({ key: juncCpKey(k), pos: entry.pos })
  }

  return { chains, junctions: Array.from(junctionMap.values()), controlPoints }
}

export function buildRailChains(
  railEdges: { q1: number; r1: number; q2: number; r2: number }[],
  roadEdges: { q1: number; r1: number; q2: number; r2: number }[],
  hexIdx: Map<string, { center: [number, number] }>,
  roadEdgeMidpoints: Map<string, [number, number]>,
  roadJunctionPositions: Map<string, [number, number]>,
): { chain: [number, number][]; isShared: boolean }[] {
  if (railEdges.length === 0) return []

  let hexScale = 0, hexScaleSamples = 0
  for (const e of railEdges.slice(0, 8)) {
    const h1 = hexIdx.get(`${e.q1},${e.r1}`), h2 = hexIdx.get(`${e.q2},${e.r2}`)
    if (h1 && h2) { hexScale += Math.hypot(h2.center[0] - h1.center[0], h2.center[1] - h1.center[1]); hexScaleSamples++ }
  }
  hexScale = hexScaleSamples > 0 ? (hexScale / hexScaleSamples) * 0.28 : 0

  const roadPairSet = new Set<string>()
  for (const e of roadEdges) {
    const a = `${e.q1},${e.r1}`, b = `${e.q2},${e.r2}`
    roadPairSet.add(a < b ? `${a}|${b}` : `${b}|${a}`)
  }

  const adj = new Map<string, string[]>()
  for (const e of railEdges) {
    const k1 = `${e.q1},${e.r1}`, k2 = `${e.q2},${e.r2}`
    if (!adj.has(k1)) adj.set(k1, [])
    if (!adj.has(k2)) adj.set(k2, [])
    if (!adj.get(k1)!.includes(k2)) adj.get(k1)!.push(k2)
    if (!adj.get(k2)!.includes(k1)) adj.get(k2)!.push(k1)
  }
  const visitedPairs = new Set<string>()
  const isJunction = (k: string) => (adj.get(k) ?? []).length > 2

  const junctionPositions = new Map<string, [number, number]>()
  for (const [k] of adj) {
    if (!isJunction(k)) continue
    const h = hexIdx.get(k); if (!h) continue
    const [q, r] = k.split(',').map(Number)
    const angle = seededRandom(q, r, 7) * Math.PI * 2
    const radius = hexScale * 0.15
    const ox = Math.cos(angle) * radius, oy = Math.sin(angle) * radius
    let valid = true
    for (const nk of adj.get(k) ?? []) {
      const hn = hexIdx.get(nk); if (!hn) continue
      const ax = h.center[0] - (h.center[0] + hn.center[0]) / 2
      const ay = h.center[1] - (h.center[1] + hn.center[1]) / 2
      if (ox * ax + oy * ay < -0.4 * Math.hypot(ax, ay) * Math.hypot(ox, oy)) { valid = false; break }
    }
    if (valid) junctionPositions.set(k, [h.center[0] + ox, h.center[1] + oy])
  }
  const jPos = (k: string, h: { center: [number, number] }) => junctionPositions.get(k) ?? h.center

  const walk = (startKey: string) => {
    const h0 = hexIdx.get(startKey)
    if (!h0) return { pts: [] as [number, number][], midShared: [] as (boolean | null)[] }
    const startDeg = (adj.get(startKey) ?? []).length
    const pts: [number, number][] = []
    const midShared: (boolean | null)[] = []
    if (startDeg !== 2 || isJunction(startKey)) { pts.push(jPos(startKey, h0)); midShared.push(null) }
    let cur = startKey
    for (;;) {
      const next = (adj.get(cur) ?? []).find(nk => {
        const ep = cur < nk ? `${cur}|${nk}` : `${nk}|${cur}`
        return !visitedPairs.has(ep)
      })
      if (!next) break
      const ep = cur < next ? `${cur}|${next}` : `${next}|${cur}`
      visitedPairs.add(ep)
      const h1 = hexIdx.get(cur), h2 = hexIdx.get(next)
      if (h1 && h2) {
        const ek = edgeCpKey(cur, next)
        const roadMid = roadPairSet.has(ep) ? roadEdgeMidpoints.get(ek) : undefined
        let mid: [number, number]
        if (roadMid) {
          mid = roadMid
        } else {
          const mx = (h1.center[0] + h2.center[0]) / 2, my = (h1.center[1] + h2.center[1]) / 2
          const dx = h2.center[0] - h1.center[0], dy = h2.center[1] - h1.center[1]
          const len = Math.hypot(dx, dy)
          const [qa, ra] = (cur < next ? cur : next).split(',').map(Number)
          const [qb, rb] = (cur < next ? next : cur).split(',').map(Number)
          const perp = (seededRandom(qa + qb, ra + rb, 6) - 0.5) * hexScale * 0.5
          mid = len > 1e-6 ? [mx + (-dy / len) * perp, my + (dx / len) * perp] : [mx, my]
        }
        pts.push(mid)
        midShared.push(roadPairSet.has(ep))
      }
      cur = next
      const curDeg = (adj.get(cur) ?? []).length
      if (curDeg === 1) { const he = hexIdx.get(cur); if (he) { pts.push(he.center); midShared.push(null) } break }
      if (isJunction(cur)) { const hj = hexIdx.get(cur); if (hj) { pts.push(jPos(cur, hj)); midShared.push(null) } break }
      const roadJuncPos = roadJunctionPositions.get(cur)
      if (roadJuncPos) { pts.push(roadJuncPos); midShared.push(null) }
    }
    return { pts, midShared }
  }

  const segmentShared = (midShared: (boolean | null)[]): boolean[] =>
    midShared.slice(0, -1).map((cur, i) => {
      const next = midShared[i + 1]
      return next !== null ? next : cur !== null ? cur : false
    })

  const splitSubChains = (pts: [number, number][], segSh: boolean[]): { pts: [number, number][]; isShared: boolean }[] => {
    if (pts.length < 2 || segSh.length === 0) return []
    const result: { pts: [number, number][]; isShared: boolean }[] = []
    let runStart = 0, runShared = segSh[0]
    for (let i = 1; i <= segSh.length; i++) {
      const atEnd = i === segSh.length
      if (atEnd || segSh[i] !== runShared) {
        result.push({ pts: pts.slice(runStart, i + 1), isShared: runShared })
        runStart = i
        if (!atEnd) runShared = segSh[i]
      }
    }
    return result
  }

  const results: { chain: [number, number][]; isShared: boolean }[] = []
  const pushWalk = (startKey: string) => {
    const { pts, midShared } = walk(startKey)
    if (pts.length < 2) return
    for (const { pts: sub, isShared } of splitSubChains(pts, segmentShared(midShared))) {
      if (sub.length >= 2) results.push({ chain: catmullRom(sub, 10), isShared })
    }
  }

  for (const [k, nbs] of adj) { if (nbs.length === 1) pushWalk(k) }
  for (const [k, nbs] of adj) {
    if (isJunction(k)) {
      for (const nk of nbs) {
        const ep = k < nk ? `${k}|${nk}` : `${nk}|${k}`
        if (!visitedPairs.has(ep)) pushWalk(k)
      }
    }
  }
  for (const [k, nbs] of adj) {
    for (const nk of nbs) {
      const ep = k < nk ? `${k}|${nk}` : `${nk}|${k}`
      if (!visitedPairs.has(ep)) pushWalk(k)
    }
  }
  return results
}
