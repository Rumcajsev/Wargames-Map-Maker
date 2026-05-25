import { useEffect, useId, useState } from 'react'
import { useMapStore } from '../store/mapStore'
import { TEXTURE_REGISTRY } from '../lib/textureRegistry'
import { FlyoutContainer, FlyoutHeader } from './ui'

interface Props {
  anchorY: number
  onClose: () => void
}

export function AddTerrainFlyout({ anchorY, onClose }: Props) {
  const { addCustomTerrain } = useMapStore()
  const [name, setName] = useState('')
  const [color, setColor] = useState('#a07850')
  const [textureId, setTextureId] = useState<string | null>(null)
  const uid = useId()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-add-terrain-flyout]')) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const handleAdd = () => {
    if (!name.trim()) return
    addCustomTerrain({ id: `custom_${uid}_${Date.now()}`, name: name.trim(), color, textureId })
    onClose()
  }

  return (
    <FlyoutContainer
      top={Math.min(anchorY, window.innerHeight - 200)}
      data-add-terrain-flyout=""
    >
      <FlyoutHeader title="New terrain" onClose={onClose} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          autoFocus
          placeholder="Name…"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') onClose() }}
          style={{
            background: '#1a1f2a', border: '1px solid #3a5a7a', borderRadius: 3,
            padding: '4px 6px', color: '#c0c0e0', fontSize: 11,
            fontFamily: 'ui-monospace, monospace', outline: 'none',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: '#6a6a8a', letterSpacing: 0.5, textTransform: 'uppercase' }}>Color</span>
          <input
            type="color" value={color}
            onChange={e => setColor(e.target.value)}
            style={{ width: 28, height: 20, padding: 0, border: 'none', borderRadius: 2, cursor: 'pointer', background: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 10, color: '#6a6a8a', letterSpacing: 0.5, textTransform: 'uppercase' }}>Texture</span>
          <select
            value={textureId ?? ''}
            onChange={e => setTextureId(e.target.value || null)}
            style={{ fontSize: 10, background: '#1a1f2a', border: '1px solid #2a2a3a', borderRadius: 3, color: '#8a8aaa', padding: '3px 4px', cursor: 'pointer' }}
          >
            <option value="">None</option>
            {TEXTURE_REGISTRY.map(tx => <option key={tx.id} value={tx.id}>{tx.label}</option>)}
          </select>
        </div>
        <button
          disabled={!name.trim()}
          onClick={handleAdd}
          style={{
            marginTop: 4, padding: '4px 0', borderRadius: 3, border: 'none',
            background: name.trim() ? '#3a5a3a' : '#1a2a1a',
            color: name.trim() ? '#c0e0c0' : '#4a4a6a',
            cursor: name.trim() ? 'pointer' : 'not-allowed',
            fontSize: 11, fontFamily: 'ui-monospace, monospace',
          }}
        >
          Add terrain
        </button>
      </div>
    </FlyoutContainer>
  )
}
