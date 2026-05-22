/** Terrain layer rendering — hex fills, blob overlays, textures, lakes, coastline.
 *  Pure canvas operations — no React or store imports except types. */

import type { GeneratedHex, BlobOverride } from '../store/mapStore'
import { buildTerrainBlobsV2, buildSmoothedRing, getCoastlineRuns, bleedPolygon } from './terrainBlobs'
import { catmullRom } from './geometry'
import { makePermutation } from './noise'
import { findEdgeChains, buildEdgeBlobPolys, type EdgeBlobChain, type EdgeBlobParams } from './edgeBlobs'

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export type BlobParams = {
  smooth: number; offset: number; bump: number
  sweepFreq: number; lobeFreq: number; lobeAmp: number
  lobeThreshold: number; lobeDirection: number
}

export type DrawTerrainParams = {
  projected: { hex: GeneratedHex; verts: [number, number][] }[]
  edgeMode: string
  inMargin: (verts: [number, number][]) => boolean
  terrainColors: Record<string, string>
  terrainTextureScales: Record<string, number>
  clearTexture: HTMLImageElement | null
  forestTexture: HTMLImageElement | null
  lightWoodsTexture: HTMLImageElement | null
  marshTexture: HTMLImageElement | null
  renderMode: string
  fieldCanvas: HTMLCanvasElement | OffscreenCanvas | null
  px: number; py: number; pw: number; ph: number
  defaultTerrainBlobs: { terrain: string; polys: [number, number][][] }[]
  defaultLakeBlobs: { terrain: string; polys: [number, number][][] }[]
  terrainBlobOverrides: Record<string, BlobOverride>
  lakeOverrides: Record<string, BlobOverride>
  blobComponents: Map<string, string>
  blobComponentsByTerrain: Map<string, Map<string, string>>
  terrainBlobParams: BlobParams
  lakeBlobParams: BlobParams
  hexes: GeneratedHex[]
  hexTerrainLayers: (hex: GeneratedHex) => string[]
  R: number
  realisticCoastline: boolean
  coastlineClips: Map<string, [number, number][][][]>
  seaCoastKeys: Set<string>
  oceanSeaKeys: Set<string>
  beachStrip: boolean
  beachColor: string
  beachWidth: number
  // Edge blobs
  edgeBlobPainted: Record<string, string>
  edgeBlobParams: EdgeBlobParams
  edgeBlobOverrides: Record<string, BlobOverride>
  hexVertMap: Map<string, [number, number][]>
}

export type { EdgeBlobParams, EdgeBlobChain }

function applyTextureOverlay(
  tCtx: Ctx,
  tex: HTMLImageElement,
  polys: [number, number][][],
  R: number,
  scaleR: number,
  bleedPx: number,
): void {
  if (!tex.complete || polys.length === 0) return
  const pattern = tCtx.createPattern(tex, 'repeat')
  if (!pattern) return
  const texSize = R * scaleR
  pattern.setTransform(new DOMMatrix([texSize / tex.naturalWidth, 0, 0, texSize / tex.naturalHeight, 0, 0]))
  tCtx.save()
  tCtx.globalCompositeOperation = 'multiply'
  tCtx.globalAlpha = 0.6
  tCtx.fillStyle = pattern
  tCtx.beginPath()
  for (const poly of polys) {
    if (poly.length < 3) continue
    const bleedSeed = Math.abs(Math.round(poly[0][0] * 73 + poly[0][1] * 97)) + 31
    const bleedPerm = makePermutation(bleedSeed)
    const p = bleedPx > 0 ? bleedPolygon(poly, bleedPx, R, bleedPerm) : poly
    tCtx.moveTo(p[0][0], p[0][1])
    for (let i = 1; i < p.length; i++) tCtx.lineTo(p[i][0], p[i][1])
    tCtx.closePath()
  }
  tCtx.fill('evenodd')
  tCtx.restore()
}

export function drawTerrain(tCtx: Ctx, params: DrawTerrainParams): void {
  const {
    projected, edgeMode, inMargin,
    terrainColors, terrainTextureScales,
    clearTexture, forestTexture, lightWoodsTexture, marshTexture,
    renderMode, fieldCanvas, px, py, pw, ph,
    defaultTerrainBlobs, defaultLakeBlobs,
    terrainBlobOverrides, lakeOverrides,
    blobComponents, blobComponentsByTerrain,
    terrainBlobParams, lakeBlobParams,
    hexes, hexTerrainLayers, R,
    realisticCoastline, coastlineClips, seaCoastKeys, oceanSeaKeys,
    beachStrip, beachColor, beachWidth,
    // edge blobs destructured inline below where used
  } = params

  // ── 1. Clear fills ──────────────────────────────────────────────────────────
  const clearFillColor = terrainColors['clear'] ?? '#ede8d5'
  for (const { hex, verts } of projected) {
    if (edgeMode === 'whole' && hex.partial) continue
    if (!hex.partial && !inMargin(verts)) continue
    tCtx.beginPath()
    tCtx.moveTo(verts[0][0], verts[0][1])
    for (let i = 1; i < verts.length; i++) tCtx.lineTo(verts[i][0], verts[i][1])
    tCtx.closePath()
    tCtx.fillStyle = clearFillColor
    tCtx.fill()
  }

  // ── 2. Clear texture overlay ────────────────────────────────────────────────
  if (clearTexture && clearTexture.complete) {
    const clearPattern = tCtx.createPattern(clearTexture, 'repeat')
    if (clearPattern) {
      const clearTexSize = R * (terrainTextureScales['clear'] ?? 3)
      clearPattern.setTransform(new DOMMatrix([
        clearTexSize / clearTexture.naturalWidth, 0,
        0, clearTexSize / clearTexture.naturalHeight,
        0, 0,
      ]))
      tCtx.save()
      tCtx.globalCompositeOperation = 'multiply'
      tCtx.globalAlpha = 0.3
      tCtx.fillStyle = clearPattern
      for (const { hex, verts } of projected) {
        if (hex.terrain !== 'clear') continue
        if (edgeMode === 'whole' && hex.partial) continue
        if (!hex.partial && !inMargin(verts)) continue
        tCtx.beginPath()
        tCtx.moveTo(verts[0][0], verts[0][1])
        for (let i = 1; i < verts.length; i++) tCtx.lineTo(verts[i][0], verts[i][1])
        tCtx.closePath()
        tCtx.fill()
      }
      tCtx.restore()
    }
  }

  // ── 3. Field mode ───────────────────────────────────────────────────────────
  if (renderMode === 'field' && fieldCanvas !== null) {
    tCtx.save()
    tCtx.imageSmoothingEnabled = true
    tCtx.imageSmoothingQuality = 'high'
    tCtx.drawImage(fieldCanvas, px, py, pw, ph)
    tCtx.restore()
  }

  // ── 4. Blob mode ────────────────────────────────────────────────────────────
  if (renderMode === 'blob') {
    const BLOB_Z: Record<string, number> = { rough: 1, marsh: 2, light_woods: 4, woods: 5, sea: 10 }

    // Build defaultBlobMap excluding lakes
    const defaultBlobMap = new Map<string, [number, number][][]>()
    for (const { terrain, polys } of defaultTerrainBlobs) {
      if (terrain !== 'lake') defaultBlobMap.set(terrain, polys)
    }

    // Group overrides by their target terrain
    const overridesByTerrain = new Map<string, Array<[string, BlobOverride]>>()
    for (const [canonicalKey, override] of Object.entries(terrainBlobOverrides)) {
      const canonicalHex = hexes.find(h => `${h.q},${h.r}` === canonicalKey)
      if (!canonicalHex || (canonicalHex.isLake ?? false)) continue
      const ovTerrain = override.terrain ?? canonicalHex.terrain
      if (ovTerrain === 'clear' || ovTerrain === 'lake') continue
      if (!overridesByTerrain.has(ovTerrain)) overridesByTerrain.set(ovTerrain, [])
      overridesByTerrain.get(ovTerrain)!.push([canonicalKey, override])
    }

    const allTerrains = [...new Set([...defaultBlobMap.keys(), ...overridesByTerrain.keys()])]
      .sort((a, b) => (BLOB_Z[a] ?? 5) - (BLOB_Z[b] ?? 5))

    for (const terrain of allTerrains) {
      const defaultPolys = defaultBlobMap.get(terrain) ?? []

      // a. Fill default polys
      if (defaultPolys.length > 0) {
        tCtx.fillStyle = terrainColors[terrain] ?? '#cccccc'
        tCtx.beginPath()
        for (const poly of defaultPolys) {
          if (poly.length < 3) continue
          tCtx.moveTo(poly[0][0], poly[0][1])
          for (let i = 1; i < poly.length; i++) tCtx.lineTo(poly[i][0], poly[i][1])
          tCtx.closePath()
        }
        tCtx.fill('evenodd')
      }

      // b. Override passes for this terrain
      for (const [canonicalKey, override] of overridesByTerrain.get(terrain) ?? []) {
        const terrainComponents = blobComponentsByTerrain.get(terrain) ?? blobComponents
        const componentKeySet = new Set<string>()
        for (const [k, ck] of terrainComponents) { if (ck === canonicalKey) componentKeySet.add(k) }

        const ovProjected = projected.map(p => {
          const k = `${p.hex.q},${p.hex.r}`
          const inLayer = hexTerrainLayers(p.hex).includes(terrain)
          if (!inLayer || !componentKeySet.has(k)) return { hex: { ...p.hex, terrain: 'clear' }, verts: p.verts }
          return { ...p, hex: { ...p.hex, terrain } }
        })

        const ovSmooth        = override.smooth         ?? terrainBlobParams.smooth
        const ovOffset        = override.offset         ?? terrainBlobParams.offset
        const ovNoise         = override.bump           ?? terrainBlobParams.bump
        const ovSweepFreq     = override.sweepFreq      ?? terrainBlobParams.sweepFreq
        const ovLobeFreq      = override.lobeFreq       ?? terrainBlobParams.lobeFreq
        const ovLobeAmp       = override.lobeAmp        ?? terrainBlobParams.lobeAmp
        const ovLobeThreshold = override.lobeThreshold  ?? terrainBlobParams.lobeThreshold
        const ovLobeDirection = override.lobeDirection  ?? terrainBlobParams.lobeDirection

        const ovBlobs = buildTerrainBlobsV2(
          ovProjected, ovSmooth, ovOffset, ovNoise,
          ovSweepFreq, ovLobeFreq, ovLobeAmp, ovLobeThreshold, ovLobeDirection, R,
        )
        const ovPolys = ovBlobs.find(b => b.terrain === terrain)?.polys ?? []
        const ovColor = override.color ?? terrainColors[terrain] ?? '#cccccc'

        tCtx.fillStyle = ovColor
        tCtx.beginPath()
        for (const poly of ovPolys) {
          if (poly.length < 3) continue
          tCtx.moveTo(poly[0][0], poly[0][1])
          for (let i = 1; i < poly.length; i++) tCtx.lineTo(poly[i][0], poly[i][1])
          tCtx.closePath()
        }
        tCtx.fill('evenodd')

        const ovTexScale = override.textureScale ?? (terrainTextureScales[terrain] ?? 3)
        if (terrain === 'woods' && forestTexture) {
          applyTextureOverlay(tCtx, forestTexture, ovPolys, R, ovTexScale, R * 0.12)
        } else if (terrain === 'light_woods' && lightWoodsTexture) {
          applyTextureOverlay(tCtx, lightWoodsTexture, ovPolys, R, ovTexScale, R * 0.12)
        } else if (terrain === 'marsh' && marshTexture) {
          applyTextureOverlay(tCtx, marshTexture, ovPolys, R, ovTexScale, R * 0.12)
        }
      }

      // c. Global texture for default polys (no bleed)
      if (terrain === 'woods' && forestTexture) {
        applyTextureOverlay(tCtx, forestTexture, defaultPolys, R, terrainTextureScales['woods'] ?? 3, 0)
      } else if (terrain === 'light_woods' && lightWoodsTexture) {
        applyTextureOverlay(tCtx, lightWoodsTexture, defaultPolys, R, terrainTextureScales['light_woods'] ?? 3, 0)
      } else if (terrain === 'marsh' && marshTexture) {
        applyTextureOverlay(tCtx, marshTexture, defaultPolys, R, terrainTextureScales['marsh'] ?? 3, 0)
      }
    }

    // ── 5. Lakes ──────────────────────────────────────────────────────────────
    const lakeColor = terrainColors['lake'] ?? '#5888b0'

    const drawLakePolys = (polys: [number, number][][], fillColor: string) => {
      tCtx.fillStyle = fillColor
      for (const poly of polys) {
        if (poly.length < 3) continue
        tCtx.beginPath()
        tCtx.moveTo(poly[0][0], poly[0][1])
        for (let i = 1; i < poly.length; i++) tCtx.lineTo(poly[i][0], poly[i][1])
        tCtx.closePath()
        tCtx.fill()
      }
    }

    // Default lake pass
    const lakeBlobPolys = defaultLakeBlobs.find(b => b.terrain === 'lake')?.polys ?? []
    if (lakeBlobPolys.length > 0) drawLakePolys(lakeBlobPolys, lakeColor)

    // Override lake passes
    for (const [canonicalKey, override] of Object.entries(lakeOverrides)) {
      const componentKeySet = new Set<string>()
      for (const [k, ck] of blobComponents) { if (ck === canonicalKey) componentKeySet.add(k) }

      const ovLakeProjected = projected
        .filter(p => (p.hex.isLake ?? false) && componentKeySet.has(`${p.hex.q},${p.hex.r}`))
        .map(p => ({ hex: { ...p.hex, terrain: 'lake' }, verts: p.verts }))
      if (ovLakeProjected.length === 0) continue

      const ovSmooth        = override.smooth         ?? lakeBlobParams.smooth
      const ovOffset        = override.offset         ?? lakeBlobParams.offset
      const ovNoise         = override.bump           ?? lakeBlobParams.bump
      const ovSweepFreq     = override.sweepFreq      ?? lakeBlobParams.sweepFreq
      const ovLobeFreq      = override.lobeFreq       ?? lakeBlobParams.lobeFreq
      const ovLobeAmp       = override.lobeAmp        ?? lakeBlobParams.lobeAmp
      const ovLobeThreshold = override.lobeThreshold  ?? lakeBlobParams.lobeThreshold
      const ovLobeDirection = override.lobeDirection  ?? lakeBlobParams.lobeDirection

      const ovBlobs = buildTerrainBlobsV2(
        ovLakeProjected, ovSmooth, ovOffset, ovNoise,
        ovSweepFreq, ovLobeFreq, ovLobeAmp, ovLobeThreshold, ovLobeDirection, R,
      )
      const ovPolys = ovBlobs.find(b => b.terrain === 'lake')?.polys ?? []
      drawLakePolys(ovPolys, override.color ?? lakeColor)
    }
  } // end blob mode

  // ── 5b. Edge blobs ───────────────────────────────────────────────────────────
  const { edgeBlobPainted, edgeBlobParams, edgeBlobOverrides, hexVertMap } = params
  if (Object.keys(edgeBlobPainted).length > 0) {
    // Build terrain → hex-key set for the connection extension check
    const terrainToHexes = new Map<string, Set<string>>()
    for (const { hex } of projected) {
      for (const t of hexTerrainLayers(hex)) {
        if (!terrainToHexes.has(t)) terrainToHexes.set(t, new Set())
        terrainToHexes.get(t)!.add(`${hex.q},${hex.r}`)
      }
    }

    const chains = findEdgeChains(edgeBlobPainted, hexVertMap)
    for (const chain of chains) {
      const override = edgeBlobOverrides[chain.chainKey]
      const chainParams: EdgeBlobParams = {
        smooth:        override?.smooth         ?? edgeBlobParams.smooth,
        offset:        override?.offset         ?? edgeBlobParams.offset,
        bump:          override?.bump           ?? edgeBlobParams.bump,
        sweepFreq:     override?.sweepFreq      ?? edgeBlobParams.sweepFreq,
        lobeFreq:      override?.lobeFreq       ?? edgeBlobParams.lobeFreq,
        lobeAmp:       override?.lobeAmp        ?? edgeBlobParams.lobeAmp,
        lobeThreshold: override?.lobeThreshold  ?? edgeBlobParams.lobeThreshold,
        lobeDirection: override?.lobeDirection  ?? edgeBlobParams.lobeDirection,
        width:         override?.width          ?? edgeBlobParams.width,
      }
      const hexTerrainSet = terrainToHexes.get(chain.terrain)
      const polys = buildEdgeBlobPolys(chain, hexVertMap, chainParams, R, hexTerrainSet)
      if (polys.length === 0) continue
      const color = override?.color ?? terrainColors[chain.terrain] ?? '#cccccc'
      tCtx.fillStyle = color
      tCtx.beginPath()
      for (const poly of polys) {
        if (poly.length < 3) continue
        tCtx.moveTo(poly[0][0], poly[0][1])
        for (let i = 1; i < poly.length; i++) tCtx.lineTo(poly[i][0], poly[i][1])
        tCtx.closePath()
      }
      tCtx.fill('evenodd')
      const texScale = override?.textureScale ?? (terrainTextureScales[chain.terrain] ?? 3)
      if (chain.terrain === 'woods' && forestTexture) {
        applyTextureOverlay(tCtx, forestTexture, polys, R, texScale, R * 0.12)
      } else if (chain.terrain === 'light_woods' && lightWoodsTexture) {
        applyTextureOverlay(tCtx, lightWoodsTexture, polys, R, texScale, R * 0.12)
      } else if (chain.terrain === 'marsh' && marshTexture) {
        applyTextureOverlay(tCtx, marshTexture, polys, R, texScale, R * 0.12)
      }
    }
  }

  // ── 6. Coastline ────────────────────────────────────────────────────────────
  if (realisticCoastline) {
    const seaColor = terrainColors['sea'] ?? '#3a6898'

    // Layer A — Beach strip
    if (beachStrip && coastlineClips.size > 0) {
      const bw = beachWidth * R * 2
      for (const { hex, verts } of projected) {
        if (!inMargin(verts) && !hex.partial) continue
        const key = `${hex.q},${hex.r}`
        if (!seaCoastKeys.has(key)) continue
        const rings = coastlineClips.get(key)
        if (!rings || rings.length === 0) continue

        tCtx.save()
        tCtx.beginPath()
        for (const ring of rings) {
          if (ring.length < 3) continue
          const smoothed = catmullRom([...ring, ring[0]], 3)
          tCtx.moveTo(smoothed[0][0], smoothed[0][1])
          for (let i = 1; i < smoothed.length; i++) tCtx.lineTo(smoothed[i][0], smoothed[i][1])
          tCtx.closePath()
        }
        tCtx.clip()

        tCtx.strokeStyle = beachColor
        tCtx.lineWidth = bw
        tCtx.lineJoin = 'round'
        tCtx.lineCap = 'round'
        for (const ring of rings) {
          if (ring.length < 3) continue
          for (const run of getCoastlineRuns(ring, verts, 3)) {
            const smoothed = catmullRom(run, 3)
            tCtx.beginPath()
            tCtx.moveTo(smoothed[0][0], smoothed[0][1])
            for (let i = 1; i < smoothed.length; i++) tCtx.lineTo(smoothed[i][0], smoothed[i][1])
            tCtx.stroke()
          }
        }
        tCtx.restore()
      }
    }

    // Layer B — Sea mask (evenodd: hex outline + land clip punches the hole)
    tCtx.fillStyle = seaColor
    tCtx.beginPath()

    // Ocean sea hexes (pure sea connected to coastline)
    for (const { hex, verts } of projected) {
      const key = `${hex.q},${hex.r}`
      if (!oceanSeaKeys.has(key)) continue
      if (!inMargin(verts) && !hex.partial) continue
      tCtx.moveTo(verts[0][0], verts[0][1])
      for (let i = 1; i < verts.length; i++) tCtx.lineTo(verts[i][0], verts[i][1])
      tCtx.closePath()
    }

    // Sea-coast hexes with land clip polygon punched out
    for (const { hex, verts } of projected) {
      if (!inMargin(verts) && !hex.partial) continue
      const key = `${hex.q},${hex.r}`
      if (!seaCoastKeys.has(key)) continue
      const rings = coastlineClips.get(key)
      if (!rings || rings.length === 0) continue
      tCtx.moveTo(verts[0][0], verts[0][1])
      for (let i = 1; i < verts.length; i++) tCtx.lineTo(verts[i][0], verts[i][1])
      tCtx.closePath()
      for (const ring of rings) {
        if (ring.length < 3) continue
        const pts = buildSmoothedRing(ring, verts, 3, 3)
        tCtx.moveTo(pts[0][0], pts[0][1])
        for (let i = 1; i < pts.length; i++) tCtx.lineTo(pts[i][0], pts[i][1])
        tCtx.closePath()
      }
    }

    tCtx.fill('evenodd')
  }
}
