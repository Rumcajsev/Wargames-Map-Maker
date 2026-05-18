import { useState } from 'react'
import { useMapStore, type SettlementTier } from '../store/mapStore'
import { SettlementsSettingsFlyout } from './SettlementsSettingsFlyout'
import { UrbanSettingsFlyout } from './UrbanSettingsFlyout'
import { sidebarStyle, sectionStyle, labelStyle } from './sidebarStyles'

const CogIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.92c.04-.34.07-.68.07-1.08s-.03-.74-.07-1.08l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.34-.07.69-.07 1.08s.03.74.07 1.08L2.7 13.07c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.58 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65z" />
  </svg>
)

const TIER_LABELS: Record<SettlementTier, string> = {
  1: 'Tier I',
  2: 'Tier II',
  3: 'Tier III',
  4: 'Tier IV',
}

function TierIcon({ shape, size, fill, stroke, strokeWidth }: { shape: 'circle' | 'square', size: number, fill: string, stroke: string, strokeWidth: number }) {
  const s = 18
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
  } = useMapStore()

  const [openSettings, setOpenSettings] = useState<SettlementTier | null>(null)
  const [settingsAnchorY, setSettingsAnchorY] = useState(0)
  const [urbanFlyoutOpen, setUrbanFlyoutOpen] = useState(false)
  const [urbanFlyoutY, setUrbanFlyoutY] = useState(0)
  const [hoveredTier, setHoveredTier] = useState<SettlementTier | null>(null)
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
    setSettlementPlaceTier(tier)
    setSettlementMoveIndex(null)
  }

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
              const active = settlementPlaceTier === tier
              const hovered = hoveredTier === tier
              return (
                <div
                  key={tier}
                  style={{ position: 'relative' }}
                  onMouseEnter={() => setHoveredTier(tier)}
                  onMouseLeave={() => setHoveredTier(null)}
                >
                  <button
                    onClick={() => selectTier(tier)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      width: '100%', padding: '5px 8px',
                      background: active ? '#1a2a1a' : 'none',
                      border: `1px solid ${active ? '#4a7a4a' : '#1e1f2e'}`,
                      borderRadius: 3, color: active ? '#a0d0a0' : '#7a7a9a',
                      cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, textAlign: 'left',
                    }}
                  >
                    <TierIcon shape={ts.shape} size={ts.size} fill={ts.fillColor} stroke={ts.strokeColor} strokeWidth={ts.strokeWidth} />
                    <span>{TIER_LABELS[tier]}</span>
                  </button>
                  {hovered && (
                    <button
                      data-settlements-flyout=""
                      onClick={e => { e.stopPropagation(); handleCog(tier, e.currentTarget.getBoundingClientRect().top) }}
                      title={`${TIER_LABELS[tier]} settings`}
                      style={{
                        position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', color: '#5a5a8a', cursor: 'pointer',
                        padding: '2px 3px', display: 'flex', alignItems: 'center', borderRadius: 2, lineHeight: 1,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#c0c0e0')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#5a5a8a')}
                    >
                      <CogIcon />
                    </button>
                  )}
                </div>
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
        <div style={sectionStyle}>
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
              <div style={{ ...labelStyle, marginBottom: 4 }}>
                {osmSettlements.filter(({ s }) => s.hex_q !== null).length}/{osmSettlements.length} on map
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
        </div>

      </div>
    </>
  )
}
