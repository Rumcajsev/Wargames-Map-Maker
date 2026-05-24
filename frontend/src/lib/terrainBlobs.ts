/** Terrain blob building and field-style rendering utilities.
 *  Depends on geometry, noise, and projection libs — no React, no store state. */

import { chaikin, catmullRom, distToSeg, subdivideClosedPolygon, resampleSmoothQuad, douglasPeucker } from './geometry'
import { makePermutation, perlinNoise2D, perturbXY, perturbNormal } from './noise'
import { projectToCanvas } from './projection'
import { hexTerrainLayers } from '../store/mapStore'
import type { GridMetadata, GeneratedHex } from '../store/mapStore'

// ── Coastal hex helpers ──────────────────────────────────────────────────────

/** Terrain to use for blob building and land-side color for a coastal hex.
 *  Ignores sea fraction so the hex participates in the correct terrain blob group. */
export function effectiveLandTerrain(hex: GeneratedHex): string {
  if (hex.manual_override) {
    if (hex.terrain && hex.terrain !== 'sea') return hex.terrain
    if (hex.terrains) {
      for (const t of ['marsh', 'woods', 'light_woods', 'rough', 'clear'] as const) {
        if (hex.terrains.includes(t)) return t
      }
    }
  }
  const cov = hex.coverage ?? {}
  const candidates = ['marsh', 'woods', 'rough', 'clear']
  let best = 'clear', bestFrac = 0
  for (const t of candidates) {
    const f = cov[t] ?? 0
    if (f > bestFrac) { bestFrac = f; best = t }
  }
  return best
}

/** Terrain layers a coastal hex contributes to in the blob system.
 *  Both paths use hexTerrainLayers as the primary source.  When realistic
 *  coastline is on, 'sea' is stripped out — section 6 handles sea fill. */
export function coastalBlobTerrains(hex: GeneratedHex, realisticCoastline: boolean): string[] {
  if (!hex.coastline_clip || hex.coastline_clip.length === 0) return hexTerrainLayers(hex)
  const land = effectiveLandTerrain(hex)
  const base = realisticCoastline
    ? hexTerrainLayers(hex).filter(t => t !== 'sea')
    : hexTerrainLayers(hex)
  if (land === 'clear') return base
  const merged = new Set(base)
  merged.add(land)
  return [...merged]
}

// ── Coastline ring smoothing ─────────────────────────────────────────────────

/** Pre-compute which ring segments lie along a hex edge, avoiding redundant
 *  per-segment checks in both getCoastlineRuns and buildSmoothedRing. */
function buildHexEdgeFlags(
  ring: [number, number][],
  hexVerts: [number, number][],
  tol: number,
): boolean[] {
  const n = ring.length, nv = hexVerts.length
  const flags = new Array<boolean>(n)
  for (let i = 0; i < n; i++) {
    const p = ring[i], q = ring[(i + 1) % n]
    let onEdge = false
    for (let e = 0; e < nv && !onEdge; e++) {
      const a = hexVerts[e], b = hexVerts[(e + 1) % nv]
      if (distToSeg(p, a, b) < tol && distToSeg(q, a, b) < tol) onEdge = true
    }
    flags[i] = onEdge
  }
  return flags
}

/** Split a coastline_clip ring into runs that follow the actual geographic coastline,
 *  skipping segments that lie along hex edges (where the land polygon was clipped). */
export function getCoastlineRuns(
  ring: [number, number][],
  hexVerts: [number, number][],
  tol: number,
): [number, number][][] {
  const n = ring.length
  const hexEdge = buildHexEdgeFlags(ring, hexVerts, tol)
  let firstHex = -1
  for (let i = 0; i < n; i++) if (hexEdge[i]) { firstHex = i; break }
  const runs: [number, number][][] = []
  let run: [number, number][] | null = null
  for (let j = 0; j < n; j++) {
    const i = firstHex >= 0 ? (firstHex + 1 + j) % n : j
    if (hexEdge[i]) {
      if (run && run.length >= 2) runs.push(run)
      run = null
    } else {
      if (!run) run = [ring[i]]
      run.push(ring[(i + 1) % n])
    }
  }
  if (run && run.length >= 2) runs.push(run)
  return runs
}

/** Build a closed ring where coastline segments are CatmullRom-smoothed and
 *  hex-edge segments stay as straight lines. Prevents the curve from escaping
 *  the hex boundary. */
export function buildSmoothedRing(
  ring: [number, number][],
  hexVerts: [number, number][],
  tol: number,
  steps: number,
  chaikinPasses = 3,
  dpEpsilon = 0,
): [number, number][] {
  const n = ring.length
  const hexEdge = buildHexEdgeFlags(ring, hexVerts, tol)
  let firstHex = -1
  for (let i = 0; i < n; i++) if (hexEdge[i]) { firstHex = i; break }
  const out: [number, number][] = []
  let coast: [number, number][] | null = null
  const flushCoast = () => {
    if (!coast || coast.length < 2) { coast = null; return }
    const simplified = dpEpsilon > 0 ? douglasPeucker(coast, dpEpsilon) : coast
    out.push(...catmullRom(chaikin(simplified, chaikinPasses, false), steps))
    coast = null
  }
  for (let j = 0; j < n; j++) {
    const i = firstHex >= 0 ? (firstHex + j) % n : j
    if (hexEdge[i]) {
      flushCoast()
      out.push(ring[i])
    } else {
      if (!coast) coast = [ring[i]]
      coast.push(ring[(i + 1) % n])
    }
  }
  flushCoast()
  return out
}

/** Convert a coastline_clip ring into one open chain using ALL its points.
 *  Cuts the closed ring open at the first hex-edge segment (so the endpoints
 *  sit on a hex boundary, enabling stitching across hexes).  Returns null for
 *  rings with no hex-edge contact — those are closed islands and are handled
 *  separately. */
export function getRingAsChain(
  ring: [number, number][],
  hexVerts: [number, number][],
  tol: number,
): [number, number][] | null {
  const n = ring.length
  if (n < 3) return null
  const hexEdge = buildHexEdgeFlags(ring, hexVerts, tol)
  let firstHex = -1
  for (let i = 0; i < n; i++) if (hexEdge[i]) { firstHex = i; break }
  if (firstHex === -1) return null   // no hex-edge contact — closed island
  // Open chain: start at the point after the cut edge, go all the way round.
  // Includes geographic segments AND any remaining hex-edge segments within;
  // DP will simplify short collinear hex-edge segments away during smoothing.
  const chain: [number, number][] = []
  for (let j = 0; j < n; j++) chain.push(ring[(firstHex + 1 + j) % n])
  return chain
}

/** Collect coastline chains from all coastal hexes and stitch them end-to-end.
 *  Uses the full ring outline (not just geographic segments) so no data is
 *  discarded before DP simplification. */
export function stitchCoastlineRuns(
  coastlineClips: Map<string, [number, number][][]>,
  hexVertMap: Map<string, [number, number][]>,
  tol: number,
): [number, number][][] {
  const allRuns: [number, number][][] = []
  for (const [key, rings] of coastlineClips) {
    const verts = hexVertMap.get(key)
    if (!verts) continue
    for (const ring of rings) {
      const chain = getRingAsChain(ring, verts, tol)
      if (chain && chain.length >= 2) allRuns.push(chain)
    }
  }

  const snap = (p: [number, number]) =>
    `${Math.round(p[0] / tol * 10)},${Math.round(p[1] / tol * 10)}`

  const startMap = new Map<string, number>()  // snap(start) → runIdx
  const endMap   = new Map<string, number>()  // snap(end)   → runIdx
  allRuns.forEach((r, i) => {
    startMap.set(snap(r[0]), i)
    endMap.set(snap(r[r.length - 1]), i)
  })

  const used = new Set<number>()
  const chains: [number, number][][] = []

  for (let seed = 0; seed < allRuns.length; seed++) {
    if (used.has(seed)) continue
    used.add(seed)
    const chain: [number, number][] = [...allRuns[seed]]

    // grow forward
    for (;;) {
      const k = snap(chain[chain.length - 1])
      const next = startMap.get(k) ?? -1
      if (next < 0 || used.has(next)) break
      used.add(next)
      chain.push(...allRuns[next].slice(1))
    }

    // grow backward
    for (;;) {
      const k = snap(chain[0])
      const prev = endMap.get(k) ?? -1
      if (prev < 0 || used.has(prev)) break
      used.add(prev)
      chain.unshift(...allRuns[prev].slice(0, -1))
    }

    if (chain.length >= 2) chains.push(chain)
  }

  return chains
}

// ── Blob shape helpers ───────────────────────────────────────────────────────

export function bleedPolygon(poly: [number, number][], maxBleed: number, R: number, perm: Uint8Array): [number, number][] {
  if (maxBleed <= 0 || poly.length < 3) return poly
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length
  const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length
  let p = subdivideClosedPolygon(poly, R * 0.2)
  p = p.map(pt => {
    const odx = pt[0] - cx, ody = pt[1] - cy
    const olen = Math.hypot(odx, ody)
    if (olen < 1e-6) return pt
    const noise = (perlinNoise2D(pt[0] / (R * 1.5), pt[1] / (R * 1.5), perm) + 1) / 2
    const bleed = noise * noise * maxBleed
    return [pt[0] + (odx / olen) * bleed, pt[1] + (ody / olen) * bleed] as [number, number]
  })
  return chaikin(p, 1, true)
}

// ── V2 blob pipeline ─────────────────────────────────────────────────────────

export function preSmoothVar(pts: [number, number][], t: number): [number, number][] {
  if (t <= 0 || pts.length < 3) return pts
  const n = pts.length
  const result: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % n]
    result.push([x0 * (1 - t) + x1 * t, y0 * (1 - t) + y1 * t])
    result.push([x0 * t + x1 * (1 - t), y0 * t + y1 * (1 - t)])
  }
  return result
}

export function resizeToHexAnchors(
  pts: [number, number][],
  hexCenters: [number, number][],
  s: number,
): [number, number][] {
  if (s === 1 || pts.length < 3 || hexCenters.length === 0) return pts
  return pts.map(pt => {
    let best = hexCenters[0], bestD = Infinity
    for (const c of hexCenters) {
      const d = Math.hypot(pt[0] - c[0], pt[1] - c[1])
      if (d < bestD) { bestD = d; best = c }
    }
    const [cx, cy] = best
    return [cx + (pt[0] - cx) * s, cy + (pt[1] - cy) * s] as [number, number]
  })
}

export function buildTerrainBlobsV2(
  projected: { hex: { terrain: string; partial: boolean }; verts: [number, number][] }[],
  smooth: number,
  offsetFraction: number,
  bumpFraction: number,
  sweepFreq: number,
  lobeFreq: number,
  lobeAmp: number,
  lobeThreshold: number,
  lobeDirection: number,
  R: number,
): { terrain: string; polys: [number, number][][] }[] {
  const SNAP = 1
  const vk = (p: [number, number]) => `${Math.round(p[0] / SNAP)},${Math.round(p[1] / SNAP)}`
  const vpos = new Map<string, [number, number]>()
  const edgeCount = new Map<string, Map<string, number>>()
  const edgeEnds = new Map<string, [string, string]>()
  const hexCentersByTerrain = new Map<string, [number, number][]>()

  for (const { hex, verts } of projected) {
    const t = hex.terrain
    if (t !== 'clear') {
      const cx = (verts[0][0] + verts[1][0] + verts[2][0] + verts[3][0] + verts[4][0] + verts[5][0]) / 6
      const cy = (verts[0][1] + verts[1][1] + verts[2][1] + verts[3][1] + verts[4][1] + verts[5][1]) / 6
      if (!hexCentersByTerrain.has(t)) hexCentersByTerrain.set(t, [])
      hexCentersByTerrain.get(t)!.push([cx, cy])
    }
    let tc: Map<string, number> | null = null
    if (t !== 'clear') {
      if (!edgeCount.has(t)) edgeCount.set(t, new Map())
      tc = edgeCount.get(t)!
    }
    for (let i = 0; i < 6; i++) {
      const a = verts[i], b = verts[(i + 1) % 6]
      const ka = vk(a), kb = vk(b)
      if (!vpos.has(ka)) vpos.set(ka, a)
      if (!vpos.has(kb)) vpos.set(kb, b)
      if (tc !== null) {
        const ek = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
        tc.set(ek, (tc.get(ek) ?? 0) + 1)
        if (!edgeEnds.has(ek)) edgeEnds.set(ek, [ka, kb])
      }
    }
  }

  const result: { terrain: string; polys: [number, number][][] }[] = []

  for (const [terrain, tc] of edgeCount) {
    const adj = new Map<string, string[]>()
    for (const [ek, count] of tc) {
      if (count !== 1) continue
      const [ka, kb] = edgeEnds.get(ek)!
      if (!adj.has(ka)) adj.set(ka, [])
      if (!adj.has(kb)) adj.set(kb, [])
      adj.get(ka)!.push(kb)
      adj.get(kb)!.push(ka)
    }

    const visitedVerts = new Set<string>()
    const visitedEdges = new Set<string>()
    const polys: [number, number][][] = []

    for (const [startKey] of adj) {
      if (visitedVerts.has(startKey)) continue
      const pts: [number, number][] = []
      let cur = startKey
      for (;;) {
        visitedVerts.add(cur)
        pts.push(vpos.get(cur)!)
        const nbrs = adj.get(cur) ?? []
        let next: string | null = null
        for (const n of nbrs) {
          const ek = cur < n ? `${cur}|${n}` : `${n}|${cur}`
          if (!visitedEdges.has(ek)) { visitedEdges.add(ek); next = n; break }
        }
        if (!next || next === startKey) break
        cur = next
      }
      if (pts.length >= 3) polys.push(pts)
    }

    const hexCenters = hexCentersByTerrain.get(terrain) ?? []
    const resizeS = Math.max(0.1, 1 + offsetFraction)
    const p1Amp = bumpFraction * R
    const p2Amp = bumpFraction * lobeAmp * R * lobeDirection

    const finalPolys = polys.map(poly => {
      const seed = Math.abs(Math.round(poly[0][0] * 73 + poly[0][1] * 97))

      let p: [number, number][] = poly
      for (let pass = 0; pass < smooth; pass++) p = preSmoothVar(p, 0.4)
      p = resizeToHexAnchors(p, hexCenters, resizeS)

      // R * 0.25 (was 0.15) halves the point count before perturbXY and the
      // 5× resampleSmoothQuad multiplier, cutting perturbNormal cost by ~40%.
      p = subdivideClosedPolygon(p, R * 0.25)
      const permP1x = makePermutation(seed)
      const permP1y = makePermutation(seed + 31)
      p = perturbXY(p, permP1x, permP1y, sweepFreq / R, p1Amp)

      p = resampleSmoothQuad(p, 5)

      const permP2a = makePermutation(seed + 67)
      const permP2b = makePermutation(seed + 113)
      p = perturbNormal(p, permP2a, permP2b, lobeFreq / R, p2Amp, lobeThreshold)

      return p
    })

    result.push({ terrain, polys: finalPolys })
  }

  return result
}

// ── Connected components ─────────────────────────────────────────────────────

export function computeConnectedComponents(hexes: { q: number; r: number; terrain: string; isLake: boolean }[]): Map<string, string> {
  const hexByKey = new Map<string, typeof hexes[0]>()
  for (const h of hexes) hexByKey.set(`${h.q},${h.r}`, h)
  const visited = new Set<string>()
  const result = new Map<string, string>()
  const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]]
  for (const hex of hexes) {
    const startKey = `${hex.q},${hex.r}`
    if (visited.has(startKey)) continue
    const queue = [hex]
    const component: typeof hexes[0][] = []
    while (queue.length > 0) {
      const h = queue.shift()!
      const k = `${h.q},${h.r}`
      if (visited.has(k)) continue
      visited.add(k)
      component.push(h)
      for (const [dq, dr] of DIRS) {
        const nk = `${h.q + dq},${h.r + dr}`
        const nh = hexByKey.get(nk)
        if (!nh || visited.has(nk)) continue
        const sameGroup = hex.isLake ? nh.isLake : (!nh.isLake && nh.terrain === hex.terrain)
        if (sameGroup) queue.push(nh)
      }
    }
    let minQ = hex.q, minR = hex.r
    for (const h of component) {
      if (h.q < minQ || (h.q === minQ && h.r < minR)) { minQ = h.q; minR = h.r }
    }
    const canonicalKey = `${minQ},${minR}`
    for (const h of component) result.set(`${h.q},${h.r}`, canonicalKey)
  }
  return result
}

// ── Field-style rendering ────────────────────────────────────────────────────
// Detached from active use — kept for future reuse. Nothing below this line is
// referenced by the current render pipeline (blob mode only).
/*
export function parseHexColor(hex: string): [number, number, number] {
  const c = parseInt(hex.replace('#', ''), 16)
  return [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff]
}

export type FieldTextureData = {
  data: Uint8ClampedArray
  w: number
  h: number
}

export function buildFieldCanvas(
  hexes: { q: number; r: number; center: [number, number]; terrain: string; isLake: boolean }[],
  meta: GridMetadata,
  pw: number, ph: number, px: number, py: number,
  dpr: number,
  freq: number, amp: number, octaves: number, persistence: number,
  fieldWildness: Record<string, number>,
  terrainColors: Record<string, string>,
  fallbackColors: Record<string, string>,
  textures?: Record<string, FieldTextureData>,
): OffscreenCanvas {
  const SCALE = dpr
  const fw = Math.max(1, Math.ceil(pw * SCALE))
  const fh = Math.max(1, Math.ceil(ph * SCALE))

  const scalePxPerM = pw / (meta.scale_m_per_mm * meta.paper_mm[0])
  const R = meta.outer_radius_m * scalePxPerM * SCALE

  const fieldHexes = hexes.map(hex => {
    const [cx, cy] = projectToCanvas(hex.center[0], hex.center[1], meta, pw, ph, px, py)
    const terrain = hex.isLake ? 'lake' : hex.terrain
    const colorHex = terrainColors[terrain] ?? fallbackColors[terrain] ?? '#888888'
    return {
      fx: (cx - px) * SCALE,
      fy: (cy - py) * SCALE,
      terrain,
      rgb: parseHexColor(colorHex),
    }
  })

  const cellSize = R * 1.8
  const gridCols = Math.ceil(fw / cellSize) + 1
  const gridRows = Math.ceil(fh / cellSize) + 1
  const grid: number[][] = Array.from({ length: gridCols * gridRows }, () => [])
  for (let i = 0; i < fieldHexes.length; i++) {
    const { fx, fy } = fieldHexes[i]
    const col = Math.floor(fx / cellSize)
    const row = Math.floor(fy / cellSize)
    if (col >= 0 && col < gridCols && row >= 0 && row < gridRows)
      grid[row * gridCols + col].push(i)
  }

  const findNearest = (qx: number, qy: number) => {
    const col = Math.max(0, Math.min(gridCols - 1, Math.floor(qx / cellSize)))
    const row = Math.max(0, Math.min(gridRows - 1, Math.floor(qy / cellSize)))
    let best = -1, bestD2 = Infinity
    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        const c = col + dc, r = row + dr
        if (c < 0 || c >= gridCols || r < 0 || r >= gridRows) continue
        for (const i of grid[r * gridCols + c]) {
          const h = fieldHexes[i]
          const d2 = (qx - h.fx) ** 2 + (qy - h.fy) ** 2
          if (d2 < bestD2) { bestD2 = d2; best = i }
        }
      }
    }
    return best >= 0 ? fieldHexes[best] : null
  }

  const seed = (Math.abs(Math.round(meta.center[0] * 1000)) * 997 + Math.abs(Math.round(meta.center[1] * 1000))) | 0
  const permX = makePermutation(seed)
  const permY = makePermutation(seed + 37)

  const noiseFreq = freq / R
  const noiseAmp = amp * R

  const offscreen = new OffscreenCanvas(fw, fh)
  const octx = offscreen.getContext('2d')!
  const imageData = octx.createImageData(fw, fh)
  const data = imageData.data

  for (let fy_ = 0; fy_ < fh; fy_++) {
    for (let fx_ = 0; fx_ < fw; fx_++) {
      const undisplaced = findNearest(fx_, fy_)
      if (!undisplaced) continue

      const wildness = fieldWildness[undisplaced.terrain] ?? 1.0
      let dx = 0, dy = 0, a = noiseAmp * wildness, f = noiseFreq
      for (let o = 0; o < octaves; o++) {
        dx += perlinNoise2D(fx_ * f, fy_ * f, permX) * a
        dy += perlinNoise2D(fx_ * f, fy_ * f, permY) * a
        a *= persistence; f *= 2
      }

      const displaced = findNearest(fx_ + dx, fy_ + dy) ?? undisplaced
      let [r, g, b] = displaced.rgb

      const tex = textures?.[displaced.terrain]
      if (tex) {
        const tx = fx_ % tex.w
        const ty = fy_ % tex.h
        const ti = (ty * tex.w + tx) * 4
        const ta = tex.data[ti + 3] / 255
        r = Math.round(r + (Math.min(r, tex.data[ti])     - r) * ta)
        g = Math.round(g + (Math.min(g, tex.data[ti + 1]) - g) * ta)
        b = Math.round(b + (Math.min(b, tex.data[ti + 2]) - b) * ta)
      }

      const idx = (fy_ * fw + fx_) * 4
      data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = 255
    }
  }

  octx.putImageData(imageData, 0, 0)
  return offscreen
}
*/
