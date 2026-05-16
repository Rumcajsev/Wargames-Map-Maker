import { useEffect } from 'react'
import { useMapStore, LAKE_COLOR } from '../store/mapStore'
import { ColorSwatch } from './ColorSwatch'
import {
  PALETTE_RIVER, PALETTE_RIVER_OUTLINE,
  PALETTE_CANAL, PALETTE_CANAL_OUTLINE,
} from '../palettes'



interface Props {
  type: 'river' | 'canal' | 'lake'
  anchorY: number
  onClose: () => void
}

const Row = ({ label, value, children }: { label: string; value: string; children: React.ReactNode }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
      <span style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a' }}>{label}</span>
      <span style={{ color: '#5a5a7a', fontSize: 10 }}>{value}</span>
    </div>
    {children}
  </div>
)

export function RiversSettingsFlyout({ type, anchorY, onClose }: Props) {
  const {
    riverWidthScale, setRiverWidthScale,
    canalWidthScale, setCanalWidthScale,
    riverCurveSteps, setRiverCurveSteps,
    riverWobble, setRiverWobble,
    riverDetail, setRiverDetail,
    riverStyle, setRiverStyle,
    canalStyle, setCanalStyle,
    lakeBlobSmooth, setLakeBlobSmooth,
    lakeBlobOffset, setLakeBlobOffset,
    lakeBlobBump, setLakeBlobBump,
    lakeBlobSweepFreq, setLakeBlobSweepFreq,
    lakeBlobLobeFreq, setLakeBlobLobeFreq,
    lakeBlobLobeAmp, setLakeBlobLobeAmp,
    lakeBlobLobeThreshold, setLakeBlobLobeThreshold,
    lakeBlobLobeDirection, setLakeBlobLobeDirection,
  } = useMapStore()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-rivers-flyout]')) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const isRiver = type === 'river'
  const isCanal = type === 'canal'
  const style = isRiver ? riverStyle : isCanal ? canalStyle : null
  const setStyle = isRiver ? setRiverStyle : setCanalStyle
  const widthScale = isRiver ? riverWidthScale : canalWidthScale
  const setWidthScale = isRiver ? setRiverWidthScale : setCanalWidthScale

  const flyoutHeight = type === 'lake' ? 360 : type === 'river' ? 360 : 260
  const top = Math.min(anchorY, window.innerHeight - flyoutHeight - 8)
  const accentColor = style?.color ?? LAKE_COLOR

  const inputStyle: React.CSSProperties = { width: '100%', accentColor }

  return (
    <div
      data-rivers-flyout=""
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ color: '#e0e0f0', textTransform: 'capitalize', letterSpacing: 0.5 }}>{type}</span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#4a4a6a', cursor: 'pointer', padding: '0 2px', fontSize: 15, lineHeight: 1 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#a0a0c0')}
          onMouseLeave={e => (e.currentTarget.style.color = '#4a4a6a')}
        >×</button>
      </div>

      {(isRiver || isCanal) && style && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Color */}
          <div>
            <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a', marginBottom: 5 }}>Color</div>
            <ColorSwatch
              value={style.color}
              onChange={c => setStyle({ color: c })}
              palette={isRiver ? PALETTE_RIVER : PALETTE_CANAL}
            />
          </div>

          {/* Thickness */}
          <Row label="Thickness" value={`${widthScale.toFixed(1)}×`}>
            <input type="range" min={2} max={40} step={1}
              value={Math.round(widthScale * 10)}
              onChange={e => setWidthScale(Number(e.target.value) / 10)}
              style={inputStyle}
            />
          </Row>

          {/* Smooth + displacement + detail — rivers only */}
          {isRiver && (<>
            <Row label="Smooth" value={`${riverCurveSteps}`}>
              <input type="range" min={0} max={8} step={1}
                value={riverCurveSteps}
                onChange={e => setRiverCurveSteps(Number(e.target.value))}
                style={inputStyle}
              />
            </Row>
            <Row label="Displacement" value={`${Math.round(riverWobble * 100)}%`}>
              <input type="range" min={0} max={100} step={1}
                value={Math.round(riverWobble * 100)}
                onChange={e => setRiverWobble(Number(e.target.value) / 100)}
                style={inputStyle}
              />
            </Row>
            <Row label="Detail" value={`${Math.round(riverDetail * 100)}%`}>
              <input type="range" min={0} max={100} step={1}
                value={Math.round(riverDetail * 100)}
                onChange={e => setRiverDetail(Number(e.target.value) / 100)}
                style={inputStyle}
              />
            </Row>
          </>)}

          {/* Outline toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a' }}>Outline</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <span style={{ fontSize: 10, color: style.strokeEnabled ? accentColor : '#4a4a6a' }}>
                {style.strokeEnabled ? 'on' : 'off'}
              </span>
              <input type="checkbox" checked={style.strokeEnabled}
                onChange={e => setStyle({ strokeEnabled: e.target.checked })}
                style={{ accentColor, cursor: 'pointer' }}
              />
            </label>
          </div>

          {style.strokeEnabled && (<>
            {/* Outline color */}
            <div>
              <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a', marginBottom: 5 }}>Outline color</div>
              <ColorSwatch
                value={style.strokeColor}
                onChange={c => setStyle({ strokeColor: c })}
                palette={isRiver ? PALETTE_RIVER_OUTLINE : PALETTE_CANAL_OUTLINE}
              />
            </div>

            {/* Outline width */}
            <Row label="Outline width" value={`${Math.round(style.strokeWidth * 100)}%`}>
              <input type="range" min={5} max={100} step={5}
                value={Math.round(style.strokeWidth * 100)}
                onChange={e => setStyle({ strokeWidth: Number(e.target.value) / 100 })}
                style={inputStyle}
              />
            </Row>
          </>)}
        </div>
      )}

      {type === 'lake' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Row label="Corner Rounding" value={`${lakeBlobSmooth}`}>
            <input type="range" min={0} max={5} step={1} value={lakeBlobSmooth} onChange={e => setLakeBlobSmooth(Number(e.target.value))} style={{ width: '100%', accentColor: LAKE_COLOR }} />
          </Row>
          <Row label="Waviness" value={`${Math.round(lakeBlobBump * 100)}%`}>
            <input type="range" min={0} max={60} step={1} value={Math.round(lakeBlobBump * 100)} onChange={e => setLakeBlobBump(Number(e.target.value) / 100)} style={{ width: '100%', accentColor: LAKE_COLOR }} />
          </Row>
          <Row label="Inset" value={`${lakeBlobOffset > 0 ? '+' : ''}${Math.round(lakeBlobOffset * 100)}%`}>
            <input type="range" min={-80} max={30} step={1} value={Math.round(lakeBlobOffset * 100)} onChange={e => setLakeBlobOffset(Number(e.target.value) / 100)} style={{ width: '100%', accentColor: LAKE_COLOR }} />
          </Row>
          <Row label="Wave Scale" value={`${lakeBlobSweepFreq.toFixed(2)}`}>
            <input type="range" min={40} max={100} step={1} value={Math.round(lakeBlobSweepFreq * 100)} onChange={e => setLakeBlobSweepFreq(Number(e.target.value) / 100)} style={{ width: '100%', accentColor: LAKE_COLOR }} />
          </Row>
          <Row label="Fringe Scale" value={`${lakeBlobLobeFreq.toFixed(1)}`}>
            <input type="range" min={20} max={50} step={1} value={Math.round(lakeBlobLobeFreq * 10)} onChange={e => setLakeBlobLobeFreq(Number(e.target.value) / 10)} style={{ width: '100%', accentColor: LAKE_COLOR }} />
          </Row>
          <Row label="Fringe Strength" value={`${Math.round(lakeBlobLobeAmp * 100)}%`}>
            <input type="range" min={0} max={100} step={1} value={Math.round(lakeBlobLobeAmp * 100)} onChange={e => setLakeBlobLobeAmp(Number(e.target.value) / 100)} style={{ width: '100%', accentColor: LAKE_COLOR }} />
          </Row>
          <Row label="Fringe Sparsity" value={`${Math.round(lakeBlobLobeThreshold * 100)}%`}>
            <input type="range" min={0} max={40} step={1} value={Math.round(lakeBlobLobeThreshold * 100)} onChange={e => setLakeBlobLobeThreshold(Number(e.target.value) / 100)} style={{ width: '100%', accentColor: LAKE_COLOR }} />
          </Row>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a', marginBottom: 5 }}>Fringe Direction</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['Outward', 'Inward'] as const).map(label => {
                const dir = label === 'Outward' ? 1 : -1
                const active = label === 'Outward' ? lakeBlobLobeDirection >= 0 : lakeBlobLobeDirection < 0
                return (
                  <button key={label} onClick={() => setLakeBlobLobeDirection(dir)} style={{
                    flex: 1, padding: '3px 0', fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase',
                    background: active ? '#2a3a5a' : 'none', border: '1px solid #2a2a4a',
                    color: active ? '#8ab0e0' : '#4a4a6a', borderRadius: 3, cursor: 'pointer', fontFamily: 'ui-monospace, monospace',
                  }}>{label}</button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
