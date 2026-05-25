import { useMapStore } from '../../store/mapStore'
import { TK } from '../../theme'

const TABS = [
  { id: 'terrain',     label: 'Terrain'     },
  { id: 'rivers',      label: 'Rivers'      },
  { id: 'roads',       label: 'Roads'       },
  { id: 'settlements', label: 'Settlements' },
  { id: 'highlights',  label: 'Overlays'    },
  { id: 'areas',       label: 'Areas'       },
  { id: 'elevation',   label: 'Elevation'   },
  { id: 'display',     label: 'Display'     },
] as const

export function EditorTabBar() {
  const { activePanel, setActivePanel } = useMapStore()

  return (
    <div style={{
      height: TK.tabBarHeight,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'stretch',
      background: TK.surface,
      borderBottom: `1px solid ${TK.line}`,
      userSelect: 'none',
    }}>
      {TABS.map(tab => {
        const active = activePanel === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => setActivePanel(tab.id as typeof activePanel)}
            style={{
              height: '100%',
              padding: '0 18px',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${active ? TK.ink : 'transparent'}`,
              cursor: 'pointer',
              fontFamily: TK.sans,
              fontSize: 12,
              fontWeight: active ? 600 : 500,
              color: active ? TK.ink : TK.inkMute,
              letterSpacing: 0.1,
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
