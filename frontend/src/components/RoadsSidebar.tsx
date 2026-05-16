import { useState } from 'react'
import { useMapStore } from '../store/mapStore'
import { RoadsSettingsFlyout } from './RoadsSettingsFlyout'
import { sidebarStyle, sectionStyle, labelStyle } from './sidebarStyles'

const CogIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.92c.04-.34.07-.68.07-1.08s-.03-.74-.07-1.08l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.34-.07.69-.07 1.08s.03.74.07 1.08L2.7 13.07c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.58 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65z" />
  </svg>
)

const ROAD_TIERS = [
  { tier: 0 as const, label: 'Motorway', color: '#b07820' },
  { tier: 1 as const, label: 'Primary', color: '#8a5c2a' },
  { tier: 2 as const, label: 'Secondary', color: '#606060' },
]

function statusDot(status: string) {
  const color = status === 'done' ? '#5a9e6f' : status === 'loading' ? '#a0a060' : status === 'error' ? '#9e5a5a' : '#3a3a5a'
  return <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
}

type FlyoutKey = `road-${0 | 1 | 2}` | 'rail'

export function RoadsSidebar() {
  const {
    roadPaintMode, roadPaintBrush, roadPaintEraser,
    railPaintMode, railPaintEraser,
    roadNodeEditMode,
    setActiveTool,
    roadBendiness, setRoadBendiness,
    roadsStatus, roadsError,
    railsStatus, railsError,
    fetchRoads, fetchRails,
    clearRoads, clearRails,
  } = useMapStore()

  const [openFlyout, setOpenFlyout] = useState<FlyoutKey | null>(null)
  const [flyoutAnchorY, setFlyoutAnchorY] = useState(0)
  const [hoveredRow, setHoveredRow] = useState<FlyoutKey | null>(null)

  const handleCog = (key: FlyoutKey, y: number) => {
    if (openFlyout === key) {
      setOpenFlyout(null)
    } else {
      setOpenFlyout(key)
      setFlyoutAnchorY(y)
    }
  }

  const selectRoadBrush = (tier: 0 | 1 | 2) => {
    if (roadPaintMode && roadPaintBrush === tier && !roadPaintEraser) {
      setActiveTool({ type: 'none' })
    } else {
      setActiveTool({ type: 'road', tier, erasing: false })
    }
  }

  const selectRoadEraser = () => {
    if (roadPaintMode && roadPaintEraser) {
      setActiveTool({ type: 'none' })
    } else {
      setActiveTool({ type: 'road', tier: roadPaintBrush, erasing: true })
    }
  }

  const selectRailBrush = () => {
    if (railPaintMode && !railPaintEraser) {
      setActiveTool({ type: 'none' })
    } else {
      setActiveTool({ type: 'rail', erasing: false })
    }
  }

  const selectRailEraser = () => {
    if (railPaintMode && railPaintEraser) {
      setActiveTool({ type: 'none' })
    } else {
      setActiveTool({ type: 'rail', erasing: true })
    }
  }

  const btnStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '5px 8px',
    background: active ? '#1a2a1a' : 'none',
    border: `1px solid ${active ? '#4a7a5a' : '#1e1f2e'}`,
    borderRadius: 3,
    cursor: 'pointer',
    fontFamily: 'ui-monospace, monospace',
    fontSize: 11,
    color: active ? '#d0ecd8' : '#6a6a8a',
    textAlign: 'left',
    width: '100%',
  })

  const eraserActive = roadPaintMode && roadPaintEraser
  const railEraserActive = railPaintMode && railPaintEraser
  const railBrushActive = railPaintMode && !railPaintEraser

  const cogBtn = (key: FlyoutKey, title: string) => (
    <button
      data-roads-flyout=""
      onClick={e => { e.stopPropagation(); handleCog(key, e.currentTarget.getBoundingClientRect().top) }}
      title={title}
      style={{
        position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
        background: 'none', border: 'none', color: openFlyout === key ? '#c0c0e0' : '#5a5a8a',
        cursor: 'pointer', padding: '2px 3px', display: 'flex', alignItems: 'center',
        borderRadius: 2, lineHeight: 1,
      }}
      onMouseEnter={e => (e.currentTarget.style.color = '#c0c0e0')}
      onMouseLeave={e => (e.currentTarget.style.color = openFlyout === key ? '#c0c0e0' : '#5a5a8a')}
    >
      <CogIcon />
    </button>
  )

  return (
    <>
      {openFlyout && openFlyout !== 'rail' && (
        <RoadsSettingsFlyout
          type="road"
          tier={parseInt(openFlyout.replace('road-', '')) as 0 | 1 | 2}
          anchorY={flyoutAnchorY}
          onClose={() => setOpenFlyout(null)}
        />
      )}
      {openFlyout === 'rail' && (
        <RoadsSettingsFlyout
          type="rail"
          anchorY={flyoutAnchorY}
          onClose={() => setOpenFlyout(null)}
        />
      )}

      <div style={sidebarStyle}>

        {/* ── Roads paint ── */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Roads</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {ROAD_TIERS.map(({ tier, label, color }) => {
              const active = roadPaintMode && roadPaintBrush === tier && !roadPaintEraser
              const key: FlyoutKey = `road-${tier}`
              return (
                <div
                  key={tier}
                  style={{ position: 'relative' }}
                  onMouseEnter={() => setHoveredRow(key)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <button onClick={() => selectRoadBrush(tier)} style={btnStyle(active)}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, flexShrink: 0, background: color }} />
                    <span style={{ flex: 1 }}>{label}</span>
                  </button>
                  {(hoveredRow === key || openFlyout === key) && cogBtn(key, `${label} settings`)}
                </div>
              )
            })}
            <button onClick={selectRoadEraser} style={btnStyle(eraserActive)}>
              <span style={{ width: 9, height: 9, borderRadius: 2, flexShrink: 0, background: eraserActive ? '#9e5a5a' : '#3a3a5a', border: '1px solid #5a3a3a' }} />
              <span style={{ flex: 1 }}>Eraser</span>
            </button>
          </div>
        </div>

        {/* ── Rails paint ── */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Rails</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div
              style={{ position: 'relative' }}
              onMouseEnter={() => setHoveredRow('rail')}
              onMouseLeave={() => setHoveredRow(null)}
            >
              <button onClick={selectRailBrush} style={btnStyle(railBrushActive)}>
                <span style={{ width: 9, height: 9, borderRadius: 2, flexShrink: 0, background: railBrushActive ? '#6a8aaa' : '#2a3a4a', border: '1px solid #3a5a7a' }} />
                <span style={{ flex: 1 }}>Rail</span>
              </button>
              {(hoveredRow === 'rail' || openFlyout === 'rail') && cogBtn('rail', 'Rail settings')}
            </div>
            <button onClick={selectRailEraser} style={btnStyle(railEraserActive)}>
              <span style={{ width: 9, height: 9, borderRadius: 2, flexShrink: 0, background: railEraserActive ? '#9e5a5a' : '#3a3a5a', border: '1px solid #5a3a3a' }} />
              <span style={{ flex: 1 }}>Eraser</span>
            </button>
          </div>
        </div>

        {/* ── Node edit + bendiness ── */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Geometry</div>
          <button
            onClick={() => setActiveTool(roadNodeEditMode ? { type: 'none' } : { type: 'node-edit' })}
            style={{ ...btnStyle(roadNodeEditMode), width: '100%', marginBottom: 10 }}
          >
            <span style={{
              width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
              background: roadNodeEditMode ? '#d0ecd8' : '#3a3a5a',
              border: `1px solid ${roadNodeEditMode ? '#5a9e6f' : '#4a4a6a'}`,
            }} />
            <span style={{ flex: 1 }}>Edit Nodes</span>
          </button>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ color: '#6a6a8a', fontSize: 11 }}>Bendiness</span>
            <span style={{ color: '#5a5a7a', fontSize: 10 }}>{Math.round(roadBendiness * 100)}%</span>
          </div>
          <input
            type="range" min={0} max={100} step={1}
            value={Math.round(roadBendiness * 100)}
            onChange={e => setRoadBendiness(Number(e.target.value) / 100)}
            style={{ width: '100%', accentColor: '#5a9e6f', cursor: 'pointer' }}
          />
        </div>

        {/* ── OSM fetch ── */}
        <div style={sectionStyle}>
          <div style={labelStyle}>From OSM</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {statusDot(roadsStatus)}
                  <span style={{ color: '#6a6a8a' }}>Roads</span>
                </div>
                {roadsStatus === 'done' && (
                  <button
                    onClick={() => clearRoads()}
                    style={{ background: 'none', border: 'none', color: '#5a3a3a', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit', padding: 0 }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#9e5a5a')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#5a3a3a')}
                  >
                    clear
                  </button>
                )}
              </div>
              <button
                onClick={() => fetchRoads()}
                disabled={roadsStatus === 'loading'}
                style={{
                  width: '100%', padding: '4px 0',
                  background: 'none', border: '1px solid #2a3a2a',
                  color: roadsStatus === 'loading' ? '#3a5a3a' : '#5a8a5a',
                  borderRadius: 3, cursor: roadsStatus === 'loading' ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', fontSize: 11,
                }}
              >
                {roadsStatus === 'loading' ? 'fetching…' : 'Fetch Roads'}
              </button>
              {roadsStatus === 'error' && roadsError && (
                <div style={{ color: '#9e5a5a', fontSize: 10, marginTop: 3 }}>{roadsError}</div>
              )}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {statusDot(railsStatus)}
                  <span style={{ color: '#6a6a8a' }}>Rails</span>
                </div>
                {railsStatus === 'done' && (
                  <button
                    onClick={() => clearRails()}
                    style={{ background: 'none', border: 'none', color: '#5a3a3a', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit', padding: 0 }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#9e5a5a')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#5a3a3a')}
                  >
                    clear
                  </button>
                )}
              </div>
              <button
                onClick={() => fetchRails()}
                disabled={railsStatus === 'loading'}
                style={{
                  width: '100%', padding: '4px 0',
                  background: 'none', border: '1px solid #2a2a3a',
                  color: railsStatus === 'loading' ? '#3a3a5a' : '#5a5a8a',
                  borderRadius: 3, cursor: railsStatus === 'loading' ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', fontSize: 11,
                }}
              >
                {railsStatus === 'loading' ? 'fetching…' : 'Fetch Rails'}
              </button>
              {railsStatus === 'error' && railsError && (
                <div style={{ color: '#9e5a5a', fontSize: 10, marginTop: 3 }}>{railsError}</div>
              )}
            </div>
          </div>
        </div>

      </div>
    </>
  )
}
