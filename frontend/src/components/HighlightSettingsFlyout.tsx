import { useEffect } from 'react'
import { useMapStore, type HexHighlight } from '../store/mapStore'
import { ColorSwatch } from './ColorSwatch'
import { PALETTE_HIGHLIGHTS } from '../palettes'
import { useFlyoutTop } from './useFlyoutTop'
import { SliderRow } from './ui'

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
const PREVIEW_FILL = '#6a6a9a'

function FillPatternPreview({ pattern }: { pattern: 'none' | 'hatched' }) {
  if (pattern === 'hatched') {
    return (
      <svg width="28" height="18" viewBox="0 0 28 18">
        <defs>
          <pattern id="fp-hatch" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="5" stroke={PREVIEW_STROKE} strokeWidth="1" />
          </pattern>
          <clipPath id="fp-clip"><rect x="2" y="2" width="24" height="14" /></clipPath>
        </defs>
        <rect x="2" y="2" width="24" height="14" rx="1" fill="url(#fp-hatch)" clipPath="url(#fp-clip)" stroke={PREVIEW_TICK} strokeWidth="0.8" />
      </svg>
    )
  }
  return (
    <svg width="28" height="18" viewBox="0 0 28 18">
      <rect x="2" y="2" width="24" height="14" rx="1" fill={PREVIEW_FILL} />
    </svg>
  )
}

function PatternPreview({ pattern }: { pattern: string }) {
  const sw = 1.5
  const lineProps = { stroke: PREVIEW_STROKE, strokeWidth: sw, strokeLinecap: 'round' as const }

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
        <line x1="2" y1="9" x2="26" y2="9" {...lineProps} strokeDasharray="1.5 3.5" />
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
  if (pattern === 'dashdot') {
    return (
      <svg width="28" height="18" viewBox="0 0 28 18">
        <line x1="2" y1="9" x2="10" y2="9" {...lineProps} strokeLinecap="butt" />
        <circle cx="13.5" cy="9" r="1.5" fill={PREVIEW_STROKE} />
        <line x1="17" y1="9" x2="25" y2="9" {...lineProps} strokeLinecap="butt" />
      </svg>
    )
  }
  return null
}

const PATTERNS: Array<[string, string]> = [
  ['none', 'Straight'],
  ['dotted', 'Dotted'],
  ['dashed', 'Dashed'],
  ['dashdot', 'Dash-dot'],
]

const divider = <div style={{ borderTop: '1px solid #1e1f32', margin: '10px 0' }} />

export function HighlightSettingsFlyout({ highlight, anchorY, onClose }: Props) {
  const { updateHighlight, clearAllHexHighlights, clearHighlightLine, clearHighlightEdgePath } = useMapStore()
  const { ref: flyoutRef, top } = useFlyoutTop(anchorY)

  const isArea = highlight.mode === 'area'
  const currentPattern = highlight.linePattern ?? 'none'
  const showSmoothing = !isArea || highlight.joinNeighbors

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

  const smoothingLabel = (() => {
    const s = highlight.smoothing ?? 0
    const passes = Math.round(s - 1)
    return s < 0.5 ? 'Sharp' : s < 1.5 ? 'Round' : `${passes} pass${passes !== 1 ? 'es' : ''}`
  })()

  return (
    <div
      ref={flyoutRef}
      data-highlight-flyout
      style={{
        position: 'fixed',
        left: 204,
        top,
        width: 195,
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
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ color: '#d0d0e8', fontWeight: 600 }}>Overlay settings</span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#6a6a8a', cursor: 'pointer', fontSize: 14, padding: 0 }}
        >×</button>
      </div>

      {/* Identity */}
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
      <div style={{ marginBottom: 0 }}>
        <div style={{ ...labelStyle, marginBottom: 4 }}>Color</div>
        <ColorSwatch value={highlight.color} onChange={v => upd({ color: v })} palette={PALETTE_HIGHLIGHTS} />
      </div>

      {/* Shape */}
      {(isArea || showSmoothing) && divider}
      {isArea && (
        <div style={{ marginBottom: showSmoothing ? 10 : 0 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={highlight.joinNeighbors}
              onChange={e => upd({ joinNeighbors: e.target.checked })}
              style={{ accentColor: '#5a9e6f' }}
            />
            <div>
              <div style={labelStyle}>Join neighbors</div>
              <div style={{ fontSize: 10, color: '#4a4a6a', marginTop: 2 }}>Only outline the outer border</div>
            </div>
          </label>
        </div>
      )}
      {showSmoothing && (
        <>
          <SliderRow label="Smoothing" value={smoothingLabel}>
            <input
              type="range" min={0} max={8} step={0.1}
              value={highlight.smoothing ?? 0}
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
          <div style={{ fontSize: 10, color: '#4a4a6a', marginTop: -6, marginBottom: 2 }}>0 = sharp · 1 = round · drag right for passes</div>
        </>
      )}

      {/* Fill (area only) */}
      {isArea && (
        <>
          {divider}
          <SliderRow label="Fill" value={highlight.fillOpacity === 0 ? 'off' : `${Math.round(highlight.fillOpacity * 100)}%`} dim={highlight.fillOpacity === 0}>
            <input
              type="range" min={0} max={100} step={10}
              value={Math.round(highlight.fillOpacity * 100)}
              onChange={e => {
                const v = Number(e.target.value)
                upd({ fillOpacity: v / 100, fillEnabled: v > 0 })
              }}
              style={{ width: '100%', minWidth: 0, accentColor: '#5a9e6f' }}
            />
          </SliderRow>
          {highlight.fillOpacity > 0 && (
            <>
              <div style={{ ...labelStyle, marginBottom: 6 }}>Style</div>
              <div style={{ display: 'flex', gap: 4, marginBottom: (highlight.fillPattern ?? 'none') === 'hatched' ? 8 : 0 }}>
                {(['none', 'hatched'] as const).map(fp => (
                  <button
                    key={fp}
                    onClick={() => upd({ fillPattern: fp })}
                    style={vizBtnStyle((highlight.fillPattern ?? 'none') === fp)}
                    title={fp === 'none' ? 'Solid' : 'Hatched'}
                  >
                    <FillPatternPreview pattern={fp} />
                  </button>
                ))}
              </div>
              {(highlight.fillPattern ?? 'none') === 'hatched' && (
                <SliderRow label="Spacing" value={`×${(highlight.fillPatternSpacing ?? 1).toFixed(1)}`}>
                  <input
                    type="range" min={0.3} max={3} step={0.1}
                    value={highlight.fillPatternSpacing ?? 1}
                    onChange={e => upd({ fillPatternSpacing: Number(e.target.value) })}
                    style={{ width: '100%', minWidth: 0, accentColor: '#5a9e6f' }}
                  />
                </SliderRow>
              )}
            </>
          )}
        </>
      )}

      {/* Stroke */}
      {divider}
      <SliderRow label="Stroke" value={highlight.strokeOpacity === 0 ? 'off' : `${Math.round(highlight.strokeOpacity * 100)}%`} dim={highlight.strokeOpacity === 0}>
        <input
          type="range" min={0} max={100} step={10}
          value={Math.round(highlight.strokeOpacity * 100)}
          onChange={e => {
            const v = Number(e.target.value)
            upd({ strokeOpacity: v / 100, strokeEnabled: v > 0 })
          }}
          style={{ width: '100%', minWidth: 0, accentColor: '#5a9e6f' }}
        />
      </SliderRow>
      <SliderRow label="Width" value={`${highlight.strokeWidth}`} dim={highlight.strokeOpacity === 0}>
        <input
          type="range" min={1} max={20} step={0.5}
          value={highlight.strokeWidth}
          onChange={e => upd({ strokeWidth: Number(e.target.value) })}
          style={{ width: '100%', minWidth: 0, accentColor: '#5a9e6f' }}
        />
      </SliderRow>
      <div style={{ marginBottom: currentPattern !== 'none' ? 8 : 0 }}>
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
      {currentPattern !== 'none' && (
        <SliderRow label="Spacing" value={`×${(highlight.patternSpacing ?? 1).toFixed(1)}`}>
          <input
            type="range" min={0.3} max={3} step={0.1}
            value={highlight.patternSpacing ?? 1}
            onChange={e => upd({ patternSpacing: Number(e.target.value) })}
            style={{ width: '100%', minWidth: 0, accentColor: '#5a9e6f' }}
          />
        </SliderRow>
      )}

      {/* Actions */}
      {divider}
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
