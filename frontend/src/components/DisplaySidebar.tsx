import { useMapStore, TERRAIN_COLORS } from '../store/mapStore'
import { sidebarStyle, sectionStyle, labelStyle } from './sidebarStyles'

const terrainLabel = (t: string) => t.replace(/_/g, ' ')

export function DisplaySidebar() {
  const { hexBorderMode, setHexBorderMode } = useMapStore()

  return (
    <div style={sidebarStyle}>

      {/* ── Hex borders ── */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Hex Borders</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['full', 'dots', 'none'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setHexBorderMode(mode)}
              style={{
                flex: 1, padding: '4px 0',
                background: hexBorderMode === mode ? '#1a2a3a' : 'none',
                color: hexBorderMode === mode ? '#7de0a0' : '#5a5a7a',
                border: '1px solid',
                borderColor: hexBorderMode === mode ? '#4a9a6a' : '#1e1f2e',
                borderRadius: 3, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 11, textTransform: 'capitalize',
              }}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* ── Terrain legend ── */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Terrain</div>
        {Object.entries(TERRAIN_COLORS).map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{
              display: 'inline-block', width: 10, height: 10, borderRadius: 2,
              background: color, flexShrink: 0,
            }} />
            <span style={{ textTransform: 'capitalize' }}>{terrainLabel(type)}</span>
          </div>
        ))}
      </div>

    </div>
  )
}
