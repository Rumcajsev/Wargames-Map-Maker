import { useState, useEffect } from 'react'
import {
  useMapStore, LAKE_COLOR, DEFAULT_RIVER_STYLE, DEFAULT_CANAL_STYLE,
} from '../../store/mapStore'
import { riverChainCache, computeTaperRanges } from '../../lib/riverChains'
import {
  PALETTE_RIVER, PALETTE_RIVER_OUTLINE,
  PALETTE_CANAL, PALETTE_CANAL_OUTLINE,
} from '../../palettes'
import { TK } from '../../theme'
import {
  SidebarShell, SidebarHeader, SidebarSection, SidebarDetailHeader,
  DetailViewShell, BrushRow, MiniSlider, BigColorSwatch, SegmentedControl,
  ToggleRow, tintBg,
} from './sidebar'

// ── Colour groups for BigColorSwatch ─────────────────────────────────────────

const RIVER_FILL_GROUPS:   { label: string; colors: string[] }[] = [{ label: 'Blue',  colors: [...PALETTE_RIVER] }]
const RIVER_STROKE_GROUPS: { label: string; colors: string[] }[] = [{ label: 'Dark',  colors: [...PALETTE_RIVER_OUTLINE] }]
const CANAL_FILL_GROUPS:   { label: string; colors: string[] }[] = [{ label: 'Teal',  colors: [...PALETTE_CANAL] }]
const CANAL_STROKE_GROUPS: { label: string; colors: string[] }[] = [{ label: 'Dark',  colors: [...PALETTE_CANAL_OUTLINE] }]

// ── SubLabel ──────────────────────────────────────────────────────────────────

function SubLabel({ label }: { label: string }) {
  return (
    <div style={{ padding: '6px 14px 2px', fontFamily: TK.mono, fontSize: 9, letterSpacing: 0.8, color: TK.inkFaint, textTransform: 'uppercase', fontWeight: 600 }}>
      {label}
    </div>
  )
}

// ── FetchButton ───────────────────────────────────────────────────────────────

function FetchButton({ label, status, onFetch, onClear }: {
  label: string; status: string; onFetch: () => void; onClear?: () => void
}) {
  const loading = status === 'loading'
  const done = status === 'done'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 14px' }}>
      <button
        onClick={onFetch}
        disabled={loading}
        style={{
          flex: 1, padding: '5px 0',
          background: 'none',
          border: `1px solid ${loading ? TK.line : TK.rust}`,
          color: loading ? TK.inkFaint : TK.rust,
          cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: TK.mono, fontSize: 10, letterSpacing: 0.3,
        }}
      >
        {loading ? 'fetching…' : `Fetch ${label}`}
      </button>
      {done && onClear && (
        <button
          onClick={onClear}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: TK.mono, fontSize: 9, color: TK.inkFaint }}
        >
          clear
        </button>
      )}
    </div>
  )
}

// ── RiverSettingsView ─────────────────────────────────────────────────────────

function RiverSettingsView({ onBack }: { onBack: () => void }) {
  const {
    riverStyle, setRiverStyle,
    riverWidthScale, setRiverWidthScale,
    riverWiggleAmp, setRiverWiggleAmp,
    riverWiggleFreq, setRiverWiggleFreq,
    riverSmoothing, setRiverSmoothing,
    riverPathSmoothing, setRiverPathSmoothing,
  } = useMapStore()

  const isModified =
    riverStyle.color !== DEFAULT_RIVER_STYLE.color ||
    riverStyle.strokeEnabled !== DEFAULT_RIVER_STYLE.strokeEnabled ||
    riverStyle.strokeColor !== DEFAULT_RIVER_STYLE.strokeColor ||
    riverStyle.strokeWidth !== DEFAULT_RIVER_STYLE.strokeWidth

  return (
    <DetailViewShell header={
      <SidebarDetailHeader
        title="River"
        onBack={onBack}
        status={isModified ? 'modified' : 'default'}
        onReset={isModified ? () => setRiverStyle({ ...DEFAULT_RIVER_STYLE }) : undefined}
      />
    }>

      <SubLabel label="Colour" />
      <BigColorSwatch value={riverStyle.color} onChange={c => setRiverStyle({ color: c })} groups={RIVER_FILL_GROUPS} />

      <div style={{ borderTop: `1px solid ${TK.line2}` }}>
        <SubLabel label="Width" />
        <MiniSlider label="Scale" display={`${riverWidthScale.toFixed(1)}×`} value={Math.round(riverWidthScale * 10)} min={2} max={40} step={1} onChange={v => setRiverWidthScale(v / 10)} />
      </div>

      <div style={{ borderTop: `1px solid ${TK.line2}` }}>
        <SubLabel label="Wiggle" />
        <MiniSlider label="Amplitude" display={riverWiggleAmp.toFixed(2)}   value={Math.round(riverWiggleAmp * 100)} min={0}  max={100} step={1}  onChange={v => setRiverWiggleAmp(v / 100)} />
        <MiniSlider label="Frequency" display={riverWiggleFreq.toFixed(1)}  value={Math.round(riverWiggleFreq * 10)} min={5}  max={100} step={1}  onChange={v => setRiverWiggleFreq(v / 10)} />
      </div>

      <div style={{ borderTop: `1px solid ${TK.line2}` }}>
        <SubLabel label="Smoothing" />
        <MiniSlider label="Line smooth" display={String(riverSmoothing)}     value={riverSmoothing}     min={2}  max={30} step={1}  onChange={setRiverSmoothing} />
        <MiniSlider label="Path smooth" display={String(riverPathSmoothing)} value={riverPathSmoothing} min={0}  max={50} step={1}  onChange={setRiverPathSmoothing} />
      </div>

      <div style={{ borderTop: `1px solid ${TK.line2}` }}>
        <div style={{ padding: '6px 14px 4px' }}>
          <ToggleRow label="Outline" checked={riverStyle.strokeEnabled} onChange={v => setRiverStyle({ strokeEnabled: v })} />
        </div>
        {riverStyle.strokeEnabled && (
          <>
            <SubLabel label="Outline colour" />
            <BigColorSwatch value={riverStyle.strokeColor} onChange={c => setRiverStyle({ strokeColor: c })} groups={RIVER_STROKE_GROUPS} />
            <MiniSlider label="Width" display={`${Math.round(riverStyle.strokeWidth * 100)}%`} value={Math.round(riverStyle.strokeWidth * 100)} min={5} max={100} step={5} onChange={v => setRiverStyle({ strokeWidth: v / 100 })} />
          </>
        )}
      </div>

    </DetailViewShell>
  )
}

// ── CanalSettingsView ─────────────────────────────────────────────────────────

function CanalSettingsView({ onBack }: { onBack: () => void }) {
  const {
    canalStyle, setCanalStyle,
    canalWidthScale, setCanalWidthScale,
  } = useMapStore()

  const isModified =
    canalStyle.color !== DEFAULT_CANAL_STYLE.color ||
    canalStyle.strokeEnabled !== DEFAULT_CANAL_STYLE.strokeEnabled ||
    canalStyle.strokeColor !== DEFAULT_CANAL_STYLE.strokeColor ||
    canalStyle.strokeWidth !== DEFAULT_CANAL_STYLE.strokeWidth

  return (
    <DetailViewShell header={
      <SidebarDetailHeader
        title="Canal"
        onBack={onBack}
        status={isModified ? 'modified' : 'default'}
        onReset={isModified ? () => setCanalStyle({ ...DEFAULT_CANAL_STYLE }) : undefined}
      />
    }>

      <SubLabel label="Colour" />
      <BigColorSwatch value={canalStyle.color} onChange={c => setCanalStyle({ color: c })} groups={CANAL_FILL_GROUPS} />

      <div style={{ borderTop: `1px solid ${TK.line2}` }}>
        <SubLabel label="Width" />
        <MiniSlider label="Scale" display={`${canalWidthScale.toFixed(1)}×`} value={Math.round(canalWidthScale * 10)} min={2} max={40} step={1} onChange={v => setCanalWidthScale(v / 10)} />
      </div>

      <div style={{ borderTop: `1px solid ${TK.line2}` }}>
        <div style={{ padding: '6px 14px 4px' }}>
          <ToggleRow label="Outline" checked={canalStyle.strokeEnabled} onChange={v => setCanalStyle({ strokeEnabled: v })} />
        </div>
        {canalStyle.strokeEnabled && (
          <>
            <SubLabel label="Outline colour" />
            <BigColorSwatch value={canalStyle.strokeColor} onChange={c => setCanalStyle({ strokeColor: c })} groups={CANAL_STROKE_GROUPS} />
            <MiniSlider label="Width" display={`${Math.round(canalStyle.strokeWidth * 100)}%`} value={Math.round(canalStyle.strokeWidth * 100)} min={5} max={100} step={5} onChange={v => setCanalStyle({ strokeWidth: v / 100 })} />
          </>
        )}
      </div>

    </DetailViewShell>
  )
}

// ── LakeSettingsView ──────────────────────────────────────────────────────────

function LakeSettingsView({ onBack }: { onBack: () => void }) {
  const {
    lakeBlobSmooth, setLakeBlobSmooth,
    lakeBlobOffset, setLakeBlobOffset,
    lakeBlobBump, setLakeBlobBump,
    lakeBlobSweepFreq, setLakeBlobSweepFreq,
    lakeBlobLobeFreq, setLakeBlobLobeFreq,
    lakeBlobLobeAmp, setLakeBlobLobeAmp,
    lakeBlobLobeThreshold, setLakeBlobLobeThreshold,
    lakeBlobLobeDirection, setLakeBlobLobeDirection,
  } = useMapStore()

  return (
    <DetailViewShell header={
      <SidebarDetailHeader title="Lake" onBack={onBack} />
    }>

      <SubLabel label="Shape" />
      <MiniSlider label="Corner rounding" display={String(lakeBlobSmooth)}                                                           value={lakeBlobSmooth}                      min={0}   max={5}   step={1}   onChange={setLakeBlobSmooth} />
      <MiniSlider label="Waviness"        display={`${Math.round(lakeBlobBump * 100)}%`}                                             value={Math.round(lakeBlobBump * 100)}      min={0}   max={60}  step={1}   onChange={v => setLakeBlobBump(v / 100)} />
      <MiniSlider label="Inset"           display={`${lakeBlobOffset > 0 ? '+' : ''}${Math.round(lakeBlobOffset * 100)}%`}           value={Math.round(lakeBlobOffset * 100)}    min={-80} max={30}  step={1}   onChange={v => setLakeBlobOffset(v / 100)} />
      <MiniSlider label="Wave scale"      display={lakeBlobSweepFreq.toFixed(2)}                                                     value={Math.round(lakeBlobSweepFreq * 100)} min={40}  max={100} step={1}   onChange={v => setLakeBlobSweepFreq(v / 100)} />

      <div style={{ borderTop: `1px solid ${TK.line2}` }}>
        <SubLabel label="Fringe" />
        <MiniSlider label="Scale"    display={lakeBlobLobeFreq.toFixed(1)}                   value={Math.round(lakeBlobLobeFreq * 10)}      min={20} max={50}  step={1} onChange={v => setLakeBlobLobeFreq(v / 10)} />
        <MiniSlider label="Strength" display={`${Math.round(lakeBlobLobeAmp * 100)}%`}       value={Math.round(lakeBlobLobeAmp * 100)}      min={0}  max={100} step={1} onChange={v => setLakeBlobLobeAmp(v / 100)} />
        <MiniSlider label="Sparsity" display={`${Math.round(lakeBlobLobeThreshold * 100)}%`} value={Math.round(lakeBlobLobeThreshold * 100)} min={0}  max={40}  step={1} onChange={v => setLakeBlobLobeThreshold(v / 100)} />
        <div style={{ padding: '4px 14px 8px' }}>
          <SegmentedControl
            options={[{ value: 'outward', label: 'Outward' }, { value: 'inward', label: 'Inward' }]}
            value={lakeBlobLobeDirection >= 0 ? 'outward' : 'inward'}
            onChange={v => setLakeBlobLobeDirection(v === 'outward' ? 1 : -1)}
          />
        </div>
      </div>

    </DetailViewShell>
  )
}

// ── SegmentView ───────────────────────────────────────────────────────────────

function SegmentView({ mode, onBack }: { mode: 'river' | 'canal'; onBack: () => void }) {
  const {
    riverWidthScale, canalWidthScale,
    riverWiggleAmp, riverWiggleFreq,
    riverSegmentProps, canalSegmentProps,
    selectedSegmentKeys, selectedCanalSegmentKeys,
    setRiverSegmentProp, setRiverSegmentPropMany, clearRiverSegmentPropMany,
    setCanalSegmentProp, setCanalSegmentPropMany, clearCanalSegmentPropMany,
    riverHopProps, setRiverHopProp, clearRiverHopProp,
    selectedHopKey, setSelectedHopKey,
    riverStyle, canalStyle,
  } = useMapStore()

  const isRiver = mode === 'river'
  const selectedKeys   = isRiver ? selectedSegmentKeys        : selectedCanalSegmentKeys
  const segmentProps   = isRiver ? riverSegmentProps          : canalSegmentProps
  const baseWidth      = isRiver ? riverWidthScale            : canalWidthScale
  const setProp        = isRiver ? setRiverSegmentProp        : setCanalSegmentProp
  const setPropMany    = isRiver ? setRiverSegmentPropMany    : setCanalSegmentPropMany
  const clearPropMany  = isRiver ? clearRiverSegmentPropMany  : clearCanalSegmentPropMany

  const n          = selectedKeys.length
  const firstProps = segmentProps[selectedKeys[0]]
  const widthVal   = firstProps?.width          ?? baseWidth
  const taperVal   = firstProps?.taper          ?? 0
  const taperRange = (firstProps?.taperRange    ?? [0, 1]) as [number, number]
  const taperFlipped = taperRange[0] > taperRange[1]
  const wiggleAmp  = firstProps?.wiggleAmp      ?? riverWiggleAmp
  const wiggleFreq = firstProps?.wiggleFreq     ?? riverWiggleFreq
  const pathSmooth = (firstProps as { pathSmoothing?: number } | undefined)?.pathSmoothing ?? 0

  const anyOverride = selectedKeys.some(k => segmentProps[k] !== undefined)

  const hp           = isRiver && selectedHopKey ? riverHopProps[selectedHopKey] : null
  const hopHasOverride = !!hp

  return (
    <DetailViewShell header={
      <SidebarDetailHeader
        title={`${n} segment${n !== 1 ? 's' : ''}`}
        onBack={onBack}
        status={anyOverride ? 'modified' : 'default'}
        onReset={anyOverride ? () => { clearPropMany(selectedKeys); if (isRiver) setSelectedHopKey(null) } : undefined}
      />
    }>

      {/* Width */}
      <SubLabel label="Width" />
      <MiniSlider
        label="Scale"
        display={`${Math.round(widthVal * 100)}%${firstProps?.width !== undefined ? ' ●' : ''}`}
        value={Math.round(widthVal * 100)}
        min={25} max={400} step={5}
        onChange={v => setPropMany(selectedKeys, { width: v / 100 })}
      />

      {/* Taper */}
      <div style={{ borderTop: `1px solid ${TK.line2}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 14px 2px' }}>
          <span style={{ fontFamily: TK.mono, fontSize: 9, letterSpacing: 0.8, color: TK.inkFaint, textTransform: 'uppercase', fontWeight: 600 }}>Taper</span>
          <button
            onClick={() => {
              for (const key of selectedKeys) {
                const tr = (segmentProps[key]?.taperRange ?? [0, 1]) as [number, number]
                setProp(key, { taperRange: [tr[1], tr[0]] })
              }
            }}
            title="Flip taper direction"
            style={{ background: 'none', border: `1px solid ${TK.line}`, color: TK.inkMute, cursor: 'pointer', fontFamily: TK.mono, fontSize: 10, padding: '1px 6px', lineHeight: 1.4 }}
          >
            ⇄ flip
          </button>
        </div>
        <MiniSlider
          label={taperFlipped ? 'Wide → narrow' : 'Narrow → wide'}
          display={`${Math.round(taperVal * 100)}%${firstProps?.taper !== undefined ? ' ●' : ''}`}
          value={Math.round(taperVal * 100)}
          min={0} max={100} step={5}
          onChange={v => {
            const taper = v / 100
            if (selectedKeys.length === 1) {
              setProp(selectedKeys[0], { taper, taperRange: taperFlipped ? [1, 0] : [0, 1] })
            } else {
              const ranges = computeTaperRanges(selectedKeys, riverChainCache.chains)
              for (const key of selectedKeys) {
                const tr = (ranges[key] ?? [0, 1]) as [number, number]
                setProp(key, { taper, taperRange: taperFlipped ? [tr[1], tr[0]] : tr })
              }
            }
          }}
        />
      </div>

      {/* Wiggle + path smooth (river only) */}
      {isRiver && (
        <div style={{ borderTop: `1px solid ${TK.line2}` }}>
          <SubLabel label="Wiggle" />
          <MiniSlider label="Amplitude"   display={`${Math.round(wiggleAmp * 100)}%${firstProps?.wiggleAmp !== undefined ? ' ●' : ''}`} value={Math.round(wiggleAmp * 100)}  min={0} max={100} step={1} onChange={v => setRiverSegmentPropMany(selectedKeys, { wiggleAmp: v / 100 })} />
          <MiniSlider label="Frequency"   display={`${wiggleFreq.toFixed(1)}${firstProps?.wiggleFreq !== undefined ? ' ●' : ''}`}       value={Math.round(wiggleFreq * 10)} min={5} max={100} step={1} onChange={v => setRiverSegmentPropMany(selectedKeys, { wiggleFreq: v / 10 })} />
          <MiniSlider label="Path smooth" display={`${pathSmooth}${(firstProps as { pathSmoothing?: number } | undefined)?.pathSmoothing !== undefined ? ' ●' : ''}`} value={pathSmooth} min={0} max={50} step={1} onChange={v => setRiverSegmentPropMany(selectedKeys, { pathSmoothing: v } as Parameters<typeof setRiverSegmentPropMany>[1])} />
        </div>
      )}

      {/* Hop (river only, visible when a hop is selected) */}
      {isRiver && selectedHopKey && (() => {
        const ampVal  = hp?.wiggleAmp ?? wiggleAmp
        const freqVal = hp?.wiggleFreq ?? wiggleFreq
        const hopW    = hp?.width  ?? 1
        const hopT    = hp?.taper  ?? 0
        return (
          <div style={{ borderTop: `1px solid ${TK.line2}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 14px 2px' }}>
              <span style={{ fontFamily: TK.mono, fontSize: 9, letterSpacing: 0.8, color: TK.inkFaint, textTransform: 'uppercase', fontWeight: 600 }}>
                Hop{hopHasOverride ? ' ●' : ''}
              </span>
              {hopHasOverride && (
                <button
                  onClick={() => { clearRiverHopProp(selectedHopKey); setSelectedHopKey(null) }}
                  style={{ background: 'none', border: 'none', color: TK.inkFaint, cursor: 'pointer', fontFamily: TK.mono, fontSize: 9 }}
                >
                  ↺ reset
                </button>
              )}
            </div>
            <MiniSlider label="Width"       display={`${Math.round(hopW * 100)}%`}       value={Math.round(hopW * 100)}  min={25} max={400} step={5}  onChange={v => setRiverHopProp(selectedHopKey, { width: v / 100 })} />
            <MiniSlider label="Taper"       display={`${Math.round(hopT * 100)}%`}        value={Math.round(hopT * 100)}  min={0}  max={100} step={5}  onChange={v => setRiverHopProp(selectedHopKey, { taper: v / 100 })} />
            <MiniSlider label="Wiggle amp"  display={`${Math.round(ampVal * 100)}%`}      value={Math.round(ampVal * 100)} min={0}  max={100} step={1} onChange={v => setRiverHopProp(selectedHopKey, { wiggleAmp: v / 100 })} />
            <MiniSlider label="Wiggle freq" display={freqVal.toFixed(1)}                  value={Math.round(freqVal * 10)} min={5}  max={100} step={1} onChange={v => setRiverHopProp(selectedHopKey, { wiggleFreq: v / 10 })} />
          </div>
        )
      })()}

    </DetailViewShell>
  )
}

// ── RiversSidebarV2 ───────────────────────────────────────────────────────────

type ViewId = 'list' | 'river-settings' | 'canal-settings' | 'lake-settings' | 'segment'

export function RiversSidebarV2() {
  const {
    riverEdges, canalEdges,
    riverEditMode, canalEditMode, lakePaintMode, riverNodeEditMode,
    riverSelectMode, canalSelectMode,
    setActiveTool,
    autoLakesEnabled, setAutoLakesEnabled,
    lakeSensitivity, setLakeSensitivity,
    selectedSegmentKeys, setSelectedSegmentKeys,
    selectedCanalSegmentKeys, setSelectedCanalSegmentKeys,
    riverStyle, canalStyle,
    osmRiverWays, riversOsmStatus, riversOsmError,
    hoveredOsmRiverIdx, appliedOsmRiverIndices,
    fetchRivers, toggleOsmRiver, setHoveredOsmRiverIdx, clearOsmRivers,
    dataSource,
  } = useMapStore()

  const [view, setView] = useState<ViewId>('list')
  const [segmentMode, setSegmentMode] = useState<'river' | 'canal'>('river')
  const [osmListOpen, setOsmListOpen] = useState(false)

  // Expand the OSM list automatically when a fetch completes
  useEffect(() => {
    if (riversOsmStatus === 'done' && osmRiverWays.length > 0) setOsmListOpen(true)
  }, [riversOsmStatus, osmRiverWays.length])

  // Auto-navigate to segment view when segments are selected
  useEffect(() => {
    if (selectedSegmentKeys.length > 0) {
      setSegmentMode('river')
      setView('segment')
    } else if (selectedCanalSegmentKeys.length > 0) {
      setSegmentMode('canal')
      setView('segment')
    } else if (view === 'segment') {
      setView('list')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSegmentKeys.length, selectedCanalSegmentKeys.length])

  if (view === 'river-settings') return <RiverSettingsView onBack={() => setView('list')} />
  if (view === 'canal-settings') return <CanalSettingsView onBack={() => setView('list')} />
  if (view === 'lake-settings')  return <LakeSettingsView  onBack={() => setView('list')} />
  if (view === 'segment') return (
    <SegmentView
      mode={segmentMode}
      onBack={() => {
        if (segmentMode === 'river') setSelectedSegmentKeys([])
        else setSelectedCanalSegmentKeys([])
        setView('list')
      }}
    />
  )

  const hint =
    riverEditMode && riverSelectMode ? 'Click a segment to select. Cmd+click for a hop.'
    : riverEditMode                  ? 'Click hex edges to paint a river.'
    : canalEditMode && canalSelectMode ? 'Click a canal segment to select.'
    : canalEditMode                  ? 'Click hex edges to paint a canal.'
    : lakePaintMode                  ? 'Click or drag hexes to mark or unmark as lakes.'
    : null

  return (
    <SidebarShell>
      <SidebarHeader title="Rivers" />

      {/* ── OSM fetch ── */}
      {dataSource === 'osm' && (
        <SidebarSection label="OSM">
          <FetchButton
            label="Rivers"
            status={riversOsmStatus}
            onFetch={() => fetchRivers()}
            onClear={clearOsmRivers}
          />
          {riversOsmStatus === 'error' && riversOsmError && (
            <div style={{ padding: '2px 14px 4px', fontFamily: TK.sans, fontSize: 10.5, color: TK.rust }}>{riversOsmError}</div>
          )}
          {riversOsmStatus === 'done' && osmRiverWays.length === 0 && (
            <div style={{ padding: '2px 14px 4px', fontFamily: TK.sans, fontSize: 10.5, color: TK.inkMute }}>No named rivers found.</div>
          )}
          {riversOsmStatus === 'done' && osmRiverWays.length > 0 && (
            <>
              {/* Collapsible toggle row */}
              <button
                onClick={() => setOsmListOpen(o => !o)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '8px 14px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: TK.mono, fontSize: 10, color: TK.inkMute, letterSpacing: 0.3,
                  textAlign: 'left',
                }}
              >
                <span>{osmRiverWays.length} river{osmRiverWays.length !== 1 ? 's' : ''}</span>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                  style={{ transform: osmListOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s ease' }}
                >
                  <path d="M2 3.5l3 3 3-3" />
                </svg>
              </button>

              {osmListOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '2px 14px 8px' }}>
                  {osmRiverWays.map((way, idx) => {
                    const applied = appliedOsmRiverIndices.includes(idx)
                    const hovered = hoveredOsmRiverIdx === idx
                    const dotColor = way.type === 'river' ? riverStyle.color : canalStyle.color
                    return (
                      <div
                        key={idx}
                        onMouseEnter={() => setHoveredOsmRiverIdx(idx)}
                        onMouseLeave={() => setHoveredOsmRiverIdx(null)}
                        onClick={() => toggleOsmRiver(idx)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '6px 8px', cursor: 'pointer',
                          background: hovered ? tintBg(dotColor, 0.08) : 'transparent',
                          border: `1px solid ${applied ? dotColor : 'transparent'}`,
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: applied ? dotColor : TK.line }} />
                        <span style={{ flex: 1, fontFamily: TK.sans, fontSize: 11, color: applied ? TK.ink : TK.inkMute, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {way.name || `(unnamed ${way.type})`}
                        </span>
                        {applied && <span style={{ fontSize: 9, color: dotColor, flexShrink: 0 }}>✓</span>}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </SidebarSection>
      )}

      {/* ── Paint tools ── */}
      <SidebarSection label="Paint">
        <BrushRow
          label="River"
          color={riverStyle.color}
          active={riverEditMode}
          shortcut="1"
          showCog
          cogOpen={false}
          onSelect={() => setActiveTool(riverEditMode ? { type: 'none' } : { type: 'river-paint' })}
          onCog={() => setView('river-settings')}
        />
        {riverEditMode && (
          <BrushRow
            label="Select segment"
            color={riverSelectMode ? riverStyle.color : TK.inkFaint}
            active={riverSelectMode}
            onSelect={() => setActiveTool(riverSelectMode ? { type: 'river-paint' } : { type: 'river-select' })}
          />
        )}

        <BrushRow
          label="Canal"
          color={canalStyle.color}
          active={canalEditMode}
          shortcut="2"
          showCog
          cogOpen={false}
          onSelect={() => setActiveTool(canalEditMode ? { type: 'none' } : { type: 'canal-paint' })}
          onCog={() => setView('canal-settings')}
        />
        {canalEditMode && (
          <BrushRow
            label="Select segment"
            color={canalSelectMode ? canalStyle.color : TK.inkFaint}
            active={canalSelectMode}
            onSelect={() => setActiveTool(canalSelectMode ? { type: 'canal-paint' } : { type: 'canal-select' })}
          />
        )}

        <BrushRow
          label="Lake"
          color={LAKE_COLOR}
          active={lakePaintMode}
          shortcut="3"
          showCog
          cogOpen={false}
          onSelect={() => setActiveTool(lakePaintMode ? { type: 'none' } : { type: 'lake' })}
          onCog={() => setView('lake-settings')}
        />

        <BrushRow
          label="Edit nodes"
          color={riverNodeEditMode ? '#8ab8d8' : TK.inkFaint}
          active={riverNodeEditMode}
          shortcut="4"
          onSelect={() => setActiveTool(riverNodeEditMode ? { type: 'none' } : { type: 'river-node-edit' })}
        />

        {hint && (
          <div style={{ padding: '4px 14px 2px', fontFamily: TK.sans, fontSize: 10.5, color: TK.inkMute, lineHeight: 1.5 }}>
            {hint}
          </div>
        )}
        {(riverEdges.length > 0 || canalEdges.length > 0) && (
          <div style={{ padding: '4px 14px 2px', fontFamily: TK.mono, fontSize: 9.5, color: TK.inkFaint, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {riverEdges.length > 0 && <span>{riverEdges.length} river edge{riverEdges.length !== 1 ? 's' : ''}</span>}
            {canalEdges.length > 0 && <span>{canalEdges.length} canal edge{canalEdges.length !== 1 ? 's' : ''}</span>}
          </div>
        )}
      </SidebarSection>

      {/* ── Auto Lakes ── */}
      <SidebarSection label="Auto Lakes">
        <div style={{ padding: '0 14px 4px' }}>
          <ToggleRow label="Detect automatically" checked={autoLakesEnabled} onChange={setAutoLakesEnabled} />
        </div>
        {autoLakesEnabled && (
          <MiniSlider
            label="Sensitivity"
            display={`${Math.round(lakeSensitivity * 100)}%`}
            value={Math.round(lakeSensitivity * 100)}
            min={5} max={95} step={1}
            onChange={v => setLakeSensitivity(v / 100)}
          />
        )}
      </SidebarSection>

    </SidebarShell>
  )
}
