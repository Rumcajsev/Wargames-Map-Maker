import { useEffect, useState } from 'react'
import { useMapStore, TERRAIN_COLORS, DEFAULT_THRESHOLDS, TERRAIN_PRIORITY } from '../store/mapStore'
import { TerrainBrushPicker } from './TerrainBrushPicker'
import { TerrainSettingsFlyout } from './TerrainSettingsFlyout'
import { CoastlineSettingsFlyout } from './CoastlineSettingsFlyout'
import { EdgeBlobShapeFlyout } from './EdgeBlobShapeFlyout'
import { sidebarStyle, sectionStyle, labelStyle, modeBtn } from './sidebarStyles'
import { EnabledSection } from './ui'

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
    terrainLayersEnabled, setTerrainLayersEnabled,
    realisticCoastline, setRealisticCoastline,
    terrainEdgePaintEnabled, setTerrainEdgePaintEnabled,
  } = useMapStore()

  const [openSettingsTerrain, setOpenSettingsTerrain] = useState<string | null>(null)
  const [settingsAnchorY, setSettingsAnchorY] = useState(0)
  const [defaultsOpen, setDefaultsOpen] = useState(false)
  const [defaultsAnchorY, setDefaultsAnchorY] = useState(0)
  const [edgeBlobShapeOpen, setEdgeBlobShapeOpen] = useState(false)
  const [edgeBlobShapeAnchorY, setEdgeBlobShapeAnchorY] = useState(0)
  const [coastlineFlyoutOpen, setCoastlineFlyoutOpen] = useState(false)
  const [coastlineAnchorY, setCoastlineAnchorY] = useState(0)

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
      {coastlineFlyoutOpen && (
        <CoastlineSettingsFlyout
          anchorY={coastlineAnchorY}
          onClose={() => setCoastlineFlyoutOpen(false)}
        />
      )}
      {edgeBlobShapeOpen && (
        <EdgeBlobShapeFlyout
          anchorY={edgeBlobShapeAnchorY}
          onClose={() => setEdgeBlobShapeOpen(false)}
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
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, color: terrainEdgePaintEnabled ? '#c0c0e0' : '#6a6a8a', marginTop: 8 }}>
            <input
              type="checkbox"
              checked={terrainEdgePaintEnabled}
              onChange={e => setTerrainEdgePaintEnabled(e.target.checked)}
              style={{ accentColor: '#7a9e7a' }}
            />
            Edge painting
          </label>
          {terrainEdgePaintEnabled && (
            <div style={{ fontSize: 10, color: '#5a8a5a', marginTop: 4, letterSpacing: 0.3, paddingLeft: 18 }}>
              Near edge → paints edge blob
            </div>
          )}
        </div>

        {/* ── Render mode + style ── */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Render Style</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <EnabledSection
              label="Realistic coastline"
              enabled={realisticCoastline}
              onToggle={v => { setRealisticCoastline(v); if (!v) setCoastlineFlyoutOpen(false) }}
              accentColor="#4a7a9a"
            >
              <button
                data-coastline-flyout=""
                onClick={e => {
                  setCoastlineFlyoutOpen(o => !o)
                  setCoastlineAnchorY(e.currentTarget.getBoundingClientRect().top)
                }}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: coastlineFlyoutOpen ? '#1a1f2a' : 'none',
                  border: `1px solid ${coastlineFlyoutOpen ? '#3a5a7a' : '#1e1f2e'}`,
                  borderRadius: 3, padding: '5px 8px', cursor: 'pointer',
                  fontFamily: 'ui-monospace, monospace', fontSize: 11,
                  color: coastlineFlyoutOpen ? '#a0c0e0' : '#8a8aaa', width: '100%',
                }}
                onMouseEnter={e => { if (!coastlineFlyoutOpen) e.currentTarget.style.color = '#a0a0c0' }}
                onMouseLeave={e => { if (!coastlineFlyoutOpen) e.currentTarget.style.color = '#8a8aaa' }}
              >
                <span>Coastline settings</span>
                <span style={{ fontSize: 9, color: '#4a4a6a' }}>›</span>
              </button>
            </EnabledSection>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, color: terrainLayersEnabled ? '#c0c0e0' : '#6a6a8a' }}>
              <input
                type="checkbox"
                checked={terrainLayersEnabled}
                onChange={e => setTerrainLayersEnabled(e.target.checked)}
                style={{ accentColor: '#4a7a5a' }}
              />
              Terrain layers
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

          {/* Field mode controls — detached. Restore when reactivating field render. */}
        </div>

        {/* ── Edge blobs ── */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Edge Blobs</div>

          <button
            data-edge-blob-shape-flyout=""
            onClick={e => {
              setEdgeBlobShapeOpen(o => !o)
              setEdgeBlobShapeAnchorY(e.currentTarget.getBoundingClientRect().top)
            }}
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
