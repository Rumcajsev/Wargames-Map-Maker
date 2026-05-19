import { useEffect } from 'react'
import { useMapStore, type IconOverlay } from '../store/mapStore'
import { ColorSwatch } from './ColorSwatch'
import { PALETTE_HIGHLIGHTS } from '../palettes'
import { useFlyoutTop } from './useFlyoutTop'

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
        <span style={{ color: '#d0d0e8', fontWeight: 600 }}>Icon settings</span>
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

      {/* Shape */}
      <div style={{ marginBottom: 10 }}>
        <div style={labelStyle}>Shape</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['circle', 'square', 'triangle', 'diamond', 'star'] as const).map(shape => (
            <button
              key={shape}
              onClick={() => upd({ shape })}
              style={segBtnStyle(overlay.shape === shape)}
            >
              {shape.charAt(0).toUpperCase() + shape.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Fill color */}
      <div style={{ marginBottom: 10 }}>
        <div style={labelStyle}>Fill color</div>
        <ColorSwatch value={overlay.fillColor} onChange={v => upd({ fillColor: v })} palette={PALETTE_HIGHLIGHTS} />
      </div>

      {/* Stroke color */}
      <div style={{ marginBottom: 10 }}>
        <div style={labelStyle}>Stroke color</div>
        <ColorSwatch value={overlay.strokeColor} onChange={v => upd({ strokeColor: v })} palette={PALETTE_HIGHLIGHTS} />
      </div>

      {/* Stroke width */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <div style={labelStyle}>Stroke width</div>
          <span style={{ fontSize: 10, color: '#6a6a8a' }}>{overlay.strokeWidth}</span>
        </div>
        <input
          type="range" min={0} max={8} step={0.5}
          value={overlay.strokeWidth}
          onChange={e => upd({ strokeWidth: Number(e.target.value) })}
          style={{ width: '100%', minWidth: 0, accentColor: '#5a9e6f' }}
        />
      </div>

      {/* Size */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <div style={labelStyle}>Size</div>
          <span style={{ fontSize: 10, color: '#6a6a8a' }}>{Math.round(overlay.size * 100)}% of hex</span>
        </div>
        <input
          type="range" min={0.1} max={0.7} step={0.05}
          value={overlay.size}
          onChange={e => upd({ size: Number(e.target.value) })}
          style={{ width: '100%', minWidth: 0, accentColor: '#5a9e6f' }}
        />
      </div>

      {/* Clear all */}
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
