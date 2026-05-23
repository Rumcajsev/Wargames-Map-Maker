import { useRef, useState, useEffect } from 'react'
import { useMapStore } from '../store/mapStore'

interface Props {
  onClose: () => void
}

export function PresetsPanel({ onClose }: Props) {
  const { userPresets, savePreset, loadPreset, deletePreset, exportPreset, importPresetData } = useMapStore()
  const [saveName, setSaveName] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const handleSave = () => {
    if (!saveName.trim()) return
    savePreset(saveName)
    setSaveName('')
  }

  const handleLoad = (id: string) => {
    loadPreset(id)
    setLoadedId(id)
    setTimeout(() => setLoadedId(null), 1500)
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string)
        const err = importPresetData(data)
        setImportError(err)
        if (err) setTimeout(() => setImportError(null), 3000)
      } catch {
        setImportError('Invalid file format')
        setTimeout(() => setImportError(null), 3000)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const sorted = [...userPresets].sort((a, b) => b.createdAt - a.createdAt)

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)',
    }}>
      <div
        ref={panelRef}
        style={{
          width: 360,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#13141f',
          border: '1px solid #2a2a4a',
          borderRadius: 4,
          fontFamily: 'ui-monospace, monospace',
          fontSize: 12,
          color: '#a0a0c0',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '1px solid #2a2a4a',
          flexShrink: 0,
        }}>
          <span style={{ color: '#d0d0f0', fontWeight: 700, letterSpacing: 1, fontSize: 11, textTransform: 'uppercase' }}>
            Style Presets
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#5a5a7a', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#a0a0c0')}
            onMouseLeave={e => (e.currentTarget.style.color = '#5a5a7a')}
          >
            ×
          </button>
        </div>

        {/* Preset list */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {sorted.length === 0 ? (
            <div style={{ padding: '20px 14px', color: '#3a3a5a', textAlign: 'center', fontSize: 11 }}>
              No saved presets yet.
            </div>
          ) : (
            sorted.map(entry => (
              <div
                key={entry.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderBottom: '1px solid #1e1f2e',
                }}
              >
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#c0c0e0' }}>
                  {entry.name}
                </span>
                <button
                  onClick={() => handleLoad(entry.id)}
                  style={actionBtn(loadedId === entry.id ? 'green' : 'default')}
                  onMouseEnter={e => { if (loadedId !== entry.id) e.currentTarget.style.color = '#a0a0c0' }}
                  onMouseLeave={e => { if (loadedId !== entry.id) e.currentTarget.style.color = '#6a6a8a' }}
                >
                  {loadedId === entry.id ? '✓' : 'Load'}
                </button>
                <button
                  onClick={() => exportPreset(entry.id)}
                  style={actionBtn('default')}
                  title="Export to file"
                  onMouseEnter={e => (e.currentTarget.style.color = '#a0a0c0')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#6a6a8a')}
                >
                  ↓
                </button>
                <button
                  onClick={() => deletePreset(entry.id)}
                  style={actionBtn('danger')}
                  onMouseEnter={e => (e.currentTarget.style.color = '#e07070')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#6a4a4a')}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>

        {/* Save section */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid #2a2a4a', flexShrink: 0 }}>
          <div style={{ fontSize: 10, letterSpacing: 1, color: '#4a4a6a', textTransform: 'uppercase', marginBottom: 6 }}>
            Save current settings as
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
              placeholder="Preset name…"
              style={{
                flex: 1,
                background: '#0e0f18',
                border: '1px solid #2a2a4a',
                borderRadius: 3,
                color: '#c0c0e0',
                fontFamily: 'inherit',
                fontSize: 12,
                padding: '4px 8px',
                outline: 'none',
              }}
            />
            <button
              onClick={handleSave}
              disabled={!saveName.trim()}
              style={{
                padding: '4px 12px',
                background: saveName.trim() ? '#2a4a3a' : '#1a1a2a',
                border: `1px solid ${saveName.trim() ? '#3a6a4a' : '#2a2a3a'}`,
                borderRadius: 3,
                color: saveName.trim() ? '#8ad0a0' : '#3a3a5a',
                cursor: saveName.trim() ? 'pointer' : 'default',
                fontFamily: 'inherit',
                fontSize: 12,
                flexShrink: 0,
              }}
            >
              Save
            </button>
          </div>
        </div>

        {/* Import section */}
        <div style={{ padding: '8px 14px 12px', borderTop: '1px solid #1e1f2e', flexShrink: 0 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ig2style,.json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: '100%',
              padding: '5px 0',
              background: 'none',
              border: '1px solid #2a2a4a',
              borderRadius: 3,
              color: '#5a5a7a',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 11,
              letterSpacing: 0.5,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#a0a0c0'; e.currentTarget.style.borderColor = '#4a4a7a' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#5a5a7a'; e.currentTarget.style.borderColor = '#2a2a4a' }}
          >
            Import from file…
          </button>
          {importError && (
            <div style={{ marginTop: 6, color: '#e07070', fontSize: 10 }}>{importError}</div>
          )}
        </div>
      </div>
    </div>
  )
}

function actionBtn(variant: 'default' | 'green' | 'danger'): React.CSSProperties {
  const color = variant === 'green' ? '#6ad090' : variant === 'danger' ? '#6a4a4a' : '#6a6a8a'
  return {
    background: 'none',
    border: 'none',
    color,
    cursor: 'pointer',
    fontFamily: 'ui-monospace, monospace',
    fontSize: 11,
    padding: '2px 4px',
    flexShrink: 0,
  }
}
