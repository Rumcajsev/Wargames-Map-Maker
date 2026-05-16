import { useState } from 'react'
import { useMapStore } from '../store/mapStore'
import { HighlightSettingsFlyout } from './HighlightSettingsFlyout'
import { sidebarStyle, sectionStyle, labelStyle } from './sidebarStyles'

const CogIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.92c.04-.34.07-.68.07-1.08s-.03-.74-.07-1.08l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.34-.07.69-.07 1.08s.03.74.07 1.08L2.7 13.07c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.58 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65z" />
  </svg>
)

export function HighlightsSidebar() {
  const {
    highlights, addHighlight, deleteHighlight,
    activeHighlightId, setActiveHighlightId,
    highlightPaintMode,
    highlightLineEraser,
    highlightedHexes, highlightLines,
    setActiveTool,
  } = useMapStore()

  const [openFlyoutId, setOpenFlyoutId] = useState<string | null>(null)
  const [flyoutAnchorY, setFlyoutAnchorY] = useState(0)

  const openHighlight = highlights.find(h => h.id === openFlyoutId) ?? null
  const activeHighlight = highlights.find(h => h.id === activeHighlightId) ?? null
  const activeIsLine = activeHighlight?.mode === 'line'

  const handleCog = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (openFlyoutId === id) {
      setOpenFlyoutId(null)
    } else {
      setOpenFlyoutId(id)
      setFlyoutAnchorY(e.currentTarget.getBoundingClientRect().top)
    }
  }

  const handleRowClick = (id: string) => {
    if (activeHighlightId === id) {
      setActiveHighlightId(null)
      setHighlightPaintMode(false)
      setHighlightLineEraser(false)
    } else {
      setActiveHighlightId(id)
      setHighlightLineEraser(false)
    }
  }

  const handleAddHighlight = () => {
    addHighlight({
      name: `Highlight ${highlights.length + 1}`,
      color: '#ffcc00',
      mode: 'area',
      fillEnabled: true,
      fillOpacity: 0.3,
      strokeEnabled: true,
      strokeOpacity: 0.9,
      strokeWidth: 3,
      joinNeighbors: true,
      smoothing: 0,
      linePattern: 'none',
      linePatternSide: 'right' as const,
      patternSpacing: 1,
    })
  }

  const hexCountForHighlight = (h: typeof highlights[0]) =>
    h.mode !== 'area'
      ? (highlightLines[h.id]?.reduce((sum, seg) => sum + seg.length, 0) ?? 0)
      : Object.values(highlightedHexes).filter(v => v === h.id).length

  const hexCountLabel = (h: typeof highlights[0]) => {
    const count = hexCountForHighlight(h)
    if (h.mode !== 'area') return count > 0 ? `${count} hex${count !== 1 ? 'es' : ''} in path` : ''
    return count > 0 ? `${count} hex${count !== 1 ? 'es' : ''}` : ''
  }

  return (
    <div data-highlights-sidebar style={sidebarStyle}>
      {/* Paint mode */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Paint mode</div>
        <button
          disabled={!activeHighlightId}
          onClick={() => {
            if (!activeHighlightId) return
            if (highlightPaintMode) setActiveTool({ type: 'none' })
            else setActiveTool({ type: 'highlight-paint', id: activeHighlightId })
          }}
          style={{
            width: '100%',
            padding: '6px 0',
            background: highlightPaintMode ? '#1e3a28' : '#1a1b2e',
            border: `1px solid ${highlightPaintMode ? '#5a9e6f' : '#2a2b3e'}`,
            borderRadius: 3,
            color: !activeHighlightId ? '#3a3a5a' : highlightPaintMode ? '#5a9e6f' : '#a0a0c0',
            fontFamily: 'inherit',
            fontSize: 11,
            cursor: activeHighlightId ? 'pointer' : 'default',
          }}
        >
          {highlightPaintMode ? '● Painting' : '○ Paint hexes'}
        </button>
        {!activeHighlightId && (
          <div style={{ fontSize: 10, color: '#3a3a5a', marginTop: 4 }}>Select a highlight first</div>
        )}
        {activeIsLine && (
          <button
            onClick={() => {
              if (!activeHighlightId) return
              if (highlightLineEraser) setActiveTool({ type: 'none' })
              else setActiveTool({ type: 'highlight-erase', id: activeHighlightId })
            }}
            style={{
              width: '100%',
              padding: '6px 0',
              marginTop: 6,
              background: highlightLineEraser ? '#3a1e1e' : '#1a1b2e',
              border: `1px solid ${highlightLineEraser ? '#9e5a5a' : '#2a2b3e'}`,
              borderRadius: 3,
              color: highlightLineEraser ? '#e08080' : '#a0a0c0',
              fontFamily: 'inherit',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            {highlightLineEraser ? '● Erasing' : '○ Eraser'}
          </button>
        )}
      </div>

      {/* Highlight list */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Highlights</div>
        {highlights.length === 0 && (
          <div style={{ fontSize: 11, color: '#3a3a5a' }}>No highlights yet</div>
        )}
        {highlights.map(h => {
          const isActive = activeHighlightId === h.id
          const countLabel = hexCountLabel(h)
          return (
            <div
              key={h.id}
              onClick={() => handleRowClick(h.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 6px',
                marginBottom: 2,
                borderRadius: 3,
                background: isActive ? '#1e2a3a' : 'transparent',
                border: `1px solid ${isActive ? '#2a4a6a' : 'transparent'}`,
                cursor: 'pointer',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#141522' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              {/* Color swatch */}
              <div style={{
                width: 14,
                height: 14,
                borderRadius: 2,
                background: h.color,
                flexShrink: 0,
                opacity: h.fillEnabled ? h.fillOpacity + (h.strokeEnabled ? 0.3 : 0) : 1,
                border: h.strokeEnabled ? `2px solid ${h.color}` : '1px solid #3a3a5a',
              }} />

              {/* Name + count */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: isActive ? '#d0ecd8' : '#a0a0c0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {h.name}
                </div>
                {countLabel && (
                  <div style={{ fontSize: 10, color: '#4a6a5a' }}>{countLabel}</div>
                )}
              </div>

              {/* Cog */}
              <button
                onClick={e => handleCog(h.id, e)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: openFlyoutId === h.id ? '#a0c8b0' : '#4a4a6a',
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#a0c8b0')}
                onMouseLeave={e => (e.currentTarget.style.color = openFlyoutId === h.id ? '#a0c8b0' : '#4a4a6a')}
              >
                <CogIcon />
              </button>

              {/* Delete */}
              <button
                onClick={e => { e.stopPropagation(); deleteHighlight(h.id) }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#4a4a6a',
                  cursor: 'pointer',
                  padding: 2,
                  fontSize: 13,
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#e08080')}
                onMouseLeave={e => (e.currentTarget.style.color = '#4a4a6a')}
              >×</button>
            </div>
          )
        })}
      </div>

      {/* Add button */}
      <div style={{ padding: '10px 12px' }}>
        <button
          onClick={handleAddHighlight}
          style={{
            width: '100%',
            padding: '6px 0',
            background: '#141522',
            border: '1px dashed #2a2b3e',
            borderRadius: 3,
            color: '#5a9e6f',
            fontFamily: 'inherit',
            fontSize: 11,
            cursor: 'pointer',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#5a9e6f')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#2a2b3e')}
        >
          + Add highlight
        </button>
      </div>

      {openHighlight && (
        <HighlightSettingsFlyout
          highlight={openHighlight}
          anchorY={flyoutAnchorY}
          onClose={() => setOpenFlyoutId(null)}
        />
      )}
    </div>
  )
}
