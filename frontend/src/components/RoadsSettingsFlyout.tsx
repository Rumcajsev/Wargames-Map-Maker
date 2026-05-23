import { useEffect } from 'react'
import { useMapStore, DEFAULT_ROAD_TIER_STYLES, DEFAULT_RAIL_STYLE } from '../store/mapStore'
import type { RoadDashStyle } from '../store/mapStore'
import { ColorSwatch } from './ColorSwatch'
import { PALETTE_ROAD_SURFACE, PALETTE_ROAD_CASING, PALETTE_RAIL_LIGHT, PALETTE_RAIL_DARK } from '../palettes'

const TIER_LABELS = ['Motorway', 'Primary', 'Secondary'] as const

type Props =
  | { type: 'road'; tier: 0 | 1 | 2; anchorY: number; onClose: () => void }
  | { type: 'rail'; anchorY: number; onClose: () => void }

export function RoadsSettingsFlyout(props: Props) {
  const { type, anchorY, onClose } = props

  const {
    roadTierStyles, setRoadTierStyle,
    railStyle, setRailStyle,
    roadWiggleAmp, roadWiggleFreq, roadPathSmoothing, roadSmoothing,
    roadTierGeometry, setRoadTierGeometry, clearRoadTierGeometry,
    railWiggleAmp, railWiggleFreq, railPathSmoothing, railSmoothing,
    railGeomOverride, setRailGeomOverride, clearRailGeomOverride,
  } = useMapStore()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-roads-flyout]')) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const isRoad = type === 'road'
  const tier = isRoad ? (props as { tier: 0 | 1 | 2 }).tier : null

  const geomOverride = isRoad ? (tier !== null ? roadTierGeometry[tier] : null) : railGeomOverride
  const overrideEnabled = geomOverride !== null

  const globalGeom = isRoad
    ? { wiggleAmp: roadWiggleAmp, wiggleFreq: roadWiggleFreq, pathSmoothing: roadPathSmoothing, smoothing: roadSmoothing }
    : { wiggleAmp: railWiggleAmp, wiggleFreq: railWiggleFreq, pathSmoothing: railPathSmoothing, smoothing: railSmoothing }

  const effectiveGeom = geomOverride ?? globalGeom

  const setGeomField = (field: string, value: number) => {
    if (isRoad && tier !== null) {
      setRoadTierGeometry(tier, { [field]: value } as never)
    } else if (!isRoad) {
      setRailGeomOverride({ [field]: value } as never)
    }
  }

  const toggleOverride = () => {
    if (overrideEnabled) {
      if (isRoad && tier !== null) clearRoadTierGeometry(tier)
      else if (!isRoad) clearRailGeomOverride()
    } else {
      if (isRoad && tier !== null) setRoadTierGeometry(tier, { ...globalGeom })
      else if (!isRoad) setRailGeomOverride({ ...globalGeom })
    }
  }

  const flyoutHeight = type === 'rail' ? 520 : 580
  const top = Math.min(anchorY, window.innerHeight - flyoutHeight - 8)

  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
      <span style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a' }}>{label}</span>
      {value}
    </div>
  )

  const colorRow = (label: string, color: string, palette: readonly string[], onChange: (v: string) => void) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a', marginBottom: 5 }}>{label}</div>
      <ColorSwatch value={color} onChange={onChange} palette={palette} />
    </div>
  )

  const sliderRow = (label: string, field: string, value: number, min: number, max: number, step: number) => (
    <div style={{ opacity: overrideEnabled ? 1 : 0.4, pointerEvents: overrideEnabled ? 'auto' : 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ color: '#6a6a8a', fontSize: 11 }}>{label}</span>
        <span style={{ color: '#5a5a7a', fontSize: 10 }}>{value.toFixed(step < 1 ? 2 : 0)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step}
        value={value}
        onChange={e => setGeomField(field, Number(e.target.value))}
        style={{ width: '100%', accentColor: isRoad ? '#5a9e6f' : '#4a9ab0', cursor: 'pointer', marginBottom: 6 }}
      />
    </div>
  )

  const divider = <div style={{ borderTop: '1px solid #1e1f2e', margin: '10px 0' }} />

  return (
    <div
      data-roads-flyout=""
      style={{
        position: 'fixed',
        left: 204,
        top,
        width: 200,
        background: '#0e0f18',
        border: '1px solid #2a2a4a',
        borderRadius: 4,
        padding: '10px 12px',
        zIndex: 100,
        fontFamily: 'ui-monospace, monospace',
        fontSize: 11,
        color: '#a0a0c0',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ color: '#e0e0f0', letterSpacing: 0.5 }}>
          {isRoad ? TIER_LABELS[tier!] : 'Rail'}
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={() => {
              if (isRoad && tier !== null) setRoadTierStyle(tier, { ...DEFAULT_ROAD_TIER_STYLES[tier] })
              else if (!isRoad) setRailStyle({ ...DEFAULT_RAIL_STYLE })
            }}
            title="Reset visuals to default"
            style={{ background: 'none', border: 'none', color: '#4a4a6a', cursor: 'pointer', padding: '0 2px', fontSize: 12, lineHeight: 1 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#a0a0c0')}
            onMouseLeave={e => (e.currentTarget.style.color = '#4a4a6a')}
          >↺</button>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#4a4a6a', cursor: 'pointer', padding: '0 2px', fontSize: 15, lineHeight: 1 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#a0a0c0')}
            onMouseLeave={e => (e.currentTarget.style.color = '#4a4a6a')}
          >×</button>
        </div>
      </div>

      {isRoad && tier !== null && (() => {
        const s = roadTierStyles[tier]
        const dashRow = (label: string, value: RoadDashStyle, onChange: (v: RoadDashStyle) => void) => (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a', marginBottom: 5 }}>{label}</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['solid', 'dotted'] as const).map(opt => (
                <button
                  key={opt}
                  onClick={() => onChange(opt)}
                  style={{
                    flex: 1, padding: '3px 0', fontSize: 10,
                    background: value === opt ? '#1e2a1e' : 'none',
                    border: `1px solid ${value === opt ? '#4a8a5a' : '#2a2a4a'}`,
                    color: value === opt ? '#90c090' : '#5a5a7a',
                    borderRadius: 3, cursor: 'pointer',
                    fontFamily: 'ui-monospace, monospace',
                  }}
                >{opt}</button>
              ))}
            </div>
          </div>
        )
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div>
              {row('Thickness', <span style={{ color: '#5a5a7a', fontSize: 10 }}>{s.outerW.toFixed(1)}</span>)}
              <input
                type="range" min={0.5} max={10} step={0.5}
                value={s.outerW}
                onChange={e => setRoadTierStyle(tier, { outerW: parseFloat(e.target.value) })}
                style={{ width: '100%', marginBottom: 8 }}
              />
            </div>
            {colorRow('Surface', s.inner, PALETTE_ROAD_SURFACE, v => setRoadTierStyle(tier, { inner: v }))}
            {dashRow('Fill stroke', s.fillDash, v => setRoadTierStyle(tier, { fillDash: v }))}
            {colorRow('Casing', s.outer, PALETTE_ROAD_CASING, v => setRoadTierStyle(tier, { outer: v }))}
            {dashRow('Casing stroke', s.caseDash, v => setRoadTierStyle(tier, { caseDash: v }))}
          </div>
        )
      })()}

      {!isRoad && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a', marginBottom: 4 }}>Style</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['classic', 'cross'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setRailStyle({ railStyle: s })}
                  style={{
                    flex: 1, padding: '3px 0', fontSize: 10,
                    background: railStyle.railStyle === s ? '#1e2a3a' : 'none',
                    border: `1px solid ${railStyle.railStyle === s ? '#4a7aaa' : '#2a2a4a'}`,
                    color: railStyle.railStyle === s ? '#a0c0e0' : '#5a5a7a',
                    borderRadius: 3, cursor: 'pointer',
                    fontFamily: 'ui-monospace, monospace',
                  }}
                >{s}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            {row('Thickness', <span style={{ color: '#5a5a7a', fontSize: 10 }}>{railStyle.thickness.toFixed(1)}</span>)}
            <input
              type="range" min={0.5} max={8} step={0.5}
              value={railStyle.thickness}
              onChange={e => setRailStyle({ thickness: parseFloat(e.target.value) })}
              style={{ width: '100%' }}
            />
          </div>

          {railStyle.railStyle === 'classic' && colorRow('Inner', railStyle.innerColor, PALETTE_RAIL_LIGHT, v => setRailStyle({ innerColor: v }))}
          {colorRow(railStyle.railStyle === 'classic' ? 'Outer' : 'Line', railStyle.outerColor, PALETTE_RAIL_DARK, v => setRailStyle({ outerColor: v }))}
        </div>
      )}

      {divider}

      <div style={{ marginBottom: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={overrideEnabled}
            onChange={toggleOverride}
            style={{ accentColor: isRoad ? '#5a9e6f' : '#4a9ab0', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: overrideEnabled ? '#a0c0a0' : '#4a4a6a' }}>
            {isRoad ? 'Road geometry override' : 'Rail geometry override'}
          </span>
        </label>
      </div>

      {sliderRow('Wiggle amp', 'wiggleAmp', effectiveGeom.wiggleAmp, 0, 1, 0.01)}
      {sliderRow('Wiggle freq', 'wiggleFreq', effectiveGeom.wiggleFreq, 0.5, 10, 0.1)}
      {sliderRow('Path smoothing', 'pathSmoothing', effectiveGeom.pathSmoothing, 0, 50, 1)}
      {sliderRow('Line smoothing', 'smoothing', effectiveGeom.smoothing, 0, 30, 1)}
    </div>
  )
}
