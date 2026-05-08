import { useState, useRef } from 'react'
import { useMapStore, TERRAIN_COLORS, DEFAULT_THRESHOLDS, DEFAULT_ELEVATION_THRESHOLDS, type RiverFeature } from '../store/mapStore'

const ALL_TERRAINS = Object.keys(TERRAIN_COLORS)

function SettlementDot({ type }: { type: string }) {
  const size = type === 'city' ? 10 : type === 'town' ? 8 : 6
  const color = type === 'city' ? '#e05050' : type === 'town' ? '#d0b060' : '#8888aa'
  return (
    <svg width={10} height={10} style={{ flexShrink: 0 }}>
      <circle cx={5} cy={5} r={size / 2 - 0.5} fill={color} stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} />
    </svg>
  )
}

export function TerrainSidebar() {
  const {
    // terrain
    selectedHex,
    setSelectedHex,
    thresholds,
    setTerrainThreshold,
    disabledTerrains,
    toggleTerrainDisabled,
    overrideHexTerrain,
    resetHexOverride,
    terrainPaintMode,
    terrainPaintBrush,
    setTerrainPaintMode,
    setTerrainPaintBrush,
    // panels
    activePanel,
    // settlements
    settlements,
    settlementsStatus,
    settlementsError,
    settlementsLimit,
    settlementsTypes,
    settlementEditMode,
    settlementPlaceTarget,
    setSettlementsLimit,
    setSettlementsTypes,
    setSettlementEditMode,
    setSettlementPlaceTarget,
    setSettlementMoveIndex,
    settlementMoveIndex,
    fetchSettlements,
    toggleSettlementIncluded,
    updateSettlement,
    deleteSettlement,
    addSettlement,
    lookupSettlementsInHex,
    // roads
    roadEdges,
    roadsDisplayMode,
    roadsHighwayTypes,
    roadsVisibleTypes,
    roadsStatus,
    roadsError,
    fetchRoads,
    setRoadsDisplayMode,
    setRoadsHighwayTypes,
    setRoadsVisibleTypes,
    clearRoads,
    clearManualRoads,
    roadPaintMode,
    roadPaintBrush,
    roadPaintEraser,
    setRoadPaintMode,
    setRoadPaintBrush,
    setRoadPaintEraser,
    // rivers
    riverEdges,
    riverFeatures,
    riversStatus,
    riversError,
    riversTypes,
    riversDisplayMode,
    hoveredRiverIndex,
    setRiversTypes,
    setRiversDisplayMode,
    fetchRivers,
    toggleRiverIncluded,
    clearRivers,
    setHoveredRiverIndex,
    riverEditMode,
    setRiverEditMode,
    // elevation
    elevationThresholds,
    elevationStatus,
    elevationError,
    elevationProgress,
    showReliefHeatmap,
    showElevHeatmap,
    fetchElevation,
    setElevationThreshold,
    setShowReliefHeatmap,
    setShowElevHeatmap,
    // style
    terrainDisplacement,
    terrainNoiseFrequency,
    terrainNoiseSeed,
    terrainNoiseOctaves,
    illustratedStyle,
    setTerrainDisplacement,
    setTerrainNoiseFrequency,
    setTerrainNoiseSeed,
    setTerrainNoiseOctaves,
    setIllustratedStyle,
  } = useMapStore()


  const typeLabels: Record<string, string> = { city: 'City', town: 'Town', village: 'Village' }

  // Settlement edit local state
  const [expandedSettlement, setExpandedSettlement] = useState<number | null>(null)
  const [placeTab, setPlaceTab] = useState<'custom' | 'real'>('custom')
  const [placeCustomName, setPlaceCustomName] = useState('')
  const [placeCustomType, setPlaceCustomType] = useState<'city' | 'town' | 'village'>('town')
  const [lookupResults, setLookupResults] = useState<{ name: string; type: string; population: number; lon: number; lat: number }[] | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [lookupSelected, setLookupSelected] = useState<number | null>(null)

  return (
    <div style={{
      width: 240,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
      padding: '20px 16px',
      background: '#12131a',
      color: '#d0d0d8',
      fontFamily: 'ui-monospace, monospace',
      fontSize: 12,
      overflowY: 'auto',
    }}>
      {/* ── TERRAIN PANEL ── */}
      {activePanel === 'terrain' && (
        <>
          {/* Legend + per-terrain thresholds + disable toggles */}
          <div>
            <div style={{ color: '#5a5a7a', marginBottom: 8, textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.8 }}>
              Terrain types
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ALL_TERRAINS.filter(t => t !== 'river').map((terrain) => {
                const color = TERRAIN_COLORS[terrain]
                const disabled = disabledTerrains.has(terrain)
                const isFallback = terrain === 'clear'
                const thr = thresholds[terrain] ?? DEFAULT_THRESHOLDS[terrain] ?? 0.25
                return (
                  <div key={terrain}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: isFallback ? 0 : 4 }}>
                      <div style={{
                        width: 12,
                        height: 12,
                        background: color,
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 2,
                        flexShrink: 0,
                        opacity: disabled ? 0.25 : 1,
                      }} />
                      <span style={{
                        color: disabled ? '#4a4a5a' : '#c0c0d0',
                        textTransform: 'capitalize',
                        flex: 1,
                        fontSize: 11,
                        textDecoration: disabled ? 'line-through' : 'none',
                      }}>{terrain}</span>
                      {!isFallback && (
                        <span style={{ color: '#5a7a6a', fontSize: 10, minWidth: 28, textAlign: 'right' }}>
                          {Math.round(thr * 100)}%
                        </span>
                      )}
                      <button
                        onClick={() => toggleTerrainDisabled(terrain)}
                        style={{
                          background: 'none',
                          border: '1px solid #2a2a3a',
                          borderRadius: 3,
                          color: disabled ? '#4a4a5a' : '#7a9e8a',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          fontSize: 10,
                          padding: '1px 5px',
                          lineHeight: 1.4,
                        }}
                      >
                        {disabled ? 'off' : 'on'}
                      </button>
                    </div>
                    {!isFallback && (
                      <input
                        type="range"
                        min={0.05}
                        max={0.8}
                        step={0.05}
                        value={thr}
                        disabled={disabled}
                        onChange={(e) => setTerrainThreshold(terrain, Number(e.target.value))}
                        style={{ width: '100%', accentColor: color, opacity: disabled ? 0.3 : 1 }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Paint mode */}
          <div style={{ borderTop: '1px solid #2a2a3a', paddingTop: 12 }}>
            <button
              onClick={() => setTerrainPaintMode(!terrainPaintMode)}
              style={{
                width: '100%',
                padding: '6px 0',
                background: terrainPaintMode ? '#2a1a3a' : '#1e1f2a',
                color: terrainPaintMode ? '#c090e8' : '#5a5a7a',
                border: `1px solid ${terrainPaintMode ? '#7a40b8' : '#2a2a3a'}`,
                borderRadius: 4,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 11,
                fontWeight: terrainPaintMode ? 700 : 400,
              }}
            >
              {terrainPaintMode ? '✎ painting' : '✎ paint terrain'}
            </button>
            {terrainPaintMode && (
              <div style={{ marginTop: 8 }}>
                <div style={{ color: '#5a5a7a', marginBottom: 5, textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.8 }}>
                  Brush
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                  {ALL_TERRAINS.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTerrainPaintBrush(t)}
                      style={{
                        padding: '3px 7px',
                        background: terrainPaintBrush === t ? TERRAIN_COLORS[t] : '#1e1f2a',
                        color: terrainPaintBrush === t ? '#12131a' : '#a0a0b8',
                        border: `1px solid ${terrainPaintBrush === t ? TERRAIN_COLORS[t] : '#2a2a3a'}`,
                        borderRadius: 3,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontSize: 10,
                        textTransform: 'capitalize',
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div style={{ color: '#6a4a8a', fontSize: 10, lineHeight: 1.5 }}>
                  Click or drag hexes to paint.
                </div>
              </div>
            )}
          </div>

          {/* Hex inspector */}
          {selectedHex && (
            <div style={{
              borderTop: '1px solid #2a2a3a',
              paddingTop: 14,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ color: '#7a9e8a', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  Hex {selectedHex.q}, {selectedHex.r}
                  {selectedHex.manual_override && (
                    <span style={{ color: '#e09040', fontSize: 10 }}>⬤ override</span>
                  )}
                </div>
                <button
                  onClick={() => setSelectedHex(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#5a5a7a',
                    cursor: 'pointer',
                    fontSize: 14,
                    padding: '0 2px',
                    lineHeight: 1,
                    fontFamily: 'inherit',
                  }}
                >
                  ×
                </button>
              </div>

              {/* Terrain type */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{
                  width: 12,
                  height: 12,
                  background: TERRAIN_COLORS[selectedHex.terrain] ?? '#ede8d5',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 2,
                  flexShrink: 0,
                }} />
                <span style={{ color: '#d0d0d8', textTransform: 'capitalize' }}>
                  {selectedHex.terrain}
                </span>
              </div>

              {/* Terrain picker */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ color: '#5a5a7a', marginBottom: 5, textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.8 }}>
                  Override Terrain
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {ALL_TERRAINS.map((t) => (
                    <button
                      key={t}
                      onClick={() => overrideHexTerrain(selectedHex.q, selectedHex.r, t)}
                      style={{
                        padding: '3px 7px',
                        background: selectedHex.terrain === t ? TERRAIN_COLORS[t] : '#1e1f2a',
                        color: selectedHex.terrain === t ? '#12131a' : '#a0a0b8',
                        border: `1px solid ${selectedHex.terrain === t ? TERRAIN_COLORS[t] : '#2a2a3a'}`,
                        borderRadius: 3,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontSize: 10,
                        textTransform: 'capitalize',
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {selectedHex.manual_override && (
                  <button
                    onClick={() => resetHexOverride(selectedHex.q, selectedHex.r)}
                    style={{
                      marginTop: 6,
                      padding: '3px 8px',
                      background: 'none',
                      color: '#e09040',
                      border: '1px solid #604020',
                      borderRadius: 3,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: 10,
                    }}
                  >
                    Reset override
                  </button>
                )}
              </div>

              {/* Coverage breakdown */}
              {Object.keys(selectedHex.coverage).length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ color: '#5a5a7a', marginBottom: 5, textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.8 }}>
                    Coverage
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {Object.entries(selectedHex.coverage)
                      .filter(([, v]) => v > 0.01)
                      .sort(([, a], [, b]) => b - a)
                      .map(([terrain, frac]) => (
                        <div key={terrain} style={{ display: 'flex', justifyContent: 'space-between', color: '#a0a0b8' }}>
                          <span style={{ textTransform: 'capitalize' }}>{terrain}</span>
                          <span>{Math.round(frac * 100)}%</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Center coords */}
              <div>
                <div style={{ color: '#5a5a7a', marginBottom: 4, textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.8 }}>
                  Center
                </div>
                <div style={{ color: '#7a9e8a', fontSize: 11 }}>
                  {selectedHex.center[0].toFixed(4)}, {selectedHex.center[1].toFixed(4)}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── ROADS PANEL ── */}
      {activePanel === 'roads' && (
        <>
          {/* Display mode */}
          <div>
            <div style={{ color: '#5a5a7a', marginBottom: 6, textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.8 }}>
              Display mode
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {([
                { mode: 'raw', label: 'Raw OSM' },
                { mode: 'per_hex', label: 'Hex edges' },
              ] as const).map(({ mode, label }) => (
                <button
                  key={mode}
                  onClick={() => setRoadsDisplayMode(mode)}
                  style={{
                    flex: 1,
                    padding: '5px 0',
                    background: roadsDisplayMode === mode ? '#2a3a2a' : '#1e1f2a',
                    color: roadsDisplayMode === mode ? '#8ad870' : '#5a5a7a',
                    border: `1px solid ${roadsDisplayMode === mode ? '#4a7a3a' : '#2a2a3a'}`,
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 9,
                    fontWeight: roadsDisplayMode === mode ? 700 : 400,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Highway types */}
          <div>
            <div style={{ color: '#5a5a7a', marginBottom: 6, textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.8 }}>
              Road types
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {([
                { key: 'motorway', label: 'Motorway', color: '#e08040' },
                { key: 'trunk',    label: 'Trunk',    color: '#d0a040' },
                { key: 'primary',  label: 'Primary',  color: '#c8c840' },
                { key: 'secondary',label: 'Secondary', color: '#8a9a50' },
                { key: 'tertiary', label: 'Tertiary', color: '#707870' },
              ] as const).map(({ key, label, color }) => {
                const checked = roadsHighwayTypes.includes(key)
                return (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setRoadsHighwayTypes(checked ? roadsHighwayTypes.filter((t) => t !== key) : [...roadsHighwayTypes, key])
                      }
                      style={{ accentColor: color }}
                    />
                    <span style={{ color: '#c0c0d0', fontSize: 11 }}>
                      <span style={{ color, marginRight: 4 }}>●</span>{label}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Fetch button */}
          <button
            onClick={fetchRoads}
            disabled={roadsStatus === 'loading' || roadsHighwayTypes.length === 0}
            style={{
              width: '100%',
              padding: '9px 0',
              background: roadsStatus === 'loading' ? '#1e1f2a' : '#2a3a2a',
              color: roadsStatus === 'loading' ? '#4a4a5a' : '#8ad870',
              border: `1px solid ${roadsStatus === 'loading' ? '#2a2a3a' : '#4a7a3a'}`,
              borderRadius: 4,
              cursor: roadsStatus === 'loading' ? 'default' : 'pointer',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {roadsStatus === 'loading' ? 'Fetching…' : 'Fetch Roads'}
          </button>

          {roadsStatus === 'error' && roadsError && (
            <div style={{ color: '#e06060', fontSize: 11, wordBreak: 'break-word' }}>
              Error: {roadsError}
            </div>
          )}

          {/* Paint mode */}
          <div>
            <button
              onClick={() => setRoadPaintMode(!roadPaintMode)}
              style={{
                width: '100%',
                padding: '6px 0',
                background: roadPaintMode ? '#2a1a3a' : '#1e1f2a',
                color: roadPaintMode ? '#c090e8' : '#5a5a7a',
                border: `1px solid ${roadPaintMode ? '#7a40b8' : '#2a2a3a'}`,
                borderRadius: 4,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 11,
                fontWeight: roadPaintMode ? 700 : 400,
              }}
            >
              {roadPaintMode ? '✎ painting roads' : '✎ paint roads'}
            </button>
            {roadPaintMode && (
              <div style={{ marginTop: 8 }}>
                <div style={{ color: '#5a5a7a', marginBottom: 5, textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.8 }}>
                  Road type
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
                  {([
                    { key: 'motorway',  label: 'Motorway',  color: '#c05818' },
                    { key: 'trunk',     label: 'Trunk',     color: '#b07820' },
                    { key: 'primary',   label: 'Primary',   color: '#8a5c2a' },
                    { key: 'secondary', label: 'Secondary', color: '#6a7040' },
                    { key: 'tertiary',  label: 'Tertiary',  color: '#606060' },
                  ] as const).map(({ key, label, color }) => {
                    const active = roadPaintBrush === key
                    return (
                      <button
                        key={key}
                        onClick={() => setRoadPaintBrush(key)}
                        style={{
                          padding: '4px 8px',
                          background: active ? '#1e1e2a' : '#161620',
                          border: `1px solid ${active ? color : '#2a2a3a'}`,
                          borderRadius: 3,
                          color: active ? color : '#5a5a7a',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          fontSize: 11,
                          fontWeight: active ? 700 : 400,
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <span style={{ width: 24, height: 3, background: active ? color : '#3a3a4a', borderRadius: 2, flexShrink: 0, display: 'inline-block' }} />
                        {label}
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={() => setRoadPaintEraser(!roadPaintEraser)}
                  style={{
                    width: '100%',
                    padding: '4px 8px',
                    background: roadPaintEraser ? '#2a1010' : '#161620',
                    border: `1px solid ${roadPaintEraser ? '#aa4040' : '#2a2a3a'}`,
                    borderRadius: 3,
                    color: roadPaintEraser ? '#e07070' : '#5a5a7a',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 11,
                    fontWeight: roadPaintEraser ? 700 : 400,
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 4,
                  }}
                >
                  <span style={{ fontSize: 13 }}>⌫</span>
                  Eraser
                </button>
                <div style={{ color: '#6a4a8a', fontSize: 10, lineHeight: 1.5, marginTop: 6 }}>
                  {roadPaintEraser ? 'Click or drag to erase roads.' : 'Click or drag to draw roads.'}
                </div>
              </div>
            )}
          </div>

          {roadsStatus === 'done' && roadEdges.length > 0 && (() => {
            const fetchedTypes = [...new Set(roadEdges.map((e) => e.highway))]
            const typesMeta: Record<string, { label: string; color: string }> = {
              motorway:  { label: 'Motorway',  color: '#c05818' },
              trunk:     { label: 'Trunk',     color: '#b07820' },
              primary:   { label: 'Primary',   color: '#8a5c2a' },
              secondary: { label: 'Secondary', color: '#6a7040' },
              tertiary:  { label: 'Tertiary',  color: '#606060' },
            }
            return (
              <div>
                <div style={{ color: '#5a5a7a', marginBottom: 6, textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.8 }}>
                  Visible — {roadEdges.length} edge{roadEdges.length !== 1 ? 's' : ''}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {fetchedTypes.map((type) => {
                    const meta = typesMeta[type] ?? { label: type, color: '#606060' }
                    const on = roadsVisibleTypes.includes(type)
                    return (
                      <button
                        key={type}
                        onClick={() => setRoadsVisibleTypes(on ? roadsVisibleTypes.filter((t) => t !== type) : [...roadsVisibleTypes, type])}
                        style={{
                          padding: '3px 8px',
                          background: on ? '#1e1e2a' : '#141420',
                          border: `1px solid ${on ? meta.color : '#2a2a3a'}`,
                          borderRadius: 3,
                          color: on ? meta.color : '#3a3a4a',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          fontSize: 10,
                          fontWeight: on ? 600 : 400,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <span style={{ width: 20, height: 3, background: on ? meta.color : '#3a3a4a', borderRadius: 2, display: 'inline-block' }} />
                        {meta.label}
                      </button>
                    )
                  })}
                  {roadEdges.some((e) => e.manual) && (
                    <button
                      onClick={clearManualRoads}
                      style={{
                        padding: '3px 8px', background: 'none',
                        border: '1px solid #2a2a3a', borderRadius: 3,
                        color: '#6a5a3a', cursor: 'pointer', fontFamily: 'inherit', fontSize: 10,
                      }}
                    >
                      Clear painted
                    </button>
                  )}
                  <button
                    onClick={clearRoads}
                    style={{
                      padding: '3px 8px',
                      background: 'none',
                      border: '1px solid #3a2a2a',
                      borderRadius: 3,
                      color: '#7a4a4a',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: 10,
                    }}
                  >
                    Clear all
                  </button>
                </div>
              </div>
            )
          })()}
        </>
      )}

      {/* ── RIVERS PANEL ── */}
      {activePanel === 'rivers' && (
        <>
          {/* Type checkboxes — rivers and canals only (streams not in relations) */}
          <div>
            <div style={{ color: '#5a5a7a', marginBottom: 6, textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.8 }}>
              Waterway types
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {([
                { key: 'river', label: 'Rivers', color: '#4a88c0' },
                { key: 'canal', label: 'Canals', color: '#5a9aaa' },
              ] as const).map(({ key, label, color }) => {
                const checked = riversTypes.includes(key)
                return (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setRiversTypes(checked ? riversTypes.filter((t) => t !== key) : [...riversTypes, key])
                      }
                      style={{ accentColor: color }}
                    />
                    <span style={{ color: '#c0c0d0', fontSize: 11 }}>
                      <span style={{ color, marginRight: 4 }}>●</span>{label}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Fetch button */}
          <button
            onClick={fetchRivers}
            disabled={riversStatus === 'loading'}
            style={{
              width: '100%',
              padding: '9px 0',
              background: riversStatus === 'loading' ? '#1e1f2a' : '#1e2a3a',
              color: riversStatus === 'loading' ? '#4a4a5a' : '#6ab0e0',
              border: `1px solid ${riversStatus === 'loading' ? '#2a2a3a' : '#3a6a9a'}`,
              borderRadius: 4,
              cursor: riversStatus === 'loading' ? 'default' : 'pointer',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {riversStatus === 'loading' ? 'Fetching…' : 'Fetch Rivers'}
          </button>

          {riversStatus === 'error' && riversError && (
            <div style={{ color: '#e06060', fontSize: 11, wordBreak: 'break-word' }}>
              Error: {riversError}
            </div>
          )}

          {riversStatus === 'done' && riverFeatures.length > 0 && (
            <>
              {/* Display mode toggle — Raw OSM / Hex edges only */}
              <div>
                <div style={{ color: '#5a5a7a', marginBottom: 6, textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.8 }}>
                  Display mode
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {([
                    { mode: 'raw', label: 'Raw OSM' },
                    { mode: 'edges', label: 'Hex edges' },
                  ] as const).map(({ mode, label }) => (
                    <button
                      key={mode}
                      onClick={() => setRiversDisplayMode(mode)}
                      style={{
                        flex: 1,
                        padding: '5px 0',
                        background: riversDisplayMode === mode ? '#1e2a3a' : '#1e1f2a',
                        color: riversDisplayMode === mode ? '#6ab0e0' : '#5a5a7a',
                        border: `1px solid ${riversDisplayMode === mode ? '#3a6a9a' : '#2a2a3a'}`,
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontSize: 10,
                        fontWeight: riversDisplayMode === mode ? 700 : 400,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Edit mode toggle */}
              <button
                onClick={() => setRiverEditMode(!riverEditMode)}
                style={{
                  width: '100%',
                  padding: '6px 0',
                  background: riverEditMode ? '#221830' : '#1e1f2a',
                  color: riverEditMode ? '#c090e8' : '#5a5a7a',
                  border: `1px solid ${riverEditMode ? '#7a40b8' : '#2a2a3a'}`,
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 11,
                  fontWeight: riverEditMode ? 700 : 400,
                }}
              >
                {riverEditMode ? '✏ editing edges' : '✏ edit edges'}
              </button>
              {riverEditMode && (
                <div style={{ color: '#7a5a9a', fontSize: 10, lineHeight: 1.5, marginTop: -8 }}>
                  Click any hex border to add or remove a river crossing.
                </div>
              )}
              {riversDisplayMode === 'edges' && riverEdges.length === 0 && (
                <div style={{ color: '#4a5a6a', fontSize: 10, lineHeight: 1.5, padding: '6px 8px', background: '#14151e', borderRadius: 3, border: '1px solid #1e2230' }}>
                  No hex-edge rivers yet. Enable Edit mode and click hex borders to draw rivers.
                </div>
              )}

              {/* River list with individual toggles */}
              <div>
                <div style={{ color: '#5a5a7a', marginBottom: 6, textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.8 }}>
                  Rivers — {riverFeatures.filter((r: RiverFeature) => r.included).length}/{riverFeatures.length} shown · {riverEdges.length} hex edges
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 260, overflowY: 'auto' }}>
                  {riverFeatures.map((river: RiverFeature, i: number) => {
                    const isHovered = hoveredRiverIndex === i
                    return (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 7,
                          padding: '4px 6px',
                          background: isHovered
                            ? (river.included ? '#1e3550' : '#22243a')
                            : (river.included ? '#1a2a3a' : '#1a1b26'),
                          borderRadius: 3,
                          border: `1px solid ${isHovered ? '#4a7aaa' : river.included ? '#2a4a6a' : '#22232f'}`,
                          cursor: 'pointer',
                          transition: 'background 0.1s, border-color 0.1s',
                        }}
                        onClick={() => toggleRiverIncluded(i)}
                        onMouseEnter={() => setHoveredRiverIndex(i)}
                        onMouseLeave={() => setHoveredRiverIndex(null)}
                      >
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                          background: river.included ? (isHovered ? '#6aaae0' : '#4a88c0') : (isHovered ? '#5a5a7a' : '#3a3a4a'),
                        }} />
                        <span style={{
                          fontSize: 10,
                          color: river.included ? (isHovered ? '#d0e8f8' : '#b0c8e0') : (isHovered ? '#7a7a9a' : '#5a5a7a'),
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                        }}>
                          {river.name || `(unnamed ${river.type})`}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Clear */}
              <button
                onClick={clearRivers}
                style={{
                  background: 'none',
                  border: '1px solid #3a2a2a',
                  borderRadius: 3,
                  color: '#7a4a4a',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 10,
                  padding: '3px 8px',
                  alignSelf: 'flex-start',
                }}
              >
                Clear rivers
              </button>
            </>
          )}
        </>
      )}

      {/* ── SETTLEMENTS PANEL ── */}
      {activePanel === 'settlements' && (
        <>
          {/* Limit slider */}
          <div>
            <div style={{ color: '#5a5a7a', marginBottom: 6, textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.8 }}>
              Top N settlements — {settlementsLimit}
            </div>
            <input
              type="range" min={10} max={100} step={5} value={settlementsLimit}
              onChange={(e) => setSettlementsLimit(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#5a9e6f' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4a4a5a', fontSize: 10, marginTop: 2 }}>
              <span>10</span><span>100</span>
            </div>
          </div>

          {/* Type checkboxes */}
          <div>
            <div style={{ color: '#5a5a7a', marginBottom: 6, textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.8 }}>Types</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {(['city', 'town', 'village'] as const).map((t) => {
                const checked = settlementsTypes.includes(t)
                return (
                  <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={checked} onChange={() => {
                      if (checked) setSettlementsTypes(settlementsTypes.filter((x) => x !== t))
                      else setSettlementsTypes([...settlementsTypes, t])
                    }} style={{ accentColor: '#5a9e6f' }} />
                    <SettlementDot type={t} />
                    <span style={{ color: '#c0c0d0' }}>{typeLabels[t]}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Fetch button */}
          <button onClick={fetchSettlements} disabled={settlementsStatus === 'loading'} style={{
            width: '100%', padding: '9px 0',
            background: settlementsStatus === 'loading' ? '#1e1f2a' : '#2a4a3a',
            color: settlementsStatus === 'loading' ? '#4a4a5a' : '#7de0a0',
            border: `1px solid ${settlementsStatus === 'loading' ? '#2a2a3a' : '#3a7a5a'}`,
            borderRadius: 4, cursor: settlementsStatus === 'loading' ? 'default' : 'pointer',
            fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
          }}>
            {settlementsStatus === 'loading' ? 'Fetching…' : 'Fetch Settlements'}
          </button>

          {settlementsStatus === 'error' && settlementsError && (
            <div style={{ color: '#e06060', fontSize: 11, wordBreak: 'break-word' }}>Error: {settlementsError}</div>
          )}

          {/* Place settlement mode */}
          <div>
            <button
              onClick={() => {
                setSettlementEditMode(!settlementEditMode)
                setPlaceCustomName('')
                setLookupResults(null)
                setLookupError(null)
                setLookupSelected(null)
              }}
              style={{
                width: '100%', padding: '6px 0',
                background: settlementEditMode ? '#1a2a1a' : '#1e1f2a',
                color: settlementEditMode ? '#7de0a0' : '#5a5a7a',
                border: `1px solid ${settlementEditMode ? '#3a7a5a' : '#2a2a3a'}`,
                borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11,
                fontWeight: settlementEditMode ? 700 : 400,
              }}
            >
              {settlementMoveIndex !== null ? '↖ moving — click a hex' : settlementEditMode ? '✚ placing — click a hex' : '✚ place settlement'}
            </button>

            {/* Placement form — shown when a hex is targeted */}
            {settlementEditMode && settlementPlaceTarget && (
              <div style={{ marginTop: 8, padding: '10px', background: '#16181f', border: '1px solid #2a2a3a', borderRadius: 4 }}>
                <div style={{ color: '#7a9ab8', fontSize: 10, marginBottom: 8 }}>
                  Hex {settlementPlaceTarget.q},{settlementPlaceTarget.r}
                </div>

                {/* Tab switcher */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                  {(['custom', 'real'] as const).map((tab) => (
                    <button key={tab} onClick={() => { setPlaceTab(tab); setLookupResults(null); setLookupError(null); setLookupSelected(null) }} style={{
                      flex: 1, padding: '4px 0', fontFamily: 'inherit', fontSize: 10, cursor: 'pointer',
                      background: placeTab === tab ? '#2a3a4a' : '#1a1b26',
                      color: placeTab === tab ? '#a0c8e8' : '#4a4a6a',
                      border: `1px solid ${placeTab === tab ? '#4a6a8a' : '#2a2a3a'}`,
                      borderRadius: 3, fontWeight: placeTab === tab ? 700 : 400,
                    }}>
                      {tab === 'custom' ? 'Custom' : 'Real (OSM)'}
                    </button>
                  ))}
                </div>

                {placeTab === 'custom' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input
                      type="text" placeholder="Settlement name" value={placeCustomName}
                      onChange={(e) => setPlaceCustomName(e.target.value)}
                      style={{
                        background: '#1e1f2a', border: '1px solid #2a3a4a', borderRadius: 3,
                        color: '#d0d0e0', fontFamily: 'inherit', fontSize: 11, padding: '5px 8px', outline: 'none',
                      }}
                    />
                    <select value={placeCustomType} onChange={(e) => setPlaceCustomType(e.target.value as 'city' | 'town' | 'village')} style={{
                      background: '#1e1f2a', border: '1px solid #2a3a4a', borderRadius: 3,
                      color: '#d0d0e0', fontFamily: 'inherit', fontSize: 11, padding: '4px 8px',
                    }}>
                      <option value="city">City</option>
                      <option value="town">Town</option>
                      <option value="village">Village</option>
                    </select>
                    <button
                      disabled={!placeCustomName.trim()}
                      onClick={() => {
                        const { q, r } = settlementPlaceTarget
                        addSettlement({ name: placeCustomName.trim(), type: placeCustomType, population: 0, lon: 0, lat: 0, hex_q: q, hex_r: r, isCustom: true })
                        setSettlementEditMode(false)
                        setPlaceCustomName('')
                      }}
                      style={{
                        padding: '5px 0', background: placeCustomName.trim() ? '#2a4a3a' : '#1e1f2a',
                        color: placeCustomName.trim() ? '#7de0a0' : '#3a3a4a',
                        border: `1px solid ${placeCustomName.trim() ? '#3a7a5a' : '#2a2a3a'}`,
                        borderRadius: 3, cursor: placeCustomName.trim() ? 'pointer' : 'default',
                        fontFamily: 'inherit', fontSize: 11,
                      }}
                    >Place</button>
                  </div>
                )}

                {placeTab === 'real' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {!lookupResults && (
                      <button
                        disabled={lookupLoading}
                        onClick={async () => {
                          setLookupLoading(true); setLookupError(null); setLookupResults(null); setLookupSelected(null)
                          try {
                            const results = await lookupSettlementsInHex(settlementPlaceTarget.vertices)
                            setLookupResults(results)
                          } catch (e) {
                            setLookupError(String(e))
                          } finally {
                            setLookupLoading(false)
                          }
                        }}
                        style={{
                          padding: '5px 0', background: lookupLoading ? '#1e1f2a' : '#2a3a4a',
                          color: lookupLoading ? '#4a4a5a' : '#a0c8e8',
                          border: `1px solid ${lookupLoading ? '#2a2a3a' : '#4a6a8a'}`,
                          borderRadius: 3, cursor: lookupLoading ? 'default' : 'pointer',
                          fontFamily: 'inherit', fontSize: 11,
                        }}
                      >{lookupLoading ? 'Searching…' : 'Search this hex'}</button>
                    )}
                    {lookupError && <div style={{ color: '#e06060', fontSize: 10 }}>{lookupError}</div>}
                    {lookupResults && lookupResults.length === 0 && (
                      <div style={{ color: '#5a5a7a', fontSize: 10 }}>No OSM settlements found in this hex.</div>
                    )}
                    {lookupResults && lookupResults.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {lookupResults.map((r, ri) => (
                          <div
                            key={ri}
                            onClick={() => setLookupSelected(ri === lookupSelected ? null : ri)}
                            style={{
                              padding: '4px 6px', borderRadius: 3, cursor: 'pointer',
                              background: lookupSelected === ri ? '#1e2e3e' : '#1a1b26',
                              border: `1px solid ${lookupSelected === ri ? '#4a6a8a' : '#22232f'}`,
                              display: 'flex', alignItems: 'center', gap: 6,
                            }}
                          >
                            <SettlementDot type={r.type} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ color: '#c8c8d8', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                              <div style={{ color: '#4a4a6a', fontSize: 10 }}>{r.type} · {r.population > 0 ? r.population.toLocaleString() : 'pop unknown'}</div>
                            </div>
                          </div>
                        ))}
                        <button
                          disabled={lookupSelected === null}
                          onClick={() => {
                            if (lookupSelected === null || !lookupResults) return
                            const r = lookupResults[lookupSelected]
                            addSettlement({ ...r, hex_q: settlementPlaceTarget.q, hex_r: settlementPlaceTarget.r })
                            setSettlementEditMode(false)
                            setLookupResults(null); setLookupSelected(null)
                          }}
                          style={{
                            marginTop: 2, padding: '5px 0',
                            background: lookupSelected !== null ? '#2a4a3a' : '#1e1f2a',
                            color: lookupSelected !== null ? '#7de0a0' : '#3a3a4a',
                            border: `1px solid ${lookupSelected !== null ? '#3a7a5a' : '#2a2a3a'}`,
                            borderRadius: 3, cursor: lookupSelected !== null ? 'pointer' : 'default',
                            fontFamily: 'inherit', fontSize: 11,
                          }}
                        >Place selected</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Settlement list */}
          {settlements.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
              <div style={{ color: '#5a5a7a', textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.8, marginBottom: 2 }}>
                Settlements ({settlements.filter(s => s.included).length}/{settlements.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 380, overflowY: 'auto', flexShrink: 0 }}>
                {settlements.map((s, i) => {
                  const expanded = expandedSettlement === i
                  return (
                    <div key={i} style={{ borderRadius: 3, border: `1px solid ${expanded ? '#2a3a4a' : '#22232f'}`, overflow: 'hidden', flexShrink: 0 }}>
                      {/* Row header */}
                      <div
                        onClick={() => setExpandedSettlement(expanded ? null : i)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 7, padding: '7px 8px', cursor: 'pointer',
                          background: expanded ? '#1e2530' : s.included ? '#1a1b26' : '#14151e',
                          opacity: s.included ? 1 : 0.45,
                        }}
                      >
                        <SettlementDot type={s.type} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: '#d0d0e0', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
                            {s.name}
                            {s.isCustom && <span style={{ color: '#5a8a6a', fontSize: 9, marginLeft: 5, fontWeight: 400 }}>custom</span>}
                          </div>
                          <div style={{ color: '#5a5a7a', fontSize: 10, marginTop: 2 }}>
                            {s.type}
                            {s.population > 0 && <span style={{ color: '#4a6a5a' }}> · {s.population.toLocaleString()}</span>}
                            {s.hex_q === null && <span style={{ color: '#4a4050' }}> · outside</span>}
                          </div>
                        </div>
                        <span style={{ color: '#3a4a5a', fontSize: 9, flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
                      </div>

                      {/* Expanded edit form */}
                      {expanded && (
                        <div style={{ padding: '8px 8px 10px', background: '#141520', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <input
                            type="text" value={s.name}
                            onChange={(e) => updateSettlement(i, { name: e.target.value })}
                            style={{
                              background: '#1e1f2a', border: '1px solid #2a3a4a', borderRadius: 3,
                              color: '#d0d0e0', fontFamily: 'inherit', fontSize: 11, padding: '4px 8px', outline: 'none',
                            }}
                          />
                          <div style={{ display: 'flex', gap: 6 }}>
                            <select
                              value={s.type}
                              onChange={(e) => updateSettlement(i, { type: e.target.value })}
                              style={{
                                flex: 1, background: '#1e1f2a', border: '1px solid #2a3a4a', borderRadius: 3,
                                color: '#d0d0e0', fontFamily: 'inherit', fontSize: 11, padding: '4px 6px',
                              }}
                            >
                              <option value="city">City</option>
                              <option value="town">Town</option>
                              <option value="village">Village</option>
                            </select>
                            <button
                              onClick={() => updateSettlement(i, { included: !s.included })}
                              style={{
                                padding: '4px 8px', borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit', fontSize: 10,
                                background: s.included ? '#1e2e1e' : '#1e1f2a',
                                color: s.included ? '#7a9e8a' : '#5a5a7a',
                                border: `1px solid ${s.included ? '#3a5a3a' : '#2a2a3a'}`,
                              }}
                            >{s.included ? 'Shown' : 'Hidden'}</button>
                            <button
                              onClick={() => { setSettlementMoveIndex(i); setExpandedSettlement(null) }}
                              style={{
                                padding: '4px 8px', borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit', fontSize: 10,
                                background: settlementMoveIndex === i ? '#1a2a3a' : '#161620',
                                color: settlementMoveIndex === i ? '#6ab0e0' : '#5a7a9a',
                                border: `1px solid ${settlementMoveIndex === i ? '#4a7aaa' : '#2a3a4a'}`,
                              }}
                            >Move</button>
                            <button
                              onClick={() => { deleteSettlement(i); setExpandedSettlement(null) }}
                              style={{
                                padding: '4px 8px', borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit', fontSize: 10,
                                background: '#2a1010', color: '#e07070', border: '1px solid #4a2020',
                              }}
                            >✕</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Elevation panel ────────────────────────────────── */}
      {activePanel === 'elevation' && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={fetchElevation}
              disabled={elevationStatus === 'loading'}
              style={{
                width: '100%',
                padding: '9px 0',
                background: elevationStatus === 'loading' ? '#2a3a5a' : '#2a4a6a',
                color: elevationStatus === 'loading' ? '#7a9aba' : '#c0d8f0',
                border: '1px solid #3a6a9a',
                borderRadius: 4,
                cursor: elevationStatus === 'loading' ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 0.5,
              }}
            >
              {elevationStatus === 'loading' ? 'Fetching…' : elevationStatus === 'done' ? 'Re-fetch Elevation' : 'Fetch Elevation'}
            </button>

            {elevationProgress && (
              <div>
                <div style={{ width: '100%', height: 5, background: '#1e1f2a', borderRadius: 3, overflow: 'hidden', marginBottom: 5 }}>
                  <div style={{ height: '100%', width: `${elevationProgress.progress}%`, background: '#3a6a9a', borderRadius: 3, transition: 'width 0.3s ease' }} />
                </div>
                <div style={{ color: '#7a9aba', fontSize: 11 }}>{elevationProgress.message}</div>
              </div>
            )}

            {elevationError && (
              <div style={{ color: '#e06060', fontSize: 11, wordBreak: 'break-word' }}>{elevationError}</div>
            )}
          </div>

          {elevationStatus === 'done' && (
            <>
              <div style={{ borderTop: '1px solid #2a2a3a', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#5a5a7a', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    Mode A — Terrain Class
                  </span>
                  <InfoTooltip text={
                    'Each hex is classified by two independent methods, and gets the higher result:\n\n' +
                    '• Local relief — how much higher this hex is than its neighbours. Catches hills and peaks that stand out from surrounding terrain.\n\n' +
                    '• Absolute elevation — raw altitude above sea level. Catches high plateaus where all neighbours are equally high.\n\n' +
                    'Raise a threshold if too many hexes are being classified up. Lower it if real hills are showing as flat.'
                  } />
                </div>

                <ElevSlider
                  label="Hills — local relief"
                  value={elevationThresholds.hills_relief_m}
                  min={10} max={500} step={10}
                  unit="m"
                  onChange={(v) => setElevationThreshold('hills_relief_m', v)}
                />
                <ElevSlider
                  label="Mountains — local relief"
                  value={elevationThresholds.mountains_relief_m}
                  min={50} max={2000} step={25}
                  unit="m"
                  onChange={(v) => setElevationThreshold('mountains_relief_m', v)}
                />
                <ElevSlider
                  label="Hills — absolute"
                  value={elevationThresholds.hills_absolute_m}
                  min={50} max={2000} step={25}
                  unit="m"
                  onChange={(v) => setElevationThreshold('hills_absolute_m', v)}
                />
                <ElevSlider
                  label="Mountains — absolute"
                  value={elevationThresholds.mountains_absolute_m}
                  min={200} max={5000} step={50}
                  unit="m"
                  onChange={(v) => setElevationThreshold('mountains_absolute_m', v)}
                />
              </div>

              <div style={{ borderTop: '1px solid #2a2a3a', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ color: '#5a5a7a', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>
                  Elevation overlay
                </div>
                <HeatmapToggle
                  label="Relief heatmap"
                  active={showReliefHeatmap}
                  onToggle={() => setShowReliefHeatmap(!showReliefHeatmap)}
                />
                <HeatmapToggle
                  label="Elevation heatmap"
                  active={showElevHeatmap}
                  onToggle={() => setShowElevHeatmap(!showElevHeatmap)}
                />
              </div>
            </>
          )}
        </>
      )}

      {/* ── STYLE PANEL ── */}
      {activePanel === 'style' && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#c8b88a', letterSpacing: 0.5 }}>
            Terrain style
          </div>

          {/* Illustrated tile toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: illustratedStyle ? '#1a2a1a' : '#1a1a26', border: `1px solid ${illustratedStyle ? '#3a6a3a' : '#2a2a3a'}`, borderRadius: 6 }}>
            <div>
              <div style={{ color: illustratedStyle ? '#7de0a0' : '#8a8aaa', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Illustrated tiles
              </div>
              <div style={{ color: '#5a5a7a', fontSize: 10, marginTop: 2 }}>
                Uses tile art from public/tiles/
              </div>
            </div>
            <button
              onClick={() => setIllustratedStyle(!illustratedStyle)}
              style={{
                padding: '4px 12px',
                background: illustratedStyle ? '#2a5a2a' : '#1e1f2a',
                color: illustratedStyle ? '#7de0a0' : '#5a5a7a',
                border: `1px solid ${illustratedStyle ? '#4a7a4a' : '#2a2a3a'}`,
                borderRadius: 4,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {illustratedStyle ? 'ON' : 'OFF'}
            </button>
          </div>

          <StyleSlider
            label="Edge displacement"
            value={terrainDisplacement}
            min={0} max={40} step={1}
            unit="px"
            hint="How much hex edges wiggle. 0 = sharp grid."
            onChange={setTerrainDisplacement}
          />

          <StyleSlider
            label="Pattern scale"
            value={terrainNoiseFrequency}
            min={1} max={20} step={1}
            unit=""
            hint="Lower = large sweeping shapes. Higher = fine grain."
            onChange={setTerrainNoiseFrequency}
          />

          <StyleSlider
            label="Octaves"
            value={terrainNoiseOctaves}
            min={1} max={12} step={1}
            unit=""
            hint="More octaves = more detail in the noise."
            onChange={setTerrainNoiseOctaves}
          />

          <div>
            <div style={{ color: '#5a5a7a', marginBottom: 6, textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.8 }}>
              Seed — {terrainNoiseSeed}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[1, 2, 3, 4, 5, 7, 12, 42].map((s) => (
                <button
                  key={s}
                  onClick={() => setTerrainNoiseSeed(s)}
                  style={{
                    padding: '3px 9px',
                    background: terrainNoiseSeed === s ? '#3a5a3a' : '#1e1f2a',
                    color: terrainNoiseSeed === s ? '#a0d0a0' : '#5a5a7a',
                    border: `1px solid ${terrainNoiseSeed === s ? '#4a7a4a' : '#2a2a3a'}`,
                    borderRadius: 3,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 11,
                  }}
                >
                  {s}
                </button>
              ))}
              <input
                type="number"
                min={0} max={999}
                value={terrainNoiseSeed}
                onChange={(e) => setTerrainNoiseSeed(Number(e.target.value))}
                style={{
                  width: 52,
                  padding: '3px 6px',
                  background: '#1e1f2a',
                  color: '#a0a0c0',
                  border: '1px solid #2a2a3a',
                  borderRadius: 3,
                  fontFamily: 'inherit',
                  fontSize: 11,
                }}
              />
            </div>
          </div>

          {terrainDisplacement === 0 && (
            <div style={{ color: '#5a5a7a', fontSize: 11, fontStyle: 'italic' }}>
              Displacement is 0 — no effect visible.
            </div>
          )}
        </>
      )}
    </div>
  )
}

function StyleSlider({
  label, value, min, max, step, unit, hint, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number; unit: string; hint?: string
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ color: '#8a8aaa', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</span>
        <span style={{ color: '#c8b88a', fontSize: 11, fontWeight: 700 }}>{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#a08050' }}
      />
      {hint && (
        <div style={{ color: '#3a3a52', fontSize: 10, marginTop: 4, lineHeight: 1.4 }}>{hint}</div>
      )}
    </div>
  )
}

function ElevSlider({
  label, value, min, max, step, unit, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number; unit: string
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ color: '#8a8aaa', fontSize: 11 }}>{label}</span>
        <span style={{ color: '#a0c0d8', fontSize: 11, fontWeight: 700 }}>{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#4a7aaa' }}
      />
    </div>
  )
}

function InfoTooltip({ text }: { text: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const show = () => {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    setPos({ x: r.left + r.width / 2, y: r.top - 8 })
  }

  return (
    <div style={{ display: 'inline-flex' }}>
      <button
        ref={btnRef}
        onMouseEnter={show}
        onMouseLeave={() => setPos(null)}
        onFocus={show}
        onBlur={() => setPos(null)}
        style={{
          width: 14, height: 14,
          borderRadius: '50%',
          background: '#2a2a3a',
          border: '1px solid #4a4a6a',
          color: '#7a7a9a',
          fontSize: 9,
          lineHeight: '12px',
          textAlign: 'center',
          cursor: 'default',
          padding: 0,
          fontFamily: 'inherit',
          flexShrink: 0,
        }}
      >
        ?
      </button>
      {pos && (
        <div style={{
          position: 'fixed',
          left: pos.x,
          top: pos.y,
          transform: 'translate(-50%, -100%)',
          width: 220,
          background: '#1a1b28',
          border: '1px solid #3a3a5a',
          borderRadius: 5,
          padding: '8px 10px',
          color: '#b0b0cc',
          fontSize: 11,
          lineHeight: 1.55,
          whiteSpace: 'pre-wrap',
          zIndex: 1000,
          pointerEvents: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}>
          {text}
        </div>
      )}
    </div>
  )
}

function HeatmapToggle({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: '100%',
        padding: '5px 10px',
        background: active ? '#1e3a5a' : '#1e1f2a',
        color: active ? '#88c0e0' : '#5a5a7a',
        border: `1px solid ${active ? '#3a6a9a' : '#2a2a3a'}`,
        borderRadius: 3,
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 11,
        textAlign: 'left',
      }}
    >
      {active ? '◉' : '○'} {label}
    </button>
  )
}
