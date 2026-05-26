/** Contour line generation via marching squares on the RG16 heightmap.
 *  Produces vector paths so they can be smoothed with Chaikin subdivision.
 *  Pure canvas operations — no React or store imports. */

import type { HeightmapMeta } from '../store/slices/elevationSlice'

export type ContourParams = {
  interval: number      // metres between contour lines
  baseElevation: number // contours only drawn above this elevation (metres)
  indexEvery: number    // every N lines is an index contour (thicker)
  smoothPasses: number  // Chaikin subdivision passes (0 = raw marching squares)
  color: string
  width: number         // normal contour stroke width (canvas px)
  indexWidth: number    // index contour stroke width
  opacity: number
}

// Marching squares edge pairs per 4-bit case (TL=8, TR=4, BR=2, BL=1)
// Edges: 0=top, 1=right, 2=bottom, 3=left
// Each entry is a list of [edgeA, edgeB] segment pairs
const MS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [],              // 0  — all below
  [[3, 2]],        // 1  — BL         → L,B
  [[2, 1]],        // 2  — BR         → B,R
  [[3, 1]],        // 3  — BL+BR      → L,R
  [[0, 1]],        // 4  — TR         → T,R
  [[0, 1], [3, 2]],// 5  — TR+BL (saddle) → T,R + L,B
  [[0, 2]],        // 6  — TR+BR      → T,B
  [[0, 3]],        // 7  — TR+BR+BL   → T,L
  [[0, 3]],        // 8  — TL         → T,L
  [[0, 2]],        // 9  — TL+BL      → T,B
  [[0, 3], [2, 1]],// 10 — TL+BR (saddle) → T,L + B,R
  [[0, 1]],        // 11 — TL+BL+BR   → T,R
  [[3, 1]],        // 12 — TL+TR      → L,R
  [[1, 2]],        // 13 — TL+TR+BL   → R,B
  [[3, 2]],        // 14 — TL+TR+BR   → L,B
  [],              // 15 — all above
]

function edgePt(
  edge: number, col: number, row: number,
  tl: number, tr: number, br: number, bl: number,
  T: number,
): [number, number] {
  let t: number
  switch (edge) {
    case 0: t = (T - tl) / (tr - tl); return [col + t, row]
    case 1: t = (T - tr) / (br - tr); return [col + 1, row + t]
    case 2: t = (T - bl) / (br - bl); return [col + t, row + 1]
    default: t = (T - tl) / (bl - tl); return [col, row + t]  // edge 3
  }
}

type Seg = [[number, number], [number, number]]

function ptKey(p: [number, number]): string {
  return `${Math.round(p[0] * 1e4)},${Math.round(p[1] * 1e4)}`
}

function chainSegments(segs: Seg[]): [number, number][][] {
  // Adjacency list: endpoint key → all [segIdx, endpointIdx] pairs touching that point.
  // A single-entry map overwrites shared endpoints, breaking chain traversal.
  const adj = new Map<string, Array<[number, number]>>()
  for (let i = 0; i < segs.length; i++) {
    const k0 = ptKey(segs[i][0]), k1 = ptKey(segs[i][1])
    if (!adj.has(k0)) adj.set(k0, [])
    if (!adj.has(k1)) adj.set(k1, [])
    adj.get(k0)!.push([i, 0])
    adj.get(k1)!.push([i, 1])
  }

  const used = new Uint8Array(segs.length)
  const chains: [number, number][][] = []

  for (let start = 0; start < segs.length; start++) {
    if (used[start]) continue
    used[start] = 1
    const chain: [number, number][] = [segs[start][0], segs[start][1]]

    // Extend from tail
    let extending = true
    while (extending) {
      extending = false
      const neighbors = adj.get(ptKey(chain[chain.length - 1]))
      if (neighbors) {
        for (const [ni, ne] of neighbors) {
          if (!used[ni]) {
            used[ni] = 1
            chain.push(ne === 0 ? segs[ni][1] : segs[ni][0])
            extending = true
            break
          }
        }
      }
    }

    // Extend from head
    extending = true
    while (extending) {
      extending = false
      const neighbors = adj.get(ptKey(chain[0]))
      if (neighbors) {
        for (const [ni, ne] of neighbors) {
          if (!used[ni]) {
            used[ni] = 1
            chain.unshift(ne === 0 ? segs[ni][1] : segs[ni][0])
            extending = true
            break
          }
        }
      }
    }

    if (chain.length >= 2) chains.push(chain)
  }

  return chains
}

// Internal render scale — canvas is drawn stretched back to pw×ph by the caller,
// so this purely governs how many pixels the vector paths are rasterised at.
const CONTOUR_SCALE = 4

export function computeContours(
  imgData: ImageData,
  meta: HeightmapMeta,
  params: ContourParams,
  pw: number,
  ph: number,
): OffscreenCanvas {
  const { width, height, data } = imgData
  const elevRange = meta.maxElev - meta.minElev

  // Decode RG16 → metres
  const elev = new Float32Array(width * height)
  for (let i = 0; i < elev.length; i++) {
    elev[i] = meta.minElev + (data[i * 4] * 256 + data[i * 4 + 1]) / 65535 * elevRange
  }

  const { interval, baseElevation, indexEvery, smoothPasses, color, width: lw, indexWidth: ilw, opacity } = params

  // Build contour levels — start at the first interval boundary above baseElevation
  const floor = Math.max(meta.minElev, baseElevation)
  const firstLevel = Math.ceil((floor + 1) / interval) * interval
  const levels: number[] = []
  for (let T = firstLevel; T < meta.maxElev; T += interval) levels.push(T)

  // Pixel-space → paper-local canvas coords (before CONTOUR_SCALE is applied)
  const toX = (px: number) => px / width * pw
  const toY = (py: number) => py / height * ph

  const out = new OffscreenCanvas(Math.ceil(pw * CONTOUR_SCALE), Math.ceil(ph * CONTOUR_SCALE))
  const ctx = out.getContext('2d')!
  ctx.scale(CONTOUR_SCALE, CONTOUR_SCALE)
  ctx.globalAlpha = opacity

  for (let li = 0; li < levels.length; li++) {
    const T = levels[li]
    const levelIdx = Math.round(T / interval)
    const isIndex = indexEvery > 0 && levelIdx % indexEvery === 0

    // Marching squares for this threshold
    const segs: Seg[] = []
    for (let row = 0; row < height - 1; row++) {
      for (let col = 0; col < width - 1; col++) {
        const tl = elev[row * width + col]
        const tr = elev[row * width + col + 1]
        const bl = elev[(row + 1) * width + col]
        const br = elev[(row + 1) * width + col + 1]

        const cellMin = Math.min(tl, tr, bl, br)
        const cellMax = Math.max(tl, tr, bl, br)
        if (T <= cellMin || T > cellMax) continue

        const caseIdx = (tl >= T ? 8 : 0) | (tr >= T ? 4 : 0) | (br >= T ? 2 : 0) | (bl >= T ? 1 : 0)
        for (const [eA, eB] of MS[caseIdx]) {
          segs.push([edgePt(eA, col, row, tl, tr, br, bl, T), edgePt(eB, col, row, tl, tr, br, bl, T)])
        }
      }
    }

    const chains = chainSegments(segs)

    ctx.strokeStyle = color
    ctx.lineWidth = isIndex ? ilw : lw
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    for (const raw of chains) {
      const pts: [number, number][] = raw.map(([x, y]) => [toX(x), toY(y)])
      const n = pts.length
      if (n < 2) continue

      // Detect closed loops: first and last point within half a heightmap cell
      const dx = pts[0][0] - pts[n - 1][0]
      const dy = pts[0][1] - pts[n - 1][1]
      const isClosed = Math.sqrt(dx * dx + dy * dy) < (pw / width) * 0.6

      ctx.beginPath()
      if (smoothPasses === 0 || n < 3) {
        // Raw marching-squares output — straight lineTo segments
        ctx.moveTo(pts[0][0], pts[0][1])
        for (let i = 1; i < n; i++) ctx.lineTo(pts[i][0], pts[i][1])
        if (isClosed) ctx.closePath()
      } else if (isClosed) {
        // Closed loop: quadratic bezier through midpoints, wrapping seamlessly
        const mx0 = (pts[n - 1][0] + pts[0][0]) / 2
        const my0 = (pts[n - 1][1] + pts[0][1]) / 2
        ctx.moveTo(mx0, my0)
        for (let i = 0; i < n - 1; i++) {
          const mx = (pts[i][0] + pts[i + 1][0]) / 2
          const my = (pts[i][1] + pts[i + 1][1]) / 2
          ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my)
        }
        ctx.quadraticCurveTo(pts[n - 1][0], pts[n - 1][1], mx0, my0)
        ctx.closePath()
      } else {
        // Open chain: bezier between midpoints, hard endpoints preserved
        ctx.moveTo(pts[0][0], pts[0][1])
        const mx1 = (pts[0][0] + pts[1][0]) / 2
        const my1 = (pts[0][1] + pts[1][1]) / 2
        ctx.lineTo(mx1, my1)
        for (let i = 1; i < n - 1; i++) {
          const mx = (pts[i][0] + pts[i + 1][0]) / 2
          const my = (pts[i][1] + pts[i + 1][1]) / 2
          ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my)
        }
        ctx.lineTo(pts[n - 1][0], pts[n - 1][1])
      }
      ctx.stroke()
    }
  }

  return out
}
