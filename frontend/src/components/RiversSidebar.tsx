import { useState, useEffect } from 'react'
import { useMapStore, LAKE_COLOR } from '../store/mapStore'
import { RiversSettingsFlyout } from './RiversSettingsFlyout'
import { riverChainCache, computeTaperRanges } from '../lib/riverChains'
import { sidebarStyle, sectionStyle, labelStyle } from './sidebarStyles'
import { ToolButton } from './ToolButton'

interface SegmentPanelProps {
  selectedKeys: string[]
  segmentProps: Record<string, { width?: number; taper?: number; taperRange?: [number, number]; wiggleAmp?: number; wiggleFreq?: number }>
  baseWidthScale: number
  accentColor: string
  chains: import('../lib/riverChains').RiverChain[]
  setProp: (key: string, prop: { width?: number; taper?: number; taperRange?: [number, number]; wiggleAmp?: number; wiggleFreq?: number }) => void
  setPropMany: (keys: string[], prop: { width?: number; taper?: number; wiggleAmp?: number; wiggleFreq?: number }) => void
  clearPropMany: (keys: string[]) => void
  setSelectedKeys: (keys: string[]) => void
  showWiggle?: boolean
  globalWiggleAmp?: number
  globalWiggleFreq?: number
}

function SegmentPanel({ selectedKeys, segmentProps, baseWidthScale, accentColor, chains, setProp, setPropMany, clearPropMany, setSelectedKeys, showWiggle, globalWiggleAmp = 0.25, globalWiggleFreq = 2.5 }: SegmentPanelProps) {
  if (selectedKeys.length === 0) return null
  const n = selectedKeys.length
  const firstProps = segmentProps[selectedKeys[0]]
  const widthVal = firstProps?.width ?? baseWidthScale
  const taperVal = firstProps?.taper ?? 0
  const wiggleAmpVal = firstProps?.wiggleAmp ?? globalWiggleAmp
  const wiggleFreqVal = firstProps?.wiggleFreq ?? globalWiggleFreq
  const anyWidthOverride = selectedKeys.some(k => segmentProps[k]?.width !== undefined)
  const anyTaperOverride = selectedKeys.some(k => segmentProps[k]?.taper !== undefined)
  const anyWiggleAmpOverride = selectedKeys.some(k => segmentProps[k]?.wiggleAmp !== undefined)
  const anyWiggleFreqOverride = selectedKeys.some(k => segmentProps[k]?.wiggleFreq !== undefined)
  return (
    <div style={sectionStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <div style={labelStyle}>{n === 1 ? 'Segment' : `${n} Segments`}</div>
        <button onClick={() => setSelectedKeys([])}
          style={{ background: 'none', border: 'none', color: '#4a4a6a', cursor: 'pointer', fontSize: 11, padding: 0 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#a0a0c0')}
          onMouseLeave={e => (e.currentTarget.style.color = '#4a4a6a')}
        >✕</button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11 }}>Width</span>
        <span style={{ color: '#5a5a7a', fontSize: 10 }}>{anyWidthOverride ? `${(widthVal*100).toFixed(0)}% ●` : `${(widthVal*100).toFixed(0)}%`}</span>
      </div>
      <input type="range" min={25} max={400} step={5}
        value={Math.round(widthVal * 100)}
        onChange={e => setPropMany(selectedKeys, { width: Number(e.target.value) / 100 })}
        style={{ width: '100%', accentColor, marginBottom: 6 }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11 }}>Taper</span>
        <span style={{ color: '#5a5a7a', fontSize: 10 }}>{anyTaperOverride ? `${Math.round(taperVal*100)}% ●` : `${Math.round(taperVal*100)}%`}</span>
      </div>
      <input type="range" min={0} max={100} step={5}
        value={Math.round(taperVal * 100)}
        onChange={e => {
          const taper = Number(e.target.value) / 100
          if (selectedKeys.length === 1) {
            setProp(selectedKeys[0], { taper, taperRange: [0, 1] })
          } else {
            const ranges = computeTaperRanges(selectedKeys, chains)
            for (const key of selectedKeys) setProp(key, { taper, taperRange: ranges[key] ?? [0, 1] })
          }
        }}
        style={{ width: '100%', accentColor, marginBottom: 2 }}
      />
      <div style={{ color: '#4a6a8a', fontSize: 10, marginBottom: 6, lineHeight: 1.4 }}>Start is narrower, end is wider.</div>
      {showWiggle && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 11 }}>Wiggle amp</span>
            <span style={{ color: '#5a5a7a', fontSize: 10 }}>{anyWiggleAmpOverride ? `${(wiggleAmpVal*100).toFixed(0)}% ●` : `${(wiggleAmpVal*100).toFixed(0)}%`}</span>
          </div>
          <input type="range" min={0} max={100} step={1}
            value={Math.round(wiggleAmpVal * 100)}
            onChange={e => setPropMany(selectedKeys, { wiggleAmp: Number(e.target.value) / 100 })}
            style={{ width: '100%', accentColor, marginBottom: 6 }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 11 }}>Wiggle freq</span>
            <span style={{ color: '#5a5a7a', fontSize: 10 }}>{anyWiggleFreqOverride ? `${wiggleFreqVal.toFixed(1)} ●` : wiggleFreqVal.toFixed(1)}</span>
          </div>
          <input type="range" min={5} max={100} step={1}
            value={Math.round(wiggleFreqVal * 10)}
            onChange={e => setPropMany(selectedKeys, { wiggleFreq: Number(e.target.value) / 10 })}
            style={{ width: '100%', accentColor, marginBottom: 6 }}
          />
        </>
      )}
      <button
        onClick={() => { clearPropMany(selectedKeys); setSelectedKeys([]) }}
        style={{ marginTop: 2, width: '100%', padding: '3px 0', background: 'none',
          border: '1px solid #1e1f2e', borderRadius: 3, color: '#4a4a6a',
          cursor: 'pointer', fontFamily: 'inherit', fontSize: 10 }}
        onMouseEnter={e => (e.currentTarget.style.color = '#9e5a5a')}
        onMouseLeave={e => (e.currentTarget.style.color = '#4a4a6a')}
      >Reset to default</button>
    </div>
  )
}

function HopPanel({ selectedHopKey, hopProps, riverStyle, riverWiggleAmp, riverWiggleFreq, setRiverHopProp, clearRiverHopProp, setSelectedHopKey }: {
  selectedHopKey: string
  hopProps: Record<string, { wiggleAmp?: number; wiggleFreq?: number; width?: number; taper?: number }>
  riverStyle: import('../store/mapStore').RiverStyleConfig
  riverWiggleAmp: number
  riverWiggleFreq: number
  setRiverHopProp: (key: string, prop: { wiggleAmp?: number; wiggleFreq?: number; width?: number; taper?: number }) => void
  clearRiverHopProp: (key: string) => void
  setSelectedHopKey: (key: string | null) => void
}) {
  const hp = hopProps[selectedHopKey] ?? {}
  const ampVal = hp.wiggleAmp ?? riverWiggleAmp
  const freqVal = hp.wiggleFreq ?? riverWiggleFreq
  const widthVal = hp.width ?? 1
  const taperVal = hp.taper ?? 0
  const hasOverride = !!hopProps[selectedHopKey]
  const accentColor = riverStyle.color

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
        <span style={{ fontSize: 11 }}>Width</span>
        <span style={{ color: '#5a5a7a', fontSize: 10 }}>{hp.width !== undefined ? `${(widthVal * 100).toFixed(0)}% ●` : `${(widthVal * 100).toFixed(0)}%`}</span>
      </div>
      <input type="range" min={25} max={400} step={5}
        value={Math.round(widthVal * 100)}
        onChange={e => setRiverHopProp(selectedHopKey, { width: Number(e.target.value) / 100 })}
        style={{ width: '100%', accentColor, marginBottom: 6 }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11 }}>Taper</span>
        <span style={{ color: '#5a5a7a', fontSize: 10 }}>{hp.taper !== undefined ? `${Math.round(taperVal * 100)}% ●` : `${Math.round(taperVal * 100)}%`}</span>
      </div>
      <input type="range" min={0} max={100} step={5}
        value={Math.round(taperVal * 100)}
        onChange={e => setRiverHopProp(selectedHopKey, { taper: Number(e.target.value) / 100 })}
        style={{ width: '100%', accentColor, marginBottom: 6 }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11 }}>Wiggle amp</span>
        <span style={{ color: '#5a5a7a', fontSize: 10 }}>{hp.wiggleAmp !== undefined ? `${(ampVal * 100).toFixed(0)}% ●` : `${(ampVal * 100).toFixed(0)}%`}</span>
      </div>
      <input type="range" min={0} max={100} step={1}
        value={Math.round(ampVal * 100)}
        onChange={e => setRiverHopProp(selectedHopKey, { wiggleAmp: Number(e.target.value) / 100 })}
        style={{ width: '100%', accentColor, marginBottom: 6 }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11 }}>Wiggle freq</span>
        <span style={{ color: '#5a5a7a', fontSize: 10 }}>{hp.wiggleFreq !== undefined ? `${freqVal.toFixed(1)} ●` : freqVal.toFixed(1)}</span>
      </div>
      <input type="range" min={5} max={100} step={1}
        value={Math.round(freqVal * 10)}
        onChange={e => setRiverHopProp(selectedHopKey, { wiggleFreq: Number(e.target.value) / 10 })}
        style={{ width: '100%', accentColor, marginBottom: 6 }}
      />

      {hasOverride && (
        <button
          onClick={() => clearRiverHopProp(selectedHopKey)}
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

export function RiversSidebar() {
  const {
    riverEdges, canalEdges,
    riverEditMode,
    canalEditMode,
    lakePaintMode,
    setActiveTool,
    autoLakesEnabled, setAutoLakesEnabled,
    lakeSensitivity, setLakeSensitivity,
    riverSelectMode,
    canalSelectMode,
    selectedSegmentKeys, setSelectedSegmentKeys,
    selectedCanalSegmentKeys, setSelectedCanalSegmentKeys,
    riverSegmentProps, setRiverSegmentProp, setRiverSegmentPropMany, clearRiverSegmentPropMany,
    canalSegmentProps, setCanalSegmentProp, setCanalSegmentPropMany, clearCanalSegmentPropMany,
    riverWidthScale, canalWidthScale,
    riverStyle, canalStyle,
    riverNodeEditMode,
    selectedHopKey, setSelectedHopKey,
    riverHopProps, setRiverHopProp, clearRiverHopProp,
    riverWiggleAmp, riverWiggleFreq,
    osmRiverWays, riversOsmStatus, riversOsmError, osmRiverHighlight,
    fetchRivers, applyOsmRivers, setOsmRiverHighlight, clearOsmRivers,
  } = useMapStore()

  const [openSettings, setOpenSettings] = useState<'river' | 'canal' | 'lake' | null>(null)
  const [settingsAnchorY, setSettingsAnchorY] = useState(0)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === '1') setActiveTool(riverEditMode ? { type: 'none' } : { type: 'river-paint' })
      else if (e.key === '2') setActiveTool(canalEditMode ? { type: 'none' } : { type: 'canal-paint' })
      else if (e.key === '3') setActiveTool(lakePaintMode ? { type: 'none' } : { type: 'lake' })
      else if (e.key === '4') setActiveTool(riverNodeEditMode ? { type: 'none' } : { type: 'river-node-edit' })
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [riverEditMode, canalEditMode, lakePaintMode, riverNodeEditMode])

  const handleCog = (type: 'river' | 'canal' | 'lake', y: number) => {
    if (openSettings === type) setOpenSettings(null)
    else { setOpenSettings(type); setSettingsAnchorY(y) }
  }

  const RIVER_ACCENT = { accentBg: '#1a2a3a', accentBorder: '#3a6a9a', accentText: '#b0d8f0' }

  return (
    <>
      {openSettings && (
        <RiversSettingsFlyout type={openSettings} anchorY={settingsAnchorY} onClose={() => setOpenSettings(null)} />
      )}
      <div style={sidebarStyle}>

        {/* ── Fetch from OSM ── */}
        <div style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={labelStyle}>From OSM</div>
            {riversOsmStatus !== 'idle' && (
              <button
                onClick={clearOsmRivers}
                style={{ background: 'none', border: 'none', color: '#4a4a6a', cursor: 'pointer', fontSize: 10, padding: 0 }}
                onMouseEnter={e => (e.currentTarget.style.color = '#9e5a5a')}
                onMouseLeave={e => (e.currentTarget.style.color = '#4a4a6a')}
              >clear</button>
            )}
          </div>

          {riversOsmStatus === 'done' && osmRiverWays.length > 0 && (() => {
            const riverCount = osmRiverWays.filter(w => w.type === 'river').length
            const canalCount = osmRiverWays.filter(w => w.type === 'canal').length
            return (
              <div style={{ fontSize: 10, color: '#4a6a8a', marginBottom: 6 }}>
                {riverCount > 0 && <span>{riverCount} river{riverCount !== 1 ? 's' : ''}</span>}
                {riverCount > 0 && canalCount > 0 && <span>, </span>}
                {canalCount > 0 && <span>{canalCount} canal{canalCount !== 1 ? 's' : ''}</span>}
                {' '}found
              </div>
            )
          })()}

          <button
            onClick={() => fetchRivers()}
            disabled={riversOsmStatus === 'loading'}
            style={{
              width: '100%', padding: '4px 0', marginBottom: 4,
              background: 'none', border: `1px solid ${riversOsmStatus === 'loading' ? '#2a2a4a' : '#3a6a9a'}`,
              color: riversOsmStatus === 'loading' ? '#3a3a5a' : '#5a9aba',
              borderRadius: 3, cursor: riversOsmStatus === 'loading' ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: riversOsmStatus === 'done' ? '#5a9e6f' : riversOsmStatus === 'loading' ? '#a0a060' : riversOsmStatus === 'error' ? '#9e5a5a' : '#3a3a5a' }} />
            {riversOsmStatus === 'loading' ? 'fetching…' : 'Fetch Rivers'}
          </button>

          {riversOsmStatus === 'error' && riversOsmError && (
            <div style={{ fontSize: 10, color: '#9e5a5a', marginBottom: 4 }}>{riversOsmError}</div>
          )}

          {riversOsmStatus === 'done' && osmRiverWays.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ fontSize: 10, color: '#4a6a8a', marginBottom: 2 }}>Apply OSM to map</div>
              {(['river', 'canal'] as const).map(type => {
                const count = osmRiverWays.filter(w => w.type === type).length
                if (count === 0) return null
                const isActive = osmRiverHighlight === type
                const color = type === 'river' ? '#5a9aba' : '#4abaa0'
                const borderColor = type === 'river' ? '#3a6a9a' : '#2a8a7a'
                return (
                  <div key={type} style={{ display: 'flex', gap: 3 }}>
                    <button
                      onClick={() => applyOsmRivers(type)}
                      style={{
                        flex: 1, padding: '3px 0', background: 'none',
                        border: `1px solid ${borderColor}`, color,
                        borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                    >Apply {type === 'river' ? 'Rivers' : 'Canals'}</button>
                    <button
                      onClick={() => setOsmRiverHighlight(isActive ? null : type)}
                      title="Preview on map"
                      style={{
                        padding: '3px 7px', background: 'none',
                        border: `1px solid ${isActive ? borderColor : '#2a2a3a'}`,
                        color: isActive ? color : '#4a4a6a',
                        borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit', fontSize: 10,
                      }}
                    >👁</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Draw tools ── */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Draw</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

            {(['river', 'canal'] as const).map(type => {
              const isRiver = type === 'river'
              const editMode = isRiver ? riverEditMode : canalEditMode
              const selectMode = isRiver ? riverSelectMode : canalSelectMode
              const style = isRiver ? riverStyle : canalStyle
              const label = isRiver ? 'River' : 'Canal'
              const paintType = `${type}-paint` as 'river-paint' | 'canal-paint'
              const selectType = `${type}-select` as 'river-select' | 'canal-select'
              return (
                <div key={type} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <ToolButton
                    label={label}
                    active={editMode}
                    color={style.color}
                    swatchBorder={`1px solid ${style.strokeEnabled ? style.strokeColor : style.color}`}
                    shortcut={isRiver ? '1' : '2'}
                    onSelect={() => setActiveTool(editMode ? { type: 'none' } : { type: paintType })}
                    onSettings={(y) => handleCog(type, y)}
                    settingsOpen={openSettings === type}
                    cogDataAttrib="data-rivers-flyout"
                    {...RIVER_ACCENT}
                  />
                  {editMode && (
                    <ToolButton
                      label="Select segments"
                      active={selectMode}
                      color={selectMode ? '#b0d8f0' : '#3a3a5a'}
                      swatchBorder={`1px solid ${selectMode ? '#3a6a9a' : '#4a4a6a'}`}
                      onSelect={() => setActiveTool(selectMode ? { type: paintType } : { type: selectType })}
                      {...RIVER_ACCENT}
                    />
                  )}
                </div>
              )
            })}

            <ToolButton
              label="Lake"
              active={lakePaintMode}
              color={lakePaintMode ? LAKE_COLOR : '#2a3a4a'}
              swatchBorder={`1px solid ${lakePaintMode ? LAKE_COLOR : '#1e2a3a'}`}
              shortcut="3"
              onSelect={() => setActiveTool(lakePaintMode ? { type: 'none' } : { type: 'lake' })}
              onSettings={(y) => handleCog('lake', y)}
              settingsOpen={openSettings === 'lake'}
              cogDataAttrib="data-rivers-flyout"
              {...RIVER_ACCENT}
            />

            <div style={{ marginTop: 4 }}>
              <ToolButton
                label="Edit nodes"
                active={riverNodeEditMode}
                color={riverNodeEditMode ? '#d0ecd8' : '#3a3a5a'}
                swatchBorder={`1px solid ${riverNodeEditMode ? '#5a9e6f' : '#4a4a6a'}`}
                shortcut="4"
                onSelect={() => setActiveTool(riverNodeEditMode ? { type: 'none' } : { type: 'river-node-edit' })}
              />
            </div>

          </div>
          {riverEditMode && !riverSelectMode && <div style={{ color: '#4a6a8a', fontSize: 10, marginTop: 6, lineHeight: 1.5 }}>Click hex edges to paint a river.</div>}
          {riverEditMode && riverSelectMode && <div style={{ color: '#4a6a8a', fontSize: 10, marginTop: 6, lineHeight: 1.5 }}>Click a segment to select it. Cmd+click a selected segment to pick a hop.</div>}
          {canalEditMode && !canalSelectMode && <div style={{ color: '#4a6a8a', fontSize: 10, marginTop: 6, lineHeight: 1.5 }}>Click hex edges to paint a canal.</div>}
          {canalEditMode && canalSelectMode && <div style={{ color: '#4a6a8a', fontSize: 10, marginTop: 6, lineHeight: 1.5 }}>Click a canal segment to select it.</div>}
          {lakePaintMode && <div style={{ color: '#4a6a8a', fontSize: 10, marginTop: 6, lineHeight: 1.5 }}>Click or drag hexes to mark or unmark them as lakes.</div>}
        </div>

        {/* ── Edge counts ── */}
        {(riverEdges.length > 0 || canalEdges.length > 0) && (
          <div style={{ ...sectionStyle, color: '#4a6a8a', fontSize: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {riverEdges.length > 0 && <span>{riverEdges.length} river edge{riverEdges.length !== 1 ? 's' : ''}</span>}
            {canalEdges.length > 0 && <span>{canalEdges.length} canal edge{canalEdges.length !== 1 ? 's' : ''}</span>}
          </div>
        )}

        {/* ── Selected river segment(s) ── */}
        <SegmentPanel
          selectedKeys={selectedSegmentKeys}
          segmentProps={riverSegmentProps}
          baseWidthScale={riverWidthScale}
          accentColor={riverStyle.color}
          chains={riverChainCache.chains}
          setProp={setRiverSegmentProp}
          setPropMany={setRiverSegmentPropMany}
          clearPropMany={clearRiverSegmentPropMany}
          setSelectedKeys={setSelectedSegmentKeys}
          showWiggle
          globalWiggleAmp={riverWiggleAmp}
          globalWiggleFreq={riverWiggleFreq}
        />

        {/* ── Selected hop ── */}
        {selectedHopKey && selectedSegmentKeys.length > 0 && (() => {
          const sp = selectedSegmentKeys.length === 1 ? riverSegmentProps[selectedSegmentKeys[0]] : undefined
          return (
            <HopPanel
              selectedHopKey={selectedHopKey}
              hopProps={riverHopProps}
              riverStyle={riverStyle}
              riverWiggleAmp={sp?.wiggleAmp ?? riverWiggleAmp}
              riverWiggleFreq={sp?.wiggleFreq ?? riverWiggleFreq}
              setRiverHopProp={setRiverHopProp}
              clearRiverHopProp={clearRiverHopProp}
              setSelectedHopKey={setSelectedHopKey}
            />
          )
        })()}

        {/* ── Selected canal segment(s) ── */}
        <SegmentPanel
          selectedKeys={selectedCanalSegmentKeys}
          segmentProps={canalSegmentProps}
          baseWidthScale={canalWidthScale}
          accentColor={canalStyle.color}
          chains={riverChainCache.chains}
          setProp={setCanalSegmentProp}
          setPropMany={setCanalSegmentPropMany}
          clearPropMany={clearCanalSegmentPropMany}
          setSelectedKeys={setSelectedCanalSegmentKeys}
        />

        {/* ── Auto Lakes ── */}
        <div style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ ...labelStyle, marginBottom: 0 }}>Auto Lakes</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <span style={{ fontSize: 10, color: autoLakesEnabled ? '#6aaad0' : '#4a4a6a' }}>
                {autoLakesEnabled ? 'on' : 'off'}
              </span>
              <input
                type="checkbox" checked={autoLakesEnabled}
                onChange={e => setAutoLakesEnabled(e.target.checked)}
                style={{ accentColor: LAKE_COLOR, cursor: 'pointer' }}
              />
            </label>
          </div>
          {autoLakesEnabled && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 11 }}>Sensitivity</span>
                <span style={{ color: '#5a5a7a', fontSize: 10 }}>{Math.round(lakeSensitivity * 100)}%</span>
              </div>
              <input
                type="range" min={5} max={95} step={1}
                value={Math.round(lakeSensitivity * 100)}
                onChange={e => setLakeSensitivity(Number(e.target.value) / 100)}
                style={{ width: '100%', accentColor: LAKE_COLOR }}
              />
              <div style={{ color: '#4a6a8a', fontSize: 10, marginTop: 4, lineHeight: 1.5 }}>
                Lower = more lakes detected.
              </div>
            </div>
          )}
        </div>

      </div>
    </>
  )
}
