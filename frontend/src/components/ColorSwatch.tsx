import { useRef } from 'react'

interface Props {
  value: string
  onChange: (color: string) => void
  palette: readonly string[]
}

export function ColorSwatch({ value, onChange, palette }: Props) {
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
              width: 14, height: 14,
              background: color,
              border: active ? '2px solid #fff' : '1px solid rgba(255,255,255,0.15)',
              borderRadius: 2,
              cursor: 'pointer',
              padding: 0,
              boxSizing: 'border-box',
              boxShadow: active ? '0 0 0 1px rgba(0,0,0,0.6)' : 'none',
              flexShrink: 0,
            }}
          />
        )
      })}
      <button
        onClick={() => inputRef.current?.click()}
        title={isCustom ? value : 'Custom color…'}
        style={{
          width: 14, height: 14,
          background: isCustom ? value : 'transparent',
          border: isCustom
            ? '2px solid #fff'
            : '1px dashed #4a4a6a',
          borderRadius: 2,
          cursor: 'pointer',
          padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, color: '#6a6a8a', lineHeight: 1,
          boxSizing: 'border-box',
          boxShadow: isCustom ? '0 0 0 1px rgba(0,0,0,0.6)' : 'none',
          flexShrink: 0,
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
