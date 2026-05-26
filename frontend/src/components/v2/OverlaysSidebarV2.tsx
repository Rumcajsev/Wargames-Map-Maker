import { useState } from 'react'
import {
  useMapStore,
  type HexHighlight, type IconOverlay, type LabelOverlay,
} from '../../store/mapStore'
import { TK } from '../../theme'
import {
  SidebarShell, SidebarHeader, SidebarSection, SidebarDetailHeader,
  DetailSection, DetailViewShell, ToggleRow, DashedAddBtn,
  MiniSlider, BigColorSwatch, SegmentedControl, tintBg,
} from './sidebar'

// ── Palette ───────────────────────────────────────────────────────────────────

const OVERLAY_COLOR_GROUPS = [
  { label: 'Blue',    colors: ['#1133aa', '#2244cc', '#3355ee', '#6688dd', '#88aaff'] },
  { label: 'Red',     colors: ['#aa1111', '#cc2222', '#dd4444', '#ee8888'] },
  { label: 'Green',   colors: ['#116622', '#228833', '#44aa55', '#66cc77'] },
  { label: 'Yellow',  colors: ['#aa8800', '#ccaa00', '#eedd22', '#ff9900', '#dd6600'] },
  { label: 'Neutral', colors: ['#ffffff', '#cccccc', '#888888', '#444444', '#000000'] },
  { label: 'Purple',  colors: ['#6622bb', '#8833aa'] },
] as const satisfies { label: string; colors: string[] }[]

// ── Overlay defaults ──────────────────────────────────────────────────────────

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

// ── Swatch SVGs ───────────────────────────────────────────────────────────────

function HighlightSwatch({ h }: { h: HexHighlight }) {
  const color = h.color
  const isLine = h.mode !== 'area'

  if (isLine) {
    const sw = Math.max(0.8, Math.min(h.strokeWidth * 0.45, 3))
    const lp = h.linePattern ?? 'none'
    const lineProps = { stroke: color, strokeWidth: sw, strokeLinecap: 'round' as const }
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
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
        <line x1="1" y1="9" x2="17" y2="9" {...lineProps} />
      </svg>
    )
  }

  const strokeProps = {
    stroke: h.strokeEnabled ? color : TK.line,
    strokeWidth: h.strokeEnabled ? 1.5 : 0.75,
  }
  const patId = `ov2-hatch-${color.replace('#', '')}`
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
  const p = { fill: fillColor, stroke: strokeWidth > 0 ? strokeColor : 'none', strokeWidth: sw }
  if (shape === 'circle') return <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}><circle cx={cx} cy={cy} r={r} {...p} /></svg>
  if (shape === 'square') return <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}><rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} {...p} /></svg>
  if (shape === 'triangle') {
    const s60 = r * Math.sin(Math.PI / 3)
    return <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}><polygon points={`${cx},${cy - r} ${cx - s60},${cy + r * 0.5} ${cx + s60},${cy + r * 0.5}`} {...p} /></svg>
  }
  if (shape === 'diamond') {
    return <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}><polygon points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`} {...p} /></svg>
  }
  const outerR = r, innerR = r * 0.38
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI) / 5 - Math.PI / 2
    const rad = i % 2 === 0 ? outerR : innerR
    return `${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`
  }).join(' ')
  return <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}><polygon points={pts} {...p} /></svg>
}

function LabelSwatch({ textColor, bgColor, strokeColor }: Pick<LabelOverlay, 'textColor' | 'bgColor' | 'strokeColor'>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
      <rect x="1.5" y="4" width="15" height="10" rx="1"
        fill={bgColor === 'transparent' ? 'none' : bgColor}
        stroke={strokeColor} strokeWidth="1.2"
      />
      <text x="9" y="9.5" textAnchor="middle" dominantBaseline="middle"
        fill={textColor} fontSize="6" fontFamily="monospace" fontWeight="bold"
      >Aa</text>
    </svg>
  )
}

// ── OverlayRow ────────────────────────────────────────────────────────────────

function OverlayRow({
  swatch, label, sub, active, onSelect, onCog, onDelete,
}: {
  swatch: React.ReactNode
  label: string
  sub?: string
  active: boolean
  onSelect: () => void
  onCog: () => void
  onDelete: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '20px 1fr auto auto',
        alignItems: 'center',
        gap: 10,
        padding: '7px 12px 7px 10px',
        borderLeft: `2px solid ${active ? TK.rust : 'transparent'}`,
        background: active ? tintBg(TK.rust, 0.08) : 'transparent',
        cursor: 'pointer',
      }}
    >
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{swatch}</div>

      <div style={{ minWidth: 0 }}>
        <div style={{
          fontFamily: TK.sans, fontSize: 12.5,
          fontWeight: active ? 600 : 500,
          color: TK.ink,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {label}
        </div>
        {sub && (
          <div style={{ fontFamily: TK.mono, fontSize: 9.5, color: TK.inkFaint, marginTop: 1 }}>{sub}</div>
        )}
      </div>

      {/* Cog */}
      <button
        onClick={e => { e.stopPropagation(); onCog() }}
        style={{
          width: 20, height: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', cursor: 'pointer',
          color: TK.inkFaint,
          opacity: active || hovered ? 1 : 0,
          padding: 0,
        }}
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3">
          <circle cx="6" cy="6" r="1.8" />
          <path d="M6 0v2M6 10v2M0 6h2M10 6h2M2 2l1.4 1.4M8.6 8.6L10 10M2 10l1.4-1.4M8.6 3.4L10 2" />
        </svg>
      </button>

      {/* Delete */}
      <button
        onClick={e => { e.stopPropagation(); onDelete() }}
        style={{
          width: 20, height: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', cursor: 'pointer',
          color: TK.inkFaint,
          opacity: active || hovered ? 1 : 0,
          padding: 0, fontSize: 14, lineHeight: 1,
        }}
        onMouseEnter={e => (e.currentTarget.style.color = TK.rust)}
        onMouseLeave={e => (e.currentTarget.style.color = TK.inkFaint)}
      >×</button>
    </div>
  )
}

// ── Shared detail-view helpers ────────────────────────────────────────────────

function NameInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ padding: '4px 14px 8px' }}>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: TK.paper, border: `1px solid ${TK.line}`,
          color: TK.ink, fontFamily: TK.sans, fontSize: 12,
          padding: '5px 8px', outline: 'none',
        }}
      />
    </div>
  )
}

function SubLabel({ label }: { label: string }) {
  return (
    <div style={{ padding: '6px 14px 2px', fontFamily: TK.mono, fontSize: 9, letterSpacing: 0.8, color: TK.inkFaint, textTransform: 'uppercase', fontWeight: 600 }}>
      {label}
    </div>
  )
}

function ClearBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div style={{ padding: '2px 14px 6px' }}>
      <button
        onClick={onClick}
        style={{
          width: '100%', padding: '6px 0',
          background: 'none', border: `1px solid ${TK.rust}`,
          color: TK.rust, cursor: 'pointer',
          fontFamily: TK.sans, fontSize: 12,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = tintBg(TK.rust, 0.08) }}
        onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
      >
        {label}
      </button>
    </div>
  )
}

// ── Line pattern picker ───────────────────────────────────────────────────────

type LinePattern = 'none' | 'dotted' | 'dashed' | 'dashdot'

function LinePatternBtn({ pattern, active, onClick }: { pattern: LinePattern; active: boolean; onClick: () => void }) {
  const sw = 1.4
  const color = active ? TK.rust : TK.inkMute
  const lp = { stroke: color, strokeWidth: sw }

  const preview: Record<LinePattern, React.ReactNode> = {
    none: (
      <svg width="32" height="20" viewBox="0 0 32 20">
        <line x1="2" y1="10" x2="30" y2="10" {...lp} strokeLinecap="round" />
      </svg>
    ),
    dotted: (
      <svg width="32" height="20" viewBox="0 0 32 20">
        <line x1="2" y1="10" x2="30" y2="10" {...lp} strokeLinecap="round" strokeDasharray="1.5 3.5" />
      </svg>
    ),
    dashed: (
      <svg width="32" height="20" viewBox="0 0 32 20">
        <line x1="2" y1="10" x2="30" y2="10" {...lp} strokeLinecap="butt" strokeDasharray="5 2.5" />
      </svg>
    ),
    dashdot: (
      <svg width="32" height="20" viewBox="0 0 32 20">
        <line x1="2" y1="10" x2="9" y2="10" {...lp} strokeLinecap="butt" />
        <circle cx="13" cy="10" r="1.5" fill={color} />
        <line x1="17" y1="10" x2="24" y2="10" {...lp} strokeLinecap="butt" />
        <circle cx="28" cy="10" r="1.5" fill={color} />
      </svg>
    ),
  }

  return (
    <button
      onClick={onClick}
      title={pattern}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '2px 4px',
        background: active ? tintBg(TK.rust, 0.1) : 'transparent',
        border: `1px solid ${active ? TK.rust : TK.line}`,
        cursor: 'pointer', flexShrink: 0,
      }}
    >
      {preview[pattern]}
    </button>
  )
}

// ── Shape picker for icons ────────────────────────────────────────────────────

function ShapePreview({ shape }: { shape: IconOverlay['shape'] }) {
  const cx = 18, cy = 18, r = 10
  const p = { fill: TK.inkMute, stroke: TK.line, strokeWidth: 1 }
  if (shape === 'circle') return <svg width="36" height="36" viewBox="0 0 36 36"><circle cx={cx} cy={cy} r={r} {...p} /></svg>
  if (shape === 'square') return <svg width="36" height="36" viewBox="0 0 36 36"><rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} {...p} /></svg>
  if (shape === 'triangle') {
    const s60 = r * Math.sin(Math.PI / 3)
    return <svg width="36" height="36" viewBox="0 0 36 36"><polygon points={`${cx},${cy - r} ${cx - s60},${cy + r * 0.5} ${cx + s60},${cy + r * 0.5}`} {...p} /></svg>
  }
  if (shape === 'diamond') {
    return <svg width="36" height="36" viewBox="0 0 36 36"><polygon points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`} {...p} /></svg>
  }
  const outerR = r, innerR = r * 0.38
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI) / 5 - Math.PI / 2
    const rad = i % 2 === 0 ? outerR : innerR
    return `${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`
  }).join(' ')
  return <svg width="36" height="36" viewBox="0 0 36 36"><polygon points={pts} {...p} /></svg>
}

// ── HighlightDetailView ───────────────────────────────────────────────────────

function HighlightDetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const {
    highlights, updateHighlight,
    clearAllHexHighlights, clearHighlightLine, clearHighlightEdgePath,
  } = useMapStore()

  const h = highlights.find(x => x.id === id)
  if (!h) { onBack(); return null }

  const upd = (changes: Partial<Omit<HexHighlight, 'id'>>) => updateHighlight(id, changes)
  const isArea = h.mode === 'area'
  const fillPattern = h.fillPattern ?? 'none'
  const linePattern = (h.linePattern ?? 'none') as LinePattern
  const s = h.smoothing ?? 0
  const smoothLabel = s < 0.5 ? 'Sharp' : s < 1.5 ? 'Round' : `${Math.round(s - 1)} pass${Math.round(s - 1) !== 1 ? 'es' : ''}`

  return (
    <DetailViewShell header={<SidebarDetailHeader title={h.name} onBack={onBack} />}>

      <DetailSection label="Identity">
        <NameInput value={h.name} onChange={name => upd({ name })} />
        <BigColorSwatch value={h.color} onChange={color => upd({ color })} groups={OVERLAY_COLOR_GROUPS} />
      </DetailSection>

      <DetailSection label="Shape">
        {isArea && (
          <ToggleRow
            label="Join neighbors"
            hint="Only outline the outer border."
            checked={h.joinNeighbors}
            onChange={v => upd({ joinNeighbors: v })}
          />
        )}
        {(!isArea || h.joinNeighbors) && (
          <MiniSlider
            label="Smoothing"
            display={smoothLabel}
            value={s}
            min={0} max={8} step={0.5}
            onChange={v => upd({ smoothing: v })}
          />
        )}
      </DetailSection>

      {isArea && (
        <DetailSection label="Fill">
          <MiniSlider
            label="Opacity"
            display={h.fillOpacity === 0 ? 'off' : `${Math.round(h.fillOpacity * 100)}%`}
            value={Math.round(h.fillOpacity * 100)}
            min={0} max={100} step={10}
            onChange={v => upd({ fillOpacity: v / 100, fillEnabled: v > 0 })}
          />
          {h.fillOpacity > 0 && (
            <>
              <div style={{ padding: '4px 14px' }}>
                <SegmentedControl
                  options={[{ value: 'none', label: 'Solid' }, { value: 'hatched', label: 'Hatched' }]}
                  value={fillPattern}
                  onChange={v => upd({ fillPattern: v as HexHighlight['fillPattern'] })}
                />
              </div>
              {fillPattern === 'hatched' && (
                <MiniSlider
                  label="Spacing"
                  display={`×${(h.fillPatternSpacing ?? 1).toFixed(1)}`}
                  value={h.fillPatternSpacing ?? 1}
                  min={0.3} max={3} step={0.1}
                  onChange={v => upd({ fillPatternSpacing: v })}
                />
              )}
            </>
          )}
        </DetailSection>
      )}

      <DetailSection label="Stroke">
        <MiniSlider
          label="Opacity"
          display={h.strokeOpacity === 0 ? 'off' : `${Math.round(h.strokeOpacity * 100)}%`}
          value={Math.round(h.strokeOpacity * 100)}
          min={0} max={100} step={10}
          onChange={v => upd({ strokeOpacity: v / 100, strokeEnabled: v > 0 })}
        />
        <MiniSlider
          label="Width"
          display={String(h.strokeWidth)}
          value={h.strokeWidth}
          min={1} max={20} step={0.5}
          onChange={v => upd({ strokeWidth: v })}
        />
        <SubLabel label="Pattern" />
        <div style={{ display: 'flex', gap: 4, padding: '0 14px 4px' }}>
          {(['none', 'dotted', 'dashed', 'dashdot'] as const).map(p => (
            <LinePatternBtn key={p} pattern={p} active={linePattern === p} onClick={() => upd({ linePattern: p })} />
          ))}
        </div>
        {linePattern !== 'none' && (
          <MiniSlider
            label="Spacing"
            display={`×${(h.patternSpacing ?? 1).toFixed(1)}`}
            value={h.patternSpacing ?? 1}
            min={0.3} max={3} step={0.1}
            onChange={v => upd({ patternSpacing: v })}
          />
        )}
      </DetailSection>

      <DetailSection label="Data">
        <ClearBtn
          label={isArea ? 'Clear all marked hexes' : 'Clear path'}
          onClick={() => {
            if (isArea) clearAllHexHighlights(id)
            else if (h.mode === 'edge') clearHighlightEdgePath(id)
            else clearHighlightLine(id)
          }}
        />
      </DetailSection>

    </DetailViewShell>
  )
}

// ── IconDetailView ────────────────────────────────────────────────────────────

function IconDetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const { iconOverlays, updateIconOverlay, clearIconOverlay } = useMapStore()

  const o = iconOverlays.find(x => x.id === id)
  if (!o) { onBack(); return null }

  const upd = (changes: Partial<Omit<IconOverlay, 'id'>>) => updateIconOverlay(id, changes)

  return (
    <DetailViewShell header={<SidebarDetailHeader title={o.name} onBack={onBack} />}>

      <DetailSection label="Identity">
        <NameInput value={o.name} onChange={name => upd({ name })} />
      </DetailSection>

      <DetailSection label="Shape">
        <div style={{ display: 'flex', gap: 4, padding: '4px 14px' }}>
          {(['circle', 'square', 'triangle', 'diamond', 'star'] as const).map(shape => (
            <button
              key={shape}
              onClick={() => upd({ shape })}
              title={shape.charAt(0).toUpperCase() + shape.slice(1)}
              style={{
                width: 36, height: 36,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: o.shape === shape ? tintBg(TK.rust, 0.1) : 'transparent',
                border: `1px solid ${o.shape === shape ? TK.rust : TK.line}`,
                cursor: 'pointer', padding: 0, flexShrink: 0,
              }}
            >
              <ShapePreview shape={shape} />
            </button>
          ))}
        </div>
      </DetailSection>

      <DetailSection label="Fill color">
        <BigColorSwatch value={o.fillColor} onChange={v => upd({ fillColor: v })} groups={OVERLAY_COLOR_GROUPS} />
      </DetailSection>

      <DetailSection label="Stroke color">
        <BigColorSwatch value={o.strokeColor} onChange={v => upd({ strokeColor: v })} groups={OVERLAY_COLOR_GROUPS} />
      </DetailSection>

      <DetailSection label="Size">
        <MiniSlider
          label="Size"
          display={`${Math.round(o.size * 100)}%`}
          value={Math.round(o.size * 100)}
          min={10} max={70} step={5}
          onChange={v => upd({ size: v / 100 })}
        />
        <MiniSlider
          label="Stroke width"
          display={String(o.strokeWidth)}
          value={o.strokeWidth}
          min={0} max={8} step={0.5}
          onChange={v => upd({ strokeWidth: v })}
        />
      </DetailSection>

      <DetailSection label="Data">
        <ClearBtn label="Clear all icons" onClick={() => clearIconOverlay(id)} />
      </DetailSection>

    </DetailViewShell>
  )
}

// ── LabelDetailView ───────────────────────────────────────────────────────────

function LabelDetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const { labelOverlays, updateLabelOverlay, clearLabelOverlay } = useMapStore()

  const o = labelOverlays.find(x => x.id === id)
  if (!o) { onBack(); return null }

  const upd = (changes: Partial<Omit<LabelOverlay, 'id'>>) => updateLabelOverlay(id, changes)

  return (
    <DetailViewShell header={<SidebarDetailHeader title={o.name} onBack={onBack} />}>

      <DetailSection label="Identity">
        <NameInput value={o.name} onChange={name => upd({ name })} />
      </DetailSection>

      <DetailSection label="Text color">
        <BigColorSwatch value={o.textColor} onChange={v => upd({ textColor: v })} groups={OVERLAY_COLOR_GROUPS} />
      </DetailSection>

      <DetailSection label="Background">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 14px 2px' }}>
          <button
            onClick={() => upd({ bgColor: 'transparent' })}
            title="Transparent (no background)"
            style={{
              width: 26, height: 26,
              border: o.bgColor === 'transparent' ? `2px solid ${TK.rust}` : `1px solid ${TK.line}`,
              backgroundImage: 'repeating-conic-gradient(#ccc 0% 25%, transparent 0% 50%)',
              backgroundSize: '8px 8px',
              cursor: 'pointer', flexShrink: 0, padding: 0,
              boxShadow: o.bgColor === 'transparent' ? `0 0 0 1.5px ${TK.rust}` : 'none',
            }}
          />
          <span style={{ fontFamily: TK.mono, fontSize: 9.5, color: o.bgColor === 'transparent' ? TK.rust : TK.inkFaint }}>
            transparent
          </span>
        </div>
        <BigColorSwatch
          value={o.bgColor === 'transparent' ? '#aa1111' : o.bgColor}
          onChange={v => upd({ bgColor: v })}
          groups={OVERLAY_COLOR_GROUPS}
        />
      </DetailSection>

      <DetailSection label="Stroke color">
        <BigColorSwatch value={o.strokeColor} onChange={v => upd({ strokeColor: v })} groups={OVERLAY_COLOR_GROUPS} />
      </DetailSection>

      <DetailSection label="Style">
        <MiniSlider label="Text size"    display={`${o.textSize}px`}                  value={o.textSize}             min={1}  max={16}  step={0.5} onChange={v => upd({ textSize: v })} />
        <MiniSlider label="Stroke width" display={String(o.strokeWidth)}              value={o.strokeWidth}          min={0}  max={8}   step={0.5} onChange={v => upd({ strokeWidth: v })} />
        <MiniSlider label="Opacity"      display={`${Math.round(o.opacity * 100)}%`}  value={Math.round(o.opacity * 100)} min={0} max={100} step={5}   onChange={v => upd({ opacity: v / 100 })} />
      </DetailSection>

      <DetailSection label="Data">
        <ClearBtn label="Clear all labels" onClick={() => clearLabelOverlay(id)} />
      </DetailSection>

    </DetailViewShell>
  )
}

// ── OverlaysSidebarV2 ─────────────────────────────────────────────────────────

type ViewId = 'list' | 'highlight-settings' | 'icon-settings' | 'label-settings'

export function OverlaysSidebarV2() {
  const {
    highlights, addHighlight, deleteHighlight,
    activeHighlightId, setActiveHighlightId,
    highlightPaintMode, highlightLineEraser,
    highlightedHexes, highlightLines,
    iconOverlays, placedIcons, addIconOverlay, deleteIconOverlay,
    activeIconOverlayId, iconPlaceMode,
    labelOverlays, placedLabels, addLabelOverlay, deleteLabelOverlay,
    activeLabelOverlayId, activeTool,
    setActiveTool,
  } = useMapStore()

  const [viewId, setViewId] = useState<ViewId>('list')
  const [activeSettingsId, setActiveSettingsId] = useState<string | null>(null)

  const areaOverlays = highlights.filter(h => h.mode === 'area')
  const edgeOverlays = highlights.filter(h => h.mode === 'edge')
  const lineOverlays = highlights.filter(h => h.mode === 'line')

  const isErasing = highlightLineEraser

  const openSettings = (id: string, type: 'highlight' | 'icon' | 'label') => {
    setActiveSettingsId(id)
    setViewId(type === 'icon' ? 'icon-settings' : type === 'label' ? 'label-settings' : 'highlight-settings')
  }

  const goBack = () => { setViewId('list'); setActiveSettingsId(null) }

  const handleEraser = () => {
    if (isErasing) {
      if (activeHighlightId) setActiveTool({ type: 'highlight-paint', id: activeHighlightId })
      else setActiveTool({ type: 'none' })
    } else {
      if (activeHighlightId) setActiveTool({ type: 'highlight-erase', id: activeHighlightId })
      else setActiveTool({ type: 'highlight-erase-any' })
    }
  }

  const handleRowClick = (id: string) => {
    if (activeHighlightId === id && highlightPaintMode) {
      setActiveTool({ type: 'none' })
      setActiveHighlightId(null)
    } else {
      setActiveTool({ type: 'highlight-paint', id })
    }
  }

  const handleIconRowClick = (id: string) => {
    if (activeIconOverlayId === id && iconPlaceMode) setActiveTool({ type: 'none' })
    else setActiveTool({ type: 'icon-place', id })
  }

  const handleLabelRowClick = (id: string) => {
    if (activeLabelOverlayId === id && activeTool.type === 'label-place') setActiveTool({ type: 'none' })
    else setActiveTool({ type: 'label-place', id })
  }

  const handleAddArea  = () => addHighlight({ name: `Area ${areaOverlays.length + 1}`,   color: '#ffcc00', mode: 'area',  ...OVERLAY_DEFAULTS })
  const handleAddEdge  = () => addHighlight({ name: `Edge ${edgeOverlays.length + 1}`,   color: '#44aaff', mode: 'edge',  ...OVERLAY_DEFAULTS, fillEnabled: false })
  const handleAddLine  = () => addHighlight({ name: `Line ${lineOverlays.length + 1}`,   color: '#ff6644', mode: 'line',  ...OVERLAY_DEFAULTS, fillEnabled: false })
  const handleAddIcon  = () => addIconOverlay({ name: `Icon ${iconOverlays.length + 1}`, shape: 'circle', fillColor: '#e05050', strokeColor: '#1a1b2e', strokeWidth: 1.5, size: 0.35 })
  const handleAddLabel = () => addLabelOverlay({ name: `Label ${labelOverlays.length + 1}`, textColor: '#ffffff', bgColor: '#aa1111', strokeColor: '#000000', strokeWidth: 1, textSize: 14, opacity: 1 })

  const highlightSub = (h: HexHighlight) => {
    const count = h.mode !== 'area'
      ? (highlightLines[h.id]?.reduce((sum, seg) => sum + seg.length, 0) ?? 0)
      : Object.values(highlightedHexes).filter(v => v === h.id).length
    if (count === 0) return undefined
    return `${count} hex${count !== 1 ? 'es' : ''}`
  }

  // ── Detail views ──
  if (viewId === 'highlight-settings' && activeSettingsId) return <HighlightDetailView id={activeSettingsId} onBack={goBack} />
  if (viewId === 'icon-settings'      && activeSettingsId) return <IconDetailView      id={activeSettingsId} onBack={goBack} />
  if (viewId === 'label-settings'     && activeSettingsId) return <LabelDetailView     id={activeSettingsId} onBack={goBack} />

  // ── List view ──
  return (
    <SidebarShell>
      <SidebarHeader title="Overlays" />

      {/* ── Tools ── */}
      <SidebarSection label="Tools">
        <div
          onClick={handleEraser}
          style={{
            display: 'grid',
            gridTemplateColumns: '20px 1fr',
            alignItems: 'center',
            gap: 10,
            padding: '7px 12px 7px 10px',
            borderLeft: `2px solid ${isErasing ? TK.rust : 'transparent'}`,
            background: isErasing ? tintBg(TK.rust, 0.08) : 'transparent',
            cursor: 'pointer',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
            stroke={isErasing ? TK.rust : TK.inkMute} strokeWidth="1.4"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M2 14h12M10 2L14 6 6 14 2 10 10 2z" />
          </svg>
          <span style={{ fontFamily: TK.sans, fontSize: 12.5, fontWeight: isErasing ? 600 : 500, color: isErasing ? TK.rust : TK.ink }}>
            Eraser
          </span>
        </div>
      </SidebarSection>

      {/* ── Areas ── */}
      <SidebarSection label="Areas">
        {areaOverlays.map(h => (
          <OverlayRow
            key={h.id}
            swatch={<HighlightSwatch h={h} />}
            label={h.name}
            sub={highlightSub(h)}
            active={activeHighlightId === h.id && highlightPaintMode}
            onSelect={() => handleRowClick(h.id)}
            onCog={() => openSettings(h.id, 'highlight')}
            onDelete={() => deleteHighlight(h.id)}
          />
        ))}
        <DashedAddBtn label="Add area" onClick={handleAddArea} />
      </SidebarSection>

      {/* ── Edges ── */}
      <SidebarSection label="Edges">
        {edgeOverlays.map(h => (
          <OverlayRow
            key={h.id}
            swatch={<HighlightSwatch h={h} />}
            label={h.name}
            sub={highlightSub(h)}
            active={activeHighlightId === h.id && highlightPaintMode}
            onSelect={() => handleRowClick(h.id)}
            onCog={() => openSettings(h.id, 'highlight')}
            onDelete={() => deleteHighlight(h.id)}
          />
        ))}
        <DashedAddBtn label="Add edge" onClick={handleAddEdge} />
      </SidebarSection>

      {/* ── Lines ── */}
      <SidebarSection label="Lines">
        {lineOverlays.map(h => (
          <OverlayRow
            key={h.id}
            swatch={<HighlightSwatch h={h} />}
            label={h.name}
            sub={highlightSub(h)}
            active={activeHighlightId === h.id && highlightPaintMode}
            onSelect={() => handleRowClick(h.id)}
            onCog={() => openSettings(h.id, 'highlight')}
            onDelete={() => deleteHighlight(h.id)}
          />
        ))}
        <DashedAddBtn label="Add line" onClick={handleAddLine} />
      </SidebarSection>

      {/* ── Icons ── */}
      <SidebarSection label="Icons">
        {iconOverlays.map(o => (
          <OverlayRow
            key={o.id}
            swatch={<IconShapeSwatch shape={o.shape} fillColor={o.fillColor} strokeColor={o.strokeColor} strokeWidth={o.strokeWidth} />}
            label={o.name}
            sub={(placedIcons[o.id]?.length ?? 0) > 0 ? `${placedIcons[o.id].length} placed` : undefined}
            active={activeIconOverlayId === o.id && iconPlaceMode}
            onSelect={() => handleIconRowClick(o.id)}
            onCog={() => openSettings(o.id, 'icon')}
            onDelete={() => deleteIconOverlay(o.id)}
          />
        ))}
        <DashedAddBtn label="Add icon" onClick={handleAddIcon} />
      </SidebarSection>

      {/* ── Labels ── */}
      <SidebarSection label="Labels">
        {labelOverlays.map(o => (
          <OverlayRow
            key={o.id}
            swatch={<LabelSwatch textColor={o.textColor} bgColor={o.bgColor} strokeColor={o.strokeColor} />}
            label={o.name}
            sub={(placedLabels[o.id]?.length ?? 0) > 0 ? `${placedLabels[o.id].length} placed` : undefined}
            active={activeLabelOverlayId === o.id && activeTool.type === 'label-place'}
            onSelect={() => handleLabelRowClick(o.id)}
            onCog={() => openSettings(o.id, 'label')}
            onDelete={() => deleteLabelOverlay(o.id)}
          />
        ))}
        <DashedAddBtn label="Add label" onClick={handleAddLabel} />
      </SidebarSection>

    </SidebarShell>
  )
}
