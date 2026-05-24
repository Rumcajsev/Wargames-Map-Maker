import type { MapStore } from '../store/mapStore'

/** All store keys that constitute a "style preset" — visual settings, not map data. */
export const STYLE_PRESET_KEYS: string[] = [
  // Terrain appearance
  'thresholds',
  'terrainColors', 'terrainTextureScales', 'terrainRenderMode',
  'terrainDisplacement', 'terrainNoiseFrequency', 'terrainNoiseSeed', 'terrainNoiseOctaves',
  'woodsHexStyle', 'blobSize', 'blobCount',
  'illustratedStyle', 'realisticCoastline', 'beachStrip', 'beachColor', 'beachWidth',
  'terrainTypeBlobStyles',
  'terrainBlobSmooth', 'terrainBlobOffset', 'terrainBlobBump',
  'terrainBlobSweepFreq', 'terrainBlobLobeFreq', 'terrainBlobLobeAmp',
  'terrainBlobLobeThreshold', 'terrainBlobLobeDirection',
  'terrainEdgePaintEnabled',
  'edgeBlobSmooth', 'edgeBlobOffset', 'edgeBlobBump',
  'edgeBlobSweepFreq', 'edgeBlobLobeFreq', 'edgeBlobLobeAmp',
  'edgeBlobLobeThreshold', 'edgeBlobLobeDirection', 'edgeBlobWidth',
  // 'fieldFreq', 'fieldAmp', 'fieldOctaves', 'fieldPersistence', 'fieldWildness', // field render detached
  'autoLakesEnabled', 'lakeSensitivity',
  'lakeBlobSmooth', 'lakeBlobOffset', 'lakeBlobBump',
  'lakeBlobSweepFreq', 'lakeBlobLobeFreq', 'lakeBlobLobeAmp',
  'lakeBlobLobeThreshold', 'lakeBlobLobeDirection',
  // Settlements
  'settlementTierStyles', 'settlementTierThresholds', 'settlementsAutoPlace',
  'settlementsLimit', 'settlementsTypes',
  'showSettlementLabels', 'settlementLabelFont', 'settlementLabelColor', 'settlementLabelSizeScale',
  // Roads
  'roadsDisplayMode', 'roadsVisibleTiers',
  'roadTierStyles', 'roadTierGeometry',
  'roadWiggleAmp', 'roadWiggleFreq', 'roadSmoothing', 'roadPathSmoothing', 'roadDensityMinChain',
  // Rails
  'railStyle', 'railGeomOverride',
  'railWiggleAmp', 'railWiggleFreq', 'railSmoothing', 'railPathSmoothing', 'railsFetchTypes',
  // Rivers
  'riverStyle', 'canalStyle',
  'riverWidthScale', 'canalWidthScale',
  // 'riverFlowStyle', 'riverWiggliness',  // detached
  'riverCurveSteps', 'riverWobble', 'riverDetail',
  'riverWiggleAmp', 'riverWiggleFreq', 'riverSmoothing',
  'showRiverLabels', 'riverLabelColor',
  // Bridges
  'bridgesEnabled', 'bridgeStyle', 'bridgeTiers', 'showBridges',
  // Urban
  'urbanStyle', 'urbanDisplayMode', 'urbanScale', 'urbanVertexRatio',
  'urbanNoise', 'urbanBuildingCount', 'urbanBuildingSize',
  // Display
  'hexBorderMode',
  'hexNumbersEnabled', 'hexNumberStartCorner', 'hexNumberEdge', 'hexNumberColor', 'hexNumberFontScale',
  'showPaperTexture', 'paperTextureOpacity', 'showPaperVignette',
  'mapBgColor', 'mapBorderEnabled', 'mapBorderColor', 'mapBorderWidth', 'clipToHexGrid',
  'megaHexEnabled', 'megaHexRadius', 'megaHexColor', 'megaHexOpacity', 'megaHexLineWidth',
  // Global style
  'mapStyle',
  // Elevation display
  'elevationStyle', 'contourInterval', 'elevationThresholds',
  'showReliefHeatmap', 'showElevHeatmap',
  // Areas style
  'areasStyle',
]

export type StylePreset = Record<string, unknown>

export function extractStylePreset(s: MapStore): StylePreset {
  const result: StylePreset = {}
  for (const k of STYLE_PRESET_KEYS) {
    result[k] = (s as Record<string, unknown>)[k]
  }
  return result
}
