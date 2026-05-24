import { useEffect } from 'react'
import { useMapStore, DEFAULT_ROAD_TIER_STYLES, DEFAULT_RAIL_STYLE } from '../store/mapStore'
import type { RoadDashStyle } from '../store/mapStore'
import { ColorSwatch } from './ColorSwatch'
import { PALETTE_ROAD_SURFACE, PALETTE_ROAD_CASING, PALETTE_RAIL_LIGHT, PALETTE_RAIL_DARK } from '../palettes'
import { FlyoutContainer, FlyoutHeader, EnabledSection, ToggleButtonGroup } from './ui'

const TIER_LABELS = ['Motorway', 'Primary', 'Secondary'] as const

type Props =
  | { type: 'road'; tier: 0 | 1 | 2; anchorY: number; onClose: () => void }
  | { type: 'rail'; anchorY: number; onClose: () => void }

export function RoadsSettingsFlyout(props: Props) {
  const { type, anchorY, onClose } = props

  const {
    mapStyle,
    roadTierStyles, setRoadTierStyle,
    railStyle, setRailStyle,
    roadWiggleAmp, roadWiggleFreq, roadPathSmoothing, roadSmoothing,
    roadTierGeometry, setRoadTierGeometry, clearRoadTierGeometry,
    railWiggleAmp, railWiggleFreq, railPathSmoothing, railSmoothing,
    railGeomOverride, setRailGeomOverride, clearRailGeomOverride,
  } = useMapStore()

  const isHistorical = mapStyle === 'historical_simple'

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

  const flyoutHeight = type === 'rail' ? 520 : (isHistorical ? 420 : 580)
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
    <div>
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
    <FlyoutContainer top={top} data-roads-flyout="">
      <FlyoutHeader
        title={isRoad ? TIER_LABELS[tier!] : 'Rail'}
        onClose={onClose}
        onReset={() => {
          if (isRoad && tier !== null) setRoadTierStyle(tier, { ...DEFAULT_ROAD_TIER_STYLES[tier] })
          else if (!isRoad) setRailStyle({ ...DEFAULT_RAIL_STYLE })
        }}
      />

      {isRoad && tier !== null && (() => {
        const s = roadTierStyles[tier]
        const dashRow = (label: string, value: RoadDashStyle, onChange: (v: RoadDashStyle) => void) => (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a', marginBottom: 5 }}>{label}</div>
            <ToggleButtonGroup
              options={[{ value: 'solid', label: 'solid' }, { value: 'dashed', label: 'dashed' }, { value: 'dotted', label: 'dotted' }]}
              value={value}
              onChange={onChange}
              accent="#5a9e6f"
            />
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
            {!isHistorical && colorRow('Surface', s.inner, PALETTE_ROAD_SURFACE, v => setRoadTierStyle(tier, { inner: v }))}
            {!isHistorical && dashRow('Fill stroke', s.fillDash, v => setRoadTierStyle(tier, { fillDash: v }))}
            {colorRow(isHistorical ? 'Color' : 'Casing', s.outer, PALETTE_ROAD_CASING, v => setRoadTierStyle(tier, { outer: v }))}
            {dashRow(isHistorical ? 'Line' : 'Casing stroke', s.caseDash, v => setRoadTierStyle(tier, { caseDash: v }))}
          </div>
        )
      })()}

      {!isRoad && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a', marginBottom: 4 }}>Style</div>
            <ToggleButtonGroup
              options={[{ value: 'classic', label: 'classic' }, { value: 'cross', label: 'cross' }]}
              value={railStyle.railStyle}
              onChange={s => setRailStyle({ railStyle: s })}
            />
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

      <EnabledSection
        label={isRoad ? 'Road geometry override' : 'Rail geometry override'}
        enabled={overrideEnabled}
        onToggle={toggleOverride}
        accentColor={isRoad ? '#5a9e6f' : '#4a9ab0'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {sliderRow('Wiggle amp', 'wiggleAmp', effectiveGeom.wiggleAmp, 0, 1, 0.01)}
          {sliderRow('Wiggle freq', 'wiggleFreq', effectiveGeom.wiggleFreq, 0.5, 10, 0.1)}
          {sliderRow('Path smoothing', 'pathSmoothing', effectiveGeom.pathSmoothing, 0, 50, 1)}
          {sliderRow('Line smoothing', 'smoothing', effectiveGeom.smoothing, 0, 30, 1)}
        </div>
      </EnabledSection>
    </FlyoutContainer>
  )
}
