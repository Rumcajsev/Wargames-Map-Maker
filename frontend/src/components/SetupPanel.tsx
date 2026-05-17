import { useEffect, useRef, useState } from 'react'
import { useMapStore, paperDimsMm, combinedDimsMm, mapResolutionMpx } from '../store/mapStore'
import type { PaperSize, Orientation, HexOrientation, HexEdgeMode, MapMode, DiptychJoin } from '../store/mapStore'

const PAPER_SIZES: PaperSize[] = ['A4', 'A3', 'A2', 'A1']

export function SetupPanel() {
  const {
    paperSize, orientation, mapMode, diptychJoin,
    hexSizeMm, hexOrientation, marginMm, hexEdgeMode,
    center, zoom, framePixelWidth, bearing,
    generateStatus, generateError, generateProgress,
    blankMap,
    setPaperSize, setOrientation, setMapMode, setDiptychJoin,
    setHexSizeMm, setHexOrientation, setMarginMm, setHexEdgeMode,
    generateMap, setBlankMap,
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
  const [cwMm, chMm] = combinedDimsMm(paperSize, orientation, mapMode, diptychJoin)
  const res = mapResolutionMpx(center[1], zoom)
  const widthM = framePixelWidth * res
  const scaleMpMm = framePixelWidth > 0 ? widthM / cwMm : 0
  const hexSizeKm = scaleMpMm > 0 ? (hexSizeMm * scaleMpMm / 1000).toFixed(2) : '—'

  // Hex count per sheet (single-sheet dims), same logic as backend + preview
  const sq3 = Math.sqrt(3)
  const R_mm = hexSizeMm / sq3
  const iWMm = pwMm - 2 * marginMm
  const iHMm = phMm - 2 * marginMm
  let cols: number, rows: number
  if (hexOrientation === 'flat') {
    const maxQ = Math.max(0, Math.floor((iWMm / 2 - R_mm) / (1.5 * R_mm)))
    const maxR = Math.max(0, Math.floor((iHMm / 2 - (sq3 / 2) * R_mm) / (sq3 * R_mm)))
    cols = 2 * maxQ + 1
    rows = 2 * maxR + 1
  } else {
    const maxR = Math.max(0, Math.floor((iHMm / 2 - R_mm) / (1.5 * R_mm)))
    const maxQ = Math.max(0, Math.floor((iWMm / 2 - (sq3 / 2) * R_mm) / (sq3 * R_mm)))
    cols = 2 * maxQ + 1
    rows = 2 * maxR + 1
  }

  const bearingDisplay = Math.round(((bearing % 360) + 360) % 360)

  return (
    <div style={{
      width: 240,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
      padding: '20px 16px',
      background: '#12131a',
      color: '#d0d0d8',
      fontFamily: 'ui-monospace, monospace',
      fontSize: 12,
      overflowY: 'auto',
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: 1 }}>
        IG2 HEX MAP
      </div>

      <Field label="Paper">
        <ToggleGroup
          options={PAPER_SIZES}
          value={paperSize}
          onChange={(v) => setPaperSize(v as PaperSize)}
        />
      </Field>

      <Field label="Orientation">
        <ToggleGroup
          options={['portrait', 'landscape'] as Orientation[]}
          labels={['Portrait', 'Landscape']}
          value={orientation}
          onChange={(v) => setOrientation(v as Orientation)}
        />
      </Field>

      <Field label="Mode">
        <ToggleGroup
          options={['single', 'diptych'] as MapMode[]}
          labels={['Single', 'Diptych']}
          value={mapMode}
          onChange={(v) => setMapMode(v as MapMode)}
        />
      </Field>

      {mapMode === 'diptych' && (
        <Field label="Seam along" hint="Which edge the two sheets share. Long edge joins sheets side-by-side; short edge stacks them.">
          <ToggleGroup
            options={['long', 'short'] as DiptychJoin[]}
            labels={['Long edge', 'Short edge']}
            value={diptychJoin}
            onChange={(v) => setDiptychJoin(v as DiptychJoin)}
          />
        </Field>
      )}

      <Field label={`Hex size — ${hexSizeMm} mm`}>
        <input
          type="range"
          min={5}
          max={50}
          step={1}
          value={hexSizeMm}
          onChange={(e) => setHexSizeMm(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#5a9e6f' }}
        />
      </Field>

      <Field label="Hex top">
        <ToggleGroup
          options={['flat', 'pointy'] as HexOrientation[]}
          labels={['Flat', 'Pointy']}
          value={hexOrientation}
          onChange={(v) => setHexOrientation(v as HexOrientation)}
        />
      </Field>

      <Field label={`Print margin — ${marginMm} mm`}>
        <input
          type="range"
          min={0}
          max={25}
          step={1}
          value={marginMm}
          onChange={(e) => setMarginMm(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#5a9e6f' }}
        />
      </Field>

      <Field label="Edge hexes" hint="Full only: grid ends at complete hexes. Partial: adds cut-off hexes along the border.">
        <ToggleGroup
          options={['whole', 'half'] as HexEdgeMode[]}
          labels={['Full only', 'Partial']}
          value={hexEdgeMode}
          onChange={(v) => setHexEdgeMode(v as HexEdgeMode)}
        />
      </Field>

      <div style={{ borderTop: '1px solid #2a2a3a', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ color: '#7a9e8a', fontSize: 13 }}>
          {cols} × {rows} hexes{mapMode === 'diptych' ? ' / sheet' : ''}
        </div>
        <div style={{ color: '#7a9e8a', fontSize: 13 }}>
          {hexSizeKm} km / hex
        </div>
        {mapMode === 'diptych' && (
          <div style={{ color: '#7a7a90', fontSize: 11 }}>
            combined {Math.round(cwMm)} × {Math.round(chMm)} mm
          </div>
        )}
        {bearingDisplay !== 0 && (
          <div style={{ color: '#7a7a90', fontSize: 11 }}>
            {bearingDisplay}° bearing
          </div>
        )}
        <div style={{ color: '#4a4a5a', fontSize: 11, marginTop: 4 }}>
          Rotate map: right-click + drag
        </div>
      </div>

      <div style={{ borderTop: '1px solid #2a2a3a', paddingTop: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 10 }}>
          <input
            type="checkbox"
            checked={blankMap}
            onChange={(e) => setBlankMap(e.target.checked)}
            style={{ accentColor: '#3a7a4a', width: 14, height: 14, cursor: 'pointer' }}
          />
          <span style={{ color: '#b0b0c8', fontSize: 12 }}>Blank map</span>
          <span style={{ color: '#5a5a7a', fontSize: 11 }}>— all clear, no OSM</span>
        </label>
        <button
          onClick={generateMap}
          disabled={generateProgress !== null || generateStatus === 'loading' || framePixelWidth === 0}
          style={{
            width: '100%',
            padding: '10px 0',
            background: generateStatus === 'loading' ? '#2a5a3a' : '#3a7a4a',
            color: generateStatus === 'loading' ? '#7aaa8a' : '#d0ecd8',
            border: '1px solid #4a8a5a',
            borderRadius: 4,
            cursor: (generateProgress !== null || generateStatus === 'loading' || framePixelWidth === 0) ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 0.5,
            opacity: framePixelWidth === 0 ? 0.5 : 1,
          }}
        >
          {generateStatus === 'loading' ? 'Generating…' : 'Generate'}
        </button>

        {generateProgress !== null && (
          <div style={{ marginTop: 10 }}>
            <div style={{
              width: '100%',
              height: 6,
              background: '#1e1f2a',
              borderRadius: 3,
              overflow: 'hidden',
              marginBottom: 6,
            }}>
              <div style={{
                height: '100%',
                width: `${generateProgress.progress}%`,
                background: '#3a7a4a',
                borderRadius: 3,
                transition: 'width 0.3s ease',
              }} />
            </div>
            <div style={{ color: '#7aaa8a', fontSize: 11, display: 'flex', justifyContent: 'space-between' }}>
              <span>{generateProgress.message}</span>
              {elapsed > 0 && (
                <span style={{ color: '#4a6a5a' }}>{elapsed}s</span>
              )}
            </div>
          </div>
        )}

        {generateError && (
          <div style={{ color: '#e06060', fontSize: 11, marginTop: 8, wordBreak: 'break-word' }}>
            {generateError}
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ color: '#5a5a7a', marginBottom: 6, textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.8 }}>
        {label}
      </div>
      {children}
      {hint && (
        <div style={{ color: '#3a3a52', fontSize: 10, marginTop: 5, lineHeight: 1.4 }}>
          {hint}
        </div>
      )}
    </div>
  )
}

function ToggleGroup<T extends string>({
  options,
  labels,
  value,
  onChange,
}: {
  options: T[]
  labels?: string[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {options.map((opt, i) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          style={{
            padding: '4px 10px',
            background: value === opt ? '#3a6e4a' : '#1e1f2a',
            color: value === opt ? '#d0ecd8' : '#5a5a7a',
            border: `1px solid ${value === opt ? '#4a7e5a' : '#2a2a3a'}`,
            borderRadius: 3,
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 12,
          }}
        >
          {labels ? labels[i] : opt}
        </button>
      ))}
    </div>
  )
}
