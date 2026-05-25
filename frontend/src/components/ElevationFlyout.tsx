import { useEffect } from 'react'
import { useMapStore } from '../store/mapStore'
import { FlyoutContainer, FlyoutHeader, SliderRow, SectionLabel, ResetButton } from './ui'

type HachureKey = 'spacing' | 'length' | 'wobble' | 'jitter' | 'hillWidth' | 'mtnWidth' | 'smoothing'
const HACHURE_DEFAULTS = { spacing: 1.5, length: 10, wobble: 0.5, jitter: 0.05, hillWidth: 0.5, mtnWidth: 1.0, smoothing: 1 }

interface Props {
  anchorY: number
  onClose: () => void
}

export function ElevationFlyout({ anchorY, onClose }: Props) {
  const {
    generatedHexes,
    elevationStatus,
    elevationError,
    elevationProgress,
    showElevationDebug,
    classificationParams,
    fetchElevation,
    setShowElevationDebug,
    setClassificationParam,
    dataSource,
    mapStyle,
    hachureParams,
    setHachureParam,
  } = useMapStore()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-elevation-flyout]')) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const hasData = generatedHexes.some(h => h.elevation_avg_m != null)
  const fetchedCount = generatedHexes.filter(h => h.elevation_avg_m != null).length
  const isLoading = elevationStatus === 'loading'
  const noHexes = generatedHexes.length === 0

  const flatCount = hasData ? generatedHexes.filter(h => h.elevation_class === 'flat').length : 0
  const hillsCount = hasData ? generatedHexes.filter(h => h.elevation_class === 'hills').length : 0
  const mountainsCount = hasData ? generatedHexes.filter(h => h.elevation_class === 'mountains').length : 0
  const pctSum = classificationParams.mountainsPct + classificationParams.hillsPct

  return (
    <FlyoutContainer
      top={Math.min(anchorY, window.innerHeight - 48)}
      scrollable
      width={220}
      data-elevation-flyout=""
    >
      <FlyoutHeader title="Elevation" onClose={onClose} />

      {/* Fetch */}
      {dataSource === 'osm' && (
        <div style={{ marginBottom: 14 }}>
          <button
            onClick={() => fetchElevation()}
            disabled={isLoading || noHexes}
            style={{
              width: '100%', padding: '4px 0', marginBottom: 4,
              background: 'none',
              border: `1px solid ${isLoading ? '#2a2a4a' : '#3a6a9a'}`,
              color: isLoading ? '#3a3a5a' : '#5a9aba',
              borderRadius: 3,
              cursor: isLoading || noHexes ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', fontSize: 11,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <span style={{
              display: 'inline-block', width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: elevationStatus === 'done' ? '#5a9e6f'
                : elevationStatus === 'loading' ? '#a0a060'
                : elevationStatus === 'error' ? '#9e5a5a'
                : '#3a3a5a',
            }} />
            {isLoading ? 'Fetching…' : 'Fetch Elevation'}
          </button>

          {isLoading && elevationProgress && (
            <div style={{ marginBottom: 4 }}>
              <div style={{ height: 2, background: '#1e1f2e', borderRadius: 1, marginBottom: 3 }}>
                <div style={{
                  height: '100%', borderRadius: 1, background: '#3a6a9a',
                  width: `${elevationProgress.progress}%`, transition: 'width 0.2s',
                }} />
              </div>
              <div style={{ fontSize: 10, color: '#4a4a6a' }}>{elevationProgress.message}</div>
            </div>
          )}

          {elevationStatus === 'error' && elevationError && (
            <div style={{ fontSize: 10, color: '#9e5a5a' }}>{elevationError}</div>
          )}

          {elevationStatus === 'done' && (
            <div style={{ fontSize: 10, color: '#4a4a6a' }}>
              {fetchedCount} / {generatedHexes.length} hexes
            </div>
          )}
        </div>
      )}

      {/* Classification */}
      {hasData && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a', marginBottom: 6 }}>
            Classification
          </div>

          <SliderRow label="Mountains %" value={classificationParams.mountainsPct} min={1} max={50} step={1} unit="%" onChange={v => setClassificationParam('mountainsPct', v)} />
          <SliderRow label="Hills %" value={classificationParams.hillsPct} min={1} max={60} step={1} unit="%" onChange={v => setClassificationParam('hillsPct', v)} />
          <SliderRow label="Min ruggedness" value={classificationParams.rangeFloorM} min={0} max={400} step={10} unit="m" onChange={v => setClassificationParam('rangeFloorM', v)} />
          <SliderRow label="Min altitude" value={classificationParams.medianFloorM} min={0} max={2000} step={50} unit="m" onChange={v => setClassificationParam('medianFloorM', v)} />

          {pctSum > 95 && (
            <div style={{ fontSize: 10, color: '#9e5a5a', marginBottom: 6 }}>
              Mountains + hills exceeds 95% — flat hexes will be scarce
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 10, textAlign: 'center' }}>
            {[
              { label: 'Flat', count: flatCount, color: '#5a7a5a' },
              { label: 'Hills', count: hillsCount, color: '#7a8a5a' },
              { label: 'Mtns', count: mountainsCount, color: '#8a6a3a' },
            ].map(({ label, count, color }) => (
              <div key={label} style={{ background: '#12131e', borderRadius: 3, padding: '4px 2px' }}>
                <div style={{ color, marginBottom: 1 }}>{label}</div>
                <div style={{ color: '#5a5a7a' }}>{count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hatching (historical mode only) */}
      {mapStyle === 'historical_simple' && hasData && (
        <div style={{ marginBottom: 14 }}>
          <SectionLabel action={
            <ResetButton onReset={() => {
              for (const [k, v] of Object.entries(HACHURE_DEFAULTS)) setHachureParam(k as HachureKey, v)
            }} />
          }>Hatching</SectionLabel>
          {(
            [
              { key: 'smoothing', label: 'Smoothing',     min: 0,   max: 6,   step: 1,    unit: '' },
              { key: 'spacing',   label: 'Spacing',       min: 0.5, max: 12,  step: 0.5,  unit: 'px' },
              { key: 'length',    label: 'Stroke length', min: 6,   max: 48,  step: 1,    unit: 'px' },
              { key: 'wobble',    label: 'Wobble',        min: 0,   max: 8,   step: 0.25, unit: 'px' },
              { key: 'jitter',    label: 'Angle jitter',  min: 0,   max: 0.6, step: 0.05, unit: 'rad' },
              { key: 'hillWidth', label: 'Hill width',    min: 0.2, max: 3.0, step: 0.1,  unit: 'px' },
              { key: 'mtnWidth',  label: 'Mtn width',     min: 0.2, max: 3.0, step: 0.1,  unit: 'px' },
            ] as { key: HachureKey; label: string; min: number; max: number; step: number; unit: string }[]
          ).map(({ key, label, min, max, step, unit }) => (
            <SliderRow key={key} label={label} value={hachureParams[key]} min={min} max={max} step={step} unit={unit} onChange={v => setHachureParam(key, v)} />
          ))}
        </div>
      )}

      {/* Debug */}
      {hasData && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11 }}>
          <input
            type="checkbox"
            checked={showElevationDebug}
            onChange={e => setShowElevationDebug(e.target.checked)}
            style={{ accentColor: '#3a6a9a' }}
          />
          <span style={{ color: '#6a6a8a' }}>Show avg / max per hex</span>
        </label>
      )}
    </FlyoutContainer>
  )
}
