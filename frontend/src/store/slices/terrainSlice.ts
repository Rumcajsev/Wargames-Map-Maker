import type {
  MapStore, GeneratedHex, GridMetadata, GenerateProgress, BlobOverride,
  ActiveTool,
} from '../mapStore'
import {
  DEFAULT_THRESHOLDS,
  combinedDimsMm, mapResolutionMpx,
} from '../mapStore'
import { classifyHex, classifyHexLayers } from '../../lib/terrainClassify'

export type TerrainSlice = {
  generatedHexes: GeneratedHex[]
  generatedMetadata: GridMetadata | null
  generateStatus: 'idle' | 'loading' | 'error' | 'done'
  generateError: string | null
  thresholds: Record<string, number>
  disabledTerrains: Set<string>
  generateProgress: GenerateProgress | null
  terrainLayersEnabled: boolean
  // Terrain blob style
  terrainBlobSmooth: number
  terrainBlobOffset: number
  terrainBlobBump: number
  terrainBlobSweepFreq: number
  terrainBlobLobeFreq: number
  terrainBlobLobeAmp: number
  terrainBlobLobeThreshold: number
  terrainBlobLobeDirection: number
  realisticCoastline: boolean
  beachStrip: boolean
  beachColor: string
  beachWidth: number
  terrainColors: Record<string, string>
  terrainTextureScales: Record<string, number>
  terrainBlobOverrides: Record<string, BlobOverride>
  terrainTypeBlobStyles: Record<string, BlobOverride>
  // Terrain render mode
  terrainRenderMode: 'blob' | 'field'
  fieldFreq: number
  fieldAmp: number
  fieldOctaves: number
  fieldPersistence: number
  fieldWildness: Record<string, number>
  // Terrain paint
  terrainPaintMode: boolean
  terrainPaintBrush: string
  // Edge blob paint + state
  edgeBlobPaintMode: boolean
  edgeBlobPaintBrush: string
  edgeBlobPainted: Record<string, string>
  edgeBlobSmooth: number
  edgeBlobOffset: number
  edgeBlobBump: number
  edgeBlobSweepFreq: number
  edgeBlobLobeFreq: number
  edgeBlobLobeAmp: number
  edgeBlobLobeThreshold: number
  edgeBlobLobeDirection: number
  edgeBlobWidth: number
  edgeBlobOverrides: Record<string, BlobOverride>
  // Blank map
  blankMap: boolean
  setBlankMap: (v: boolean) => void
  // Lake state
  autoLakesEnabled: boolean
  lakeSensitivity: number
  lakePaintMode: boolean
  lakeBlobSmooth: number
  lakeBlobOffset: number
  lakeBlobBump: number
  lakeBlobSweepFreq: number
  lakeBlobLobeFreq: number
  lakeBlobLobeAmp: number
  lakeBlobLobeThreshold: number
  lakeBlobLobeDirection: number
  lakeOverrides: Record<string, BlobOverride>
  // Actions
  resetToSetup: () => void
  generateMap: () => Promise<void>
  setTerrainThreshold: (terrain: string, v: number) => void
  setGenerateProgress: (p: GenerateProgress | null) => void
  reclassify: () => void
  toggleTerrainDisabled: (terrain: string) => void
  overrideHexTerrain: (q: number, r: number, terrain: string) => void
  addHexTerrainLayer: (q: number, r: number, terrain: string) => void
  removeHexTerrainLayer: (q: number, r: number, terrain: string) => void
  resetHexOverride: (q: number, r: number) => void
  setTerrainLayersEnabled: (v: boolean) => void
  setTerrainBlobSmooth: (v: number) => void
  setTerrainBlobOffset: (v: number) => void
  setTerrainBlobBump: (v: number) => void
  setTerrainBlobSweepFreq: (v: number) => void
  setTerrainBlobLobeFreq: (v: number) => void
  setTerrainBlobLobeAmp: (v: number) => void
  setTerrainBlobLobeThreshold: (v: number) => void
  setTerrainBlobLobeDirection: (v: number) => void
  setRealisticCoastline: (v: boolean) => void
  setBeachStrip: (v: boolean) => void
  setBeachColor: (v: string) => void
  setBeachWidth: (v: number) => void
  setTerrainColor: (terrain: string, color: string) => void
  setTerrainTextureScale: (terrain: string, scale: number) => void
  setTerrainBlobOverride: (key: string, override: BlobOverride | null) => void
  setTerrainTypeBlobStyle: (terrain: string, style: BlobOverride | null) => void
  setTerrainRenderMode: (v: 'blob' | 'field') => void
  setFieldFreq: (v: number) => void
  setFieldAmp: (v: number) => void
  setFieldOctaves: (v: number) => void
  setFieldPersistence: (v: number) => void
  setFieldWildness: (terrain: string, v: number) => void
  setTerrainPaintMode: (v: boolean) => void
  setTerrainPaintBrush: (v: string) => void
  setEdgeBlobPaintMode: (v: boolean) => void
  setEdgeBlobPaintBrush: (v: string) => void
  paintEdgeBlob: (edgeKey: string, terrain: string) => void
  eraseEdgeBlob: (edgeKey: string) => void
  setEdgeBlobSmooth: (v: number) => void
  setEdgeBlobOffset: (v: number) => void
  setEdgeBlobBump: (v: number) => void
  setEdgeBlobSweepFreq: (v: number) => void
  setEdgeBlobLobeFreq: (v: number) => void
  setEdgeBlobLobeAmp: (v: number) => void
  setEdgeBlobLobeThreshold: (v: number) => void
  setEdgeBlobLobeDirection: (v: number) => void
  setEdgeBlobWidth: (v: number) => void
  setEdgeBlobOverride: (key: string, override: BlobOverride | null) => void
  setAutoLakesEnabled: (v: boolean) => void
  setLakeSensitivity: (v: number) => void
  setLakePaintMode: (v: boolean) => void
  overrideHexLake: (q: number, r: number, isLake: boolean) => void
  setLakeBlobSmooth: (v: number) => void
  setLakeBlobOffset: (v: number) => void
  setLakeBlobBump: (v: number) => void
  setLakeBlobSweepFreq: (v: number) => void
  setLakeBlobLobeFreq: (v: number) => void
  setLakeBlobLobeAmp: (v: number) => void
  setLakeBlobLobeThreshold: (v: number) => void
  setLakeBlobLobeDirection: (v: number) => void
  setLakeOverride: (key: string, override: BlobOverride | null) => void
}

import { TERRAIN_COLORS } from '../mapStore'

type Set = (partial: Partial<MapStore> | ((s: MapStore) => Partial<MapStore>)) => void

export const createTerrainSlice = (set: Set, get: () => MapStore): TerrainSlice => ({
  generatedHexes: [],
  generatedMetadata: null,
  generateStatus: 'idle',
  generateError: null,
  thresholds: { ...DEFAULT_THRESHOLDS },
  disabledTerrains: new Set<string>(),
  generateProgress: null,
  terrainLayersEnabled: true,

  terrainBlobSmooth: 0,
  terrainBlobOffset: -0.10,
  terrainBlobBump: 0.47,
  terrainBlobSweepFreq: 1.0,
  terrainBlobLobeFreq: 4.1,
  terrainBlobLobeAmp: 0.49,
  terrainBlobLobeThreshold: 0.08,
  terrainBlobLobeDirection: -1,
  realisticCoastline: false,
  beachStrip: false,
  beachColor: '#e4d5a0',
  beachWidth: 0.06,
  terrainColors: { ...TERRAIN_COLORS },
  terrainTextureScales: { clear: 3, woods: 3, light_woods: 3 },
  terrainBlobOverrides: {},
  terrainTypeBlobStyles: {},

  terrainRenderMode: 'blob',
  fieldFreq: 0.3,
  fieldAmp: 0.8,
  fieldOctaves: 3,
  fieldPersistence: 0.5,
  fieldWildness: {},

  terrainPaintMode: false,
  terrainPaintBrush: 'clear',

  edgeBlobPaintMode: false,
  edgeBlobPaintBrush: 'woods',
  edgeBlobPainted: {},
  edgeBlobSmooth: 0,
  edgeBlobOffset: -0.10,
  edgeBlobBump: 0.47,
  edgeBlobSweepFreq: 1.0,
  edgeBlobLobeFreq: 4.1,
  edgeBlobLobeAmp: 0.49,
  edgeBlobLobeThreshold: 0.08,
  edgeBlobLobeDirection: -1,
  edgeBlobWidth: 0.25,
  edgeBlobOverrides: {},

  blankMap: false,

  setBlankMap: (v) => set({ blankMap: v }),

  autoLakesEnabled: false,
  lakeSensitivity: 0.4,
  lakePaintMode: false,
  lakeBlobSmooth: 2,
  lakeBlobOffset: -0.15,
  lakeBlobBump: 0.15,
  lakeBlobSweepFreq: 0.6,
  lakeBlobLobeFreq: 2.8,
  lakeBlobLobeAmp: 0.4,
  lakeBlobLobeThreshold: 0.20,
  lakeBlobLobeDirection: 1,
  lakeOverrides: {},

  resetToSetup: () => set({
    step: 'setup',
    generatedHexes: [],
    generatedMetadata: null,
    generateStatus: 'idle',
    generateError: null,
    generateProgress: null,
    settlements: [],
    settlementsStatus: 'idle',
    settlementsError: null,
    showSettlementLabels: true,
    settlementLabelFont: 'classic',
    settlementLabelColor: '#1a1008',
    settlementLabelSizeScale: 1.0,
    settlementLabelOverrides: {},
    settlementEditMode: false,
    settlementPlaceTarget: null,
    settlementMoveIndex: null,
    settlementPlaceTier: null,
    rawRoadWays: [],
    roadEdges: [],
    roadsDisplayMode: 'per_hex',
    roadsVisibleTiers: [true, true, true],
    roadsStatus: 'idle',
    roadsError: null,
    rawRailWays: [],
    railEdges: [],
    railsStatus: 'idle',
    railsError: null,
    railPaintMode: false,
    railPaintEraser: false,
    activeTool: { type: 'none' } as ActiveTool,
    riverEdges: [],
    riverEditMode: false,
    elevationStatus: 'idle',
    elevationError: null,
    elevationProgress: null,
    showReliefHeatmap: false,
    showElevHeatmap: false,
    terrainPaintMode: false,
    edgeBlobPaintMode: false,
    lakePaintMode: false,
    elevationPaintMode: false,
    roadPaintMode: false,
    roadPaintEraser: false,
    highlightedHexes: {},
    highlightLines: {},
    highlightEdgePaths: {},
    highlightPaintMode: false,
    highlightLineEraser: false,
    activePanel: 'terrain',
  }),

  generateMap: async () => {
    const { paperSize, orientation, mapMode, diptychJoin, hexSizeMm, hexOrientation, marginMm, bearing, center, zoom, framePixelWidth, realisticCoastline } = get()
    if (framePixelWidth === 0) return

    const [cwMm, chMm] = combinedDimsMm(paperSize, orientation, mapMode, diptychJoin)
    const res = mapResolutionMpx(center[1], zoom)
    const widthM = framePixelWidth * res
    const heightM = widthM * (chMm / cwMm)

    set({ generateStatus: 'loading', generateError: null, generateProgress: null, generatedHexes: [], generatedMetadata: null })

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
      paper_width_mm: String(cwMm),
      paper_height_mm: String(chMm),
    })

    try {
      const resp = await fetch(`/api/generate/terrain-stream?${params.toString()}`)
      if (!resp.ok) throw new Error(await resp.text())
      if (!resp.body) throw new Error('No response body')

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let shouldStop = false

      while (!shouldStop) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (shouldStop) break
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr) continue
          let event: Record<string, unknown>
          try { event = JSON.parse(jsonStr) } catch { continue }

          const step = event.step as string
          const message = event.message as string
          const progress = event.progress as number

          if (step === 'done') {
            const { thresholds, disabledTerrains, autoLakesEnabled, lakeSensitivity } = get()
            const rawHexes = event.hexes as (GeneratedHex & { is_lake?: boolean })[]
            const reclassified = rawHexes.map((h) => {
              const terrain = classifyHex(h.coverage ?? {}, thresholds, disabledTerrains)
              return {
                ...h,
                lakeManualOverride: false,
                isLake: autoLakesEnabled && (h.coverage?.lake ?? 0) >= lakeSensitivity,
                terrain,
                terrains: classifyHexLayers(h.coverage ?? {}, thresholds, disabledTerrains),
              }
            })
            set({
              step: 'terrain',
              generateStatus: 'done',
              generatedHexes: reclassified,
              generatedMetadata: event.metadata as GridMetadata,
              generateProgress: null,
              highlightedHexes: {},
              highlightLines: {},
              highlightEdgePaths: {},
              highlightPaintMode: false,
            })
          } else if (step === 'grid' && Array.isArray(event.hexes)) {
            const raw = event.hexes as Array<{ q: number; r: number; center: [number, number]; vertices: [number, number][]; partial: boolean }>
            const placeholder: GeneratedHex[] = raw.map((h) => ({
              ...h,
              terrain: 'clear',
              terrains: [],
              coverage: {},
              isLake: false,
              lakeManualOverride: false,
              elevation_m: null,
              elevation_relief_m: null,
              elevation_class: null,
              coastline_clip: null,
            }))
            if (get().blankMap) {
              set({
                step: 'terrain',
                generatedMetadata: event.metadata as GridMetadata,
                generatedHexes: placeholder,
                generateStatus: 'done',
                generateProgress: null,
                highlightedHexes: {},
                highlightLines: {},
                highlightEdgePaths: {},
                highlightPaintMode: false,
              })
              reader.cancel()
              shouldStop = true
              break
            }
            set({
              step: 'terrain',
              generatedMetadata: event.metadata as GridMetadata,
              generatedHexes: placeholder,
              generateProgress: { step, message, progress },
              highlightedHexes: {},
              highlightLines: {},
              highlightEdgePaths: {},
              highlightPaintMode: false,
            })
          } else if (step === 'classify' && Array.isArray(event.hexes)) {
            const { thresholds, disabledTerrains, autoLakesEnabled, lakeSensitivity, generatedHexes: prev } = get()
            const rawHexes = event.hexes as (GeneratedHex & { is_lake?: boolean })[]
            const updates = new Map(rawHexes.map((h) => {
              const terrain = classifyHex(h.coverage ?? {}, thresholds, disabledTerrains)
              return [`${h.q},${h.r}`, {
                ...h,
                lakeManualOverride: false,
                isLake: autoLakesEnabled && (h.coverage?.lake ?? 0) >= lakeSensitivity,
                terrain,
                terrains: classifyHexLayers(h.coverage ?? {}, thresholds, disabledTerrains),
              }]
            }))
            set({
              generateProgress: { step, message, progress },
              generatedHexes: prev.map((h) => updates.get(`${h.q},${h.r}`) ?? h),
            })
          } else if (step === 'error') {
            set({ generateStatus: 'error', generateError: message, generateProgress: null })
          } else {
            set({ generateProgress: { step, message, progress } })
          }
        }
      }
    } catch (e) {
      set({ generateStatus: 'error', generateError: String(e), generateProgress: null })
    }
  },

  setGenerateProgress: (p) => set({ generateProgress: p }),

  setTerrainThreshold: (terrain, v) => {
    const { thresholds, generatedHexes, disabledTerrains } = get()
    const next = { ...thresholds, [terrain]: v }
    const updated = generatedHexes.map((h) => {
      if (h.manual_override) return h
      const t = classifyHex(h.coverage ?? {}, next, disabledTerrains)
      return { ...h, terrain: t, terrains: classifyHexLayers(h.coverage ?? {}, next, disabledTerrains) }
    })
    set({ thresholds: next, generatedHexes: updated })
  },

  reclassify: () => {
    const { generatedHexes, thresholds, disabledTerrains } = get()
    if (generatedHexes.length === 0) return
    const updated = generatedHexes.map((h) => {
      if (h.manual_override) return h
      const t = classifyHex(h.coverage ?? {}, thresholds, disabledTerrains)
      return { ...h, terrain: t, terrains: classifyHexLayers(h.coverage ?? {}, thresholds, disabledTerrains) }
    })
    set({ generatedHexes: updated })
  },

  toggleTerrainDisabled: (terrain) => {
    const { disabledTerrains, generatedHexes, thresholds } = get()
    const next = new Set(disabledTerrains)
    if (next.has(terrain)) next.delete(terrain)
    else next.add(terrain)
    const updated = generatedHexes.map((h) => {
      if (h.manual_override) return h
      const t = classifyHex(h.coverage ?? {}, thresholds, next)
      return { ...h, terrain: t, terrains: classifyHexLayers(h.coverage ?? {}, thresholds, next) }
    })
    set({ disabledTerrains: next, generatedHexes: updated })
  },

  overrideHexTerrain: (q, r, terrain) => {
    const { generatedHexes } = get()
    const terrains = terrain === 'clear' ? [] : [terrain]
    const updated = generatedHexes.map((h) =>
      h.q === q && h.r === r ? { ...h, terrain, terrains, manual_override: true } : h
    )
    set({ generatedHexes: updated })
  },

  addHexTerrainLayer: (q, r, terrain) => {
    if (terrain === 'clear') return
    const { generatedHexes } = get()
    const updated = generatedHexes.map((h) => {
      if (h.q !== q || h.r !== r) return h
      const layers = h.terrains ?? (h.terrain === 'clear' ? [] : [h.terrain])
      if (layers.includes(terrain)) return h
      return { ...h, terrains: [...layers, terrain], manual_override: true }
    })
    set({ generatedHexes: updated })
  },

  removeHexTerrainLayer: (q, r, terrain) => {
    const { generatedHexes } = get()
    const updated = generatedHexes.map((h) => {
      if (h.q !== q || h.r !== r) return h
      const layers = h.terrains ?? (h.terrain === 'clear' ? [] : [h.terrain])
      const next = layers.filter(t => t !== terrain)
      return { ...h, terrains: next, manual_override: true }
    })
    set({ generatedHexes: updated })
  },

  setTerrainLayersEnabled: (v) => set({ terrainLayersEnabled: v }),

  resetHexOverride: (q, r) => {
    get().pushUndoSnapshot()
    const { generatedHexes, thresholds, disabledTerrains } = get()
    const hex = generatedHexes.find((h) => h.q === q && h.r === r)
    if (!hex) return
    const terrain = classifyHex(hex.coverage ?? {}, thresholds, disabledTerrains)
    const terrains = classifyHexLayers(hex.coverage ?? {}, thresholds, disabledTerrains)
    const updated = generatedHexes.map((h) =>
      h.q === q && h.r === r ? { ...h, terrain, terrains, manual_override: false } : h
    )
    set({ generatedHexes: updated })
  },

  setTerrainBlobSmooth: (v) => set({ terrainBlobSmooth: v }),
  setTerrainBlobOffset: (v) => set({ terrainBlobOffset: v }),
  setTerrainBlobBump: (v) => set({ terrainBlobBump: v }),
  setTerrainBlobSweepFreq: (v) => set({ terrainBlobSweepFreq: v }),
  setTerrainBlobLobeFreq: (v) => set({ terrainBlobLobeFreq: v }),
  setTerrainBlobLobeAmp: (v) => set({ terrainBlobLobeAmp: v }),
  setTerrainBlobLobeThreshold: (v) => set({ terrainBlobLobeThreshold: v }),
  setTerrainBlobLobeDirection: (v) => set({ terrainBlobLobeDirection: v }),
  setRealisticCoastline: (v) => set({ realisticCoastline: v }),
  setBeachStrip: (v) => set({ beachStrip: v }),
  setBeachColor: (v) => set({ beachColor: v }),
  setBeachWidth: (v) => set({ beachWidth: v }),
  setTerrainColor: (terrain, color) => set((s) => ({ terrainColors: { ...s.terrainColors, [terrain]: color } })),
  setTerrainTextureScale: (terrain, scale) => set((s) => ({ terrainTextureScales: { ...s.terrainTextureScales, [terrain]: scale } })),

  setTerrainBlobOverride: (key, override) => set((s) => {
    if (override === null) {
      const { [key]: _, ...rest } = s.terrainBlobOverrides
      return { terrainBlobOverrides: rest }
    }
    const merged = { ...s.terrainBlobOverrides[key], ...override }
    const cleaned = Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined)) as BlobOverride
    if (Object.keys(cleaned).length === 0) {
      const { [key]: _, ...rest } = s.terrainBlobOverrides
      return { terrainBlobOverrides: rest }
    }
    return { terrainBlobOverrides: { ...s.terrainBlobOverrides, [key]: cleaned } }
  }),

  setTerrainTypeBlobStyle: (terrain, style) => set((s) => {
    if (style === null) {
      const { [terrain]: _, ...rest } = s.terrainTypeBlobStyles
      return { terrainTypeBlobStyles: rest }
    }
    return { terrainTypeBlobStyles: { ...s.terrainTypeBlobStyles, [terrain]: { ...s.terrainTypeBlobStyles[terrain], ...style } } }
  }),

  setTerrainRenderMode: (v) => set({ terrainRenderMode: v }),
  setFieldFreq: (v) => set({ fieldFreq: v }),
  setFieldAmp: (v) => set({ fieldAmp: v }),
  setFieldOctaves: (v) => set({ fieldOctaves: v }),
  setFieldPersistence: (v) => set({ fieldPersistence: v }),
  setFieldWildness: (terrain, v) => set((s) => ({ fieldWildness: { ...s.fieldWildness, [terrain]: v } })),

  setTerrainPaintMode: (v) => set({ terrainPaintMode: v, ...(v ? { roadPaintMode: false, elevationPaintMode: false, railPaintMode: false, lakePaintMode: false, edgeBlobPaintMode: false } : {}) }),
  setTerrainPaintBrush: (v) => set({ terrainPaintBrush: v }),

  setEdgeBlobPaintMode: (v) => set({ edgeBlobPaintMode: v, ...(v ? { terrainPaintMode: false, roadPaintMode: false, elevationPaintMode: false, railPaintMode: false, lakePaintMode: false } : {}) }),
  setEdgeBlobPaintBrush: (v) => set({ edgeBlobPaintBrush: v }),
  paintEdgeBlob: (edgeKey, terrain) => set((s) => ({
    edgeBlobPainted: { ...s.edgeBlobPainted, [edgeKey]: terrain },
  })),
  eraseEdgeBlob: (edgeKey) => set((s) => {
    const { [edgeKey]: _, ...rest } = s.edgeBlobPainted
    return { edgeBlobPainted: rest }
  }),
  setEdgeBlobSmooth: (v) => set({ edgeBlobSmooth: v }),
  setEdgeBlobOffset: (v) => set({ edgeBlobOffset: v }),
  setEdgeBlobBump: (v) => set({ edgeBlobBump: v }),
  setEdgeBlobSweepFreq: (v) => set({ edgeBlobSweepFreq: v }),
  setEdgeBlobLobeFreq: (v) => set({ edgeBlobLobeFreq: v }),
  setEdgeBlobLobeAmp: (v) => set({ edgeBlobLobeAmp: v }),
  setEdgeBlobLobeThreshold: (v) => set({ edgeBlobLobeThreshold: v }),
  setEdgeBlobLobeDirection: (v) => set({ edgeBlobLobeDirection: v }),
  setEdgeBlobWidth: (v) => set({ edgeBlobWidth: v }),
  setEdgeBlobOverride: (key, override) => set((s) => {
    if (override === null) {
      const { [key]: _, ...rest } = s.edgeBlobOverrides
      return { edgeBlobOverrides: rest }
    }
    const merged = { ...s.edgeBlobOverrides[key], ...override }
    const cleaned = Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined)) as BlobOverride
    if (Object.keys(cleaned).length === 0) {
      const { [key]: _, ...rest } = s.edgeBlobOverrides
      return { edgeBlobOverrides: rest }
    }
    return { edgeBlobOverrides: { ...s.edgeBlobOverrides, [key]: cleaned } }
  }),

  setLakePaintMode: (v) => set({ lakePaintMode: v, ...(v ? { terrainPaintMode: false, roadPaintMode: false, elevationPaintMode: false, railPaintMode: false, edgeBlobPaintMode: false } : {}) }),
  setAutoLakesEnabled: (v) => {
    const { generatedHexes, lakeSensitivity } = get()
    const updated = generatedHexes.map((h) =>
      h.lakeManualOverride ? h : { ...h, isLake: v && (h.coverage?.lake ?? 0) >= lakeSensitivity }
    )
    set({ autoLakesEnabled: v, generatedHexes: updated })
  },
  setLakeSensitivity: (v) => {
    const { generatedHexes, autoLakesEnabled } = get()
    const updated = generatedHexes.map((h) =>
      h.lakeManualOverride ? h : { ...h, isLake: autoLakesEnabled && (h.coverage?.lake ?? 0) >= v }
    )
    set({ lakeSensitivity: v, generatedHexes: updated })
  },
  overrideHexLake: (q, r, isLake) => {
    get().pushUndoSnapshot()
    const { generatedHexes } = get()
    const updated = generatedHexes.map((h) => h.q === q && h.r === r ? { ...h, isLake, lakeManualOverride: isLake } : h)
    set({ generatedHexes: updated })
  },
  setLakeBlobSmooth: (v) => set({ lakeBlobSmooth: v }),
  setLakeBlobOffset: (v) => set({ lakeBlobOffset: v }),
  setLakeBlobBump: (v) => set({ lakeBlobBump: v }),
  setLakeBlobSweepFreq: (v) => set({ lakeBlobSweepFreq: v }),
  setLakeBlobLobeFreq: (v) => set({ lakeBlobLobeFreq: v }),
  setLakeBlobLobeAmp: (v) => set({ lakeBlobLobeAmp: v }),
  setLakeBlobLobeThreshold: (v) => set({ lakeBlobLobeThreshold: v }),
  setLakeBlobLobeDirection: (v) => set({ lakeBlobLobeDirection: v }),
  setLakeOverride: (key, override) => set((s) => {
    if (override === null) {
      const { [key]: _, ...rest } = s.lakeOverrides
      return { lakeOverrides: rest }
    }
    const merged = { ...s.lakeOverrides[key], ...override }
    const cleaned = Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined)) as BlobOverride
    if (Object.keys(cleaned).length === 0) {
      const { [key]: _, ...rest } = s.lakeOverrides
      return { lakeOverrides: rest }
    }
    return { lakeOverrides: { ...s.lakeOverrides, [key]: cleaned } }
  }),
})
