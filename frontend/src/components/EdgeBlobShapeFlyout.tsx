import { useEffect } from 'react'
import { useMapStore } from '../store/mapStore'
import { FlyoutContainer, FlyoutHeader, SliderRow, SectionLabel } from './ui'

interface Props {
  anchorY: number
  onClose: () => void
}

export function EdgeBlobShapeFlyout({ anchorY, onClose }: Props) {
  const {
    edgeBlobSmooth, setEdgeBlobSmooth,
    edgeBlobBump, setEdgeBlobBump,
    edgeBlobSweepFreq, setEdgeBlobSweepFreq,
    edgeBlobLobeFreq, setEdgeBlobLobeFreq,
    edgeBlobLobeAmp, setEdgeBlobLobeAmp,
    edgeBlobLobeThreshold, setEdgeBlobLobeThreshold,
    edgeBlobLobeDirection, setEdgeBlobLobeDirection,
    edgeBlobWidth, setEdgeBlobWidth,
  } = useMapStore()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-edge-blob-shape-flyout]')) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const ac = '#7a9e7a'

  return (
    <FlyoutContainer top={Math.min(anchorY, window.innerHeight - 48)} scrollable data-edge-blob-shape-flyout="">
      <FlyoutHeader title="Edge blob shape" onClose={onClose} />

      <SliderRow label="Width" value={`${Math.round(edgeBlobWidth * 100)}%`}>
        <input type="range" min={5} max={80} step={1} value={Math.round(edgeBlobWidth * 100)}
          onChange={e => setEdgeBlobWidth(Number(e.target.value) / 100)}
          style={{ width: '100%', accentColor: ac }} />
      </SliderRow>

      <SliderRow label="Corner Rounding" value={edgeBlobSmooth}>
        <input type="range" min={0} max={5} step={1} value={edgeBlobSmooth}
          onChange={e => setEdgeBlobSmooth(Number(e.target.value))}
          style={{ width: '100%', accentColor: ac }} />
      </SliderRow>

      <SliderRow label="Waviness" value={`${Math.round(edgeBlobBump * 100)}%`}>
        <input type="range" min={0} max={60} step={1} value={Math.round(edgeBlobBump * 100)}
          onChange={e => setEdgeBlobBump(Number(e.target.value) / 100)}
          style={{ width: '100%', accentColor: ac }} />
      </SliderRow>

<SliderRow label="Wave Scale" value={edgeBlobSweepFreq.toFixed(2)}>
        <input type="range" min={40} max={100} step={1} value={Math.round(edgeBlobSweepFreq * 100)}
          onChange={e => setEdgeBlobSweepFreq(Number(e.target.value) / 100)}
          style={{ width: '100%', accentColor: ac }} />
      </SliderRow>

      <SectionLabel>Fringe</SectionLabel>

      <SliderRow label="Scale" value={edgeBlobLobeFreq.toFixed(1)}>
        <input type="range" min={20} max={50} step={1} value={Math.round(edgeBlobLobeFreq * 10)}
          onChange={e => setEdgeBlobLobeFreq(Number(e.target.value) / 10)}
          style={{ width: '100%', accentColor: ac }} />
      </SliderRow>

      <SliderRow label="Strength" value={`${Math.round(edgeBlobLobeAmp * 100)}%`}>
        <input type="range" min={0} max={100} step={1} value={Math.round(edgeBlobLobeAmp * 100)}
          onChange={e => setEdgeBlobLobeAmp(Number(e.target.value) / 100)}
          style={{ width: '100%', accentColor: ac }} />
      </SliderRow>

      <SliderRow label="Sparsity" value={`${Math.round(edgeBlobLobeThreshold * 100)}%`}>
        <input type="range" min={0} max={40} step={1} value={Math.round(edgeBlobLobeThreshold * 100)}
          onChange={e => setEdgeBlobLobeThreshold(Number(e.target.value) / 100)}
          style={{ width: '100%', accentColor: ac }} />
      </SliderRow>

      <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#4a4a6a', marginBottom: 5 }}>Direction</div>
      <div style={{ display: 'flex', gap: 4 }}>
        {(['Outward', 'Inward'] as const).map(label => {
          const dir = label === 'Outward' ? 1 : -1
          const active = dir === 1 ? edgeBlobLobeDirection >= 0 : edgeBlobLobeDirection < 0
          return (
            <button key={label} onClick={() => setEdgeBlobLobeDirection(dir)} style={{
              flex: 1, padding: '3px 0', fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase',
              background: active ? '#2a3a5a' : 'none', border: '1px solid #2a2a4a',
              color: active ? '#8ab0e0' : '#4a4a6a', borderRadius: 3, cursor: 'pointer',
              fontFamily: 'ui-monospace, monospace',
            }}>{label}</button>
          )
        })}
      </div>
    </FlyoutContainer>
  )
}
