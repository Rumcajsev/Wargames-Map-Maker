import { useEffect, useId, useState } from 'react'
import { useMapStore, TERRAIN_COLORS, DEFAULT_THRESHOLDS, TERRAIN_PRIORITY, MANUAL_ONLY_TERRAINS } from '../store/mapStore'
import type { CustomTerrain } from '../store/mapStore'
import { TEXTURE_REGISTRY } from '../lib/textureRegistry'
import { TerrainBrushPicker } from './TerrainBrushPicker'
import { TerrainSettingsFlyout } from './TerrainSettingsFlyout'
import { CoastlineSettingsFlyout } from './CoastlineSettingsFlyout'
import { EdgeBlobShapeFlyout } from './EdgeBlobShapeFlyout'
import { sidebarStyle, sectionStyle, labelStyle, modeBtn } from './sidebarStyles'
import { EnabledSection } from './ui'

const terrainLabel = (t: string) => t.replace(/_/g, ' ')

const SLIDER_TERRAINS = TERRAIN_PRIORITY.filter(t => t !== 'clear' && !MANUAL_ONLY_TERRAINS.has(t))

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
    customTerrains, addCustomTerrain, updateCustomTerrain, removeCustomTerrain,
  } = useMapStore()

  const [openSettingsTerrain, setOpenSettingsTerrain] = useState<string | null>(null)
  const [settingsAnchorY, setSettingsAnchorY] = useState(0)
  const [defaultsOpen, setDefaultsOpen] = useState(false)
  const [defaultsAnchorY, setDefaultsAnchorY] = useState(0)
  const [edgeBlobShapeOpen, setEdgeBlobShapeOpen] = useState(false)
  const [edgeBlobShapeAnchorY, setEdgeBlobShapeAnchorY] = useState(0)
  const [coastlineFlyoutOpen, setCoastlineFlyoutOpen] = useState(false)
  const [coastlineAnchorY, setCoastlineAnchorY] = useState(0)
  const [editingCustomId, setEditingCustomId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#a07850')
  const [newTextureId, setNewTextureId] = useState<string | null>(null)
  const [addingCustom, setAddingCustom] = useState(false)
  const uid = useId()

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
              Near edge → paints edge blob · mountains → cliff symbol
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

        {/* ── Custom terrains ── */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Custom Terrains</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {customTerrains.map(ct => (
              <div key={ct.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 12, height: 12, borderRadius: 2, background: ct.color, flexShrink: 0, border: '1px solid #3a3a5a' }} />
                {editingCustomId === ct.id ? (
                  <input
                    autoFocus
                    value={ct.name}
                    onChange={e => updateCustomTerrain(ct.id, { name: e.target.value })}
                    onBlur={() => setEditingCustomId(null)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingCustomId(null) }}
                    style={{ flex: 1, background: '#1a1f2a', border: '1px solid #3a5a7a', borderRadius: 3, padding: '2px 5px', color: '#c0c0e0', fontSize: 11, fontFamily: 'ui-monospace, monospace' }}
                  />
                ) : (
                  <span
                    style={{ flex: 1, fontSize: 11, color: '#b0b0d0', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    onDoubleClick={() => setEditingCustomId(ct.id)}
                    title="Double-click to rename"
                  >{ct.name}</span>
                )}
                <input
                  type="color"
                  value={ct.color}
                  onChange={e => updateCustomTerrain(ct.id, { color: e.target.value })}
                  title="Color"
                  style={{ width: 18, height: 18, padding: 0, border: 'none', borderRadius: 2, cursor: 'pointer', background: 'none', flexShrink: 0 }}
                />
                <select
                  value={ct.textureId ?? ''}
                  onChange={e => updateCustomTerrain(ct.id, { textureId: e.target.value || null })}
                  title="Texture"
                  style={{ fontSize: 9, background: '#1a1f2a', border: '1px solid #2a2a3a', borderRadius: 2, color: '#8a8aaa', padding: '1px 2px', maxWidth: 64, cursor: 'pointer' }}
                >
                  <option value="">no texture</option>
                  {TEXTURE_REGISTRY.map(tx => <option key={tx.id} value={tx.id}>{tx.label}</option>)}
                </select>
                <button
                  onClick={() => removeCustomTerrain(ct.id)}
                  title="Remove"
                  style={{ background: 'none', border: 'none', color: '#5a3a3a', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: '0 2px' }}
                >×</button>
              </div>
            ))}
            {addingCustom ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, background: '#12141e', borderRadius: 4, padding: '6px 8px', border: '1px solid #2a2a4a' }}>
                <input
                  autoFocus
                  placeholder="Name…"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') setAddingCustom(false) }}
                  style={{ background: '#1a1f2a', border: '1px solid #3a5a7a', borderRadius: 3, padding: '3px 6px', color: '#c0c0e0', fontSize: 11, fontFamily: 'ui-monospace, monospace' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 10, color: '#6a6a8a' }}>Color</label>
                  <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} style={{ width: 24, height: 20, padding: 0, border: 'none', borderRadius: 2, cursor: 'pointer' }} />
                  <label style={{ fontSize: 10, color: '#6a6a8a' }}>Texture</label>
                  <select
                    value={newTextureId ?? ''}
                    onChange={e => setNewTextureId(e.target.value || null)}
                    style={{ fontSize: 9, background: '#1a1f2a', border: '1px solid #2a2a3a', borderRadius: 2, color: '#8a8aaa', padding: '1px 2px', flex: 1, cursor: 'pointer' }}
                  >
                    <option value="">none</option>
                    {TEXTURE_REGISTRY.map(tx => <option key={tx.id} value={tx.id}>{tx.label}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    disabled={!newName.trim()}
                    onClick={() => {
                      if (!newName.trim()) return
                      const id = `custom_${uid}_${Date.now()}`
                      addCustomTerrain({ id, name: newName.trim(), color: newColor, textureId: newTextureId })
                      setNewName('')
                      setNewColor('#a07850')
                      setNewTextureId(null)
                      setAddingCustom(false)
                    }}
                    style={{ flex: 1, fontSize: 10, padding: '3px 0', borderRadius: 3, border: 'none', background: '#3a5a3a', color: '#c0e0c0', cursor: 'pointer' }}
                  >Add</button>
                  <button
                    onClick={() => setAddingCustom(false)}
                    style={{ fontSize: 10, padding: '3px 8px', borderRadius: 3, border: '1px solid #2a2a3a', background: 'none', color: '#6a6a8a', cursor: 'pointer' }}
                  >Cancel</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingCustom(true)}
                style={{ fontSize: 10, padding: '3px 0', borderRadius: 3, border: '1px dashed #2a2a4a', background: 'none', color: '#4a4a6a', cursor: 'pointer', width: '100%' }}
              >+ Add custom terrain</button>
            )}
          </div>
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
