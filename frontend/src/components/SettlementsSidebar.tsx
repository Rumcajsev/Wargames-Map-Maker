import { useState, useEffect } from 'react'
import { useMapStore, type SettlementTier } from '../store/mapStore'
import { shouldSuppressShortcut } from '../lib/keyboard'
import { SettlementsSettingsFlyout } from './SettlementsSettingsFlyout'
import { UrbanSettingsFlyout } from './UrbanSettingsFlyout'
import { sidebarStyle, sectionStyle, labelStyle } from './sidebarStyles'
import { ToolButton, CogIcon } from './ToolButton'

const TIER_LABELS: Record<SettlementTier, string> = {
  1: 'Tier I',
  2: 'Tier II',
  3: 'Tier III',
  4: 'Tier IV',
}

function TierIcon({ shape, size, fill, stroke, strokeWidth }: { shape: 'circle' | 'square', size: number, fill: string, stroke: string, strokeWidth: number }) {
  const s = 14
  const c = s / 2
  const r = Math.min(size, 8)
  return (
    <svg width={s} height={s} style={{ flexShrink: 0 }}>
      {shape === 'circle'
        ? <circle cx={c} cy={c} r={r} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        : <rect x={c - r} y={c - r} width={r * 2} height={r * 2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      }
    </svg>
  )
}

function statusDot(status: string) {
  const color = status === 'done' ? '#5a9e6f' : status === 'loading' ? '#a0a060' : status === 'error' ? '#9e5a5a' : '#3a3a5a'
  return <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
}

function fmtPop(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return String(n)
}

export function SettlementsSidebar() {
  const {
    settlements,
    settlementPlaceTier, setSettlementPlaceTier,
    settlementTierStyles,
    deleteSettlement, updateSettlement,
    settlementMoveIndex, setSettlementMoveIndex,
    urbanHexes, urbanPaintMode,
    setActiveTool,
    settlementsStatus, settlementsError,
    fetchSettlements, clearSettlements,
    toggleSettlementPlaced,
    settlementsLimit, setSettlementsLimit,
    placeAllSettlements, removeAllSettlements,
    dataSource,
  } = useMapStore()

  const [openSettings, setOpenSettings] = useState<SettlementTier | null>(null)
  const [settingsAnchorY, setSettingsAnchorY] = useState(0)
  const [urbanFlyoutOpen, setUrbanFlyoutOpen] = useState(false)
  const [urbanFlyoutY, setUrbanFlyoutY] = useState(0)
  const [editingName, setEditingName] = useState<number | null>(null)
  const [editingNameValue, setEditingNameValue] = useState('')

  const allPlaced = settlements.filter((s) => s.isCustom && s.hex_q !== null)
  const osmSettlements = settlements
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !s.isCustom)

  const handleCog = (tier: SettlementTier, y: number) => {
    if (openSettings === tier) {
      setOpenSettings(null)
    } else {
      setOpenSettings(tier)
      setSettingsAnchorY(y)
    }
  }

  const selectTier = (tier: SettlementTier) => {
    setSettlementPlaceTier(settlementPlaceTier === tier ? null : tier)
    setSettlementMoveIndex(null)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return
      if (e.key === '1') selectTier(1)
      else if (e.key === '2') selectTier(2)
      else if (e.key === '3') selectTier(3)
      else if (e.key === '4') selectTier(4)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [settlementPlaceTier])

  const startRename = (index: number, currentName: string) => {
    setEditingName(index)
    setEditingNameValue(currentName)
  }

  const commitRename = (index: number) => {
    if (editingNameValue.trim()) updateSettlement(index, { name: editingNameValue.trim() })
    setEditingName(null)
  }

  const handleOsmClick = (index: number) => {
    toggleSettlementPlaced(index)
  }

  return (
    <>
      {openSettings !== null && (
        <SettlementsSettingsFlyout
          tier={openSettings}
          anchorY={settingsAnchorY}
          onClose={() => setOpenSettings(null)}
        />
      )}
      {urbanFlyoutOpen && (
        <UrbanSettingsFlyout
          anchorY={urbanFlyoutY}
          onClose={() => setUrbanFlyoutOpen(false)}
        />
      )}
      <div style={sidebarStyle}>

        {/* Place tools */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Place</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {([1, 2, 3, 4] as SettlementTier[]).map((tier) => {
              const ts = settlementTierStyles[tier]
              return (
                <ToolButton
                  key={tier}
                  label={TIER_LABELS[tier]}
                  active={settlementPlaceTier === tier}
                  icon={<TierIcon shape={ts.shape} size={ts.size} fill={ts.fillColor} stroke={ts.strokeColor} strokeWidth={ts.strokeWidth} />}
                  shortcut={String(tier)}
                  onSelect={() => selectTier(tier)}
                  onSettings={(y) => handleCog(tier, y)}
                  settingsOpen={openSettings === tier}
                  cogDataAttrib="data-settlements-flyout"
                  accentBg="#1a2a1a"
                  accentBorder="#4a7a4a"
                  accentText="#a0d0a0"
                />
              )
            })}
          </div>

        </div>

        {/* Placed settlements list (custom) */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Placed ({allPlaced.length})</div>
          {allPlaced.length === 0 && (
            <div style={{ color: '#3a3a5a', fontSize: 10, fontStyle: 'italic' }}>
              click a tier then click a hex
            </div>
          )}
          {settlements.map((s, i) => {
            if (!s.isCustom) return null
            const ts = settlementTierStyles[(s.tier ?? 2) as SettlementTier]
            const isMoving = settlementMoveIndex === i
            return (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 0', borderBottom: '1px solid #1a1a2a',
                }}
              >
                <TierIcon shape={ts.shape} size={ts.size} fill={ts.fillColor} stroke={ts.strokeColor} strokeWidth={ts.strokeWidth} />
                {editingName === i ? (
                  <input
                    autoFocus
                    value={editingNameValue}
                    onChange={(e) => setEditingNameValue(e.target.value)}
                    onBlur={() => commitRename(i)}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitRename(i); if (e.key === 'Escape') setEditingName(null) }}
                    style={{
                      flex: 1, background: '#1a1a2a', border: '1px solid #4a4a7a',
                      borderRadius: 2, color: '#c0c0e0', fontFamily: 'inherit', fontSize: 11, padding: '1px 4px',
                    }}
                  />
                ) : (
                  <span
                    style={{ flex: 1, fontSize: 11, color: '#a0a0c0', cursor: 'text', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title="Double-click to rename"
                    onDoubleClick={() => startRename(i, s.name)}
                  >{s.name}</span>
                )}
                <button
                  onClick={() => isMoving ? setSettlementMoveIndex(null) : setSettlementMoveIndex(i)}
                  title={isMoving ? 'Cancel move' : 'Move'}
                  style={{
                    background: isMoving ? '#1a2a1a' : 'none', border: `1px solid ${isMoving ? '#4a7a4a' : 'transparent'}`,
                    borderRadius: 2, color: isMoving ? '#a0d0a0' : '#4a4a6a', cursor: 'pointer', padding: '1px 3px', fontSize: 10,
                  }}
                >↔</button>
                <button
                  onClick={() => deleteSettlement(i)}
                  title="Delete"
                  style={{ background: 'none', border: 'none', color: '#6a3a3a', cursor: 'pointer', padding: '1px 3px', fontSize: 12 }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#c05050')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#6a3a3a')}
                >×</button>
              </div>
            )
          })}
        </div>

        {/* Urban areas */}
        <div style={sectionStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={labelStyle}>Urban ({urbanHexes.length})</div>
            <button
              data-urban-flyout=""
              onClick={e => { setUrbanFlyoutY(e.currentTarget.getBoundingClientRect().top); setUrbanFlyoutOpen(v => !v) }}
              title="Urban style settings"
              style={{ background: 'none', border: 'none', color: '#5a5a8a', cursor: 'pointer', padding: '2px 3px', display: 'flex', alignItems: 'center', borderRadius: 2 }}
              onMouseEnter={e => (e.currentTarget.style.color = '#c0c0e0')}
              onMouseLeave={e => (e.currentTarget.style.color = '#5a5a8a')}
            ><CogIcon /></button>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['paint', 'erase'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setActiveTool(urbanPaintMode === mode ? { type: 'none' } : { type: 'urban', mode })}
                style={{
                  flex: 1, padding: '4px 0', fontSize: 10,
                  background: urbanPaintMode === mode ? (mode === 'erase' ? '#2a1a1a' : '#1a2a1a') : 'none',
                  border: `1px solid ${urbanPaintMode === mode ? (mode === 'erase' ? '#7a3a3a' : '#4a7a4a') : '#2a2a4a'}`,
                  color: urbanPaintMode === mode ? (mode === 'erase' ? '#d08080' : '#a0d0a0') : '#5a5a7a',
                  borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >{mode === 'paint' ? '✎ paint' : '✕ erase'}</button>
            ))}
          </div>
        </div>

        {/* From OSM */}
        {dataSource === 'osm' && <div style={sectionStyle}>
          <div style={labelStyle}>From OSM</div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {statusDot(settlementsStatus)}
              <span style={{ color: '#6a6a8a' }}>Settlements</span>
            </div>
            {settlementsStatus === 'done' && (
              <button
                onClick={clearSettlements}
                style={{ background: 'none', border: 'none', color: '#5a3a3a', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit', padding: 0 }}
                onMouseEnter={e => (e.currentTarget.style.color = '#9e5a5a')}
                onMouseLeave={e => (e.currentTarget.style.color = '#5a3a3a')}
              >clear</button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ color: '#5a5a7a', fontSize: 10, flexShrink: 0 }}>Limit</span>
            <input
              type="number"
              min={1}
              max={500}
              value={settlementsLimit}
              onChange={e => setSettlementsLimit(Math.max(1, Math.min(500, Number(e.target.value))))}
              style={{
                width: 52, padding: '2px 4px',
                background: '#12131e', border: '1px solid #2a2a4a',
                borderRadius: 3, color: '#a0a0c0', fontFamily: 'inherit', fontSize: 11,
              }}
            />
          </div>

          <button
            onClick={fetchSettlements}
            disabled={settlementsStatus === 'loading'}
            style={{
              width: '100%', padding: '4px 0',
              background: 'none', border: '1px solid #2a3a4a',
              color: settlementsStatus === 'loading' ? '#3a4a5a' : '#5a8ab0',
              borderRadius: 3, cursor: settlementsStatus === 'loading' ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', fontSize: 11,
            }}
          >
            {settlementsStatus === 'loading' ? 'fetching…' : 'Fetch Settlements'}
          </button>

          {settlementsStatus === 'error' && settlementsError && (
            <div style={{ color: '#9e5a5a', fontSize: 10, marginTop: 3 }}>{settlementsError}</div>
          )}

          {settlementsStatus === 'done' && osmSettlements.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={labelStyle}>
                  {osmSettlements.filter(({ s }) => s.hex_q !== null).length}/{osmSettlements.length} on map
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={placeAllSettlements}
                    title="Place all"
                    style={{ background: 'none', border: '1px solid #2a4a2a', borderRadius: 2, color: '#5a8a5a', cursor: 'pointer', fontSize: 9, fontFamily: 'inherit', padding: '1px 5px' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#a0d0a0')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#5a8a5a')}
                  >all</button>
                  <button
                    onClick={removeAllSettlements}
                    title="Remove all"
                    style={{ background: 'none', border: '1px solid #4a2a2a', borderRadius: 2, color: '#8a5a5a', cursor: 'pointer', fontSize: 9, fontFamily: 'inherit', padding: '1px 5px' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#d0a0a0')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#8a5a5a')}
                  >none</button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 220, overflowY: 'auto' }}>
                {osmSettlements.map(({ s, i }) => {
                  const placed = s.hex_q !== null
                  const tier = (s.tier ?? 4) as SettlementTier
                  const ts = settlementTierStyles[tier]
                  const hov = false
                  return (
                    <div
                      key={i}
                      onClick={() => handleOsmClick(i)}
                      title={placed ? 'Click to remove from map' : 'Click to place on map'}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '3px 5px', borderRadius: 3, cursor: 'pointer',
                        background: placed ? '#1a2a1a' : 'none',
                        border: `1px solid ${placed ? '#2a4a2a' : '#1e1f2e'}`,
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = placed ? '#1e3a1e' : '#1a1b2a' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = placed ? '#1a2a1a' : 'none' }}
                    >
                      <TierIcon shape={ts.shape} size={ts.size} fill={ts.fillColor} stroke={ts.strokeColor} strokeWidth={ts.strokeWidth} />
                      <span style={{
                        flex: 1, fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        color: placed ? '#a0c8a0' : '#5a5a7a',
                      }}>{s.name}</span>
                      <span style={{ fontSize: 9, color: placed ? '#5a8a5a' : '#3a3a5a', flexShrink: 0 }}>
                        {fmtPop(s.population)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>}

      </div>
    </>
  )
}
