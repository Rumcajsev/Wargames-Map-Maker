import { useEffect, useRef, useState } from 'react'
import { useMapStore, paperDimsMm, combinedDimsMm, mapResolutionMpx } from '../store/mapStore'
import type { PaperSize, Orientation, HexOrientation, HexEdgeMode, MapMode, DiptychJoin } from '../store/mapStore'

type StartMode = 'osm' | 'blank' | 'reference'

const PAPER_SIZES: PaperSize[] = ['A4', 'A3', 'A2', 'A1']

export function SetupPanel({ onOpenPresets }: { onOpenPresets?: () => void }) {
  const {
    paperSize, orientation, mapMode, diptychJoin,
    hexSizeMm, hexOrientation, marginMm, hexEdgeMode,
    center, zoom, framePixelWidth, bearing,
    generateStatus, generateError, generateProgress,
    blankMap,
    setPaperSize, setOrientation, setMapMode, setDiptychJoin,
    setHexSizeMm, setHexOrientation, setMarginMm, setHexEdgeMode,
    generateMap, setBlankMap,
    startImageImport,
  } = useMapStore()

  const [startMode, setStartMode] = useState<StartMode>(blankMap ? 'blank' : 'osm')
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
  const hexSizeKmNum = scaleMpMm > 0 ? hexSizeMm * scaleMpMm / 1000 : 0
  const hexSizeKmStr = hexSizeKmNum > 0 ? hexSizeKmNum.toFixed(2) : '—'
  const terrainWKm = hexSizeKmNum > 0 ? (cols * hexSizeKmNum).toFixed(0) : '—'
  const terrainHKm = hexSizeKmNum > 0 ? (rows * hexSizeKmNum).toFixed(0) : '—'

  const isLoading = generateProgress !== null || generateStatus === 'loading'
  const isDisabled = isLoading || framePixelWidth === 0

  function handleStart() {
    if (startMode === 'reference') {
      startImageImport()
    } else {
      setBlankMap(startMode === 'blank')
      generateMap()
    }
  }

  const ctaLabel = isLoading
    ? 'Generating…'
    : startMode === 'reference'
      ? 'Import Image'
      : startMode === 'blank'
        ? 'Generate Blank'
        : 'Generate'

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
      overflowY: 'auto',
    }}>
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid #1e1f2e' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: 1.5 }}>IG2 HEX MAP</div>
      </div>

      <Section label="Start">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <StartCard active={startMode === 'osm'} onClick={() => setStartMode('osm')} icon={<OsmIcon />} label="OSM Data" desc="Real terrain from OpenStreetMap" />
          <StartCard active={startMode === 'blank'} onClick={() => setStartMode('blank')} icon={<BlankIcon />} label="Blank" desc="Empty grid, start from scratch" />
          <StartCard active={startMode === 'reference'} onClick={() => setStartMode('reference')} icon={<ReferenceIcon />} label="Reference" desc="Import a historical map image" />
        </div>
      </Section>

      <Section label="Paper">
        <div style={{ display: 'flex', gap: 4 }}>
          {PAPER_SIZES.map(s => (
            <Pill key={s} active={paperSize === s} onClick={() => setPaperSize(s)}>{s}</Pill>
          ))}
        </div>
      </Section>

      <Section label="Orientation">
        <div style={{ display: 'flex', gap: 6 }}>
          <IconBtn active={orientation === 'portrait'} onClick={() => setOrientation('portrait')} label="Portrait">
            <PortraitIcon />
          </IconBtn>
          <IconBtn active={orientation === 'landscape'} onClick={() => setOrientation('landscape')} label="Landscape">
            <LandscapeIcon />
          </IconBtn>
        </div>
      </Section>

      <Section label="Mode">
        <div style={{ display: 'flex', gap: 6 }}>
          <IconBtn active={mapMode === 'single'} onClick={() => setMapMode('single' as MapMode)} label="Single">
            <SingleIcon />
          </IconBtn>
          <IconBtn active={mapMode === 'diptych'} onClick={() => setMapMode('diptych' as MapMode)} label="Diptych">
            <DiptychIcon />
          </IconBtn>
        </div>
      </Section>

      {mapMode === 'diptych' && (
        <Section label="Seam along">
          <div style={{ display: 'flex', gap: 6 }}>
            <IconBtn active={diptychJoin === 'long'} onClick={() => setDiptychJoin('long' as DiptychJoin)} label="Long edge">
              <SeamLongIcon />
            </IconBtn>
            <IconBtn active={diptychJoin === 'short'} onClick={() => setDiptychJoin('short' as DiptychJoin)} label="Short edge">
              <SeamShortIcon />
            </IconBtn>
          </div>
        </Section>
      )}

      <Section label={`Hex size — ${hexSizeMm} mm`}>
        <input
          type="range" min={5} max={50} step={1} value={hexSizeMm}
          onChange={e => setHexSizeMm(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#5a9e6f' }}
        />
      </Section>

      <Section label="Hex top">
        <div style={{ display: 'flex', gap: 6 }}>
          <IconBtn active={hexOrientation === 'flat'} onClick={() => setHexOrientation('flat' as HexOrientation)} label="Flat">
            <FlatHexIcon />
          </IconBtn>
          <IconBtn active={hexOrientation === 'pointy'} onClick={() => setHexOrientation('pointy' as HexOrientation)} label="Pointy">
            <PointyHexIcon />
          </IconBtn>
        </div>
      </Section>

      <Section label={`Print margin — ${marginMm} mm`}>
        <input
          type="range" min={0} max={25} step={1} value={marginMm}
          onChange={e => setMarginMm(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#5a9e6f' }}
        />
      </Section>

      <Section label="Edge hexes">
        <div style={{ display: 'flex', gap: 4 }}>
          <Pill active={hexEdgeMode === 'whole'} onClick={() => setHexEdgeMode('whole' as HexEdgeMode)}>Full only</Pill>
          <Pill active={hexEdgeMode === 'half'} onClick={() => setHexEdgeMode('half' as HexEdgeMode)}>Partial</Pill>
        </div>
      </Section>

      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ color: '#7a9e8a', fontSize: 13, fontWeight: 600 }}>
          {cols} × {rows}{mapMode === 'diptych' ? ' / sheet' : ''} hexes
        </div>
        <div style={{ color: '#5a7a68', fontSize: 12 }}>
          {hexSizeKmStr} km / hex
        </div>
        <div style={{ color: '#5a7a68', fontSize: 12 }}>
          ~{terrainWKm} × {terrainHKm} km terrain
        </div>
        {mapMode === 'diptych' && (
          <div style={{ color: '#404a44', fontSize: 11 }}>
            combined {Math.round(cwMm)} × {Math.round(chMm)} mm
          </div>
        )}
        {bearingDisplay !== 0 && (
          <div style={{ color: '#404a44', fontSize: 11 }}>{bearingDisplay}° bearing</div>
        )}
        <div style={{ color: '#303840', fontSize: 10, marginTop: 2 }}>Right-click drag to rotate</div>
      </div>

      <div style={{ padding: '10px 16px 20px', borderTop: '1px solid #1e1f2e', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {onOpenPresets && (
          <button
            onClick={onOpenPresets}
            style={{
              width: '100%',
              padding: '7px 0',
              background: 'none',
              color: '#6a6a8a',
              border: '1px solid #2a2a4a',
              borderRadius: 4,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 12,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#a0a0c0'; e.currentTarget.style.borderColor = '#4a4a7a' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#6a6a8a'; e.currentTarget.style.borderColor = '#2a2a4a' }}
          >
            Style Presets…
          </button>
        )}
        <button
          onClick={handleStart}
          disabled={isDisabled}
          style={{
            width: '100%',
            padding: '11px 0',
            background: isLoading ? '#2a5a3a' : '#3a7a4a',
            color: isLoading ? '#7aaa8a' : '#d0ecd8',
            border: '1px solid #4a8a5a',
            borderRadius: 4,
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 0.5,
            opacity: framePixelWidth === 0 ? 0.5 : 1,
          }}
        >
          {ctaLabel}
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
          <div style={{ color: '#e06060', fontSize: 11, wordBreak: 'break-word' }}>
            {generateError}
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '10px 16px', borderBottom: '1px solid #1a1b28' }}>
      <div style={{ color: '#4a4a6a', marginBottom: 8, textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.8 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function StartCard({ active, onClick, icon, label, desc }: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  desc: string
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: '9px 12px',
        background: active ? '#1a3628' : '#181922',
        border: `1px solid ${active ? '#3a7a4a' : '#252535'}`,
        borderRadius: 6,
        cursor: 'pointer',
        color: active ? '#8ecfa0' : '#484868',
        fontFamily: 'inherit',
        textAlign: 'left',
      }}
    >
      {icon}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: active ? '#8ecfa0' : '#6a6a8a' }}>{label}</span>
        <span style={{ fontSize: 10, color: active ? '#5a8a6a' : '#383848', lineHeight: 1.3 }}>{desc}</span>
      </div>
    </button>
  )
}

function IconBtn({ active, onClick, label, children }: {
  active: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 5,
        padding: '8px 6px',
        background: active ? '#1a3628' : '#181922',
        border: `1px solid ${active ? '#3a7a4a' : '#252535'}`,
        borderRadius: 5,
        cursor: 'pointer',
        color: active ? '#8ecfa0' : '#484868',
        fontFamily: 'inherit',
        fontSize: 10,
        letterSpacing: 0.3,
      }}
    >
      {children}
      <span>{label}</span>
    </button>
  )
}

function Pill({ active, onClick, children }: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        background: active ? '#3a6e4a' : '#181922',
        color: active ? '#d0ecd8' : '#484868',
        border: `1px solid ${active ? '#4a7e5a' : '#252535'}`,
        borderRadius: 3,
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 12,
      }}
    >
      {children}
    </button>
  )
}

function OsmIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </svg>
  )
}

function BlankIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="5" y="2" width="14" height="20" rx="2" />
    </svg>
  )
}

function ReferenceIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="10" r="2" />
      <path d="M3 17l5-4 4 4 3-3 6 6" />
    </svg>
  )
}

function PortraitIcon() {
  return (
    <svg width="16" height="22" viewBox="0 0 16 22">
      <rect x="1.5" y="1.5" width="13" height="19" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function LandscapeIcon() {
  return (
    <svg width="22" height="16" viewBox="0 0 22 16">
      <rect x="1.5" y="1.5" width="19" height="13" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function SingleIcon() {
  return (
    <svg width="13" height="20" viewBox="0 0 13 20">
      <rect x="1.5" y="1.5" width="10" height="17" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function DiptychIcon() {
  return (
    <svg width="22" height="20" viewBox="0 0 22 20">
      <rect x="1" y="1.5" width="9" height="17" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="12" y="1.5" width="9" height="17" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function SeamLongIcon() {
  return (
    <svg width="22" height="18" viewBox="0 0 22 18">
      <rect x="1" y="1" width="9" height="16" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="12" y="1" width="9" height="16" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function SeamShortIcon() {
  return (
    <svg width="18" height="22" viewBox="0 0 18 22">
      <rect x="1" y="1" width="16" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1" y="12" width="16" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function FlatHexIcon() {
  return (
    <svg width="22" height="20" viewBox="0 0 22 20">
      <polygon points="19,10 15,17 7,17 3,10 7,3 15,3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function PointyHexIcon() {
  return (
    <svg width="20" height="22" viewBox="0 0 20 22">
      <polygon points="10,2 17.8,6.5 17.8,15.5 10,20 2.2,15.5 2.2,6.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}
