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

const vizBtnStyle = (active: boolean): React.CSSProperties => ({
  width: 34,
  height: 28,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: active ? '#1e3a28' : '#1a1b2e',
  border: `1px solid ${active ? '#5a9e6f' : '#2a2b3e'}`,
  borderRadius: 3,
  cursor: 'pointer',
  padding: 0,
  flexShrink: 0,
})

const SliderRow = ({ label, value, children }: { label: string; value: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
      <span style={labelStyle}>{label}</span>
      <span style={{ fontSize: 10, color: '#6a6a8a' }}>{value}</span>
    </div>
    {children}
  </div>
)

const PillToggle = ({ enabled, label, onToggle }: { enabled: boolean; label: string; onToggle: () => void }) => (
  <button
    onClick={onToggle}
    style={{
      padding: '2px 8px',
      background: enabled ? '#1e3a28' : '#1a1b2e',
      border: `1px solid ${enabled ? '#5a9e6f' : '#2a2b3e'}`,
      borderRadius: 10,
      color: enabled ? '#5a9e6f' : '#4a4a6a',
      fontFamily: 'ui-monospace, monospace',
      fontSize: 10,
      letterSpacing: 1,
      cursor: 'pointer',
      marginBottom: 6,
    }}
  >
    {enabled ? '● ' : '○ '}{label}
  </button>
)

const PREVIEW_STROKE = '#a0a0c0'
const PREVIEW_TICK = '#7a7a9a'

function PatternPreview({ pattern }: { pattern: string }) {
  const sw = 1.5
  const lineProps = { stroke: PREVIEW_STROKE, strokeWidth: sw, strokeLinecap: 'round' as const }
  const tickSW = 1.2

  if (pattern === 'none') {
    return (
      <svg width="28" height="18" viewBox="0 0 28 18">
        <line x1="2" y1="9" x2="26" y2="9" {...lineProps} />
      </svg>
    )
  }
  if (pattern === 'dotted') {
    return (
      <svg width="28" height="18" viewBox="0 0 28 18">
        <line x1="2" y1="9" x2="26" y2="9" {...lineProps} strokeDasharray="1.5 3" />
      </svg>
    )
  }
  if (pattern === 'dashed') {
    return (
      <svg width="28" height="18" viewBox="0 0 28 18">
        <line x1="2" y1="9" x2="26" y2="9" {...lineProps} strokeLinecap="butt" strokeDasharray="5 2.5" />
      </svg>
    )
  }
  if (pattern === 'ticks') {
    return (
      <svg width="28" height="18" viewBox="0 0 28 18">
        <line x1="2" y1="9" x2="26" y2="9" {...lineProps} />
        {[8, 14, 20].map(x => (
          <line key={x} x1={x} y1="5" x2={x} y2="13" stroke={PREVIEW_TICK} strokeWidth={tickSW} strokeLinecap="round" />
        ))}
      </svg>
    )
  }
  if (pattern === 'fortification') {
    return (
      <svg width="28" height="18" viewBox="0 0 28 18">
        <line x1="2" y1="9" x2="26" y2="9" {...lineProps} />
        {[8, 14, 20].map(x => (
          <line key={x} x1={x} y1="9" x2={x} y2="14" stroke={PREVIEW_TICK} strokeWidth={tickSW} strokeLinecap="round" />
        ))}
      </svg>
    )
  }
  if (pattern === 'trench') {
    return (
      <svg width="28" height="18" viewBox="0 0 28 18">
        <line x1="2" y1="9" x2="26" y2="9" {...lineProps} />
        <path d="M 5,9 A 3,3 0 0,1 11,9" fill="none" stroke={PREVIEW_TICK} strokeWidth={tickSW} strokeLinecap="round" />
        <path d="M 16,9 A 3,3 0 0,1 22,9" fill="none" stroke={PREVIEW_TICK} strokeWidth={tickSW} strokeLinecap="round" />
      </svg>
    )
  }
  if (pattern === 'barbed_wire') {
    return (
      <svg width="28" height="18" viewBox="0 0 28 18">
        <line x1="2" y1="9" x2="26" y2="9" {...lineProps} />
        {[9, 19].map(x => (
          <g key={x}>
            <line x1={x - 2} y1="6.5" x2={x + 2} y2="11.5" stroke={PREVIEW_TICK} strokeWidth={tickSW} strokeLinecap="round" />
            <line x1={x + 2} y1="6.5" x2={x - 2} y2="11.5" stroke={PREVIEW_TICK} strokeWidth={tickSW} strokeLinecap="round" />
          </g>
        ))}
      </svg>
    )
  }
  if (pattern === 'arrows') {
    return (
      <svg width="28" height="18" viewBox="0 0 28 18">
        <line x1="2" y1="9" x2="26" y2="9" {...lineProps} />
        <polyline points="8,6 13,9 8,12" fill="none" stroke={PREVIEW_TICK} strokeWidth={tickSW} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return null
}

function SidePreview({ side }: { side: 'left' | 'right' | 'center' }) {
  return (
    <svg width="24" height="18" viewBox="0 0 24 18">
      <line x1="2" y1="9" x2="22" y2="9" stroke={PREVIEW_STROKE} strokeWidth={1.5} strokeLinecap="round" />
      {side === 'left' && <line x1="8" y1="9" x2="6" y2="14" stroke={PREVIEW_TICK} strokeWidth={1.2} strokeLinecap="round" />}
      {side === 'right' && <line x1="16" y1="9" x2="18" y2="14" stroke={PREVIEW_TICK} strokeWidth={1.2} strokeLinecap="round" />}
      {side === 'center' && <line x1="12" y1="9" x2="12" y2="14" stroke={PREVIEW_TICK} strokeWidth={1.2} strokeLinecap="round" />}
    </svg>
  )
}

const PATTERNS: Array<[string, string]> = [
  ['none', 'None'],
  ['ticks', 'Ticks'],
  ['fortification', 'Fortif.'],
  ['trench', 'Trench'],
  ['barbed_wire', 'Barbed'],
  ['dotted', 'Dotted'],
  ['dashed', 'Dashed'],
  ['arrows', 'Arrows'],
]

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

      <div style={{ marginBottom: 10 }}>
        <div style={{ ...labelStyle, marginBottom: 4 }}>Name</div>
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

      <div style={{ marginBottom: 10 }}>
        <div style={{ ...labelStyle, marginBottom: 4 }}>Color</div>
        <ColorSwatch value={highlight.color} onChange={v => upd({ color: v })} palette={PALETTE_HIGHLIGHTS} />
      </div>

      {isArea && (
        <div style={{ marginBottom: 10 }}>
          <PillToggle
            enabled={highlight.fillEnabled}
            label="FILL"
            onToggle={() => upd({ fillEnabled: !highlight.fillEnabled })}
          />
          {highlight.fillEnabled && (
            <SliderRow label="Opacity" value={`${Math.round(highlight.fillOpacity * 100 / 20) * 20}%`}>
              <input
                type="range" min={20} max={100} step={20}
                value={Math.round(highlight.fillOpacity * 100 / 20) * 20}
                onChange={e => upd({ fillOpacity: Number(e.target.value) / 100 })}
                style={{ width: '100%', minWidth: 0, accentColor: '#5a9e6f' }}
              />
            </SliderRow>
          )}
        </div>
      )}

      <div style={{ marginBottom: 10 }}>
        {isArea ? (
          <PillToggle
            enabled={highlight.strokeEnabled}
            label="STROKE"
            onToggle={() => upd({ strokeEnabled: !highlight.strokeEnabled })}
          />
        ) : (
          <div style={{ ...labelStyle, marginBottom: 6 }}>Stroke</div>
        )}
        {(!isArea || highlight.strokeEnabled) && (
          <>
            <SliderRow label="Opacity" value={`${Math.round(highlight.strokeOpacity * 100 / 20) * 20}%`}>
              <input
                type="range" min={20} max={100} step={20}
                value={Math.round(highlight.strokeOpacity * 100 / 20) * 20}
                onChange={e => upd({ strokeOpacity: Number(e.target.value) / 100 })}
                style={{ width: '100%', minWidth: 0, accentColor: '#5a9e6f' }}
              />
            </SliderRow>
            <SliderRow label="Width" value={`${highlight.strokeWidth}`}>
              <input
                type="range" min={1} max={20} step={0.5}
                value={highlight.strokeWidth}
                onChange={e => upd({ strokeWidth: Number(e.target.value) })}
                style={{ width: '100%', minWidth: 0, accentColor: '#5a9e6f' }}
              />
            </SliderRow>
          </>
        )}
      </div>

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

      {(!isArea || highlight.joinNeighbors) && (() => {
        const s = highlight.smoothing ?? 0
        const passes = Math.round(s - 1)
        const label = s < 0.5 ? 'Sharp' : s < 1.5 ? 'Round' : `${passes} pass${passes !== 1 ? 'es' : ''}`
        return (
          <div style={{ marginBottom: 10 }}>
            <SliderRow label="Smoothing" value={label}>
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
            </SliderRow>
            <div style={{ fontSize: 10, color: '#4a4a6a', marginTop: -6 }}>0 = sharp · 1 = round · drag right for passes</div>
          </div>
        )
      })()}

      <div style={{ marginBottom: 10 }}>
        <div style={{ ...labelStyle, marginBottom: 6 }}>Pattern</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {PATTERNS.map(([p]) => (
            <button
              key={p}
              onClick={() => upd({ linePattern: p as HexHighlight['linePattern'] })}
              style={vizBtnStyle(currentPattern === p)}
              title={p}
            >
              <PatternPreview pattern={p} />
            </button>
          ))}
        </div>
      </div>

      {hasPattern && (
        <SliderRow label="Spacing" value={`×${(highlight.patternSpacing ?? 1).toFixed(2)}`}>
          <input
            type="range" min={0.2} max={4} step={0.05}
            value={highlight.patternSpacing ?? 1}
            onChange={e => upd({ patternSpacing: Number(e.target.value) })}
            style={{ width: '100%', minWidth: 0, accentColor: '#5a9e6f' }}
          />
        </SliderRow>
      )}

      {patternHasSide && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ ...labelStyle, marginBottom: 6 }}>Side</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['left', 'right', 'center'] as const).map(side => (
              <button
                key={side}
                onClick={() => upd({ linePatternSide: side })}
                style={vizBtnStyle((highlight.linePatternSide ?? 'right') === side)}
                title={side}
              >
                <SidePreview side={side} />
              </button>
            ))}
          </div>
        </div>
      )}

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
