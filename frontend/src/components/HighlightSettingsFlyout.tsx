import { useEffect } from 'react'
import { useMapStore, type HexHighlight } from '../store/mapStore'
import { ColorSwatch } from './ColorSwatch'
import { PALETTE_HIGHLIGHTS } from '../palettes'
import { useFlyoutTop } from './useFlyoutTop'

interface Props {
  highlight: HexHighlight
  anchorY: number
  onClose: () => void
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 1,
  color: '#4a4a6a',
  textTransform: 'uppercase',
  marginBottom: 4,
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 8,
}

const segBtnStyle = (active: boolean): React.CSSProperties => ({
  flex: 1,
  padding: '3px 0',
  background: active ? '#1e3a28' : '#1a1b2e',
  border: `1px solid ${active ? '#5a9e6f' : '#2a2b3e'}`,
  borderRadius: 3,
  color: active ? '#5a9e6f' : '#6a6a8a',
  fontFamily: 'ui-monospace, monospace',
  fontSize: 11,
  cursor: 'pointer',
})

export function HighlightSettingsFlyout({ highlight, anchorY, onClose }: Props) {
  const { updateHighlight, clearAllHexHighlights, clearHighlightLine, clearHighlightEdgePath } = useMapStore()
  const { ref: flyoutRef, top } = useFlyoutTop(anchorY)

  const isArea = highlight.mode === 'area'
  const currentPattern = highlight.linePattern ?? 'none'
  const hasPattern = currentPattern !== 'none'
  const patternHasSide = hasPattern && ['ticks', 'fortification', 'trench'].includes(currentPattern)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (flyoutRef.current && !flyoutRef.current.contains(target)) {
        const sidebar = (target as Element).closest?.('[data-highlights-sidebar]')
        if (!sidebar) onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const upd = (changes: Partial<Omit<HexHighlight, 'id'>>) =>
    updateHighlight(highlight.id, changes)

  return (
    <div
      ref={flyoutRef}
      data-highlight-flyout
      style={{
        position: 'fixed',
        left: 204,
        top,
        width: 260,
        boxSizing: 'border-box',
        background: '#12131f',
        border: '1px solid #2a2b3e',
        borderRadius: 4,
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        zIndex: 100,
        padding: 12,
        fontFamily: 'ui-monospace, monospace',
        fontSize: 12,
        color: '#a0a0c0',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ color: '#d0d0e8', fontWeight: 600 }}>Overlay settings</span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#6a6a8a', cursor: 'pointer', fontSize: 14, padding: 0 }}
        >×</button>
      </div>

      {/* Name */}
      <div style={{ marginBottom: 10 }}>
        <div style={labelStyle}>Name</div>
        <input
          type="text"
          value={highlight.name}
          onChange={e => upd({ name: e.target.value })}
          style={{
            width: '100%',
            background: '#1a1b2e',
            border: '1px solid #2a2b3e',
            borderRadius: 3,
            color: '#d0d0e8',
            fontFamily: 'inherit',
            fontSize: 12,
            padding: '4px 6px',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Color */}
      <div style={{ marginBottom: 10 }}>
        <div style={labelStyle}>Color</div>
        <ColorSwatch value={highlight.color} onChange={v => upd({ color: v })} palette={PALETTE_HIGHLIGHTS} />
      </div>

      {/* Fill — area only */}
      {isArea && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={highlight.fillEnabled}
                onChange={e => upd({ fillEnabled: e.target.checked })}
                style={{ accentColor: '#5a9e6f' }}
              />
              <span style={labelStyle}>Fill</span>
            </label>
          </div>
          {highlight.fillEnabled && (
            <div style={{ paddingLeft: 18 }}>
              <div style={{ ...rowStyle, marginBottom: 0 }}>
                <span style={{ minWidth: 60, color: '#6a6a8a' }}>Opacity</span>
                <input
                  type="range" min={20} max={100} step={20}
                  value={Math.round(highlight.fillOpacity * 100 / 20) * 20}
                  onChange={e => upd({ fillOpacity: Number(e.target.value) / 100 })}
                  style={{ flex: 1, minWidth: 0, accentColor: '#5a9e6f' }}
                />
                <span style={{ minWidth: 28, textAlign: 'right' }}>{Math.round(highlight.fillOpacity * 100 / 20) * 20}%</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stroke */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          {isArea ? (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={highlight.strokeEnabled}
                onChange={e => upd({ strokeEnabled: e.target.checked })}
                style={{ accentColor: '#5a9e6f' }}
              />
              <span style={labelStyle}>Stroke</span>
            </label>
          ) : (
            <span style={labelStyle}>Stroke</span>
          )}
        </div>
        {(!isArea || highlight.strokeEnabled) && (
          <div style={{ paddingLeft: isArea ? 18 : 0 }}>
            <div style={{ ...rowStyle, marginBottom: 4 }}>
              <span style={{ minWidth: 60, color: '#6a6a8a' }}>Opacity</span>
              <input
                type="range" min={20} max={100} step={20}
                value={Math.round(highlight.strokeOpacity * 100 / 20) * 20}
                onChange={e => upd({ strokeOpacity: Number(e.target.value) / 100 })}
                style={{ flex: 1, minWidth: 0, accentColor: '#5a9e6f' }}
              />
              <span style={{ minWidth: 28, textAlign: 'right' }}>{Math.round(highlight.strokeOpacity * 100 / 20) * 20}%</span>
            </div>
            <div style={{ ...rowStyle, marginBottom: 0 }}>
              <span style={{ minWidth: 60, color: '#6a6a8a' }}>Width</span>
              <input
                type="range" min={1} max={20} step={0.5}
                value={highlight.strokeWidth}
                onChange={e => upd({ strokeWidth: Number(e.target.value) })}
                style={{ flex: 1, minWidth: 0, accentColor: '#5a9e6f' }}
              />
              <span style={{ minWidth: 28, textAlign: 'right' }}>{highlight.strokeWidth}</span>
            </div>
          </div>
        )}
      </div>

      {/* Join neighbors — area only */}
      {isArea && (
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={highlight.joinNeighbors}
              onChange={e => upd({ joinNeighbors: e.target.checked })}
              style={{ accentColor: '#5a9e6f' }}
            />
            <div>
              <div style={labelStyle}>Join neighbors</div>
              <div style={{ fontSize: 10, color: '#4a4a6a', marginTop: 2 }}>
                Only outline the outer border of the group
              </div>
            </div>
          </label>
        </div>
      )}

      {/* Smoothing — line/edge always; area only when joinNeighbors */}
      {(!isArea || highlight.joinNeighbors) && (
        <div style={{ marginBottom: 10 }}>
          {(() => {
            const s = highlight.smoothing ?? 0
            const passes = Math.round(s - 1)
            const label = s < 0.5 ? 'Sharp' : s < 1.5 ? 'Round' : `${passes} pass${passes !== 1 ? 'es' : ''}`
            return <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <div style={labelStyle}>Smoothing</div>
                <span style={{ fontSize: 10, color: '#6a6a8a' }}>{label}</span>
              </div>
              <input
                type="range"
                min={0} max={8} step={0.1}
                value={s}
                onChange={e => {
                  let v = Number(e.target.value)
                  if (v < 0.4) v = 0
                  else if (v < 1.4) v = 1
                  upd({ smoothing: v })
                }}
                style={{ width: '100%', minWidth: 0, accentColor: '#5a9e6f' }}
                list="smoothing-snaps"
              />
              <datalist id="smoothing-snaps">
                <option value="0" />
                <option value="1" />
              </datalist>
              <div style={{ fontSize: 10, color: '#4a4a6a', marginTop: 2 }}>0 = sharp · 1 = round · drag right for passes</div>
            </>
          })()}
        </div>
      )}

      {/* Pattern */}
      <div style={{ marginBottom: 10 }}>
        <div style={labelStyle}>Pattern</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {([
            ['none',         'None'],
            ['ticks',        'Ticks'],
            ['fortification','Fortif.'],
            ['trench',       'Trench'],
            ['barbed_wire',  'Barbed'],
            ['dotted',       'Dotted'],
            ['dashed',       'Dashed'],
            ['arrows',       'Arrows'],
          ] as const).map(([p, label]) => (
            <button
              key={p}
              onClick={() => upd({ linePattern: p })}
              style={{ ...segBtnStyle(currentPattern === p), flex: 'none' }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Pattern spacing — only when a pattern is active */}
      {hasPattern && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <div style={labelStyle}>Spacing</div>
            <span style={{ fontSize: 10, color: '#6a6a8a' }}>×{(highlight.patternSpacing ?? 1).toFixed(2)}</span>
          </div>
          <input
            type="range" min={0.2} max={4} step={0.05}
            value={highlight.patternSpacing ?? 1}
            onChange={e => upd({ patternSpacing: Number(e.target.value) })}
            style={{ width: '100%', minWidth: 0, accentColor: '#5a9e6f' }}
          />
        </div>
      )}

      {/* Pattern side — only for patterns where it matters */}
      {patternHasSide && (
        <div style={{ marginBottom: 10 }}>
          <div style={labelStyle}>Side</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['left', 'right', 'center'] as const).map(side => (
              <button
                key={side}
                onClick={() => upd({ linePatternSide: side })}
                style={segBtnStyle((highlight.linePatternSide ?? 'right') === side)}
              >
                {side.charAt(0).toUpperCase() + side.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Clear */}
      <button
        onClick={() => {
          if (isArea) clearAllHexHighlights(highlight.id)
          else if (highlight.mode === 'edge') clearHighlightEdgePath(highlight.id)
          else clearHighlightLine(highlight.id)
        }}
        style={{
          width: '100%',
          padding: '5px 0',
          background: '#1a1b2e',
          border: '1px solid #2a2b3e',
          borderRadius: 3,
          color: '#9a6a6a',
          fontFamily: 'inherit',
          fontSize: 11,
          cursor: 'pointer',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#e08080')}
        onMouseLeave={e => (e.currentTarget.style.color = '#9a6a6a')}
      >
        {isArea ? 'Clear all marked hexes' : 'Clear path'}
      </button>
    </div>
  )
}
