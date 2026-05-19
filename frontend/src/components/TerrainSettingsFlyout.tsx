import { useEffect, useRef, useState } from 'react'
import { useMapStore, TERRAIN_COLORS } from '../store/mapStore'
import { ColorSwatch } from './ColorSwatch'
import { PALETTE_TERRAIN } from '../palettes'
import { modeBtn } from './sidebarStyles'

const TEXTURED_TERRAINS = new Set(['clear', 'woods', 'light_woods'])

interface Props {
  terrain?: string  // undefined = defaults mode
  anchorY: number
  onClose: () => void
}

export function TerrainSettingsFlyout({ terrain, anchorY, onClose }: Props) {
  const {
    terrainColors, setTerrainColor,
    terrainTextureScales, setTerrainTextureScale,
    terrainRenderMode,
    fieldWildness, setFieldWildness,
    terrainTypeBlobStyles, setTerrainTypeBlobStyle,
    terrainBlobSmooth, setTerrainBlobSmooth,
    terrainBlobOffset, setTerrainBlobOffset,
    terrainBlobBump, setTerrainBlobBump,
    terrainBlobSweepFreq, setTerrainBlobSweepFreq,
    terrainBlobLobeFreq, setTerrainBlobLobeFreq,
    terrainBlobLobeAmp, setTerrainBlobLobeAmp,
    terrainBlobLobeThreshold, setTerrainBlobLobeThreshold,
    terrainBlobLobeDirection, setTerrainBlobLobeDirection,
  } = useMapStore()

  const isDefaults = terrain === undefined
  const [blobOpen, setBlobOpen] = useState(false)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-terrain-flyout]')) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const color = terrain ? (terrainColors[terrain] ?? TERRAIN_COLORS[terrain] ?? '#888888') : '#7a9e7a'
  const hasTexture = terrain ? TEXTURED_TERRAINS.has(terrain) : false
  const textureScale = terrain ? (terrainTextureScales[terrain] ?? 3) : 3
  const wildness = terrain ? (fieldWildness[terrain] ?? 1.0) : 1.0
  const hasWildness = !isDefaults && terrainRenderMode === 'field'
  const showBlobSection = terrainRenderMode === 'blob'

  const typeStyle = terrain ? terrainTypeBlobStyles[terrain] : null
  const overrideEnabled = typeStyle?.enabled ?? false

  const blobVals = {
    smooth: overrideEnabled ? (typeStyle?.smooth ?? terrainBlobSmooth) : terrainBlobSmooth,
    offset: overrideEnabled ? (typeStyle?.offset ?? terrainBlobOffset) : terrainBlobOffset,
    bump: overrideEnabled ? (typeStyle?.bump ?? terrainBlobBump) : terrainBlobBump,
    sweepFreq: overrideEnabled ? (typeStyle?.sweepFreq ?? terrainBlobSweepFreq) : terrainBlobSweepFreq,
    lobeFreq: overrideEnabled ? (typeStyle?.lobeFreq ?? terrainBlobLobeFreq) : terrainBlobLobeFreq,
    lobeAmp: overrideEnabled ? (typeStyle?.lobeAmp ?? terrainBlobLobeAmp) : terrainBlobLobeAmp,
    lobeThreshold: overrideEnabled ? (typeStyle?.lobeThreshold ?? terrainBlobLobeThreshold) : terrainBlobLobeThreshold,
    lobeDirection: overrideEnabled ? (typeStyle?.lobeDirection ?? terrainBlobLobeDirection) : terrainBlobLobeDirection,
  }

  // Local mirror of blobVals — updates instantly on drag, commits to store after 150 ms idle.
  // This prevents buildTerrainBlobsV2 from running on every slider tick.
  const [local, setLocal] = useState(blobVals)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draggingRef = useRef(false)

  // Sync from store when not mid-drag (external reset, terrain switch, override toggle)
  useEffect(() => {
    if (!draggingRef.current) setLocal(blobVals)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local.smooth, local.offset, local.bump, local.sweepFreq,
      local.lobeFreq, local.lobeAmp, local.lobeThreshold, local.lobeDirection])

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  const commitBlob = (field: string, val: number) => {
    if (isDefaults) {
      const setters: Record<string, (v: number) => void> = {
        smooth: setTerrainBlobSmooth, offset: setTerrainBlobOffset, bump: setTerrainBlobBump,
        sweepFreq: setTerrainBlobSweepFreq, lobeFreq: setTerrainBlobLobeFreq,
        lobeAmp: setTerrainBlobLobeAmp, lobeThreshold: setTerrainBlobLobeThreshold,
        lobeDirection: setTerrainBlobLobeDirection,
      }
      setters[field]?.(val)
    } else if (terrain && overrideEnabled) {
      setTerrainTypeBlobStyle(terrain, { [field]: val })
    }
  }

  const handleEnableToggle = (checked: boolean) => {
    if (!terrain) return
    if (checked) {
      setTerrainTypeBlobStyle(terrain, {
        enabled: true,
        smooth: terrainBlobSmooth,
        offset: terrainBlobOffset,
        bump: terrainBlobBump,
        sweepFreq: terrainBlobSweepFreq,
        lobeFreq: terrainBlobLobeFreq,
        lobeAmp: terrainBlobLobeAmp,
        lobeThreshold: terrainBlobLobeThreshold,
        lobeDirection: terrainBlobLobeDirection,
      })
    } else {
      setTerrainTypeBlobStyle(terrain, { enabled: false })
    }
  }

  const setBlob = (field: string, val: number) => {
    setLocal(prev => ({ ...prev, [field]: val }))
    draggingRef.current = true
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      draggingRef.current = false
      commitBlob(field, val)
    }, 150)
  }

  const controlsDisabled = !isDefaults && !overrideEnabled

  const blobControls = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: controlsDisabled ? 0.4 : 1, pointerEvents: controlsDisabled ? 'none' : 'auto' }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span>Corner Rounding</span>
          <span style={{ color: '#5a5a7a', fontSize: 10 }}>{local.smooth}</span>
        </div>
        <input type="range" min={0} max={5} step={1} value={local.smooth}
          onChange={e => setBlob('smooth', Number(e.target.value))}
          style={{ width: '100%', accentColor: color }} />
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span>Waviness</span>
          <span style={{ color: '#5a5a7a', fontSize: 10 }}>{Math.round(local.bump * 100)}%</span>
        </div>
        <input type="range" min={0} max={60} step={1} value={Math.round(local.bump * 100)}
          onChange={e => setBlob('bump', Number(e.target.value) / 100)}
          style={{ width: '100%', accentColor: color }} />
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span>Inset</span>
          <span style={{ color: '#5a5a7a', fontSize: 10 }}>{local.offset > 0 ? '+' : ''}{Math.round(local.offset * 100)}%</span>
        </div>
        <input type="range" min={-80} max={30} step={1} value={Math.round(local.offset * 100)}
          onChange={e => setBlob('offset', Number(e.target.value) / 100)}
          style={{ width: '100%', accentColor: color }} />
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span>Wave Scale</span>
          <span style={{ color: '#5a5a7a', fontSize: 10 }}>{local.sweepFreq.toFixed(2)}</span>
        </div>
        <input type="range" min={40} max={100} step={1} value={Math.round(local.sweepFreq * 100)}
          onChange={e => setBlob('sweepFreq', Number(e.target.value) / 100)}
          style={{ width: '100%', accentColor: color }} />
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span>Fringe Scale</span>
          <span style={{ color: '#5a5a7a', fontSize: 10 }}>{local.lobeFreq.toFixed(1)}</span>
        </div>
        <input type="range" min={20} max={50} step={1} value={Math.round(local.lobeFreq * 10)}
          onChange={e => setBlob('lobeFreq', Number(e.target.value) / 10)}
          style={{ width: '100%', accentColor: color }} />
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span>Fringe Strength</span>
          <span style={{ color: '#5a5a7a', fontSize: 10 }}>{Math.round(local.lobeAmp * 100)}%</span>
        </div>
        <input type="range" min={0} max={100} step={1} value={Math.round(local.lobeAmp * 100)}
          onChange={e => setBlob('lobeAmp', Number(e.target.value) / 100)}
          style={{ width: '100%', accentColor: color }} />
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span>Fringe Sparsity</span>
          <span style={{ color: '#5a5a7a', fontSize: 10 }}>{Math.round(local.lobeThreshold * 100)}%</span>
        </div>
        <input type="range" min={0} max={40} step={1} value={Math.round(local.lobeThreshold * 100)}
          onChange={e => setBlob('lobeThreshold', Number(e.target.value) / 100)}
          style={{ width: '100%', accentColor: color }} />
      </div>
      <div>
        <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a', marginBottom: 5 }}>Fringe Direction</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button style={modeBtn(local.lobeDirection >= 0)} onClick={() => setBlob('lobeDirection', 1)}>Outward</button>
          <button style={modeBtn(local.lobeDirection < 0)} onClick={() => setBlob('lobeDirection', -1)}>Inward</button>
        </div>
      </div>
    </div>
  )

  return (
    <div
      data-terrain-flyout=""
      style={{
        position: 'fixed',
        left: 204,
        top: Math.min(anchorY, window.innerHeight - 48),
        width: 200,
        maxHeight: 'calc(100vh - 16px)',
        overflowY: 'auto',
        background: '#0e0f18',
        border: '1px solid #2a2a4a',
        borderRadius: 4,
        padding: '10px 12px',
        zIndex: 100,
        fontFamily: 'ui-monospace, monospace',
        fontSize: 11,
        color: '#a0a0c0',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ color: '#e0e0f0', textTransform: 'capitalize', letterSpacing: 0.5 }}>
          {isDefaults ? 'Default blob shape' : terrain!.replace(/_/g, ' ')}
        </span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#4a4a6a', cursor: 'pointer', padding: '0 2px', fontSize: 15, lineHeight: 1 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#a0a0c0')}
          onMouseLeave={e => (e.currentTarget.style.color = '#4a4a6a')}
        >×</button>
      </div>

      {isDefaults && showBlobSection && blobControls}

      {!isDefaults && (
        <>
          <div style={{ marginBottom: hasTexture ? 12 : 0 }}>
            <span style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a', display: 'block', marginBottom: 5 }}>Color</span>
            <ColorSwatch value={color} onChange={v => setTerrainColor(terrain!, v)} palette={PALETTE_TERRAIN} />
          </div>

          {hasTexture && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a' }}>Texture Scale</span>
                <span style={{ color: '#5a5a7a', fontSize: 10 }}>{textureScale.toFixed(1)}×</span>
              </div>
              <input
                type="range" min={5} max={80} step={1}
                value={Math.round(textureScale * 10)}
                onChange={e => setTerrainTextureScale(terrain!, Number(e.target.value) / 10)}
                style={{ width: '100%', accentColor: color }}
              />
            </div>
          )}

          {hasWildness && (
            <div style={{ marginTop: hasTexture ? 12 : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a' }}>Edge Wildness</span>
                <span style={{ color: '#5a5a7a', fontSize: 10 }}>{wildness.toFixed(1)}×</span>
              </div>
              <input
                type="range" min={0} max={30} step={1}
                value={Math.round(wildness * 10)}
                onChange={e => setFieldWildness(terrain!, Number(e.target.value) / 10)}
                style={{ width: '100%', accentColor: color }}
              />
            </div>
          )}

          {showBlobSection && (
            <div style={{ marginTop: 12, borderTop: '1px solid #1e1f2e', paddingTop: 10 }}>
              <button
                data-terrain-flyout=""
                onClick={() => setBlobOpen(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', background: 'none', border: 'none', color: '#a0a0c0',
                  cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontSize: 11,
                  marginBottom: blobOpen ? 8 : 0,
                }}
              >
                <label
                  style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}
                  onClick={e => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={overrideEnabled}
                    onChange={e => handleEnableToggle(e.target.checked)}
                    style={{ accentColor: color, margin: 0 }}
                  />
                  <span style={{ color: overrideEnabled ? '#c0c0e0' : '#6a6a8a', fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    Blob shape
                  </span>
                </label>
                <span style={{ color: '#4a4a6a', fontSize: 10 }}>{blobOpen ? '▲' : '▼'}</span>
              </button>

              {blobOpen && blobControls}
            </div>
          )}
        </>
      )}
    </div>
  )
}
