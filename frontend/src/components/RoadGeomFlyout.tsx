import { useEffect } from 'react'
import { useMapStore } from '../store/mapStore'

type Props = {
  mode: 'road' | 'rail'
  anchorY: number
  onClose: () => void
}

export function RoadGeomFlyout({ mode, anchorY, onClose }: Props) {
  const {
    roadWiggleAmp, setRoadWiggleAmp,
    roadWiggleFreq, setRoadWiggleFreq,
    roadPathSmoothing, setRoadPathSmoothing,
    roadSmoothing, setRoadSmoothing,
    setRoadWiggleDragging,
    railWiggleAmp, setRailWiggleAmp,
    railWiggleFreq, setRailWiggleFreq,
    railPathSmoothing, setRailPathSmoothing,
    railSmoothing, setRailSmoothing,
    setRailWiggleDragging,
  } = useMapStore()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-road-geom-flyout]')) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const isRoad = mode === 'road'
  const accent = isRoad ? '#5a9e6f' : '#4a9ab0'

  const wiggleAmp = isRoad ? roadWiggleAmp : railWiggleAmp
  const wiggleFreq = isRoad ? roadWiggleFreq : railWiggleFreq
  const pathSmoothing = isRoad ? roadPathSmoothing : railPathSmoothing
  const smoothing = isRoad ? roadSmoothing : railSmoothing

  const setWiggleAmp = isRoad ? setRoadWiggleAmp : setRailWiggleAmp
  const setWiggleFreq = isRoad ? setRoadWiggleFreq : setRailWiggleFreq
  const setPathSmoothing = isRoad ? setRoadPathSmoothing : setRailPathSmoothing
  const setSmoothing = isRoad ? setRoadSmoothing : setRailSmoothing
  const setWiggleDragging = isRoad ? setRoadWiggleDragging : setRailWiggleDragging

  const flyoutHeight = 210
  const top = Math.min(anchorY, window.innerHeight - flyoutHeight - 8)

  return (
    <div
      data-road-geom-flyout=""
      style={{
        position: 'fixed',
        left: 204,
        top,
        width: 200,
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
        <span style={{ color: '#e0e0f0', letterSpacing: 0.5 }}>
          {isRoad ? 'Default road shape' : 'Default rail shape'}
        </span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#4a4a6a', cursor: 'pointer', padding: '0 2px', fontSize: 15, lineHeight: 1 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#a0a0c0')}
          onMouseLeave={e => (e.currentTarget.style.color = '#4a4a6a')}
        >×</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ color: '#6a6a8a', fontSize: 11 }}>Wiggle amp</span>
        <span style={{ color: '#5a5a7a', fontSize: 10 }}>{wiggleAmp.toFixed(2)}</span>
      </div>
      <input
        type="range" min={0} max={1} step={0.01}
        value={wiggleAmp}
        onPointerDown={() => setWiggleDragging(true)}
        onPointerUp={() => setWiggleDragging(false)}
        onChange={e => setWiggleAmp(Number(e.target.value))}
        style={{ width: '100%', accentColor: accent, cursor: 'pointer', marginBottom: 6 }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ color: '#6a6a8a', fontSize: 11 }}>Wiggle freq</span>
        <span style={{ color: '#5a5a7a', fontSize: 10 }}>{wiggleFreq.toFixed(1)}</span>
      </div>
      <input
        type="range" min={0.5} max={10} step={0.1}
        value={wiggleFreq}
        onChange={e => setWiggleFreq(Number(e.target.value))}
        style={{ width: '100%', accentColor: accent, cursor: 'pointer', marginBottom: 6 }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ color: '#6a6a8a', fontSize: 11 }}>Path smoothing</span>
        <span style={{ color: '#5a5a7a', fontSize: 10 }}>{pathSmoothing}</span>
      </div>
      <input
        type="range" min={0} max={50} step={1}
        value={pathSmoothing}
        onChange={e => setPathSmoothing(Number(e.target.value))}
        style={{ width: '100%', accentColor: accent, cursor: 'pointer', marginBottom: 6 }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ color: '#6a6a8a', fontSize: 11 }}>Line smoothing</span>
        <span style={{ color: '#5a5a7a', fontSize: 10 }}>{smoothing}</span>
      </div>
      <input
        type="range" min={0} max={30} step={1}
        value={smoothing}
        onChange={e => setSmoothing(Number(e.target.value))}
        style={{ width: '100%', accentColor: accent, cursor: 'pointer' }}
      />
    </div>
  )
}
