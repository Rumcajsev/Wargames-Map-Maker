import { useEffect } from 'react'
import { useMapStore, DEFAULT_URBAN_STYLE } from '../store/mapStore'
import { ColorSwatch } from './ColorSwatch'
import { PALETTE_BUILDINGS, PALETTE_BUILDING_STROKE } from '../palettes'
import { FlyoutContainer, FlyoutHeader } from './ui'

interface Props {
  anchorY: number
  onClose: () => void
}

const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', marginBottom: 3 }
const labelStyle: React.CSSProperties = { fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a' }
const valueStyle: React.CSSProperties = { color: '#5a5a7a', fontSize: 10 }

export function UrbanSettingsFlyout({ anchorY, onClose }: Props) {
  const { urbanStyle, setUrbanStyle } = useMapStore()
  const s = urbanStyle

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-urban-flyout]')) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const top = Math.min(anchorY, window.innerHeight - 400 - 8)

  return (
    <FlyoutContainer top={top} width={210} data-urban-flyout="">
      <FlyoutHeader
        title="Urban Style"
        onClose={onClose}
        onReset={() => setUrbanStyle({ ...DEFAULT_URBAN_STYLE })}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <div style={{ ...rowStyle }}><span style={labelStyle}>Count</span><span style={valueStyle}>{s.buildingCount}</span></div>
          <input type="range" min={1} max={50} step={1} value={s.buildingCount}
            onChange={e => setUrbanStyle({ buildingCount: parseInt(e.target.value) })}
            style={{ width: '100%' }} />
        </div>
        <div>
          <div style={{ ...rowStyle }}><span style={labelStyle}>Road setback</span><span style={valueStyle}>{s.roadSetback}px</span></div>
          <input type="range" min={0} max={20} step={0.5} value={s.roadSetback}
            onChange={e => setUrbanStyle({ roadSetback: parseFloat(e.target.value) })}
            style={{ width: '100%' }} />
        </div>
        <div>
          <div style={{ ...rowStyle }}><span style={labelStyle}>Slot spacing</span><span style={valueStyle}>{s.slotSpacing.toFixed(1)}×</span></div>
          <input type="range" min={0.5} max={3} step={0.1} value={s.slotSpacing}
            onChange={e => setUrbanStyle({ slotSpacing: parseFloat(e.target.value) })}
            style={{ width: '100%' }} />
        </div>
        <div>
          <div style={{ ...rowStyle }}><span style={labelStyle}>Back row gap</span><span style={valueStyle}>{s.backRowGap}px</span></div>
          <input type="range" min={2} max={40} step={1} value={s.backRowGap}
            onChange={e => setUrbanStyle({ backRowGap: parseInt(e.target.value) })}
            style={{ width: '100%' }} />
        </div>
        <div>
          <div style={{ ...rowStyle }}><span style={labelStyle}>Back row prob</span><span style={valueStyle}>{Math.round(s.backRowProbability * 100)}%</span></div>
          <input type="range" min={0} max={1} step={0.05} value={s.backRowProbability}
            onChange={e => setUrbanStyle({ backRowProbability: parseFloat(e.target.value) })}
            style={{ width: '100%' }} />
        </div>
        <div>
          <div style={{ ...rowStyle }}><span style={labelStyle}>Angle jitter</span><span style={valueStyle}>{s.angleJitter.toFixed(2)} rad</span></div>
          <input type="range" min={0} max={1.57} step={0.01} value={s.angleJitter}
            onChange={e => setUrbanStyle({ angleJitter: parseFloat(e.target.value) })}
            style={{ width: '100%' }} />
        </div>
        <div>
          <div style={{ ...rowStyle }}><span style={labelStyle}>Size</span><span style={valueStyle}>{s.buildingSizeMin}–{s.buildingSizeMax}px</span></div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="range" min={1} max={20} step={0.5} value={s.buildingSizeMin}
              onChange={e => setUrbanStyle({ buildingSizeMin: parseFloat(e.target.value) })}
              style={{ flex: 1 }} />
            <input type="range" min={1} max={20} step={0.5} value={s.buildingSizeMax}
              onChange={e => setUrbanStyle({ buildingSizeMax: parseFloat(e.target.value) })}
              style={{ flex: 1 }} />
          </div>
        </div>
        <div>
          <div style={{ ...labelStyle, marginBottom: 5 }}>Fill</div>
          <ColorSwatch value={s.buildingColor} onChange={v => setUrbanStyle({ buildingColor: v })} palette={PALETTE_BUILDINGS} />
        </div>
        <div>
          <div style={{ ...rowStyle }}><span style={labelStyle}>Stroke</span><span style={valueStyle}>{s.buildingStrokeWidth}px</span></div>
          <div style={{ marginBottom: 6 }}>
            <ColorSwatch value={s.buildingStrokeColor} onChange={v => setUrbanStyle({ buildingStrokeColor: v })} palette={PALETTE_BUILDING_STROKE} />
          </div>
          <input type="range" min={0} max={2} step={0.1} value={s.buildingStrokeWidth}
            onChange={e => setUrbanStyle({ buildingStrokeWidth: parseFloat(e.target.value) })}
            style={{ width: '100%' }} />
        </div>
      </div>
    </FlyoutContainer>
  )
}
