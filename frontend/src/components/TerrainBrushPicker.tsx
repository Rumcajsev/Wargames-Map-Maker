import { useState } from 'react'
import { useMapStore, TERRAIN_COLORS, TERRAIN_PRIORITY } from '../store/mapStore'

const terrainLabel = (t: string) => t.replace(/_/g, ' ')

const CogIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.92c.04-.34.07-.68.07-1.08s-.03-.74-.07-1.08l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.34-.07.69-.07 1.08s.03.74.07 1.08L2.7 13.07c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.58 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65z" />
  </svg>
)

interface Props {
  activeBrush: string | null
  paintMode: boolean
  onSelect: (terrain: string) => void
  onSettings?: (terrain: string, y: number) => void
}

export function TerrainBrushPicker({ activeBrush, paintMode, onSelect, onSettings }: Props) {
  const { terrainColors } = useMapStore()
  const [hoveredTerrain, setHoveredTerrain] = useState<string | null>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {TERRAIN_PRIORITY.map((terrain, idx) => {
        const active = paintMode && activeBrush === terrain
        const hovered = hoveredTerrain === terrain
        const color = terrainColors[terrain] ?? TERRAIN_COLORS[terrain] ?? '#888'
        return (
          <div
            key={terrain}
            style={{ position: 'relative' }}
            onMouseEnter={() => setHoveredTerrain(terrain)}
            onMouseLeave={() => setHoveredTerrain(null)}
          >
            <button
              onClick={() => onSelect(terrain)}
              title={`${terrainLabel(terrain)} (${idx + 1})`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '5px 8px',
                background: active ? '#1a2a1a' : 'none',
                border: `1px solid ${active ? '#4a7a5a' : '#1e1f2e'}`,
                borderRadius: 3,
                cursor: 'pointer',
                fontFamily: 'ui-monospace, monospace',
                fontSize: 11,
                color: active ? '#d0ecd8' : '#6a6a8a',
                textAlign: 'left',
                width: '100%',
              }}
            >
              <span style={{
                width: 9, height: 9, borderRadius: 2, flexShrink: 0,
                background: color,
                border: terrain === 'clear' ? '1px solid #3a3a5a' : 'none',
              }} />
              <span style={{ flex: 1, textTransform: 'capitalize' }}>
                {terrainLabel(terrain)}
              </span>
              <span style={{ color: '#3a3a5a', fontSize: 9 }}>{idx + 1}</span>
            </button>
            {hovered && onSettings && (
              <button
                data-terrain-flyout=""
                onClick={e => {
                  e.stopPropagation()
                  onSettings(terrain, e.currentTarget.getBoundingClientRect().top)
                }}
                title="Terrain settings"
                style={{
                  position: 'absolute',
                  right: 4,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#5a5a8a',
                  cursor: 'pointer',
                  padding: '2px 3px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: 2,
                  lineHeight: 1,
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#c0c0e0')}
                onMouseLeave={e => (e.currentTarget.style.color = '#5a5a8a')}
              >
                <CogIcon />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
