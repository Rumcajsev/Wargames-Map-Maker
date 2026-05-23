import { useMapStore } from '../store/mapStore'
import { sidebarStyle, sectionStyle, labelStyle } from './sidebarStyles'

export function ElevationSidebar() {
  const {
    generatedHexes,
    elevationStatus,
    elevationError,
    elevationProgress,
    showElevationDebug,
    fetchElevation,
    setShowElevationDebug,
  } = useMapStore()

  const hasData = generatedHexes.some(h => h.elevation_class != null)
  const classifiedCount = generatedHexes.filter(h => h.elevation_class != null).length
  const isLoading = elevationStatus === 'loading'
  const noHexes = generatedHexes.length === 0

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
            <div style={{
              height: 2, background: '#1e1f2e', borderRadius: 1, marginBottom: 3,
            }}>
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
            {classifiedCount} / {generatedHexes.length} hexes classified
          </div>
        )}
      </div>

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
