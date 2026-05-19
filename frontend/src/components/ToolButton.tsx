import { useState } from 'react'

export const CogIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.92c.04-.34.07-.68.07-1.08s-.03-.74-.07-1.08l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.34-.07.69-.07 1.08s.03.74.07 1.08L2.7 13.07c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.58 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65z" />
  </svg>
)

interface ToolButtonProps {
  label: string
  active: boolean
  color: string
  shortcut?: string
  onSelect: () => void
  onSettings?: (anchorY: number) => void
  settingsOpen?: boolean
  extraDot?: boolean
  swatchBorder?: string
  icon?: React.ReactNode
  accentBg?: string
  accentBorder?: string
  accentText?: string
  cogDataAttrib?: string
}

export function ToolButton({
  label, active, color = '#888', shortcut,
  onSelect, onSettings, settingsOpen = false,
  extraDot = false,
  swatchBorder,
  icon,
  accentBg = '#1a2a1a',
  accentBorder = '#4a7a5a',
  accentText = '#d0ecd8',
  cogDataAttrib,
}: ToolButtonProps) {
  const [hovered, setHovered] = useState(false)
  const showCog = hovered && !!onSettings

  // Right padding leaves room for the absolutely-positioned shortcut badge.
  const paddingRight = shortcut ? 26 : 8

  // Cog sits to the left of the badge so they never overlap.
  const cogRight = shortcut ? 22 : 4

  const cogAttribs = cogDataAttrib ? { [cogDataAttrib]: '' } : {}

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        onClick={onSelect}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: `5px 8px`,
          paddingRight,
          background: active ? accentBg : 'none',
          border: `1px solid ${active ? accentBorder : '#1e1f2e'}`,
          borderRadius: 3,
          cursor: 'pointer',
          fontFamily: 'ui-monospace, monospace',
          fontSize: 11,
          color: active ? accentText : '#6a6a8a',
          textAlign: 'left',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {icon ?? <span style={{
          width: 9, height: 9, borderRadius: 2, flexShrink: 0,
          background: color,
          border: swatchBorder,
        }} />}
        <span style={{ flex: 1 }}>{label}</span>
        {extraDot && (
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: color, flexShrink: 0, opacity: 0.8 }} />
        )}
      </button>

      {showCog && (
        <button
          {...cogAttribs}
          onClick={e => { e.stopPropagation(); onSettings!(e.currentTarget.getBoundingClientRect().top) }}
          style={{
            position: 'absolute',
            right: cogRight,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            color: settingsOpen ? '#c0c0e0' : '#5a5a8a',
            cursor: 'pointer',
            padding: '2px 3px',
            display: 'flex',
            alignItems: 'center',
            borderRadius: 2,
            lineHeight: 1,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#c0c0e0')}
          onMouseLeave={e => (e.currentTarget.style.color = settingsOpen ? '#c0c0e0' : '#5a5a8a')}
        >
          <CogIcon />
        </button>
      )}

      {shortcut && (
        <span
          style={{
            position: 'absolute',
            right: 6,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 9,
            color: active ? accentBorder : '#3a3a5a',
            border: `1px solid ${active ? accentBorder : '#2a2a4a'}`,
            borderRadius: 2,
            padding: '1px 3px',
            lineHeight: 1.4,
            pointerEvents: 'none',
          }}
        >
          {shortcut}
        </span>
      )}
    </div>
  )
}
