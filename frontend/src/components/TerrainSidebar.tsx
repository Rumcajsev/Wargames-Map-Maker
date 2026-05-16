import { useEffect, useState } from 'react'
import { useMapStore, TERRAIN_COLORS, DEFAULT_THRESHOLDS, TERRAIN_PRIORITY } from '../store/mapStore'
import { TerrainBrushPicker } from './TerrainBrushPicker'
import { TerrainSettingsFlyout } from './TerrainSettingsFlyout'
import { sidebarStyle, sectionStyle, labelStyle, modeBtn } from './sidebarStyles'

const terrainLabel = (t: string) => t.replace(/_/g, ' ')

const SLIDER_TERRAINS = TERRAIN_PRIORITY.filter(t => t !== 'clear')

export function TerrainSidebar() {
  const {
    terrainPaintMode,
    terrainPaintBrush,
    setActiveTool,
    thresholds, setTerrainThreshold,
    disabledTerrains, toggleTerrainDisabled,
    selectedHex, setSelectedHex,
    terrainBlobSmooth, setTerrainBlobSmooth,
    terrainBlobOffset, setTerrainBlobOffset,
    terrainBlobBump, setTerrainBlobBump,
    terrainBlobSweepFreq, setTerrainBlobSweepFreq,
    terrainBlobLobeFreq, setTerrainBlobLobeFreq,
    terrainBlobLobeAmp, setTerrainBlobLobeAmp,
    terrainBlobLobeThreshold, setTerrainBlobLobeThreshold,
    terrainBlobLobeDirection, setTerrainBlobLobeDirection,
    terrainColors,
    terrainRenderMode, setTerrainRenderMode,
    terrainLayersEnabled, setTerrainLayersEnabled,
    realisticCoastline, setRealisticCoastline,
    beachStrip, setBeachStrip,
    beachColor, setBeachColor,
    beachWidth, setBeachWidth,
    fieldFreq, setFieldFreq,
    fieldAmp, setFieldAmp,
    fieldOctaves, setFieldOctaves,
    fieldPersistence, setFieldPersistence,
  } = useMapStore()

  const [openSettingsTerrain, setOpenSettingsTerrain] = useState<string | null>(null)
  const [settingsAnchorY, setSettingsAnchorY] = useState(0)

  const selectBrush = (terrain: string) => {
    if (terrainPaintMode && terrainPaintBrush === terrain) {
      setActiveTool({ type: 'none' })
    } else {
      setActiveTool({ type: 'terrain', brush: terrain })
    }
  }

  const openSettings = (terrain: string, y: number) => {
    if (openSettingsTerrain === terrain) {
      setOpenSettingsTerrain(null)
    } else {
      setOpenSettingsTerrain(terrain)
      setSettingsAnchorY(y)
    }
  }

  // Keyboard shortcuts: 1–8 for terrain brushes, Escape to deselect
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      const idx = parseInt(e.key) - 1
      if (idx >= 0 && idx < TERRAIN_PRIORITY.length) {
        selectBrush(TERRAIN_PRIORITY[idx])
      } else if (e.key === 'Escape') {
        setActiveTool({ type: 'none' })
        setOpenSettingsTerrain(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terrainPaintMode, terrainPaintBrush])

  return (
    <>
      {openSettingsTerrain && (
        <TerrainSettingsFlyout
          terrain={openSettingsTerrain}
          anchorY={settingsAnchorY}
          onClose={() => setOpenSettingsTerrain(null)}
        />
      )}
      <div style={sidebarStyle}>

        {/* ── Paint tools ── */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Paint</div>
          <TerrainBrushPicker
            activeBrush={terrainPaintBrush}
            paintMode={terrainPaintMode}
            onSelect={selectBrush}
            onSettings={openSettings}
          />
        </div>

        {/* ── Render mode + style ── */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Render Style</div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            <button style={modeBtn(terrainRenderMode === 'blob')} onClick={() => setTerrainRenderMode('blob')}>Blob</button>
            <button style={modeBtn(terrainRenderMode === 'field')} onClick={() => setTerrainRenderMode('field')}>Field</button>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, color: realisticCoastline ? '#c0c0e0' : '#6a6a8a', marginBottom: realisticCoastline ? 6 : 8 }}>
            <input
              type="checkbox"
              checked={realisticCoastline}
              onChange={e => setRealisticCoastline(e.target.checked)}
              style={{ accentColor: '#4a7a9a' }}
            />
            Realistic coastline
          </label>

          {realisticCoastline && (
            <div style={{ paddingLeft: 18, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, color: beachStrip ? '#c0c0e0' : '#6a6a8a' }}>
                <input
                  type="checkbox"
                  checked={beachStrip}
                  onChange={e => setBeachStrip(e.target.checked)}
                  style={{ accentColor: '#c8a84b' }}
                />
                Beach strip
              </label>
              {beachStrip && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, color: '#8a8aaa', width: 40 }}>Color</span>
                    <input
                      type="color"
                      value={beachColor}
                      onChange={e => setBeachColor(e.target.value)}
                      style={{ width: 32, height: 18, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                    />
                    <span style={{ fontSize: 10, color: '#6a6a8a' }}>{beachColor}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, color: '#8a8aaa', width: 40 }}>Width</span>
                    <input
                      type="range"
                      min={0.01} max={0.25} step={0.01}
                      value={beachWidth}
                      onChange={e => setBeachWidth(Number(e.target.value))}
                      style={{ flex: 1, accentColor: '#c8a84b' }}
                    />
                    <span style={{ fontSize: 10, color: '#8a8aaa', width: 28, textAlign: 'right' }}>{Math.round(beachWidth * 100)}%</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {terrainRenderMode === 'blob' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, color: terrainLayersEnabled ? '#c0c0e0' : '#6a6a8a' }}>
                <input
                  type="checkbox"
                  checked={terrainLayersEnabled}
                  onChange={e => setTerrainLayersEnabled(e.target.checked)}
                  style={{ accentColor: '#4a7a5a' }}
                />
                Terrain layers (paint stacks blobs)
              </label>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span>Corner Rounding</span>
                  <span style={{ color: '#5a5a7a', fontSize: 10 }}>{terrainBlobSmooth}</span>
                </div>
                <input type="range" min={0} max={5} step={1} value={terrainBlobSmooth}
                  onChange={e => setTerrainBlobSmooth(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#7a9e7a' }} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span>Waviness</span>
                  <span style={{ color: '#5a5a7a', fontSize: 10 }}>{Math.round(terrainBlobBump * 100)}%</span>
                </div>
                <input type="range" min={0} max={60} step={1} value={Math.round(terrainBlobBump * 100)}
                  onChange={e => setTerrainBlobBump(Number(e.target.value) / 100)}
                  style={{ width: '100%', accentColor: '#7a9e7a' }} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span>Inset</span>
                  <span style={{ color: '#5a5a7a', fontSize: 10 }}>{terrainBlobOffset > 0 ? '+' : ''}{Math.round(terrainBlobOffset * 100)}%</span>
                </div>
                <input type="range" min={-80} max={30} step={1} value={Math.round(terrainBlobOffset * 100)}
                  onChange={e => setTerrainBlobOffset(Number(e.target.value) / 100)}
                  style={{ width: '100%', accentColor: '#7a9e7a' }} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span>Wave Scale</span>
                  <span style={{ color: '#5a5a7a', fontSize: 10 }}>{terrainBlobSweepFreq.toFixed(2)}</span>
                </div>
                <input type="range" min={40} max={100} step={1} value={Math.round(terrainBlobSweepFreq * 100)}
                  onChange={e => setTerrainBlobSweepFreq(Number(e.target.value) / 100)}
                  style={{ width: '100%', accentColor: '#7a9e7a' }} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span>Fringe Scale</span>
                  <span style={{ color: '#5a5a7a', fontSize: 10 }}>{terrainBlobLobeFreq.toFixed(1)}</span>
                </div>
                <input type="range" min={20} max={50} step={1} value={Math.round(terrainBlobLobeFreq * 10)}
                  onChange={e => setTerrainBlobLobeFreq(Number(e.target.value) / 10)}
                  style={{ width: '100%', accentColor: '#7a9e7a' }} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span>Fringe Strength</span>
                  <span style={{ color: '#5a5a7a', fontSize: 10 }}>{Math.round(terrainBlobLobeAmp * 100)}%</span>
                </div>
                <input type="range" min={0} max={100} step={1} value={Math.round(terrainBlobLobeAmp * 100)}
                  onChange={e => setTerrainBlobLobeAmp(Number(e.target.value) / 100)}
                  style={{ width: '100%', accentColor: '#7a9e7a' }} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span>Fringe Sparsity</span>
                  <span style={{ color: '#5a5a7a', fontSize: 10 }}>{Math.round(terrainBlobLobeThreshold * 100)}%</span>
                </div>
                <input type="range" min={0} max={40} step={1} value={Math.round(terrainBlobLobeThreshold * 100)}
                  onChange={e => setTerrainBlobLobeThreshold(Number(e.target.value) / 100)}
                  style={{ width: '100%', accentColor: '#7a9e7a' }} />
              </div>
              <div>
                <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a', marginBottom: 5 }}>Fringe Direction</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button style={modeBtn(terrainBlobLobeDirection >= 0)} onClick={() => setTerrainBlobLobeDirection(1)}>Outward</button>
                  <button style={modeBtn(terrainBlobLobeDirection < 0)} onClick={() => setTerrainBlobLobeDirection(-1)}>Inward</button>
                </div>
              </div>
            </div>
          )}

          {terrainRenderMode === 'field' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span>Scale</span>
                  <span style={{ color: '#5a5a7a', fontSize: 10 }}>{fieldFreq.toFixed(2)}</span>
                </div>
                <input type="range" min={5} max={200} step={1} value={Math.round(fieldFreq * 100)}
                  onChange={e => setFieldFreq(Number(e.target.value) / 100)}
                  style={{ width: '100%', accentColor: '#7a9e7a' }} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span>Displacement</span>
                  <span style={{ color: '#5a5a7a', fontSize: 10 }}>{fieldAmp.toFixed(2)}</span>
                </div>
                <input type="range" min={0} max={300} step={1} value={Math.round(fieldAmp * 100)}
                  onChange={e => setFieldAmp(Number(e.target.value) / 100)}
                  style={{ width: '100%', accentColor: '#7a9e7a' }} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span>Detail</span>
                  <span style={{ color: '#5a5a7a', fontSize: 10 }}>{fieldOctaves}</span>
                </div>
                <input type="range" min={1} max={6} step={1} value={fieldOctaves}
                  onChange={e => setFieldOctaves(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#7a9e7a' }} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span>Roughness</span>
                  <span style={{ color: '#5a5a7a', fontSize: 10 }}>{Math.round(fieldPersistence * 100)}%</span>
                </div>
                <input type="range" min={10} max={90} step={1} value={Math.round(fieldPersistence * 100)}
                  onChange={e => setFieldPersistence(Number(e.target.value) / 100)}
                  style={{ width: '100%', accentColor: '#7a9e7a' }} />
              </div>
            </div>
          )}
        </div>

        {/* ── Classification ── */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Classification</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {SLIDER_TERRAINS.map(terrain => {
              const disabled = disabledTerrains.has(terrain)
              const value = thresholds[terrain] ?? DEFAULT_THRESHOLDS[terrain] ?? 0.25
              const color = terrainColors[terrain] ?? TERRAIN_COLORS[terrain] ?? '#888'
              return (
                <div key={terrain} style={{ opacity: disabled ? 0.4 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <button
                        onClick={() => toggleTerrainDisabled(terrain)}
                        title={disabled ? 'Enable' : 'Disable'}
                        style={{
                          width: 10, height: 10, borderRadius: 2,
                          background: disabled ? '#2a2a3a' : color,
                          border: disabled ? '1px solid #4a4a6a' : 'none',
                          flexShrink: 0, cursor: 'pointer', padding: 0,
                        }}
                      />
                      <span style={{ textTransform: 'capitalize', color: disabled ? '#4a4a6a' : '#a0a0c0' }}>
                        {terrainLabel(terrain)}
                      </span>
                    </div>
                    <span style={{ color: '#5a5a7a', fontSize: 10 }}>
                      {Math.round(value * 100)}%
                    </span>
                  </div>
                  <input
                    type="range" min={0} max={100} step={1}
                    value={Math.round(value * 100)}
                    disabled={disabled}
                    onChange={e => setTerrainThreshold(terrain, Number(e.target.value) / 100)}
                    style={{ width: '100%', accentColor: color, cursor: disabled ? 'not-allowed' : 'pointer' }}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Selected hex ── */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Selected Hex</div>
          {selectedHex ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{
                  display: 'inline-block', width: 10, height: 10, borderRadius: 2,
                  background: terrainColors[selectedHex.terrain] ?? TERRAIN_COLORS[selectedHex.terrain] ?? '#888', flexShrink: 0,
                }} />
                <span style={{ color: '#e0e0f0', textTransform: 'capitalize' }}>
                  {terrainLabel(selectedHex.terrain)}
                </span>
              </div>
              <div style={{ color: '#6a6a8a', fontSize: 11 }}>q {selectedHex.q}, r {selectedHex.r}</div>
              <button
                onClick={() => setSelectedHex(null)}
                style={{
                  marginTop: 6, background: 'none', border: '1px solid #2a2a4a',
                  color: '#6a6a8a', padding: '2px 8px', borderRadius: 3,
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 11,
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#a0a0c0')}
                onMouseLeave={e => (e.currentTarget.style.color = '#6a6a8a')}
              >
                deselect
              </button>
            </>
          ) : (
            <div style={{ color: '#4a4a6a' }}>Click a hex to select</div>
          )}
        </div>

      </div>
    </>
  )
}
