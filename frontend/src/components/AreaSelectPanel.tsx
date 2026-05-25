import { useEffect, useRef, useState } from 'react'
import { useMapStore, paperDimsMm, combinedDimsMm, mapResolutionMpx } from '../store/mapStore'

export function AreaSelectPanel({ onBack }: { onBack: () => void }) {
  const {
    paperSize, orientation, mapMode, diptychJoin,
    hexSizeMm, hexOrientation, marginMm,
    center, zoom, framePixelWidth, bearing,
    generateStatus, generateError, generateProgress,
    setBlankMap, generateMap,
  } = useMapStore()

  const [elapsed, setElapsed] = useState(0)
  const stepStartRef = useRef<number | null>(null)
  const prevStepRef = useRef<string | null>(null)

  useEffect(() => {
    if (!generateProgress) {
      setElapsed(0)
      stepStartRef.current = null
      prevStepRef.current = null
      return
    }
    if (generateProgress.step !== prevStepRef.current) {
      stepStartRef.current = Date.now()
      prevStepRef.current = generateProgress.step
      setElapsed(0)
    }
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - (stepStartRef.current ?? Date.now())) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [generateProgress])

  const [pwMm, phMm] = paperDimsMm(paperSize, orientation)
  const [cwMm] = combinedDimsMm(paperSize, orientation, mapMode, diptychJoin)
  const res = mapResolutionMpx(center[1], zoom)
  const widthM = framePixelWidth * res
  const scaleMpMm = framePixelWidth > 0 ? widthM / cwMm : 0

  const sq3 = Math.sqrt(3)
  const R_mm = hexSizeMm / sq3
  const iWMm = pwMm - 2 * marginMm
  const iHMm = phMm - 2 * marginMm
  let cols: number, rows: number
  if (hexOrientation === 'flat') {
    const maxQ = Math.max(0, Math.floor((iWMm / 2 - R_mm) / (1.5 * R_mm)))
    const maxR = Math.max(0, Math.floor((iHMm / 2 - (sq3 / 2) * R_mm) / (sq3 * R_mm)))
    cols = 2 * maxQ + 1; rows = 2 * maxR + 1
  } else {
    const maxR = Math.max(0, Math.floor((iHMm / 2 - R_mm) / (1.5 * R_mm)))
    const maxQ = Math.max(0, Math.floor((iWMm / 2 - (sq3 / 2) * R_mm) / (sq3 * R_mm)))
    cols = 2 * maxQ + 1; rows = 2 * maxR + 1
  }

  const hexKm = scaleMpMm > 0 ? hexSizeMm * scaleMpMm / 1000 : 0
  const hexKmStr = hexKm > 0 ? hexKm.toFixed(2) : '—'
  const terrainW = hexKm > 0 ? (cols * hexKm).toFixed(0) : '—'
  const terrainH = hexKm > 0 ? (rows * hexKm).toFixed(0) : '—'
  const bearingDisplay = Math.round(((bearing % 360) + 360) % 360)

  const isLoading = generateProgress !== null || generateStatus === 'loading'
  const isDisabled = isLoading || framePixelWidth === 0

  function handleGenerate() {
    setBlankMap(false)
    generateMap()
  }

  return (
    <div style={{
      width: 252,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      background: '#12131a',
      color: '#d0d0d8',
      fontFamily: 'ui-monospace, monospace',
      fontSize: 12,
      borderRight: '1px solid #1e1f2e',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e1f2e', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={onBack}
          style={{
            background: 'none', border: '1px solid #252535', borderRadius: 4,
            padding: '4px 8px', color: '#5a5a7a', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 11,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#a0a0c0'; e.currentTarget.style.borderColor = '#4a4a7a' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#5a5a7a'; e.currentTarget.style.borderColor = '#252535' }}
        >
          ← Back
        </button>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#8a9e90', letterSpacing: 0.5 }}>Select Area</div>
      </div>

      {/* Instruction */}
      <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid #1a1b28' }}>
        <div style={{ color: '#7a9e8a', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
          Navigate to your area
        </div>
        <div style={{ color: '#3e3e58', fontSize: 11, lineHeight: 1.6 }}>
          Pan and zoom the map to frame the region you want to generate. Right-click drag to rotate.
        </div>
      </div>

      {/* Live stats */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #1a1b28', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ color: '#7a9e8a', fontSize: 13, fontWeight: 600 }}>
          {cols} × {rows}{mapMode === 'diptych' ? ' / sheet' : ''} hexes
        </div>
        <div style={{ color: '#5a7a68', fontSize: 11 }}>{hexKmStr} km / hex</div>
        <div style={{ color: '#5a7a68', fontSize: 11 }}>~{terrainW} × {terrainH} km terrain</div>
        {bearingDisplay !== 0 && (
          <div style={{ color: '#404a44', fontSize: 10 }}>{bearingDisplay}° bearing</div>
        )}
        {framePixelWidth === 0 && !isLoading && (
          <div style={{ color: '#3a3a5a', fontSize: 10, marginTop: 4 }}>
            Waiting for map…
          </div>
        )}
      </div>

      {/* Generate */}
      <div style={{ padding: '14px 18px 20px', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          onClick={handleGenerate}
          disabled={isDisabled}
          style={{
            width: '100%',
            padding: '12px 0',
            background: isLoading ? '#2a5a3a' : '#3a7a4a',
            color: isLoading ? '#7aaa8a' : '#d0ecd8',
            border: '1px solid #4a8a5a',
            borderRadius: 5,
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 0.5,
            opacity: framePixelWidth === 0 && !isLoading ? 0.4 : 1,
          }}
        >
          {isLoading ? 'Generating…' : 'Generate'}
        </button>

        {generateProgress !== null && (
          <div>
            <div style={{ width: '100%', height: 4, background: '#1a1f22', borderRadius: 2, overflow: 'hidden', marginBottom: 5 }}>
              <div style={{
                height: '100%',
                width: `${generateProgress.progress}%`,
                background: '#3a7a4a',
                borderRadius: 2,
                transition: 'width 0.3s ease',
              }} />
            </div>
            <div style={{ color: '#7aaa8a', fontSize: 11, display: 'flex', justifyContent: 'space-between' }}>
              <span>{generateProgress.message}</span>
              {elapsed > 0 && <span style={{ color: '#4a6a5a' }}>{elapsed}s</span>}
            </div>
          </div>
        )}

        {generateError && (
          <div style={{ color: '#e06060', fontSize: 11, wordBreak: 'break-word' }}>{generateError}</div>
        )}
      </div>
    </div>
  )
}
