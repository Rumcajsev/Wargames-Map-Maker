/** Shared UI primitives used across sidebars and flyouts. */

import { forwardRef, useState, type ReactNode } from 'react'

// ── SliderRow ────────────────────────────────────────────────────────────────
// Two modes:
//   Numeric: pass min/max/step/onChange → renders <input type="range"> internally
//   Custom:  pass children → renders them as the control

type SliderRowProps = {
  label: string
  value: string | number
  unit?: string
  dim?: boolean
  children?: ReactNode
  min?: number
  max?: number
  step?: number
  onChange?: (v: number) => void
}

export function SliderRow({ label, value, unit = '', dim, children, min, max, step, onChange }: SliderRowProps) {
  return (
    <div style={{ marginBottom: 8, opacity: dim ? 0.35 : 1, transition: 'opacity 0.15s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: '#7a7a9a' }}>{label}</span>
        <span style={{ fontSize: 10, color: '#5a5a7a' }}>{value}{unit}</span>
      </div>
      {onChange !== undefined
        ? <input
            type="range" min={min} max={max} step={step} value={value as number}
            onChange={e => onChange(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#3a6a9a' }}
          />
        : children}
    </div>
  )
}

// ── ResetButton ──────────────────────────────────────────────────────────────
// confirm=true (default): two-step — first click shows "Sure?", second resets
// confirm=false: fires immediately

export function ResetButton({ onReset, confirm = true }: { onReset: () => void; confirm?: boolean }) {
  const [pending, setPending] = useState(false)

  const handleClick = () => {
    if (!confirm) { onReset(); return }
    if (!pending) { setPending(true); return }
    onReset()
    setPending(false)
  }

  return (
    <button
      onClick={handleClick}
      onBlur={() => setPending(false)}
      title="Reset to defaults"
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px',
        fontSize: pending ? 10 : 13, lineHeight: 1, fontFamily: 'ui-monospace, monospace',
        color: pending ? '#c07a4a' : '#4a4a6a',
      }}
      onMouseEnter={e => (e.currentTarget.style.color = pending ? '#e09a6a' : '#a0a0c0')}
      onMouseLeave={e => (e.currentTarget.style.color = pending ? '#c07a4a' : '#4a4a6a')}
    >
      {pending ? 'Sure?' : '↺'}
    </button>
  )
}

// ── SectionLabel ─────────────────────────────────────────────────────────────
// Sidebar section header: uppercase dim label on the left, optional action slot on the right.

export function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div style={{
      fontSize: 10, letterSpacing: 1, color: '#4a4a6a', textTransform: 'uppercase',
      marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <span>{children}</span>
      {action && <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{action}</div>}
    </div>
  )
}

// ── FlyoutContainer ───────────────────────────────────────────────────────────
// Standard flyout panel anchored to the left sidebar. Pass data-* attributes directly.

export const FlyoutContainer = forwardRef<HTMLDivElement, {
  top: number
  width?: number
  scrollable?: boolean
  children: ReactNode
  [key: string]: unknown
}>(({ top, width = 200, scrollable, children, ...rest }, ref) => (
  <div
    ref={ref}
    {...rest as Record<string, unknown>}
    style={{
      position: 'fixed', left: 204, top,
      width, background: '#0e0f18', border: '1px solid #2a2a4a',
      borderRadius: 4, padding: '10px 12px', zIndex: 100,
      fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#a0a0c0',
      boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      ...(scrollable ? { maxHeight: 'calc(100vh - 16px)', overflowY: 'auto' as const } : {}),
    }}
  >
    {children}
  </div>
))
FlyoutContainer.displayName = 'FlyoutContainer'

// ── FlyoutHeader ──────────────────────────────────────────────────────────────
// Standard flyout title row with optional reset button and close ×.

export function FlyoutHeader({
  title, onClose, onReset, confirmReset = false,
}: {
  title: string
  onClose: () => void
  onReset?: () => void
  confirmReset?: boolean
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      <span style={{ color: '#e0e0f0', letterSpacing: 0.5 }}>{title}</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {onReset && <ResetButton onReset={onReset} confirm={confirmReset} />}
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#4a4a6a', cursor: 'pointer', padding: '0 2px', fontSize: 15, lineHeight: 1 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#a0a0c0')}
          onMouseLeave={e => (e.currentTarget.style.color = '#4a4a6a')}
        >×</button>
      </div>
    </div>
  )
}

// ── CheckboxRow ───────────────────────────────────────────────────────────────
// Label + checkbox used for feature toggles in flyouts and sidebars.

export function CheckboxRow({
  label, description, checked, onChange, accentColor = '#5a9e6f',
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  accentColor?: string
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ accentColor, cursor: 'pointer', margin: 0 }}
      />
      <div>
        <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: checked ? '#8a8aaa' : '#4a4a6a' }}>
          {label}
        </div>
        {description && <div style={{ fontSize: 10, color: '#4a4a6a', marginTop: 2 }}>{description}</div>}
      </div>
    </label>
  )
}

// ── EnabledSection ────────────────────────────────────────────────────────────
// Checkbox that gates a block of controls. When enabled, children are shown immediately below.

export function EnabledSection({
  label, enabled, onToggle, accentColor = '#5a9e6f', children,
}: {
  label: string
  enabled: boolean
  onToggle: (enabled: boolean) => void
  accentColor?: string
  children: ReactNode
}) {
  return (
    <div>
      <CheckboxRow label={label} checked={enabled} onChange={onToggle} accentColor={accentColor} />
      {enabled && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  )
}

// ── ToggleButtonGroup ─────────────────────────────────────────────────────────
// Row of mutually-exclusive buttons. accent drives the active border+text color.

export function ToggleButtonGroup<T extends string>({
  options, value, onChange, accent = '#4a7aaa',
}: {
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (v: T) => void
  accent?: string
}) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map(opt => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1, padding: '3px 0', fontSize: 10,
              background: active ? '#1a2030' : 'none',
              border: `1px solid ${active ? accent : '#2a2a4a'}`,
              color: active ? accent : '#5a5a7a',
              borderRadius: 3, cursor: 'pointer',
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
