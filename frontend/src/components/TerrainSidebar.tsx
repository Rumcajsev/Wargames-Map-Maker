import { useEffect, useState } from 'react'
import { useMapStore, TERRAIN_COLORS, DEFAULT_THRESHOLDS, TERRAIN_PRIORITY } from '../store/mapStore'
import { TerrainBrushPicker } from './TerrainBrushPicker'
import { TerrainSettingsFlyout } from './TerrainSettingsFlyout'
import { sidebarStyle, sectionStyle, labelStyle, modeBtn } from './sidebarStyles'

const EDGE_BRUSH_TERRAINS = TERRAIN_PRIORITY.filter(t => t !== 'clear')

const terrainLabel = (t: string) => t.replace(/_/g, ' ')

const SLIDER_TERRAINS = TERRAIN_PRIORITY.filter(t => t !== 'clear')

export function TerrainSidebar() {
  const {
    terrainPaintMode,
    terrainPaintBrush,
    setActiveTool,
    thresholds, setTerrainThreshold,
    disabledTerrains, toggleTerrainDisabled,
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
    edgeBlobPaintMode, edgeBlobPaintBrush, setEdgeBlobPaintMode, setEdgeBlobPaintBrush,
    edgeBlobSmooth, setEdgeBlobSmooth,
    edgeBlobOffset, setEdgeBlobOffset,
    edgeBlobBump, setEdgeBlobBump,
    edgeBlobSweepFreq, setEdgeBlobSweepFreq,
    edgeBlobLobeFreq, setEdgeBlobLobeFreq,
    edgeBlobLobeAmp, setEdgeBlobLobeAmp,
    edgeBlobLobeThreshold, setEdgeBlobLobeThreshold,
    edgeBlobLobeDirection, setEdgeBlobLobeDirection,
    edgeBlobWidth, setEdgeBlobWidth,
  } = useMapStore()

  const [openSettingsTerrain, setOpenSettingsTerrain] = useState<string | null>(null)
  const [settingsAnchorY, setSettingsAnchorY] = useState(0)
  const [defaultsOpen, setDefaultsOpen] = useState(false)
  const [defaultsAnchorY, setDefaultsAnchorY] = useState(0)
  const [edgeBlobShapeOpen, setEdgeBlobShapeOpen] = useState(false)

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
      setDefaultsOpen(false)
      setOpenSettingsTerrain(terrain)
      setSettingsAnchorY(y)
    }
  }

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
        setDefaultsOpen(false)
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
      {defaultsOpen && (
        <TerrainSettingsFlyout
          anchorY={defaultsAnchorY}
          onClose={() => setDefaultsOpen(false)}
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
              <button
                data-terrain-flyout=""
                onClick={e => {
                  if (defaultsOpen) {
                    setDefaultsOpen(false)
                  } else {
                    setOpenSettingsTerrain(null)
                    setDefaultsOpen(true)
                    setDefaultsAnchorY(e.currentTarget.getBoundingClientRect().top)
                  }
                }}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: defaultsOpen ? '#1a1f1a' : 'none',
                  border: `1px solid ${defaultsOpen ? '#3a5a3a' : '#1e1f2e'}`,
                  borderRadius: 3, padding: '5px 8px', cursor: 'pointer',
                  fontFamily: 'ui-monospace, monospace', fontSize: 11,
                  color: defaultsOpen ? '#c0e0c0' : '#8a8aaa', width: '100%',
                }}
                onMouseEnter={e => { if (!defaultsOpen) e.currentTarget.style.color = '#a0a0c0' }}
                onMouseLeave={e => { if (!defaultsOpen) e.currentTarget.style.color = '#8a8aaa' }}
              >
                <span>Default blob shape</span>
                <span style={{ fontSize: 9, color: '#4a4a6a' }}>›</span>
              </button>
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

        {/* ── Edge blobs ── */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Edge Blobs</div>

          {/* Brush row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {/* Mode toggle: clear = eraser */}
            <button
              style={{
                ...modeBtn(edgeBlobPaintBrush === 'clear' && edgeBlobPaintMode),
                fontSize: 10, padding: '3px 7px',
              }}
              onClick={() => {
                if (edgeBlobPaintMode && edgeBlobPaintBrush === 'clear') {
                  setEdgeBlobPaintMode(false)
                  setActiveTool({ type: 'none' })
                } else {
                  setEdgeBlobPaintBrush('clear')
                  setEdgeBlobPaintMode(true)
                  setActiveTool({ type: 'none' })
                }
              }}
            >Erase</button>
            {EDGE_BRUSH_TERRAINS.map(t => {
              const color = terrainColors[t] ?? TERRAIN_COLORS[t] ?? '#888'
              const active = edgeBlobPaintMode && edgeBlobPaintBrush === t
              return (
                <button
                  key={t}
                  onClick={() => {
                    if (active) {
                      setEdgeBlobPaintMode(false)
                      setActiveTool({ type: 'none' })
                    } else {
                      setEdgeBlobPaintBrush(t)
                      setEdgeBlobPaintMode(true)
                      setActiveTool({ type: 'none' })
                    }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '3px 7px', fontSize: 10, letterSpacing: 0.5, textTransform: 'capitalize',
                    background: active ? '#1a2a1a' : 'none',
                    border: `1px solid ${active ? color : '#1e1f2e'}`,
                    color: active ? color : '#6a6a8a',
                    borderRadius: 3, cursor: 'pointer', fontFamily: 'ui-monospace, monospace',
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: color, display: 'inline-block', flexShrink: 0 }} />
                  {t.replace(/_/g, ' ')}
                </button>
              )
            })}
          </div>

          {edgeBlobPaintMode && (
            <div style={{ fontSize: 10, color: '#5a8a5a', marginBottom: 8, letterSpacing: 0.3 }}>
              Edge paint active — click near hex edges
            </div>
          )}

          {/* Global shape params (collapsible) */}
          <button
            onClick={() => setEdgeBlobShapeOpen(v => !v)}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: edgeBlobShapeOpen ? '#1a1f1a' : 'none',
              border: `1px solid ${edgeBlobShapeOpen ? '#3a5a3a' : '#1e1f2e'}`,
              borderRadius: 3, padding: '5px 8px', cursor: 'pointer',
              fontFamily: 'ui-monospace, monospace', fontSize: 11,
              color: edgeBlobShapeOpen ? '#c0e0c0' : '#8a8aaa', width: '100%',
            }}
            onMouseEnter={e => { if (!edgeBlobShapeOpen) e.currentTarget.style.color = '#a0a0c0' }}
            onMouseLeave={e => { if (!edgeBlobShapeOpen) e.currentTarget.style.color = '#8a8aaa' }}
          >
            <span>Edge blob shape</span>
            <span style={{ fontSize: 9, color: '#4a4a6a' }}>›</span>
          </button>

          {edgeBlobShapeOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, fontSize: 11, color: '#a0a0c0' }}>
              {/* Width */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a' }}>Width</span>
                  <span style={{ color: '#5a5a7a', fontSize: 10 }}>{Math.round(edgeBlobWidth * 100)}%</span>
                </div>
                <input type="range" min={5} max={80} step={1} value={Math.round(edgeBlobWidth * 100)}
                  onChange={e => setEdgeBlobWidth(Number(e.target.value) / 100)}
                  style={{ width: '100%', accentColor: '#7a9e7a' }} />
              </div>
              {/* Smooth */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a' }}>Corner Rounding</span>
                  <span style={{ color: '#5a5a7a', fontSize: 10 }}>{edgeBlobSmooth}</span>
                </div>
                <input type="range" min={0} max={5} step={1} value={edgeBlobSmooth}
                  onChange={e => setEdgeBlobSmooth(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#7a9e7a' }} />
              </div>
              {/* Bump */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a' }}>Waviness</span>
                  <span style={{ color: '#5a5a7a', fontSize: 10 }}>{Math.round(edgeBlobBump * 100)}%</span>
                </div>
                <input type="range" min={0} max={60} step={1} value={Math.round(edgeBlobBump * 100)}
                  onChange={e => setEdgeBlobBump(Number(e.target.value) / 100)}
                  style={{ width: '100%', accentColor: '#7a9e7a' }} />
              </div>
              {/* Offset */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a' }}>Inset</span>
                  <span style={{ color: '#5a5a7a', fontSize: 10 }}>{edgeBlobOffset > 0 ? '+' : ''}{Math.round(edgeBlobOffset * 100)}%</span>
                </div>
                <input type="range" min={-80} max={30} step={1} value={Math.round(edgeBlobOffset * 100)}
                  onChange={e => setEdgeBlobOffset(Number(e.target.value) / 100)}
                  style={{ width: '100%', accentColor: '#7a9e7a' }} />
              </div>
              {/* SweepFreq */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a' }}>Wave Scale</span>
                  <span style={{ color: '#5a5a7a', fontSize: 10 }}>{edgeBlobSweepFreq.toFixed(2)}</span>
                </div>
                <input type="range" min={40} max={100} step={1} value={Math.round(edgeBlobSweepFreq * 100)}
                  onChange={e => setEdgeBlobSweepFreq(Number(e.target.value) / 100)}
                  style={{ width: '100%', accentColor: '#7a9e7a' }} />
              </div>
              {/* LobeFreq */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a' }}>Fringe Scale</span>
                  <span style={{ color: '#5a5a7a', fontSize: 10 }}>{edgeBlobLobeFreq.toFixed(1)}</span>
                </div>
                <input type="range" min={20} max={50} step={1} value={Math.round(edgeBlobLobeFreq * 10)}
                  onChange={e => setEdgeBlobLobeFreq(Number(e.target.value) / 10)}
                  style={{ width: '100%', accentColor: '#7a9e7a' }} />
              </div>
              {/* LobeAmp */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a' }}>Fringe Strength</span>
                  <span style={{ color: '#5a5a7a', fontSize: 10 }}>{Math.round(edgeBlobLobeAmp * 100)}%</span>
                </div>
                <input type="range" min={0} max={100} step={1} value={Math.round(edgeBlobLobeAmp * 100)}
                  onChange={e => setEdgeBlobLobeAmp(Number(e.target.value) / 100)}
                  style={{ width: '100%', accentColor: '#7a9e7a' }} />
              </div>
              {/* LobeThreshold */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a' }}>Fringe Sparsity</span>
                  <span style={{ color: '#5a5a7a', fontSize: 10 }}>{Math.round(edgeBlobLobeThreshold * 100)}%</span>
                </div>
                <input type="range" min={0} max={40} step={1} value={Math.round(edgeBlobLobeThreshold * 100)}
                  onChange={e => setEdgeBlobLobeThreshold(Number(e.target.value) / 100)}
                  style={{ width: '100%', accentColor: '#7a9e7a' }} />
              </div>
              {/* LobeDirection */}
              <div>
                <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a', marginBottom: 5 }}>Fringe Direction</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {([['Outward', 1], ['Inward', -1]] as const).map(([label, dir]) => {
                    const active = dir === 1 ? edgeBlobLobeDirection >= 0 : edgeBlobLobeDirection < 0
                    return (
                      <button key={label} onClick={() => setEdgeBlobLobeDirection(dir)} style={{
                        flex: 1, padding: '3px 0', fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase',
                        background: active ? '#2a3a5a' : 'none', border: '1px solid #2a2a4a',
                        color: active ? '#8ab0e0' : '#4a4a6a', borderRadius: 3, cursor: 'pointer',
                        fontFamily: 'ui-monospace, monospace',
                      }}>{label}</button>
                    )
                  })}
                </div>
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

      </div>
    </>
  )
}
