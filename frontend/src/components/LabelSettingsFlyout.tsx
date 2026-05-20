import { useEffect } from 'react'
import { useMapStore, type LabelOverlay } from '../store/mapStore'
import { ColorSwatch } from './ColorSwatch'
import { PALETTE_HIGHLIGHTS } from '../palettes'
import { useFlyoutTop } from './useFlyoutTop'

interface Props {
  overlay: LabelOverlay
  anchorY: number
  onClose: () => void
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 1,
  color: '#4a4a6a',
  textTransform: 'uppercase',
}

const SliderRow = ({ label, value, children }: { label: string; value: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
      <span style={labelStyle}>{label}</span>
      <span style={{ fontSize: 10, color: '#6a6a8a' }}>{value}</span>
    </div>
    {children}
  </div>
)

const PALETTE_LABEL_BG = [
  'transparent',
  ...PALETTE_HIGHLIGHTS,
] as const

export function LabelSettingsFlyout({ overlay, anchorY, onClose }: Props) {
  const { updateLabelOverlay, clearLabelOverlay } = useMapStore()
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

  const upd = (changes: Partial<Omit<LabelOverlay, 'id'>>) =>
    updateLabelOverlay(overlay.id, changes)

  return (
    <div
      ref={flyoutRef}
      data-label-flyout
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
        <span style={{ color: '#d0d0e8', fontWeight: 600 }}>Label settings</span>
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
        <div style={{ ...labelStyle, marginBottom: 4 }}>Text color</div>
        <ColorSwatch value={overlay.textColor} onChange={v => upd({ textColor: v })} palette={PALETTE_HIGHLIGHTS} />
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ ...labelStyle, marginBottom: 4 }}>Background</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => upd({ bgColor: 'transparent' })}
            title="No background"
            style={{
              width: 20,
              height: 20,
              borderRadius: 2,
              border: overlay.bgColor === 'transparent' ? '2px solid #5a9e6f' : '1px solid #4a4a6a',
              background: 'transparent',
              backgroundImage: 'repeating-conic-gradient(#3a3a5a 0% 25%, #1a1b2e 0% 50%)',
              backgroundSize: '8px 8px',
              cursor: 'pointer',
              flexShrink: 0,
              padding: 0,
            }}
          />
          <ColorSwatch value={overlay.bgColor === 'transparent' ? '#aa1111' : overlay.bgColor} onChange={v => upd({ bgColor: v })} palette={PALETTE_HIGHLIGHTS} />
        </div>
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

      <SliderRow label="Text size" value={`${overlay.textSize}px`}>
        <input
          type="range" min={1} max={16} step={0.5}
          value={overlay.textSize}
          onChange={e => upd({ textSize: Number(e.target.value) })}
          style={{ width: '100%', minWidth: 0, accentColor: '#5a9e6f' }}
        />
      </SliderRow>

      <SliderRow label="Opacity" value={`${Math.round(overlay.opacity * 100)}%`}>
        <input
          type="range" min={0} max={1} step={0.05}
          value={overlay.opacity}
          onChange={e => upd({ opacity: Number(e.target.value) })}
          style={{ width: '100%', minWidth: 0, accentColor: '#5a9e6f' }}
        />
      </SliderRow>

      <button
        onClick={() => clearLabelOverlay(overlay.id)}
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
        Clear all labels
      </button>
    </div>
  )
}
