import { useMapStore } from '../store/mapStore'
import { sidebarStyle, sectionStyle, labelStyle } from './sidebarStyles'

function SliderRow({ label, value, min, max, step, unit, onChange }: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (v: number) => void
}) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontSize: 10, color: '#7a7a9a' }}>{label}</span>
        <span style={{ fontSize: 10, color: '#5a5a7a' }}>{value}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#3a6a9a' }}
      />
    </div>
  )
}

export function ElevationSidebar() {
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
  } = useMapStore()

  const hasData = generatedHexes.some(h => h.elevation_avg_m != null)
  const fetchedCount = generatedHexes.filter(h => h.elevation_avg_m != null).length
  const isLoading = elevationStatus === 'loading'
  const noHexes = generatedHexes.length === 0

  const flatCount = hasData ? generatedHexes.filter(h => h.elevation_class === 'flat').length : 0
  const hillsCount = hasData ? generatedHexes.filter(h => h.elevation_class === 'hills').length : 0
  const mountainsCount = hasData ? generatedHexes.filter(h => h.elevation_class === 'mountains').length : 0
  const pctSum = classificationParams.mountainsPct + classificationParams.hillsPct

  return (
    <div style={sidebarStyle}>

      {/* ── Fetch ── */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Elevation data</div>

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
            {fetchedCount} / {generatedHexes.length} hexes with elevation data
          </div>
        )}
      </div>

      {/* ── Classification ── */}
      {hasData && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Classification</div>

          <div style={{ fontSize: 10, color: '#5a5a7a', marginBottom: 6 }}>By ruggedness (range within hex)</div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: '#8a6a3a', marginBottom: 4 }}>Mountains</div>
            <SliderRow
              label="Top % by range"
              value={classificationParams.mountainsPct}
              min={1} max={50} step={1} unit="%"
              onChange={v => setClassificationParam('mountainsPct', v)}
            />
            <SliderRow
              label="Min range"
              value={classificationParams.mountainsFloorM}
              min={0} max={600} step={10} unit="m"
              onChange={v => setClassificationParam('mountainsFloorM', v)}
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: '#7a8a5a', marginBottom: 4 }}>Hills</div>
            <SliderRow
              label="Next % by range"
              value={classificationParams.hillsPct}
              min={1} max={50} step={1} unit="%"
              onChange={v => setClassificationParam('hillsPct', v)}
            />
            <SliderRow
              label="Min range"
              value={classificationParams.hillsFloorM}
              min={0} max={300} step={5} unit="m"
              onChange={v => setClassificationParam('hillsFloorM', v)}
            />
          </div>

          <div style={{ borderTop: '1px solid #1e1f2e', margin: '10px 0 10px', paddingTop: 10 }}>
            <div style={{ fontSize: 10, color: '#5a5a7a', marginBottom: 6 }}>By height (median) — promotes high plateaus</div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: '#8a6a3a', marginBottom: 4 }}>Mountains</div>
              <SliderRow
                label="Top % by median"
                value={classificationParams.mountainsMedianPct}
                min={1} max={50} step={1} unit="%"
                onChange={v => setClassificationParam('mountainsMedianPct', v)}
              />
              <SliderRow
                label="Min height"
                value={classificationParams.mountainsMedianFloorM}
                min={0} max={3000} step={50} unit="m"
                onChange={v => setClassificationParam('mountainsMedianFloorM', v)}
              />
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: '#7a8a5a', marginBottom: 4 }}>Hills</div>
              <SliderRow
                label="Next % by median"
                value={classificationParams.hillsMedianPct}
                min={1} max={50} step={1} unit="%"
                onChange={v => setClassificationParam('hillsMedianPct', v)}
              />
              <SliderRow
                label="Min height"
                value={classificationParams.hillsMedianFloorM}
                min={0} max={1500} step={25} unit="m"
                onChange={v => setClassificationParam('hillsMedianFloorM', v)}
              />
            </div>
          </div>

          {pctSum > 95 && (
            <div style={{ fontSize: 10, color: '#9e5a5a', marginBottom: 6 }}>
              Mountains + hills exceeds 95% — flat hexes will be scarce
            </div>
          )}

          {/* Count summary */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            gap: 4, fontSize: 10, textAlign: 'center',
          }}>
            {[
              { label: 'Flat', count: flatCount, color: '#5a7a5a' },
              { label: 'Hills', count: hillsCount, color: '#7a8a5a' },
              { label: 'Mtns', count: mountainsCount, color: '#8a6a3a' },
            ].map(({ label, count, color }) => (
              <div key={label} style={{
                background: '#12131e', borderRadius: 3, padding: '4px 2px',
              }}>
                <div style={{ color, marginBottom: 1 }}>{label}</div>
                <div style={{ color: '#5a5a7a' }}>{count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Debug overlay ── */}
      {hasData && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Debug</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showElevationDebug}
              onChange={e => setShowElevationDebug(e.target.checked)}
              style={{ accentColor: '#3a6a9a' }}
            />
            <span>Show avg / max per hex</span>
          </label>
        </div>
      )}

    </div>
  )
}
