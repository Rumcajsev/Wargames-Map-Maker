import { useState } from 'react'
import { useMapStore, type IconOverlay, type LabelOverlay, type HexHighlight } from '../store/mapStore'
import { HighlightSettingsFlyout } from './HighlightSettingsFlyout'
import { IconSettingsFlyout } from './IconSettingsFlyout'
import { LabelSettingsFlyout } from './LabelSettingsFlyout'
import { sidebarStyle, sectionStyle, labelStyle } from './sidebarStyles'

function HighlightSwatch({ h }: { h: HexHighlight }) {
  const color = h.color
  const isLine = h.mode !== 'area'

  if (isLine) {
    const sw = Math.max(0.8, Math.min(h.strokeWidth * 0.45, 3))
    const lp = h.linePattern ?? 'none'
    const lineProps = { stroke: color, strokeWidth: sw, strokeLinecap: 'round' as const }
    const baseLine = <line x1="1" y1="9" x2="17" y2="9" {...lineProps} />
    const tickSW = Math.max(0.8, sw * 0.8)

    if (lp === 'dotted') {
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
          <line x1="1" y1="9" x2="17" y2="9" {...lineProps} strokeDasharray="1.5 3.5" />
        </svg>
      )
    }
    if (lp === 'dashed') {
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
          <line x1="1" y1="9" x2="17" y2="9" {...lineProps} strokeLinecap="butt" strokeDasharray="5 2.5" />
        </svg>
      )
    }
    if (lp === 'dashdot') {
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
          <line x1="1" y1="9" x2="7" y2="9" stroke={color} strokeWidth={sw} strokeLinecap="butt" />
          <circle cx="10" cy="9" r={Math.max(0.8, sw * 0.55)} fill={color} />
          <line x1="13" y1="9" x2="17" y2="9" stroke={color} strokeWidth={sw} strokeLinecap="butt" />
        </svg>
      )
    }
    const decoration: React.ReactNode = null

    return (
      <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
        {baseLine}
        {decoration}
      </svg>
    )
  }

  const strokeProps = {
    stroke: h.strokeEnabled ? color : '#3a3a5a',
    strokeWidth: h.strokeEnabled ? 1.5 : 0.75,
  }
  const patId = `hs-hatch-${color.replace('#', '')}`
  if ((h.fillPattern ?? 'none') === 'hatched' && h.fillEnabled && h.fillOpacity > 0) {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
        <defs>
          <pattern id={patId} patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="4" stroke={color} strokeWidth="1" strokeOpacity={h.fillOpacity} />
          </pattern>
        </defs>
        <rect x="1.5" y="1.5" width="15" height="15" rx="2" fill={`url(#${patId})`} {...strokeProps} />
      </svg>
    )
  }
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
      <rect x="1.5" y="1.5" width="15" height="15" rx="2"
        fill={color} fillOpacity={h.fillEnabled ? h.fillOpacity : 0}
        {...strokeProps}
      />
    </svg>
  )
}

function IconShapeSwatch({ shape, fillColor, strokeColor, strokeWidth }: Pick<IconOverlay, 'shape' | 'fillColor' | 'strokeColor' | 'strokeWidth'>) {
  const cx = 9, cy = 9, r = 6
  const sw = Math.min(strokeWidth * 0.55, 2)
  const sharedProps = { fill: fillColor, stroke: strokeWidth > 0 ? strokeColor : 'none', strokeWidth: sw }

  let path: React.ReactNode
  if (shape === 'circle') {
    path = <circle cx={cx} cy={cy} r={r} {...sharedProps} />
  } else if (shape === 'square') {
    path = <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} {...sharedProps} />
  } else if (shape === 'triangle') {
    const s60 = r * Math.sin(Math.PI / 3)
    const pts = `${cx},${cy - r} ${cx - s60},${cy + r * 0.5} ${cx + s60},${cy + r * 0.5}`
    path = <polygon points={pts} {...sharedProps} />
  } else if (shape === 'diamond') {
    const pts = `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`
    path = <polygon points={pts} {...sharedProps} />
  } else {
    const outerR = r, innerR = r * 0.38
    const pts = Array.from({ length: 10 }, (_, i) => {
      const angle = (i * Math.PI) / 5 - Math.PI / 2
      const rad = i % 2 === 0 ? outerR : innerR
      return `${cx + rad * Math.cos(angle)},${cy + rad * Math.sin(angle)}`
    }).join(' ')
    path = <polygon points={pts} {...sharedProps} />
  }

  return (
    <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
      {path}
    </svg>
  )
}

function LabelSwatch({ textColor, bgColor, strokeColor }: Pick<LabelOverlay, 'textColor' | 'bgColor' | 'strokeColor'>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
      <rect x="1.5" y="4" width="15" height="10" rx="1"
        fill={bgColor === 'transparent' ? 'none' : bgColor}
        stroke={strokeColor}
        strokeWidth="1.2"
      />
      <text x="9" y="9.5" textAnchor="middle" dominantBaseline="middle"
        fill={textColor} fontSize="6" fontFamily="monospace" fontWeight="bold"
      >Aa</text>
    </svg>
  )
}

const CogIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.92c.04-.34.07-.68.07-1.08s-.03-.74-.07-1.08l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.34-.07.69-.07 1.08s.03.74.07 1.08L2.7 13.07c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.58 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65z" />
  </svg>
)

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    width="9" height="9" viewBox="0 0 24 24" fill="currentColor"
    style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}
  >
    <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
  </svg>
)

const OVERLAY_DEFAULTS = {
  fillEnabled: true,
  fillOpacity: 0.3,
  fillPattern: 'none' as const,
  fillPatternSpacing: 1,
  strokeEnabled: true,
  strokeOpacity: 0.9,
  strokeWidth: 3,
  joinNeighbors: true,
  smoothing: 0,
  linePattern: 'none' as const,
  linePatternSide: 'right' as const,
  patternSpacing: 1,
}

export function HighlightsSidebar() {
  const {
    highlights, addHighlight, deleteHighlight,
    activeHighlightId, setActiveHighlightId,
    highlightPaintMode,
    highlightLineEraser,
    highlightedHexes, highlightLines,
    iconOverlays, placedIcons, addIconOverlay, deleteIconOverlay,
    activeIconOverlayId,
    iconPlaceMode,
    labelOverlays, placedLabels, addLabelOverlay, deleteLabelOverlay,
    activeLabelOverlayId,
    setActiveTool,
  } = useMapStore()

  const [openFlyoutId, setOpenFlyoutId] = useState<string | null>(null)
  const [flyoutAnchorY, setFlyoutAnchorY] = useState(0)
  const [openIconFlyoutId, setOpenIconFlyoutId] = useState<string | null>(null)
  const [iconFlyoutAnchorY, setIconFlyoutAnchorY] = useState(0)
  const [openLabelFlyoutId, setOpenLabelFlyoutId] = useState<string | null>(null)
  const [labelFlyoutAnchorY, setLabelFlyoutAnchorY] = useState(0)
  const [areasExpanded, setAreasExpanded] = useState(true)
  const [edgesExpanded, setEdgesExpanded] = useState(true)
  const [linesExpanded, setLinesExpanded] = useState(true)
  const [iconsExpanded, setIconsExpanded] = useState(true)
  const [labelsExpanded, setLabelsExpanded] = useState(true)

  const openHighlight = highlights.find(h => h.id === openFlyoutId) ?? null
  const openIconOverlay = iconOverlays.find(o => o.id === openIconFlyoutId) ?? null
  const openLabelOverlay = labelOverlays.find(o => o.id === openLabelFlyoutId) ?? null

  const areaOverlays = highlights.filter(h => h.mode === 'area')
  const edgeOverlays = highlights.filter(h => h.mode === 'edge')
  const lineOverlays = highlights.filter(h => h.mode === 'line')

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
    if (activeHighlightId === id && highlightPaintMode) {
      setActiveTool({ type: 'none' })
      setActiveHighlightId(null)
    } else if (activeHighlightId === id && highlightLineEraser) {
      setActiveTool({ type: 'highlight-paint', id })
    } else {
      setActiveTool({ type: 'highlight-paint', id })
    }
  }

  const handleEraser = () => {
    if (highlightLineEraser) {
      if (activeHighlightId) {
        setActiveTool({ type: 'highlight-paint', id: activeHighlightId })
      } else {
        setActiveTool({ type: 'none' })
      }
    } else {
      if (activeHighlightId) {
        setActiveTool({ type: 'highlight-erase', id: activeHighlightId })
      } else {
        setActiveTool({ type: 'highlight-erase-any' })
      }
    }
  }

  const handleAddArea = () => {
    addHighlight({
      name: `Area ${areaOverlays.length + 1}`,
      color: '#ffcc00',
      mode: 'area',
      ...OVERLAY_DEFAULTS,
    })
  }

  const handleAddEdge = () => {
    addHighlight({
      name: `Edge ${edgeOverlays.length + 1}`,
      color: '#44aaff',
      mode: 'edge',
      ...OVERLAY_DEFAULTS,
      fillEnabled: false,
    })
  }

  const handleAddLine = () => {
    addHighlight({
      name: `Line ${lineOverlays.length + 1}`,
      color: '#ff6644',
      mode: 'line',
      ...OVERLAY_DEFAULTS,
      fillEnabled: false,
    })
  }

  const handleIconCog = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (openIconFlyoutId === id) {
      setOpenIconFlyoutId(null)
    } else {
      setOpenIconFlyoutId(id)
      setIconFlyoutAnchorY(e.currentTarget.getBoundingClientRect().top)
    }
  }

  const handleIconRowClick = (id: string) => {
    if (activeIconOverlayId === id && iconPlaceMode) {
      setActiveTool({ type: 'none' })
    } else {
      setActiveTool({ type: 'icon-place', id })
    }
  }

  const handleAddIcon = () => {
    addIconOverlay({
      name: `Icon ${iconOverlays.length + 1}`,
      shape: 'circle',
      fillColor: '#e05050',
      strokeColor: '#1a1b2e',
      strokeWidth: 1.5,
      size: 0.35,
    })
  }

  const handleLabelCog = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (openLabelFlyoutId === id) {
      setOpenLabelFlyoutId(null)
    } else {
      setOpenLabelFlyoutId(id)
      setLabelFlyoutAnchorY(e.currentTarget.getBoundingClientRect().top)
    }
  }

  const handleLabelRowClick = (id: string) => {
    const tool = useMapStore.getState().activeTool
    if (activeLabelOverlayId === id && tool.type === 'label-place') {
      setActiveTool({ type: 'none' })
    } else {
      setActiveTool({ type: 'label-place', id })
    }
  }

  const handleAddLabel = () => {
    addLabelOverlay({
      name: `Label ${labelOverlays.length + 1}`,
      textColor: '#ffffff',
      bgColor: '#aa1111',
      strokeColor: '#000000',
      strokeWidth: 1,
      textSize: 14,
      opacity: 1,
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

  const isErasing = highlightLineEraser
  const isPainting = highlightPaintMode && !!activeHighlightId

  const renderOverlayRow = (h: typeof highlights[0]) => {
    const isActive = activeHighlightId === h.id
    const isActivePaint = isActive && isPainting
    const isActiveErase = isActive && isErasing
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
          background: isActiveErase ? '#2a1e1e' : isActive ? '#1e2a3a' : 'transparent',
          border: `1px solid ${isActiveErase ? '#6a3a3a' : isActive ? '#2a4a6a' : 'transparent'}`,
          cursor: 'pointer',
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#141522' }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
      >
        <HighlightSwatch h={h} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            color: isActiveErase ? '#e08080' : isActive ? '#d0ecd8' : '#a0a0c0',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {isActivePaint ? '● ' : isActiveErase ? '✕ ' : ''}{h.name}
          </div>
          {countLabel && (
            <div style={{ fontSize: 10, color: '#4a6a5a' }}>{countLabel}</div>
          )}
        </div>

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
  }

  const renderAddButton = (label: string, onClick: () => void) => (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        padding: '5px 0',
        marginTop: 4,
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
      {label}
    </button>
  )

  const renderCategoryHeader = (label: string, expanded: boolean, onToggle: () => void) => (
    <div
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
        marginBottom: expanded ? 6 : 0,
        userSelect: 'none',
      }}
    >
      <ChevronIcon expanded={expanded} />
      <span style={labelStyle}>{label}</span>
    </div>
  )

  return (
    <div data-highlights-sidebar style={sidebarStyle}>
      {/* Eraser tool */}
      <div style={sectionStyle}>
        <button
          onClick={handleEraser}
          style={{
            width: '100%',
            padding: '6px 0',
            background: isErasing ? '#3a1e1e' : '#1a1b2e',
            border: `1px solid ${isErasing ? '#9e5a5a' : '#2a2b3e'}`,
            borderRadius: 3,
            color: isErasing ? '#e08080' : '#a0a0c0',
            fontFamily: 'inherit',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          {isErasing
            ? (activeHighlightId ? '● Erasing selected' : '● Erasing all')
            : '○ Eraser'}
        </button>
        {!activeHighlightId && !isErasing && (
          <div style={{ fontSize: 10, color: '#3a3a5a', marginTop: 4 }}>
            Select an overlay to edit, or use eraser on any
          </div>
        )}
      </div>

      {/* Areas */}
      <div style={sectionStyle}>
        {renderCategoryHeader('Areas', areasExpanded, () => setAreasExpanded(v => !v))}
        {areasExpanded && (
          <>
            {areaOverlays.length === 0 && (
              <div style={{ fontSize: 11, color: '#3a3a5a', marginBottom: 4 }}>No area overlays yet</div>
            )}
            {areaOverlays.map(renderOverlayRow)}
            {renderAddButton('+ Add area', handleAddArea)}
          </>
        )}
      </div>

      {/* Edges */}
      <div style={sectionStyle}>
        {renderCategoryHeader('Edges', edgesExpanded, () => setEdgesExpanded(v => !v))}
        {edgesExpanded && (
          <>
            {edgeOverlays.length === 0 && (
              <div style={{ fontSize: 11, color: '#3a3a5a', marginBottom: 4 }}>No edge overlays yet</div>
            )}
            {edgeOverlays.map(renderOverlayRow)}
            {renderAddButton('+ Add edge', handleAddEdge)}
          </>
        )}
      </div>

      {/* Lines */}
      <div style={sectionStyle}>
        {renderCategoryHeader('Lines', linesExpanded, () => setLinesExpanded(v => !v))}
        {linesExpanded && (
          <>
            {lineOverlays.length === 0 && (
              <div style={{ fontSize: 11, color: '#3a3a5a', marginBottom: 4 }}>No line overlays yet</div>
            )}
            {lineOverlays.map(renderOverlayRow)}
            {renderAddButton('+ Add line', handleAddLine)}
          </>
        )}
      </div>

      {/* Icons */}
      <div style={sectionStyle}>
        {renderCategoryHeader('Icons', iconsExpanded, () => setIconsExpanded(v => !v))}
        {iconsExpanded && (
          <>
            {iconOverlays.length === 0 && (
              <div style={{ fontSize: 11, color: '#3a3a5a', marginBottom: 4 }}>No icon overlays yet</div>
            )}
            {iconOverlays.map(overlay => {
              const isActive = activeIconOverlayId === overlay.id
              const isActivePaint = isActive && iconPlaceMode
              return (
                <div
                  key={overlay.id}
                  onClick={() => handleIconRowClick(overlay.id)}
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
                  <IconShapeSwatch
                    shape={overlay.shape}
                    fillColor={overlay.fillColor}
                    strokeColor={overlay.strokeColor}
                    strokeWidth={overlay.strokeWidth}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      color: isActive ? '#d0ecd8' : '#a0a0c0',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {isActivePaint ? '● ' : ''}{overlay.name}
                    </div>
                    <div style={{ fontSize: 10, color: '#4a6a5a' }}>
                      {(placedIcons[overlay.id]?.length ?? 0) > 0
                        ? `${placedIcons[overlay.id].length} icon${placedIcons[overlay.id].length !== 1 ? 's' : ''}`
                        : ''}
                    </div>
                  </div>
                  <button
                    onClick={e => handleIconCog(overlay.id, e)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: openIconFlyoutId === overlay.id ? '#a0c8b0' : '#4a4a6a',
                      cursor: 'pointer',
                      padding: 2,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#a0c8b0')}
                    onMouseLeave={e => (e.currentTarget.style.color = openIconFlyoutId === overlay.id ? '#a0c8b0' : '#4a4a6a')}
                  >
                    <CogIcon />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); deleteIconOverlay(overlay.id) }}
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
            {renderAddButton('+ Add icon', handleAddIcon)}
          </>
        )}
      </div>

      {/* Labels */}
      <div style={sectionStyle}>
        {renderCategoryHeader('Labels', labelsExpanded, () => setLabelsExpanded(v => !v))}
        {labelsExpanded && (
          <>
            {labelOverlays.length === 0 && (
              <div style={{ fontSize: 11, color: '#3a3a5a', marginBottom: 4 }}>No label overlays yet</div>
            )}
            {labelOverlays.map(overlay => {
              const isActive = activeLabelOverlayId === overlay.id
              const tool = useMapStore.getState().activeTool
              const isActivePaint = isActive && tool.type === 'label-place'
              const count = placedLabels[overlay.id]?.length ?? 0
              return (
                <div
                  key={overlay.id}
                  onClick={() => handleLabelRowClick(overlay.id)}
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
                  <LabelSwatch
                    textColor={overlay.textColor}
                    bgColor={overlay.bgColor}
                    strokeColor={overlay.strokeColor}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      color: isActive ? '#d0ecd8' : '#a0a0c0',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {isActivePaint ? '● ' : ''}{overlay.name}
                    </div>
                    <div style={{ fontSize: 10, color: '#4a6a5a' }}>
                      {count > 0 ? `${count} label${count !== 1 ? 's' : ''}` : ''}
                    </div>
                  </div>
                  <button
                    onClick={e => handleLabelCog(overlay.id, e)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: openLabelFlyoutId === overlay.id ? '#a0c8b0' : '#4a4a6a',
                      cursor: 'pointer',
                      padding: 2,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#a0c8b0')}
                    onMouseLeave={e => (e.currentTarget.style.color = openLabelFlyoutId === overlay.id ? '#a0c8b0' : '#4a4a6a')}
                  >
                    <CogIcon />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); deleteLabelOverlay(overlay.id) }}
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
            {renderAddButton('+ Add label', handleAddLabel)}
          </>
        )}
      </div>

      {openHighlight && (
        <HighlightSettingsFlyout
          highlight={openHighlight}
          anchorY={flyoutAnchorY}
          onClose={() => setOpenFlyoutId(null)}
        />
      )}
      {openIconOverlay && (
        <IconSettingsFlyout
          overlay={openIconOverlay}
          anchorY={iconFlyoutAnchorY}
          onClose={() => setOpenIconFlyoutId(null)}
        />
      )}
      {openLabelOverlay && (
        <LabelSettingsFlyout
          overlay={openLabelOverlay}
          anchorY={labelFlyoutAnchorY}
          onClose={() => setOpenLabelFlyoutId(null)}
        />
      )}
    </div>
  )
}
