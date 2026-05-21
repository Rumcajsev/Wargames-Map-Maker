/** Edge-blob geometry — builds blob polygons for painted hex edges.
 *  Pure geometry — no React, no store imports. */

import { offsetPolyline, subdivideClosedPolygon, resampleSmoothQuad } from './geometry'
import { makePermutation, perturbXY, perturbNormal } from './noise'
import { preSmoothVar } from './terrainBlobs'

// ── Types ─────────────────────────────────────────────────────────────────────

export type EdgeBlobParams = {
  smooth: number
  offset: number
  bump: number
  sweepFreq: number
  lobeFreq: number
  lobeAmp: number
  lobeThreshold: number
  lobeDirection: number
  width: number
}

export interface EdgeBlobChain {
  chainKey: string
  terrain: string
  edgeKeys: string[]
}

// ── Key utilities ─────────────────────────────────────────────────────────────

/** Canonical key for the edge between two adjacent hexes. */
export function edgeBlobKey(q1: number, r1: number, q2: number, r2: number): string {
  const a = `${q1},${r1}`, b = `${q2},${r2}`
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/** Parse an edge key back to its two hex coords. */
export function parseEdgeBlobKey(key: string): { q1: number; r1: number; q2: number; r2: number } {
  const [a, b] = key.split('|')
  const [q1, r1] = a.split(',').map(Number)
  const [q2, r2] = b.split(',').map(Number)
  return { q1, r1, q2, r2 }
}

// ── Shared-vertex helpers ─────────────────────────────────────────────────────

const SNAP = 1
const vk = (p: [number, number]) => `${Math.round(p[0] / SNAP)},${Math.round(p[1] / SNAP)}`

/** Find the two canvas-space corner vertices shared between two adjacent hexes. */
export function sharedEdgeVertices(
  q1: number, r1: number,
  q2: number, r2: number,
  hexVertMap: Map<string, [number, number][]>,
): [[number, number], [number, number]] | null {
  const v1 = hexVertMap.get(`${q1},${r1}`)
  const v2 = hexVertMap.get(`${q2},${r2}`)
  if (!v1 || !v2) return null
  const keys2 = new Set(v2.map(vk))
  const shared: [number, number][] = v1.filter(v => keys2.has(vk(v)))
  if (shared.length < 2) return null
  return [shared[0], shared[1]]
}

// ── Chain finding ─────────────────────────────────────────────────────────────

/**
 * Group painted edges into connected chains per terrain type.
 * Two edges are connected when they share a hex-corner vertex.
 */
export function findEdgeChains(
  paintedEdges: Record<string, string>,
  hexVertMap: Map<string, [number, number][]>,
): EdgeBlobChain[] {
  const byTerrain = new Map<string, string[]>()
  for (const [edgeKey, terrain] of Object.entries(paintedEdges)) {
    if (!byTerrain.has(terrain)) byTerrain.set(terrain, [])
    byTerrain.get(terrain)!.push(edgeKey)
  }

  const chains: EdgeBlobChain[] = []

  for (const [terrain, edgeKeys] of byTerrain) {
    // Build vertex → edges map for this terrain
    const vertToEdges = new Map<string, string[]>()
    const edgeToVerts = new Map<string, [string, string] | null>()

    for (const edgeKey of edgeKeys) {
      const { q1, r1, q2, r2 } = parseEdgeBlobKey(edgeKey)
      const seg = sharedEdgeVertices(q1, r1, q2, r2, hexVertMap)
      if (!seg) { edgeToVerts.set(edgeKey, null); continue }
      const ka = vk(seg[0]), kb = vk(seg[1])
      edgeToVerts.set(edgeKey, [ka, kb])
      if (!vertToEdges.has(ka)) vertToEdges.set(ka, [])
      if (!vertToEdges.has(kb)) vertToEdges.set(kb, [])
      vertToEdges.get(ka)!.push(edgeKey)
      vertToEdges.get(kb)!.push(edgeKey)
    }

    // BFS to find connected components
    const visited = new Set<string>()
    for (const startEdge of edgeKeys) {
      if (visited.has(startEdge)) continue
      const component: string[] = []
      const queue = [startEdge]
      while (queue.length > 0) {
        const e = queue.shift()!
        if (visited.has(e)) continue
        visited.add(e)
        component.push(e)
        const verts = edgeToVerts.get(e)
        if (!verts) continue
        for (const vKey of verts) {
          for (const neighbor of vertToEdges.get(vKey) ?? []) {
            if (!visited.has(neighbor)) queue.push(neighbor)
          }
        }
      }
      const chainKey = [...component].sort()[0]
      chains.push({ chainKey, terrain, edgeKeys: component })
    }
  }

  return chains
}

// ── Blob geometry ─────────────────────────────────────────────────────────────

/**
 * Walk the edges of a chain into an ordered list of polyline paths.
 * At branch points (3+ edges meeting) the path is split into arms.
 */
function buildOrderedPaths(
  edgeKeys: string[],
  hexVertMap: Map<string, [number, number][]>,
): [number, number][][] {
  const vpos = new Map<string, [number, number]>()
  const vertToEdges = new Map<string, string[]>()
  const edgeToVerts = new Map<string, [string, string]>()

  for (const edgeKey of edgeKeys) {
    const { q1, r1, q2, r2 } = parseEdgeBlobKey(edgeKey)
    const seg = sharedEdgeVertices(q1, r1, q2, r2, hexVertMap)
    if (!seg) continue
    const ka = vk(seg[0]), kb = vk(seg[1])
    if (!vpos.has(ka)) vpos.set(ka, seg[0])
    if (!vpos.has(kb)) vpos.set(kb, seg[1])
    edgeToVerts.set(edgeKey, [ka, kb])
    if (!vertToEdges.has(ka)) vertToEdges.set(ka, [])
    if (!vertToEdges.has(kb)) vertToEdges.set(kb, [])
    vertToEdges.get(ka)!.push(edgeKey)
    vertToEdges.get(kb)!.push(edgeKey)
  }

  if (vpos.size === 0) return []

  const visitedEdges = new Set<string>()
  const paths: [number, number][][] = []

  // Prefer to start from endpoint vertices (degree 1)
  const allVerts = [...vertToEdges.keys()]
  const startFirst = allVerts.sort((a, b) => {
    const da = vertToEdges.get(a)!.length, db = vertToEdges.get(b)!.length
    return da - db
  })

  for (const startVKey of startFirst) {
    const edgesFromStart = vertToEdges.get(startVKey) ?? []
    const unvisited = edgesFromStart.filter(e => !visitedEdges.has(e))
    if (unvisited.length === 0) continue

    // Walk one path per unvisited edge leaving this vertex
    for (const firstEdge of unvisited) {
      if (visitedEdges.has(firstEdge)) continue
      const path: [number, number][] = [vpos.get(startVKey)!]
      let curV = startVKey

      for (;;) {
        let nextEdge: string | null = null
        let nextV: string | null = null
        for (const e of vertToEdges.get(curV) ?? []) {
          if (visitedEdges.has(e)) continue
          const [va, vb] = edgeToVerts.get(e)!
          nextEdge = e
          nextV = va === curV ? vb : va
          break
        }
        if (!nextEdge || !nextV) break
        visitedEdges.add(nextEdge)
        path.push(vpos.get(nextV)!)
        // Stop at branch points (degree > 2) to let other arms start from there
        if ((vertToEdges.get(nextV)?.length ?? 0) > 2) break
        curV = nextV
      }

      if (path.length >= 2) paths.push(path)
    }
  }

  return paths
}

/**
 * Build the blob polygon for one polyline path.
 * Creates an offset ribbon around the path, then applies the full Perlin blob pipeline.
 */
function buildRibbonBlob(
  path: [number, number][],
  params: EdgeBlobParams,
  R: number,
): [number, number][] {
  const { smooth, offset, bump: bumpFraction, sweepFreq, lobeFreq, lobeAmp, lobeThreshold, lobeDirection, width } = params
  const halfWidth = width * R * Math.max(0.1, 1 + offset)

  // Offset both sides to form a ribbon
  const left  = offsetPolyline(path,  halfWidth)
  const right = offsetPolyline(path, -halfWidth)

  // Close the polygon with taper points at each end
  const startPt = path[0]
  const endPt   = path[path.length - 1]

  let poly: [number, number][] = [
    startPt,
    ...left,
    endPt,
    ...right.slice().reverse(),
  ]

  if (poly.length < 3) return []

  const seed = Math.abs(Math.round(poly[0][0] * 73 + poly[0][1] * 97))

  for (let pass = 0; pass < smooth; pass++) poly = preSmoothVar(poly, 0.4)

  poly = subdivideClosedPolygon(poly, R * 0.25)

  const permX = makePermutation(seed)
  const permY = makePermutation(seed + 31)
  poly = perturbXY(poly, permX, permY, sweepFreq / R, bumpFraction * R)

  poly = resampleSmoothQuad(poly, 5)

  const permA = makePermutation(seed + 67)
  const permB = makePermutation(seed + 113)
  const lobeP2Amp = bumpFraction * lobeAmp * R * lobeDirection
  poly = perturbNormal(poly, permA, permB, lobeFreq / R, lobeP2Amp, lobeThreshold)

  return poly
}

/**
 * Build all blob polygons for one edge chain.
 * Returns a list of polygons (one per non-branching path segment in the chain).
 */
export function buildEdgeBlobPolys(
  chain: EdgeBlobChain,
  hexVertMap: Map<string, [number, number][]>,
  params: EdgeBlobParams,
  R: number,
): [number, number][][] {
  const paths = buildOrderedPaths(chain.edgeKeys, hexVertMap)
  const result: [number, number][][] = []
  for (const path of paths) {
    const poly = buildRibbonBlob(path, params, R)
    if (poly.length >= 3) result.push(poly)
  }
  return result
}
