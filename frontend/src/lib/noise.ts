/** Seeded noise primitives and polygon perturbation utilities.
 *  All functions are pure (no canvas, no React, no store deps). */

const WIGGLE_PERM = makePermutation(17)

/** Perlin-noise perpendicular wiggle for dense polylines.
 *  Endpoints are pinned; amplitude fades in/out over FADE points to avoid kinks at chain junctions. */
export function wiggleChain(pts: [number, number][], amplitude: number, frequency: number): [number, number][] {
  if (amplitude === 0 || pts.length < 3) return pts
  const n = pts.length
  const FADE = Math.max(4, Math.floor(n * 0.2))
  return pts.map((pt, i) => {
    if (i === 0 || i === n - 1) return pt
    const fade = Math.min(i, n - 1 - i, FADE) / FADE
    const prev = pts[i - 1], next = pts[i + 1]
    const dx = next[0] - prev[0], dy = next[1] - prev[1]
    const len = Math.hypot(dx, dy)
    if (len < 1e-6) return pt
    const noise = perlinNoise2D(pt[0] * frequency, pt[1] * frequency, WIGGLE_PERM)
    return [pt[0] + (-dy / len) * noise * amplitude * fade, pt[1] + (dx / len) * noise * amplitude * fade] as [number, number]
  })
}

export function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

export function seededRandom(q: number, r: number, salt = 0): number {
  const x = Math.sin(q * 127.1 + r * 311.7 + salt * 74.3) * 43758.5453
  return x - Math.floor(x)
}

export function seededRng(seed: number): () => number {
  let s = (seed + 1) * 2654435761
  return () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 0xffffffff }
}

export function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6D2B79F5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function makePermutation(seed: number): Uint8Array {
  const rng = seededRng(seed)
  const p = Array.from({ length: 256 }, (_: unknown, i: number) => i)
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]]
  }
  const perm = new Uint8Array(512)
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]
  return perm
}

export function perlinNoise2D(x: number, y: number, perm: Uint8Array): number {
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
  const lrp = (a: number, b: number, t: number) => a + t * (b - a)
  const grad = (h: number, gx: number, gy: number) => {
    const g = h & 3
    return g === 0 ? gx + gy : g === 1 ? -gx + gy : g === 2 ? gx - gy : -gx - gy
  }
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255
  const xf = x - Math.floor(x), yf = y - Math.floor(y)
  const u = fade(xf), v = fade(yf)
  const a = perm[X] + Y, b = perm[X + 1] + Y
  return lrp(
    lrp(grad(perm[a], xf, yf), grad(perm[b], xf - 1, yf), u),
    lrp(grad(perm[a + 1], xf, yf - 1), grad(perm[b + 1], xf - 1, yf - 1), u),
    v,
  )
}

/** Perpendicular perturbation for open polylines — endpoints are pinned. */
export function perturbPoints(pts: [number, number][], amount: number, rng: () => number): [number, number][] {
  if (amount === 0 || pts.length < 3) return pts
  return pts.map((pt, i) => {
    if (i === 0 || i === pts.length - 1) return pt
    const prev = pts[i - 1], next = pts[i + 1]
    const dx = next[0] - prev[0], dy = next[1] - prev[1]
    const len = Math.hypot(dx, dy)
    if (len === 0) return pt
    const offset = (rng() * 2 - 1) * amount
    return [pt[0] + (-dy / len) * offset, pt[1] + (dx / len) * offset] as [number, number]
  })
}

/** Perlin-based perpendicular perturbation for closed polygons. */
export function perturbWithNoise(pts: [number, number][], amplitude: number, frequency: number, perm: Uint8Array): [number, number][] {
  if (amplitude === 0 || pts.length < 3) return pts
  const n = pts.length
  return pts.map((pt, i) => {
    const prev = pts[(i + n - 1) % n], next = pts[(i + 1) % n]
    const dx = next[0] - prev[0], dy = next[1] - prev[1]
    const len = Math.hypot(dx, dy)
    if (len < 1e-6) return pt
    const noise = perlinNoise2D(pt[0] * frequency, pt[1] * frequency, perm)
    return [pt[0] + (-dy / len) * noise * amplitude, pt[1] + (dx / len) * noise * amplitude] as [number, number]
  })
}

/** RNG-based perpendicular perturbation for closed polygons. */
export function perturbClosedPolygon(pts: [number, number][], amount: number, seed: number): [number, number][] {
  if (amount === 0 || pts.length < 3) return pts
  const rng = seededRng(seed)
  const n = pts.length
  return pts.map((pt, i) => {
    const prev = pts[(i + n - 1) % n], next = pts[(i + 1) % n]
    const dx = next[0] - prev[0], dy = next[1] - prev[1]
    const len = Math.hypot(dx, dy)
    if (len < 1e-6) return pt
    const offset = (rng() * 2 - 1) * amount
    return [pt[0] + (-dy / len) * offset, pt[1] + (dx / len) * offset] as [number, number]
  })
}

/** Radial outward bumps from polygon centroid — squared distribution, skewed outward. */
export function addMicroBumps(pts: [number, number][], amount: number, seed: number): [number, number][] {
  if (amount === 0 || pts.length < 3) return pts
  const rng = seededRng(seed)
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length
  return pts.map((pt) => {
    const odx = pt[0] - cx, ody = pt[1] - cy
    const olen = Math.hypot(odx, ody)
    if (olen < 1e-6) return pt
    const r = rng()
    return [pt[0] + (odx / olen) * r * r * amount, pt[1] + (ody / olen) * r * r * amount] as [number, number]
  })
}

/** Independent X/Y Perlin displacement — produces large organic sweeps. */
export function perturbXY(
  pts: [number, number][],
  permX: Uint8Array,
  permY: Uint8Array,
  freq: number,
  amp: number,
): [number, number][] {
  if (amp === 0 || pts.length < 3) return pts
  return pts.map(pt => {
    const nx = perlinNoise2D(pt[0] * freq, pt[1] * freq, permX)
    const ny = perlinNoise2D(pt[0] * freq, pt[1] * freq, permY)
    return [pt[0] + nx * amp, pt[1] + ny * amp] as [number, number]
  })
}

/** Outward-normal Perlin displacement with threshold — creates isolated lobes. */
export function perturbNormal(
  pts: [number, number][],
  permA: Uint8Array,
  permB: Uint8Array,
  freq: number,
  amp: number,
  threshold: number,
): [number, number][] {
  if (amp === 0 || pts.length < 3) return pts
  const n = pts.length
  let area = 0
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % n]
    area += x0 * y1 - x1 * y0
  }
  const windSign = area >= 0 ? 1 : -1
  return pts.map((pt, i) => {
    const prev = pts[(i + n - 1) % n], next = pts[(i + 1) % n]
    const tx = next[0] - prev[0], ty = next[1] - prev[1]
    const tlen = Math.hypot(tx, ty)
    if (tlen < 1e-6) return pt
    const normalX = -ty / tlen * windSign
    const normalY =  tx / tlen * windSign
    const na = perlinNoise2D(pt[0] * freq, pt[1] * freq, permA)
    const nb = perlinNoise2D(pt[0] * freq, pt[1] * freq, permB)
    let scalar = (na + nb) * 0.5
    if (Math.abs(scalar) < threshold) scalar = 0
    return [pt[0] + normalX * scalar * amp, pt[1] + normalY * scalar * amp] as [number, number]
  })
}
