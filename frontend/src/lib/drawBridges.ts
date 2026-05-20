/** Bridge rendering — plank and icon styles.
 *
 *  Bridge positions and direction vectors are in lon/lat space.
 *  The `project` function converts them to canvas pixel coordinates. */

import type { BridgeTier } from '../store/slices/bridgesSlice'
import type { RoadTierStyle } from '../store/mapStore'
import type { BridgePoint } from './detectBridges'

export interface DrawBridgesParams {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  bridges: BridgePoint[]
  tiers: BridgeTier[]
  overrides: Record<string, string>
  style: 'plank' | 'icon'
  tierStyles: [RoadTierStyle, RoadTierStyle, RoadTierStyle]
  lineScale: number
  project: (lon: number, lat: number) => [number, number]
}

function resolvedTier(
  bridge: BridgePoint,
  tiers: BridgeTier[],
  overrides: Record<string, string>,
): BridgeTier | null {
  if (tiers.length === 0) return null
  const tierId = overrides[bridge.id]
  return tiers.find(t => t.id === tierId) ?? tiers[0]
}

export function drawBridges(params: DrawBridgesParams): void {
  const { ctx, bridges, tiers, overrides, style, tierStyles, lineScale, project } = params
  if (bridges.length === 0 || tiers.length === 0) return

  for (const bridge of bridges) {
    const tier = resolvedTier(bridge, tiers, overrides)
    if (!tier) continue

    const [px, py] = project(bridge.pos[0], bridge.pos[1])
    const [ax, ay] = project(bridge.dirA[0], bridge.dirA[1])
    const [bx, by] = project(bridge.dirB[0], bridge.dirB[1])
    const angle = Math.atan2(by - ay, bx - ax)

    const roadW = tierStyles[bridge.roadTier].outerW * lineScale

    ctx.save()
    ctx.translate(px, py)
    ctx.rotate(angle)

    if (style === 'plank') {
      const plankLen = roadW * 4.0
      const plankH = roadW * 1.6
      const abutExt = plankH * 0.45

      ctx.fillStyle = tier.color
      ctx.strokeStyle = '#1a1a1a'
      ctx.lineWidth = Math.max(0.5, lineScale * 0.6)
      ctx.lineJoin = 'miter'
      ctx.beginPath()
      ctx.rect(-plankLen / 2, -plankH / 2, plankLen, plankH)
      ctx.fill()
      ctx.stroke()

      ctx.strokeStyle = '#1a1a1a'
      ctx.lineWidth = Math.max(1, lineScale * 1.5)
      ctx.lineCap = 'butt'
      for (const sign of [-1, 1] as const) {
        ctx.beginPath()
        ctx.moveTo(sign * plankLen / 2, -plankH / 2 - abutExt)
        ctx.lineTo(sign * plankLen / 2, plankH / 2 + abutExt)
        ctx.stroke()
      }
    } else {
      const r = roadW * 1.5
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.fillStyle = tier.color
      ctx.fill()
      ctx.strokeStyle = '#1a1a1a'
      ctx.lineWidth = Math.max(0.5, lineScale * 0.8)
      ctx.stroke()
    }

    ctx.restore()
  }
}
