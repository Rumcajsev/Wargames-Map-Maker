import { useEffect } from 'react'
import { useMapStore, TERRAIN_COLORS } from '../store/mapStore'
import { ColorSwatch } from './ColorSwatch'
import { PALETTE_TERRAIN } from '../palettes'


const TEXTURED_TERRAINS = new Set(['clear', 'woods', 'light_woods'])

interface Props {
  terrain: string
  anchorY: number
  onClose: () => void
}

export function TerrainSettingsFlyout({ terrain, anchorY, onClose }: Props) {
  const {
    terrainColors, setTerrainColor, terrainTextureScales, setTerrainTextureScale,
    terrainRenderMode, fieldWildness, setFieldWildness,
  } = useMapStore()

  const color = terrainColors[terrain] ?? TERRAIN_COLORS[terrain] ?? '#888888'
  const hasTexture = TEXTURED_TERRAINS.has(terrain)
  const textureScale = terrainTextureScales[terrain] ?? 3
  const wildness = fieldWildness[terrain] ?? 1.0

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-terrain-flyout]')) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const hasWildness = terrainRenderMode === 'field'
  const flyoutHeight = (hasTexture ? 170 : 110) + (hasWildness ? 50 : 0)
  const top = Math.min(anchorY, window.innerHeight - flyoutHeight - 8)

  return (
    <div
      data-terrain-flyout=""
      style={{
        position: 'fixed',
        left: 204,
        top,
        width: 200,
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
          {terrain.replace(/_/g, ' ')}
        </span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#4a4a6a', cursor: 'pointer', padding: '0 2px', fontSize: 15, lineHeight: 1 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#a0a0c0')}
          onMouseLeave={e => (e.currentTarget.style.color = '#4a4a6a')}
        >
          ×
        </button>
      </div>

      <div style={{ marginBottom: hasTexture ? 12 : 0 }}>
        <span style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a', display: 'block', marginBottom: 5 }}>Color</span>
        <ColorSwatch value={color} onChange={v => setTerrainColor(terrain, v)} palette={PALETTE_TERRAIN} />
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
            onChange={e => setTerrainTextureScale(terrain, Number(e.target.value) / 10)}
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
            onChange={e => setFieldWildness(terrain, Number(e.target.value) / 10)}
            style={{ width: '100%', accentColor: color }}
          />
        </div>
      )}
    </div>
  )
}
