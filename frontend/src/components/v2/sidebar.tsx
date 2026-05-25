import { useRef, useState } from 'react'
import { TK } from '../../theme'

// ── Helpers ──────────────────────────────────────────────────────────────────

export function tintBg(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${opacity})`
}

// ── Shell ─────────────────────────────────────────────────────────────────────

export function SidebarShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      width: TK.sidebarWidth,
      height: '100%',
      overflowY: 'auto',
      overflowX: 'hidden',
      background: TK.surface,
      border: `1px solid ${TK.line}`,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {children}
    </div>
  )
}

// ── Header ────────────────────────────────────────────────────────────────────

export function SidebarHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div style={{ padding: '16px 14px 12px', borderBottom: `1px solid ${TK.line2}`, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: TK.serif, fontSize: 22, fontWeight: 400, color: TK.ink }}>{title}</span>
        {count !== undefined && (
          <span style={{ fontFamily: TK.mono, fontSize: 9.5, color: TK.inkFaint, letterSpacing: 0.8, textTransform: 'uppercase' }}>
            {count} brushes
          </span>
        )}
      </div>
    </div>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────

export function SidebarSection({
  label, sub, action, children,
}: {
  label: string; sub?: string; action?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div style={{ borderTop: `1px solid ${TK.line2}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', padding: '12px 14px 6px', gap: 6 }}>
        <span style={{ fontFamily: TK.mono, fontSize: 9.5, letterSpacing: 1, color: TK.ink2, textTransform: 'uppercase', fontWeight: 600 }}>
          {label}
        </span>
        {sub && <span style={{ fontFamily: TK.mono, fontSize: 9, color: TK.inkFaint }}>· {sub}</span>}
        {action && <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>{action}</div>}
      </div>
      <div style={{ padding: '0 0 10px' }}>
        {children}
      </div>
    </div>
  )
}

// ── BrushRow ──────────────────────────────────────────────────────────────────

interface BrushRowProps {
  label: string
  color: string
  active: boolean
  shortcut?: string
  showCog?: boolean
  cogOpen?: boolean
  onSelect: () => void
  onCog?: (y: number) => void
  cogDataAttr?: string
}

export function BrushRow({ label, color, active, shortcut, showCog, cogOpen, onSelect, onCog, cogDataAttr }: BrushRowProps) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '16px 1fr auto auto',
        alignItems: 'center',
        gap: 10,
        padding: '7px 12px 7px 10px',
        borderLeft: `2px solid ${active ? color : 'transparent'}`,
        background: active ? tintBg(color, 0.18) : 'transparent',
        cursor: 'pointer',
      }}
    >
      {/* Swatch */}
      <div style={{
        width: 14,
        height: 14,
        background: color,
        border: `1px solid rgba(0,0,0,0.18)`,
        flexShrink: 0,
      }} />

      {/* Label */}
      <span style={{
        fontFamily: TK.sans,
        fontSize: 12.5,
        fontWeight: active ? 600 : 500,
        color: TK.ink,
        textTransform: 'capitalize',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>

      {/* Cog */}
      {showCog && (
        <button
          {...(cogDataAttr ? { [cogDataAttr]: '' } : {})}
          onClick={e => { e.stopPropagation(); onCog?.(e.currentTarget.getBoundingClientRect().top) }}
          style={{
            width: 20,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: cogOpen ? TK.rust : TK.inkFaint,
            opacity: active || cogOpen || hovered ? 1 : 0,
            padding: 0,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3">
            <circle cx="6" cy="6" r="1.8" />
            <path d="M6 0v2M6 10v2M0 6h2M10 6h2M2 2l1.4 1.4M8.6 8.6L10 10M2 10l1.4-1.4M8.6 3.4L10 2" />
          </svg>
        </button>
      )}

      {/* Shortcut badge */}
      {shortcut && (
        <span style={{
          fontFamily: TK.mono,
          fontSize: 9.5,
          color: active ? TK.ink : TK.inkFaint,
          padding: '1px 5px',
          borderTop: `1px solid ${active ? 'rgba(0,0,0,0.15)' : TK.line}`,
          borderLeft: `1px solid ${active ? 'rgba(0,0,0,0.15)' : TK.line}`,
          borderRight: `1px solid ${active ? 'rgba(0,0,0,0.15)' : TK.line}`,
          borderBottom: `2px solid ${active ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.18)'}`,
          background: TK.paper,
          minWidth: 16,
          textAlign: 'center',
          display: 'inline-block',
        }}>
          {shortcut}
        </span>
      )}
    </div>
  )
}

// ── ElevBrushRow ──────────────────────────────────────────────────────────────

interface ElevBrushRowProps {
  tier: 0 | 1 | 2
  label: string
  color: string
  active: boolean
  shortcut: string
  onSelect: () => void
}

export function ElevBrushRow({ tier, label, color, active, shortcut, onSelect }: ElevBrushRowProps) {
  return (
    <div
      onClick={onSelect}
      style={{
        display: 'grid',
        gridTemplateColumns: '36px 1fr auto',
        alignItems: 'center',
        gap: 10,
        padding: '6px 12px 6px 10px',
        borderLeft: `2px solid ${active ? color : 'transparent'}`,
        background: active ? tintBg(color, 0.15) : 'transparent',
        cursor: 'pointer',
      }}
    >
      {/* SVG glyph */}
      <svg width="36" height="20" viewBox="0 0 36 20">
        {tier === 0 && <line x1="2" y1="10" x2="34" y2="10" stroke={color} strokeWidth="2" />}
        {tier === 1 && <path d="M2 16 Q8 5 14 9 T26 7 T34 13 L34 18 L2 18 Z" fill={color} stroke="rgba(0,0,0,0.2)" strokeWidth="0.6" />}
        {tier === 2 && <path d="M2 18 L10 4 L18 11 L24 5 L34 18 Z" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" />}
      </svg>

      <span style={{ fontFamily: TK.sans, fontSize: 12.5, fontWeight: active ? 600 : 500, color: TK.ink, textTransform: 'capitalize' }}>
        {label}
      </span>

      <span style={{
        fontFamily: TK.mono, fontSize: 9.5,
        color: active ? TK.ink : TK.inkFaint,
        padding: '1px 5px',
        borderTop: `1px solid ${active ? 'rgba(0,0,0,0.15)' : TK.line}`,
        borderLeft: `1px solid ${active ? 'rgba(0,0,0,0.15)' : TK.line}`,
        borderRight: `1px solid ${active ? 'rgba(0,0,0,0.15)' : TK.line}`,
        borderBottom: `2px solid ${active ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.18)'}`,
        background: TK.paper,
        minWidth: 16,
        textAlign: 'center',
        display: 'inline-block',
      }}>
        {shortcut}
      </span>
    </div>
  )
}

// ── ToggleRow ─────────────────────────────────────────────────────────────────

export function ToggleRow({
  label, hint, checked, onChange,
}: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{ display: 'flex', gap: 10, padding: '5px 14px', cursor: 'pointer', alignItems: 'flex-start' }}
    >
      <div style={{
        width: 14,
        height: 14,
        marginTop: 1,
        flexShrink: 0,
        background: checked ? TK.rust : 'transparent',
        border: `1px solid ${checked ? TK.rust : TK.line}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {checked && (
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none" stroke={TK.surface} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 3.5l2.5 2.5L8 1" />
          </svg>
        )}
      </div>
      <div>
        <div style={{ fontFamily: TK.sans, fontSize: 12, fontWeight: 500, color: TK.ink }}>{label}</div>
        {hint && <div style={{ fontFamily: TK.sans, fontSize: 10.5, color: TK.inkMute, marginTop: 2, lineHeight: 1.5 }}>{hint}</div>}
      </div>
    </div>
  )
}

// ── FlyoutBtn ─────────────────────────────────────────────────────────────────

export function FlyoutBtn({
  label, isOpen, dataAttr, onClick, disabled,
}: {
  label: string; isOpen: boolean; dataAttr?: string; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void; disabled?: boolean
}) {
  return (
    <button
      {...(dataAttr ? { [dataAttr]: '' } : {})}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        padding: '7px 14px',
        background: isOpen ? TK.rustTint : 'transparent',
        border: 'none',
        borderTop: `1px solid ${TK.line2}`,
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: TK.sans,
        fontSize: 12,
        color: disabled ? TK.inkFaint : isOpen ? TK.rust : TK.ink2,
        textAlign: 'left',
      }}
    >
      <span>{label}</span>
      <span style={{ fontFamily: TK.mono, fontSize: 10, color: TK.inkFaint }}>›</span>
    </button>
  )
}

// ── DashedAddBtn ──────────────────────────────────────────────────────────────

export function DashedAddBtn({ label, onClick, dataAttr }: { label: string; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void; dataAttr?: string }) {
  return (
    <button
      {...(dataAttr ? { [dataAttr]: '' } : {})}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        margin: '4px 10px',
        padding: '7px 12px',
        width: 'calc(100% - 20px)',
        background: 'transparent',
        border: `1px dashed ${TK.line}`,
        cursor: 'pointer',
        fontFamily: TK.sans,
        fontSize: 11,
        fontWeight: 400,
        color: TK.inkFaint,
      }}
    >
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M6 1v10M1 6h10" />
      </svg>
      {label}
    </button>
  )
}

// ── SectionDivider ────────────────────────────────────────────────────────────

export function SectionDivider() {
  return <div style={{ height: 1, background: TK.line2, margin: '4px 0' }} />
}

// ── SidebarDetailHeader ───────────────────────────────────────────────────────

export function SidebarDetailHeader({
  title, onBack, status, onReset,
}: {
  title: string
  onBack: () => void
  status?: 'default' | 'modified'
  onReset?: () => void
}) {
  return (
    <div style={{
      padding: '10px 14px',
      borderBottom: `1px solid ${TK.line2}`,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    }}>
      <button
        onClick={onBack}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'none', border: 'none', cursor: 'pointer',
          color: TK.inkMute, padding: 0, flexShrink: 0,
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2L3 5l3 3" />
        </svg>
        <span style={{ fontFamily: TK.mono, fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase' }}>Back</span>
      </button>
      <div style={{ width: 1, height: 12, background: TK.line }} />
      <span style={{
        fontFamily: TK.serif, fontSize: 18, fontWeight: 400, color: TK.ink,
        textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        flex: 1,
      }}>
        {title}
      </span>
      {status && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{
            fontFamily: TK.mono, fontSize: 8.5, letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: 600,
            color: status === 'modified' ? TK.rust : TK.inkFaint,
          }}>
            {status}
          </span>
          {status === 'modified' && onReset && (
            <button
              onClick={onReset}
              title="Reset to defaults"
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                color: TK.inkMute, display: 'flex', alignItems: 'center',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 4a5 5 0 1 1 .9 4.5" /><path d="M1 1v3h3" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── DetailViewShell ───────────────────────────────────────────────────────────

export function DetailViewShell({ header, children }: { header: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{
      width: TK.sidebarWidth,
      height: '100%',
      overflow: 'hidden',
      background: TK.surface,
      border: `1px solid ${TK.line}`,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {header}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}

// ── ToggleSwitch ──────────────────────────────────────────────────────────────

export function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      style={{
        width: 30, height: 16, flexShrink: 0,
        background: enabled ? TK.ink : TK.line,
        border: 'none', cursor: 'pointer', padding: 0,
        position: 'relative',
      }}
    >
      <div style={{
        position: 'absolute',
        top: 3, left: enabled ? 15 : 3,
        width: 10, height: 10,
        background: TK.surface,
        transition: 'left 0.12s ease',
      }} />
    </button>
  )
}

// ── DetailSection ─────────────────────────────────────────────────────────────

export function DetailSection({
  label, hint, children, toggle, action, preview,
}: {
  label: string
  hint?: string
  children: React.ReactNode
  toggle?: { enabled: boolean; onChange: (v: boolean) => void }
  action?: React.ReactNode
  preview?: React.ReactNode
}) {
  return (
    <div style={{ borderTop: `1px solid ${TK.line2}` }}>
      <div style={{
        position: 'sticky', top: 0, zIndex: 1,
        background: TK.paper2,
        borderBottom: `1px solid ${TK.line2}`,
        ...(preview ? { position: 'relative' as const } : {}),
      }}>
        {/* When there's a preview, it fills the header area and the label is overlaid */}
        {preview && <div>{preview}</div>}
        <div style={{
          padding: '10px 14px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          ...(preview ? { position: 'absolute' as const, top: 0, left: 0, right: 0 } : {}),
        }}>
          <span style={{
            fontFamily: TK.mono, fontSize: 9.5, letterSpacing: 1, fontWeight: 600,
            textTransform: 'uppercase',
            color: toggle && !toggle.enabled ? TK.inkFaint : TK.ink2,
          }}>
            {label}
          </span>
          {action}
          {toggle && <ToggleSwitch enabled={toggle.enabled} onChange={toggle.onChange} />}
        </div>
        {hint && !preview && (
          <div style={{ padding: '0 14px 8px', fontFamily: TK.sans, fontSize: 11, color: TK.inkMute, lineHeight: 1.4 }}>
            {hint}
          </div>
        )}
      </div>
      {(!toggle || toggle.enabled) && (
        <div style={{ padding: '8px 0 16px', background: TK.surface }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ── MiniSlider ────────────────────────────────────────────────────────────────

export function MiniSlider({
  label, display, value, min, max, step, onChange, disabled, accentColor,
}: {
  label: React.ReactNode; display: string | number; value: number;
  min: number; max: number; step: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  accentColor?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const fillColor = accentColor ?? TK.ink

  const compute = (clientX: number) => {
    const el = trackRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const t = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const raw = min + t * (max - min)
    const snapped = Math.round(raw / step) * step
    onChange(parseFloat(Math.max(min, Math.min(max, snapped)).toFixed(10)))
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 14px', opacity: disabled ? 0.4 : 1 }}>
      <span style={{ fontFamily: TK.sans, fontSize: 11, color: TK.ink2, flexShrink: 0, width: 96 }}>{label}</span>
      <div
        onPointerDown={e => { if (disabled) return; e.currentTarget.setPointerCapture(e.pointerId); compute(e.clientX) }}
        onPointerMove={e => { if (disabled || e.buttons === 0) return; compute(e.clientX) }}
        style={{ flex: 1, padding: '6px 0', cursor: disabled ? 'default' : 'ew-resize', userSelect: 'none', touchAction: 'none' }}
      >
        <div ref={trackRef} style={{ position: 'relative', height: 2, background: TK.line }}>
          <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${pct * 100}%`, background: fillColor }} />
          <div style={{
            position: 'absolute', top: '50%', left: `${pct * 100}%`,
            transform: 'translate(-50%, -50%)',
            width: 12, height: 12,
            background: TK.surface,
            border: `1.5px solid ${fillColor}`,
          }} />
        </div>
      </div>
      <span style={{ fontFamily: TK.mono, fontSize: 10.5, color: TK.inkMute, flexShrink: 0, width: 34, textAlign: 'right' }}>{display}</span>
    </div>
  )
}

// ── BigColorSwatch ────────────────────────────────────────────────────────────

type ColorGroup = { label: string; colors: readonly string[] }

function SwatchBtn({ color, active, onClick }: { color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={color}
      style={{
        width: 26, height: 26,
        background: color,
        border: active ? `2px solid ${TK.paper}` : `1px solid rgba(0,0,0,0.14)`,
        cursor: 'pointer',
        padding: 0,
        flexShrink: 0,
        boxSizing: 'border-box',
        boxShadow: active ? `0 0 0 1.5px ${TK.ink}` : 'none',
        outline: 'none',
      }}
    />
  )
}

export function BigColorSwatch({
  value, onChange, groups,
}: {
  value: string
  onChange: (color: string) => void
  groups: readonly ColorGroup[]
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const norm = (c: string) => c.toLowerCase()
  const paletteColors = groups.flatMap(g => g.colors)

  const [customColors, setCustomColors] = useState<string[]>(() => {
    // Seed with current value if it's already custom
    return paletteColors.some(c => norm(c) === norm(value)) ? [] : [value]
  })

  const handleCustomPick = (color: string) => {
    // If it matches a palette color, just select it without adding to custom list
    if (paletteColors.some(c => norm(c) === norm(color))) {
      onChange(color)
      return
    }
    setCustomColors(prev =>
      prev.some(c => norm(c) === norm(color)) ? prev : [...prev, color]
    )
    onChange(color)
  }

  return (
    <div style={{ padding: '2px 14px 8px' }}>
      {/* Grouped rows */}
      {groups.map(group => (
        <div key={group.label} style={{ marginBottom: 4 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {group.colors.map(color => (
              <SwatchBtn
                key={color}
                color={color}
                active={norm(color) === norm(value)}
                onClick={() => onChange(color)}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Custom colors + add button */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
        {customColors.map(color => (
          <SwatchBtn
            key={color}
            color={color}
            active={norm(color) === norm(value)}
            onClick={() => onChange(color)}
          />
        ))}
        <button
          onClick={() => inputRef.current?.click()}
          title="Custom color…"
          style={{
            width: 26, height: 26,
            background: 'transparent',
            border: `1px dashed ${TK.ink2}`,
            cursor: 'pointer',
            padding: 0,
            flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxSizing: 'border-box',
            outline: 'none',
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke={TK.ink2} strokeWidth="1.4" strokeLinecap="round">
            <path d="M5 1v8M1 5h8" />
          </svg>
        </button>
      </div>

      <input
        ref={inputRef}
        type="color"
        value={value}
        onChange={e => handleCustomPick(e.target.value)}
        style={{ position: 'fixed', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
      />
    </div>
  )
}

// ── InlineColorSwatch ─────────────────────────────────────────────────────────

export function InlineColorSwatch({
  value, onChange, palette,
}: {
  value: string
  onChange: (color: string) => void
  palette: readonly string[]
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const norm = (c: string) => c.toLowerCase()
  const isCustom = !palette.some(c => norm(c) === norm(value))

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center' }}>
      {palette.map(color => {
        const active = norm(color) === norm(value)
        return (
          <button
            key={color}
            onClick={() => onChange(color)}
            title={color}
            style={{
              width: 18, height: 18,
              background: color,
              border: `1px solid rgba(0,0,0,0.12)`,
              cursor: 'pointer', padding: 0, flexShrink: 0,
              boxSizing: 'border-box',
              boxShadow: active ? `0 0 0 2px ${TK.surface}, 0 0 0 3.5px ${TK.ink}` : 'none',
              outline: 'none',
            }}
          />
        )
      })}
      <button
        onClick={() => inputRef.current?.click()}
        title={isCustom ? value : 'Custom…'}
        style={{
          width: 18, height: 18,
          background: isCustom ? value : 'transparent',
          border: isCustom ? `1px solid rgba(0,0,0,0.12)` : `1px dashed ${TK.line}`,
          cursor: 'pointer', padding: 0, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: TK.mono, fontSize: 10, color: TK.inkFaint,
          boxSizing: 'border-box',
          boxShadow: isCustom ? `0 0 0 2px ${TK.surface}, 0 0 0 3.5px ${TK.ink}` : 'none',
          outline: 'none',
        }}
      >
        {!isCustom && '+'}
      </button>
      <input
        ref={inputRef}
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ position: 'fixed', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
      />
    </div>
  )
}

// ── SegmentedControl ──────────────────────────────────────────────────────────

export function SegmentedControl<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div style={{ display: 'flex' }}>
      {options.map((opt, i) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            flex: 1,
            padding: '4px 0',
            fontFamily: TK.mono, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase',
            background: value === opt.value ? TK.ink : 'transparent',
            color: value === opt.value ? TK.surface : TK.inkMute,
            border: `1px solid ${value === opt.value ? TK.ink : TK.line}`,
            marginLeft: i > 0 ? -1 : 0,
            cursor: 'pointer',
            position: 'relative',
            zIndex: value === opt.value ? 1 : 0,
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
