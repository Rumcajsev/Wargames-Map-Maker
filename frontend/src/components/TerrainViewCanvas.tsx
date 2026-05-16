import { useRef, useEffect, useCallback, useState, useMemo, forwardRef, useImperativeHandle, type CSSProperties } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useMapStore, TERRAIN_COLORS, LAKE_COLOR, TERRAIN_PRIORITY, hexTerrainLayers, paperDimsMm, combinedDimsMm, type GeneratedHex } from '../store/mapStore'
import { BlobOverrideFlyout } from './BlobOverrideFlyout'
import { hexAdjacent, catmullRom, offsetPolyline, pointInPolygon } from '../lib/geometry'
import { mulberry32, makePermutation } from '../lib/noise'
import { projectToCanvas, unprojectFromCanvas, computePaper } from '../lib/projection'
import { coastalBlobTerrains, getCoastlineRuns, buildSmoothedRing, bleedPolygon, buildTerrainBlobsV2, computeConnectedComponents, buildFieldCanvas } from '../lib/terrainBlobs'
import { riverChainCache, buildRiverChains } from '../lib/riverChains'
import { drawRivers as _drawRivers } from '../lib/drawRivers'
import { buildRoadChains, buildRailChains, spineSideCpKey } from '../lib/roadChains'
import { drawHighlights as _drawHighlights } from '../lib/drawHighlights'
import { drawRoadsAndRails as _drawRoadsAndRails } from '../lib/drawRoadsRails'
import { drawSettlements as _drawSettlements } from '../lib/drawSettlements'
import { drawAllBuildings as _drawAllBuildings, type BuildingCmd } from '../lib/drawBuildings'
import { drawAllBuildingsV2 as _drawAllBuildingsV2 } from '../lib/drawBuildingsV2'
import { drawHexBorders as _drawHexBorders } from '../lib/drawHexBorders'
import { drawTerrain as _drawTerrain } from '../lib/drawTerrain'

const OSM_OVERLAY_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxzoom: 19,
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
}

type CtxItem = { label: string; action: () => void; danger?: boolean; color?: string; dim?: boolean }

export type TerrainViewCanvasHandle = {
  exportBlob: () => Promise<{ blob: Blob; paperMm: [number, number] } | null>
}

export const TerrainViewCanvas = forwardRef<TerrainViewCanvasHandle>(function TerrainViewCanvas(_, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const forestTextureRef = useRef<HTMLImageElement | null>(null)
  const lightWoodsTextureRef = useRef<HTMLImageElement | null>(null)
  const clearTextureRef = useRef<HTMLImageElement | null>(null)
  const marshTextureRef = useRef<HTMLImageElement | null>(null)
  const patternCacheRef = useRef<WeakMap<HTMLImageElement, CanvasPattern>>(new WeakMap())
  const terrainLayerRef = useRef<OffscreenCanvas | null>(null)
  const terrainDirtyRef = useRef(true)
  const terrainLayerPapWRef = useRef(0)
  const terrainLayerPapHRef = useRef(0)
  const terrainZoomSettleRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Offscreen canvas refs for non-terrain layers
  const hexBorderLayerRef = useRef<OffscreenCanvas | null>(null)
  const hexBorderDirtyRef = useRef(true)
  const hexBorderLayerPapWRef = useRef(0)
  const hexBorderLayerPapHRef = useRef(0)

  const joinedHighlightsLayerRef = useRef<OffscreenCanvas | null>(null)
  const joinedHighlightsDirtyRef = useRef(true)
  const joinedHighlightsLayerPapWRef = useRef(0)
  const joinedHighlightsLayerPapHRef = useRef(0)

  const riversLayerRef = useRef<OffscreenCanvas | null>(null)
  const riversDirtyRef = useRef(true)
  const riversLayerPapWRef = useRef(0)
  const riversLayerPapHRef = useRef(0)

  const buildingsLayerRef = useRef<OffscreenCanvas | null>(null)
  const buildingsDirtyRef = useRef(true)
  const buildingsLayerPapWRef = useRef(0)
  const buildingsLayerPapHRef = useRef(0)

  const roadsLayerRef = useRef<OffscreenCanvas | null>(null)
  const roadsDirtyRef = useRef(true)
  const roadsLayerPapWRef = useRef(0)
  const roadsLayerPapHRef = useRef(0)

  const settlementsLayerRef = useRef<OffscreenCanvas | null>(null)
  const settlementsDirtyRef = useRef(true)
  const settlementsLayerPapWRef = useRef(0)
  const settlementsLayerPapHRef = useRef(0)
  const [frameDims, setFrameDims] = useState({ w: 0, h: 0 })
  const frameDimsRef = useRef({ w: 0, h: 0 })

  const rafRef = useRef<number | null>(null)
  const zoomRef = useRef(1)
  const panRef = useRef({ x: 0, y: 0 })
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0 })
  const panOriginRef = useRef({ x: 0, y: 0 })

  const [mapOverlay, setMapOverlay] = useState(false)
  const [overlayRect, setOverlayRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const overlayContainerRef = useRef<HTMLDivElement>(null)
  const overlayMapRef = useRef<maplibregl.Map | null>(null)

  const {
    generatedHexes, generatedMetadata, selectedHex, setSelectedHex,
    hexBorderMode, hexEdgeMode,
    terrainBlobSmooth, terrainBlobOffset, terrainBlobBump,
    terrainBlobSweepFreq, terrainBlobLobeFreq, terrainBlobLobeAmp, terrainBlobLobeThreshold, terrainBlobLobeDirection,
    terrainColors, terrainTextureScales,
    terrainPaintMode, terrainPaintBrush, overrideHexTerrain, addHexTerrainLayer, removeHexTerrainLayer, resetHexOverride,
    terrainLayersEnabled,
    roadEdges, railEdges, roadTierStyles, railStyle,
    roadPaintMode, roadPaintBrush, roadPaintEraser,
    railPaintMode, railPaintEraser,
    addRoadEdge, removeRoadHexEdges, addRailEdge, removeRailHexEdges,
    activePanel,
    roadControlOverrides, setRoadControlOverride, deleteRoadControlOverride,
    roadNodeEditMode,
    roadBendiness, hexRoadBendiness, setRoadBendiness, setHexRoadBendiness, deleteHexRoadBendiness,
    riverEdges, canalEdges,
    riverEditMode, canalEditMode, toggleRiverEdge, toggleCanalEdge,
    showRiverLabels, riverLabelColor,
    riverSegmentProps, canalSegmentProps,
    setRiverSegmentProp, clearRiverSegmentProp,
    riverSelectMode, canalSelectMode,
    selectedSegmentKeys, selectedCanalSegmentKeys,
    setSelectedSegmentKeys, toggleSegmentSelection,
    setSelectedCanalSegmentKeys, toggleCanalSegmentSelection,
    riverStyle, canalStyle,
    lakePaintMode, overrideHexLake,
    lakeBlobSmooth, lakeBlobOffset, lakeBlobBump,
    lakeBlobSweepFreq, lakeBlobLobeFreq, lakeBlobLobeAmp, lakeBlobLobeThreshold, lakeBlobLobeDirection,
    riverWidthScale, canalWidthScale, riverCurveSteps, riverWobble, riverDetail,
    terrainBlobOverrides, setTerrainBlobOverride,
    lakeOverrides, setLakeOverride,
    realisticCoastline,
    beachStrip, beachColor, beachWidth,
    terrainRenderMode, fieldFreq, fieldAmp, fieldOctaves, fieldPersistence, fieldWildness,
    settlements, settlementTierStyles, settlementPlaceTier, addSettlement, placeSettlementAtHex,
    settlementMoveIndex, setSettlementMoveIndex, updateSettlement,
    urbanHexes, urbanStyle, urbanPaintMode, toggleUrbanHex,
    highlights, highlightedHexes, highlightLines, highlightEdgePaths,
    activeHighlightId, highlightPaintMode, highlightLineEraser,
    setHexHighlight, clearHexHighlight, startNewLineSegment, appendHexToLine, removeLastHexFromLine, truncateHighlightLine,
    eraseHexFromLine,
    setHighlightEdgePath,
    elevationPaintMode,
    setActiveTool,
    mapMode, diptychJoin, paperSize, orientation,
  } = useMapStore()
  const mapModeRef = useRef(mapMode)
  const diptychJoinRef = useRef(diptychJoin)
  const paperSizeRef = useRef(paperSize)
  const orientationRef = useRef(orientation)
  const hexesRef = useRef(generatedHexes)
  const metaRef = useRef(generatedMetadata)
  const selectedHexRef = useRef(selectedHex)
  const hexBorderModeRef = useRef(hexBorderMode)
  const hexEdgeModeRef = useRef(hexEdgeMode)
  const terrainPaintModeRef = useRef(terrainPaintMode)
  const terrainPaintBrushRef = useRef(terrainPaintBrush)
  const overrideHexTerrainRef = useRef(overrideHexTerrain)
  const addHexTerrainLayerRef = useRef(addHexTerrainLayer)
  const terrainLayersEnabledRef = useRef(terrainLayersEnabled)
  const roadEdgesRef = useRef(roadEdges)
  const railEdgesRef = useRef(railEdges)
  const roadTierStylesRef = useRef(roadTierStyles)
  const railStyleRef = useRef(railStyle)
  const roadPaintModeRef = useRef(roadPaintMode)
  const roadPaintBrushRef = useRef(roadPaintBrush)
  const roadPaintEraserRef = useRef(roadPaintEraser)
  const railPaintModeRef = useRef(railPaintMode)
  const railPaintEraserRef = useRef(railPaintEraser)
  const addRoadEdgeRef = useRef(addRoadEdge)
  const removeRoadHexEdgesRef = useRef(removeRoadHexEdges)
  const addRailEdgeRef = useRef(addRailEdge)
  const removeRailHexEdgesRef = useRef(removeRailHexEdges)
  const activePanelRef = useRef(activePanel)
  const roadControlOverridesRef = useRef(roadControlOverrides)
  const setRoadControlOverrideRef = useRef(setRoadControlOverride)
  const roadNodeEditModeRef = useRef(roadNodeEditMode)
  const deleteRoadControlOverrideRef = useRef(deleteRoadControlOverride)
  const resetHexOverrideRef = useRef(resetHexOverride)
  const removeHexTerrainLayerRef = useRef(removeHexTerrainLayer)
  const hexRoadBendinessRef = useRef(hexRoadBendiness)
  const setHexRoadBendinessRef = useRef(setHexRoadBendiness)
  const deleteHexRoadBendinessRef = useRef(deleteHexRoadBendiness)
  const riverEdgesRef = useRef(riverEdges)
  const canalEdgesRef = useRef(canalEdges)
  const riverEditModeRef = useRef(riverEditMode)
  const canalEditModeRef = useRef(canalEditMode)
  const toggleRiverEdgeRef = useRef(toggleRiverEdge)
  const toggleCanalEdgeRef = useRef(toggleCanalEdge)
  const showRiverLabelsRef = useRef(showRiverLabels)
  const riverLabelColorRef = useRef(riverLabelColor)
  const riverSegmentPropsRef = useRef(riverSegmentProps)
  const canalSegmentPropsRef = useRef(canalSegmentProps)
  const riverSelectModeRef = useRef(riverSelectMode)
  const canalSelectModeRef = useRef(canalSelectMode)
  const selectedSegmentKeysRef = useRef(selectedSegmentKeys)
  const selectedCanalSegmentKeysRef = useRef(selectedCanalSegmentKeys)
  const setSelectedSegmentKeysRef = useRef(setSelectedSegmentKeys)
  const setSelectedCanalSegmentKeysRef = useRef(setSelectedCanalSegmentKeys)
  const toggleSegmentSelectionRef = useRef(toggleSegmentSelection)
  const toggleCanalSegmentSelectionRef = useRef(toggleCanalSegmentSelection)
  const riverStyleRef = useRef(riverStyle)
  const canalStyleRef = useRef(canalStyle)
  const computedRiverChainsRef = useRef<{ vertices: [number,number][]; segKey: string }[]>([])
  const computedCanalChainsRef = useRef<{ vertices: [number,number][]; segKey: string }[]>([])
  const lakePaintModeRef = useRef(lakePaintMode)
  const overrideHexLakeRef = useRef(overrideHexLake)
  const lakeBlobSmoothRef = useRef(lakeBlobSmooth)
  const lakeBlobOffsetRef = useRef(lakeBlobOffset)
  const lakeBlobBumpRef = useRef(lakeBlobBump)
  const lakeBlobSweepFreqRef = useRef(lakeBlobSweepFreq)
  const lakeBlobLobeFreqRef = useRef(lakeBlobLobeFreq)
  const lakeBlobLobeAmpRef = useRef(lakeBlobLobeAmp)
  const lakeBlobLobeThresholdRef = useRef(lakeBlobLobeThreshold)
  const lakeBlobLobeDirectionRef = useRef(lakeBlobLobeDirection)
  const riverWidthScaleRef = useRef(riverWidthScale)
  const canalWidthScaleRef = useRef(canalWidthScale)
  const riverCurveStepsRef = useRef(riverCurveSteps)
  const riverWobbleRef = useRef(riverWobble)
  const riverDetailRef = useRef(riverDetail)
  const setRiverSegmentPropRef = useRef(setRiverSegmentProp)
  const clearRiverSegmentPropRef = useRef(clearRiverSegmentProp)
  const terrainBlobSmoothRef = useRef(terrainBlobSmooth)
  const terrainBlobOffsetRef = useRef(terrainBlobOffset)
  const terrainBlobBumpRef = useRef(terrainBlobBump)
  const terrainBlobSweepFreqRef = useRef(terrainBlobSweepFreq)
  const terrainBlobLobeFreqRef = useRef(terrainBlobLobeFreq)
  const terrainBlobLobeAmpRef = useRef(terrainBlobLobeAmp)
  const terrainBlobLobeThresholdRef = useRef(terrainBlobLobeThreshold)
  const terrainBlobLobeDirectionRef = useRef(terrainBlobLobeDirection)
  const terrainColorsRef = useRef(terrainColors)
  const terrainTextureScalesRef = useRef(terrainTextureScales)
  const terrainBlobOverridesRef = useRef(terrainBlobOverrides)
  const lakeOverridesRef = useRef(lakeOverrides)
  const terrainRenderModeRef = useRef(terrainRenderMode)
  const fieldFreqRef = useRef(fieldFreq)
  const fieldAmpRef = useRef(fieldAmp)
  const fieldOctavesRef = useRef(fieldOctaves)
  const fieldPersistenceRef = useRef(fieldPersistence)
  const fieldWildnessRef = useRef(fieldWildness)
  const fieldCanvasRef = useRef<OffscreenCanvas | null>(null)
  const hexBuildingGeoCacheRef = useRef<Map<string, BuildingCmd[]>>(new Map())
  const lastBuildingCacheEpochRef = useRef<{ roadData: unknown; zoom: number; settlementStyles: unknown; urbanStyle: unknown } | null>(null)
  const settlementsRef = useRef(settlements)
  const settlementTierStylesRef = useRef(settlementTierStyles)
  const settlementPlaceTierRef = useRef(settlementPlaceTier)
  const addSettlementRef = useRef(addSettlement)
  const placeSettlementAtHexRef = useRef(placeSettlementAtHex)
  const settlementMoveIndexRef = useRef(settlementMoveIndex)
  const setSettlementMoveIndexRef = useRef(setSettlementMoveIndex)
  const updateSettlementRef = useRef(updateSettlement)
  const urbanHexesRef = useRef(urbanHexes)
  const urbanStyleRef = useRef(urbanStyle)
  const urbanPaintModeRef = useRef(urbanPaintMode)
  const toggleUrbanHexRef = useRef(toggleUrbanHex)
  const highlightsRef = useRef(highlights)
  const highlightedHexesRef = useRef(highlightedHexes)
  const highlightLinesRef = useRef(highlightLines)
  const highlightEdgePathsRef = useRef(highlightEdgePaths)
  const activeHighlightIdRef = useRef(activeHighlightId)
  const highlightPaintModeRef = useRef(highlightPaintMode)
  const highlightLineEraserRef = useRef(highlightLineEraser)
  const setHexHighlightRef = useRef(setHexHighlight)
  const clearHexHighlightRef = useRef(clearHexHighlight)
  const startNewLineSegmentRef = useRef(startNewLineSegment)
  const appendHexToLineRef = useRef(appendHexToLine)
  const removeLastHexFromLineRef = useRef(removeLastHexFromLine)
  const truncateHighlightLineRef = useRef(truncateHighlightLine)
  const eraseHexFromLineRef = useRef(eraseHexFromLine)
  const setHighlightEdgePathRef = useRef(setHighlightEdgePath)
  const hoveredEdgeRef = useRef<{ hexQ: number; hexR: number; edgeI: number } | null>(null)
  const hoverRafRef = useRef<number | null>(null)

  mapModeRef.current = mapMode
  diptychJoinRef.current = diptychJoin
  paperSizeRef.current = paperSize
  orientationRef.current = orientation
  hexesRef.current = generatedHexes
  metaRef.current = generatedMetadata
  selectedHexRef.current = selectedHex
  hexBorderModeRef.current = hexBorderMode
  hexEdgeModeRef.current = hexEdgeMode
  terrainPaintModeRef.current = terrainPaintMode
  terrainPaintBrushRef.current = terrainPaintBrush
  overrideHexTerrainRef.current = overrideHexTerrain
  addHexTerrainLayerRef.current = addHexTerrainLayer
  terrainLayersEnabledRef.current = terrainLayersEnabled
  roadEdgesRef.current = roadEdges
  railEdgesRef.current = railEdges
  roadTierStylesRef.current = roadTierStyles
  railStyleRef.current = railStyle
  roadPaintModeRef.current = roadPaintMode
  roadPaintBrushRef.current = roadPaintBrush
  roadPaintEraserRef.current = roadPaintEraser
  railPaintModeRef.current = railPaintMode
  railPaintEraserRef.current = railPaintEraser
  addRoadEdgeRef.current = addRoadEdge
  removeRoadHexEdgesRef.current = removeRoadHexEdges
  addRailEdgeRef.current = addRailEdge
  removeRailHexEdgesRef.current = removeRailHexEdges
  activePanelRef.current = activePanel
  urbanHexesRef.current = urbanHexes
  urbanStyleRef.current = urbanStyle
  urbanPaintModeRef.current = urbanPaintMode
  toggleUrbanHexRef.current = toggleUrbanHex
  highlightsRef.current = highlights
  highlightedHexesRef.current = highlightedHexes
  highlightLinesRef.current = highlightLines
  highlightEdgePathsRef.current = highlightEdgePaths
  activeHighlightIdRef.current = activeHighlightId
  highlightPaintModeRef.current = highlightPaintMode
  highlightLineEraserRef.current = highlightLineEraser
  setHexHighlightRef.current = setHexHighlight
  clearHexHighlightRef.current = clearHexHighlight
  startNewLineSegmentRef.current = startNewLineSegment
  appendHexToLineRef.current = appendHexToLine
  removeLastHexFromLineRef.current = removeLastHexFromLine
  truncateHighlightLineRef.current = truncateHighlightLine
  eraseHexFromLineRef.current = eraseHexFromLine
  setHighlightEdgePathRef.current = setHighlightEdgePath
  roadControlOverridesRef.current = roadControlOverrides
  setRoadControlOverrideRef.current = setRoadControlOverride
  roadNodeEditModeRef.current = roadNodeEditMode
  deleteRoadControlOverrideRef.current = deleteRoadControlOverride
  overrideHexTerrainRef.current = overrideHexTerrain
  addHexTerrainLayerRef.current = addHexTerrainLayer
  terrainLayersEnabledRef.current = terrainLayersEnabled
  resetHexOverrideRef.current = resetHexOverride
  removeHexTerrainLayerRef.current = removeHexTerrainLayer
  hexRoadBendinessRef.current = hexRoadBendiness
  setHexRoadBendinessRef.current = setHexRoadBendiness
  deleteHexRoadBendinessRef.current = deleteHexRoadBendiness
  riverEdgesRef.current = riverEdges
  canalEdgesRef.current = canalEdges
  riverEditModeRef.current = riverEditMode
  canalEditModeRef.current = canalEditMode
  toggleRiverEdgeRef.current = toggleRiverEdge
  toggleCanalEdgeRef.current = toggleCanalEdge
  showRiverLabelsRef.current = showRiverLabels
  riverLabelColorRef.current = riverLabelColor
  riverSegmentPropsRef.current = riverSegmentProps
  canalSegmentPropsRef.current = canalSegmentProps
  riverSelectModeRef.current = riverSelectMode
  canalSelectModeRef.current = canalSelectMode
  selectedSegmentKeysRef.current = selectedSegmentKeys
  selectedCanalSegmentKeysRef.current = selectedCanalSegmentKeys
  setSelectedSegmentKeysRef.current = setSelectedSegmentKeys
  setSelectedCanalSegmentKeysRef.current = setSelectedCanalSegmentKeys
  toggleSegmentSelectionRef.current = toggleSegmentSelection
  toggleCanalSegmentSelectionRef.current = toggleCanalSegmentSelection
  riverStyleRef.current = riverStyle
  canalStyleRef.current = canalStyle
  lakePaintModeRef.current = lakePaintMode
  overrideHexLakeRef.current = overrideHexLake
  lakeBlobSmoothRef.current = lakeBlobSmooth
  lakeBlobOffsetRef.current = lakeBlobOffset
  lakeBlobBumpRef.current = lakeBlobBump
  lakeBlobSweepFreqRef.current = lakeBlobSweepFreq
  lakeBlobLobeFreqRef.current = lakeBlobLobeFreq
  lakeBlobLobeAmpRef.current = lakeBlobLobeAmp
  lakeBlobLobeThresholdRef.current = lakeBlobLobeThreshold
  lakeBlobLobeDirectionRef.current = lakeBlobLobeDirection
  riverWidthScaleRef.current = riverWidthScale
  canalWidthScaleRef.current = canalWidthScale
  riverCurveStepsRef.current = riverCurveSteps
  riverWobbleRef.current = riverWobble
  riverDetailRef.current = riverDetail
  setRiverSegmentPropRef.current = setRiverSegmentProp
  clearRiverSegmentPropRef.current = clearRiverSegmentProp
  terrainBlobSmoothRef.current = terrainBlobSmooth
  terrainBlobOffsetRef.current = terrainBlobOffset
  terrainBlobBumpRef.current = terrainBlobBump
  terrainBlobSweepFreqRef.current = terrainBlobSweepFreq
  terrainBlobLobeFreqRef.current = terrainBlobLobeFreq
  terrainBlobLobeAmpRef.current = terrainBlobLobeAmp
  terrainBlobLobeThresholdRef.current = terrainBlobLobeThreshold
  terrainBlobLobeDirectionRef.current = terrainBlobLobeDirection
  terrainColorsRef.current = terrainColors
  terrainTextureScalesRef.current = terrainTextureScales

  const realisticCoastlineRef = useRef(realisticCoastline)
  realisticCoastlineRef.current = realisticCoastline
  const beachStripRef = useRef(beachStrip)
  beachStripRef.current = beachStrip
  const beachColorRef = useRef(beachColor)
  beachColorRef.current = beachColor
  const beachWidthRef = useRef(beachWidth)
  beachWidthRef.current = beachWidth
  terrainBlobOverridesRef.current = terrainBlobOverrides
  lakeOverridesRef.current = lakeOverrides
  terrainRenderModeRef.current = terrainRenderMode
  fieldFreqRef.current = fieldFreq
  fieldAmpRef.current = fieldAmp
  fieldOctavesRef.current = fieldOctaves
  fieldPersistenceRef.current = fieldPersistence
  fieldWildnessRef.current = fieldWildness
  settlementsRef.current = settlements
  settlementTierStylesRef.current = settlementTierStyles
  settlementPlaceTierRef.current = settlementPlaceTier
  addSettlementRef.current = addSettlement
  placeSettlementAtHexRef.current = placeSettlementAtHex
  settlementMoveIndexRef.current = settlementMoveIndex
  setSettlementMoveIndexRef.current = setSettlementMoveIndex
  updateSettlementRef.current = updateSettlement

  const hexIdx = useMemo(
    () => new Map(generatedHexes.map(h => [`${h.q},${h.r}`, h])),
    [generatedHexes],
  )
  const hexIdxRef = useRef(hexIdx)
  hexIdxRef.current = hexIdx

  const blobComponents = useMemo(
    () => computeConnectedComponents(generatedHexes.map(h => ({ q: h.q, r: h.r, terrain: h.terrain, isLake: h.isLake ?? false }))),
    [generatedHexes],
  )
  const blobComponentsRef = useRef(blobComponents)
  blobComponentsRef.current = blobComponents

  // Per-terrain component maps using terrains[] — so layered hexes group correctly
  const blobComponentsByTerrain = useMemo(() => {
    const result = new Map<string, Map<string, string>>()
    const terrainTypes = new Set<string>()
    for (const h of generatedHexes) {
      for (const t of hexTerrainLayers(h)) {
        if (t !== 'clear' && t !== 'lake') terrainTypes.add(t)
      }
    }
    for (const t of terrainTypes) {
      result.set(t, computeConnectedComponents(
        generatedHexes
          .filter(h => hexTerrainLayers(h).includes(t))
          .map(h => ({ q: h.q, r: h.r, terrain: t, isLake: false as const }))
      ))
    }
    return result
  }, [generatedHexes])
  const blobComponentsByTerrainRef = useRef(blobComponentsByTerrain)
  blobComponentsByTerrainRef.current = blobComponentsByTerrain


  const smoothedRoadData = useMemo(
    () => buildRoadChains(roadEdges, hexIdx as Map<string, { center: [number, number] }>, roadControlOverrides, roadBendiness, hexRoadBendiness),
    [roadEdges, hexIdx, roadControlOverrides, roadBendiness, hexRoadBendiness],
  )
  const smoothedRoadDataRef = useRef(smoothedRoadData)
  smoothedRoadDataRef.current = smoothedRoadData

  const smoothedRailChains = useMemo(
    () => {
      const roadEdgeMidpoints = new Map(
        smoothedRoadData.controlPoints
          .filter(cp => cp.key.startsWith('em|'))
          .map(cp => [cp.key, cp.pos] as [string, [number, number]])
      )
      const roadJunctionPositions = new Map(
        smoothedRoadData.controlPoints
          .filter(cp => cp.key.startsWith('ja|'))
          .map(cp => [cp.key.slice(3), cp.pos] as [string, [number, number]])
      )
      return buildRailChains(railEdges, roadEdges, hexIdx as Map<string, { center: [number, number] }>, roadEdgeMidpoints, roadJunctionPositions)
    },
    [railEdges, roadEdges, hexIdx, smoothedRoadData],
  )
  const smoothedRailChainsRef = useRef(smoothedRailChains)
  smoothedRailChainsRef.current = smoothedRailChains

  // Memoize paper dims, projected hex coords, and default blob geometry outside draw().
  // These are all stable across zoom/pan (which is handled by canvas transform, not coordinate recalculation),
  // so caching them here means draw() skips the expensive recomputation on every scroll/zoom frame.
  const paperDims = useMemo(() => {
    if (!generatedMetadata || frameDims.w === 0) return null
    return computePaper(frameDims.w, frameDims.h, generatedMetadata)
  }, [generatedMetadata, frameDims])
  const paperDimsRef = useRef(paperDims)
  paperDimsRef.current = paperDims

  const hexRadius = useMemo(() => {
    if (!paperDims || !generatedMetadata) return 0
    return generatedMetadata.outer_radius_m * (paperDims.pw / (generatedMetadata.scale_m_per_mm * generatedMetadata.paper_mm[0]))
  }, [paperDims, generatedMetadata])
  const hexRadiusRef = useRef(hexRadius)
  hexRadiusRef.current = hexRadius

  const projectedHexes = useMemo(() => {
    if (!generatedMetadata || !paperDims || generatedHexes.length === 0) return []
    const { pw, ph, px, py } = paperDims
    return generatedHexes.map(hex => {
      const verts = hex.vertices.map(([lon, lat]) =>
        projectToCanvas(lon, lat, generatedMetadata, pw, ph, px, py) as [number, number]
      )
      return { hex, verts }
    })
  }, [generatedHexes, generatedMetadata, paperDims])
  const projectedHexesRef = useRef(projectedHexes)
  projectedHexesRef.current = projectedHexes

  // Coastal hexes: project each coastline_clip ring from lon/lat to canvas coords.
  // Each entry maps (q,r) → array of projected rings (one ring per polygon in the clip).
  const projectedCoastlineClips = useMemo(() => {
    if (!generatedMetadata || !paperDims) return new Map<string, [number, number][][]>()
    const { pw, ph, px, py } = paperDims
    const result = new Map<string, [number, number][][]>()
    for (const hex of generatedHexes) {
      if (!hex.coastline_clip || hex.coastline_clip.length === 0) continue
      const projectedRings = hex.coastline_clip.map(ring =>
        ring.map(([lon, lat]) =>
          projectToCanvas(lon, lat, generatedMetadata, pw, ph, px, py) as [number, number]
        )
      )
      result.set(`${hex.q},${hex.r}`, projectedRings)
    }
    return result
  }, [generatedHexes, generatedMetadata, paperDims])
  const projectedCoastlineClipsRef = useRef(projectedCoastlineClips)
  projectedCoastlineClipsRef.current = projectedCoastlineClips

  // Keys of hexes that are TRUE sea-coast hexes: have coastline_clip AND at least one
  // pure-sea neighbor. Inland water-body hexes also get coastline_clip but have no
  // pure-sea neighbor, so they are excluded from the sea mask.
  const seaCoastKeys = useMemo(() => {
    if (!realisticCoastline) return new Set<string>()
    const hexByKey = new Map<string, GeneratedHex>()
    for (const h of generatedHexes) hexByKey.set(`${h.q},${h.r}`, h)
    const NEIGHBORS = [[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]]
    // BFS outward from each coastal hex: if we reach a pure-sea hex (terrain=sea, no clip)
    // within 2 hops, the original hex is a sea-coast hex. Two hops handles the common case
    // where a land-coast hex is adjacent to a sea-coast hex (both have clips) rather than
    // directly adjacent to open ocean.
    const keys = new Set<string>()
    for (const h of generatedHexes) {
      if (!h.coastline_clip || h.coastline_clip.length === 0) continue
      let found = false
      for (const [dq1, dr1] of NEIGHBORS) {
        const nb1 = hexByKey.get(`${h.q + dq1},${h.r + dr1}`)
        if (!nb1 || nb1.terrain !== 'sea') continue
        if (!nb1.coastline_clip || nb1.coastline_clip.length === 0) { found = true; break }
        // second hop
        for (const [dq2, dr2] of NEIGHBORS) {
          const nb2 = hexByKey.get(`${nb1.q + dq2},${nb1.r + dr2}`)
          if (nb2 && nb2.terrain === 'sea' && (!nb2.coastline_clip || nb2.coastline_clip.length === 0)) { found = true; break }
        }
        if (found) break
      }
      if (found) keys.add(`${h.q},${h.r}`)
    }
    return keys
  }, [generatedHexes, realisticCoastline])
  const seaCoastKeysRef = useRef(seaCoastKeys)
  seaCoastKeysRef.current = seaCoastKeys

  // Ocean sea keys: pure-sea hexes (terrain='sea', no clip) reachable from any seaCoastKey via
  // flood-fill through connected pure-sea hexes. Inland water bodies (class 80 pixels classified
  // as 'sea') form isolated islands with no connection to the coast — they are excluded.
  const oceanSeaKeys = useMemo(() => {
    if (!realisticCoastline) return new Set<string>()
    const hexByKey = new Map<string, GeneratedHex>()
    for (const h of generatedHexes) hexByKey.set(`${h.q},${h.r}`, h)
    const NEIGHBORS = [[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]]
    const visited = new Set<string>()
    const queue: string[] = []
    // Seed: pure-sea hexes adjacent to any seaCoastKey
    for (const ck of seaCoastKeys) {
      const parts = ck.split(',')
      const q = parseInt(parts[0]), r = parseInt(parts[1])
      for (const [dq, dr] of NEIGHBORS) {
        const nb = hexByKey.get(`${q + dq},${r + dr}`)
        if (!nb || nb.terrain !== 'sea' || (nb.coastline_clip?.length ?? 0) > 0) continue
        const nk = `${nb.q},${nb.r}`
        if (!visited.has(nk)) { visited.add(nk); queue.push(nk) }
      }
    }
    // BFS through connected pure-sea hexes
    while (queue.length > 0) {
      const k = queue.pop()!
      const parts = k.split(',')
      const q = parseInt(parts[0]), r = parseInt(parts[1])
      for (const [dq, dr] of NEIGHBORS) {
        const nb = hexByKey.get(`${q + dq},${r + dr}`)
        if (!nb || nb.terrain !== 'sea' || (nb.coastline_clip?.length ?? 0) > 0) continue
        const nk = `${nb.q},${nb.r}`
        if (!visited.has(nk)) { visited.add(nk); queue.push(nk) }
      }
    }
    return visited
  }, [generatedHexes, realisticCoastline, seaCoastKeys])
  const oceanSeaKeysRef = useRef(oceanSeaKeys)
  oceanSeaKeysRef.current = oceanSeaKeys

  const defaultTerrainBlobs = useMemo(() => {
    if (projectedHexes.length === 0 || hexRadius === 0) return []
    const overriddenKeys = new Set(Object.keys(terrainBlobOverrides))
    const terrainTypeSet = new Set<string>()
    for (const p of projectedHexes) {
      const h = p.hex as GeneratedHex
      // Pure-sea no-clip hexes: excluded from blobs when realistic coastline is on
      // (sea mask handles them). When off, they go through normally into the sea blob.
      if (realisticCoastline && h.terrain === 'sea' && (!h.coastline_clip || h.coastline_clip.length === 0)) continue
      // Coastal hexes (with clip) ALWAYS contribute their effectiveLandTerrain to land terrain
      // blobs regardless of the toggle — this keeps blob shapes stable when toggling.
      // When off, they also retain their base sea terrain so the sea blob still covers them visually.
      const terrains = coastalBlobTerrains(h, realisticCoastline)
      for (const t of terrains) {
        if (t !== 'clear' && t !== 'lake') terrainTypeSet.add(t)
      }
    }
    const terrainTypes = [...terrainTypeSet]
    // Each terrain type is computed independently so cross-terrain blob coupling is impossible.
    return terrainTypes.flatMap(terrain => {
      const componentMap = blobComponentsByTerrain.get(terrain) ?? new Map<string, string>()
      const terrainProjected = projectedHexes.filter(p => {
        const h = p.hex as GeneratedHex
        if (realisticCoastline && h.terrain === 'sea' && (!h.coastline_clip || h.coastline_clip.length === 0)) return false
        const terrains = coastalBlobTerrains(h, realisticCoastline)
        if (!terrains.includes(terrain)) return false
        if (overriddenKeys.size > 0) {
          const ck = componentMap.get(`${h.q},${h.r}`)
          if (ck && overriddenKeys.has(ck)) return false
        }
        return true
      }).map(p => ({ ...p, hex: { ...p.hex, terrain } }))
      if (terrainProjected.length === 0) return []
      return buildTerrainBlobsV2(terrainProjected, terrainBlobSmooth, terrainBlobOffset, terrainBlobBump, terrainBlobSweepFreq, terrainBlobLobeFreq, terrainBlobLobeAmp, terrainBlobLobeThreshold, terrainBlobLobeDirection, hexRadius)
    })
  }, [projectedHexes, blobComponentsByTerrain, terrainBlobOverrides, terrainBlobSmooth, terrainBlobOffset, terrainBlobBump, terrainBlobSweepFreq, terrainBlobLobeFreq, terrainBlobLobeAmp, terrainBlobLobeThreshold, terrainBlobLobeDirection, hexRadius, realisticCoastline])
  const defaultTerrainBlobsRef = useRef(defaultTerrainBlobs)
  defaultTerrainBlobsRef.current = defaultTerrainBlobs

  const defaultLakeBlobs = useMemo(() => {
    if (projectedHexes.length === 0 || hexRadius === 0) return []
    const lakeOverriddenKeys = new Set(Object.keys(lakeOverrides))
    const defaultLakeProjected = projectedHexes
      .filter(p => {
        if (!(p.hex.isLake ?? false)) return false
        const ck = blobComponents.get(`${p.hex.q},${p.hex.r}`)
        return !ck || !lakeOverriddenKeys.has(ck)
      })
      .map(p => ({ hex: { ...p.hex, terrain: 'lake' }, verts: p.verts }))
    if (defaultLakeProjected.length === 0) return []
    return buildTerrainBlobsV2(defaultLakeProjected, lakeBlobSmooth, lakeBlobOffset, lakeBlobBump, lakeBlobSweepFreq, lakeBlobLobeFreq, lakeBlobLobeAmp, lakeBlobLobeThreshold, lakeBlobLobeDirection, hexRadius)
  }, [projectedHexes, blobComponents, lakeOverrides, lakeBlobSmooth, lakeBlobOffset, lakeBlobBump, lakeBlobSweepFreq, lakeBlobLobeFreq, lakeBlobLobeAmp, lakeBlobLobeThreshold, lakeBlobLobeDirection, hexRadius])
  const defaultLakeBlobsRef = useRef(defaultLakeBlobs)
  defaultLakeBlobsRef.current = defaultLakeBlobs

  // Compute the paper's screen rect and (lazily) init/update the overlay map
  const snapOverlay = useCallback(() => {
    const meta = metaRef.current
    if (!meta) return
    const { w: cssW, h: cssH } = frameDimsRef.current
    const { pw, ph } = computePaper(cssW, cssH, meta)
    const canvasZoom = zoomRef.current
    const pan = panRef.current

    // Screen-space position of the paper rect (applying the canvas pan/zoom transform)
    const screenW = pw * canvasZoom
    const screenH = ph * canvasZoom
    const screenX = cssW / 2 - screenW / 2 + pan.x
    const screenY = cssH / 2 - screenH / 2 + pan.y
    setOverlayRect({ left: screenX, top: screenY, width: screenW, height: screenH })

    // MapLibre zoom: screenW pixels should span the paper's real-world width.
    // MapLibre GL uses 512px world tiles → constant 78271.516 (same as mapResolutionMpx).
    const paperWidthM = meta.paper_mm[0] * meta.scale_m_per_mm
    const mlZoom = Math.log2(78271.516 * Math.cos(meta.center[1] * Math.PI / 180) * screenW / paperWidthM)

    requestAnimationFrame(() => {
      const el = overlayContainerRef.current
      if (!el) return
      if (!overlayMapRef.current) {
        overlayMapRef.current = new maplibregl.Map({
          container: el,
          style: OSM_OVERLAY_STYLE,
          center: meta.center,
          zoom: mlZoom,
          bearing: meta.bearing,
          interactive: false,
          attributionControl: false,
        })
      } else {
        overlayMapRef.current.resize()
        overlayMapRef.current.jumpTo({ center: meta.center, zoom: mlZoom, bearing: meta.bearing })
      }
    })
  }, [])

  // Spacebar: hold to peek
  useEffect(() => {
    let held = false
    const onDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || held) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      e.preventDefault()
      held = true
      snapOverlay()
      setMapOverlay(true)
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      held = false
      setMapOverlay(false)
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp) }
  }, [snapOverlay])

  type ExportTarget = { canvas: HTMLCanvasElement; pw: number; ph: number }

  const draw = useCallback((exportTarget?: ExportTarget) => {
    const canvas = exportTarget ? exportTarget.canvas : canvasRef.current
    const meta = metaRef.current
    const hexes = hexesRef.current
    const { w: frameCssW, h: frameCssH } = frameDimsRef.current
    if (!canvas || !meta || (!exportTarget && frameCssW === 0) || hexes.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const getPattern = (img: HTMLImageElement): CanvasPattern | null => {
      const cache = patternCacheRef.current
      let pat = cache.get(img)
      if (!pat) {
        pat = ctx.createPattern(img, 'repeat') ?? undefined
        if (pat) cache.set(img, pat)
      }
      return pat ?? null
    }

    const isExport = !!exportTarget
    const dpr = isExport ? 1 : (window.devicePixelRatio || 1)
    const zoom = isExport ? 1 : zoomRef.current
    // Offscreen canvases are capped at zoom=4 equivalent to avoid browser canvas size limits.
    // The main canvas zoom transform handles magnification above that level.
    const offZoom = Math.min(zoom, 4)
    const pan = isExport ? { x: 0, y: 0 } : panRef.current
    const selected = exportTarget ? null : selectedHexRef.current
    const borderMode = hexBorderModeRef.current
    const edgeMode = hexEdgeModeRef.current
    const { pw, ph, px, py } = exportTarget
      ? { pw: exportTarget.pw, ph: exportTarget.ph, px: 0, py: 0 }
      : computePaper(frameCssW, frameCssH, meta)
    const cssW = exportTarget ? pw : frameCssW
    const cssH = exportTarget ? ph : frameCssH

    // Reset to identity, clear
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // DPR base transform
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Dark surround (outside paper)
    ctx.fillStyle = '#1a1a2a'
    ctx.fillRect(0, 0, cssW, cssH)

    // Pan/zoom transform centred on canvas
    ctx.save()
    ctx.translate(cssW / 2 + pan.x, cssH / 2 + pan.y)
    ctx.scale(zoom, zoom)
    ctx.translate(-cssW / 2, -cssH / 2)

    // Paper shadow
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 16
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(px, py, pw, ph)
    ctx.shadowBlur = 0
    ctx.shadowColor = 'transparent'

    const mmToPx = pw / meta.paper_mm[0]
    const mgPx = meta.margin_mm * mmToPx
    const marginL = px + mgPx, marginR = px + pw - mgPx
    const marginT = py + mgPx, marginB = py + ph - mgPx

    // Full hexes: only draw if all vertices inside margin.
    // Partial hexes: draw clipped at the margin boundary.
    const inMargin = (verts: [number, number][]) =>
      verts.every(([x, y]) => x >= marginL && x <= marginR && y >= marginT && y <= marginB)

    const project = (lon: number, lat: number): [number, number] =>
      projectToCanvas(lon, lat, meta, pw, ph, px, py)

    const scalePxPerM = pw / (meta.scale_m_per_mm * meta.paper_mm[0])
    const R = meta.outer_radius_m * scalePxPerM

    // For screen rendering, use memoized projected coords (stable across zoom/pan).
    // For export, recompute with the export-specific paper dimensions.
    const projected = isExport
      ? hexes.map(hex => ({
          hex,
          verts: hex.vertices.map(([lon, lat]) => project(lon, lat) as [number, number]),
        }))
      : projectedHexesRef.current
    // Terrain rendering params — shared by offscreen and export paths
    const terrainParams = {
      projected,
      edgeMode,
      inMargin,
      terrainColors: terrainColorsRef.current,
      terrainTextureScales: terrainTextureScalesRef.current,
      clearTexture: clearTextureRef.current,
      forestTexture: forestTextureRef.current,
      lightWoodsTexture: lightWoodsTextureRef.current,
      marshTexture: marshTextureRef.current,
      renderMode: terrainRenderModeRef.current,
      fieldCanvas: fieldCanvasRef.current,
      px, py, pw, ph,
      defaultTerrainBlobs: defaultTerrainBlobsRef.current,
      defaultLakeBlobs: defaultLakeBlobsRef.current,
      terrainBlobOverrides: terrainBlobOverridesRef.current,
      lakeOverrides: lakeOverridesRef.current,
      blobComponents: blobComponentsRef.current,
      blobComponentsByTerrain: blobComponentsByTerrainRef.current,
      terrainBlobParams: {
        smooth: terrainBlobSmoothRef.current, offset: terrainBlobOffsetRef.current,
        bump: terrainBlobBumpRef.current, sweepFreq: terrainBlobSweepFreqRef.current,
        lobeFreq: terrainBlobLobeFreqRef.current, lobeAmp: terrainBlobLobeAmpRef.current,
        lobeThreshold: terrainBlobLobeThresholdRef.current, lobeDirection: terrainBlobLobeDirectionRef.current,
      },
      lakeBlobParams: {
        smooth: lakeBlobSmoothRef.current, offset: lakeBlobOffsetRef.current,
        bump: lakeBlobBumpRef.current, sweepFreq: lakeBlobSweepFreqRef.current,
        lobeFreq: lakeBlobLobeFreqRef.current, lobeAmp: lakeBlobLobeAmpRef.current,
        lobeThreshold: lakeBlobLobeThresholdRef.current, lobeDirection: lakeBlobLobeDirectionRef.current,
      },
      hexes: hexesRef.current,
      hexTerrainLayers,
      R,
      realisticCoastline: realisticCoastlineRef.current,
      coastlineClips: projectedCoastlineClipsRef.current,
      seaCoastKeys: seaCoastKeysRef.current,
      oceanSeaKeys: oceanSeaKeysRef.current,
      beachStrip: beachStripRef.current,
      beachColor: beachColorRef.current,
      beachWidth: beachWidthRef.current,
    }

    // Build offscreen terrain layer when dirty (skipped for export — always renders inline)
    if (!isExport) {
      const papW = Math.ceil(pw), papH = Math.ceil(ph)
      if (terrainDirtyRef.current || !terrainLayerRef.current ||
          terrainLayerPapWRef.current !== papW || terrainLayerPapHRef.current !== papH) {
        const offW = Math.ceil(pw * dpr * offZoom), offH = Math.ceil(ph * dpr * offZoom)
        const offscreen = new OffscreenCanvas(offW, offH)
        const oCtx = offscreen.getContext('2d')!
        oCtx.scale(dpr * offZoom, dpr * offZoom)
        oCtx.translate(-px, -py)
        oCtx.save()
        oCtx.beginPath()
        oCtx.rect(marginL, marginT, marginR - marginL, marginB - marginT)
        oCtx.clip()
        _drawTerrain(oCtx, terrainParams)
        oCtx.restore()
        terrainLayerRef.current = offscreen
        terrainDirtyRef.current = false
        terrainLayerPapWRef.current = papW
        terrainLayerPapHRef.current = papH
      }
    }

    // Draw with margin clip active (clips partial hexes at boundary)
    ctx.save()
    ctx.beginPath()
    ctx.rect(marginL, marginT, marginR - marginL, marginB - marginT)
    ctx.clip()
    // Blit terrain layer for screen rendering
    if (!isExport && terrainLayerRef.current) {
      ctx.drawImage(terrainLayerRef.current, px, py, pw, ph)
    }
    if (isExport || !terrainLayerRef.current) {
      let exportTerrainBlobs = terrainParams.defaultTerrainBlobs
      let exportLakeBlobs = terrainParams.defaultLakeBlobs
      if (isExport && terrainRenderModeRef.current === 'blob') {
        const overriddenKeys = new Set(Object.keys(terrainBlobOverridesRef.current))
        const components = blobComponentsRef.current
        const terrainTypeSet = new Set<string>()
        for (const p of projected) {
          for (const t of hexTerrainLayers(p.hex as GeneratedHex)) {
            if (t !== 'clear' && t !== 'lake') terrainTypeSet.add(t)
          }
        }
        exportTerrainBlobs = [...terrainTypeSet].flatMap(terrain => {
          const componentMap = blobComponentsByTerrainRef.current.get(terrain) ?? new Map<string, string>()
          const terrainProjected = projected.filter(p => {
            if (!hexTerrainLayers(p.hex as GeneratedHex).includes(terrain)) return false
            if (overriddenKeys.size > 0) {
              const ck = componentMap.get(`${p.hex.q},${p.hex.r}`)
              if (ck && overriddenKeys.has(ck)) return false
            }
            return true
          }).map(p => ({ ...p, hex: { ...p.hex, terrain } }))
          if (terrainProjected.length === 0) return []
          return buildTerrainBlobsV2(terrainProjected, terrainBlobSmoothRef.current, terrainBlobOffsetRef.current, terrainBlobBumpRef.current, terrainBlobSweepFreqRef.current, terrainBlobLobeFreqRef.current, terrainBlobLobeAmpRef.current, terrainBlobLobeThresholdRef.current, terrainBlobLobeDirectionRef.current, R)
        })
        const lakeOverriddenKeys = new Set(Object.keys(lakeOverridesRef.current))
        const defaultLakeProjected = projected
          .filter(p => {
            if (!(p.hex.isLake ?? false)) return false
            const ck = components.get(`${p.hex.q},${p.hex.r}`)
            return !ck || !lakeOverriddenKeys.has(ck)
          })
          .map(p => ({ hex: { ...p.hex, terrain: 'lake' }, verts: p.verts }))
        exportLakeBlobs = defaultLakeProjected.length > 0
          ? buildTerrainBlobsV2(defaultLakeProjected, lakeBlobSmoothRef.current, lakeBlobOffsetRef.current, lakeBlobBumpRef.current, lakeBlobSweepFreqRef.current, lakeBlobLobeFreqRef.current, lakeBlobLobeAmpRef.current, lakeBlobLobeThresholdRef.current, lakeBlobLobeDirectionRef.current, R)
          : []
      }
      _drawTerrain(ctx, { ...terrainParams, defaultTerrainBlobs: exportTerrainBlobs, defaultLakeBlobs: exportLakeBlobs })
    }

    // Hex borders — offscreen cached
    if (borderMode !== 'none') {
      if (!isExport) {
        const papW = Math.ceil(pw), papH = Math.ceil(ph)
        if (hexBorderDirtyRef.current || !hexBorderLayerRef.current ||
            hexBorderLayerPapWRef.current !== papW || hexBorderLayerPapHRef.current !== papH) {
          const offW = Math.ceil(pw * dpr * offZoom), offH = Math.ceil(ph * dpr * offZoom)
          const offscreen = new OffscreenCanvas(offW, offH)
          const oCtx = offscreen.getContext('2d')!
          oCtx.scale(dpr * offZoom, dpr * offZoom)
          oCtx.translate(-px, -py)
          oCtx.save()
          oCtx.beginPath()
          oCtx.rect(marginL, marginT, marginR - marginL, marginB - marginT)
          oCtx.clip()
          _drawHexBorders(oCtx, projected, borderMode, edgeMode, inMargin)
          oCtx.restore()
          hexBorderLayerRef.current = offscreen
          hexBorderDirtyRef.current = false
          hexBorderLayerPapWRef.current = papW
          hexBorderLayerPapHRef.current = papH
        }
        ctx.drawImage(hexBorderLayerRef.current, px, py, pw, ph)
      }
      if (isExport) {
        _drawHexBorders(ctx, projected, borderMode, edgeMode, inMargin)
      }
    }

    // Selected hex highlight
    if (selected) {
      const hex = hexes.find(h => h.q === selected.q && h.r === selected.r)
      if (hex) {
        const verts = hex.vertices.map(([lon, lat]) => project(lon, lat))
        ctx.beginPath()
        ctx.moveTo(verts[0][0], verts[0][1])
        for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i][0], verts[i][1])
        ctx.closePath()
        ctx.strokeStyle = '#ff0000'
        ctx.lineWidth = 2
        ctx.stroke()
      }
    }

    // Hex highlights — offscreen cached (joined highlights + line highlights)
    {

      if (!isExport) {
        const papW = Math.ceil(pw), papH = Math.ceil(ph)
        if (joinedHighlightsDirtyRef.current || !joinedHighlightsLayerRef.current ||
            joinedHighlightsLayerPapWRef.current !== papW || joinedHighlightsLayerPapHRef.current !== papH) {
          const offW = Math.ceil(pw * dpr * offZoom), offH = Math.ceil(ph * dpr * offZoom)
          const offscreen = new OffscreenCanvas(offW, offH)
          const oCtx = offscreen.getContext('2d')!
          oCtx.scale(dpr * offZoom, dpr * offZoom)
          oCtx.translate(-px, -py)
          _drawHighlights(oCtx, { highlights: highlightsRef.current, highlightedHexes: highlightedHexesRef.current, highlightLines: highlightLinesRef.current, highlightEdgePaths: highlightEdgePathsRef.current, projected, edgeMode, R, project, inMargin })
          joinedHighlightsLayerRef.current = offscreen
          joinedHighlightsDirtyRef.current = false
          joinedHighlightsLayerPapWRef.current = papW
          joinedHighlightsLayerPapHRef.current = papH
        }
        ctx.drawImage(joinedHighlightsLayerRef.current, px, py, pw, ph)
      }
      if (isExport) {
        _drawHighlights(ctx, { highlights: highlightsRef.current, highlightedHexes: highlightedHexesRef.current, highlightLines: highlightLinesRef.current, highlightEdgePaths: highlightEdgePathsRef.current, projected, edgeMode, R, project, inMargin })
      }

      // Hover preview for edge-paint mode — drawn directly on ctx, not cached
      if (!isExport) {
        const hov = hoveredEdgeRef.current
        if (hov) {
          const proj = projected.find(p => p.hex.q === hov.hexQ && p.hex.r === hov.hexR)
          if (proj) {
            const v0 = proj.verts[hov.edgeI]
            const v1 = proj.verts[(hov.edgeI + 1) % 6]
            ctx.save()
            ctx.strokeStyle = 'rgba(255,255,255,0.85)'
            ctx.lineWidth = 3
            ctx.lineCap = 'round'
            ctx.setLineDash([4, 4])
            ctx.beginPath()
            ctx.moveTo(v0[0], v0[1])
            ctx.lineTo(v1[0], v1[1])
            ctx.stroke()
            ctx.setLineDash([])
            ctx.restore()
          }
        }
      }
    }

    // Rivers — offscreen cached
    const lakeProjCenters = projected
      .filter(({ hex }) => hex.isLake)
      .map(({ verts }) => ({
        px: verts.reduce((s, v) => s + v[0], 0) / 6,
        py: verts.reduce((s, v) => s + v[1], 0) / 6,
      }))

    const riverChainData = buildRiverChains(riverEdgesRef.current, hexesRef.current)
    const canalChainData = buildRiverChains(canalEdgesRef.current, hexesRef.current)
    computedRiverChainsRef.current = riverChainData
    computedCanalChainsRef.current = canalChainData
    riverChainCache.chains = riverChainData

    const riverParams = {
      riverChainData,
      canalChainData,
      riverSegProps: riverSegmentPropsRef.current,
      canalSegProps: canalSegmentPropsRef.current,
      riverStyle: riverStyleRef.current,
      canalStyle: canalStyleRef.current,
      selectedRiverKeys: new Set(selectedSegmentKeysRef.current),
      selectedCanalKeys: new Set(selectedCanalSegmentKeysRef.current),
      riverBaseHW: 1.4 * riverWidthScaleRef.current,
      canalBaseHW: 1.4 * canalWidthScaleRef.current,
      lakeProjCenters,
      smoothPasses: riverCurveStepsRef.current,
      wobbleBroad: riverWobbleRef.current * R * 0.5,
      wobbleDetail: riverDetailRef.current * R * 0.18,
      R,
      project,
    }

    if (!isExport) {
      const papW = Math.ceil(pw), papH = Math.ceil(ph)
      if (riversDirtyRef.current || !riversLayerRef.current ||
          riversLayerPapWRef.current !== papW || riversLayerPapHRef.current !== papH) {
        const offW = Math.ceil(pw * dpr * offZoom), offH = Math.ceil(ph * dpr * offZoom)
        const offscreen = new OffscreenCanvas(offW, offH)
        const oCtx = offscreen.getContext('2d')!
        oCtx.scale(dpr * offZoom, dpr * offZoom)
        oCtx.translate(-px, -py)
        oCtx.save()
        oCtx.beginPath()
        oCtx.rect(marginL, marginT, marginR - marginL, marginB - marginT)
        oCtx.clip()
        _drawRivers(oCtx, riverParams)
        oCtx.restore()
        riversLayerRef.current = offscreen
        riversDirtyRef.current = false
        riversLayerPapWRef.current = papW
        riversLayerPapHRef.current = papH
      }
      ctx.drawImage(riversLayerRef.current, px, py, pw, ph)
    }
    if (isExport) {
      _drawRivers(ctx, riverParams)
    }

    // Urban area buildings + settlement buildings (rendered below roads)
    {
      const { chains: roadChains } = smoothedRoadDataRef.current
      const roadStyles = roadTierStylesRef.current

      // Invalidate geometry cache when inputs that affect building layout change
      {
        const currentZoom = Math.round(zoomRef.current * 10)
        const epoch = lastBuildingCacheEpochRef.current
        if (!epoch ||
            epoch.roadData !== smoothedRoadDataRef.current ||
            epoch.zoom !== currentZoom ||
            epoch.settlementStyles !== settlementTierStylesRef.current ||
            epoch.urbanStyle !== urbanStyleRef.current) {
          hexBuildingGeoCacheRef.current.clear()
          lastBuildingCacheEpochRef.current = {
            roadData: smoothedRoadDataRef.current,
            zoom: currentZoom,
            settlementStyles: settlementTierStylesRef.current,
            urbanStyle: urbanStyleRef.current,
          }
        }
      }


      if (!isExport) {
        const papW = Math.ceil(pw), papH = Math.ceil(ph)
        if (buildingsDirtyRef.current || !buildingsLayerRef.current ||
            buildingsLayerPapWRef.current !== papW || buildingsLayerPapHRef.current !== papH) {
          // Clear geometry cache so buildings are re-generated into the new offscreen context
          hexBuildingGeoCacheRef.current.clear()
          const offW = Math.ceil(pw * dpr * offZoom), offH = Math.ceil(ph * dpr * offZoom)
          const offscreen = new OffscreenCanvas(offW, offH)
          const oCtx = offscreen.getContext('2d')!
          oCtx.scale(dpr * offZoom, dpr * offZoom)
          oCtx.translate(-px, -py)
          oCtx.save()
          oCtx.beginPath()
          oCtx.rect(marginL, marginT, marginR - marginL, marginB - marginT)
          oCtx.clip()
          _drawAllBuildings(oCtx, { hexes: hexesRef.current, urbanHexes: urbanHexesRef.current, urbanStyle: urbanStyleRef.current, settlements: settlementsRef.current, settlementTierStyles: settlementTierStylesRef.current, roadChains, roadTierStyles: roadTierStylesRef.current, hexBuildingGeoCache: hexBuildingGeoCacheRef.current, project })
          _drawAllBuildingsV2(oCtx, { hexes: hexesRef.current, urbanHexes: urbanHexesRef.current, urbanStyle: urbanStyleRef.current, settlements: settlementsRef.current, settlementTierStyles: settlementTierStylesRef.current, roadChains, roadTierStyles: roadTierStylesRef.current, project })
          oCtx.restore()
          buildingsLayerRef.current = offscreen
          buildingsDirtyRef.current = false
          buildingsLayerPapWRef.current = papW
          buildingsLayerPapHRef.current = papH
        }
        ctx.drawImage(buildingsLayerRef.current, px, py, pw, ph)
      }
      if (isExport) {
        _drawAllBuildings(ctx, { hexes: hexesRef.current, urbanHexes: urbanHexesRef.current, urbanStyle: urbanStyleRef.current, settlements: settlementsRef.current, settlementTierStyles: settlementTierStylesRef.current, roadChains, roadTierStyles: roadTierStylesRef.current, hexBuildingGeoCache: hexBuildingGeoCacheRef.current, project })
        _drawAllBuildingsV2(ctx, { hexes: hexesRef.current, urbanHexes: urbanHexesRef.current, urbanStyle: urbanStyleRef.current, settlements: settlementsRef.current, settlementTierStyles: settlementTierStylesRef.current, roadChains, roadTierStyles: roadTierStylesRef.current, project })
      }
    }

    // Road chains + Rail chains — offscreen cached together
    {
      const { chains: roadChains, junctions } = smoothedRoadDataRef.current
      const tierStyles = roadTierStylesRef.current


      if (!isExport) {
        const papW = Math.ceil(pw), papH = Math.ceil(ph)
        if (roadsDirtyRef.current || !roadsLayerRef.current ||
            roadsLayerPapWRef.current !== papW || roadsLayerPapHRef.current !== papH) {
          const offW = Math.ceil(pw * dpr * offZoom), offH = Math.ceil(ph * dpr * offZoom)
          const offscreen = new OffscreenCanvas(offW, offH)
          const oCtx = offscreen.getContext('2d')!
          oCtx.scale(dpr * offZoom, dpr * offZoom)
          oCtx.translate(-px, -py)
          oCtx.save()
          oCtx.beginPath()
          oCtx.rect(marginL, marginT, marginR - marginL, marginB - marginT)
          oCtx.clip()
          _drawRoadsAndRails(oCtx, { roadChains, junctions, railChains: smoothedRailChainsRef.current, tierStyles, railStyle: railStyleRef.current, project })
          oCtx.restore()
          roadsLayerRef.current = offscreen
          roadsDirtyRef.current = false
          roadsLayerPapWRef.current = papW
          roadsLayerPapHRef.current = papH
        }
        ctx.drawImage(roadsLayerRef.current, px, py, pw, ph)
      }
      if (isExport) {
        _drawRoadsAndRails(ctx, { roadChains, junctions, railChains: smoothedRailChainsRef.current, tierStyles, railStyle: railStyleRef.current, project })
      }
    }

    // Control point handles (visible when Roads panel active and no paint mode) — always inline
    if (roadNodeEditModeRef.current) {
      const { controlPoints } = smoothedRoadDataRef.current
      const overrides = roadControlOverridesRef.current

      // Determine merged/split state per junction hex.
      // A junction is split when its two jt| terminals are at different canvas positions.
      const jtByHex = new Map<string, { key: string; pos: [number, number] }[]>()
      for (const cp of controlPoints) {
        if (!cp.key.startsWith('jt|')) continue
        const hexKey = cp.key.split('|')[1]
        if (!jtByHex.has(hexKey)) jtByHex.set(hexKey, [])
        jtByHex.get(hexKey)!.push(cp)
      }
      const splitHexes = new Set<string>()
      for (const [hexKey, cps] of jtByHex) {
        if (cps.length < 2) continue
        const [ax, ay] = project(cps[0].pos[0], cps[0].pos[1])
        const [bx, by] = project(cps[1].pos[0], cps[1].pos[1])
        if (Math.hypot(ax - bx, ay - by) > 2) splitHexes.add(hexKey)
      }

      // Scale handles inversely with zoom so they stay a fixed screen size
      const handleScale = 1 / (zoomRef.current ?? 1)
      const juncR = 4 * handleScale
      const edgeR = 3 * handleScale
      const diamondR = 4 * handleScale

      ctx.save()
      for (const { key, pos } of controlPoints) {
        const isJunc = key.startsWith('ja|')
        const isSpineSide = key.startsWith('jt|')
        if (isSpineSide) {
          const hexKey = key.split('|')[1]
          if (!splitHexes.has(hexKey)) continue
        }
        if (isJunc) {
          const hexKey = key.slice(3)
          if (splitHexes.has(hexKey)) continue
        }
        const [x, y] = project(pos[0], pos[1])
        const overridden = !!overrides[key]
        ctx.beginPath()
        if (isSpineSide) {
          const r = diamondR
          ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath()
        } else {
          ctx.arc(x, y, isJunc ? juncR : edgeR, 0, Math.PI * 2)
        }
        ctx.fillStyle = overridden ? '#ffcc44' : 'rgba(255,255,255,0.6)'
        ctx.fill()
        ctx.strokeStyle = isSpineSide ? '#4488cc' : isJunc ? '#cc8800' : '#888'
        ctx.lineWidth = handleScale
        ctx.stroke()
      }

      // Snap preview: highlight the target diamond and the dragged diamond when close enough to merge
      const snapTarget = snapPreviewKeyRef.current
      const dragKey = draggingCpKeyRef.current
      if (snapTarget) {
        for (const hlKey of [snapTarget, dragKey]) {
          if (!hlKey) continue
          const cp = controlPoints.find(c => c.key === hlKey)
          if (!cp) continue
          const [x, y] = project(cp.pos[0], cp.pos[1])
          const r = diamondR * 1.8
          ctx.beginPath()
          ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath()
          ctx.fillStyle = 'rgba(255, 220, 40, 0.35)'
          ctx.fill()
          ctx.strokeStyle = '#ffdd00'
          ctx.lineWidth = handleScale * 2
          ctx.stroke()
        }
      }
      ctx.restore()
    }

    // Settlements — offscreen cached
    {

      if (!isExport) {
        const papW = Math.ceil(pw), papH = Math.ceil(ph)
        if (settlementsDirtyRef.current || !settlementsLayerRef.current ||
            settlementsLayerPapWRef.current !== papW || settlementsLayerPapHRef.current !== papH) {
          const offW = Math.ceil(pw * dpr * offZoom), offH = Math.ceil(ph * dpr * offZoom)
          const offscreen = new OffscreenCanvas(offW, offH)
          const oCtx = offscreen.getContext('2d')!
          oCtx.scale(dpr * offZoom, dpr * offZoom)
          oCtx.translate(-px, -py)
          oCtx.save()
          oCtx.beginPath()
          oCtx.rect(marginL, marginT, marginR - marginL, marginB - marginT)
          oCtx.clip()
          _drawSettlements(oCtx, { settlements: settlementsRef.current, tierStyles: settlementTierStylesRef.current, roadChains: smoothedRoadDataRef.current.chains, railChains: smoothedRailChainsRef.current, project, hexCenterOf: (q, r) => { const h = hexesRef.current.find(h => h.q === q && h.r === r); return h ? project(h.center[0], h.center[1]) : null } })
          oCtx.restore()
          settlementsLayerRef.current = offscreen
          settlementsDirtyRef.current = false
          settlementsLayerPapWRef.current = papW
          settlementsLayerPapHRef.current = papH
        }
        ctx.drawImage(settlementsLayerRef.current, px, py, pw, ph)
      }
      if (isExport) {
        _drawSettlements(ctx, { settlements: settlementsRef.current, tierStyles: settlementTierStylesRef.current, roadChains: smoothedRoadDataRef.current.chains, railChains: smoothedRailChainsRef.current, project, hexCenterOf: (q, r) => { const h = hexesRef.current.find(h => h.q === q && h.r === r); return h ? project(h.center[0], h.center[1]) : null } })
      }
    }

    ctx.restore() // clip

    if (!exportTarget) {
      // Margin indicator — dashed inset rectangle (screen only)
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'
      ctx.lineWidth = 0.75
      ctx.setLineDash([4, 4])
      ctx.strokeRect(px + mgPx, py + mgPx, pw - mgPx * 2, ph - mgPx * 2)
      ctx.setLineDash([])

      // Diptych seam line — matches the paper frame border style
      if (mapModeRef.current === 'diptych') {
        const [spwMm, sphMm] = paperDimsMm(paperSizeRef.current, orientationRef.current)
        const [scwMm] = combinedDimsMm(paperSizeRef.current, orientationRef.current, mapModeRef.current, diptychJoinRef.current)
        const seamIsVertical = scwMm === 2 * spwMm
        ctx.strokeStyle = 'rgba(220, 60, 0, 0.9)'
        ctx.lineWidth = 2 / zoom
        ctx.beginPath()
        if (seamIsVertical) {
          ctx.moveTo(px + pw / 2, py)
          ctx.lineTo(px + pw / 2, py + ph)
        } else {
          ctx.moveTo(px, py + ph / 2)
          ctx.lineTo(px + pw, py + ph / 2)
        }
        ctx.stroke()
      }
    }

    ctx.restore() // pan/zoom
  }, [])

  // Resize canvas buffer when frameDims changes, then redraw
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || frameDims.w === 0) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = frameDims.w * dpr
    canvas.height = frameDims.h * dpr
    canvas.style.width = `${frameDims.w}px`
    canvas.style.height = `${frameDims.h}px`
    frameDimsRef.current = frameDims
    draw()
  }, [frameDims, draw])

  // Regenerate field canvas when field params or hexes change
  useEffect(() => {
    if (terrainRenderMode !== 'field') { fieldCanvasRef.current = null; draw(); return }
    const meta = metaRef.current
    const hexes = hexesRef.current
    const { w: cssW, h: cssH } = frameDimsRef.current
    if (!meta || hexes.length === 0 || cssW === 0) return
    const { pw, ph, px, py } = computePaper(cssW, cssH, meta)
    fieldCanvasRef.current = buildFieldCanvas(
      hexes, meta, pw, ph, px, py,
      window.devicePixelRatio || 1,
      fieldFreq, fieldAmp, fieldOctaves, fieldPersistence,
      fieldWildness, terrainColors, TERRAIN_COLORS,
    )
    terrainDirtyRef.current = true
    draw()
  }, [generatedHexes, terrainRenderMode, fieldFreq, fieldAmp, fieldOctaves, fieldPersistence, fieldWildness, terrainColors, frameDims, draw])

  // Mark terrain layer dirty when terrain-affecting data changes
  useEffect(() => { terrainDirtyRef.current = true }, [defaultTerrainBlobs, defaultLakeBlobs, terrainColors, terrainTextureScales, terrainBlobOverrides, lakeOverrides, terrainRenderMode, hexEdgeMode, generatedHexes, realisticCoastline, beachStrip, beachColor, beachWidth])

  // Mark other layer caches dirty when their relevant data changes
  useEffect(() => { hexBorderDirtyRef.current = true }, [hexBorderMode, hexEdgeMode, generatedHexes])
  useEffect(() => { joinedHighlightsDirtyRef.current = true }, [highlights, highlightedHexes, highlightLines])
  useEffect(() => { riversDirtyRef.current = true }, [riverEdges, canalEdges, riverWidthScale, canalWidthScale, riverCurveSteps, riverWobble, riverDetail, showRiverLabels, riverLabelColor, riverSegmentProps, canalSegmentProps, riverSelectMode, canalSelectMode, selectedSegmentKeys, selectedCanalSegmentKeys, riverStyle, canalStyle])
  useEffect(() => { buildingsDirtyRef.current = true }, [urbanHexes, urbanStyle, settlements, settlementTierStyles, smoothedRoadData])
  useEffect(() => { roadsDirtyRef.current = true }, [smoothedRoadData, smoothedRailChains, roadTierStyles, railStyle])
  useEffect(() => { settlementsDirtyRef.current = true }, [settlements, settlementTierStyles, smoothedRoadData, smoothedRailChains])

  // Redraw when data changes
  useEffect(() => { draw() }, [generatedHexes, selectedHex, hexBorderMode, hexEdgeMode, smoothedRoadData, smoothedRailChains, roadNodeEditMode, riverEdges, canalEdges, riverEditMode, canalEditMode, riverWidthScale, canalWidthScale, riverCurveSteps, riverWobble, riverDetail, showRiverLabels, riverLabelColor, riverSegmentProps, canalSegmentProps, riverSelectMode, canalSelectMode, selectedSegmentKeys, selectedCanalSegmentKeys, riverStyle, canalStyle, terrainBlobSmooth, terrainBlobOffset, terrainBlobBump, terrainBlobSweepFreq, terrainBlobLobeFreq, terrainBlobLobeAmp, terrainBlobLobeThreshold, terrainBlobLobeDirection, terrainColors, terrainTextureScales, lakeBlobSmooth, lakeBlobOffset, lakeBlobBump, lakeBlobSweepFreq, lakeBlobLobeFreq, lakeBlobLobeAmp, lakeBlobLobeThreshold, lakeBlobLobeDirection, terrainBlobOverrides, lakeOverrides, terrainRenderMode, settlements, settlementTierStyles, urbanHexes, urbanStyle, roadTierStyles, railStyle, highlights, highlightedHexes, highlightLines, highlightEdgePaths, realisticCoastline, beachStrip, beachColor, beachWidth, draw])

  // Load terrain textures
  useEffect(() => {
    const img = new Image()
    img.src = new URL('../../textures/forest.png', import.meta.url).href
    img.onload = () => { forestTextureRef.current = img; terrainDirtyRef.current = true; draw() }
  }, [draw])

  useEffect(() => {
    const img = new Image()
    img.src = new URL('../../textures/lightforest.png', import.meta.url).href
    img.onload = () => { lightWoodsTextureRef.current = img; terrainDirtyRef.current = true; draw() }
  }, [draw])

  useEffect(() => {
    const img = new Image()
    img.src = new URL('../../textures/clear.png', import.meta.url).href
    img.onload = () => { clearTextureRef.current = img; terrainDirtyRef.current = true; draw() }
  }, [draw])

  useEffect(() => {
    const img = new Image()
    img.src = new URL('../../textures/marsh.png', import.meta.url).href
    img.onload = () => { marshTextureRef.current = img; terrainDirtyRef.current = true; draw() }
  }, [draw])

  // Invalidate highlights offscreen layer whenever highlight data changes
  useEffect(() => { joinedHighlightsDirtyRef.current = true }, [highlights, highlightedHexes, highlightLines, highlightEdgePaths])

  // ResizeObserver — canvas fills the full container
  const meta = generatedMetadata
  useEffect(() => {
    const el = containerRef.current
    if (!el || !meta) return
    const compute = () => {
      setFrameDims({ w: Math.round(el.clientWidth), h: Math.round(el.clientHeight) })
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [meta])

  // Set zoom so 1 CSS pixel = 1/96 inch → physical hex size matches screen
  const zoomToPhysical = useCallback(() => {
    const meta = generatedMetadata
    if (!meta) return
    const { w: cssW, h: cssH } = frameDimsRef.current
    const { pw } = computePaper(cssW, cssH, meta)
    const targetZoom = Math.max(0.2, Math.min(6, meta.paper_mm[0] * 96 / (pw * 25.4)))
    zoomRef.current = targetZoom
    panRef.current = { x: 0, y: 0 }
    terrainDirtyRef.current = true
    hexBorderDirtyRef.current = true
    joinedHighlightsDirtyRef.current = true
    riversDirtyRef.current = true
    buildingsDirtyRef.current = true
    roadsDirtyRef.current = true
    settlementsDirtyRef.current = true
    draw()
  }, [generatedMetadata, draw])

  // Wheel zoom — cursor-centred, clamped [0.2, 20]
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const cx = e.clientX - rect.left - rect.width / 2
      const cy = e.clientY - rect.top - rect.height / 2
      const oldZoom = zoomRef.current
      const factor = e.deltaY < 0 ? 1.12 : 0.9
      const newZoom = Math.max(0.2, Math.min(20, oldZoom * factor))
      const scale = newZoom / oldZoom
      const oldPan = panRef.current
      zoomRef.current = newZoom
      panRef.current = {
        x: cx * (1 - scale) + oldPan.x * scale,
        y: cy * (1 - scale) + oldPan.y * scale,
      }
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(() => { rafRef.current = null; draw() })
      // Rebuild all offscreen layers at settled zoom for crisp quality
      if (terrainZoomSettleRef.current !== null) clearTimeout(terrainZoomSettleRef.current)
      terrainZoomSettleRef.current = setTimeout(() => {
        terrainZoomSettleRef.current = null
        terrainDirtyRef.current = true
        hexBorderDirtyRef.current = true
        joinedHighlightsDirtyRef.current = true
        riversDirtyRef.current = true
        buildingsDirtyRef.current = true
        roadsDirtyRef.current = true
        settlementsDirtyRef.current = true
        draw()
      }, 150)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [draw])

  // Drag pan (left-click drag or middle-mouse — left is suppressed in paint mode)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onDown = (e: MouseEvent) => {
      if (e.button !== 1 && e.button !== 0) return
      if (e.button === 0 && (e.target as HTMLElement).tagName !== 'CANVAS') return
      if (e.button === 0 && (terrainPaintModeRef.current || roadPaintModeRef.current || railPaintModeRef.current || riverEditModeRef.current || lakePaintModeRef.current)) return
      if (e.button === 0 && activePanelRef.current === 'highlights' && (highlightPaintModeRef.current || highlightLineEraserRef.current)) return
      if (e.button === 0 && draggingCpKeyRef.current) return
      e.preventDefault()
      isPanningRef.current = true
      panStartRef.current = { x: e.clientX, y: e.clientY }
      panOriginRef.current = { ...panRef.current }
      el.style.cursor = 'grabbing'
    }
    const onMove = (e: MouseEvent) => {
      if (!isPanningRef.current) return
      panRef.current = {
        x: panOriginRef.current.x + e.clientX - panStartRef.current.x,
        y: panOriginRef.current.y + e.clientY - panStartRef.current.y,
      }
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(() => { rafRef.current = null; draw() })
    }
    const onUp = () => {
      isPanningRef.current = false
      el.style.cursor = ''
    }
    el.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      el.removeEventListener('mousedown', onDown)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [draw])

  // Global Escape key: deactivate the current tool
  const setActiveToolRef = useRef(setActiveTool)
  setActiveToolRef.current = setActiveTool
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      setActiveToolRef.current({ type: 'none' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const clientToLogical = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    const { w: cssW, h: cssH } = frameDimsRef.current
    if (!canvas || cssW === 0) return null
    const rect = canvas.getBoundingClientRect()
    const zoom = zoomRef.current, pan = panRef.current
    return {
      lx: (clientX - rect.left - cssW / 2 - pan.x) / zoom + cssW / 2,
      ly: (clientY - rect.top - cssH / 2 - pan.y) / zoom + cssH / 2,
      cssW,
      cssH,
    }
  }, [])

  // Paint on drag
  const isPaintingRef = useRef(false)
  const lastPaintedKeyRef = useRef<string | null>(null)

  const paintAtClient = useCallback((clientX: number, clientY: number) => {
    const meta = metaRef.current
    if (!meta) return
    const logical = clientToLogical(clientX, clientY)
    if (!logical) return
    const { lx, ly, cssW, cssH } = logical
    const { pw, ph, px, py } = computePaper(cssW, cssH, meta)
    const mgPx = meta.margin_mm * (pw / meta.paper_mm[0])
    const marginL = px + mgPx, marginR = px + pw - mgPx
    const marginT = py + mgPx, marginB = py + ph - mgPx
    const inMargin = (verts: [number, number][]) =>
      verts.every(([x, y]) => x >= marginL && x <= marginR && y >= marginT && y <= marginB)
    for (const hex of hexesRef.current) {
      if (hexEdgeModeRef.current === 'whole' && hex.partial) continue
      const verts = hex.vertices.map(([lon, lat]) => projectToCanvas(lon, lat, meta, pw, ph, px, py))
      if (!hex.partial && !inMargin(verts)) continue
      if (pointInPolygon(lx, ly, verts)) {
        const key = `${hex.q},${hex.r}`
        if (key !== lastPaintedKeyRef.current) {
          lastPaintedKeyRef.current = key
          const brush = terrainPaintBrushRef.current
          if (terrainLayersEnabledRef.current && brush !== 'clear') {
            addHexTerrainLayerRef.current(hex.q, hex.r, brush)
          } else {
            overrideHexTerrainRef.current(hex.q, hex.r, brush)
          }
        }
        break
      }
    }
  }, [clientToLogical])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      if ((e.target as HTMLElement).tagName !== 'CANVAS') return
      if (!terrainPaintModeRef.current) return
      isPaintingRef.current = true
      lastPaintedKeyRef.current = null
      paintAtClient(e.clientX, e.clientY)
    }
    const onMove = (e: MouseEvent) => {
      if (!isPaintingRef.current || !terrainPaintModeRef.current) return
      paintAtClient(e.clientX, e.clientY)
    }
    const onUp = () => { isPaintingRef.current = false }
    el.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      el.removeEventListener('mousedown', onDown)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [paintAtClient])

  // Road/rail paint — edge between consecutive hexes visited in a stroke
  const prevEdgeHexRef = useRef<{ q: number; r: number } | null>(null)

  const roadRailPaintAtClient = useCallback((clientX: number, clientY: number) => {
    const meta = metaRef.current
    if (!meta) return
    const logical = clientToLogical(clientX, clientY)
    if (!logical) return
    const { lx, ly, cssW, cssH } = logical
    const { pw, ph, px, py } = computePaper(cssW, cssH, meta)
    const mgPx = meta.margin_mm * (pw / meta.paper_mm[0])
    const marginL = px + mgPx, marginR = px + pw - mgPx
    const marginT = py + mgPx, marginB = py + ph - mgPx
    const inMargin = (verts: [number, number][]) =>
      verts.every(([x, y]) => x >= marginL && x <= marginR && y >= marginT && y <= marginB)

    for (const hex of hexesRef.current) {
      if (hexEdgeModeRef.current === 'whole' && hex.partial) continue
      const verts = hex.vertices.map(([lon, lat]) => projectToCanvas(lon, lat, meta, pw, ph, px, py))
      if (!hex.partial && !inMargin(verts)) continue
      if (!pointInPolygon(lx, ly, verts)) continue

      const isRoad = roadPaintModeRef.current
      const isRail = railPaintModeRef.current

      if (isRoad) {
        const tier = roadPaintBrushRef.current
        const eraser = roadPaintEraserRef.current
        if (eraser) {
          removeRoadHexEdgesRef.current(hex.q, hex.r, tier)
        } else {
          const prev = prevEdgeHexRef.current
          if (prev && (prev.q !== hex.q || prev.r !== hex.r) && hexAdjacent(prev.q, prev.r, hex.q, hex.r)) {
            addRoadEdgeRef.current(prev.q, prev.r, hex.q, hex.r, tier)
          }
        }
      } else if (isRail) {
        const eraser = railPaintEraserRef.current
        if (eraser) {
          removeRailHexEdgesRef.current(hex.q, hex.r)
        } else {
          const prev = prevEdgeHexRef.current
          if (prev && (prev.q !== hex.q || prev.r !== hex.r) && hexAdjacent(prev.q, prev.r, hex.q, hex.r)) {
            addRailEdgeRef.current(prev.q, prev.r, hex.q, hex.r)
          }
        }
      }

      prevEdgeHexRef.current = { q: hex.q, r: hex.r }
      break
    }
  }, [clientToLogical])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      if ((e.target as HTMLElement).tagName !== 'CANVAS') return
      if (!roadPaintModeRef.current && !railPaintModeRef.current) return
      isPaintingRef.current = true
      prevEdgeHexRef.current = null
      roadRailPaintAtClient(e.clientX, e.clientY)
    }
    const onMove = (e: MouseEvent) => {
      if (!isPaintingRef.current) return
      if (!roadPaintModeRef.current && !railPaintModeRef.current) return
      roadRailPaintAtClient(e.clientX, e.clientY)
    }
    const onUp = () => { isPaintingRef.current = false }
    el.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      el.removeEventListener('mousedown', onDown)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [roadRailPaintAtClient])

  // Control point drag
  const draggingCpKeyRef = useRef<string | null>(null)
  // Key of the sibling jt| diamond that the dragged one would snap-merge into on release
  const snapPreviewKeyRef = useRef<string | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      if ((e.target as HTMLElement).tagName !== 'CANVAS') return
      if (!roadNodeEditModeRef.current) return
      const meta = metaRef.current
      const { w: cssW, h: cssH } = frameDimsRef.current
      if (!meta || cssW === 0) return
      const logical = clientToLogical(e.clientX, e.clientY)
      if (!logical) return
      const { pw, ph, px, py } = computePaper(cssW, cssH, meta)
      const { controlPoints } = smoothedRoadDataRef.current

      // Determine which junction hexes are split (jt| terminals at different canvas positions)
      const jtByHexHit = new Map<string, { key: string; pos: [number, number] }[]>()
      for (const cp of controlPoints) {
        if (!cp.key.startsWith('jt|')) continue
        const hexKey = cp.key.split('|')[1]
        if (!jtByHexHit.has(hexKey)) jtByHexHit.set(hexKey, [])
        jtByHexHit.get(hexKey)!.push(cp)
      }
      const splitHexesHit = new Set<string>()
      for (const [hexKey, cps] of jtByHexHit) {
        if (cps.length < 2) continue
        const [ax, ay] = projectToCanvas(cps[0].pos[0], cps[0].pos[1], meta, pw, ph, px, py)
        const [bx, by] = projectToCanvas(cps[1].pos[0], cps[1].pos[1], meta, pw, ph, px, py)
        if (Math.hypot(ax - bx, ay - by) > 2) splitHexesHit.add(hexKey)
      }

      // Diamonds (split jt|) > circles (merged ja|) > edge midpoints (em|)
      // Hit radii are in screen pixels; divide by zoom to get logical-space radii.
      const currentZoom = zoomRef.current ?? 1
      const spineSides = controlPoints.filter(cp => cp.key.startsWith('jt|') && splitHexesHit.has(cp.key.split('|')[1]))
      const junctions = controlPoints.filter(cp => cp.key.startsWith('ja|') && !splitHexesHit.has(cp.key.slice(3)))
      const edges = controlPoints.filter(cp => cp.key.startsWith('em|'))
      for (const [cps, hitRScreen] of [[spineSides, 10], [junctions, 10], [edges, 8]] as const) {
        const hitR = (hitRScreen as number) / currentZoom
        for (const cp of cps) {
          const [cx, cy] = projectToCanvas(cp.pos[0], cp.pos[1], meta, pw, ph, px, py)
          if (Math.hypot(logical.lx - cx, logical.ly - cy) <= hitR) {
            draggingCpKeyRef.current = cp.key
            e.stopPropagation()
            return
          }
        }
      }
    }

    const SNAP_SCREEN_PX = 10 // screen pixels within which diamonds will merge on release

    const checkSnap = (dragKey: string, meta: ReturnType<typeof metaRef.current>, pw: number, ph: number, px: number, py: number): string | null => {
      if (!dragKey.startsWith('jt|')) return null
      const parts = dragKey.split('|')
      if (parts.length !== 3) return null
      const hexKey = parts[1]
      const { controlPoints } = smoothedRoadDataRef.current
      const siblings = controlPoints.filter(cp => cp.key.startsWith('jt|') && cp.key.split('|')[1] === hexKey && cp.key !== dragKey)
      const dragged = controlPoints.find(cp => cp.key === dragKey)
      if (!dragged || !meta) return null
      const snapThresh = SNAP_SCREEN_PX / (zoomRef.current ?? 1)
      const [dx, dy] = projectToCanvas(dragged.pos[0], dragged.pos[1], meta, pw, ph, px, py)
      for (const sib of siblings) {
        const [sx, sy] = projectToCanvas(sib.pos[0], sib.pos[1], meta, pw, ph, px, py)
        if (Math.hypot(dx - sx, dy - sy) <= snapThresh) return sib.key
      }
      return null
    }

    const onMove = (e: MouseEvent) => {
      if (!draggingCpKeyRef.current) return
      const meta = metaRef.current
      const { w: cssW, h: cssH } = frameDimsRef.current
      if (!meta || cssW === 0) return
      const logical = clientToLogical(e.clientX, e.clientY)
      if (!logical) return
      const { pw, ph, px, py } = computePaper(cssW, cssH, meta)
      const lonLat = unprojectFromCanvas(logical.lx, logical.ly, meta, pw, ph, px, py)
      setRoadControlOverrideRef.current(draggingCpKeyRef.current, lonLat)
      // Update snap preview — triggers redraw via store update above
      snapPreviewKeyRef.current = checkSnap(draggingCpKeyRef.current, meta, pw, ph, px, py)
    }

    const onUp = (e: MouseEvent) => {
      const dragKey = draggingCpKeyRef.current
      const snapTarget = snapPreviewKeyRef.current
      draggingCpKeyRef.current = null
      snapPreviewKeyRef.current = null
      if (dragKey && snapTarget) {
        // Merge: clear both jt| overrides so they collapse to junction center
        deleteRoadControlOverrideRef.current(dragKey)
        deleteRoadControlOverrideRef.current(snapTarget)
      }
    }

    el.addEventListener('mousedown', onDown, { capture: true })
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      el.removeEventListener('mousedown', onDown, { capture: true })
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [draw, clientToLogical])

  // Lake paint mode — click/drag to mark or unmark hexes as lakes
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let painting = false
    let addMode: boolean | null = null
    let lastPainted: string | null = null

    const hexAtClient = (clientX: number, clientY: number) => {
      const meta = metaRef.current
      if (!meta) return null
      const logical = clientToLogical(clientX, clientY)
      if (!logical) return null
      const { lx, ly, cssW, cssH } = logical
      const { pw, ph, px, py } = computePaper(cssW, cssH, meta)
      for (const hex of hexesRef.current) {
        if (hexEdgeModeRef.current === 'whole' && hex.partial) continue
        const verts = hex.vertices.map(([lon, lat]) => projectToCanvas(lon, lat, meta, pw, ph, px, py))
        if (pointInPolygon(lx, ly, verts)) return hex
      }
      return null
    }

    const onDown = (e: MouseEvent) => {
      if (!lakePaintModeRef.current) return
      if ((e.target as HTMLElement).tagName !== 'CANVAS') return
      e.stopPropagation()
      const hex = hexAtClient(e.clientX, e.clientY)
      if (!hex) return
      painting = true
      addMode = !hex.isLake
      lastPainted = `${hex.q},${hex.r}`
      overrideHexLakeRef.current(hex.q, hex.r, addMode)
    }

    const onMove = (e: MouseEvent) => {
      if (!painting || addMode === null) return
      const hex = hexAtClient(e.clientX, e.clientY)
      if (!hex) return
      const key = `${hex.q},${hex.r}`
      if (key === lastPainted) return
      lastPainted = key
      if (addMode && !hex.isLake) overrideHexLakeRef.current(hex.q, hex.r, true)
      if (!addMode && hex.isLake) overrideHexLakeRef.current(hex.q, hex.r, false)
    }

    const onUp = () => { painting = false; addMode = null; lastPainted = null }

    el.addEventListener('mousedown', onDown, { capture: true })
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      el.removeEventListener('mousedown', onDown, { capture: true })
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [draw, clientToLogical])

  // Highlight line drag-paint — road-like: segment only created on first hex-to-hex move,
  // single clicks store nothing; backtrack-to-erase within current stroke; no global uniqueness.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let painting = false
    let prevHex: { q: number; r: number } | null = null  // hex under cursor at mousedown
    let segmentStarted = false                            // true once first move created the segment
    let lastPainted: string | null = null

    const hexAtClient = (clientX: number, clientY: number) => {
      const meta = metaRef.current
      if (!meta) return null
      const logical = clientToLogical(clientX, clientY)
      if (!logical) return null
      const { lx, ly, cssW, cssH } = logical
      const { pw, ph, px, py } = computePaper(cssW, cssH, meta)
      for (const hex of hexesRef.current) {
        if (hexEdgeModeRef.current === 'whole' && hex.partial) continue
        const verts = hex.vertices.map(([lon, lat]) => projectToCanvas(lon, lat, meta, pw, ph, px, py))
        if (pointInPolygon(lx, ly, verts)) return hex
      }
      return null
    }

    const appendOrPop = (hex: { q: number; r: number }, hlId: string) => {
      const key = `${hex.q},${hex.r}`
      if (key === lastPainted) return
      lastPainted = key

      if (!segmentStarted) {
        // First move away from the mousedown hex — create segment now
        startNewLineSegmentRef.current(hlId)
        if (prevHex) appendHexToLineRef.current(hlId, prevHex.q, prevHex.r)
        appendHexToLineRef.current(hlId, hex.q, hex.r)
        segmentStarted = true
        return
      }

      // Segment in progress: backtrack if hex already in current segment, else append
      const segs = highlightLinesRef.current[hlId] ?? []
      const lastSeg = segs.length > 0 ? segs[segs.length - 1] : []
      const idx = lastSeg.lastIndexOf(key)
      if (idx !== -1) {
        // Segments with < 2 hexes are deleted entirely (auto-cleanup on full backtrack)
        truncateHighlightLineRef.current(hlId, idx < 2 ? 0 : idx)
        if (idx < 2) { segmentStarted = false; prevHex = hex }
      } else {
        appendHexToLineRef.current(hlId, hex.q, hex.r)
      }
    }

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      const hlId = activeHighlightIdRef.current
      if (!hlId) return
      const hl = highlightsRef.current.find(h => h.id === hlId)
      if (hl?.mode !== 'line') return
      if (activePanelRef.current !== 'highlights') return
      const isEraser = highlightLineEraserRef.current
      if (!isEraser && !highlightPaintModeRef.current) return
      if ((e.target as HTMLElement).tagName !== 'CANVAS') return
      e.stopPropagation()
      painting = true
      segmentStarted = false
      prevHex = hexAtClient(e.clientX, e.clientY)
      lastPainted = prevHex ? `${prevHex.q},${prevHex.r}` : null
      if (isEraser && prevHex) eraseHexFromLineRef.current(hlId, prevHex.q, prevHex.r)
    }

    const onMove = (e: MouseEvent) => {
      if (!painting) return
      const hlId = activeHighlightIdRef.current
      if (!hlId) return
      const hex = hexAtClient(e.clientX, e.clientY)
      if (!hex) return
      if (highlightLineEraserRef.current) {
        const key = `${hex.q},${hex.r}`
        if (key === lastPainted) return
        lastPainted = key
        eraseHexFromLineRef.current(hlId, hex.q, hex.r)
      } else {
        appendOrPop(hex, hlId)
      }
    }

    const onUp = () => { painting = false; prevHex = null; segmentStarted = false; lastPainted = null }

    el.addEventListener('mousedown', onDown, { capture: true })
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      el.removeEventListener('mousedown', onDown, { capture: true })
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [clientToLogical])

  // Context menu
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; items: CtxItem[] } | null>(null)
  const [blobFlyout, setBlobFlyout] = useState<{
    type: 'terrain' | 'lake'
    canonicalKey: string
    terrain?: string
    x: number
    y: number
  } | null>(null)

  const findHexAtClient = useCallback((clientX: number, clientY: number) => {
    const meta = metaRef.current
    if (!meta) return null
    const logical = clientToLogical(clientX, clientY)
    if (!logical) return null
    const { lx, ly, cssW, cssH } = logical
    const { pw, ph, px, py } = computePaper(cssW, cssH, meta)
    const mgPx = meta.margin_mm * (pw / meta.paper_mm[0])
    const inMargin = (verts: [number, number][]) =>
      verts.every(([x, y]) => x >= px + mgPx && x <= px + pw - mgPx && y >= py + mgPx && y <= py + ph - mgPx)
    for (const hex of hexesRef.current) {
      if (hexEdgeModeRef.current === 'whole' && hex.partial) continue
      const verts = hex.vertices.map(([lon, lat]) => projectToCanvas(lon, lat, meta, pw, ph, px, py))
      if (!hex.partial && !inMargin(verts)) continue
      if (pointInPolygon(lx, ly, verts)) return hex
    }
    return null
  }, [clientToLogical])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onContextMenu = (e: MouseEvent) => {
      if ((e.target as HTMLElement).tagName !== 'CANVAS') return
      e.preventDefault()
      const hex = findHexAtClient(e.clientX, e.clientY)
      const items: CtxItem[] = []

      if (hex && activePanelRef.current === 'roads') {
        const hexKey = `${hex.q},${hex.r}`
        const overrides = roadControlOverridesRef.current
        const allKeys = Object.keys(overrides)
        const touchingKeys = allKeys.filter(k =>
          k === `ja|${hexKey}` ||
          (k.startsWith('jt|') && k.split('|')[1] === hexKey) ||
          (k.startsWith(`em|`) && (k.includes(`|${hexKey}|`) || k.endsWith(`|${hexKey}`)))
        )
        const isJunction = touchingKeys.some(k => k.startsWith('ja|'))
        const hasOverrides = touchingKeys.length > 0

        if (hasOverrides) {
          items.push({
            label: 'Revert to default',
            action: () => touchingKeys.forEach(k => deleteRoadControlOverrideRef.current(k)),
            danger: true,
          })
        }

        // Split junction: available when the junction has a spine pair and is currently merged
        const jtCps = (smoothedRoadDataRef.current.controlPoints ?? []).filter(cp => cp.key.startsWith('jt|') && cp.key.split('|')[1] === hexKey)
        if (jtCps.length === 2) {
          const meta = metaRef.current
          const { w: cssW, h: cssH } = frameDimsRef.current
          const isMerged = (() => {
            if (!meta || cssW === 0) return false
            const { pw, ph, px, py } = computePaper(cssW, cssH, meta)
            const [ax, ay] = projectToCanvas(jtCps[0].pos[0], jtCps[0].pos[1], meta, pw, ph, px, py)
            const [bx, by] = projectToCanvas(jtCps[1].pos[0], jtCps[1].pos[1], meta, pw, ph, px, py)
            return Math.hypot(ax - bx, ay - by) <= 2
          })()
          if (isMerged) {
            items.push({
              label: 'Split junction',
              action: () => {
                // Apply auto-stagger: offset each terminal 12% of hex spacing along spine
                const h = hexesRef.current.find(h => h.q === hex.q && h.r === hex.r)
                if (!h || !meta || cssW === 0) return
                const { pw, ph, px, py } = computePaper(cssW, cssH, meta)
                const cPx = projectToCanvas(h.center[0], h.center[1], meta, pw, ph, px, py)
                const v0Px = projectToCanvas(h.vertices[0][0], h.vertices[0][1], meta, pw, ph, px, py)
                const hexRadiusPx = Math.hypot(v0Px[0] - cPx[0], v0Px[1] - cPx[1])
                const staggerPx = hexRadiusPx * 0.25
                // Direction: from jtCps[0] terminal toward jtCps[1] terminal (spine direction)
                const [p0x, p0y] = projectToCanvas(jtCps[0].pos[0], jtCps[0].pos[1], meta, pw, ph, px, py)
                const [p1x, p1y] = projectToCanvas(jtCps[1].pos[0], jtCps[1].pos[1], meta, pw, ph, px, py)
                // Fallback spine dir: use hex center to vertex[0] direction
                const spDx = p1x - p0x || (v0Px[0] - cPx[0])
                const spDy = p1y - p0y || (v0Px[1] - cPx[1])
                const spLen = Math.hypot(spDx, spDy) || 1
                const snx = spDx / spLen, sny = spDy / spLen
                const pos0 = unprojectFromCanvas(p0x - snx * staggerPx, p0y - sny * staggerPx, meta, pw, ph, px, py)
                const pos1 = unprojectFromCanvas(p1x + snx * staggerPx, p1y + sny * staggerPx, meta, pw, ph, px, py)
                setRoadControlOverrideRef.current(jtCps[0].key, pos0)
                setRoadControlOverrideRef.current(jtCps[1].key, pos1)
              },
            })
          }
        }

        // Estimate inter-hex distance from adjacent hex centers for randomize
        const neighbors = (smoothedRoadDataRef.current.controlPoints ?? [])
          .filter(cp => cp.key === `ja|${hexKey}` || cp.key.startsWith('em|'))
        const h = hexesRef.current.find(h => h.q === hex.q && h.r === hex.r)
        if (h) {
          items.push({
            label: 'Randomize junction',
            action: () => {
              // Compute rough inter-hex scale from edge midpoints near this hex
              const meta = metaRef.current!
              const { pw, ph, px, py } = computePaper(frameDimsRef.current.w, frameDimsRef.current.h, meta)
              const nearEdges = Object.keys(roadControlOverridesRef.current).concat(
                smoothedRoadDataRef.current.controlPoints.map(cp => cp.key)
              ).filter(k => k.startsWith('em|') && k.includes(hexKey))
              // Estimate hex radius from project output of nearby hex
              const cPx = projectToCanvas(h.center[0], h.center[1], meta, pw, ph, px, py)
              const v0Px = projectToCanvas(h.vertices[0][0], h.vertices[0][1], meta, pw, ph, px, py)
              const hexRadiusPx = Math.hypot(v0Px[0] - cPx[0], v0Px[1] - cPx[1])
              // Random position within ~40% of hex radius from center, in lon/lat
              const angle = Math.random() * Math.PI * 2
              const dist = (0.2 + Math.random() * 0.3) * hexRadiusPx
              const offsetX = Math.cos(angle) * dist, offsetY = Math.sin(angle) * dist
              const newPos = unprojectFromCanvas(cPx[0] + offsetX, cPx[1] + offsetY, meta, pw, ph, px, py)
              setRoadControlOverrideRef.current(`ja|${hexKey}`, newPos)
            },
          })
        }

        // Bendiness presets
        if (hex) {
          const hexKey = `${hex.q},${hex.r}`
          const currentBend = hexRoadBendinessRef.current[hexKey]
          const BEND_PRESETS = [
            { label: 'Straight', value: 0 },
            { label: 'Gentle', value: 0.25 },
            { label: 'Medium', value: 0.5 },
            { label: 'Curvy', value: 0.75 },
            { label: 'Wild', value: 1 },
          ]
          if (items.length > 0) items.push({ label: '─', action: () => {} })
          items.push({ label: 'Bendiness:', action: () => {}, dim: true })
          for (const { label, value } of BEND_PRESETS) {
            items.push({
              label,
              action: () => setHexRoadBendinessRef.current(hexKey, value),
              dim: currentBend !== undefined && Math.abs(currentBend - value) < 0.01,
            })
          }
          if (currentBend !== undefined) {
            items.push({
              label: 'Clear bend override',
              action: () => deleteHexRoadBendinessRef.current(hexKey),
              danger: true,
            })
          }
        }
      }

      // Blob/lake/river editing — available in any panel
      if (hex) {
        const hexKey = `${hex.q},${hex.r}`
        const storedHexForBlob = hexesRef.current.find(h => h.q === hex.q && h.r === hex.r)
        if (hex.isLake ?? false) {
          const canonicalKey = blobComponentsRef.current.get(hexKey)
          if (canonicalKey) {
            items.push({
              label: 'Edit lake…',
              action: () => setBlobFlyout({ type: 'lake', canonicalKey, x: e.clientX, y: e.clientY }),
            })
          }
        } else if (storedHexForBlob) {
          const editableLayers = hexTerrainLayers(storedHexForBlob).filter(t => t !== 'sea')
          for (const t of editableLayers) {
            const componentMap = blobComponentsByTerrainRef.current.get(t)
            const canonicalKey = componentMap?.get(hexKey)
            if (!canonicalKey) continue
            items.push({
              label: `Edit ${t.replace(/_/g, ' ')} blob…`,
              action: () => setBlobFlyout({ type: 'terrain', canonicalKey, terrain: t, x: e.clientX, y: e.clientY }),
            })
          }
        }
        if (items.length > 0) items.push({ label: '─', action: () => {} })
      }

      if (hex && activePanelRef.current === 'terrain') {
        const storedHex = hexesRef.current.find(h => h.q === hex.q && h.r === hex.r)
        const isOverridden = !!(storedHex?.manual_override)
        if (isOverridden) {
          items.push({
            label: 'Revert to default',
            action: () => resetHexOverrideRef.current(hex.q, hex.r),
            danger: true,
          })
          items.push({ label: '─', action: () => {} })
        }
        if (terrainLayersEnabledRef.current && storedHex) {
          const layers = hexTerrainLayers(storedHex)
          if (layers.length > 1) {
            for (const t of layers) {
              items.push({
                label: `Remove ${t.replace(/_/g, ' ')} layer`,
                action: () => removeHexTerrainLayerRef.current(hex.q, hex.r, t),
                color: terrainColorsRef.current[t] ?? '#888',
              } as CtxItem)
            }
            items.push({ label: '─', action: () => {} })
          }
        }
        for (const terrain of TERRAIN_PRIORITY) {
          const isCurrent = hex.terrain === terrain
          items.push({
            label: terrain.replace(/_/g, ' '),
            action: () => overrideHexTerrainRef.current(hex.q, hex.r, terrain),
            color: terrainColorsRef.current[terrain] ?? '#888',
            dim: isCurrent,
          } as CtxItem)
        }
      }

      if (items.length > 0) setCtxMenu({ x: e.clientX, y: e.clientY, items })
    }
    el.addEventListener('contextmenu', onContextMenu)
    return () => el.removeEventListener('contextmenu', onContextMenu)
  }, [findHexAtClient])

  // Click → select hex
  const draggedRef = useRef(false)
  const edgeDragRef = useRef<{ mode: 'add' | 'remove'; painted: Set<string> } | null>(null)
  const isEdgePaintActive = useCallback((): 'highlight' | 'river' | 'canal' | false => {
    if (riverEditModeRef.current && !riverSelectModeRef.current) return 'river'
    if (canalEditModeRef.current && !canalSelectModeRef.current) return 'canal'
    if (activePanelRef.current !== 'highlights') return false
    if (!highlightPaintModeRef.current) return false
    const hlId = activeHighlightIdRef.current
    if (!hlId) return false
    const hl = highlightsRef.current.find(h => h.id === hlId)
    return hl?.mode === 'edge' ? 'highlight' : false
  }, [])

  // Shared edge paint logic used by both click and drag. forceMode keeps the
  // whole drag stroke consistently adding or removing rather than toggling.
  // Returns the effective action taken ('add'|'remove'), or null if no-op.
  const paintEdge = useCallback((
    hexQ: number, hexR: number, edgeI: number,
    forceMode?: 'add' | 'remove',
  ): 'add' | 'remove' | null => {
    const edgePaintMode = isEdgePaintActive()
    if (!edgePaintMode) return null
    const hex = hexesRef.current.find(h => h.q === hexQ && h.r === hexR)
    if (!hex) return null

    const geoV0 = hex.vertices[edgeI] as [number, number]
    const geoV1 = hex.vertices[(edgeI + 1) % 6] as [number, number]

    const VKEY_EPS = 0.00015
    const vk = (v: [number, number]) =>
      `${Math.round(v[0] / (VKEY_EPS * 0.5))},${Math.round(v[1] / (VKEY_EPS * 0.5))}`
    const vEq = (a: [number, number], b: [number, number]) => vk(a) === vk(b)

    if (edgePaintMode === 'river' || edgePaintMode === 'canal') {
      const EPS = 1e-5
      const neighbor = hexesRef.current.find(h => {
        if (h.q === hexQ && h.r === hexR) return false
        const verts = h.vertices as [number, number][]
        let hasV0 = false, hasV1 = false
        for (const v of verts) {
          if (Math.abs(v[0] - geoV0[0]) < EPS && Math.abs(v[1] - geoV0[1]) < EPS) hasV0 = true
          if (Math.abs(v[0] - geoV1[0]) < EPS && Math.abs(v[1] - geoV1[1]) < EPS) hasV1 = true
        }
        return hasV0 && hasV1
      })
      if (!neighbor) return null

      const ek = (q1: number, r1: number, q2: number, r2: number) => {
        const s1 = `${q1},${r1}`, s2 = `${q2},${r2}`
        return s1 < s2 ? `${s1}|${s2}` : `${s2}|${s1}`
      }
      const k = ek(hexQ, hexR, neighbor.q, neighbor.r)
      const edges = edgePaintMode === 'river' ? riverEdgesRef.current : canalEdgesRef.current
      const exists = edges.some(e => ek(e.q1, e.r1, e.q2, e.r2) === k)

      if (forceMode === 'add' && exists) return 'add'
      if (forceMode === 'remove' && !exists) return 'remove'

      if (edgePaintMode === 'river')
        toggleRiverEdgeRef.current(hexQ, hexR, neighbor.q, neighbor.r)
      else
        toggleCanalEdgeRef.current(hexQ, hexR, neighbor.q, neighbor.r)
      riversDirtyRef.current = true
      return exists ? 'remove' : 'add'
    } else {
      // Highlight edge paint
      const hlId = activeHighlightIdRef.current!
      const segments = highlightEdgePathsRef.current[hlId] ?? []
      const ck0 = vk(geoV0), ck1 = vk(geoV1)
      const edgeIdx = (seg: [number, number][]) => {
        for (let i = 0; i < seg.length - 1; i++) {
          if ((vk(seg[i]) === ck0 && vk(seg[i + 1]) === ck1) ||
              (vk(seg[i]) === ck1 && vk(seg[i + 1]) === ck0)) return i
        }
        return -1
      }
      const segIdx = segments.findIndex(s => edgeIdx(s) !== -1)
      const exists = segIdx !== -1

      if (forceMode === 'add' && exists) return 'add'
      if (forceMode === 'remove' && !exists) return 'remove'

      let nextSegments: [number, number][][]
      if (exists) {
        nextSegments = []
        for (let si = 0; si < segments.length; si++) {
          if (si !== segIdx) { nextSegments.push(segments[si]); continue }
          const seg = segments[si]
          const ei = edgeIdx(seg)
          const before = seg.slice(0, ei + 1) as [number, number][]
          const after = seg.slice(ei + 1) as [number, number][]
          if (before.length >= 2) nextSegments.push(before)
          if (after.length >= 2) nextSegments.push(after)
        }
      } else {
        const lastSeg = segments.length > 0 ? segments[segments.length - 1] : []
        let newLastSeg: [number, number][] | null = null
        let appendNew = false
        if (lastSeg.length === 0) {
          newLastSeg = [geoV0, geoV1]
        } else if (vEq(lastSeg[lastSeg.length - 1], geoV0)) {
          newLastSeg = [...lastSeg, geoV1]
        } else if (vEq(lastSeg[lastSeg.length - 1], geoV1)) {
          newLastSeg = [...lastSeg, geoV0]
        } else if (vEq(lastSeg[0], geoV0)) {
          newLastSeg = [geoV1, ...lastSeg]
        } else if (vEq(lastSeg[0], geoV1)) {
          newLastSeg = [geoV0, ...lastSeg]
        } else {
          appendNew = true
        }
        if (appendNew) {
          nextSegments = [...segments, [geoV0, geoV1]]
        } else if (newLastSeg!.length <= 1) {
          nextSegments = segments.slice(0, -1)
        } else {
          nextSegments = [...segments.slice(0, -1), newLastSeg!]
        }
      }
      setHighlightEdgePathRef.current(hlId, nextSegments)
      joinedHighlightsDirtyRef.current = true
      return exists ? 'remove' : 'add'
    }
  }, [isEdgePaintActive])

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEdgePaintActive()) {
      if (hoveredEdgeRef.current !== null) {
        hoveredEdgeRef.current = null
        draw()
      }
      return
    }
    const logical = clientToLogical(e.clientX, e.clientY)
    if (!logical) return
    const { lx: mx, ly: my } = logical

    // Find nearest edge midpoint among all projected hexes
    let best: { hexQ: number; hexR: number; edgeI: number } | null = null
    let bestDist = hexRadiusRef.current * 0.8
    for (const { hex, verts } of projectedHexesRef.current) {
      for (let i = 0; i < 6; i++) {
        const v0 = verts[i], v1 = verts[(i + 1) % 6]
        const dist = Math.hypot(mx - (v0[0] + v1[0]) / 2, my - (v0[1] + v1[1]) / 2)
        if (dist < bestDist) { bestDist = dist; best = { hexQ: hex.q, hexR: hex.r, edgeI: i } }
      }
    }

    const prev = hoveredEdgeRef.current
    if (best?.hexQ !== prev?.hexQ || best?.hexR !== prev?.hexR || best?.edgeI !== prev?.edgeI) {
      hoveredEdgeRef.current = best
      if (hoverRafRef.current === null) {
        hoverRafRef.current = requestAnimationFrame(() => { hoverRafRef.current = null; draw() })
      }

      // Apply drag paint to each new edge entered during a drag stroke
      if (best && edgeDragRef.current) {
        const paintKey = `${best.hexQ},${best.hexR},${best.edgeI}`
        if (!edgeDragRef.current.painted.has(paintKey)) {
          edgeDragRef.current.painted.add(paintKey)
          paintEdge(best.hexQ, best.hexR, best.edgeI, edgeDragRef.current.mode)
        }
      }
    }
  }, [isEdgePaintActive, paintEdge, draw, clientToLogical])

  const onMouseLeave = useCallback(() => {
    if (hoveredEdgeRef.current !== null) {
      hoveredEdgeRef.current = null
      draw()
    }
  }, [draw])

  const onClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggedRef.current) return
    const meta = metaRef.current
    if (!meta) return
    const logical = clientToLogical(e.clientX, e.clientY)
    if (!logical) return
    const { lx, ly, cssW, cssH } = logical
    const { pw, ph, px, py } = computePaper(cssW, cssH, meta)
    const mmToPx = pw / meta.paper_mm[0]
    const mgPx = meta.margin_mm * mmToPx
    const marginL = px + mgPx, marginR = px + pw - mgPx
    const marginT = py + mgPx, marginB = py + ph - mgPx
    const inMargin = (verts: [number, number][]) =>
      verts.every(([x, y]) => x >= marginL && x <= marginR && y >= marginT && y <= marginB)
    // Generic segment select helper
    const pickSegment = (
      chains: { vertices: [number,number][]; segKey: string }[],
      shiftHeld: boolean,
      currentKeys: string[],
      setKeys: (k: string[]) => void,
      toggleKey: (k: string) => void,
    ) => {
      const R = hexRadiusRef.current
      let bestKey: string | null = null, bestDist = Infinity
      for (const { vertices, segKey } of chains) {
        const pxPts = vertices.map(([lon, lat]) => projectToCanvas(lon, lat, meta, pw, ph, px, py)) as [number,number][]
        for (let i = 0; i < pxPts.length - 1; i++) {
          const [ax, ay] = pxPts[i], [bx, by] = pxPts[i+1]
          const dx = bx - ax, dy = by - ay, len2 = dx*dx + dy*dy
          const t = len2 > 0 ? Math.max(0, Math.min(1, ((lx-ax)*dx + (ly-ay)*dy) / len2)) : 0
          const dist = Math.hypot(lx - (ax + t*dx), ly - (ay + t*dy))
          if (dist < bestDist) { bestDist = dist; bestKey = segKey }
        }
      }
      const threshold = R * 0.6
      if (bestDist < threshold && bestKey) {
        if (shiftHeld) {
          toggleKey(bestKey)
        } else if (currentKeys.length === 1 && currentKeys[0] === bestKey) {
          setKeys([])  // clicking the already-selected segment deselects it
        } else {
          setKeys([bestKey])
        }
      } else if (!shiftHeld) {
        setKeys([])
      }
    }
    // River select mode
    if (riverSelectModeRef.current && riverEditModeRef.current) {
      const shiftHeld = e.shiftKey
      pickSegment(computedRiverChainsRef.current, shiftHeld,
        selectedSegmentKeysRef.current,
        setSelectedSegmentKeysRef.current, toggleSegmentSelectionRef.current)
      draw(); return
    }
    // Canal select mode
    if (canalSelectModeRef.current && canalEditModeRef.current) {
      const shiftHeld = e.shiftKey
      pickSegment(computedCanalChainsRef.current, shiftHeld,
        selectedCanalSegmentKeysRef.current,
        setSelectedCanalSegmentKeysRef.current, toggleCanalSegmentSelectionRef.current)
      draw(); return
    }

    // Edge-paint click: use the snapped hovered edge, not the hex under cursor
    if (isEdgePaintActive() && hoveredEdgeRef.current) {
      const { hexQ, hexR, edgeI } = hoveredEdgeRef.current
      paintEdge(hexQ, hexR, edgeI)
      return
    }

    for (const hex of hexesRef.current) {
      if (hexEdgeModeRef.current === 'whole' && hex.partial) continue
      const verts = hex.vertices.map(([lon, lat]) =>
        projectToCanvas(lon, lat, meta, pw, ph, px, py)
      )
      if (!hex.partial && !inMargin(verts)) continue
      if (pointInPolygon(lx, ly, verts)) {
        if (activePanelRef.current === 'highlights' && highlightPaintModeRef.current) {
          const hlId = activeHighlightIdRef.current
          if (hlId) {
            const hl = highlightsRef.current.find(h => h.id === hlId)
            if (hl?.mode === 'area') {
              const key = `${hex.q},${hex.r}`
              if (highlightedHexesRef.current[key] === hlId) {
                clearHexHighlightRef.current(hex.q, hex.r)
              } else {
                setHexHighlightRef.current(hex.q, hex.r, hlId)
              }
            }
          }
          return
        }
        if (activePanelRef.current === 'settlements' && urbanPaintModeRef.current !== null) {
          toggleUrbanHexRef.current(hex.q, hex.r)
          return
        }
        if (activePanelRef.current === 'settlements') {
          const moveIdx = settlementMoveIndexRef.current
          if (moveIdx !== null) {
            updateSettlementRef.current(moveIdx, { hex_q: hex.q, hex_r: hex.r })
            setSettlementMoveIndexRef.current(null)
          } else {
            const tier = settlementPlaceTierRef.current
            const existing = settlementsRef.current
            const existingIdx = existing.findIndex(s => s.hex_q === hex.q && s.hex_r === hex.r)
            if (existingIdx !== -1) {
              updateSettlementRef.current(existingIdx, { tier })
            } else {
              placeSettlementAtHexRef.current(hex.q, hex.r, hex.vertices as [number, number][], hex.center as [number, number], tier)
            }
          }
          return
        }
        setSelectedHex(hex)
        return
      }
    }
    setSelectedHex(null)
  }, [setSelectedHex, clientToLogical])

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    draggedRef.current = false

    // Start an edge drag stroke if we're in edge-paint mode with a hovered edge
    if (isEdgePaintActive() && hoveredEdgeRef.current) {
      const { hexQ, hexR, edgeI } = hoveredEdgeRef.current
      const paintKey = `${hexQ},${hexR},${edgeI}`
      const firstAction = paintEdge(hexQ, hexR, edgeI)
      if (firstAction) {
        edgeDragRef.current = { mode: firstAction, painted: new Set([paintKey]) }
        draggedRef.current = true  // suppress the subsequent onClick
      }
      const onUp = () => {
        edgeDragRef.current = null
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mouseup', onUp)
      return
    }

    const startX = e.clientX, startY = e.clientY
    const onMove = (ev: MouseEvent) => {
      if (Math.abs(ev.clientX - startX) > 4 || Math.abs(ev.clientY - startY) > 4) {
        draggedRef.current = true
      }
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [isEdgePaintActive, paintEdge])

  if (!meta) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
        No map generated yet.
      </div>
    )
  }

  useImperativeHandle(ref, () => ({
    exportBlob: () => new Promise<{ blob: Blob; paperMm: [number, number] } | null>(resolve => {
      const meta = metaRef.current
      if (!meta) { resolve(null); return }
      const PX_PER_MM = 300 / 25.4
      const pw = Math.round(meta.paper_mm[0] * PX_PER_MM)
      const ph = Math.round(meta.paper_mm[1] * PX_PER_MM)
      const offscreen = document.createElement('canvas')
      offscreen.width = pw
      offscreen.height = ph
      draw({ canvas: offscreen, pw, ph })
      offscreen.toBlob(blob => {
        if (!blob) { resolve(null); return }
        resolve({ blob, paperMm: meta.paper_mm as [number, number] })
      }, 'image/png')
    }),
  }))

  const menuItemStyle: CSSProperties = {
    padding: '5px 14px', cursor: 'pointer', color: '#a0a0c0', whiteSpace: 'nowrap',
  }

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, overflow: 'hidden', background: '#1a1a2a', position: 'relative' }}
      onClick={() => setCtxMenu(null)}
    >
      <canvas
        ref={canvasRef}
        onClick={onClick}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        style={{ display: 'block', cursor: roadNodeEditMode ? 'default' : (terrainPaintMode || lakePaintMode || elevationPaintMode) ? 'cell' : activePanel === 'settlements' ? 'cell' : (roadPaintMode || railPaintMode || riverEditMode || canalEditMode || highlightPaintMode || highlightLineEraser) ? 'crosshair' : 'crosshair' }}
      />
      {/* OSM overlay — sized to match the paper rect so tiles align with hexes */}
      <div
        ref={overlayContainerRef}
        style={{
          position: 'absolute',
          left: overlayRect?.left ?? 0,
          top: overlayRect?.top ?? 0,
          width: overlayRect?.width ?? 0,
          height: overlayRect?.height ?? 0,
          opacity: mapOverlay ? 0.82 : 0,
          transition: 'opacity 0.15s ease',
          pointerEvents: 'none',
          zIndex: 10,
          overflow: 'hidden',
        }}
      />
      {/* 1:1 physical-size zoom */}
      {generatedMetadata && (
        <button
          title="Zoom to 1:1 physical size (hex matches real mm on screen)"
          onClick={zoomToPhysical}
          style={{
            position: 'absolute', bottom: 14, right: 104, zIndex: 20,
            background: 'rgba(14,15,24,0.88)',
            border: '1px solid rgba(80,90,140,0.5)',
            borderRadius: 6, padding: '5px 11px', cursor: 'pointer',
            color: '#8a8fb0', fontSize: 12,
            fontFamily: 'ui-monospace, monospace', userSelect: 'none',
            letterSpacing: '0.03em',
          }}
        >
          1:1
        </button>
      )}
      {/* Peek button — hold to reveal real-world map */}
      <button
        title="Hold to preview real-world map (or hold Space)"
        onMouseDown={() => { snapOverlay(); setMapOverlay(true) }}
        onMouseUp={() => setMapOverlay(false)}
        onMouseLeave={() => setMapOverlay(false)}
        style={{
          position: 'absolute', bottom: 14, right: 14, zIndex: 20,
          background: mapOverlay ? 'rgba(50,90,170,0.95)' : 'rgba(14,15,24,0.88)',
          border: `1px solid ${mapOverlay ? 'rgba(100,150,255,0.7)' : 'rgba(80,90,140,0.5)'}`,
          borderRadius: 6, padding: '5px 11px', cursor: 'pointer',
          color: mapOverlay ? '#cde' : '#8a8fb0', fontSize: 12,
          fontFamily: 'ui-monospace, monospace', userSelect: 'none',
          transition: 'background 0.1s, color 0.1s, border-color 0.1s',
          letterSpacing: '0.03em',
        }}
      >
        map peek
      </button>
      {blobFlyout && (
        <BlobOverrideFlyout
          type={blobFlyout.type}
          canonicalKey={blobFlyout.canonicalKey}
          terrain={blobFlyout.terrain}
          x={blobFlyout.x}
          y={blobFlyout.y}
          onClose={() => setBlobFlyout(null)}
        />
      )}
      {ctxMenu && (
        <div
          style={{
            position: 'fixed', left: ctxMenu.x, top: ctxMenu.y,
            background: '#0e0f18', border: '1px solid #2a2a4a',
            borderRadius: 4, padding: '3px 0', zIndex: 200,
            fontFamily: 'ui-monospace, monospace', fontSize: 12,
            minWidth: 170, boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            userSelect: 'none',
          }}
          onClick={e => e.stopPropagation()}
        >
          {ctxMenu.items.map((item, i) => item.label === '─' ? (
            <div key={i} style={{ borderTop: '1px solid #1e1f2e', margin: '3px 0' }} />
          ) : (
            <div
              key={i}
              onClick={() => { if (!item.dim) { item.action(); setCtxMenu(null) } }}
              style={{
                ...menuItemStyle,
                color: item.danger ? '#9e5a5a' : item.dim ? '#3a3a5a' : '#a0a0c0',
                display: 'flex', alignItems: 'center', gap: 8,
                cursor: item.dim ? 'default' : 'pointer',
              }}
              onMouseEnter={e => { if (!item.dim) e.currentTarget.style.background = '#1a1a2e' }}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {item.color && (
                <span style={{ width: 9, height: 9, borderRadius: 2, flexShrink: 0, background: item.color }} />
              )}
              <span style={{ textTransform: 'capitalize' }}>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
})
