import { useEffect } from 'react'
import { useMapStore, DEFAULT_SETTLEMENT_TIER_STYLES, type SettlementTier } from '../store/mapStore'
import { ColorSwatch } from './ColorSwatch'
import { PALETTE_SETTLEMENT_FILL, PALETTE_SETTLEMENT_STROKE, PALETTE_BUILDINGS, PALETTE_BUILDING_STROKE } from '../palettes'

interface Props {
  tier: SettlementTier
  anchorY: number
  onClose: () => void
}

const TIER_LABELS: Record<SettlementTier, string> = {
  1: 'Tier I',
  2: 'Tier II',
  3: 'Tier III',
  4: 'Tier IV',
}

const rowStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', marginBottom: 3,
}

const labelStyle: React.CSSProperties = {
  fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a',
}

const valueStyle: React.CSSProperties = {
  color: '#5a5a7a', fontSize: 10,
}

export function SettlementsSettingsFlyout({ tier, anchorY, onClose }: Props) {
  const { settlementTierStyles, setSettlementTierStyle } = useMapStore()
  const style = settlementTierStyles[tier]

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-settlements-flyout]')) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const top = Math.min(anchorY, window.innerHeight - 320 - 8)

  return (
    <div
      data-settlements-flyout=""
      style={{
        position: 'fixed',
        left: 204,
        top,
        width: 210,
        background: '#0e0f18',
        border: '1px solid #2a2a4a',
        borderRadius: 4,
        padding: '10px 12px',
        zIndex: 100,
        fontFamily: 'ui-monospace, monospace',
        fontSize: 11,
        color: '#a0a0c0',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ color: '#e0e0f0', letterSpacing: 0.5 }}>{TIER_LABELS[tier]}</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={() => setSettlementTierStyle(tier, { ...DEFAULT_SETTLEMENT_TIER_STYLES[tier] })}
            title="Reset to default"
            style={{ background: 'none', border: 'none', color: '#4a4a6a', cursor: 'pointer', padding: '0 2px', fontSize: 12, lineHeight: 1 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#a0a0c0')}
            onMouseLeave={e => (e.currentTarget.style.color = '#4a4a6a')}
          >↺</button>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#4a4a6a', cursor: 'pointer', padding: '0 2px', fontSize: 15, lineHeight: 1 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#a0a0c0')}
            onMouseLeave={e => (e.currentTarget.style.color = '#4a4a6a')}
          >×</button>
        </div>
      </div>

      {/* Mode toggle */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ ...labelStyle, marginBottom: 4 }}>Display</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['icon', 'buildings'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setSettlementTierStyle(tier, { displayMode: m })}
              style={{
                flex: 1, padding: '3px 0', fontSize: 10,
                background: style.displayMode === m ? '#1e2a3a' : 'none',
                border: `1px solid ${style.displayMode === m ? '#4a7aaa' : '#2a2a4a'}`,
                color: style.displayMode === m ? '#a0c0e0' : '#5a5a7a',
                borderRadius: 3, cursor: 'pointer',
              }}
            >{m}</button>
          ))}
        </div>
      </div>

      {/* Icon controls */}
      {style.displayMode === 'icon' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ ...labelStyle, marginBottom: 4 }}>Shape</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['circle', 'square'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSettlementTierStyle(tier, { shape: s })}
                  style={{
                    flex: 1, padding: '3px 0', fontSize: 10,
                    background: style.shape === s ? '#1e2a3a' : 'none',
                    border: `1px solid ${style.shape === s ? '#4a7aaa' : '#2a2a4a'}`,
                    color: style.shape === s ? '#a0c0e0' : '#5a5a7a',
                    borderRadius: 3, cursor: 'pointer',
                  }}
                >{s}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ ...rowStyle }}>
              <span style={labelStyle}>Size</span>
              <span style={valueStyle}>{style.size}</span>
            </div>
            <input type="range" min={1} max={12} step={0.5} value={style.size}
              onChange={e => setSettlementTierStyle(tier, { size: parseFloat(e.target.value) })}
              style={{ width: '100%' }} />
          </div>
          <div>
            <div style={{ ...labelStyle, marginBottom: 5 }}>Fill</div>
            <ColorSwatch value={style.fillColor} onChange={v => setSettlementTierStyle(tier, { fillColor: v })} palette={PALETTE_SETTLEMENT_FILL} />
          </div>
          <div>
            <div style={{ ...rowStyle }}>
              <span style={labelStyle}>Stroke</span>
              <span style={valueStyle}>{style.strokeWidth}px</span>
            </div>
            <div style={{ marginBottom: 6 }}>
              <ColorSwatch value={style.strokeColor} onChange={v => setSettlementTierStyle(tier, { strokeColor: v })} palette={PALETTE_SETTLEMENT_STROKE} />
            </div>
            <input type="range" min={0} max={3} step={0.1} value={style.strokeWidth}
              onChange={e => setSettlementTierStyle(tier, { strokeWidth: parseFloat(e.target.value) })}
              style={{ width: '100%' }} />
          </div>
        </div>
      )}

      {/* Buildings controls */}
      {style.displayMode === 'buildings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ ...rowStyle }}>
              <span style={labelStyle}>Count</span>
              <span style={valueStyle}>{style.buildingCount}</span>
            </div>
            <input type="range" min={1} max={40} step={1} value={style.buildingCount}
              onChange={e => setSettlementTierStyle(tier, { buildingCount: parseInt(e.target.value) })}
              style={{ width: '100%' }} />
          </div>
          <div>
            <div style={{ ...rowStyle }}>
              <span style={labelStyle}>Road setback</span>
              <span style={valueStyle}>{style.roadSetback}px</span>
            </div>
            <input type="range" min={0} max={20} step={0.5} value={style.roadSetback}
              onChange={e => setSettlementTierStyle(tier, { roadSetback: parseFloat(e.target.value) })}
              style={{ width: '100%' }} />
          </div>
          <div>
            <div style={{ ...rowStyle }}>
              <span style={labelStyle}>Slot spacing</span>
              <span style={valueStyle}>{style.slotSpacing.toFixed(1)}×</span>
            </div>
            <input type="range" min={0.5} max={3} step={0.1} value={style.slotSpacing}
              onChange={e => setSettlementTierStyle(tier, { slotSpacing: parseFloat(e.target.value) })}
              style={{ width: '100%' }} />
          </div>
          <div>
            <div style={{ ...rowStyle }}>
              <span style={labelStyle}>Back row gap</span>
              <span style={valueStyle}>{style.backRowGap}px</span>
            </div>
            <input type="range" min={2} max={40} step={1} value={style.backRowGap}
              onChange={e => setSettlementTierStyle(tier, { backRowGap: parseInt(e.target.value) })}
              style={{ width: '100%' }} />
          </div>
          <div>
            <div style={{ ...rowStyle }}>
              <span style={labelStyle}>Back row prob</span>
              <span style={valueStyle}>{Math.round(style.backRowProbability * 100)}%</span>
            </div>
            <input type="range" min={0} max={1} step={0.05} value={style.backRowProbability}
              onChange={e => setSettlementTierStyle(tier, { backRowProbability: parseFloat(e.target.value) })}
              style={{ width: '100%' }} />
          </div>
          <div>
            <div style={{ ...rowStyle }}>
              <span style={labelStyle}>Angle jitter</span>
              <span style={valueStyle}>{style.angleJitter.toFixed(2)} rad</span>
            </div>
            <input type="range" min={0} max={1.57} step={0.01} value={style.angleJitter}
              onChange={e => setSettlementTierStyle(tier, { angleJitter: parseFloat(e.target.value) })}
              style={{ width: '100%' }} />
          </div>
          <div>
            <div style={{ ...rowStyle }}>
              <span style={labelStyle}>Size</span>
              <span style={valueStyle}>{style.buildingSizeMin}–{style.buildingSizeMax}px</span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="range" min={1} max={20} step={0.5} value={style.buildingSizeMin}
                onChange={e => setSettlementTierStyle(tier, { buildingSizeMin: parseFloat(e.target.value) })}
                style={{ flex: 1 }} />
              <input type="range" min={1} max={20} step={0.5} value={style.buildingSizeMax}
                onChange={e => setSettlementTierStyle(tier, { buildingSizeMax: parseFloat(e.target.value) })}
                style={{ flex: 1 }} />
            </div>
          </div>
          <div>
            <div style={{ ...labelStyle, marginBottom: 5 }}>Fill</div>
            <ColorSwatch value={style.buildingColor} onChange={v => setSettlementTierStyle(tier, { buildingColor: v })} palette={PALETTE_BUILDINGS} />
          </div>
          <div>
            <div style={{ ...rowStyle }}>
              <span style={labelStyle}>Stroke</span>
              <span style={valueStyle}>{style.buildingStrokeWidth}px</span>
            </div>
            <div style={{ marginBottom: 6 }}>
              <ColorSwatch value={style.buildingStrokeColor} onChange={v => setSettlementTierStyle(tier, { buildingStrokeColor: v })} palette={PALETTE_BUILDING_STROKE} />
            </div>
            <input type="range" min={0} max={2} step={0.1} value={style.buildingStrokeWidth}
              onChange={e => setSettlementTierStyle(tier, { buildingStrokeWidth: parseFloat(e.target.value) })}
              style={{ width: '100%' }} />
          </div>
        </div>
      )}
    </div>
  )
}
