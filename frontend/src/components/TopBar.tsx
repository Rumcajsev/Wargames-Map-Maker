import { useState, useRef } from 'react'
import { useMapStore } from '../store/mapStore'

const TABS = [
  { id: 'terrain', label: 'Terrain' },
  { id: 'roads', label: 'Roads' },
  { id: 'rivers', label: 'Rivers' },
  { id: 'settlements', label: 'Settlements' },
  { id: 'highlights', label: 'Overlays' },
  { id: 'areas', label: 'Areas' },
  { id: 'elevation', label: 'Elevation' },
  { id: 'display', label: 'Display' },
] as const

export function TopBar({ onExportPDF, onOpenPresets }: { onExportPDF: () => Promise<void>; onOpenPresets: () => void }) {
  const { resetToSetup, activePanel, setActivePanel, saveProject, restoreProject, mapStyle, setMapStyle } = useMapStore()
  const [exporting, setExporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    setExporting(true)
    try { await onExportPDF() } finally { setExporting(false) }
  }

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string)
        restoreProject(data)
      } catch { /* ignore malformed file */ }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div style={{
      height: 44,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      background: '#0e0f18',
      borderBottom: '1px solid #1e1f2e',
      fontFamily: 'ui-monospace, monospace',
      fontSize: 12,
      userSelect: 'none',
    }}>
      <div style={{
        padding: '0 16px',
        color: '#ffffff',
        fontWeight: 700,
        fontSize: 13,
        letterSpacing: 1,
        borderRight: '1px solid #1e1f2e',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        IG2
      </div>

      <button
        onClick={resetToSetup}
        style={{
          height: '100%',
          padding: '0 14px',
          background: 'none',
          color: '#6a6a8a',
          border: 'none',
          borderRight: '1px solid #1e1f2e',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: 12,
          display: 'flex',
          alignItems: 'center',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#a0a0c0')}
        onMouseLeave={e => (e.currentTarget.style.color = '#6a6a8a')}
      >
        ← Setup
      </button>

      {TABS.map(tab => {
        const active = activePanel === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => setActivePanel(tab.id as typeof activePanel)}
            style={{
              height: '100%',
              padding: '0 16px',
              background: 'none',
              color: active ? '#d0ecd8' : '#6a6a8a',
              border: 'none',
              borderRight: '1px solid #1e1f2e',
              borderBottom: active ? '2px solid #5a9e6f' : '2px solid transparent',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#a0a0c0' }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#6a6a8a' }}
          >
            {tab.label}
          </button>
        )
      })}

      <div style={{ flex: 1 }} />

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '0 12px',
        borderLeft: '1px solid #1e1f2e',
        height: '100%',
      }}>
        {(['standard', 'historical_simple', 'basic'] as const).map(s => (
          <button
            key={s}
            onClick={() => setMapStyle(s)}
            style={{
              padding: '3px 10px',
              background: mapStyle === s ? '#2a3a4a' : 'none',
              color: mapStyle === s ? '#a8d8b8' : '#6a6a8a',
              border: mapStyle === s ? '1px solid #3a5a6a' : '1px solid transparent',
              borderRadius: 3,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 11,
            }}
          >
            {s === 'standard' ? 'Standard' : s === 'historical_simple' ? 'Historical' : 'Basic'}
          </button>
        ))}
      </div>

      <button
        onClick={onOpenPresets}
        style={{
          height: '100%',
          padding: '0 14px',
          background: 'none',
          color: '#6a6a8a',
          border: 'none',
          borderLeft: '1px solid #1e1f2e',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: 12,
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#a0a0c0')}
        onMouseLeave={e => (e.currentTarget.style.color = '#6a6a8a')}
      >
        Styles
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".ig2,.json"
        style={{ display: 'none' }}
        onChange={handleLoad}
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        style={{
          height: '100%',
          padding: '0 14px',
          background: 'none',
          color: '#6a6a8a',
          border: 'none',
          borderLeft: '1px solid #1e1f2e',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: 12,
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#a0a0c0')}
        onMouseLeave={e => (e.currentTarget.style.color = '#6a6a8a')}
      >
        Load
      </button>

      <button
        onClick={saveProject}
        style={{
          height: '100%',
          padding: '0 14px',
          background: 'none',
          color: '#6a6a8a',
          border: 'none',
          borderLeft: '1px solid #1e1f2e',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: 12,
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#a0a0c0')}
        onMouseLeave={e => (e.currentTarget.style.color = '#6a6a8a')}
      >
        Save
      </button>

      <button
        onClick={handleExport}
        disabled={exporting}
        style={{
          height: '100%',
          padding: '0 16px',
          background: 'none',
          color: exporting ? '#4a4a6a' : '#8ab4a0',
          border: 'none',
          borderLeft: '1px solid #1e1f2e',
          cursor: exporting ? 'default' : 'pointer',
          fontFamily: 'inherit',
          fontSize: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexShrink: 0,
        }}
        onMouseEnter={e => { if (!exporting) e.currentTarget.style.color = '#c0dcd0' }}
        onMouseLeave={e => { if (!exporting) e.currentTarget.style.color = '#8ab4a0' }}
      >
        {exporting ? 'Exporting…' : 'Export PDF'}
      </button>
    </div>
  )
}
