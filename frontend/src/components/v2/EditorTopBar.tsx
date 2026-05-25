import { useState, useRef, useMemo } from 'react'
import { useMapStore } from '../../store/mapStore'
import { TK } from '../../theme'

const TABS = [
  { id: 'terrain',     label: 'Terrain'     },
  { id: 'rivers',      label: 'Rivers'      },
  { id: 'roads',       label: 'Roads'       },
  { id: 'settlements', label: 'Settlements' },
  { id: 'highlights',  label: 'Overlays'    },
  { id: 'areas',       label: 'Areas'       },
  { id: 'elevation',   label: 'Elevation'   },
  { id: 'display',     label: 'Display'     },
] as const

export function EditorTopBar({ onExportPDF }: { onExportPDF: () => Promise<void> }) {
  const {
    paperSize, generatedHexes, generatedMetadata,
    undoStack, redoStack, undo, redo,
    activePanel, setActivePanel,
    resetToSetup, saveProject, restoreProject,
  } = useMapStore()

  const [exporting, setExporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handlePrint = async () => {
    setExporting(true)
    try { await onExportPDF() } finally { setExporting(false) }
  }

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try { restoreProject(JSON.parse(reader.result as string)) } catch { /* ignore malformed */ }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const meta = useMemo(() => {
    if (!generatedHexes.length) return null
    const qs = generatedHexes.map(h => h.q)
    const rs = generatedHexes.map(h => h.r)
    const cols = Math.max(...qs) - Math.min(...qs) + 1
    const rows = Math.max(...rs) - Math.min(...rs) + 1
    const count = generatedMetadata?.hex_count ?? generatedHexes.length
    return `${paperSize} · ${cols} × ${rows} · ${count} hex`
  }, [generatedHexes, generatedMetadata, paperSize])

  const canUndo = undoStack.length > 0
  const canRedo = redoStack.length > 0

  return (
    <div style={{
      height: TK.topBarHeight,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'stretch',
      background: TK.paper,
      borderBottom: `1px solid ${TK.line}`,
      userSelect: 'none',
    }}>

      {/* Left: wordmark + metadata */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', borderRight: `1px solid ${TK.line}`, flexShrink: 0 }}>
        <button
          onClick={resetToSetup}
          title="Back to setup"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <svg width="14" height="16" viewBox="0 0 14 16" fill="none">
            <polygon points="7,1 13,4.5 13,11.5 7,15 1,11.5 1,4.5" fill="none" stroke={TK.rust} strokeWidth="1.2" />
            <polygon points="7,4 10.5,6 10.5,10 7,12 3.5,10 3.5,6" fill={TK.rust} opacity="0.15" stroke="none" />
          </svg>
          <span style={{ fontFamily: TK.mono, fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: TK.ink }}>Hachure</span>
        </button>
        {meta && (
          <>
            <span style={{ color: TK.line, fontSize: 12 }}>|</span>
            <span style={{ fontFamily: TK.mono, fontSize: 9.5, color: TK.inkFaint, letterSpacing: 0.4 }}>{meta}</span>
          </>
        )}
      </div>

      {/* Center: tabs */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', justifyContent: 'center' }}>
        {TABS.map(tab => {
          const active = activePanel === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActivePanel(tab.id as typeof activePanel)}
              style={{
                height: '100%',
                padding: '0 10px',
                background: 'none',
                border: 'none',
                borderBottom: `2px solid ${active ? TK.rust : 'transparent'}`,
                cursor: 'pointer',
                fontFamily: TK.sans,
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                color: active ? TK.ink : TK.inkMute,
                letterSpacing: 0.1,
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Right: save/load + undo/redo + SAVED + PRINT */}
      <div style={{ display: 'flex', alignItems: 'stretch', borderLeft: `1px solid ${TK.line}`, flexShrink: 0 }}>
        {/* Save / Load */}
        <button onClick={saveProject} style={ghostBtn}>Save</button>
        <button onClick={() => fileInputRef.current?.click()} style={ghostBtn}>Load</button>
        <input ref={fileInputRef} type="file" accept=".ig2,.json" style={{ display: 'none' }} onChange={handleLoad} />

        <div style={{ width: 1, background: TK.line, margin: '8px 4px', flexShrink: 0 }} />

        {/* Undo / Redo */}
        <IconBtn onClick={undo} disabled={!canUndo} title="Undo (⌘Z)">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 6h8a4 4 0 010 8" /><path d="M4 3L1 6l3 3" />
          </svg>
        </IconBtn>
        <IconBtn onClick={redo} disabled={!canRedo} title="Redo (⌘⇧Z)">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 6H5a4 4 0 000 8" /><path d="M10 3l3 3-3 3" />
          </svg>
        </IconBtn>

        <div style={{ width: 1, background: TK.line, margin: '8px 4px', flexShrink: 0 }} />

        {/* PRINT */}
        <button
          onClick={handlePrint}
          disabled={exporting}
          style={{
            height: '100%',
            padding: '0 20px',
            background: exporting ? TK.ink2 : TK.ink,
            color: TK.paper,
            border: 'none',
            cursor: exporting ? 'default' : 'pointer',
            fontFamily: TK.sans,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            flexShrink: 0,
          }}
        >
          {exporting ? 'Exporting…' : 'Print ↗'}
        </button>
      </div>
    </div>
  )
}

function IconBtn({ onClick, disabled, title, children }: {
  onClick: () => void; disabled: boolean; title: string; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'none',
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? TK.inkFaint : TK.ink2,
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}

const ghostBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  height: '100%',
  padding: '0 12px',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontFamily: TK.mono,
  fontSize: 9.5,
  letterSpacing: 0.4,
  color: TK.inkMute,
}
