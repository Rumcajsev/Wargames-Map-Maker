import { useEffect } from 'react'
import { useMapStore, DEFAULT_ROAD_TIER_STYLES, DEFAULT_RAIL_STYLE } from '../store/mapStore'
import { ColorSwatch } from './ColorSwatch'
import { PALETTE_ROAD_SURFACE, PALETTE_ROAD_CASING, PALETTE_RAIL_LIGHT, PALETTE_RAIL_DARK } from '../palettes'

const TIER_LABELS = ['Motorway', 'Primary', 'Secondary'] as const

type Props =
  | { type: 'road'; tier: 0 | 1 | 2; anchorY: number; onClose: () => void }
  | { type: 'rail'; anchorY: number; onClose: () => void }

export function RoadsSettingsFlyout(props: Props) {
  const { type, anchorY, onClose } = props

  const { roadTierStyles, setRoadTierStyle, railStyle, setRailStyle } = useMapStore()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-roads-flyout]')) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const flyoutHeight = type === 'rail' ? 320 : 280
  const top = Math.min(anchorY, window.innerHeight - flyoutHeight - 8)

  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
      <span style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a' }}>{label}</span>
      {value}
    </div>
  )

  const colorRow = (label: string, color: string, palette: readonly string[], onChange: (v: string) => void) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a', marginBottom: 5 }}>{label}</div>
      <ColorSwatch value={color} onChange={onChange} palette={palette} />
    </div>
  )

  return (
    <div
      data-roads-flyout=""
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
        <span style={{ color: '#e0e0f0', letterSpacing: 0.5 }}>
          {type === 'road' ? TIER_LABELS[(props as { tier: 0 | 1 | 2 }).tier] : 'Rail'}
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={() => {
              if (type === 'road') setRoadTierStyle((props as { tier: 0 | 1 | 2 }).tier, { ...DEFAULT_ROAD_TIER_STYLES[(props as { tier: 0 | 1 | 2 }).tier] })
              else setRailStyle({ ...DEFAULT_RAIL_STYLE })
            }}
            title="Reset to default"
            style={{ background: 'none', border: 'none', color: '#4a4a6a', cursor: 'pointer', padding: '0 2px', fontSize: 12, lineHeight: 1 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#a0a0c0')}
            onMouseLeave={e => (e.currentTarget.style.color = '#4a4a6a')}
          >↺</button>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#4a4a6a', cursor: 'pointer', padding: '0 2px', fontSize: 15, lineHeight: 1 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#a0a0c0')}
            onMouseLeave={e => (e.currentTarget.style.color = '#4a4a6a')}
          >×</button>
        </div>
      </div>

      {type === 'road' && (() => {
        const tier = (props as { tier: 0 | 1 | 2 }).tier
        const s = roadTierStyles[tier]
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div>
              {row('Thickness', <span style={{ color: '#5a5a7a', fontSize: 10 }}>{s.outerW.toFixed(1)}</span>)}
              <input
                type="range" min={0.5} max={10} step={0.5}
                value={s.outerW}
                onChange={e => setRoadTierStyle(tier, { outerW: parseFloat(e.target.value) })}
                style={{ width: '100%', marginBottom: 8 }}
              />
            </div>
            {colorRow('Surface', s.inner, PALETTE_ROAD_SURFACE, v => setRoadTierStyle(tier, { inner: v }))}
            {colorRow('Casing', s.outer, PALETTE_ROAD_CASING, v => setRoadTierStyle(tier, { outer: v }))}
          </div>
        )
      })()}

      {type === 'rail' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a', marginBottom: 4 }}>Style</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['classic', 'cross'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setRailStyle({ railStyle: s })}
                  style={{
                    flex: 1, padding: '3px 0', fontSize: 10,
                    background: railStyle.railStyle === s ? '#1e2a3a' : 'none',
                    border: `1px solid ${railStyle.railStyle === s ? '#4a7aaa' : '#2a2a4a'}`,
                    color: railStyle.railStyle === s ? '#a0c0e0' : '#5a5a7a',
                    borderRadius: 3, cursor: 'pointer',
                    fontFamily: 'ui-monospace, monospace',
                  }}
                >{s}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            {row('Thickness', <span style={{ color: '#5a5a7a', fontSize: 10 }}>{railStyle.thickness.toFixed(1)}</span>)}
            <input
              type="range" min={0.5} max={8} step={0.5}
              value={railStyle.thickness}
              onChange={e => setRailStyle({ thickness: parseFloat(e.target.value) })}
              style={{ width: '100%' }}
            />
          </div>

          {railStyle.railStyle === 'classic' && colorRow('Inner', railStyle.innerColor, PALETTE_RAIL_LIGHT, v => setRailStyle({ innerColor: v }))}
          {colorRow(railStyle.railStyle === 'classic' ? 'Outer' : 'Line', railStyle.outerColor, PALETTE_RAIL_DARK, v => setRailStyle({ outerColor: v }))}
        </div>
      )}
    </div>
  )
}
