import { create } from 'zustand'
import { persist } from 'zustand/middleware'

function haversineKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

function computeMSTEdges(items: Settlement[]): [number, number][] {
  const n = items.length
  if (n < 2) return []
  const edges: [number, number, number][] = []
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      edges.push([haversineKm(items[i].lon, items[i].lat, items[j].lon, items[j].lat), i, j])
    }
  }
  edges.sort((a, b) => a[0] - b[0])
  const parent = Array.from({ length: n }, (_, i) => i)
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])))
  const result: [number, number][] = []
  for (const [, i, j] of edges) {
    const pi = find(i), pj = find(j)
    if (pi !== pj) {
      parent[pi] = pj
      result.push([i, j])
      if (result.length === n - 1) break
    }
  }
  return result
}

function computeNNearestEdges(items: Settlement[], n: number): [number, number][] {
  const edgeSet = new Set<string>()
  const result: [number, number][] = []
  for (let i = 0; i < items.length; i++) {
    const dists = items
      .map((s, j) => [haversineKm(items[i].lon, items[i].lat, s.lon, s.lat), j] as [number, number])
      .filter(([, j]) => j !== i)
      .sort((a, b) => a[0] - b[0])
      .slice(0, n)
    for (const [, j] of dists) {
      const key = i < j ? `${i},${j}` : `${j},${i}`
      if (!edgeSet.has(key)) {
        edgeSet.add(key)
        result.push([i < j ? i : j, i < j ? j : i] as [number, number])
      }
    }
  }
  return result
}

function interpolatePolyline(coords: [number, number][], stepDeg: number): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i < coords.length - 1; i++) {
    const [x0, y0] = coords[i]
    const [x1, y1] = coords[i + 1]
    const dx = x1 - x0, dy = y1 - y0
    const dist = Math.sqrt(dx * dx + dy * dy)
    const steps = Math.max(1, Math.ceil(dist / stepDeg))
    for (let k = 0; k < steps; k++) {
      out.push([x0 + (dx * k) / steps, y0 + (dy * k) / steps])
    }
  }
  if (coords.length > 0) out.push(coords[coords.length - 1])
  return out
}

function polylineToHexPath(
  coords: [number, number][],
  hexes: GeneratedHex[],
): [number, number][] {
  const dense = interpolatePolyline(coords, 0.005)
  const path: [number, number][] = []
  let lastKey = ''
  for (const [lon, lat] of dense) {
    for (const hex of hexes) {
      if (pointInHex(lon, lat, hex.vertices)) {
        const key = `${hex.q},${hex.r}`
        if (key !== lastKey) {
          path.push([hex.q, hex.r])
          lastKey = key
        }
        break
      }
    }
  }
  return path
}

// Ramer-Douglas-Peucker polyline simplification
function douglasPeucker(coords: [number, number][], tolerance: number): [number, number][] {
  if (coords.length <= 2) return coords.slice()
  const [x1, y1] = coords[0]
  const [x2, y2] = coords[coords.length - 1]
  const dx = x2 - x1, dy = y2 - y1
  const len = Math.hypot(dx, dy)
  let maxDist = 0, maxIdx = 0
  for (let i = 1; i < coords.length - 1; i++) {
    const [px, py] = coords[i]
    const dist = len > 1e-12
      ? Math.abs(dy * px - dx * py + x2 * y1 - y2 * x1) / len
      : Math.hypot(px - x1, py - y1)
    if (dist > maxDist) { maxDist = dist; maxIdx = i }
  }
  if (maxDist > tolerance) {
    const left = douglasPeucker(coords.slice(0, maxIdx + 1), tolerance)
    const right = douglasPeucker(coords.slice(maxIdx), tolerance)
    return [...left.slice(0, -1), ...right]
  }
  return [coords[0], coords[coords.length - 1]]
}

// Chaikin curve smoothing — one pass cuts corners by 1/4 and 3/4
function chaikin(pts: [number, number][], iterations = 1): [number, number][] {
  let r = pts
  for (let n = 0; n < iterations; n++) {
    const next: [number, number][] = [r[0]]
    for (let i = 0; i < r.length - 1; i++) {
      const [x0, y0] = r[i], [x1, y1] = r[i + 1]
      next.push([0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1])
      next.push([0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1])
    }
    next.push(r[r.length - 1])
    r = next
  }
  return r
}

// ── A*-based river edge fitting ───────────────────────────────────────────────
//
// Treats the hex edge graph as a search space. For each OSM river polyline we
// run Dijkstra (h=0, guarantees optimal) from the edge nearest the polyline
// start to the edge nearest the polyline end. The cost of visiting an edge is:
//
//   cost = W1 * (dist_to_polyline / hexRadius)   ← pulls path toward the river
//        + W2 * (1 - |alignment_with_river|)      ← discourages zigzag
//
// This naturally handles sub-hex meanders: edges far from or perpendicular to
// the OSM line are expensive, so the cheapest path follows the river's course
// across hex borders without needing any crossing-detection arithmetic.

function buildRiverEdgesAstar(
  linestrings: { type: string; coords: [number, number][] }[],
  hexes: GeneratedHex[],
): { edges: RiverEdge[]; chains: [number, number][][] } {
  if (hexes.length === 0) return { edges: [], chains: [] }

  const EPS = 0.00015
  const vKey = (v: [number, number]) =>
    `${Math.round(v[0] / (EPS * 0.5))},${Math.round(v[1] / (EPS * 0.5))}`

  // ── Phase 1: Build hex edge graph ─────────────────────────────────────────
  // Each unique hex edge is a node. Nodes are connected if they share a vertex.

  interface EdgeNode {
    key: string
    v0: [number, number]
    v1: [number, number]
    mid: [number, number]
    dir: [number, number]   // unit vector v0→v1 (arbitrary but consistent)
    hexKeys: string[]       // 1 hex = boundary, 2 hexes = interior
    neighbors: string[]     // all edges sharing either endpoint vertex
  }

  const edgeMap = new Map<string, EdgeNode>()
  const vertToEdges = new Map<string, string[]>()

  for (const hex of hexes) {
    const hk = `${hex.q},${hex.r}`
    const n = hex.vertices.length
    for (let i = 0; i < n; i++) {
      const v0 = hex.vertices[i] as [number, number]
      const v1 = hex.vertices[(i + 1) % n] as [number, number]
      const vk0 = vKey(v0), vk1 = vKey(v1)
      const ek = vk0 < vk1 ? `${vk0}|${vk1}` : `${vk1}|${vk0}`

      if (!edgeMap.has(ek)) {
        const mid: [number, number] = [(v0[0] + v1[0]) / 2, (v0[1] + v1[1]) / 2]
        const dx = v1[0] - v0[0], dy = v1[1] - v0[1]
        const len = Math.hypot(dx, dy)
        const dir: [number, number] = len > 1e-12 ? [dx / len, dy / len] : [1, 0]
        edgeMap.set(ek, { key: ek, v0, v1, mid, dir, hexKeys: [hk], neighbors: [] })
        for (const vk of [vk0, vk1]) {
          if (!vertToEdges.has(vk)) vertToEdges.set(vk, [])
          vertToEdges.get(vk)!.push(ek)
        }
      } else {
        edgeMap.get(ek)!.hexKeys.push(hk)
      }
    }
  }

  // Wire neighbor lists (edges sharing a vertex with this edge)
  for (const [ek, edge] of edgeMap) {
    const nbSet = new Set<string>()
    for (const v of [edge.v0, edge.v1]) {
      for (const nk of vertToEdges.get(vKey(v)) ?? []) {
        if (nk !== ek) nbSet.add(nk)
      }
    }
    edge.neighbors = Array.from(nbSet)
  }

  // Hex outer radius in degrees (used to normalise distances)
  const hexRadius = (() => {
    const h = hexes[0]
    const [cx, cy] = h.center
    return Math.max(...h.vertices.map(([vx, vy]) => Math.hypot(vx - cx, vy - cy)))
  })()

  // ── Nearest point on a polyline (returns dist + segment tangent) ──────────

  function nearestOnPolyline(
    px: number, py: number, coords: [number, number][],
  ): { dist: number; tangent: [number, number] } {
    let bestDist = Infinity
    let bestTangent: [number, number] = [1, 0]
    for (let i = 0; i < coords.length - 1; i++) {
      const [ax, ay] = coords[i], [bx, by] = coords[i + 1]
      const dx = bx - ax, dy = by - ay
      const len2 = dx * dx + dy * dy
      const t = len2 > 1e-20
        ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
        : 0
      const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
      if (d < bestDist) {
        bestDist = d
        const len = Math.sqrt(len2)
        bestTangent = len > 1e-12 ? [dx / len, dy / len] : [1, 0]
      }
    }
    return { dist: bestDist, tangent: bestTangent }
  }

  // ── Phase 2: Snap polyline endpoints to nearest edge ─────────────────────
  // Use a window (first / last 25 % of coords) so that off-map segment tails
  // don't pull the snap point to a wrong edge at the opposite side of the grid.

  // After Liang-Barsky clipping, coords[0] / coords[-1] are the exact bbox
  // boundary crossings. Find the hex edge whose midpoint is nearest to those
  // exact entry/exit coordinates — simpler and more direct than the 25%-window
  // approach which could average over too wide a section of a short river.
  function findEndpointEdge(coords: [number, number][], fromEnd: boolean): string | null {
    const [rx, ry] = fromEnd ? coords[coords.length - 1] : coords[0]
    let bestEk = '', bestDist = Infinity
    for (const [ek, edge] of edgeMap) {
      const d = Math.hypot(edge.mid[0] - rx, edge.mid[1] - ry)
      if (d < bestDist) { bestDist = d; bestEk = ek }
    }
    return bestEk || null
  }

  // ── Phase 3: Dijkstra through the edge graph ──────────────────────────────
  // h = 0 (pure Dijkstra) guarantees the globally cheapest path, which matters
  // when a meandering river's geometric shortcut would have lower step-count
  // but higher total cost than the correct river-following path.

  const W1 = 1.0   // weight for distance-to-river (normalised)
  const W2 = 0.4   // weight for misalignment penalty

  function dijkstra(
    startEk: string, endEk: string, coords: [number, number][],
  ): string[] {
    const gScore = new Map<string, number>([[startEk, 0]])
    const parent = new Map<string, string | null>([[startEk, null]])
    const visited = new Set<string>()
    const open = new Set<string>([startEk])

    for (let step = 0; step < 4000 && open.size > 0; step++) {
      // Extract minimum-g node (linear scan — fine for typical hex grids < 1000 edges)
      let curEk = '', curG = Infinity
      for (const ek of open) {
        const g = gScore.get(ek) ?? Infinity
        if (g < curG) { curG = g; curEk = ek }
      }
      open.delete(curEk)
      if (visited.has(curEk)) continue
      visited.add(curEk)

      if (curEk === endEk) {
        const path: string[] = []
        let cur: string | null = curEk
        while (cur !== null) { path.push(cur); cur = parent.get(cur) ?? null }
        return path.reverse()
      }

      for (const nk of edgeMap.get(curEk)!.neighbors) {
        if (visited.has(nk)) continue
        const edge = edgeMap.get(nk)!
        const { dist, tangent } = nearestOnPolyline(edge.mid[0], edge.mid[1], coords)
        const alignment = Math.abs(edge.dir[0] * tangent[0] + edge.dir[1] * tangent[1])
        const stepCost = W1 * (dist / hexRadius) + W2 * (1 - alignment)
        const tentG = curG + stepCost
        if (tentG < (gScore.get(nk) ?? Infinity)) {
          gScore.set(nk, tentG)
          parent.set(nk, curEk)
          open.add(nk)
        }
      }
    }
    return [] // no path found within step budget
  }

  // ── Stitch OSM polylines into continuous chains ────────────────────────────
  // OSM rivers are routinely split across many ways edited by different mappers.
  // Greedily join the tail of each growing chain to the nearest unused polyline
  // endpoint within 0.5 × hexRadius. This eliminates most visual gaps before
  // Dijkstra ever runs.

  function stitchPolylines(
    rivers: { type: string; coords: [number, number][] }[],
  ): { type: string; coords: [number, number][] }[] {
    const threshold = hexRadius * 0.5
    const used = new Set<number>()
    const result: { type: string; coords: [number, number][] }[] = []

    for (let seed = 0; seed < rivers.length; seed++) {
      if (used.has(seed)) continue
      used.add(seed)
      let coords = rivers[seed].coords.slice() as [number, number][]
      const type = rivers[seed].type

      let extended = true
      while (extended) {
        extended = false
        const tail = coords[coords.length - 1]
        let bestIdx = -1, bestDist = Infinity, bestReverse = false

        for (let i = 0; i < rivers.length; i++) {
          if (used.has(i)) continue
          const r = rivers[i].coords
          const ds = Math.hypot(r[0][0] - tail[0], r[0][1] - tail[1])
          const de = Math.hypot(r[r.length - 1][0] - tail[0], r[r.length - 1][1] - tail[1])
          if (ds < threshold && ds < bestDist) { bestDist = ds; bestIdx = i; bestReverse = false }
          if (de < threshold && de < bestDist) { bestDist = de; bestIdx = i; bestReverse = true }
        }

        if (bestIdx >= 0) {
          used.add(bestIdx)
          const next = bestReverse
            ? ([...rivers[bestIdx].coords].reverse() as [number, number][])
            : (rivers[bestIdx].coords as [number, number][])
          coords = [...coords, ...next.slice(1)]
          extended = true
        }
      }

      result.push({ type, coords })
    }
    return result
  }

  // ── Clip polyline to hex grid bounding box ────────────────────────────────
  // OSM river relations cover entire rivers, often hundreds of km long. Only
  // the portion that overlaps the map matters for Dijkstra. Clipping ensures
  // findEndpointEdge's 25%-windows land near the actual map entry/exit points
  // rather than on off-map coordinates, which caused curly backtracking paths.

  const gridBbox = (() => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    for (const h of hexes) {
      for (const [lon, lat] of h.vertices) {
        if (lon < x0) x0 = lon; if (lon > x1) x1 = lon
        if (lat < y0) y0 = lat; if (lat > y1) y1 = lat
      }
    }
    const buf = hexRadius * 2
    return { x0: x0 - buf, x1: x1 + buf, y0: y0 - buf, y1: y1 + buf }
  })()

  // Liang-Barsky segment clipper — returns the clipped [t0, t1] interval, or null.
  function lbClip(
    ax: number, ay: number, bx: number, by: number,
  ): [number, number] | null {
    const { x0, x1, y0, y1 } = gridBbox
    const dx = bx - ax, dy = by - ay
    let t0 = 0, t1 = 1
    const checks: [number, number][] = [
      [-dx, ax - x0], [dx, x1 - ax],
      [-dy, ay - y0], [dy, y1 - ay],
    ]
    for (const [p, q] of checks) {
      if (p === 0) { if (q < 0) return null }
      else {
        const r = q / p
        if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r }
        else       { if (r < t0) return null; if (r < t1) t1 = r }
      }
    }
    return [t0, t1]
  }

  function clipToGrid(coords: [number, number][]): [number, number][] {
    // Clip each segment against the buffered grid bbox using Liang-Barsky.
    // This synthesises intersection points at bbox boundaries, so rivers that
    // cross the map with no OSM vertex inside the bbox are no longer dropped.
    // Adjacent clipped segments that share an endpoint are joined; gaps between
    // disconnected clipped sub-segments are bridged (Dijkstra handles routing).
    if (coords.length < 2) return coords.slice()
    const result: [number, number][] = []

    const ptEq = (a: [number, number], b: [number, number]) =>
      Math.abs(a[0] - b[0]) < 1e-10 && Math.abs(a[1] - b[1]) < 1e-10

    for (let i = 0; i < coords.length - 1; i++) {
      const [ax, ay] = coords[i], [bx, by] = coords[i + 1]
      const t = lbClip(ax, ay, bx, by)
      if (t === null) continue
      const p0: [number, number] = t[0] === 0 ? [ax, ay] : [ax + t[0] * (bx - ax), ay + t[0] * (by - ay)]
      const p1: [number, number] = t[1] === 1 ? [bx, by] : [ax + t[1] * (bx - ax), ay + t[1] * (by - ay)]
      if (result.length === 0 || !ptEq(result[result.length - 1], p0)) result.push(p0)
      if (!ptEq(p0, p1)) result.push(p1)
    }
    return result
  }

  // ── Phase 4: Stitch → clip → Dijkstra → collect all selected edge keys ───

  const stitched = stitchPolylines(linestrings)
  const allEdgeKeys = new Set<string>()

  // Proximity fallback: collect all edges whose midpoints lie within
  // 1.2 × hexRadius of the clipped polyline. Used when Dijkstra returns no path
  // (exhausted budget, bad endpoint snap, etc.) so we always get something.
  function proximityEdges(clipped: [number, number][]): string[] {
    const threshold = hexRadius * 1.2
    const result: string[] = []
    for (const [ek, edge] of edgeMap) {
      const { dist } = nearestOnPolyline(edge.mid[0], edge.mid[1], clipped)
      if (dist <= threshold) result.push(ek)
    }
    return result
  }

  for (const river of stitched) {
    const clipped = clipToGrid(river.coords)
    if (clipped.length < 2) continue
    const startEk = findEndpointEdge(clipped, false)
    const endEk = findEndpointEdge(clipped, true)
    if (!startEk || !endEk) continue
    if (startEk === endEk) { allEdgeKeys.add(startEk); continue }
    const path = dijkstra(startEk, endEk, clipped)
    if (path.length > 0) {
      for (const ek of path) allEdgeKeys.add(ek)
    } else {
      // Dijkstra failed — fall back to grabbing any edge near the river path
      for (const ek of proximityEdges(clipped)) allEdgeKeys.add(ek)
    }
  }

  // ── Phase 5: Walk vertex adjacency to build gap-free chains ───────────────
  // Edges from different Dijkstra runs that share a vertex are automatically
  // merged: the walk jumps through the shared vertex as if the runs were one.
  // This eliminates all junction gaps regardless of how OSM ways were split.

  const adjVerts = new Map<string, string[]>()
  const coordMap = new Map<string, [number, number]>()

  for (const ek of allEdgeKeys) {
    const edge = edgeMap.get(ek)!
    const vk0 = vKey(edge.v0), vk1 = vKey(edge.v1)
    coordMap.set(vk0, edge.v0)
    coordMap.set(vk1, edge.v1)
    if (!adjVerts.has(vk0)) adjVerts.set(vk0, [])
    if (!adjVerts.has(vk1)) adjVerts.set(vk1, [])
    if (!adjVerts.get(vk0)!.includes(vk1)) adjVerts.get(vk0)!.push(vk1)
    if (!adjVerts.get(vk1)!.includes(vk0)) adjVerts.get(vk1)!.push(vk0)
  }

  const visitedEdgePairs = new Set<string>()
  const allChains: [number, number][][] = []

  function walkFrom(startVk: string): [number, number][] {
    const chain: [number, number][] = [coordMap.get(startVk)!]
    let curVk = startVk
    while (true) {
      const nextVk = (adjVerts.get(curVk) ?? []).find((vk) => {
        const ep = curVk < vk ? `${curVk}|${vk}` : `${vk}|${curVk}`
        return !visitedEdgePairs.has(ep)
      })
      if (!nextVk) break
      const ep = curVk < nextVk ? `${curVk}|${nextVk}` : `${nextVk}|${curVk}`
      visitedEdgePairs.add(ep)
      chain.push(coordMap.get(nextVk)!)
      curVk = nextVk
    }
    return chain
  }

  // Degree-1 vertices are natural path endpoints (sources, mouths, map boundary)
  for (const [vk, nbs] of adjVerts) {
    if (nbs.length === 1) {
      const chain = walkFrom(vk)
      if (chain.length >= 2) allChains.push(chaikin(chain, 1))
    }
  }
  // Catch any remaining unvisited edges: loops, isolated segments, junctions
  for (const [vk, nbs] of adjVerts) {
    for (const nextVk of nbs) {
      const ep = vk < nextVk ? `${vk}|${nextVk}` : `${nextVk}|${vk}`
      if (!visitedEdgePairs.has(ep)) {
        const chain = walkFrom(vk)
        if (chain.length >= 2) allChains.push(chaikin(chain, 1))
      }
    }
  }

  // Interior edges only (shared by 2 hexes) → game river-crossing rules
  const edges: RiverEdge[] = []
  for (const ek of allEdgeKeys) {
    const edge = edgeMap.get(ek)!
    if (edge.hexKeys.length < 2) continue
    const [a, b] = edge.hexKeys
    const [q1, r1] = a.split(',').map(Number)
    const [q2, r2] = b.split(',').map(Number)
    edges.push({ q1, r1, q2, r2 })
  }

  return { edges, chains: allChains }
}

// ── Canonical key for a RiverEdge (order-independent) ────────────────────────
export function riverEdgeCanonicalKey(q1: number, r1: number, q2: number, r2: number): string {
  const a = `${q1},${r1}`, b = `${q2},${r2}`
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

// ── Find the two shared vertices between adjacent hexes ───────────────────────
function sharedHexVertices(
  h1: GeneratedHex, h2: GeneratedHex,
): [[number, number], [number, number]] | null {
  const EPS = 0.0001
  const shared: [number, number][] = []
  for (const va of h1.vertices as [number, number][]) {
    for (const vb of h2.vertices as [number, number][]) {
      if (Math.abs(va[0] - vb[0]) < EPS && Math.abs(va[1] - vb[1]) < EPS) {
        shared.push(va)
        break
      }
    }
    if (shared.length === 2) break
  }
  return shared.length === 2 ? [shared[0], shared[1]] : null
}

// ── Rebuild Chaikin-smoothed chains from a flat RiverEdge list ────────────────
// Used for instant chain refresh after manual edge edits.
export function chainsFromRiverEdges(
  edges: RiverEdge[], hexes: GeneratedHex[],
): [number, number][][] {
  const hexIndex = new Map(hexes.map((h) => [`${h.q},${h.r}`, h]))
  const VK_EPS = 0.00015
  const vKey = (v: [number, number]) =>
    `${Math.round(v[0] / (VK_EPS * 0.5))},${Math.round(v[1] / (VK_EPS * 0.5))}`

  const adjVerts = new Map<string, string[]>()
  const coordMap = new Map<string, [number, number]>()

  for (const edge of edges) {
    const h1 = hexIndex.get(`${edge.q1},${edge.r1}`)
    const h2 = hexIndex.get(`${edge.q2},${edge.r2}`)
    if (!h1 || !h2) continue
    const sv = sharedHexVertices(h1, h2)
    if (!sv) continue
    const [v0, v1] = sv
    const vk0 = vKey(v0), vk1 = vKey(v1)
    coordMap.set(vk0, v0); coordMap.set(vk1, v1)
    if (!adjVerts.has(vk0)) adjVerts.set(vk0, [])
    if (!adjVerts.has(vk1)) adjVerts.set(vk1, [])
    if (!adjVerts.get(vk0)!.includes(vk1)) adjVerts.get(vk0)!.push(vk1)
    if (!adjVerts.get(vk1)!.includes(vk0)) adjVerts.get(vk1)!.push(vk0)
  }

  const visitedPairs = new Set<string>()
  const chains: [number, number][][] = []

  const walkFrom = (startVk: string): [number, number][] => {
    const chain: [number, number][] = [coordMap.get(startVk)!]
    let cur = startVk
    for (;;) {
      const next = (adjVerts.get(cur) ?? []).find((vk) => {
        const ep = cur < vk ? `${cur}|${vk}` : `${vk}|${cur}`
        return !visitedPairs.has(ep)
      })
      if (!next) break
      const ep = cur < next ? `${cur}|${next}` : `${next}|${cur}`
      visitedPairs.add(ep)
      chain.push(coordMap.get(next)!)
      cur = next
    }
    return chain
  }

  for (const [vk, nbs] of adjVerts) {
    if (nbs.length === 1) {
      const chain = walkFrom(vk)
      if (chain.length >= 2) chains.push(chaikin(chain, 1))
    }
  }
  for (const [vk, nbs] of adjVerts) {
    for (const nextVk of nbs) {
      const ep = vk < nextVk ? `${vk}|${nextVk}` : `${nextVk}|${vk}`
      if (!visitedPairs.has(ep)) {
        const chain = walkFrom(vk)
        if (chain.length >= 2) chains.push(chaikin(chain, 1))
      }
    }
  }
  return chains
}

function pointInHex(lon: number, lat: number, vertices: [number, number][]): boolean {
  let inside = false
  const n = vertices.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = vertices[i][0], yi = vertices[i][1]
    const xj = vertices[j][0], yj = vertices[j][1]
    const intersect = ((yi > lat) !== (yj > lat)) &&
      (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

export interface ElevationThresholds {
  hills_relief_m: number
  mountains_relief_m: number
  hills_absolute_m: number
  mountains_absolute_m: number
}

export const DEFAULT_ELEVATION_THRESHOLDS: ElevationThresholds = {
  hills_relief_m: 80,
  mountains_relief_m: 300,
  hills_absolute_m: 600,
  mountains_absolute_m: 1500,
}

const ELEVATION_RANK: Record<string, number> = { flat: 0, hills: 1, mountains: 2 }

function classifyElevationModeA(
  elevationM: number,
  reliefM: number,
  t: ElevationThresholds,
): 'flat' | 'hills' | 'mountains' {
  const localClass: string =
    reliefM >= t.mountains_relief_m ? 'mountains'
    : reliefM >= t.hills_relief_m   ? 'hills'
    : 'flat'
  const absClass: string =
    elevationM >= t.mountains_absolute_m ? 'mountains'
    : elevationM >= t.hills_absolute_m   ? 'hills'
    : 'flat'
  return (ELEVATION_RANK[localClass] >= ELEVATION_RANK[absClass] ? localClass : absClass) as 'flat' | 'hills' | 'mountains'
}

export type PaperSize = 'A4' | 'A3' | 'A2' | 'A1'
export type Orientation = 'portrait' | 'landscape'
export type HexOrientation = 'flat' | 'pointy'
export type HexEdgeMode = 'whole' | 'half'

export interface Hex {
  q: number
  r: number
  center: [number, number]
  vertices: [number, number][]
  partial: boolean
  terrain: string
}

export interface GeneratedHex {
  q: number
  r: number
  center: [number, number]
  vertices: [number, number][]
  terrain: string
  coverage: Record<string, number>
  partial: boolean
  manual_override?: boolean
  elevation_m: number | null
  elevation_relief_m: number | null
  elevation_class: 'flat' | 'hills' | 'mountains' | null
}

export interface GridMetadata {
  hex_count: number
  hex_size_km: number
  scale_m_per_mm: number
  outer_radius_m: number
  center: [number, number]
  bearing: number
  paper_mm: [number, number]
  margin_mm: number
}

export const PAPER_MM: Record<PaperSize, [number, number]> = {
  A4: [210, 297],
  A3: [297, 420],
  A2: [420, 594],
  A1: [594, 841],
}

export const TERRAIN_COLORS: Record<string, string> = {
  clear: '#ede8d5',
  woods: '#4d7a50',
  rough: '#9e8c6a',
  marsh: '#6b9e8a',
  lake: '#5888b0',
  sea: '#3a6898',
  urban: '#b8a898',
  river: '#7ab0c8',
}

export function paperDimsMm(size: PaperSize, orientation: Orientation): [number, number] {
  const [s, l] = PAPER_MM[size]
  return orientation === 'landscape' ? [l, s] : [s, l]
}

/** metres per pixel at a given zoom + latitude.
 *  MapLibre GL JS uses 512px world tiles, so the constant is half of the
 *  classic Leaflet/256px value (156543 → 78271.5).
 */
export function mapResolutionMpx(lat: number, zoom: number): number {
  return (78271.516 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom)
}

const TERRAIN_PRIORITY = ['sea', 'lake', 'marsh', 'urban', 'woods', 'rough', 'clear'] as const

export const DEFAULT_THRESHOLDS: Record<string, number> = {
  sea: 0.4,
  lake: 0.3,
  marsh: 0.2,
  urban: 0.2,
  woods: 0.3,
  rough: 0.25,
  clear: 0,
}

function classifyHex(coverage: Record<string, number>, thresholds: Record<string, number>, disabled: Set<string>): string {
  for (const t of TERRAIN_PRIORITY.slice(0, -1)) {
    if (disabled.has(t)) continue
    if ((coverage[t] ?? 0) >= (thresholds[t] ?? 0.25)) return t
  }
  if (!disabled.has('clear')) return 'clear'
  for (const t of TERRAIN_PRIORITY) {
    if (!disabled.has(t)) return t
  }
  return 'clear'
}

export interface Settlement {
  name: string
  type: 'city' | 'town' | 'village' | string
  population: number
  lon: number
  lat: number
  hex_q: number | null
  hex_r: number | null
  included: boolean
  isCustom?: boolean
}

export interface RiverEdge {
  q1: number
  r1: number
  q2: number
  r2: number
}

export interface RiverFeature {
  name: string
  type: string
  coords: [number, number][]
  smoothedCoords: [number, number][]
  included: boolean
  precomputedEdges: RiverEdge[]
  precomputedChains: [number, number][][]
}

export interface RawRoadWay {
  highway: string
  coords: [number, number][]
}

export interface HexRoadPath {
  highway: string
  hexes: [number, number][]
}

export interface RoadHex {
  q: number
  r: number
  highway: string
  connections: { q: number; r: number }[]
}

export interface RoadEdge {
  q1: number
  r1: number
  q2: number
  r2: number
  highway: string
  manual?: boolean
}

export function roadEdgeCanonicalKey(q1: number, r1: number, q2: number, r2: number, highway: string): string {
  const a = `${q1},${r1}`, b = `${q2},${r2}`
  return `${highway}:${a < b ? `${a}|${b}` : `${b}|${a}`}`
}

export interface RailEdge {
  q1: number
  r1: number
  q2: number
  r2: number
  rail_type: string
  manual?: boolean
}

export function railEdgeCanonicalKey(q1: number, r1: number, q2: number, r2: number, rail_type: string): string {
  const a = `${q1},${r1}`, b = `${q2},${r2}`
  return `${rail_type}:${a < b ? `${a}|${b}` : `${b}|${a}`}`
}

export interface UndoSnapshot {
  terrainHexes: Array<{ q: number; r: number; terrain: string; manual_override: boolean }>
  roadEdges: RoadEdge[]
  railEdges: RailEdge[]
  riverEdges: RiverEdge[]
  settlements: Settlement[]
}

const MAX_UNDO = 50

export interface GenerateProgress {
  step: string
  message: string
  progress: number
}

interface MapStore {
  // Step
  step: 'setup' | 'terrain'

  // Setup controls
  paperSize: PaperSize
  orientation: Orientation
  hexSizeMm: number
  hexOrientation: HexOrientation
  marginMm: number
  hexEdgeMode: HexEdgeMode

  // Live map state (updated from MapLibre events)
  bearing: number
  center: [number, number]
  zoom: number
  framePixelWidth: number

  // Grid output (setup preview)
  hexes: Hex[]
  metadata: GridMetadata | null
  status: 'idle' | 'loading' | 'error' | 'done'
  error: string | null

  // Terrain generation output
  generatedHexes: GeneratedHex[]
  generatedMetadata: GridMetadata | null
  selectedHex: GeneratedHex | null
  generateStatus: 'idle' | 'loading' | 'error' | 'done'
  generateError: string | null

  // Terrain controls
  thresholds: Record<string, number>
  disabledTerrains: Set<string>
  showMapOverlay: boolean
  generateProgress: GenerateProgress | null

  // Settlements state
  settlements: Settlement[]
  settlementsStatus: 'idle' | 'loading' | 'error' | 'done'
  settlementsError: string | null
  settlementsLimit: number
  settlementsTypes: string[]

  // Roads state
  rawRoadWays: RawRoadWay[]
  roadEdges: RoadEdge[]
  roadsDisplayMode: 'raw' | 'per_hex'
  roadsHighwayTypes: string[]
  roadsVisibleTypes: string[]
  roadsStatus: 'idle' | 'loading' | 'error' | 'done'
  roadsError: string | null

  // Rails state
  railEdges: RailEdge[]
  railsRailTypes: string[]
  railsVisibleTypes: string[]
  railsStatus: 'idle' | 'loading' | 'error' | 'done'
  railsError: string | null

  // Rivers state
  riverEdges: RiverEdge[]
  riverChains: [number, number][][]
  riverFeatures: RiverFeature[]
  riversStatus: 'idle' | 'loading' | 'error' | 'done'
  riversError: string | null
  riversTypes: string[]
  riversDisplayMode: 'raw' | 'smoothed' | 'edges'
  hoveredRiverIndex: number | null

  // Elevation state
  elevationThresholds: ElevationThresholds
  elevationStatus: 'idle' | 'loading' | 'error' | 'done'
  elevationError: string | null
  elevationProgress: GenerateProgress | null
  showReliefHeatmap: boolean
  showElevHeatmap: boolean

  setPaperSize: (v: PaperSize) => void
  setOrientation: (v: Orientation) => void
  setHexSizeMm: (v: number) => void
  setHexOrientation: (v: HexOrientation) => void
  setMarginMm: (v: number) => void
  setHexEdgeMode: (v: HexEdgeMode) => void
  setMapState: (bearing: number, center: [number, number], zoom: number) => void
  setFramePixelWidth: (w: number) => void
  generateGrid: () => Promise<void>

  // Terrain actions
  setSelectedHex: (hex: GeneratedHex | null) => void
  resetToSetup: () => void
  generateMap: () => Promise<void>
  setTerrainThreshold: (terrain: string, v: number) => void
  setGenerateProgress: (p: GenerateProgress | null) => void
  reclassify: () => void
  toggleTerrainDisabled: (terrain: string) => void
  setShowMapOverlay: (v: boolean) => void
  overrideHexTerrain: (q: number, r: number, terrain: string) => void
  resetHexOverride: (q: number, r: number) => void

  // Settlement edit mode
  settlementEditMode: boolean
  settlementPlaceTarget: { q: number; r: number; vertices: [number, number][] } | null
  settlementMoveIndex: number | null
  setSettlementEditMode: (v: boolean) => void
  setSettlementPlaceTarget: (v: { q: number; r: number; vertices: [number, number][] } | null) => void
  setSettlementMoveIndex: (v: number | null) => void

  // Settlement actions
  fetchSettlements: () => Promise<void>
  setSettlementsLimit: (v: number) => void
  setSettlementsTypes: (v: string[]) => void
  toggleSettlementIncluded: (index: number) => void
  updateSettlement: (index: number, changes: Partial<Pick<Settlement, 'name' | 'type' | 'included' | 'hex_q' | 'hex_r'>>) => void
  deleteSettlement: (index: number) => void
  addSettlement: (s: Omit<Settlement, 'included'> & { hex_q: number; hex_r: number }) => void
  lookupSettlementsInHex: (vertices: [number, number][]) => Promise<Settlement[]>

  // Roads actions
  fetchRoads: () => Promise<void>
  setRoadsDisplayMode: (mode: 'raw' | 'per_hex') => void
  setRoadsHighwayTypes: (types: string[]) => void
  setRoadsVisibleTypes: (types: string[]) => void
  clearRoads: () => void
  clearManualRoads: () => void
  addRoadEdge: (q1: number, r1: number, q2: number, r2: number, highway: string) => void
  removeRoadHexEdges: (q: number, r: number, highway: string) => void
  removeAllRoadHexEdges: (q: number, r: number) => void

  // Rails actions
  fetchRails: () => Promise<void>
  setRailsRailTypes: (types: string[]) => void
  setRailsVisibleTypes: (types: string[]) => void
  clearRails: () => void
  clearManualRails: () => void
  addRailEdge: (q1: number, r1: number, q2: number, r2: number, rail_type: string) => void
  removeRailHexEdges: (q: number, r: number, rail_type: string) => void
  removeAllRailHexEdges: (q: number, r: number) => void

  // Rivers actions
  fetchRivers: () => Promise<void>
  toggleRiverIncluded: (index: number) => void
  setRiversTypes: (v: string[]) => void
  setRiversDisplayMode: (mode: 'raw' | 'smoothed' | 'edges') => void
  clearRivers: () => void
  setHoveredRiverIndex: (i: number | null) => void
  riverEditMode: boolean
  setRiverEditMode: (v: boolean) => void
  toggleManualRiverEdge: (q1: number, r1: number, q2: number, r2: number) => void

  // Elevation actions
  fetchElevation: () => Promise<void>
  setElevationThreshold: (key: keyof ElevationThresholds, v: number) => void
  setShowReliefHeatmap: (v: boolean) => void
  setShowElevHeatmap: (v: boolean) => void

  // Terrain paint mode
  terrainPaintMode: boolean
  terrainPaintBrush: string
  setTerrainPaintMode: (v: boolean) => void
  setTerrainPaintBrush: (v: string) => void

  // Road paint mode
  roadPaintMode: boolean
  roadPaintBrush: string
  roadPaintEraser: boolean
  setRoadPaintMode: (v: boolean) => void
  setRoadPaintBrush: (v: string) => void
  setRoadPaintEraser: (v: boolean) => void

  // Rail paint mode
  railPaintMode: boolean
  railPaintBrush: string
  railPaintEraser: boolean
  setRailPaintMode: (v: boolean) => void
  setRailPaintBrush: (v: string) => void
  setRailPaintEraser: (v: boolean) => void

  setActivePanel: (panel: 'terrain' | 'settlements' | 'roads' | 'rivers' | 'style') => void
  activePanel: 'terrain' | 'settlements' | 'roads' | 'rivers' | 'style'

  // Style
  terrainDisplacement: number
  terrainNoiseFrequency: number
  terrainNoiseSeed: number
  terrainNoiseOctaves: number
  setTerrainDisplacement: (v: number) => void
  setTerrainNoiseFrequency: (v: number) => void
  setTerrainNoiseSeed: (v: number) => void
  setTerrainNoiseOctaves: (v: number) => void

  // Undo / redo
  undoStack: UndoSnapshot[]
  redoStack: UndoSnapshot[]
  pushUndoSnapshot: () => void
  undo: () => void
  redo: () => void
}

export const useMapStore = create<MapStore>()(persist((set, get) => ({
  step: 'setup',

  paperSize: 'A3',
  orientation: 'landscape',
  hexSizeMm: 20,
  hexOrientation: 'flat',
  marginMm: 8,
  hexEdgeMode: 'whole' as HexEdgeMode,

  bearing: 0,
  center: [15, 50], // central Europe
  zoom: 7,
  framePixelWidth: 0,

  hexes: [],
  metadata: null,
  status: 'idle',
  error: null,

  generatedHexes: [],
  generatedMetadata: null,
  selectedHex: null,
  generateStatus: 'idle',
  generateError: null,

  thresholds: { ...DEFAULT_THRESHOLDS },
  disabledTerrains: new Set<string>(),
  showMapOverlay: false,
  generateProgress: null,

  settlements: [],
  settlementsStatus: 'idle',
  settlementsError: null,
  settlementsLimit: 30,
  settlementsTypes: ['city', 'town', 'village'],
  settlementEditMode: false,
  settlementPlaceTarget: null,
  settlementMoveIndex: null,

  rawRoadWays: [],
  roadEdges: [],
  roadsDisplayMode: 'per_hex',
  roadsHighwayTypes: ['motorway', 'trunk', 'primary'],
  roadsVisibleTypes: ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'],
  roadsStatus: 'idle',
  roadsError: null,

  railEdges: [],
  railsRailTypes: ['rail'],
  railsVisibleTypes: ['rail', 'narrow_gauge', 'light_rail'],
  railsStatus: 'idle',
  railsError: null,

  riverEdges: [],
  riverChains: [],
  riverFeatures: [],
  riversStatus: 'idle',
  riversError: null,
  riversTypes: ['river'],
  riversDisplayMode: 'raw',
  hoveredRiverIndex: null,
  riverEditMode: false,

  elevationThresholds: { ...DEFAULT_ELEVATION_THRESHOLDS },
  elevationStatus: 'idle',
  elevationError: null,
  elevationProgress: null,
  showReliefHeatmap: false,
  showElevHeatmap: false,

  terrainPaintMode: false,
  terrainPaintBrush: 'clear',

  roadPaintMode: false,
  roadPaintBrush: 'primary',
  roadPaintEraser: false,

  railPaintMode: false,
  railPaintBrush: 'rail',
  railPaintEraser: false,

  activePanel: 'terrain',

  terrainDisplacement: 18,
  terrainNoiseFrequency: 6,
  terrainNoiseSeed: 2,
  terrainNoiseOctaves: 3,

  undoStack: [],
  redoStack: [],

  setPaperSize: (v) => set({ paperSize: v }),
  setOrientation: (v) => set({ orientation: v }),
  setHexSizeMm: (v) => set({ hexSizeMm: v }),
  setHexOrientation: (v) => set({ hexOrientation: v }),
  setMarginMm: (v) => set({ marginMm: v }),
  setHexEdgeMode: (v) => set({ hexEdgeMode: v }),
  setMapState: (bearing, center, zoom) => set({ bearing, center, zoom }),
  setFramePixelWidth: (w) => set({ framePixelWidth: w }),

  generateGrid: async () => {
    const { paperSize, orientation, hexSizeMm, hexOrientation, bearing, center, zoom, framePixelWidth } = get()
    if (framePixelWidth === 0) return

    const [pwMm, phMm] = paperDimsMm(paperSize, orientation)
    const res = mapResolutionMpx(center[1], zoom)
    const widthM = framePixelWidth * res
    const heightM = widthM * (phMm / pwMm)

    set({ status: 'loading', error: null })

    try {
      const resp = await fetch('/api/generate/grid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          center_lon: center[0],
          center_lat: center[1],
          bearing,
          width_m: widthM,
          height_m: heightM,
          hex_size_mm: hexSizeMm,
          paper_size: paperSize,
          orientation,
          hex_orientation: hexOrientation,
        }),
      })
      if (!resp.ok) throw new Error(await resp.text())
      const data = await resp.json()
      set({ hexes: data.hexes, metadata: data.metadata, status: 'done' })
    } catch (e) {
      set({ status: 'error', error: String(e) })
    }
  },

  setSelectedHex: (hex) => set({ selectedHex: hex }),

  resetToSetup: () => set({
    step: 'setup',
    generatedHexes: [],
    generatedMetadata: null,
    selectedHex: null,
    generateStatus: 'idle',
    generateError: null,
    generateProgress: null,
    settlements: [],
    settlementsStatus: 'idle',
    settlementsError: null,
    settlementEditMode: false,
    settlementPlaceTarget: null,
    settlementMoveIndex: null,
    rawRoadWays: [],
    roadEdges: [],
    roadsDisplayMode: 'per_hex',
    roadsVisibleTypes: [],
    roadsStatus: 'idle',
    roadsError: null,
    railEdges: [],
    railsVisibleTypes: [],
    railsStatus: 'idle',
    railsError: null,
    riverEdges: [],
    riverChains: [],
    riverFeatures: [],
    riversStatus: 'idle',
    riversError: null,
    riverEditMode: false,
    elevationStatus: 'idle',
    elevationError: null,
    elevationProgress: null,
    showReliefHeatmap: false,
    showElevHeatmap: false,
    terrainPaintMode: false,
    roadPaintMode: false,
    roadPaintEraser: false,
    railPaintMode: false,
    railPaintEraser: false,
    activePanel: 'terrain',
  }),

  setGenerateProgress: (p) => set({ generateProgress: p }),
  setShowMapOverlay: (v) => set({ showMapOverlay: v }),


  generateMap: async () => {
    const { paperSize, orientation, hexSizeMm, hexOrientation, marginMm, bearing, center, zoom, framePixelWidth } = get()
    if (framePixelWidth === 0) return

    const [pwMm, phMm] = paperDimsMm(paperSize, orientation)
    const res = mapResolutionMpx(center[1], zoom)
    const widthM = framePixelWidth * res
    const heightM = widthM * (phMm / pwMm)

    set({ generateStatus: 'loading', generateError: null, generateProgress: null })

    const params = new URLSearchParams({
      center_lon: String(center[0]),
      center_lat: String(center[1]),
      bearing: String(bearing),
      width_m: String(widthM),
      height_m: String(heightM),
      hex_size_mm: String(hexSizeMm),
      paper_size: paperSize,
      orientation,
      hex_orientation: hexOrientation,
      margin_mm: String(marginMm),
      slider: '0.1',
    })

    try {
      const resp = await fetch(`/api/generate/terrain-stream?${params.toString()}`)
      if (!resp.ok) throw new Error(await resp.text())
      if (!resp.body) throw new Error('No response body')

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr) continue
          let event: Record<string, unknown>
          try {
            event = JSON.parse(jsonStr)
          } catch {
            continue
          }

          const step = event.step as string
          const message = event.message as string
          const progress = event.progress as number

          if (step === 'done') {
            const { thresholds, disabledTerrains } = get()
            const rawHexes = event.hexes as GeneratedHex[]
            const reclassified = rawHexes.map((h) => ({
              ...h,
              terrain: classifyHex(h.coverage ?? {}, thresholds, disabledTerrains),
            }))
            set({
              step: 'terrain',
              generateStatus: 'done',
              generatedHexes: reclassified,
              generatedMetadata: event.metadata as GridMetadata,
              generateProgress: null,
            })
          } else if (step === 'error') {
            set({
              generateStatus: 'error',
              generateError: message,
              generateProgress: null,
            })
          } else {
            set({ generateProgress: { step, message, progress } })
          }
        }
      }
    } catch (e) {
      set({ generateStatus: 'error', generateError: String(e), generateProgress: null })
    }
  },

  setTerrainThreshold: (terrain, v) => {
    const { thresholds, generatedHexes, disabledTerrains } = get()
    const next = { ...thresholds, [terrain]: v }
    const updated = generatedHexes.map((h) =>
      h.manual_override ? h : { ...h, terrain: classifyHex(h.coverage ?? {}, next, disabledTerrains) }
    )
    set({ thresholds: next, generatedHexes: updated })
  },

  reclassify: () => {
    const { generatedHexes, thresholds, disabledTerrains } = get()
    if (generatedHexes.length === 0) return
    const updated = generatedHexes.map((h) =>
      h.manual_override ? h : { ...h, terrain: classifyHex(h.coverage ?? {}, thresholds, disabledTerrains) }
    )
    set({ generatedHexes: updated })
  },

  toggleTerrainDisabled: (terrain) => {
    const { disabledTerrains, generatedHexes, thresholds } = get()
    const next = new Set(disabledTerrains)
    if (next.has(terrain)) next.delete(terrain)
    else next.add(terrain)
    const updated = generatedHexes.map((h) =>
      h.manual_override ? h : { ...h, terrain: classifyHex(h.coverage ?? {}, thresholds, next) }
    )
    set({ disabledTerrains: next, generatedHexes: updated })
  },

  overrideHexTerrain: (q, r, terrain) => {
    const { generatedHexes, selectedHex } = get()
    const updated = generatedHexes.map((h) =>
      h.q === q && h.r === r ? { ...h, terrain, manual_override: true } : h
    )
    const updatedSelected = selectedHex && selectedHex.q === q && selectedHex.r === r
      ? { ...selectedHex, terrain, manual_override: true }
      : selectedHex
    set({ generatedHexes: updated, selectedHex: updatedSelected })
  },

  resetHexOverride: (q, r) => {
    get().pushUndoSnapshot()
    const { generatedHexes, selectedHex, thresholds, disabledTerrains } = get()
    const hex = generatedHexes.find((h) => h.q === q && h.r === r)
    if (!hex) return

    const terrain = classifyHex(hex.coverage ?? {}, thresholds, disabledTerrains)
    const updated = generatedHexes.map((h) =>
      h.q === q && h.r === r ? { ...h, terrain, manual_override: false } : h
    )
    const updatedSelected = selectedHex && selectedHex.q === q && selectedHex.r === r
      ? { ...selectedHex, terrain, manual_override: false }
      : selectedHex
    set({ generatedHexes: updated, selectedHex: updatedSelected })
  },

  setSettlementsLimit: (v) => set({ settlementsLimit: v }),
  setSettlementsTypes: (v) => set({ settlementsTypes: v }),

  clearRoads: () => set({ rawRoadWays: [], roadEdges: [], roadsVisibleTypes: [], roadsStatus: 'idle', roadsError: null }),
  clearManualRoads: () => { get().pushUndoSnapshot(); set((s) => ({ roadEdges: s.roadEdges.filter((e) => !e.manual) })) },
  setRoadsDisplayMode: (mode) => set({ roadsDisplayMode: mode }),
  setRoadsHighwayTypes: (types) => set({ roadsHighwayTypes: types }),
  setRoadsVisibleTypes: (types) => set({ roadsVisibleTypes: types }),

  fetchRoads: async () => {
    const { generatedMetadata, hexOrientation, roadsHighwayTypes } = get()
    if (!generatedMetadata) return

    set({ roadsStatus: 'loading', roadsError: null })

    try {
      const resp = await fetch('/api/generate/roads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          center_lon: generatedMetadata.center[0],
          center_lat: generatedMetadata.center[1],
          bearing: generatedMetadata.bearing,
          width_m: generatedMetadata.scale_m_per_mm * generatedMetadata.paper_mm[0],
          height_m: generatedMetadata.scale_m_per_mm * generatedMetadata.paper_mm[1],
          hex_orientation: hexOrientation,
          R_m: generatedMetadata.outer_radius_m,
          highway_types: roadsHighwayTypes,
        }),
      })
      if (!resp.ok) throw new Error(await resp.text())
      const data = await resp.json()
      const fetchedTypes = [...new Set<string>((data.raw_ways as RawRoadWay[]).map((w) => w.highway))]
      // Convert per-hex connections to deduplicated edge list
      const edgeSet = new Set<string>()
      const roadEdges: RoadEdge[] = []
      for (const rh of data.road_hexes as RoadHex[]) {
        for (const conn of rh.connections) {
          const key = roadEdgeCanonicalKey(rh.q, rh.r, conn.q, conn.r, rh.highway)
          if (!edgeSet.has(key)) {
            edgeSet.add(key)
            roadEdges.push({ q1: rh.q, r1: rh.r, q2: conn.q, r2: conn.r, highway: rh.highway })
          }
        }
      }
      set({
        rawRoadWays: data.raw_ways,
        roadEdges,
        roadsVisibleTypes: fetchedTypes,
        roadsStatus: 'done',
      })
    } catch (e) {
      set({ roadsStatus: 'error', roadsError: String(e) })
    }
  },

  setRiversTypes: (v) => set({ riversTypes: v }),
  setRiversDisplayMode: (mode) => set({ riversDisplayMode: mode }),
  clearRivers: () => set({ riverEdges: [], riverChains: [], riverFeatures: [], riversStatus: 'idle', riversError: null, riverEditMode: false }),
  setHoveredRiverIndex: (i) => set({ hoveredRiverIndex: i }),
  setRiverEditMode: (v) => set({ riverEditMode: v }),
  toggleManualRiverEdge: (q1, r1, q2, r2) => {
    get().pushUndoSnapshot()
    const { riverEdges, generatedHexes } = get()
    const key = riverEdgeCanonicalKey(q1, r1, q2, r2)
    const existingIdx = riverEdges.findIndex(
      (e) => riverEdgeCanonicalKey(e.q1, e.r1, e.q2, e.r2) === key,
    )
    const updated = existingIdx >= 0
      ? riverEdges.filter((_, i) => i !== existingIdx)
      : [...riverEdges, { q1, r1, q2, r2 }]
    set({ riverEdges: updated, riverChains: chainsFromRiverEdges(updated, generatedHexes) })
  },

  toggleRiverIncluded: (index) => {
    get().pushUndoSnapshot()
    const { riverFeatures } = get()
    const updated = riverFeatures.map((r, i) =>
      i === index ? { ...r, included: !r.included } : r
    )
    const included = updated.filter((r) => r.included)
    const riverEdges = included.flatMap((r) => r.precomputedEdges)
    const riverChains = included.flatMap((r) => r.precomputedChains)
    set({ riverFeatures: updated, riverEdges, riverChains })
  },

  fetchRivers: async () => {
    const { paperSize, orientation, bearing, center, zoom, framePixelWidth, riversTypes, generatedHexes, generatedMetadata } = get()
    if (framePixelWidth === 0) return

    const [pwMm, phMm] = paperDimsMm(paperSize, orientation)
    const widthM = framePixelWidth * mapResolutionMpx(center[1], zoom)
    const heightM = widthM * (phMm / pwMm)
    const hexSizeKm = generatedMetadata?.hex_size_km ?? 10

    set({ riversStatus: 'loading', riversError: null })

    try {
      const resp = await fetch('/api/generate/rivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          center_lon: center[0],
          center_lat: center[1],
          bearing,
          width_m: widthM,
          height_m: heightM,
          paper_size: paperSize,
          orientation,
          types: riversTypes,
          hex_size_km: hexSizeKm,
        }),
      })
      if (!resp.ok) throw new Error(await resp.text())
      const data = await resp.json()

      const hexRadius = (() => {
        const h = generatedHexes[0]
        if (!h) return 0.01
        const [cx, cy] = h.center
        return Math.max(...h.vertices.map(([vx, vy]) => Math.hypot(vx - cx, vy - cy)))
      })()

      const raw = data.rivers as { name: string; type: string; coords: [number, number][] }[]

      // Pre-compute edges+chains per river so toggles are instant (no Dijkstra re-run)
      const riverFeatures: RiverFeature[] = raw.map((r, i) => {
        const smoothedCoords = douglasPeucker(r.coords, hexRadius * 0.6)
        const { edges: precomputedEdges, chains: precomputedChains } = buildRiverEdgesAstar(
          [{ type: r.type, coords: r.coords }],
          generatedHexes,
        )
        return {
          ...r,
          smoothedCoords,
          included: i < 5,
          precomputedEdges,
          precomputedChains,
        }
      })

      const included = riverFeatures.filter((r) => r.included)
      const riverEdges = included.flatMap((r) => r.precomputedEdges)
      const riverChains = included.flatMap((r) => r.precomputedChains)
      set({ riverFeatures, riverEdges, riverChains, riversStatus: 'done', riversDisplayMode: 'raw' })
    } catch (e) {
      set({ riversStatus: 'error', riversError: String(e) })
    }
  },

  setElevationThreshold: (key, v) => {
    const { elevationThresholds, generatedHexes } = get()
    const next = { ...elevationThresholds, [key]: v }
    const SKIP = new Set(['sea', 'lake'])
    const updated = generatedHexes.map((h) => {
      if (SKIP.has(h.terrain) || h.elevation_m === null || h.elevation_m === undefined) return h
      if (h.elevation_relief_m === null || h.elevation_relief_m === undefined) return h
      return { ...h, elevation_class: classifyElevationModeA(h.elevation_m, h.elevation_relief_m, next) }
    })
    set({ elevationThresholds: next, generatedHexes: updated })
  },

  setShowReliefHeatmap: (v) => set({ showReliefHeatmap: v, showElevHeatmap: v ? false : get().showElevHeatmap }),
  setShowElevHeatmap: (v) => set({ showElevHeatmap: v, showReliefHeatmap: v ? false : get().showReliefHeatmap }),

  setTerrainPaintMode: (v) => set({ terrainPaintMode: v, ...(v ? { roadPaintMode: false, railPaintMode: false, selectedHex: null } : {}) }),
  setTerrainPaintBrush: (v) => set({ terrainPaintBrush: v }),

  setRoadPaintMode: (v) => set({ roadPaintMode: v, ...(v ? { terrainPaintMode: false, railPaintMode: false, roadsDisplayMode: 'per_hex' } : { roadPaintEraser: false }) }),
  setRoadPaintBrush: (v) => set({ roadPaintBrush: v }),
  setRoadPaintEraser: (v) => set({ roadPaintEraser: v }),

  setRailPaintMode: (v) => set({ railPaintMode: v, ...(v ? { terrainPaintMode: false, roadPaintMode: false } : { railPaintEraser: false }) }),
  setRailPaintBrush: (v) => set({ railPaintBrush: v }),
  setRailPaintEraser: (v) => set({ railPaintEraser: v }),

  addRoadEdge: (q1, r1, q2, r2, highway) => {
    const { roadEdges, roadsVisibleTypes } = get()
    const newKey = roadEdgeCanonicalKey(q1, r1, q2, r2, highway)
    // Replace same hex-pair edges of a different type (one type per edge)
    const pairKey = (e: RoadEdge) => {
      const a = `${e.q1},${e.r1}`, b = `${e.q2},${e.r2}`
      return a < b ? `${a}|${b}` : `${b}|${a}`
    }
    const thisPair = (() => { const a = `${q1},${r1}`, b = `${q2},${r2}`; return a < b ? `${a}|${b}` : `${b}|${a}` })()
    const filtered = roadEdges.filter((e) => pairKey(e) !== thisPair)
    if (filtered.some((e) => roadEdgeCanonicalKey(e.q1, e.r1, e.q2, e.r2, e.highway) === newKey)) return
    const visibleTypes = roadsVisibleTypes.includes(highway) ? roadsVisibleTypes : [...roadsVisibleTypes, highway]
    set({ roadEdges: [...filtered, { q1, r1, q2, r2, highway, manual: true }], roadsVisibleTypes: visibleTypes })
  },

  removeRoadHexEdges: (q, r, highway) => {
    const { roadEdges } = get()
    set({ roadEdges: roadEdges.filter((e) => !(e.highway === highway && ((e.q1 === q && e.r1 === r) || (e.q2 === q && e.r2 === r)))) })
  },

  removeAllRoadHexEdges: (q, r) => {
    const { roadEdges } = get()
    set({ roadEdges: roadEdges.filter((e) => !((e.q1 === q && e.r1 === r) || (e.q2 === q && e.r2 === r))) })
  },

  clearRails: () => set({ railEdges: [], railsVisibleTypes: [], railsStatus: 'idle', railsError: null }),
  clearManualRails: () => { get().pushUndoSnapshot(); set((s) => ({ railEdges: s.railEdges.filter((e) => !e.manual) })) },
  setRailsRailTypes: (types) => set({ railsRailTypes: types }),
  setRailsVisibleTypes: (types) => set({ railsVisibleTypes: types }),

  fetchRails: async () => {
    const { generatedMetadata, hexOrientation, railsRailTypes } = get()
    if (!generatedMetadata) return

    set({ railsStatus: 'loading', railsError: null })

    try {
      const resp = await fetch('/api/generate/rails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          center_lon: generatedMetadata.center[0],
          center_lat: generatedMetadata.center[1],
          bearing: generatedMetadata.bearing,
          width_m: generatedMetadata.scale_m_per_mm * generatedMetadata.paper_mm[0],
          height_m: generatedMetadata.scale_m_per_mm * generatedMetadata.paper_mm[1],
          hex_orientation: hexOrientation,
          R_m: generatedMetadata.outer_radius_m,
          rail_types: railsRailTypes,
        }),
      })
      if (!resp.ok) throw new Error(await resp.text())
      const data = await resp.json()
      const fetchedTypes = [...new Set<string>((data.raw_ways as { highway: string }[]).map((w) => w.highway))]
      const edgeSet = new Set<string>()
      const railEdges: RailEdge[] = []
      for (const rh of data.road_hexes as { q: number; r: number; highway: string; connections: { q: number; r: number }[] }[]) {
        for (const conn of rh.connections) {
          const key = railEdgeCanonicalKey(rh.q, rh.r, conn.q, conn.r, rh.highway)
          if (!edgeSet.has(key)) {
            edgeSet.add(key)
            railEdges.push({ q1: rh.q, r1: rh.r, q2: conn.q, r2: conn.r, rail_type: rh.highway })
          }
        }
      }
      set({ railEdges, railsVisibleTypes: fetchedTypes, railsStatus: 'done' })
    } catch (e) {
      set({ railsStatus: 'error', railsError: String(e) })
    }
  },

  addRailEdge: (q1, r1, q2, r2, rail_type) => {
    const { railEdges, railsVisibleTypes } = get()
    const newKey = railEdgeCanonicalKey(q1, r1, q2, r2, rail_type)
    const pairKey = (e: RailEdge) => {
      const a = `${e.q1},${e.r1}`, b = `${e.q2},${e.r2}`
      return a < b ? `${a}|${b}` : `${b}|${a}`
    }
    const thisPair = (() => { const a = `${q1},${r1}`, b = `${q2},${r2}`; return a < b ? `${a}|${b}` : `${b}|${a}` })()
    const filtered = railEdges.filter((e) => pairKey(e) !== thisPair)
    if (filtered.some((e) => railEdgeCanonicalKey(e.q1, e.r1, e.q2, e.r2, e.rail_type) === newKey)) return
    const visibleTypes = railsVisibleTypes.includes(rail_type) ? railsVisibleTypes : [...railsVisibleTypes, rail_type]
    set({ railEdges: [...filtered, { q1, r1, q2, r2, rail_type, manual: true }], railsVisibleTypes: visibleTypes })
  },

  removeRailHexEdges: (q, r, rail_type) => {
    const { railEdges } = get()
    set({ railEdges: railEdges.filter((e) => !(e.rail_type === rail_type && ((e.q1 === q && e.r1 === r) || (e.q2 === q && e.r2 === r)))) })
  },

  removeAllRailHexEdges: (q, r) => {
    const { railEdges } = get()
    set({ railEdges: railEdges.filter((e) => !((e.q1 === q && e.r1 === r) || (e.q2 === q && e.r2 === r))) })
  },

  fetchElevation: async () => {
    const { generatedHexes, elevationThresholds } = get()
    if (generatedHexes.length === 0) return

    set({ elevationStatus: 'loading', elevationError: null, elevationProgress: null })

    try {
      const resp = await fetch('/api/generate/elevation-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hexes: generatedHexes,
          ...elevationThresholds,
        }),
      })
      if (!resp.ok) throw new Error(await resp.text())
      if (!resp.body) throw new Error('No response body')

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr) continue
          let event: Record<string, unknown>
          try { event = JSON.parse(jsonStr) } catch { continue }

          if (event.step === 'done') {
            const updated = event.hexes as GeneratedHex[]
            set({ generatedHexes: updated, elevationStatus: 'done', elevationProgress: null })
          } else if (event.step === 'error') {
            set({ elevationStatus: 'error', elevationError: event.message as string, elevationProgress: null })
          } else {
            set({ elevationProgress: { step: event.step as string, message: event.message as string, progress: event.progress as number } })
          }
        }
      }
    } catch (e) {
      set({ elevationStatus: 'error', elevationError: String(e), elevationProgress: null })
    }
  },

  setActivePanel: (panel) => set({ activePanel: panel }),

  setTerrainDisplacement: (v) => set({ terrainDisplacement: v }),
  setTerrainNoiseFrequency: (v) => set({ terrainNoiseFrequency: v }),
  setTerrainNoiseSeed: (v) => set({ terrainNoiseSeed: v }),
  setTerrainNoiseOctaves: (v) => set({ terrainNoiseOctaves: v }),

  pushUndoSnapshot: () => {
    const { generatedHexes, roadEdges, railEdges, riverEdges, settlements, undoStack } = get()
    const snap: UndoSnapshot = {
      terrainHexes: generatedHexes.map(({ q, r, terrain, manual_override }) => ({ q, r, terrain, manual_override })),
      roadEdges: [...roadEdges],
      railEdges: [...railEdges],
      riverEdges: [...riverEdges],
      settlements: [...settlements],
    }
    set({ undoStack: [...undoStack, snap].slice(-MAX_UNDO), redoStack: [] })
  },

  undo: () => {
    const { undoStack, redoStack, generatedHexes, roadEdges, railEdges, riverEdges, settlements } = get()
    if (undoStack.length === 0) return
    const prev = undoStack[undoStack.length - 1]
    const current: UndoSnapshot = {
      terrainHexes: generatedHexes.map(({ q, r, terrain, manual_override }) => ({ q, r, terrain, manual_override })),
      roadEdges: [...roadEdges],
      railEdges: [...railEdges],
      riverEdges: [...riverEdges],
      settlements: [...settlements],
    }
    const hexMap = new Map(prev.terrainHexes.map((h) => [`${h.q},${h.r}`, h]))
    const restoredHexes = generatedHexes.map((h) => {
      const snap = hexMap.get(`${h.q},${h.r}`)
      return snap ? { ...h, terrain: snap.terrain, manual_override: snap.manual_override } : h
    })
    const restoredRiverChains = chainsFromRiverEdges(prev.riverEdges, restoredHexes)
    set({
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, current],
      generatedHexes: restoredHexes,
      roadEdges: prev.roadEdges,
      railEdges: prev.railEdges,
      riverEdges: prev.riverEdges,
      riverChains: restoredRiverChains,
      settlements: prev.settlements,
    })
  },

  redo: () => {
    const { undoStack, redoStack, generatedHexes, roadEdges, railEdges, riverEdges, settlements } = get()
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    const current: UndoSnapshot = {
      terrainHexes: generatedHexes.map(({ q, r, terrain, manual_override }) => ({ q, r, terrain, manual_override })),
      roadEdges: [...roadEdges],
      railEdges: [...railEdges],
      riverEdges: [...riverEdges],
      settlements: [...settlements],
    }
    const hexMap = new Map(next.terrainHexes.map((h) => [`${h.q},${h.r}`, h]))
    const restoredHexes = generatedHexes.map((h) => {
      const snap = hexMap.get(`${h.q},${h.r}`)
      return snap ? { ...h, terrain: snap.terrain, manual_override: snap.manual_override } : h
    })
    const restoredRiverChains = chainsFromRiverEdges(next.riverEdges, restoredHexes)
    set({
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, current],
      generatedHexes: restoredHexes,
      roadEdges: next.roadEdges,
      railEdges: next.railEdges,
      riverEdges: next.riverEdges,
      riverChains: restoredRiverChains,
      settlements: next.settlements,
    })
  },

  setSettlementEditMode: (v) => set({ settlementEditMode: v, ...(v ? {} : { settlementPlaceTarget: null, settlementMoveIndex: null }) }),
  setSettlementPlaceTarget: (v) => set({ settlementPlaceTarget: v }),
  setSettlementMoveIndex: (v) => set({ settlementMoveIndex: v, settlementEditMode: v !== null }),

  toggleSettlementIncluded: (index) => {
    const { settlements } = get()
    set({ settlements: settlements.map((s, i) => i === index ? { ...s, included: !s.included } : s) })
  },

  updateSettlement: (index, changes) => {
    get().pushUndoSnapshot()
    const { settlements } = get()
    set({ settlements: settlements.map((s, i) => i === index ? { ...s, ...changes } : s) })
  },

  deleteSettlement: (index) => {
    get().pushUndoSnapshot()
    const { settlements } = get()
    set({ settlements: settlements.filter((_, i) => i !== index) })
  },

  addSettlement: (s) => {
    get().pushUndoSnapshot()
    const { settlements } = get()
    set({ settlements: [...settlements, { ...s, included: true }] })
  },

  lookupSettlementsInHex: async (vertices) => {
    const resp = await fetch('/api/generate/settlement-hex-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vertices }),
    })
    if (!resp.ok) throw new Error(await resp.text())
    const data = await resp.json()
    return (data.settlements as Array<{ name: string; type: string; population: number; lon: number; lat: number }>)
      .map((s) => ({ ...s, hex_q: null, hex_r: null, included: true }))
  },

  fetchSettlements: async () => {
    const {
      paperSize, orientation, bearing, center, zoom, framePixelWidth,
      settlementsLimit, settlementsTypes, generatedHexes,
    } = get()
    if (framePixelWidth === 0) return

    const [pwMm, phMm] = paperDimsMm(paperSize, orientation)
    const widthM = framePixelWidth * mapResolutionMpx(center[1], zoom)
    const heightM = widthM * (phMm / pwMm)

    set({ settlementsStatus: 'loading', settlementsError: null })

    try {
      const resp = await fetch('/api/generate/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          center_lon: center[0],
          center_lat: center[1],
          bearing,
          width_m: widthM,
          height_m: heightM,
          paper_size: paperSize,
          orientation,
          limit: settlementsLimit,
          types: settlementsTypes,
        }),
      })
      if (!resp.ok) throw new Error(await resp.text())
      const data = await resp.json()

      // Assign each settlement to a hex using point-in-polygon.
      // If two settlements land on the same hex, keep the higher population one.
      const hexByCoord = new Map<string, { hex: (typeof generatedHexes)[0]; pop: number; sIdx: number }>()

      const rawSettlements: Settlement[] = (data.settlements as Array<{
        name: string; type: string; population: number; lon: number; lat: number
      }>).map((s) => ({ ...s, hex_q: null, hex_r: null, included: true }))

      for (let i = 0; i < rawSettlements.length; i++) {
        const s = rawSettlements[i]
        for (const hex of generatedHexes) {
          if (pointInHex(s.lon, s.lat, hex.vertices)) {
            const key = `${hex.q},${hex.r}`
            const existing = hexByCoord.get(key)
            if (!existing || s.population > existing.pop) {
              if (existing) {
                // Unassign previous winner
                rawSettlements[existing.sIdx].hex_q = null
                rawSettlements[existing.sIdx].hex_r = null
              }
              rawSettlements[i].hex_q = hex.q
              rawSettlements[i].hex_r = hex.r
              hexByCoord.set(key, { hex, pop: s.population, sIdx: i })
            }
            break
          }
        }
      }

      // Preserve custom settlements added by the user
      const { settlements: existing } = get()
      const customSettlements = existing.filter((s) => s.isCustom)
      set({ settlements: [...rawSettlements, ...customSettlements], settlementsStatus: 'done' })
    } catch (e) {
      set({ settlementsStatus: 'error', settlementsError: String(e) })
    }
  },
}), {
  name: 'ig2-map-store',
  partialize: (s) => ({
    step: s.step,
    paperSize: s.paperSize,
    orientation: s.orientation,
    hexSizeMm: s.hexSizeMm,
    hexOrientation: s.hexOrientation,
    marginMm: s.marginMm,
    hexEdgeMode: s.hexEdgeMode,
    generatedHexes: s.generatedHexes,
    generatedMetadata: s.generatedMetadata,
    generateStatus: s.generateStatus,
    thresholds: s.thresholds,
    disabledTerrains: Array.from(s.disabledTerrains) as unknown as Set<string>,
    settlements: s.settlements,
    settlementsStatus: s.settlementsStatus,
    settlementsLimit: s.settlementsLimit,
    settlementsTypes: s.settlementsTypes,
    roadEdges: s.roadEdges,
    rawRoadWays: s.rawRoadWays,
    roadsDisplayMode: s.roadsDisplayMode,
    roadsHighwayTypes: s.roadsHighwayTypes,
    roadsVisibleTypes: s.roadsVisibleTypes,
    roadsStatus: s.roadsStatus,
    railEdges: s.railEdges,
    railsRailTypes: s.railsRailTypes,
    railsVisibleTypes: s.railsVisibleTypes,
    railsStatus: s.railsStatus,
    riverFeatures: s.riverFeatures,
    riverEdges: s.riverEdges,
    riverChains: s.riverChains,
    riversDisplayMode: s.riversDisplayMode,
    riversTypes: s.riversTypes,
    riversStatus: s.riversStatus,
    elevationStatus: s.elevationStatus,
    showReliefHeatmap: s.showReliefHeatmap,
    showElevHeatmap: s.showElevHeatmap,
    activePanel: s.activePanel,
    terrainDisplacement: s.terrainDisplacement,
    terrainNoiseFrequency: s.terrainNoiseFrequency,
    terrainNoiseSeed: s.terrainNoiseSeed,
    terrainNoiseOctaves: s.terrainNoiseOctaves,
  }),
  onRehydrateStorage: () => (state) => {
    if (state) {
      state.disabledTerrains = new Set(state.disabledTerrains as unknown as string[])
    }
  },
}))
