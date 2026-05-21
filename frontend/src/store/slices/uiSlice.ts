import type { MapStore, ActiveTool, UrbanStyle, RoadEdge } from '../mapStore'
import { DEFAULT_URBAN_STYLE } from '../mapStore'

export type UiSlice = {
  activePanel: 'terrain' | 'display' | 'roads' | 'settlements' | 'rivers' | 'style' | 'highlights'
  activeTool: ActiveTool
  urbanHexes: Array<{ q: number; r: number }>
  urbanStyle: UrbanStyle
  urbanPaintMode: 'paint' | 'erase' | null
  hexBorderMode: 'full' | 'stubs' | 'none'
  hexNumbersEnabled: boolean
  hexNumberStartCorner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  hexNumberEdge: number
  hexNumberColor: string
  hexNumberFontScale: number
  terrainDisplacement: number
  terrainNoiseFrequency: number
  terrainNoiseSeed: number
  terrainNoiseOctaves: number
  illustratedStyle: boolean
  showPaperTexture: boolean
  paperTextureOpacity: number
  showPaperVignette: boolean
  woodsHexStyle: 'default' | 'blob'
  blobSize: number
  blobCount: number
  showBridges: boolean
  urbanDisplayMode: 'plain' | 'polygon' | 'buildings'
  urbanScale: number
  urbanVertexRatio: number
  urbanNoise: number
  urbanBuildingCount: number
  urbanBuildingSize: number
  mapBgColor: string
  mapBorderEnabled: boolean
  mapBorderColor: string
  mapBorderWidth: number
  clipToHexGrid: boolean
  excludedHexKeys: string[]
  setActivePanel: (panel: 'terrain' | 'display' | 'roads' | 'settlements' | 'rivers' | 'style') => void
  setActiveTool: (tool: ActiveTool) => void
  toggleUrbanHex: (q: number, r: number) => void
  setUrbanStyle: (style: Partial<UrbanStyle>) => void
  setUrbanPaintMode: (mode: 'paint' | 'erase' | null) => void
  setHexBorderMode: (v: 'full' | 'stubs' | 'none') => void
  setHexNumbersEnabled: (v: boolean) => void
  setHexNumberStartCorner: (v: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => void
  setHexNumberEdge: (v: number) => void
  setHexNumberColor: (v: string) => void
  setHexNumberFontScale: (v: number) => void
  setTerrainDisplacement: (v: number) => void
  setTerrainNoiseFrequency: (v: number) => void
  setTerrainNoiseSeed: (v: number) => void
  setTerrainNoiseOctaves: (v: number) => void
  setIllustratedStyle: (v: boolean) => void
  setShowPaperTexture: (v: boolean) => void
  setPaperTextureOpacity: (v: number) => void
  setShowPaperVignette: (v: boolean) => void
  setWoodsHexStyle: (style: 'default' | 'blob') => void
  setBlobSize: (v: number) => void
  setBlobCount: (v: number) => void
  setShowBridges: (v: boolean) => void
  setUrbanDisplayMode: (mode: 'plain' | 'polygon' | 'buildings') => void
  setUrbanScale: (v: number) => void
  setUrbanVertexRatio: (v: number) => void
  setUrbanNoise: (v: number) => void
  setUrbanBuildingCount: (v: number) => void
  setUrbanBuildingSize: (v: number) => void
  setMapBgColor: (v: string) => void
  setMapBorderEnabled: (v: boolean) => void
  setMapBorderColor: (v: string) => void
  setMapBorderWidth: (v: number) => void
  setClipToHexGrid: (v: boolean) => void
  toggleExcludedHex: (key: string, mode: 'exclude' | 'include') => void
  resetExcludedHexes: () => void
  applyMapPreset: (preset: 'default') => void
  saveProject: () => void
  restoreProject: (data: unknown) => void
}

type Set = (partial: Partial<MapStore> | ((s: MapStore) => Partial<MapStore>)) => void

export const createUiSlice = (set: Set, get: () => MapStore): UiSlice => ({
  activePanel: 'terrain',
  activeTool: { type: 'none' },
  urbanHexes: [],
  urbanStyle: { ...DEFAULT_URBAN_STYLE },
  urbanPaintMode: null,
  hexBorderMode: 'full',
  hexNumbersEnabled: false,
  hexNumberStartCorner: 'top-left',
  hexNumberEdge: 4,
  hexNumberColor: '#8a8a8a',
  hexNumberFontScale: 1.0,
  terrainDisplacement: 18,
  terrainNoiseFrequency: 6,
  terrainNoiseSeed: 2,
  terrainNoiseOctaves: 3,
  illustratedStyle: false,
  showPaperTexture: false,
  paperTextureOpacity: 0.35,
  showPaperVignette: false,
  woodsHexStyle: 'default',
  blobSize: 0.18,
  blobCount: 7,
  showBridges: false,
  urbanDisplayMode: 'polygon',
  urbanScale: 0.72,
  urbanVertexRatio: 0.75,
  urbanNoise: 0.12,
  urbanBuildingCount: 8,
  urbanBuildingSize: 0.12,
  mapBgColor: '#ffffff',
  mapBorderEnabled: false,
  mapBorderColor: '#000000',
  mapBorderWidth: 1.5,
  clipToHexGrid: false,
  excludedHexKeys: [],

  setActivePanel: (panel) => {
    get().setActiveTool({ type: 'none' })
    set({ activePanel: panel, settlementEditMode: false })
  },

  setActiveTool: (tool) => {
    const updates: Partial<MapStore> = { activeTool: tool }

    updates.terrainPaintMode = tool.type === 'terrain'
    if (tool.type === 'terrain') updates.terrainPaintBrush = tool.brush

    updates.elevationPaintMode = tool.type === 'elevation'
    if (tool.type === 'elevation') updates.elevationPaintBrush = tool.brush

    updates.lakePaintMode = tool.type === 'lake'

    updates.roadPaintMode = tool.type === 'road'
    if (tool.type === 'road') {
      updates.roadPaintBrush = tool.tier
      updates.roadPaintEraser = tool.erasing
      updates.roadsDisplayMode = 'per_hex'
    } else {
      updates.roadPaintEraser = false
    }

    updates.railPaintMode = tool.type === 'rail'
    if (tool.type === 'rail') {
      updates.railPaintEraser = tool.erasing
      updates.railsDisplayMode = 'per_hex'
    } else {
      updates.railPaintEraser = false
    }

    updates.roadNodeEditMode = tool.type === 'node-edit'
    updates.riverNodeEditMode = tool.type === 'river-node-edit'
    updates.railNodeEditMode = tool.type === 'rail-node-edit'

    updates.roadSelectMode = tool.type === 'road-select'
    if (!updates.roadPaintMode && !updates.roadSelectMode) {
      updates.selectedRoadSegmentKeys = []
      updates.selectedRoadHopKey = null
    }

    updates.railSelectMode = tool.type === 'rail-select'
    if (!updates.railSelectMode) {
      updates.selectedRailSegmentKeys = []
      updates.selectedRailHopKey = null
    }

    updates.riverEditMode = tool.type === 'river-paint' || tool.type === 'river-select'
    updates.riverSelectMode = tool.type === 'river-select'
    if (!updates.riverEditMode) { updates.selectedSegmentKeys = []; updates.selectedHopKey = null }

    updates.canalEditMode = tool.type === 'canal-paint' || tool.type === 'canal-select'
    updates.canalSelectMode = tool.type === 'canal-select'
    if (!updates.canalEditMode) updates.selectedCanalSegmentKeys = []

    updates.highlightPaintMode = tool.type === 'highlight-paint'
    updates.highlightLineEraser = tool.type === 'highlight-erase' || tool.type === 'highlight-erase-any'
    if (tool.type === 'highlight-paint' || tool.type === 'highlight-erase') {
      updates.activeHighlightId = tool.id
    }
    if (tool.type === 'highlight-erase-any') {
      updates.activeHighlightId = null
    }

    updates.iconPlaceMode = tool.type === 'icon-place'
    updates.iconEraseMode = tool.type === 'icon-erase' || tool.type === 'icon-erase-any'
    if (tool.type === 'icon-place' || tool.type === 'icon-erase') {
      updates.activeIconOverlayId = tool.id
    }
    if (tool.type === 'icon-erase-any') {
      updates.activeIconOverlayId = null
    }

    if (tool.type === 'label-place' || tool.type === 'label-erase') {
      updates.activeLabelOverlayId = tool.id
    }
    if (tool.type !== 'label-place' && tool.type !== 'label-erase') {
      // only clear when switching away from label tools
      if (get().activeTool.type === 'label-place' || get().activeTool.type === 'label-erase') {
        updates.activeLabelOverlayId = null
      }
    }

    updates.urbanPaintMode = tool.type === 'urban' ? tool.mode : null

    set(updates as Partial<MapStore>)
  },

  toggleUrbanHex: (q, r) => {
    const { urbanHexes, urbanPaintMode } = get()
    if (urbanPaintMode === 'erase') {
      set({ urbanHexes: urbanHexes.filter(h => !(h.q === q && h.r === r)) })
    } else {
      if (urbanHexes.some(h => h.q === q && h.r === r)) return
      set({ urbanHexes: [...urbanHexes, { q, r }] })
    }
  },
  setUrbanStyle: (style) => set(s => ({ urbanStyle: { ...s.urbanStyle, ...style } })),
  setUrbanPaintMode: (mode) => set({ urbanPaintMode: mode }),

  setHexBorderMode: (v) => set({ hexBorderMode: v }),
  setHexNumbersEnabled: (v) => set({ hexNumbersEnabled: v }),
  setHexNumberStartCorner: (v) => set({ hexNumberStartCorner: v }),
  setHexNumberEdge: (v) => set({ hexNumberEdge: v }),
  setHexNumberColor: (v) => set({ hexNumberColor: v }),
  setHexNumberFontScale: (v) => set({ hexNumberFontScale: v }),
  setTerrainDisplacement: (v) => set({ terrainDisplacement: v }),
  setTerrainNoiseFrequency: (v) => set({ terrainNoiseFrequency: v }),
  setTerrainNoiseSeed: (v) => set({ terrainNoiseSeed: v }),
  setTerrainNoiseOctaves: (v) => set({ terrainNoiseOctaves: v }),
  setIllustratedStyle: (v) => set({ illustratedStyle: v }),
  setShowPaperTexture: (v) => set({ showPaperTexture: v }),
  setPaperTextureOpacity: (v) => set({ paperTextureOpacity: v }),
  setShowPaperVignette: (v) => set({ showPaperVignette: v }),
  setWoodsHexStyle: (style) => set({ woodsHexStyle: style }),
  setBlobSize: (v) => set({ blobSize: v }),
  setBlobCount: (v) => set({ blobCount: v }),
  setShowBridges: (v) => set({ showBridges: v }),
  setUrbanDisplayMode: (mode) => set({ urbanDisplayMode: mode }),
  setUrbanScale: (v) => set({ urbanScale: v }),
  setUrbanVertexRatio: (v) => set({ urbanVertexRatio: v }),
  setUrbanNoise: (v) => set({ urbanNoise: v }),
  setUrbanBuildingCount: (v) => set({ urbanBuildingCount: v }),
  setUrbanBuildingSize: (v) => set({ urbanBuildingSize: v }),
  setMapBgColor: (v) => set({ mapBgColor: v }),
  setMapBorderEnabled: (v) => set({ mapBorderEnabled: v }),
  setMapBorderColor: (v) => set({ mapBorderColor: v }),
  setMapBorderWidth: (v) => set({ mapBorderWidth: v }),
  setClipToHexGrid: (v) => set({ clipToHexGrid: v }),
  toggleExcludedHex: (key, mode) => set(s => {
    const cur = s.excludedHexKeys
    if (mode === 'exclude') {
      return cur.includes(key) ? {} : { excludedHexKeys: [...cur, key] }
    } else {
      return { excludedHexKeys: cur.filter(k => k !== key) }
    }
  }),
  resetExcludedHexes: () => set({ excludedHexKeys: [] }),

  applyMapPreset: (preset) => {
    const presets = {
      default: {
        woodsHexStyle: 'default' as const,
        terrainDisplacement: 18,
        terrainNoiseFrequency: 6,
        terrainNoiseOctaves: 3,
        terrainNoiseSeed: 2,
        riverWidthScale: 1.0,
      },
    }
    set(presets[preset])
  },

  saveProject: () => {
    const s = get()
    const snapshot = {
      version: 32,
      state: {
        step: s.step, paperSize: s.paperSize, orientation: s.orientation,
        mapMode: s.mapMode, diptychJoin: s.diptychJoin,
        hexSizeMm: s.hexSizeMm, hexOrientation: s.hexOrientation,
        marginMm: s.marginMm, hexEdgeMode: s.hexEdgeMode,
        generatedHexes: s.generatedHexes, generatedMetadata: s.generatedMetadata,
        thresholds: s.thresholds, disabledTerrains: Array.from(s.disabledTerrains),
        settlements: s.settlements, settlementsStatus: s.settlementsStatus,
        settlementsLimit: s.settlementsLimit, settlementsTypes: s.settlementsTypes,
        settlementTierThresholds: s.settlementTierThresholds, settlementsAutoPlace: s.settlementsAutoPlace,
        settlementTierStyles: s.settlementTierStyles,
        showSettlementLabels: s.showSettlementLabels,
        settlementLabelFont: s.settlementLabelFont,
        settlementLabelColor: s.settlementLabelColor,
        settlementLabelSizeScale: s.settlementLabelSizeScale,
        settlementLabelOverrides: s.settlementLabelOverrides,
        roadEdges: s.roadEdges, roadsDisplayMode: s.roadsDisplayMode,
        roadsVisibleTiers: s.roadsVisibleTiers, roadsStatus: s.roadsStatus,
        railEdges: s.railEdges, railsDisplayMode: s.railsDisplayMode,
        railsFetchTypes: s.railsFetchTypes, railsStatus: s.railsStatus,
        riverEdges: s.riverEdges, canalEdges: s.canalEdges,
        riverSegmentProps: s.riverSegmentProps, canalSegmentProps: s.canalSegmentProps,
        riverHopProps: s.riverHopProps,
        roadSegmentProps: s.roadSegmentProps, roadHopProps: s.roadHopProps,
        roadChainOverrides: s.roadChainOverrides, roadControlOverrides: s.roadControlOverrides,
        roadSnapBindings: s.roadSnapBindings, roadPathSmoothing: s.roadPathSmoothing, roadDensityMinChain: s.roadDensityMinChain,
        riverStyle: s.riverStyle, canalStyle: s.canalStyle,
        riverChainOverrides: s.riverChainOverrides,
        riverFlowStyle: s.riverFlowStyle, riverCurveSteps: s.riverCurveSteps,
        riverWobble: s.riverWobble, riverDetail: s.riverDetail, riverWiggliness: s.riverWiggliness,
        showRiverLabels: s.showRiverLabels,
        riverLabelColor: s.riverLabelColor,
        elevationThresholds: s.elevationThresholds,
        elevationStatus: s.elevationStatus,
        showReliefHeatmap: s.showReliefHeatmap, showElevHeatmap: s.showElevHeatmap,
        activePanel: s.activePanel, elevationStyle: s.elevationStyle,
        contourInterval: s.contourInterval, hexBorderMode: s.hexBorderMode,
        terrainDisplacement: s.terrainDisplacement, terrainNoiseFrequency: s.terrainNoiseFrequency,
        terrainNoiseSeed: s.terrainNoiseSeed, terrainNoiseOctaves: s.terrainNoiseOctaves,
        illustratedStyle: s.illustratedStyle,
        riverWidthScale: s.riverWidthScale, canalWidthScale: s.canalWidthScale,
        riverWiggleAmp: s.riverWiggleAmp, riverWiggleFreq: s.riverWiggleFreq, riverSmoothing: s.riverSmoothing,
        roadWiggleAmp: s.roadWiggleAmp, roadWiggleFreq: s.roadWiggleFreq, roadSmoothing: s.roadSmoothing,
        roadTierStyles: s.roadTierStyles, railStyle: s.railStyle,
        woodsHexStyle: s.woodsHexStyle, blobSize: s.blobSize, blobCount: s.blobCount,
        showBridges: s.showBridges, bridgeStyle: s.bridgeStyle,
        urbanHexes: s.urbanHexes, urbanStyle: s.urbanStyle,
        urbanDisplayMode: s.urbanDisplayMode, urbanScale: s.urbanScale,
        urbanVertexRatio: s.urbanVertexRatio, urbanNoise: s.urbanNoise,
        urbanBuildingCount: s.urbanBuildingCount, urbanBuildingSize: s.urbanBuildingSize,
        terrainBlobOverrides: s.terrainBlobOverrides, terrainTypeBlobStyles: s.terrainTypeBlobStyles,
        terrainBlobSmooth: s.terrainBlobSmooth, terrainBlobOffset: s.terrainBlobOffset,
        terrainBlobBump: s.terrainBlobBump, terrainBlobSweepFreq: s.terrainBlobSweepFreq,
        terrainBlobLobeFreq: s.terrainBlobLobeFreq, terrainBlobLobeAmp: s.terrainBlobLobeAmp,
        terrainBlobLobeThreshold: s.terrainBlobLobeThreshold, terrainBlobLobeDirection: s.terrainBlobLobeDirection,
        realisticCoastline: s.realisticCoastline, beachStrip: s.beachStrip,
        beachColor: s.beachColor, beachWidth: s.beachWidth,
        terrainColors: s.terrainColors, terrainTextureScales: s.terrainTextureScales,
        terrainRenderMode: s.terrainRenderMode,
        fieldFreq: s.fieldFreq, fieldAmp: s.fieldAmp, fieldOctaves: s.fieldOctaves,
        fieldPersistence: s.fieldPersistence, fieldWildness: s.fieldWildness,
        autoLakesEnabled: s.autoLakesEnabled, lakeSensitivity: s.lakeSensitivity,
        lakeBlobSmooth: s.lakeBlobSmooth, lakeBlobOffset: s.lakeBlobOffset,
        lakeBlobBump: s.lakeBlobBump, lakeBlobSweepFreq: s.lakeBlobSweepFreq,
        lakeBlobLobeFreq: s.lakeBlobLobeFreq, lakeBlobLobeAmp: s.lakeBlobLobeAmp,
        lakeBlobLobeThreshold: s.lakeBlobLobeThreshold, lakeBlobLobeDirection: s.lakeBlobLobeDirection,
        lakeOverrides: s.lakeOverrides,
        showPaperTexture: s.showPaperTexture, paperTextureOpacity: s.paperTextureOpacity,
        showPaperVignette: s.showPaperVignette,
        mapBgColor: s.mapBgColor, mapBorderEnabled: s.mapBorderEnabled,
        mapBorderColor: s.mapBorderColor, mapBorderWidth: s.mapBorderWidth,
        clipToHexGrid: s.clipToHexGrid, excludedHexKeys: s.excludedHexKeys,
        highlights: s.highlights, highlightedHexes: s.highlightedHexes,
        highlightLines: s.highlightLines, highlightEdgePaths: s.highlightEdgePaths,
      },
    }
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'map.ig2'
    a.click()
    URL.revokeObjectURL(url)
  },

  restoreProject: (data: unknown) => {
    try {
      const parsed = data as { state?: Record<string, unknown>; version?: number }
      const fromVersion = typeof parsed.version === 'number' ? parsed.version : 0
      const raw = { ...(parsed.state ?? (parsed as Record<string, unknown>)) }
      const migrated = migratePersisted(raw, fromVersion) as unknown as MapStore
      rehydrateState(migrated)
      set({ ...(migrated as Partial<MapStore>), undoStack: [], redoStack: [] })
    } catch (e) {
      console.error('Failed to restore project:', e)
    }
  },
})

// These are imported by mapStore.ts too — kept here so uiSlice owns persist logic
export function migratePersisted(persisted: unknown, fromVersion: number): Record<string, unknown> {
  const s = persisted as Record<string, unknown>
  if (fromVersion < 2) {
    delete s.riverChains; delete s.riversDisplayMode; delete s.riversStatus
    delete s.riverFeatures; delete s.namedRivers
    if (!s.riverEdges) s.riverEdges = []
  }
  if (fromVersion < 3) {
    delete s.selectedSegmentKey
    s.selectedSegmentKeys = []
  }
  if (fromVersion < 4) {
    if (!s.canalEdges) s.canalEdges = []
    if (!s.canalSegmentProps) s.canalSegmentProps = {}
    if (!s.riverStyle) s.riverStyle = { color: '#5888b0', strokeEnabled: false, strokeColor: '#2a4a6a', strokeWidth: 0.4 }
    if (!s.canalStyle) s.canalStyle = { color: '#6a9a8a', strokeEnabled: true, strokeColor: '#3a5a4a', strokeWidth: 0.5 }
  }
  if (fromVersion < 5) {
    if (s.riverFlowStyle === undefined) s.riverFlowStyle = 1
  }
  if (fromVersion < 7) {
    delete s.riverMeander; delete s.riverMeanderSeed
    delete s.riverStraighten; delete s.riverPathStraighten; delete s.riverWiggleScale
    if (s.riverCurveSteps === undefined) s.riverCurveSteps = 3
  }
  if (fromVersion < 8) {
    if (s.riverWobble === undefined) s.riverWobble = 0
  }
  if (fromVersion < 9) {
    if (s.riverDetail === undefined) s.riverDetail = 0
  }
  if (fromVersion < 10) {
    const tiers = s.settlementTierStyles as Record<string, Record<string, unknown>> | undefined
    if (tiers) {
      for (const ts of Object.values(tiers)) {
        if (ts.buildingAlgorithm === undefined) ts.buildingAlgorithm = 'v2'
        if (ts.buildingV2Size === undefined) ts.buildingV2Size = 2
        if (ts.buildingV2Spacing === undefined) ts.buildingV2Spacing = 1
        if (ts.buildingV2MergeChance === undefined) ts.buildingV2MergeChance = 0.3
      }
    }
  }
  if (fromVersion < 11) {
    const tiers = s.settlementTierStyles as Record<string, Record<string, unknown>> | undefined
    if (tiers) {
      for (const ts of Object.values(tiers)) {
        if (ts.buildingV2DepthVariation === undefined) ts.buildingV2DepthVariation = 0.5
      }
    }
  }
  if (fromVersion < 12) {
    const tiers = s.settlementTierStyles as Record<string, Record<string, unknown>> | undefined
    if (tiers) {
      for (const ts of Object.values(tiers)) {
        if (ts.buildingV2LengthVariation === undefined) ts.buildingV2LengthVariation = 0.5
      }
    }
  }
  if (fromVersion < 13) {
    const tiers = s.settlementTierStyles as Record<string, Record<string, unknown>> | undefined
    if (tiers) {
      for (const ts of Object.values(tiers)) {
        if (ts.buildingV2Rows === undefined) ts.buildingV2Rows = 2
        if (ts.buildingV2RowGap === undefined) ts.buildingV2RowGap = 1
        if (ts.buildingV2DensityFalloff === undefined) ts.buildingV2DensityFalloff = 0.5
      }
    }
  }
  if (fromVersion < 15) {
    if (!s.terrainTypeBlobStyles) s.terrainTypeBlobStyles = {}
  }
  if (fromVersion < 16) {
    if (s.blankMap === undefined) s.blankMap = false
  }
  if (fromVersion < 17) {
    if (s.hexNumbersEnabled === undefined) s.hexNumbersEnabled = false
    if (s.hexNumberStartCorner === undefined) s.hexNumberStartCorner = 'top-left'
    if (s.hexNumberEdge === undefined) s.hexNumberEdge = 4
    if (s.hexNumberColor === undefined) s.hexNumberColor = '#8a8a8a'
    if (s.hexNumberFontScale === undefined) s.hexNumberFontScale = 1.0
  }
  if (fromVersion < 18) {
    if (s.roadDensityMinChain === undefined) s.roadDensityMinChain = 1
  }
  if (fromVersion < 21) {
    delete s.railsDisplayMode
    const t = s.osmSpotlightTiers as boolean[] | undefined
    if (t && t.length === 3) (s.osmSpotlightTiers as boolean[]).push(true)
  }
  if (fromVersion < 22) {
    if (!s.iconOverlays) s.iconOverlays = []
    if (!s.placedIcons) s.placedIcons = {}
  }
  if (fromVersion < 23) {
    const validPatterns = new Set(['none', 'dotted', 'dashed', 'hatched'])
    const highlights = s.highlights as Array<Record<string, unknown>> | undefined
    if (highlights) {
      for (const h of highlights) {
        if (!validPatterns.has(h.linePattern as string)) h.linePattern = 'none'
      }
    }
  }
  if (fromVersion < 24) {
    const highlights = s.highlights as Array<Record<string, unknown>> | undefined
    if (highlights) {
      for (const h of highlights) {
        if (h.linePattern === 'hatched') h.linePattern = 'none'
      }
    }
  }
  if (fromVersion < 25) {
    const highlights = s.highlights as Array<Record<string, unknown>> | undefined
    if (highlights) {
      for (const h of highlights) {
        if (!h.fillPattern) h.fillPattern = 'none'
      }
    }
  }
  if (fromVersion < 26) {
    const highlights = s.highlights as Array<Record<string, unknown>> | undefined
    if (highlights) {
      for (const h of highlights) {
        if (h.fillPatternSpacing == null) h.fillPatternSpacing = h.patternSpacing ?? 1
      }
    }
  }
  if (fromVersion < 27) {
    if (s.mapBgColor === undefined) s.mapBgColor = '#ffffff'
    if (s.mapBorderEnabled === undefined) s.mapBorderEnabled = false
    if (s.mapBorderColor === undefined) s.mapBorderColor = '#000000'
    if (s.mapBorderWidth === undefined) s.mapBorderWidth = 1.5
    if (s.clipToHexGrid === undefined) s.clipToHexGrid = false
    if (s.excludedHexKeys === undefined) s.excludedHexKeys = []
  }
  if (fromVersion < 28) {
    if (s.riverPathSmoothing === undefined) s.riverPathSmoothing = 0
  }
  if (fromVersion < 29) {
    if (s.bridgesEnabled === undefined) s.bridgesEnabled = true
    if (s.bridgeStyle === undefined) s.bridgeStyle = 'plank'
    if (!s.bridgeTiers) s.bridgeTiers = [
      { id: 'bt-0', label: 'Major', color: '#e8c060' },
      { id: 'bt-1', label: 'Minor', color: '#c0b090' },
    ]
    if (!s.bridgeOverrides) s.bridgeOverrides = {}
  }
  if (fromVersion < 30) {
    if (s.megaHexEnabled === undefined) s.megaHexEnabled = false
    if (s.megaHexRadius === undefined) s.megaHexRadius = 1
    if (s.megaHexColor === undefined) s.megaHexColor = '#cc4444'
    if (s.megaHexOpacity === undefined) s.megaHexOpacity = 0.8
    if (s.megaHexLineWidth === undefined) s.megaHexLineWidth = 2
    if (s.megaHexOriginQ === undefined) s.megaHexOriginQ = 0
    if (s.megaHexOriginR === undefined) s.megaHexOriginR = 0
  }
  if (fromVersion < 31) {
    if (!s.roadTierGeometry) s.roadTierGeometry = [null, null, null]
    if (s.railGeomOverride === undefined) s.railGeomOverride = null
    if (s.railPathSmoothing === undefined) s.railPathSmoothing = 0
  }
  if (fromVersion < 32) {
    if (!s.edgeBlobPainted) s.edgeBlobPainted = {}
    if (!s.edgeBlobOverrides) s.edgeBlobOverrides = {}
    if (s.edgeBlobSmooth === undefined) s.edgeBlobSmooth = 0
    if (s.edgeBlobOffset === undefined) s.edgeBlobOffset = -0.10
    if (s.edgeBlobBump === undefined) s.edgeBlobBump = 0.47
    if (s.edgeBlobSweepFreq === undefined) s.edgeBlobSweepFreq = 1.0
    if (s.edgeBlobLobeFreq === undefined) s.edgeBlobLobeFreq = 4.1
    if (s.edgeBlobLobeAmp === undefined) s.edgeBlobLobeAmp = 0.49
    if (s.edgeBlobLobeThreshold === undefined) s.edgeBlobLobeThreshold = 0.08
    if (s.edgeBlobLobeDirection === undefined) s.edgeBlobLobeDirection = -1
    if (s.edgeBlobWidth === undefined) s.edgeBlobWidth = 0.25
  }
  if (s.hexBorderMode === 'dots') s.hexBorderMode = 'full'
  return s
}

export function rehydrateState(state: MapStore): MapStore {
  const dt = state.disabledTerrains
  state.disabledTerrains = dt instanceof Set ? dt : new Set(Array.isArray(dt) ? dt as string[] : [])
  if (state.generateStatus === 'loading') state.generateStatus = 'idle'
  if (state.elevationStatus === 'loading') state.elevationStatus = 'idle'
  if (state.settlementsStatus === 'loading') state.settlementsStatus = 'idle'
  if (state.roadsStatus === 'loading') state.roadsStatus = 'idle'
  if (state.railsStatus === 'loading') state.railsStatus = 'idle'
  if (Array.isArray(state.roadEdges)) {
    state.roadEdges = (state.roadEdges as RoadEdge[]).filter(
      (e) => e.tier === 0 || e.tier === 1 || e.tier === 2
    )
  }
  return state
}
