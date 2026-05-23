/** Historical Simple style — tree and bush icons stamped inside terrain blob polygons. */

import { pointInPolygon } from './geometry'
import { mulberry32 } from './noise'

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export type DrawHistoricalVegetationParams = {
  blobs: { terrain: string; polys: [number, number][][] }[]
  R: number
}

function drawTree(ctx: Ctx, x: number, y: number, R: number, rng: () => number): void {
  const crownR = R * 0.12
  const trunkH = R * 0.1
  // slight positional wobble for hand-drawn feel
  const wx = (rng() - 0.5) * R * 0.04
  const cx = x + wx
  const cy = y - trunkH

  // trunk
  ctx.beginPath()
  ctx.moveTo(cx, cy + crownR * 0.5)
  ctx.lineTo(cx, y)
  ctx.stroke()

  // crown — filled circle
  ctx.beginPath()
  ctx.arc(cx, cy, crownR, 0, Math.PI * 2)
  ctx.fill()
}

function drawBush(ctx: Ctx, x: number, y: number, R: number, rng: () => number): void {
  const r = R * 0.075
  const spread = R * 0.06
  const wx = (rng() - 0.5) * R * 0.04
  const bx = x + wx

  // three overlapping lobes — no trunk
  ctx.beginPath()
  ctx.arc(bx - spread, y, r * 0.85, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(bx + spread, y, r * 0.85, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(bx, y - spread * 0.75, r, 0, Math.PI * 2)
  ctx.fill()
}

export function drawHistoricalVegetation(ctx: Ctx, params: DrawHistoricalVegetationParams): void {
  const { blobs, R } = params

  // ── Watercolor wash for woods only ────────────────────────────────────────
  ctx.save()
  ctx.fillStyle = 'rgba(120, 165, 70, 0.22)'
  for (const { terrain, polys } of blobs) {
    if (terrain !== 'woods') continue
    for (const poly of polys) {
      if (poly.length < 3) continue
      ctx.beginPath()
      ctx.moveTo(poly[0][0], poly[0][1])
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1])
      ctx.closePath()
      ctx.fill('evenodd')
    }
  }
  ctx.restore()

  // ── Tree and bush icons ────────────────────────────────────────────────────
  ctx.save()
  ctx.fillStyle = '#2a3e18'
  ctx.strokeStyle = '#1e2e10'
  ctx.lineWidth = R * 0.018
  ctx.lineCap = 'round'

  for (const { terrain, polys } of blobs) {
    const isWoods = terrain === 'woods'
    const isLightWoods = terrain === 'light_woods'
    if (!isWoods && !isLightWoods) continue

    // woods: denser grid, no bushes; light_woods: sparser, ~40% bushes
    const spacing = isWoods ? R * 0.62 : R * 0.88
    const bushChance = isLightWoods ? 0.4 : 0

    for (const poly of polys) {
      if (poly.length < 3) continue

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
      for (const [px, py] of poly) {
        if (px < minX) minX = px; if (px > maxX) maxX = px
        if (py < minY) minY = py; if (py > maxY) maxY = py
      }

      // seed from polygon bounds for determinism across re-renders
      const seed = Math.abs(Math.round((minX + maxX) * 19 + (minY + maxY) * 37)) + (isWoods ? 0 : 1000)
      const rng = mulberry32(seed)

      for (let gy = minY + spacing * 0.5; gy < maxY; gy += spacing) {
        for (let gx = minX + spacing * 0.5; gx < maxX; gx += spacing) {
          const jx = gx + (rng() - 0.5) * spacing * 0.65
          const jy = gy + (rng() - 0.5) * spacing * 0.65
          if (!pointInPolygon(jx, jy, poly)) continue

          if (rng() < bushChance) {
            drawBush(ctx, jx, jy, R, rng)
          } else {
            drawTree(ctx, jx, jy, R, rng)
          }
        }
      }
    }
  }

  ctx.restore()
}
