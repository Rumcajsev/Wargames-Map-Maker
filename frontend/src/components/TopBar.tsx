import { useMapStore } from '../store/mapStore'

const TABS = [
  { id: 'terrain',     label: 'Terrain'   },
  { id: 'elevation',   label: 'Elevation' },
  { id: 'settlements', label: 'Places'    },
  { id: 'roads',       label: 'Roads'     },
  { id: 'rails',       label: 'Rails'     },
  { id: 'rivers',      label: 'Rivers'    },
  { id: 'style',       label: 'Style'     },
] as const

export function TopBar() {
  const { activePanel, setActivePanel, resetToSetup, elevationStatus, settlements, roadEdges, railEdges, riverFeatures, terrainDisplacement } = useMapStore()

  const tabDot: Record<string, string | null> = {
    terrain: null,
    elevation: elevationStatus === 'done' ? '#6ab0e0' : null,
    settlements: settlements.length > 0 ? '#d0b060' : null,
    roads: roadEdges.length > 0 ? '#e08040' : null,
    rails: railEdges.length > 0 ? '#888888' : null,
    rivers: riverFeatures.some(r => r.included) ? '#4a88c0' : null,
    style: terrainDisplacement > 0 ? '#c09060' : null,
  }

  return (
    <div style={{
      height: 44,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      gap: 0,
      background: '#0e0f18',
      borderBottom: '1px solid #1e1f2e',
      fontFamily: 'ui-monospace, monospace',
      fontSize: 12,
      userSelect: 'none',
    }}>
      {/* Brand */}
      <div style={{
        padding: '0 16px',
        color: '#ffffff',
        fontWeight: 700,
        fontSize: 13,
        letterSpacing: 1,
        borderRight: '1px solid #1e1f2e',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        IG2
      </div>

      {/* Back */}
      <button
        onClick={resetToSetup}
        style={{
          height: '100%',
          padding: '0 14px',
          background: 'none',
          color: '#6a6a8a',
          border: 'none',
          borderRight: '1px solid #1e1f2e',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexShrink: 0,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#a0a0c0')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#6a6a8a')}
      >
        ← Setup
      </button>

      {/* Divider */}
      <div style={{ width: 12 }} />

      {/* Panel tabs */}
      {TABS.map(({ id, label }) => {
        const active = activePanel === id
        return (
          <button
            key={id}
            onClick={() => setActivePanel(id)}
            style={{
              height: '100%',
              padding: '0 16px',
              background: active ? '#1a2a3a' : 'none',
              color: active ? '#7de0a0' : '#5a5a7a',
              border: 'none',
              borderBottom: active ? '2px solid #4a9a6a' : '2px solid transparent',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: active ? 700 : 400,
              letterSpacing: 0.4,
              transition: 'color 0.1s',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = '#9a9ab8' }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = '#5a5a7a' }}
          >
            {label}
            {tabDot[id] && (
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: tabDot[id]!,
                flexShrink: 0,
                opacity: active ? 0.7 : 1,
              }} />
            )}
          </button>
        )
      })}
    </div>
  )
}
