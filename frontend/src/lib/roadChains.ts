/** Road and rail chain building utilities.
 *  Converts hex-edge graphs into smooth polyline chains for rendering. */

import { catmullRom, chaikin } from './geometry'
import { seededRandom, wiggleChain } from './noise'

export function edgeCpKey(k1: string, k2: string): string {
  return `em|${k1 < k2 ? k1 : k2}|${k1 < k2 ? k2 : k1}`
}

function roadVKey(v: [number, number]): string {
  return `${Math.round(v[0] / 1e-5)},${Math.round(v[1] / 1e-5)}`
}
export function roadHopKey(v0: [number, number], v1: [number, number]): string {
  const k0 = roadVKey(v0), k1 = roadVKey(v1)
  return k0 < k1 ? `${k0}||${k1}` : `${k1}||${k0}`
}

export function juncCpKey(k: string): string {
  return `ja|${k}`
}

/** Key for a draggable spine-side terminal override.
 *  nk is the spine neighbour whose side this terminal belongs to. */
export function spineSideCpKey(k: string, nk: string): string {
  return `jt|${k}|${nk}`
}

export function buildRoadChains(
  roadEdges: { q1: number; r1: number; q2: number; r2: number; tier: 0 | 1 | 2 }[],
  hexIdx: Map<string, { center: [number, number] }>,
  overrides: Record<string, [number, number]>,
  wiggleAmpFactor = 0,
  wiggleFreqFactor = 2.5,
  smoothing = 10,
  pathSmoothing = 0,
  chainOverrides: Record<string, [number, number][]> = {},
  segProps: Record<string, { wiggleAmp?: number; wiggleFreq?: number }> = {},
  hopProps: Record<string, { wiggleAmp?: number; wiggleFreq?: number }> = {},
  snapBindings: Record<string, string> = {},
  chaikinPasses = 4,
): { chains: { tier: 0 | 1 | 2; chain: [number, number][]; baseChain: [number, number][]; id: string; hopKeys?: string[]; hopRanges?: [number, number][] }[]; junctions: { pos: [number, number]; tier: 0 | 1 | 2 }[]; controlPoints: { key: string; pos: [number, number]; chainId?: string; chainIdx?: number }[]; interHexDist: number } {
  if (roadEdges.length === 0) return { chains: [], junctions: [], controlPoints: [], interHexDist: 0 }

  // Resolve snap-bound jt| endpoints to stable em| hex midpoints. These midpoints don't
  // move with wiggle/smoothing, so connections survive parameter changes.
  const effectiveOverrides: Record<string, [number, number]> = { ...overrides }
  for (const [jtKey, emKey] of Object.entries(snapBindings)) {
    const parts = emKey.split('|')
    if (parts.length !== 3) continue
    const h1 = hexIdx.get(parts[1]), h2 = hexIdx.get(parts[2])
    if (!h1 || !h2) continue
    effectiveOverrides[jtKey] = (overrides[emKey] as [number, number] | undefined) ??
      [(h1.center[0] + h2.center[0]) / 2, (h1.center[1] + h2.center[1]) / 2]
  }

  let interHexDist = 0, hexScaleSamples = 0
  for (const e of roadEdges.slice(0, 8)) {
    const h1 = hexIdx.get(`${e.q1},${e.r1}`), h2 = hexIdx.get(`${e.q2},${e.r2}`)
    if (h1 && h2) { interHexDist += Math.hypot(h2.center[0] - h1.center[0], h2.center[1] - h1.center[1]); hexScaleSamples++ }
  }
  interHexDist = hexScaleSamples > 0 ? interHexDist / hexScaleSamples : 0
  const hexScale = interHexDist * 0.28

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

  for (const [ok, pos] of Object.entries(effectiveOverrides)) {
    if (ok.startsWith('ja|')) junctionPositions.set(ok.slice(3), pos)
  }

  // --- Staggered spine junction model ---
  //
  // For each junction hex, find the two most collinear neighbours (the "spine").
  // Branches are assigned to whichever spine side they face (via cross-product with
  // spine direction). If branches exist on both sides, the junction splits into two
  // T-junctions — terminal_A (spine-A side) and terminal_B (spine-B side) — offset
  // along the spine from the centre. The spine road passes through both, connected
  // by a short stub, giving the "two separate T-junctions" look.
  //
  // If all branches fall on one side (classic T-junction), both terminals collapse
  // to the same centre point and behaviour is identical to before.

  const spineNeighbors = new Map<string, [string, string]>()
  // armToTerminal: "hexKey|anyNeighborKey" → which [x,y] that arm terminates at
  const armToTerminal = new Map<string, [number, number]>()
  // sideTerminals: "hexKey|spineNeighborKey" → the terminal position for that spine side
  const sideTerminals = new Map<string, [number, number]>()

  for (const [k] of globalAdj) {
    const neighbors = [...(globalAdj.get(k) ?? [])]
    if (neighbors.length <= 2) continue
    const h = hexIdx.get(k); if (!h) continue
    const jc = junctionPositions.get(k) ?? h.center

    // Find the most collinear pair of neighbours (dot product closest to -1) — the spine
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

    const hA = hexIdx.get(bestPair[0]), hB = hexIdx.get(bestPair[1])
    if (!hA || !hB) continue

    // Spine unit direction (from K toward spineA)
    const sdx = hA.center[0] - h.center[0], sdy = hA.center[1] - h.center[1]
    const sLen = Math.hypot(sdx, sdy)
    const snx = sLen > 1e-6 ? sdx / sLen : 1, sny = sLen > 1e-6 ? sdy / sLen : 0

    // Assign each branch to side A or B by cross-product with spine direction.
    // Positive cross → branch is "left" of spine direction → side A.
    // Negative → side B. Zero (perpendicular) → alternate for stability.
    const branches = neighbors.filter(n => n !== bestPair![0] && n !== bestPair![1]).sort()
    const sideA = new Set<string>(), sideB = new Set<string>()
    let tieIdx = 0
    for (const bn of branches) {
      const hn = hexIdx.get(bn); if (!hn) continue
      const bx = hn.center[0] - h.center[0], by = hn.center[1] - h.center[1]
      const cross = bx * sny - by * snx
      if (cross > 1e-9) sideA.add(bn)
      else if (cross < -1e-9) sideB.add(bn)
      else { (tieIdx++ % 2 === 0 ? sideA : sideB).add(bn) }
    }

    // Default is merged (offset 0). Stagger only happens via user overrides (jt| keys).
    const offset = 0

    // Apply user position overrides for the two side terminals
    const defaultA: [number, number] = [jc[0] + snx * offset, jc[1] + sny * offset]
    const defaultB: [number, number] = [jc[0] - snx * offset, jc[1] - sny * offset]
    const termA: [number, number] = effectiveOverrides[spineSideCpKey(k, bestPair[0])] ?? defaultA
    const termB: [number, number] = effectiveOverrides[spineSideCpKey(k, bestPair[1])] ?? defaultB

    // Map every arm to its terminal; per-arm jt| override takes precedence for branch arms
    armToTerminal.set(`${k}|${bestPair[0]}`, termA)
    armToTerminal.set(`${k}|${bestPair[1]}`, termB)
    for (const bn of sideA) armToTerminal.set(`${k}|${bn}`, effectiveOverrides[spineSideCpKey(k, bn)] ?? termA)
    for (const bn of sideB) armToTerminal.set(`${k}|${bn}`, effectiveOverrides[spineSideCpKey(k, bn)] ?? termB)
    for (const bn of branches) {
      if (!sideA.has(bn) && !sideB.has(bn)) armToTerminal.set(`${k}|${bn}`, effectiveOverrides[spineSideCpKey(k, bn)] ?? termA)
    }

    sideTerminals.set(`${k}|${bestPair[0]}`, termA)
    sideTerminals.set(`${k}|${bestPair[1]}`, termB)
  }

  const wiggleAmplitude = wiggleAmpFactor * interHexDist
  const wiggleFreq = wiggleFreqFactor / interHexDist

  const chains: { tier: 0 | 1 | 2; chain: [number, number][]; baseChain?: [number, number][]; id: string; hopKeys?: string[]; hopRanges?: [number, number][] }[] = []
  const junctionMap = new Map<string, { pos: [number, number]; tier: 0 | 1 | 2 }>()
  const controlPoints: { key: string; pos: [number, number] }[] = []
  const seenEdges = new Set<string>()
  // Hexes that are genuine junctions in at least one tier (per-tier degree > 2).
  // Used to suppress stub chains and junction dots for hexes that only appear as
  // junctions due to cross-tier edge aggregation in globalAdj.
  const tierJunctionHexes = new Set<string>()

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
    // isJunction is intentionally per-tier: a hex is a junction only when this
    // tier alone has > 2 connections there. Using globalAdj caused tier-0 roads
    // to form T-junctions wherever a tier-1 road happened to share the same hex.
    const isJunction = (k: string) => (adj.get(k)?.length ?? 0) > 2
    for (const [k, nbs] of adj) { if (nbs.length > 2) tierJunctionHexes.add(k) }

    for (const [k] of adj) {
      if (isJunction(k) && !spineNeighbors.has(k)) {
        // Hexes with a spine pair get their junction dots from side terminals instead
        const h = hexIdx.get(k)
        if (h) {
          const pos = junctionPositions.get(k) ?? h.center
          const existing = junctionMap.get(k)
          if (!existing || tier < existing.tier) junctionMap.set(k, { pos, tier })
        }
      }
    }

    // Returns the terminal position for a road entering junction hex `k` from `fromNbr`.
    // Uses the staggered side terminal for that arm if available.
    const jPos = (k: string, h: { center: [number, number] }, fromNbr?: string): [number, number] => {
      if (fromNbr) {
        const arm = armToTerminal.get(`${k}|${fromNbr}`)
        if (arm) return arm
      }
      return junctionPositions.get(k) ?? h.center
    }

    // pinned[i] = true means pts[i] must not move during path smoothing
    const walk = (startKey: string): { pts: [number, number][]; endKey: string; pinned: boolean[]; edgeKeys: (string | null)[] } => {
      const h0 = hexIdx.get(startKey)
      if (!h0) return { pts: [], endKey: startKey, pinned: [], edgeKeys: [] }
      const startDeg = (adj.get(startKey) ?? []).length
      const pts: [number, number][] = []
      const pinned: boolean[] = []
      const edgeKeys: (string | null)[] = []
      let firstStep = true
      let prevKey = startKey
      let cur = startKey
      for (;;) {
        const next = (adj.get(cur) ?? []).find(nk => {
          const ep = cur < nk ? `${cur}|${nk}` : `${nk}|${cur}`
          return !visitedPairs.has(ep)
        })
        if (!next) break
        if (firstStep) {
          firstStep = false
          if (startDeg !== 2 || isJunction(startKey)) {
            pts.push(jPos(startKey, h0, next)); pinned.push(true); edgeKeys.push(null)
          }
        }
        const ep = cur < next ? `${cur}|${next}` : `${next}|${cur}`
        visitedPairs.add(ep)
        const h1 = hexIdx.get(cur), h2 = hexIdx.get(next)
        if (h1 && h2) {
          const ek = edgeCpKey(cur, next)
          const isOverridden = !!effectiveOverrides[ek]
          const mid: [number, number] = isOverridden
            ? effectiveOverrides[ek]
            : [(h1.center[0] + h2.center[0]) / 2, (h1.center[1] + h2.center[1]) / 2]
          pts.push(mid); pinned.push(isOverridden); edgeKeys.push(ek)
          seenEdges.add(ek)
        }
        prevKey = cur
        cur = next
        const curDeg = (adj.get(cur) ?? []).length
        if (curDeg === 1) { const he = hexIdx.get(cur); if (he) { pts.push(he.center); pinned.push(true); edgeKeys.push(null) } break }
        if (isJunction(cur)) { const hj = hexIdx.get(cur); if (hj) { pts.push(jPos(cur, hj, prevKey)); pinned.push(true); edgeKeys.push(null) } break }
      }
      return { pts, endKey: cur, pinned, edgeKeys }
    }

    const pushChain = (startKey: string) => {
      const { pts, endKey, pinned, edgeKeys } = walk(startKey)
      if (pts.length < 2) return

      const a = startKey < endKey ? startKey : endKey
      const b = startKey < endKey ? endKey : startKey
      const id = `${tier}|${a}|${b}`

      // Laplacian path smoothing: iteratively move each floating waypoint toward
      // the average of its neighbours. Pinned points (junctions, overridden em|) stay fixed.
      const relaxed = pts.slice() as [number, number][]
      const iters = Math.round(pathSmoothing)
      for (let it = 0; it < iters; it++) {
        for (let i = 1; i < relaxed.length - 1; i++) {
          if (pinned[i]) continue
          const avgX = (relaxed[i - 1][0] + relaxed[i + 1][0]) / 2
          const avgY = (relaxed[i - 1][1] + relaxed[i + 1][1]) / 2
          relaxed[i] = [
            relaxed[i][0] + 0.1 * (avgX - relaxed[i][0]),
            relaxed[i][1] + 0.1 * (avgY - relaxed[i][1]),
          ]
        }
      }

      const storedHandles = chainOverrides[id]
      const steps = Math.round(smoothing)
      const stepsActual = steps === 0 ? 1 : Math.max(2, steps)

      // Emit em| control points. chainIdx tracks where each em| lands in the catmullRom output
      // so we can split chains at exact indices later. Only reliable without storedHandles.
      for (let i = 0; i < edgeKeys.length; i++) {
        const ek = edgeKeys[i]
        if (ek !== null) controlPoints.push({
          key: ek, pos: relaxed[i], chainId: id,
          chainIdx: storedHandles ? undefined : i * stepsActual,
        })
      }
      let baseChain: [number, number][]
      if (steps === 0) {
        baseChain = storedHandles && storedHandles.length >= 2
          ? [relaxed[0], ...storedHandles.slice(1, -1), relaxed[relaxed.length - 1]]
          : relaxed.slice()
      } else if (storedHandles && storedHandles.length >= 2) {
        const pinned: [number, number][] = [relaxed[0], ...storedHandles.slice(1, -1), relaxed[relaxed.length - 1]]
        baseChain = catmullRom(pinned, Math.max(2, steps))
      } else {
        baseChain = catmullRom(relaxed, Math.max(2, steps))
      }
      const effectiveCtrl = (storedHandles && storedHandles.length >= 2)
        ? [relaxed[0], ...storedHandles.slice(1, -1), relaxed[relaxed.length - 1]] as [number, number][]
        : relaxed
      const hopCount = effectiveCtrl.length - 1
      const denseSteps = Math.max(1, steps)
      const hopKeysList: string[] = []
      const hopRanges: [number, number][] = []
      for (let h = 0; h < hopCount; h++) {
        hopKeysList.push(roadHopKey(effectiveCtrl[h], effectiveCtrl[h + 1]))
        hopRanges.push([h * denseSteps, (h + 1) * denseSteps])
      }

      const sp = segProps[id]
      const hasAnyOverride = sp?.wiggleAmp !== undefined || sp?.wiggleFreq !== undefined ||
        hopKeysList.some(k => hopProps[k]?.wiggleAmp !== undefined || hopProps[k]?.wiggleFreq !== undefined)

      let chain: [number, number][]
      if (!hasAnyOverride) {
        chain = wiggleChain(baseChain, wiggleAmplitude, wiggleFreq)
      } else {
        const dense = [...baseChain] as [number, number][]
        for (let h = 0; h < hopCount; h++) {
          const [s, e] = hopRanges[h]
          const hp = hopProps[hopKeysList[h]]
          const amp = (hp?.wiggleAmp ?? sp?.wiggleAmp ?? wiggleAmpFactor) * interHexDist
          const freq = (hp?.wiggleFreq ?? sp?.wiggleFreq ?? wiggleFreqFactor) / interHexDist
          const slice = baseChain.slice(s, e + 1)
          const wiggled = wiggleChain(slice, amp, freq)
          for (let i = 0; i < wiggled.length; i++) dense[s + i] = wiggled[i]
        }
        chain = dense
      }
      const effectiveAmp = hasAnyOverride
        ? Math.max(...hopKeysList.map((k, h) => {
            const hp = hopProps[k]; const sp2 = segProps[id]
            return (hp?.wiggleAmp ?? sp2?.wiggleAmp ?? wiggleAmpFactor) * interHexDist
          }))
        : wiggleAmplitude
      if (effectiveAmp > 0 && chaikinPasses > 0) chain = chaikin(chain, chaikinPasses, false)
      chains.push({ tier, chain, baseChain, id, hopKeys: hopKeysList, hopRanges })
    }

    for (const [k, nbs] of adj) { if (nbs.length === 1) pushChain(k) }
    for (const [k, nbs] of adj) {
      if (isJunction(k)) {
        for (const nk of nbs) {
          const ep = k < nk ? `${k}|${nk}` : `${nk}|${k}`
          if (!visitedPairs.has(ep)) pushChain(k)
        }
      }
    }
    for (const [k, nbs] of adj) {
      for (const nk of nbs) {
        const ep = k < nk ? `${k}|${nk}` : `${nk}|${k}`
        if (!visitedPairs.has(ep)) pushChain(k)
      }
    }
  }

  // Stub chains linking the two side terminals (the short spine section between T-junctions).
  // Skipped when the junction is fully dissolved — each arm has its own free endpoint.
  for (const [k, spinePair] of spineNeighbors) {
    if (!tierJunctionHexes.has(k)) continue
    const allDissolved = [...(globalAdj.get(k) ?? [])].every(nk => !!effectiveOverrides[spineSideCpKey(k, nk)])
    if (allDissolved) continue
    const termA = sideTerminals.get(`${k}|${spinePair[0]}`)
    const termB = sideTerminals.get(`${k}|${spinePair[1]}`)
    if (!termA || !termB) continue
    if (Math.hypot(termA[0] - termB[0], termA[1] - termB[1]) < 1e-9) continue
    const ekA = k < spinePair[0] ? `${k}|${spinePair[0]}` : `${spinePair[0]}|${k}`
    const ekB = k < spinePair[1] ? `${k}|${spinePair[1]}` : `${spinePair[1]}|${k}`
    const stubTier = Math.min(edgeMinTier.get(ekA) ?? 2, edgeMinTier.get(ekB) ?? 2) as 0 | 1 | 2
    chains.push({ tier: stubTier, chain: [termA, termB], id: `stub|${k}` })
  }

  // Junction dots at each unique side terminal, plus draggable control points
  const emittedJuncCps = new Set<string>()
  for (const [k, spinePair] of spineNeighbors) {
    if (!tierJunctionHexes.has(k)) continue
    const h = hexIdx.get(k)
    let minTier: 0 | 1 | 2 = 2
    for (const nk of globalAdj.get(k) ?? []) {
      const ek = k < nk ? `${k}|${nk}` : `${nk}|${k}`
      const t = edgeMinTier.get(ek)
      if (t !== undefined && t < minTier) minTier = t
    }
    // Always emit the ja| handle so the merged circle remains draggable.
    // This goes into controlPoints only — not junctionMap — so it doesn't
    // produce an extra rendered dot in the road layer.
    if (h) controlPoints.push({ key: juncCpKey(k), pos: junctionPositions.get(k) ?? h.center })
    for (const spineNk of spinePair) {
      const term = sideTerminals.get(`${k}|${spineNk}`)
      if (!term) continue
      const cpKey = spineSideCpKey(k, spineNk)
      if (emittedJuncCps.has(cpKey)) continue
      emittedJuncCps.add(cpKey)
      junctionMap.set(cpKey, { pos: term, tier: minTier })
      controlPoints.push({ key: cpKey, pos: term })
    }
    // Emit jt| for branch arms that have been individually dissolved
    for (const nk of globalAdj.get(k) ?? []) {
      if (spinePair.includes(nk)) continue
      const cpKey = spineSideCpKey(k, nk)
      if (!effectiveOverrides[cpKey]) continue
      if (emittedJuncCps.has(cpKey)) continue
      emittedJuncCps.add(cpKey)
      const pos = armToTerminal.get(`${k}|${nk}`) ?? hexIdx.get(k)?.center ?? [0, 0] as [number, number]
      junctionMap.set(cpKey, { pos, tier: minTier })
      controlPoints.push({ key: cpKey, pos })
    }
  }

  // For junction hexes that have no spine (shouldn't happen, but keep the dot)
  for (const [k, entry] of junctionMap) {
    if (!k.includes('|')) controlPoints.push({ key: juncCpKey(k), pos: entry.pos })
  }

  // Split road chains where an arm is snap-bound to an em| midpoint on that chain.
  // We split the baseChain at the exact catmullRom index then re-wiggle each half,
  // so the shared fork point becomes a pinned chain endpoint (zero wiggle displacement).
  // This guarantees the arm and both road halves always meet at the same point regardless
  // of wiggle amplitude, frequency, or smoothing settings.
  if (Object.keys(snapBindings).length > 0) {
    const splitChainIds = new Set<string>()
    for (const emKey of Object.values(snapBindings)) {
      const emCp = controlPoints.find(cp => cp.key === emKey && cp.chainIdx !== undefined)
      if (!emCp || emCp.chainId === undefined || emCp.chainIdx === undefined) continue
      if (splitChainIds.has(emCp.chainId)) continue
      const ci = chains.findIndex(c => c.id === emCp.chainId)
      if (ci < 0) continue
      const c = chains[ci]
      const si = emCp.chainIdx
      const base = c.baseChain ?? c.chain
      if (si <= 0 || si >= base.length - 1) continue
      splitChainIds.add(c.id)
      const baseA = base.slice(0, si + 1)
      const baseB = base.slice(si)
      chains.splice(ci, 1,
        { tier: c.tier, chain: wiggleChain(baseA, wiggleAmplitude, wiggleFreq), baseChain: baseA, id: `${c.id}|sA` },
        { tier: c.tier, chain: wiggleChain(baseB, wiggleAmplitude, wiggleFreq), baseChain: baseB, id: `${c.id}|sB` },
      )
    }
  }

  return { chains, junctions: Array.from(junctionMap.values()), controlPoints, interHexDist }
}

export type RoadBaseData = ReturnType<typeof buildRoadChains>

export function applyRoadWiggle(
  baseData: RoadBaseData,
  wiggleAmpFactor: number,
  wiggleFreqFactor: number,
  segProps: Record<string, { wiggleAmp?: number; wiggleFreq?: number }> = {},
  hopProps: Record<string, { wiggleAmp?: number; wiggleFreq?: number }> = {},
  chaikinPasses = 4,
): RoadBaseData {
  const { interHexDist } = baseData
  const wiggleAmplitude = wiggleAmpFactor * interHexDist
  const wiggleFreq = interHexDist > 0 ? wiggleFreqFactor / interHexDist : 0

  const chains = baseData.chains.map(c => {
    const base = c.baseChain ?? c.chain
    const { id, hopKeys: hopKeysList = [], hopRanges = [] } = c
    const sp = segProps[id]
    const hasAnyOverride = (sp?.wiggleAmp !== undefined || sp?.wiggleFreq !== undefined ||
      hopKeysList.some(k => hopProps[k]?.wiggleAmp !== undefined || hopProps[k]?.wiggleFreq !== undefined)) &&
      hopKeysList.length > 0

    let chain: [number, number][]
    if (!hasAnyOverride) {
      chain = wiggleChain(base, wiggleAmplitude, wiggleFreq)
    } else {
      const dense = [...base] as [number, number][]
      for (let h = 0; h < hopKeysList.length; h++) {
        const [s, e] = hopRanges[h]
        const hp = hopProps[hopKeysList[h]]
        const spg = segProps[id]
        const amp = (hp?.wiggleAmp ?? spg?.wiggleAmp ?? wiggleAmpFactor) * interHexDist
        const freq = (hp?.wiggleFreq ?? spg?.wiggleFreq ?? wiggleFreqFactor) / interHexDist
        const slice = base.slice(s, e + 1)
        const wiggled = wiggleChain(slice, amp, freq)
        for (let i = 0; i < wiggled.length; i++) dense[s + i] = wiggled[i]
      }
      chain = dense
    }
    const effectiveAmp = hasAnyOverride
      ? Math.max(...hopKeysList.map(k => {
          const hp = hopProps[k], sp2 = segProps[id]
          return (hp?.wiggleAmp ?? sp2?.wiggleAmp ?? wiggleAmpFactor) * interHexDist
        }))
      : wiggleAmplitude
    if (effectiveAmp > 0 && chaikinPasses > 0) chain = chaikin(chain, chaikinPasses, false)
    return { ...c, chain }
  })
  return { ...baseData, chains }
}

export type RailBaseData = {
  chains: {
    chain: [number, number][]
    baseChain: [number, number][]
    id: string
    isShared: boolean
    isLoop: boolean
    hopKeys: string[]
    hopRanges: [number, number][]
  }[]
  controlPoints: { key: string; pos: [number, number] }[]
  interHexDist: number
}

export function buildRailChains(
  railEdges: { q1: number; r1: number; q2: number; r2: number }[],
  roadEdges: { q1: number; r1: number; q2: number; r2: number }[],
  hexIdx: Map<string, { center: [number, number] }>,
  roadEdgeMidpoints: Map<string, [number, number]>,
  roadJunctionPositions: Map<string, [number, number]>,
  overrides: Record<string, [number, number]> = {},
  wiggleAmpFactor = 0,
  wiggleFreqFactor = 2.5,
  smoothing = 10,
  segProps: Record<string, { wiggleAmp?: number; wiggleFreq?: number }> = {},
  hopProps: Record<string, { wiggleAmp?: number; wiggleFreq?: number }> = {},
  chaikinPasses = 2,
): RailBaseData {
  if (railEdges.length === 0) return { chains: [], controlPoints: [], interHexDist: 0 }

  let interHexDist = 0, hexScaleSamples = 0
  for (const e of railEdges.slice(0, 8)) {
    const h1 = hexIdx.get(`${e.q1},${e.r1}`), h2 = hexIdx.get(`${e.q2},${e.r2}`)
    if (h1 && h2) { interHexDist += Math.hypot(h2.center[0] - h1.center[0], h2.center[1] - h1.center[1]); hexScaleSamples++ }
  }
  interHexDist = hexScaleSamples > 0 ? interHexDist / hexScaleSamples : 0
  const hexScale = interHexDist * 0.28

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

  const isJunction = (k: string) => (adj.get(k) ?? []).length > 2

  const junctionPositions = new Map<string, [number, number]>()
  for (const [k] of adj) {
    if (!isJunction(k)) continue
    const h = hexIdx.get(k); if (!h) continue
    const jaOverride = overrides[juncCpKey(k)]
    if (jaOverride) { junctionPositions.set(k, jaOverride); continue }
    const roadJP = roadJunctionPositions.get(k)
    if (roadJP) { junctionPositions.set(k, roadJP); continue }
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
    junctionPositions.set(k, valid ? [h.center[0] + ox, h.center[1] + oy] : h.center)
  }
  const jPos = (k: string) => junctionPositions.get(k) ?? hexIdx.get(k)!.center

  const visitedPairs = new Set<string>()
  const wiggleAmplitude = wiggleAmpFactor * interHexDist
  const wiggleFreq = interHexDist > 0 ? wiggleFreqFactor / interHexDist : 0

  const chains: RailBaseData['chains'] = []
  const controlPoints: { key: string; pos: [number, number] }[] = []

  const walk = (startKey: string) => {
    const h0 = hexIdx.get(startKey)
    if (!h0) return
    const startDeg = (adj.get(startKey) ?? []).length
    const pts: [number, number][] = []
    const pinned: boolean[] = []
    const edgeKeys: (string | null)[] = []
    let sharedCount = 0, segCount = 0

    if (startDeg !== 2 || isJunction(startKey)) { pts.push(jPos(startKey)); pinned.push(true); edgeKeys.push(null) }
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
        const emOverride = overrides[ek] as [number, number] | undefined
        const roadMid = !emOverride && roadPairSet.has(ep) ? roadEdgeMidpoints.get(ek) : undefined
        let mid: [number, number]
        if (emOverride) {
          mid = emOverride
        } else if (roadMid) {
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
        pts.push(mid); pinned.push(!!emOverride); edgeKeys.push(ek)
        if (roadPairSet.has(ep)) sharedCount++
        segCount++
      }
      cur = next
      const curDeg = (adj.get(cur) ?? []).length
      if (curDeg === 1) { const he = hexIdx.get(cur); if (he) { pts.push(he.center); pinned.push(true); edgeKeys.push(null) } break }
      if (isJunction(cur)) { pts.push(jPos(cur)); pinned.push(true); edgeKeys.push(null); break }
      const roadJP = roadJunctionPositions.get(cur)
      if (roadJP) { pts.push(roadJP); pinned.push(true); edgeKeys.push(null) }
    }

    const isLoop = cur === startKey && pts.length >= 3
    if (isLoop) { pts.push(pts[0]); pinned.push(true); edgeKeys.push(null) }
    if (pts.length < 2) return

    const isShared = segCount > 0 && sharedCount > segCount / 2

    const a = startKey < cur ? startKey : cur
    const b = startKey < cur ? cur : startKey
    const id = isLoop ? `rail|loop|${startKey}` : `rail|${a}|${b}`

    // Emit em| control points
    for (let i = 0; i < edgeKeys.length; i++) {
      const ek = edgeKeys[i]
      if (ek !== null) controlPoints.push({ key: ek, pos: pts[i] })
    }

    // Path smoothing
    const relaxed = pts.slice() as [number, number][]
    const iters = Math.round(smoothing * 0.3)
    for (let it = 0; it < iters; it++) {
      for (let i = 1; i < relaxed.length - 1; i++) {
        if (pinned[i]) continue
        relaxed[i] = [
          relaxed[i][0] + 0.1 * ((relaxed[i - 1][0] + relaxed[i + 1][0]) / 2 - relaxed[i][0]),
          relaxed[i][1] + 0.1 * ((relaxed[i - 1][1] + relaxed[i + 1][1]) / 2 - relaxed[i][1]),
        ]
      }
    }

    const steps = Math.max(2, Math.round(smoothing))
    const baseChain = catmullRom(relaxed, steps)

    const hopCount = relaxed.length - 1
    const hopKeys: string[] = []
    const hopRanges: [number, number][] = []
    for (let h = 0; h < hopCount; h++) {
      hopKeys.push(roadHopKey(relaxed[h], relaxed[h + 1]))
      hopRanges.push([h * steps, (h + 1) * steps])
    }

    const sp = segProps[id]
    const hasAnyOverride = sp?.wiggleAmp !== undefined || sp?.wiggleFreq !== undefined ||
      hopKeys.some(k => hopProps[k]?.wiggleAmp !== undefined || hopProps[k]?.wiggleFreq !== undefined)

    let chain: [number, number][]
    if (!hasAnyOverride) {
      chain = wiggleChain(baseChain, wiggleAmplitude, wiggleFreq)
    } else {
      const dense = [...baseChain] as [number, number][]
      for (let h = 0; h < hopCount; h++) {
        const [s, e] = hopRanges[h]
        const hp = hopProps[hopKeys[h]]
        const amp = (hp?.wiggleAmp ?? sp?.wiggleAmp ?? wiggleAmpFactor) * interHexDist
        const freq = (hp?.wiggleFreq ?? sp?.wiggleFreq ?? wiggleFreqFactor) / (interHexDist || 1)
        const slice = baseChain.slice(s, e + 1)
        const wiggled = wiggleChain(slice, amp, freq)
        for (let i = 0; i < wiggled.length; i++) dense[s + i] = wiggled[i]
      }
      chain = dense
    }
    if (wiggleAmplitude > 0 && chaikinPasses > 0) chain = chaikin(chain, chaikinPasses, false)

    chains.push({ chain, baseChain, id, isShared, isLoop, hopKeys, hopRanges })
  }

  for (const [k, nbs] of adj) { if (nbs.length === 1) walk(k) }
  for (const [k, nbs] of adj) {
    if (isJunction(k)) {
      for (const nk of nbs) {
        const ep = k < nk ? `${k}|${nk}` : `${nk}|${k}`
        if (!visitedPairs.has(ep)) walk(k)
      }
    }
  }
  for (const [k, nbs] of adj) {
    for (const nk of nbs) {
      const ep = k < nk ? `${k}|${nk}` : `${nk}|${k}`
      if (!visitedPairs.has(ep)) walk(k)
    }
  }

  // Junction control points
  for (const [k, pos] of junctionPositions) {
    controlPoints.push({ key: juncCpKey(k), pos })
  }

  return { chains, controlPoints, interHexDist }
}

export function applyRailWiggle(
  base: RailBaseData,
  wiggleAmpFactor: number,
  wiggleFreqFactor: number,
  segProps: Record<string, { wiggleAmp?: number; wiggleFreq?: number }> = {},
  hopProps: Record<string, { wiggleAmp?: number; wiggleFreq?: number }> = {},
  chaikinPasses = 2,
): RailBaseData {
  const { interHexDist } = base
  const wiggleAmplitude = wiggleAmpFactor * interHexDist
  const wiggleFreq = interHexDist > 0 ? wiggleFreqFactor / interHexDist : 0

  const chains = base.chains.map(c => {
    const { id, baseChain, hopKeys = [], hopRanges = [] } = c
    const sp = segProps[id]
    const hasAnyOverride = (sp?.wiggleAmp !== undefined || sp?.wiggleFreq !== undefined ||
      hopKeys.some(k => hopProps[k]?.wiggleAmp !== undefined || hopProps[k]?.wiggleFreq !== undefined)) &&
      hopKeys.length > 0

    let chain: [number, number][]
    if (!hasAnyOverride) {
      chain = wiggleChain(baseChain, wiggleAmplitude, wiggleFreq)
    } else {
      const dense = [...baseChain] as [number, number][]
      for (let h = 0; h < hopKeys.length; h++) {
        const [s, e] = hopRanges[h]
        const hp = hopProps[hopKeys[h]]
        const amp = (hp?.wiggleAmp ?? sp?.wiggleAmp ?? wiggleAmpFactor) * interHexDist
        const freq = (hp?.wiggleFreq ?? sp?.wiggleFreq ?? wiggleFreqFactor) / (interHexDist || 1)
        const slice = baseChain.slice(s, e + 1)
        const wiggled = wiggleChain(slice, amp, freq)
        for (let i = 0; i < wiggled.length; i++) dense[s + i] = wiggled[i]
      }
      chain = dense
    }
    const effectiveAmp = hasAnyOverride
      ? Math.max(...hopKeys.map(k => {
          const hp = hopProps[k], sp2 = segProps[id]
          return (hp?.wiggleAmp ?? sp2?.wiggleAmp ?? wiggleAmpFactor) * interHexDist
        }))
      : wiggleAmplitude
    if (effectiveAmp > 0 && chaikinPasses > 0) chain = chaikin(chain, chaikinPasses, false)
    return { ...c, chain }
  })
  return { ...base, chains }
}
