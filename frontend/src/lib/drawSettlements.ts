/** Settlement icons and label placement rendering. Pure canvas — no React or store imports. */

import type { Settlement, SettlementTierStyle } from '../store/mapStore'

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
type SettlementTier = 1 | 2 | 3 | 4

export type DrawSettlementsParams = {
  settlements: Settlement[]
  tierStyles: Record<SettlementTier, SettlementTierStyle>
  roadChains: { chain: [number, number][] }[]
  railChains: { chain: [number, number][] }[]
  project: (lon: number, lat: number) => [number, number]
  hexCenterOf: (q: number, r: number) => [number, number] | null
}

export function drawSettlements(sCtx: Ctx, {
  settlements, tierStyles, roadChains, railChains, project, hexCenterOf,
}: DrawSettlementsParams) {
  const placed = settlements.filter(s => s.included && s.hex_q !== null)

  // Sample obstacle points from roads and rails for label placement scoring.
  const obstaclePts: [number, number][] = []
  const sampleChain = (chain: [number, number][]) => {
    if (chain.length < 1) return
    let [scx, scy] = project(chain[0][0], chain[0][1])
    obstaclePts.push([scx, scy])
    for (let i = 1; i < chain.length; i++) {
      const [nx, ny] = project(chain[i][0], chain[i][1])
      const segLen = Math.hypot(nx - scx, ny - scy)
      const steps = Math.max(1, Math.ceil(segLen / 6))
      for (let st = 1; st <= steps; st++) {
        const t = st / steps
        obstaclePts.push([scx + (nx - scx) * t, scy + (ny - scy) * t])
      }
      ;[scx, scy] = [nx, ny]
    }
  }
  for (const { chain } of roadChains) sampleChain(chain)
  for (const { chain } of railChains) sampleChain(chain)

  const placedBoxes: [number, number, number, number][] = []

  for (const s of placed) {
    const center = hexCenterOf(s.hex_q!, s.hex_r)
    if (!center) continue
    const [cx, cy] = center
    const tier = (s.tier ?? (s.type === 'city' ? 1 : s.type === 'town' ? 3 : 4)) as SettlementTier
    const ts = tierStyles[tier]
    const r = ts.size

    if (ts.displayMode === 'icon') {
      sCtx.fillStyle = ts.fillColor
      sCtx.strokeStyle = ts.strokeColor
      sCtx.lineWidth = ts.strokeWidth
      sCtx.beginPath()
      if (ts.shape === 'circle') {
        sCtx.arc(cx, cy, r, 0, Math.PI * 2)
      } else {
        sCtx.rect(cx - r, cy - r, r * 2, r * 2)
      }
      sCtx.fill()
      if (ts.strokeWidth > 0) sCtx.stroke()
    }

    const fontSize = Math.max(5, r * 1.8)
    const weight = tier <= 2 ? 'bold ' : ''
    const font = `${weight}${fontSize}px "Palatino Linotype", Palatino, Georgia, serif`
    sCtx.font = font
    const tw = sCtx.measureText(s.name).width
    const th = fontSize

    const gap = (ts.displayMode === 'icon' ? r : 0) + 3

    type Cand = { x: number; y: number; bx: number; by: number; align: CanvasTextAlign; base: CanvasTextBaseline; bias: number }
    const hw = tw / 2, hh = th / 2
    const cands: Cand[] = [
      { x: cx + gap, y: cy,       bx: cx + gap,      by: cy - hh,       align: 'left',   base: 'middle', bias: 0.0 },
      { x: cx + gap, y: cy - gap, bx: cx + gap,      by: cy - gap - th, align: 'left',   base: 'bottom', bias: 0.3 },
      { x: cx,       y: cy - gap, bx: cx - hw,       by: cy - gap - th, align: 'center', base: 'bottom', bias: 0.8 },
      { x: cx - gap, y: cy - gap, bx: cx - gap - tw, by: cy - gap - th, align: 'right',  base: 'bottom', bias: 1.5 },
      { x: cx - gap, y: cy,       bx: cx - gap - tw, by: cy - hh,       align: 'right',  base: 'middle', bias: 1.5 },
      { x: cx - gap, y: cy + gap, bx: cx - gap - tw, by: cy + gap,      align: 'right',  base: 'top',    bias: 1.5 },
      { x: cx,       y: cy + gap, bx: cx - hw,       by: cy + gap,      align: 'center', base: 'top',    bias: 0.8 },
      { x: cx + gap, y: cy + gap, bx: cx + gap,      by: cy + gap,      align: 'left',   base: 'top',    bias: 0.3 },
    ]

    const pad = 3
    let bestScore = Infinity
    let best = cands[0]
    for (const c of cands) {
      const ex = c.bx - pad, ey = c.by - pad, ew = tw + pad * 2, eh = th + pad * 2
      let score = c.bias
      for (const [rx, ry] of obstaclePts) {
        if (rx >= ex && rx <= ex + ew && ry >= ey && ry <= ey + eh) score += 1
      }
      for (const [plx, ply, plw, plh] of placedBoxes) {
        if (ex < plx + plw && ex + ew > plx && ey < ply + plh && ey + eh > ply) score += 8
      }
      if (score < bestScore) { bestScore = score; best = c }
    }

    placedBoxes.push([best.bx, best.by, tw, th])
    sCtx.fillStyle = '#111111'
    sCtx.font = font
    sCtx.textAlign = best.align
    sCtx.textBaseline = best.base
    sCtx.fillText(s.name, best.x, best.y)
  }
}
