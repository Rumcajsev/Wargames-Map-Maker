import { useEffect } from 'react'
import { useMapStore } from '../store/mapStore'
import { FlyoutContainer, FlyoutHeader, EnabledSection, SliderRow, SectionLabel } from './ui'

interface Props {
  anchorY: number
  onClose: () => void
}

export function CoastlineSettingsFlyout({ anchorY, onClose }: Props) {
  const {
    coastlineV2, setCoastlineV2,
    beachStrip, setBeachStrip,
    beachColor, setBeachColor,
    beachWidth, setBeachWidth,
    coastlineDPEpsilon, setCoastlineDPEpsilon,
    coastlineChaikinPasses, setCoastlineChaikinPasses,
    coastlineCatmullSteps, setCoastlineCatmullSteps,
  } = useMapStore()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-coastline-flyout]')) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const top = Math.min(anchorY, window.innerHeight - 160 - 8)

  return (
    <FlyoutContainer top={top} data-coastline-flyout="">
      <FlyoutHeader title="Coastline" onClose={onClose} />

      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        {(['v1', 'v2'] as const).map(v => {
          const active = v === 'v2' ? coastlineV2 : !coastlineV2
          return (
            <button
              key={v}
              onClick={() => setCoastlineV2(v === 'v2')}
              style={{
                flex: 1, fontSize: 10, padding: '3px 0', borderRadius: 3, cursor: 'pointer',
                border: 'none', fontWeight: active ? 600 : 400,
                background: active ? '#4a6fa5' : '#ddd',
                color: active ? '#fff' : '#555',
              }}
            >
              {v === 'v1' ? 'Per-hex' : 'Smooth'}
            </button>
          )
        })}
      </div>

      <SectionLabel label="Smoothing" />
      <SliderRow
        label="Simplify" value={coastlineDPEpsilon}
        min={0} max={8} step={0.5}
        onChange={setCoastlineDPEpsilon}
      />
      <SliderRow
        label="Smooth" value={coastlineChaikinPasses}
        min={0} max={6} step={1}
        onChange={setCoastlineChaikinPasses}
      />
      <SliderRow
        label="Detail" value={coastlineCatmullSteps}
        min={1} max={20} step={1}
        onChange={setCoastlineCatmullSteps}
      />

      <EnabledSection
        label="Beach strip"
        enabled={beachStrip}
        onToggle={setBeachStrip}
        accentColor="#c8a84b"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a', width: 36 }}>Color</span>
            <input
              type="color"
              value={beachColor}
              onChange={e => setBeachColor(e.target.value)}
              style={{ width: 32, height: 18, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
            />
            <span style={{ fontSize: 10, color: '#5a5a7a' }}>{beachColor}</span>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a' }}>Width</span>
              <span style={{ fontSize: 10, color: '#5a5a7a' }}>{Math.round(beachWidth * 100)}%</span>
            </div>
            <input
              type="range" min={1} max={25} step={1}
              value={Math.round(beachWidth * 100)}
              onChange={e => setBeachWidth(Number(e.target.value) / 100)}
              style={{ width: '100%', accentColor: '#c8a84b' }}
            />
          </div>
        </div>
      </EnabledSection>
    </FlyoutContainer>
  )
}
