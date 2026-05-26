/** Historical style — stamp PNG icon images inside terrain blob polygons. */

import { pointInPolygon } from './geometry'
import { mulberry32 } from './noise'

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export type HistoricalIconTerrainParams = {
  spacing: number   // grid spacing as a multiple of R
  scale: number     // icon size (width & height) as a multiple of R
  rotRange: number  // total rotation range in radians, centred on 0 (e.g. 0.4 → ±0.2 rad)
}

export type DrawHistoricalIconsParams = {
  blobs: { terrain: string; polys: [number, number][][] }[]
  R: number
  iconSets: Record<string, HTMLImageElement[]>
  iconParams: Record<string, HistoricalIconTerrainParams>
}

export const HISTORICAL_ICON_TERRAIN_DEFAULTS: Record<string, HistoricalIconTerrainParams> = {
  woods:       { spacing: 0.70, scale: 0.40, rotRange: 0.4 },
  light_woods: { spacing: 1.00, scale: 0.40, rotRange: 0.4 },
}

export function drawHistoricalIcons(ctx: Ctx, params: DrawHistoricalIconsParams): void {
  const { blobs, R, iconSets, iconParams } = params

  ctx.save()

  for (const { terrain, polys } of blobs) {
    const images = iconSets[terrain]
    if (!images || images.length === 0) continue

    const p = iconParams[terrain] ?? HISTORICAL_ICON_TERRAIN_DEFAULTS[terrain] ?? { spacing: 0.85, scale: 0.40, rotRange: 0.4 }
    const gridSpacing = p.spacing * R
    const iconSize   = p.scale   * R
    const halfIcon   = iconSize  / 2

    for (const poly of polys) {
      if (poly.length < 3) continue

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
      for (const [px, py] of poly) {
        if (px < minX) minX = px; if (px > maxX) maxX = px
        if (py < minY) minY = py; if (py > maxY) maxY = py
      }

      const seed = Math.abs(Math.round((minX + maxX) * 19 + (minY + maxY) * 37))
      const rng = mulberry32(seed)

      for (let gy = minY + gridSpacing * 0.5; gy < maxY; gy += gridSpacing) {
        for (let gx = minX + gridSpacing * 0.5; gx < maxX; gx += gridSpacing) {
          const jx = gx + (rng() - 0.5) * gridSpacing * 0.6
          const jy = gy + (rng() - 0.5) * gridSpacing * 0.6
          if (!pointInPolygon(jx, jy, poly)) continue

          const img   = images[Math.floor(rng() * images.length)]
          const angle = (rng() - 0.5) * p.rotRange

          ctx.save()
          ctx.translate(jx, jy)
          ctx.rotate(angle)
          ctx.drawImage(img, -halfIcon, -halfIcon, iconSize, iconSize)
          ctx.restore()
        }
      }
    }
  }

  ctx.restore()
}
