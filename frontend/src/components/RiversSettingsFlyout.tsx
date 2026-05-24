import { useEffect } from 'react'
import { useMapStore, LAKE_COLOR } from '../store/mapStore'
import { ColorSwatch } from './ColorSwatch'
import {
  PALETTE_RIVER, PALETTE_RIVER_OUTLINE,
  PALETTE_CANAL, PALETTE_CANAL_OUTLINE,
} from '../palettes'
import { FlyoutContainer, FlyoutHeader, ToggleButtonGroup, EnabledSection } from './ui'



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
    // riverWiggliness / setRiverWiggliness — detached
    riverWiggleFreq, setRiverWiggleFreq,
    riverWiggleAmp, setRiverWiggleAmp,
    riverSmoothing, setRiverSmoothing,
    riverPathSmoothing, setRiverPathSmoothing,
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
    <FlyoutContainer top={top} width={210} data-rivers-flyout="">
      <FlyoutHeader
        title={type.charAt(0).toUpperCase() + type.slice(1)}
        onClose={onClose}
      />

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

          {isRiver && (<>
            <Row label="Wiggle amp" value={riverWiggleAmp.toFixed(2)}>
              <input type="range" min={0} max={1.0} step={0.01}
                value={riverWiggleAmp}
                onChange={e => setRiverWiggleAmp(Number(e.target.value))}
                style={inputStyle}
              />
            </Row>
            <Row label="Wiggle freq" value={riverWiggleFreq.toFixed(1)}>
              <input type="range" min={0.5} max={10} step={0.1}
                value={riverWiggleFreq}
                onChange={e => setRiverWiggleFreq(Number(e.target.value))}
                style={inputStyle}
              />
            </Row>
            <Row label="Smoothing" value={String(riverSmoothing)}>
              <input type="range" min={2} max={30} step={1}
                value={riverSmoothing}
                onChange={e => setRiverSmoothing(Number(e.target.value))}
                style={inputStyle}
              />
            </Row>
            <Row label="Path smooth" value={String(riverPathSmoothing)}>
              <input type="range" min={0} max={50} step={1}
                value={riverPathSmoothing}
                onChange={e => setRiverPathSmoothing(Number(e.target.value))}
                style={inputStyle}
              />
            </Row>
          </>)}

          <EnabledSection
            label="Outline"
            enabled={style.strokeEnabled}
            onToggle={enabled => setStyle({ strokeEnabled: enabled })}
            accentColor={accentColor}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a', marginBottom: 5 }}>Color</div>
                <ColorSwatch
                  value={style.strokeColor}
                  onChange={c => setStyle({ strokeColor: c })}
                  palette={isRiver ? PALETTE_RIVER_OUTLINE : PALETTE_CANAL_OUTLINE}
                />
              </div>
              <Row label="Width" value={`${Math.round(style.strokeWidth * 100)}%`}>
                <input type="range" min={5} max={100} step={5}
                  value={Math.round(style.strokeWidth * 100)}
                  onChange={e => setStyle({ strokeWidth: Number(e.target.value) / 100 })}
                  style={inputStyle}
                />
              </Row>
            </div>
          </EnabledSection>
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
            <ToggleButtonGroup
              options={[{ value: 'outward', label: 'Outward' }, { value: 'inward', label: 'Inward' }]}
              value={lakeBlobLobeDirection >= 0 ? 'outward' : 'inward'}
              onChange={v => setLakeBlobLobeDirection(v === 'outward' ? 1 : -1)}
              accent="#8ab0e0"
            />
          </div>
        </div>
      )}
    </FlyoutContainer>
  )
}
