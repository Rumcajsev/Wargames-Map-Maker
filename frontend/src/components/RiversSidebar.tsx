import { useState } from 'react'
import { useMapStore, LAKE_COLOR } from '../store/mapStore'
import { RiversSettingsFlyout } from './RiversSettingsFlyout'
import { riverChainCache, computeTaperRanges } from '../lib/riverChains'
import { sidebarStyle, sectionStyle, labelStyle } from './sidebarStyles'

const CogIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.92c.04-.34.07-.68.07-1.08s-.03-.74-.07-1.08l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.34-.07.69-.07 1.08s.03.74.07 1.08L2.7 13.07c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.58 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65z" />
  </svg>
)

interface SegmentPanelProps {
  selectedKeys: string[]
  segmentProps: Record<string, { width?: number; taper?: number; taperRange?: [number, number] }>
  baseWidthScale: number
  accentColor: string
  chains: import('../lib/riverChains').RiverChain[]
  setProp: (key: string, prop: { width?: number; taper?: number; taperRange?: [number, number] }) => void
  setPropMany: (keys: string[], prop: { width?: number; taper?: number }) => void
  clearPropMany: (keys: string[]) => void
  setSelectedKeys: (keys: string[]) => void
}

function SegmentPanel({ selectedKeys, segmentProps, baseWidthScale, accentColor, chains, setProp, setPropMany, clearPropMany, setSelectedKeys }: SegmentPanelProps) {
  if (selectedKeys.length === 0) return null
  const n = selectedKeys.length
  const firstProps = segmentProps[selectedKeys[0]]
  const widthVal = firstProps?.width ?? baseWidthScale
  const taperVal = firstProps?.taper ?? 0
  const anyWidthOverride = selectedKeys.some(k => segmentProps[k]?.width !== undefined)
  const anyTaperOverride = selectedKeys.some(k => segmentProps[k]?.taper !== undefined)
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
      <div style={{ color: '#4a6a8a', fontSize: 10, marginBottom: 4, lineHeight: 1.4 }}>Start is narrower, end is wider.</div>
      <button
        onClick={() => { clearPropMany(selectedKeys); setSelectedKeys([]) }}
        style={{ marginTop: 4, width: '100%', padding: '3px 0', background: 'none',
          border: '1px solid #1e1f2e', borderRadius: 3, color: '#4a4a6a',
          cursor: 'pointer', fontFamily: 'inherit', fontSize: 10 }}
        onMouseEnter={e => (e.currentTarget.style.color = '#9e5a5a')}
        onMouseLeave={e => (e.currentTarget.style.color = '#4a4a6a')}
      >Reset to default</button>
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
  } = useMapStore()

  const [openSettings, setOpenSettings] = useState<'river' | 'canal' | 'lake' | null>(null)
  const [settingsAnchorY, setSettingsAnchorY] = useState(0)
  const [hoveredDraw, setHoveredDraw] = useState<'river' | 'canal' | 'lake' | null>(null)

  const handleCog = (type: 'river' | 'canal' | 'lake', y: number) => {
    if (openSettings === type) setOpenSettings(null)
    else { setOpenSettings(type); setSettingsAnchorY(y) }
  }

  const btnStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 7, padding: '5px 8px',
    background: active ? '#1a2a3a' : 'none',
    border: `1px solid ${active ? '#3a6a9a' : '#1e1f2e'}`,
    borderRadius: 3, cursor: 'pointer',
    fontFamily: 'ui-monospace, monospace', fontSize: 11,
    color: active ? '#b0d8f0' : '#6a6a8a', textAlign: 'left', width: '100%',
  })

  const subBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '3px 6px', background: active ? '#1a2a3a' : 'none',
    border: `1px solid ${active ? '#3a6a9a' : '#1e1f2e'}`,
    borderRadius: 3, cursor: 'pointer',
    fontFamily: 'ui-monospace, monospace', fontSize: 10,
    color: active ? '#b0d8f0' : '#6a6a8a',
  })

  const exitBtnStyle: React.CSSProperties = {
    padding: '3px 6px', background: 'none',
    border: '1px solid #1e1f2e', borderRadius: 3, cursor: 'pointer',
    fontFamily: 'ui-monospace, monospace', fontSize: 10, color: '#4a4a6a',
  }

  return (
    <>
      {openSettings && (
        <RiversSettingsFlyout type={openSettings} anchorY={settingsAnchorY} onClose={() => setOpenSettings(null)} />
      )}
      <div style={sidebarStyle}>

        {/* ── Draw tools ── */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Draw</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

            {/* River */}
            {(['river', 'canal'] as const).map(type => {
              const isRiver = type === 'river'
              const editMode = isRiver ? riverEditMode : canalEditMode
              const selectMode = isRiver ? riverSelectMode : canalSelectMode
              const style = isRiver ? riverStyle : canalStyle
              const label = isRiver ? 'River' : 'Canal'
              return (
                <div key={type}
                  style={{ position: 'relative' }}
                  onMouseEnter={() => setHoveredDraw(type)}
                  onMouseLeave={() => setHoveredDraw(null)}
                >
                  {!editMode ? (
                    <button onClick={() => setActiveTool({ type: `${type}-paint` as 'river-paint' | 'canal-paint' })} style={btnStyle(false)}>
                      <span style={{
                        width: 9, height: 9, borderRadius: 2, flexShrink: 0,
                        background: style.color, border: `1px solid ${style.strokeEnabled ? style.strokeColor : style.color}`,
                      }} />
                      <span style={{ flex: 1 }}>{label}</span>
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                        <button onClick={() => setActiveTool({ type: `${type}-paint` as 'river-paint' | 'canal-paint' })} style={{ ...subBtnStyle(!selectMode), flex: 1 }}>Paint</button>
                        <button onClick={() => setActiveTool({ type: `${type}-select` as 'river-select' | 'canal-select' })} style={{ ...subBtnStyle(selectMode), flex: 1 }}>Select</button>
                        <button onClick={() => setActiveTool({ type: 'none' })} style={exitBtnStyle}>✕</button>
                      </div>
                    </div>
                  )}
                  {hoveredDraw === type && !editMode && (
                    <button
                      data-rivers-flyout=""
                      onClick={e => { e.stopPropagation(); handleCog(type, e.currentTarget.getBoundingClientRect().top) }}
                      title={`${label} settings`}
                      style={{
                        position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', color: '#5a5a8a', cursor: 'pointer',
                        padding: '2px 3px', display: 'flex', alignItems: 'center', borderRadius: 2, lineHeight: 1,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#c0c0e0')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#5a5a8a')}
                    ><CogIcon /></button>
                  )}
                </div>
              )
            })}

            {/* Lake */}
            <div
              style={{ position: 'relative' }}
              onMouseEnter={() => setHoveredDraw('lake')}
              onMouseLeave={() => setHoveredDraw(null)}
            >
              <button onClick={() => setActiveTool(lakePaintMode ? { type: 'none' } : { type: 'lake' })} style={btnStyle(lakePaintMode)}>
                <span style={{
                  width: 9, height: 9, borderRadius: 2, flexShrink: 0,
                  background: lakePaintMode ? LAKE_COLOR : '#2a3a4a',
                  border: `1px solid ${lakePaintMode ? LAKE_COLOR : '#1e2a3a'}`,
                }} />
                <span style={{ flex: 1 }}>Lake</span>
              </button>
              {hoveredDraw === 'lake' && (
                <button
                  data-rivers-flyout=""
                  onClick={e => { e.stopPropagation(); handleCog('lake', e.currentTarget.getBoundingClientRect().top) }}
                  title="Lake settings"
                  style={{
                    position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: '#5a5a8a', cursor: 'pointer',
                    padding: '2px 3px', display: 'flex', alignItems: 'center', borderRadius: 2, lineHeight: 1,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#c0c0e0')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#5a5a8a')}
                ><CogIcon /></button>
              )}
            </div>

          </div>
          {riverEditMode && !riverSelectMode && <div style={{ color: '#4a6a8a', fontSize: 10, marginTop: 6, lineHeight: 1.5 }}>Click hex edges to paint a river.</div>}
          {riverEditMode && riverSelectMode && <div style={{ color: '#4a6a8a', fontSize: 10, marginTop: 6, lineHeight: 1.5 }}>Click a river segment to select it.</div>}
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
        />

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
