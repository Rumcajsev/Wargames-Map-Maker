import { useState, useEffect } from 'react'
import { useMapStore } from '../store/mapStore'
import { RoadsSettingsFlyout } from './RoadsSettingsFlyout'
import { sidebarStyle, sectionStyle, labelStyle } from './sidebarStyles'
import { ToolButton } from './ToolButton'

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

function RoadSegmentPanel({ selectedKeys, segmentProps, accentColor, globalWiggleAmp, globalWiggleFreq, setProp, clearProp, setSelectedKeys }: {
  selectedKeys: string[]
  segmentProps: Record<string, { wiggleAmp?: number; wiggleFreq?: number }>
  accentColor: string
  globalWiggleAmp: number
  globalWiggleFreq: number
  setProp: (key: string, prop: { wiggleAmp?: number; wiggleFreq?: number }) => void
  clearProp: (key: string) => void
  setSelectedKeys: (keys: string[]) => void
}) {
  if (selectedKeys.length === 0) return null
  const firstProps = segmentProps[selectedKeys[0]]
  const ampVal = firstProps?.wiggleAmp ?? globalWiggleAmp
  const freqVal = firstProps?.wiggleFreq ?? globalWiggleFreq
  const anyAmpOverride = selectedKeys.some(k => segmentProps[k]?.wiggleAmp !== undefined)
  const anyFreqOverride = selectedKeys.some(k => segmentProps[k]?.wiggleFreq !== undefined)
  const hasOverride = anyAmpOverride || anyFreqOverride
  return (
    <div style={sectionStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <div style={labelStyle}>Segment{hasOverride ? ' ●' : ''}</div>
        <button onClick={() => setSelectedKeys([])}
          style={{ background: 'none', border: 'none', color: '#4a4a6a', cursor: 'pointer', fontSize: 11, padding: 0 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#a0a0c0')}
          onMouseLeave={e => (e.currentTarget.style.color = '#4a4a6a')}
        >✕</button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11 }}>Wiggle amp</span>
        <span style={{ color: '#5a5a7a', fontSize: 10 }}>{anyAmpOverride ? `${(ampVal * 100).toFixed(0)}% ●` : `${(ampVal * 100).toFixed(0)}%`}</span>
      </div>
      <input type="range" min={0} max={100} step={1}
        value={Math.round(ampVal * 100)}
        onChange={e => { const v = Number(e.target.value) / 100; for (const k of selectedKeys) setProp(k, { wiggleAmp: v }) }}
        style={{ width: '100%', accentColor, marginBottom: 6 }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11 }}>Wiggle freq</span>
        <span style={{ color: '#5a5a7a', fontSize: 10 }}>{anyFreqOverride ? `${freqVal.toFixed(1)} ●` : freqVal.toFixed(1)}</span>
      </div>
      <input type="range" min={5} max={100} step={1}
        value={Math.round(freqVal * 10)}
        onChange={e => { const v = Number(e.target.value) / 10; for (const k of selectedKeys) setProp(k, { wiggleFreq: v }) }}
        style={{ width: '100%', accentColor, marginBottom: 6 }}
      />
      {hasOverride && (
        <button
          onClick={() => { for (const k of selectedKeys) clearProp(k); setSelectedKeys([]) }}
          style={{ marginTop: 2, width: '100%', padding: '3px 0', background: 'none',
            border: '1px solid #1e1f2e', borderRadius: 3, color: '#4a4a6a',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 10 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#9e5a5a')}
          onMouseLeave={e => (e.currentTarget.style.color = '#4a4a6a')}
        >Reset to default</button>
      )}
    </div>
  )
}

function RoadHopPanel({ selectedHopKey, hopProps, accentColor, defaultAmp, defaultFreq, setProp, clearProp, setSelectedHopKey }: {
  selectedHopKey: string
  hopProps: Record<string, { wiggleAmp?: number; wiggleFreq?: number }>
  accentColor: string
  defaultAmp: number
  defaultFreq: number
  setProp: (key: string, prop: { wiggleAmp?: number; wiggleFreq?: number }) => void
  clearProp: (key: string) => void
  setSelectedHopKey: (key: string | null) => void
}) {
  const hp = hopProps[selectedHopKey] ?? {}
  const ampVal = hp.wiggleAmp ?? defaultAmp
  const freqVal = hp.wiggleFreq ?? defaultFreq
  const hasOverride = !!hopProps[selectedHopKey]
  return (
    <div style={{ ...sectionStyle, borderColor: 'rgba(255,200,50,0.3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <div style={{ ...labelStyle, color: 'rgba(255,200,50,0.8)' }}>Hop{hasOverride ? ' ●' : ''}</div>
        <button onClick={() => setSelectedHopKey(null)}
          style={{ background: 'none', border: 'none', color: '#4a4a6a', cursor: 'pointer', fontSize: 11, padding: 0 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#a0a0c0')}
          onMouseLeave={e => (e.currentTarget.style.color = '#4a4a6a')}
        >✕</button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11 }}>Wiggle amp</span>
        <span style={{ color: '#5a5a7a', fontSize: 10 }}>{hp.wiggleAmp !== undefined ? `${(ampVal * 100).toFixed(0)}% ●` : `${(ampVal * 100).toFixed(0)}%`}</span>
      </div>
      <input type="range" min={0} max={100} step={1}
        value={Math.round(ampVal * 100)}
        onChange={e => setProp(selectedHopKey, { wiggleAmp: Number(e.target.value) / 100 })}
        style={{ width: '100%', accentColor, marginBottom: 6 }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11 }}>Wiggle freq</span>
        <span style={{ color: '#5a5a7a', fontSize: 10 }}>{hp.wiggleFreq !== undefined ? `${freqVal.toFixed(1)} ●` : freqVal.toFixed(1)}</span>
      </div>
      <input type="range" min={5} max={100} step={1}
        value={Math.round(freqVal * 10)}
        onChange={e => setProp(selectedHopKey, { wiggleFreq: Number(e.target.value) / 10 })}
        style={{ width: '100%', accentColor, marginBottom: 6 }}
      />
      {hasOverride && (
        <button
          onClick={() => clearProp(selectedHopKey)}
          style={{ marginTop: 2, width: '100%', padding: '3px 0', background: 'none',
            border: '1px solid #1e1f2e', borderRadius: 3, color: '#4a4a6a',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 10 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#9e5a5a')}
          onMouseLeave={e => (e.currentTarget.style.color = '#4a4a6a')}
        >Reset hop</button>
      )}
    </div>
  )
}

export function RoadsSidebar() {
  const {
    roadPaintMode, roadPaintBrush, roadPaintEraser,
    railPaintMode, railPaintEraser,
    roadNodeEditMode,
    setActiveTool,
    roadWiggleAmp, setRoadWiggleAmp, setRoadWiggleDragging,
    roadWiggleFreq, setRoadWiggleFreq,
    roadSmoothing, setRoadSmoothing,
    roadPathSmoothing, setRoadPathSmoothing,
    roadsStatus, roadsError,
    railsStatus, railsError,
    fetchRoads, fetchRails,
    clearRoads, clearRails,
    motorwayHexes, motorwayHexesStatus, motorwayHexesError,
    motorwayHexesFast, setMotorwayHexesFast,
    fetchMotorwayHexes, applyMotorwayHexes, clearMotorwayHexes,
    showRawOsmRoads, setShowRawOsmRoads,
    osmHexPaths, osmHighlightTier, setOsmHighlightTier, applyOsmTier,
    osmSpotlightMode, osmSpotlightRadius, osmSpotlightTiers,
    setOsmSpotlightMode, setOsmSpotlightRadius, setOsmSpotlightTiers,
    osmRailHexPaths, osmRailHighlight, setOsmRailHighlight, applyOsmRails,
    roadDensityMinChain, setRoadDensityMinChain,
    roadSelectMode, roadSegmentProps, roadHopProps,
    selectedRoadSegmentKeys, setSelectedRoadSegmentKeys, toggleRoadSegmentSelection,
    selectedRoadHopKey, setSelectedRoadHopKey,
    setRoadSegmentProp, clearRoadSegmentProp, setRoadHopProp, clearRoadHopProp,
    railNodeEditMode,
    railWiggleAmp, setRailWiggleAmp, setRailWiggleDragging,
    railWiggleFreq, setRailWiggleFreq,
    railSmoothing, setRailSmoothing,
    railSelectMode, railSegmentProps, railHopProps,
    selectedRailSegmentKeys, setSelectedRailSegmentKeys, toggleRailSegmentSelection,
    selectedRailHopKey, setSelectedRailHopKey,
    setRailSegmentProp, clearRailSegmentProp, setRailHopProp, clearRailHopProp,
  } = useMapStore()

  const [openFlyout, setOpenFlyout] = useState<FlyoutKey | null>(null)
  const [flyoutAnchorY, setFlyoutAnchorY] = useState(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (e.key === '1') selectRoadBrush(0)
      else if (e.key === '2') selectRoadBrush(1)
      else if (e.key === '3') selectRoadBrush(2)
      else if (e.key === 'e' || e.key === 'E') selectRoadEraser()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roadPaintMode, roadPaintBrush, roadPaintEraser])

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

  const eraserActive = roadPaintMode && roadPaintEraser
  const railEraserActive = railPaintMode && railPaintEraser
  const railBrushActive = railPaintMode && !railPaintEraser

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
            {ROAD_TIERS.map(({ tier, label, color }) => (
              <ToolButton
                key={tier}
                label={label}
                active={roadPaintMode && roadPaintBrush === tier && !roadPaintEraser}
                color={color}
                shortcut={String(tier + 1)}
                onSelect={() => selectRoadBrush(tier)}
                onSettings={(y) => handleCog(`road-${tier}`, y)}
                settingsOpen={openFlyout === `road-${tier}`}
                cogDataAttrib="data-roads-flyout"
              />
            ))}
            <ToolButton
              label="Eraser"
              active={eraserActive}
              color={eraserActive ? '#9e5a5a' : '#3a3a5a'}
              swatchBorder="1px solid #5a3a3a"
              shortcut="E"
              onSelect={selectRoadEraser}
              accentBg="#2a1a1a"
              accentBorder="#7a4a4a"
              accentText="#e0b0b0"
            />
          </div>
        </div>

        {/* ── Rails paint ── */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Rails</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <ToolButton
              label="Rail"
              active={railBrushActive}
              color={railBrushActive ? '#6a8aaa' : '#2a3a4a'}
              swatchBorder="1px solid #3a5a7a"
              onSelect={selectRailBrush}
              onSettings={(y) => handleCog('rail', y)}
              settingsOpen={openFlyout === 'rail'}
              cogDataAttrib="data-roads-flyout"
            />
            <ToolButton
              label="Eraser"
              active={railEraserActive}
              color={railEraserActive ? '#9e5a5a' : '#3a3a5a'}
              swatchBorder="1px solid #5a3a3a"
              onSelect={selectRailEraser}
              accentBg="#2a1a1a"
              accentBorder="#7a4a4a"
              accentText="#e0b0b0"
            />
          </div>
        </div>

        {/* ── Node edit + bendiness ── */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Road Geometry</div>
          <ToolButton
            label="Edit Nodes"
            active={roadNodeEditMode}
            color={roadNodeEditMode ? '#d0ecd8' : '#3a3a5a'}
            swatchBorder={`1px solid ${roadNodeEditMode ? '#5a9e6f' : '#4a4a6a'}`}
            onSelect={() => setActiveTool(roadNodeEditMode ? { type: 'none' } : { type: 'node-edit' })}
          />
          <div style={{ marginBottom: 10, marginTop: 4 }}>
            <ToolButton
              label="Select segment"
              active={roadSelectMode}
              color={roadSelectMode ? '#d0c8f0' : '#3a3a5a'}
              swatchBorder={`1px solid ${roadSelectMode ? '#7a6ab0' : '#4a4a6a'}`}
              onSelect={() => setActiveTool(roadSelectMode ? { type: 'none' } : { type: 'road-select' })}
              accentBg="#1a1a2a"
              accentBorder="#7a6ab0"
              accentText="#d0c8f0"
            />
          </div>
          {roadSelectMode && <div style={{ color: '#4a6a8a', fontSize: 10, marginTop: -6, marginBottom: 10, lineHeight: 1.5 }}>Click a road to select. Cmd+click to pick a hop. Right-click to exit.</div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ color: '#6a6a8a', fontSize: 11 }}>Wiggle amp</span>
            <span style={{ color: '#5a5a7a', fontSize: 10 }}>{roadWiggleAmp.toFixed(2)}</span>
          </div>
          <input
            type="range" min={0} max={1} step={0.01}
            value={roadWiggleAmp}
            onPointerDown={() => setRoadWiggleDragging(true)}
            onPointerUp={() => setRoadWiggleDragging(false)}
            onChange={e => setRoadWiggleAmp(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#5a9e6f', cursor: 'pointer', marginBottom: 6 }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ color: '#6a6a8a', fontSize: 11 }}>Wiggle freq</span>
            <span style={{ color: '#5a5a7a', fontSize: 10 }}>{roadWiggleFreq.toFixed(1)}</span>
          </div>
          <input
            type="range" min={0.5} max={10} step={0.1}
            value={roadWiggleFreq}
            onChange={e => setRoadWiggleFreq(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#5a9e6f', cursor: 'pointer', marginBottom: 6 }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ color: '#6a6a8a', fontSize: 11 }}>Path smoothing</span>
            <span style={{ color: '#5a5a7a', fontSize: 10 }}>{roadPathSmoothing}</span>
          </div>
          <input
            type="range" min={0} max={50} step={1}
            value={roadPathSmoothing}
            onChange={e => setRoadPathSmoothing(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#5a9e6f', cursor: 'pointer', marginBottom: 6 }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ color: '#6a6a8a', fontSize: 11 }}>Line smoothing</span>
            <span style={{ color: '#5a5a7a', fontSize: 10 }}>{roadSmoothing}</span>
          </div>
          <input
            type="range" min={0} max={30} step={1}
            value={roadSmoothing}
            onChange={e => setRoadSmoothing(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#5a9e6f', cursor: 'pointer' }}
          />
        </div>

        {/* ── Rail geometry ── */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Rail Geometry</div>
          <ToolButton
            label="Edit Rail Nodes"
            active={railNodeEditMode}
            color={railNodeEditMode ? '#b0e0f0' : '#3a3a5a'}
            swatchBorder={`1px solid ${railNodeEditMode ? '#4a9ab0' : '#4a4a6a'}`}
            onSelect={() => setActiveTool(railNodeEditMode ? { type: 'none' } : { type: 'rail-node-edit' })}
          />
          <div style={{ marginBottom: 10, marginTop: 4 }}>
            <ToolButton
              label="Select rail segment"
              active={railSelectMode}
              color={railSelectMode ? '#b0d8f0' : '#3a3a5a'}
              swatchBorder={`1px solid ${railSelectMode ? '#4a88b0' : '#4a4a6a'}`}
              onSelect={() => setActiveTool(railSelectMode ? { type: 'none' } : { type: 'rail-select' })}
              accentBg="#1a1a2a"
              accentBorder="#4a88b0"
              accentText="#b0d8f0"
            />
          </div>
          {railSelectMode && <div style={{ color: '#4a6a8a', fontSize: 10, marginTop: -6, marginBottom: 10, lineHeight: 1.5 }}>Right-click a rail to select. Right-click to exit.</div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ color: '#6a6a8a', fontSize: 11 }}>Wiggle amp</span>
            <span style={{ color: '#5a5a7a', fontSize: 10 }}>{railWiggleAmp.toFixed(2)}</span>
          </div>
          <input
            type="range" min={0} max={1} step={0.01}
            value={railWiggleAmp}
            onPointerDown={() => setRailWiggleDragging(true)}
            onPointerUp={() => setRailWiggleDragging(false)}
            onChange={e => setRailWiggleAmp(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#4a9ab0', cursor: 'pointer', marginBottom: 6 }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ color: '#6a6a8a', fontSize: 11 }}>Wiggle freq</span>
            <span style={{ color: '#5a5a7a', fontSize: 10 }}>{railWiggleFreq.toFixed(1)}</span>
          </div>
          <input
            type="range" min={0.5} max={10} step={0.1}
            value={railWiggleFreq}
            onChange={e => setRailWiggleFreq(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#4a9ab0', cursor: 'pointer', marginBottom: 6 }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ color: '#6a6a8a', fontSize: 11 }}>Line smoothing</span>
            <span style={{ color: '#5a5a7a', fontSize: 10 }}>{railSmoothing}</span>
          </div>
          <input
            type="range" min={0} max={30} step={1}
            value={railSmoothing}
            onChange={e => setRailSmoothing(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#4a9ab0', cursor: 'pointer' }}
          />
        </div>

        {/* ── OSM fetch ── */}
        <div style={sectionStyle}>
          <div style={labelStyle}>From OSM</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ color: '#6a6a8a', fontSize: 11 }}>Min chain length</span>
                <span style={{ color: '#5a5a7a', fontSize: 10 }}>{roadDensityMinChain === 1 ? 'all' : `${roadDensityMinChain} hops`}</span>
              </div>
              <input
                type="range" min={1} max={15} step={1}
                value={roadDensityMinChain}
                onChange={e => setRoadDensityMinChain(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#5a8a5a', cursor: 'pointer', marginBottom: 8 }}
              />
            </div>
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
              {roadsStatus === 'done' && osmHexPaths.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 10, color: '#6a6a8a', marginBottom: 4 }}>Apply OSM to map</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['Highways', 'Primary', 'Secondary'] as const).map((label, i) => (
                      <button
                        key={i}
                        onClick={() => applyOsmTier(i as 0 | 1 | 2)}
                        onMouseEnter={() => setOsmHighlightTier(i as 0 | 1 | 2)}
                        onMouseLeave={() => setOsmHighlightTier(null)}
                        style={{
                          flex: 1, padding: '3px 0', background: 'none',
                          border: `1px solid ${osmHighlightTier === i ? '#8a8a3a' : '#2a3a2a'}`,
                          color: osmHighlightTier === i ? '#c0c050' : '#6a8a6a',
                          borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit', fontSize: 10,
                        }}
                      >{label}</button>
                    ))}
                  </div>
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: osmSpotlightMode ? '#c0c080' : '#6a6a8a', cursor: 'pointer', userSelect: 'none' }}>
                      <input type="checkbox" checked={osmSpotlightMode} onChange={e => setOsmSpotlightMode(e.target.checked)} style={{ cursor: 'pointer', accentColor: '#c0c080' }} />
                      OSM spotlight
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#6a6a8a', cursor: 'pointer', userSelect: 'none' }}>
                      <input type="checkbox" checked={showRawOsmRoads} onChange={e => setShowRawOsmRoads(e.target.checked)} style={{ cursor: 'pointer' }} />
                      Show all
                    </label>
                  </div>
                  {osmSpotlightMode && (
                    <div style={{ marginTop: 5 }}>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                        {(['Highways', 'Primary', 'Secondary'] as const).map((label, i) => {
                          const on = osmSpotlightTiers[i as 0|1|2]
                          const colors = ['#ff5050', '#ffb428', '#dcdc3c']
                          return (
                            <button key={i}
                              onClick={() => { const t = [...osmSpotlightTiers] as [boolean,boolean,boolean,boolean]; t[i as 0|1|2] = !t[i as 0|1|2]; setOsmSpotlightTiers(t) }}
                              style={{
                                flex: 1, padding: '3px 0', background: on ? 'rgba(0,0,0,0.3)' : 'none',
                                border: `1px solid ${on ? colors[i] : '#2a3a2a'}`,
                                color: on ? colors[i] : '#4a5a4a',
                                borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit', fontSize: 10,
                              }}
                            >{label}</button>
                          )
                        })}
                        {(() => {
                          const on = osmSpotlightTiers[3]
                          return (
                            <button
                              onClick={() => { const t = [...osmSpotlightTiers] as [boolean,boolean,boolean,boolean]; t[3] = !t[3]; setOsmSpotlightTiers(t) }}
                              style={{
                                flex: 1, padding: '3px 0', background: on ? 'rgba(0,0,0,0.3)' : 'none',
                                border: `1px solid ${on ? '#00dcdc' : '#2a3a2a'}`,
                                color: on ? '#00dcdc' : '#4a5a4a',
                                borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit', fontSize: 10,
                              }}
                            >Rails</button>
                          )
                        })()}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 10, color: '#6a6a8a', flexShrink: 0 }}>Radius</span>
                        <input type="range" min={1} max={10} step={1}
                          value={osmSpotlightRadius}
                          onChange={e => setOsmSpotlightRadius(Number(e.target.value))}
                          style={{ flex: 1, accentColor: '#c0c080', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: 10, color: '#8a8a6a', width: 12, textAlign: 'right' }}>{osmSpotlightRadius}</span>
                      </div>
                    </div>
                  )}
                </div>
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
              {railsStatus === 'done' && osmRailHexPaths.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 10, color: '#6a6a8a', marginBottom: 4 }}>Apply OSM to map</div>
                  <button
                    onClick={() => applyOsmRails()}
                    onMouseEnter={() => setOsmRailHighlight(true)}
                    onMouseLeave={() => setOsmRailHighlight(false)}
                    style={{
                      width: '100%', padding: '3px 0', background: 'none',
                      border: `1px solid ${osmRailHighlight ? '#00aaaa' : '#2a2a3a'}`,
                      color: osmRailHighlight ? '#00dcdc' : '#5a6a8a',
                      borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit', fontSize: 10,
                    }}
                  >Apply Rails</button>
                </div>
              )}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {statusDot(motorwayHexesStatus)}
                  <span style={{ color: '#6a6a8a' }}>Motorway Hexes</span>
                </div>
                {motorwayHexesStatus === 'done' && (
                  <button
                    onClick={() => clearMotorwayHexes()}
                    style={{ background: 'none', border: 'none', color: '#5a3a3a', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit', padding: 0 }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#9e5a5a')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#5a3a3a')}
                  >clear</button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                {(['Fast', 'Full'] as const).map(label => {
                  const isFast = label === 'Fast'
                  const active = motorwayHexesFast === isFast
                  return (
                    <button key={label}
                      onClick={() => setMotorwayHexesFast(isFast)}
                      style={{
                        flex: 1, padding: '3px 0', fontFamily: 'inherit', fontSize: 10,
                        background: active ? 'rgba(0,0,0,0.3)' : 'none',
                        border: `1px solid ${active ? '#8a5a3a' : '#3a2a2a'}`,
                        color: active ? '#c08060' : '#5a4a4a',
                        borderRadius: 3, cursor: 'pointer',
                      }}
                    >{label}</button>
                  )
                })}
              </div>
              <button
                onClick={() => fetchMotorwayHexes()}
                disabled={motorwayHexesStatus === 'loading'}
                style={{
                  width: '100%', padding: '4px 0',
                  background: 'none', border: '1px solid #3a2a2a',
                  color: motorwayHexesStatus === 'loading' ? '#5a3a3a' : '#8a5a5a',
                  borderRadius: 3, cursor: motorwayHexesStatus === 'loading' ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', fontSize: 11,
                }}
              >
                {motorwayHexesStatus === 'loading' ? 'fetching…' : 'Fetch Motorway Hexes'}
              </button>
              {motorwayHexesStatus === 'error' && motorwayHexesError && (
                <div style={{ color: '#9e5a5a', fontSize: 10, marginTop: 3 }}>{motorwayHexesError}</div>
              )}
              {motorwayHexesStatus === 'done' && (
                <div style={{ marginTop: 5 }}>
                  <div style={{ fontSize: 10, color: '#6a6a8a', marginBottom: 4 }}>
                    {motorwayHexes.length} hex{motorwayHexes.length !== 1 ? 'es' : ''} found
                  </div>
                  <button
                    onClick={() => applyMotorwayHexes()}
                    disabled={motorwayHexes.length === 0}
                    style={{
                      width: '100%', padding: '3px 0',
                      background: 'none', border: '1px solid #3a2a1a',
                      color: motorwayHexes.length === 0 ? '#4a3a2a' : '#a07040',
                      borderRadius: 3, cursor: motorwayHexes.length === 0 ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit', fontSize: 10,
                    }}
                    onMouseEnter={e => { if (motorwayHexes.length > 0) { e.currentTarget.style.borderColor = '#8a6030'; e.currentTarget.style.color = '#d0a060' } }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#3a2a1a'; e.currentTarget.style.color = motorwayHexes.length === 0 ? '#4a3a2a' : '#a07040' }}
                  >Apply as Highways</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {selectedRoadSegmentKeys.length > 0 && (
          <RoadSegmentPanel
            selectedKeys={selectedRoadSegmentKeys}
            segmentProps={roadSegmentProps}
            accentColor='#7a6ab0'
            globalWiggleAmp={roadWiggleAmp}
            globalWiggleFreq={roadWiggleFreq}
            setProp={setRoadSegmentProp}
            clearProp={clearRoadSegmentProp}
            setSelectedKeys={setSelectedRoadSegmentKeys}
          />
        )}
        {selectedRoadHopKey && selectedRoadSegmentKeys.length > 0 && (() => {
          const sp = selectedRoadSegmentKeys.length === 1 ? roadSegmentProps[selectedRoadSegmentKeys[0]] : undefined
          return (
            <RoadHopPanel
              selectedHopKey={selectedRoadHopKey}
              hopProps={roadHopProps}
              accentColor='#7a6ab0'
              defaultAmp={sp?.wiggleAmp ?? roadWiggleAmp}
              defaultFreq={sp?.wiggleFreq ?? roadWiggleFreq}
              setProp={setRoadHopProp}
              clearProp={clearRoadHopProp}
              setSelectedHopKey={setSelectedRoadHopKey}
            />
          )
        })()}

        {selectedRailSegmentKeys.length > 0 && (
          <RoadSegmentPanel
            selectedKeys={selectedRailSegmentKeys}
            segmentProps={railSegmentProps}
            accentColor='#4a9ab0'
            globalWiggleAmp={railWiggleAmp}
            globalWiggleFreq={railWiggleFreq}
            setProp={setRailSegmentProp}
            clearProp={clearRailSegmentProp}
            setSelectedKeys={setSelectedRailSegmentKeys}
          />
        )}
        {selectedRailHopKey && selectedRailSegmentKeys.length > 0 && (() => {
          const sp = selectedRailSegmentKeys.length === 1 ? railSegmentProps[selectedRailSegmentKeys[0]] : undefined
          return (
            <RoadHopPanel
              selectedHopKey={selectedRailHopKey}
              hopProps={railHopProps}
              accentColor='#4a9ab0'
              defaultAmp={sp?.wiggleAmp ?? railWiggleAmp}
              defaultFreq={sp?.wiggleFreq ?? railWiggleFreq}
              setProp={setRailHopProp}
              clearProp={clearRailHopProp}
              setSelectedHopKey={setSelectedRailHopKey}
            />
          )
        })()}

      </div>
    </>
  )
}
