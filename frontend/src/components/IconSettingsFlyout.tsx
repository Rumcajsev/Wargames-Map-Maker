import { useEffect } from 'react'
import { useMapStore, type IconOverlay } from '../store/mapStore'
import { ColorSwatch } from './ColorSwatch'
import { PALETTE_HIGHLIGHTS } from '../palettes'
import { useFlyoutTop } from './useFlyoutTop'
import { SliderRow } from './ui'

interface Props {
  overlay: IconOverlay
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
  width: 36,
  height: 36,
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


const PREVIEW_FILL = '#a0a0c0'
const PREVIEW_STROKE = '#6a6a8a'

function ShapePreview({ shape }: { shape: IconOverlay['shape'] }) {
  const cx = 18, cy = 18, r = 11
  const sharedProps = { fill: PREVIEW_FILL, stroke: PREVIEW_STROKE, strokeWidth: 1.5 }

  if (shape === 'circle') {
    return (
      <svg width="36" height="36" viewBox="0 0 36 36">
        <circle cx={cx} cy={cy} r={r} {...sharedProps} />
      </svg>
    )
  }
  if (shape === 'square') {
    return (
      <svg width="36" height="36" viewBox="0 0 36 36">
        <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} {...sharedProps} />
      </svg>
    )
  }
  if (shape === 'triangle') {
    const s60 = r * Math.sin(Math.PI / 3)
    const pts = `${cx},${cy - r} ${cx - s60},${cy + r * 0.5} ${cx + s60},${cy + r * 0.5}`
    return (
      <svg width="36" height="36" viewBox="0 0 36 36">
        <polygon points={pts} {...sharedProps} />
      </svg>
    )
  }
  if (shape === 'diamond') {
    const pts = `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`
    return (
      <svg width="36" height="36" viewBox="0 0 36 36">
        <polygon points={pts} {...sharedProps} />
      </svg>
    )
  }
  const outerR = r, innerR = r * 0.38
  const pts = Array.from({ length: 10 }, (_, i) => {
    const angle = (i * Math.PI) / 5 - Math.PI / 2
    const rad = i % 2 === 0 ? outerR : innerR
    return `${cx + rad * Math.cos(angle)},${cy + rad * Math.sin(angle)}`
  }).join(' ')
  return (
    <svg width="36" height="36" viewBox="0 0 36 36">
      <polygon points={pts} {...sharedProps} />
    </svg>
  )
}

export function IconSettingsFlyout({ overlay, anchorY, onClose }: Props) {
  const { updateIconOverlay, clearIconOverlay } = useMapStore()
  const { ref: flyoutRef, top } = useFlyoutTop(anchorY)

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

  const upd = (changes: Partial<Omit<IconOverlay, 'id'>>) =>
    updateIconOverlay(overlay.id, changes)

  return (
    <div
      ref={flyoutRef}
      data-icon-flyout
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ color: '#d0d0e8', fontWeight: 600 }}>Icon settings</span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#6a6a8a', cursor: 'pointer', fontSize: 14, padding: 0 }}
        >×</button>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ ...labelStyle, marginBottom: 4 }}>Name</div>
        <input
          type="text"
          value={overlay.name}
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
        <div style={{ ...labelStyle, marginBottom: 6 }}>Shape</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['circle', 'square', 'triangle', 'diamond', 'star'] as const).map(shape => (
            <button
              key={shape}
              onClick={() => upd({ shape })}
              style={vizBtnStyle(overlay.shape === shape)}
              title={shape.charAt(0).toUpperCase() + shape.slice(1)}
            >
              <ShapePreview shape={shape} />
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ ...labelStyle, marginBottom: 4 }}>Fill color</div>
        <ColorSwatch value={overlay.fillColor} onChange={v => upd({ fillColor: v })} palette={PALETTE_HIGHLIGHTS} />
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ ...labelStyle, marginBottom: 4 }}>Stroke color</div>
        <ColorSwatch value={overlay.strokeColor} onChange={v => upd({ strokeColor: v })} palette={PALETTE_HIGHLIGHTS} />
      </div>

      <SliderRow label="Stroke width" value={`${overlay.strokeWidth}`}>
        <input
          type="range" min={0} max={8} step={0.5}
          value={overlay.strokeWidth}
          onChange={e => upd({ strokeWidth: Number(e.target.value) })}
          style={{ width: '100%', minWidth: 0, accentColor: '#5a9e6f' }}
        />
      </SliderRow>

      <SliderRow label="Size" value={`${Math.round(overlay.size * 100)}% of hex`}>
        <input
          type="range" min={0.1} max={0.7} step={0.05}
          value={overlay.size}
          onChange={e => upd({ size: Number(e.target.value) })}
          style={{ width: '100%', minWidth: 0, accentColor: '#5a9e6f' }}
        />
      </SliderRow>

      <button
        onClick={() => clearIconOverlay(overlay.id)}
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
        Clear all icons
      </button>
    </div>
  )
}
