import { useState } from 'react'
import { useMapStore, pageGridTotalMm, mapResolutionMpx } from '../store/mapStore'
import type { PaperSize, HexOrientation, HexEdgeMode } from '../store/mapStore'
import { PageGridEditor, PAGE_GRID_EDITOR_DARK } from './PaperHexPreview'

type StartMode = 'osm' | 'blank' | 'reference'

const PAPER_SIZES: PaperSize[] = ['A4', 'A3', 'A2', 'A1']

export function SetupLanding({ onOpenPresets, onOsmContinue }: {
  onOpenPresets?: () => void
  onOsmContinue: () => void
}) {
  const {
    paperSize, orientation, pageGrid,
    hexSizeMm, hexOrientation, marginMm, hexEdgeMode,
    center, zoom, framePixelWidth,
    setPaperSize, setOrientation, setPageGrid,
    setHexSizeMm, setHexOrientation, setMarginMm, setHexEdgeMode,
    setBlankMap, generateMap, startImageImport,
    generatedHexes, generatedMetadata, resumeMap,
  } = useMapStore()

  const hasResumableMap = generatedHexes.length > 0

  const [startMode, setStartMode] = useState<StartMode>('osm')
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const [cwMm] = pageGridTotalMm(pageGrid)
  const res = mapResolutionMpx(center[1], zoom)
  const widthM = framePixelWidth * res
  const scaleMpMm = framePixelWidth > 0 ? widthM / cwMm : 0
  const hexKm = scaleMpMm > 0 ? hexSizeMm * scaleMpMm / 1000 : 0

  function handleStart() {
    if (startMode === 'osm') {
      onOsmContinue()
    } else if (startMode === 'blank') {
      setBlankMap(true)
      generateMap()
    } else {
      startImageImport()
    }
  }

  const ctaLabel = startMode === 'osm' ? 'Select Area →' : startMode === 'blank' ? "Let's Start" : 'Import Image'

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0e0f16',
      padding: '32px 24px',
      overflow: 'auto',
      fontFamily: 'ui-monospace, monospace',
      color: '#d0d0d8',
      fontSize: 12,
    }}>
      <div style={{
        display: 'flex',
        maxWidth: 980,
        width: '100%',
        minHeight: 'min(640px, calc(100vh - 64px))',
        background: '#12131a',
        borderRadius: 12,
        border: '1px solid #1e1f2e',
        overflow: 'hidden',
      }}>

        {/* ── Left: Interactive page grid preview ── */}
        <div style={{
          flex: 1,
          padding: '40px 32px',
          borderRight: '1px solid #1e1f2e',
          background: '#111219',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <HexLogo />
          <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: 2, marginTop: 16, marginBottom: 4 }}>IG2</div>
          <div style={{ fontSize: 10, color: '#3a6a4a', letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 32 }}>Hex Map Generator</div>

          <div style={{ borderTop: '1px solid #1a1b28', paddingTop: 28, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <PageGridEditor
              pageGrid={pageGrid}
              setPageGrid={setPageGrid}
              marginMm={marginMm}
              hexSizeMm={hexSizeMm}
              hexOrientation={hexOrientation}
              hexKm={hexKm}
              colors={PAGE_GRID_EDITOR_DARK}
            />
          </div>
        </div>

        {/* ── Middle: Settings ── */}
        <div style={{
          width: 210,
          flexShrink: 0,
          padding: '40px 20px',
          borderRight: '1px solid #1e1f2e',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          overflowY: 'auto',
        }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, color: '#3a3a5a', marginBottom: -4 }}>Map Format</div>

          <Field label="Paper">
            <div style={{ display: 'flex', gap: 4 }}>
              {PAPER_SIZES.map(s => <Pill key={s} active={paperSize === s} onClick={() => setPaperSize(s)}>{s}</Pill>)}
            </div>
          </Field>

          <Field label="Orientation">
            <div style={{ display: 'flex', gap: 6 }}>
              <IconBtn active={orientation === 'portrait'} onClick={() => setOrientation('portrait')} label="Portrait"><PortraitIcon /></IconBtn>
              <IconBtn active={orientation === 'landscape'} onClick={() => setOrientation('landscape')} label="Landscape"><LandscapeIcon /></IconBtn>
            </div>
          </Field>

          <Field label={`Hex size — ${hexSizeMm} mm`}>
            <input type="range" min={5} max={50} step={1} value={hexSizeMm}
              onChange={e => setHexSizeMm(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#5a9e6f' }}
            />
          </Field>

          <Field label="Hex style">
            <div style={{ display: 'flex', gap: 6 }}>
              <IconBtn active={hexOrientation === 'flat'} onClick={() => setHexOrientation('flat' as HexOrientation)} label="Flat"><FlatHexIcon /></IconBtn>
              <IconBtn active={hexOrientation === 'pointy'} onClick={() => setHexOrientation('pointy' as HexOrientation)} label="Pointy"><PointyHexIcon /></IconBtn>
            </div>
          </Field>

          <button
            onClick={() => setAdvancedOpen(v => !v)}
            style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              color: advancedOpen ? '#5a5a7a' : '#3a3a5a', fontSize: 10, textAlign: 'left',
              letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase',
            }}
          >
            <span style={{ display: 'inline-block', transform: advancedOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', fontSize: 8 }}>▶</span>
            Advanced
          </button>

          {advancedOpen && (
            <>
              <Field label={`Print margin — ${marginMm} mm`}>
                <input type="range" min={0} max={25} step={1} value={marginMm}
                  onChange={e => setMarginMm(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#5a9e6f' }}
                />
              </Field>
              <Field label="Edge hexes">
                <div style={{ display: 'flex', gap: 4 }}>
                  <Pill active={hexEdgeMode === 'whole'} onClick={() => setHexEdgeMode('whole' as HexEdgeMode)}>Full only</Pill>
                  <Pill active={hexEdgeMode === 'half'} onClick={() => setHexEdgeMode('half' as HexEdgeMode)}>Partial</Pill>
                </div>
              </Field>
            </>
          )}
        </div>

        {/* ── Right: Start mode + CTA ── */}
        <div style={{
          width: 280,
          flexShrink: 0,
          padding: '40px 32px',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {hasResumableMap && (
            <>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, color: '#3a3a5a', marginBottom: 14 }}>Resume</div>
              <button
                onClick={resumeMap}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 14px',
                  background: '#111a14',
                  border: '1px solid #2a4a34',
                  borderRadius: 7, cursor: 'pointer',
                  fontFamily: 'inherit', textAlign: 'left',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#162010'; e.currentTarget.style.borderColor = '#3a6a4a' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#111a14'; e.currentTarget.style.borderColor = '#2a4a34' }}
              >
                <ResumeIcon />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#6ab87e' }}>Continue last map</span>
                  <span style={{ fontSize: 10, color: '#3a5a44', lineHeight: 1.3 }}>
                    {generatedMetadata
                      ? `${generatedMetadata.hex_count} hexes · ${generatedMetadata.hex_size_km.toFixed(1)} km each`
                      : `${generatedHexes.length} hexes`}
                  </span>
                </div>
              </button>
              <div style={{ borderTop: '1px solid #1a1b28', margin: '14px 0' }} />
            </>
          )}

          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, color: '#3a3a5a', marginBottom: 14 }}>Start with</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <StartCard active={startMode === 'osm'} onClick={() => setStartMode('osm')} icon={<OsmIcon />} label="OSM Data" desc="Real terrain from OpenStreetMap" />
            <StartCard active={startMode === 'blank'} onClick={() => setStartMode('blank')} icon={<BlankIcon />} label="Blank" desc="Empty grid, start from scratch" />
            <StartCard active={startMode === 'reference'} onClick={() => setStartMode('reference')} icon={<ReferenceIcon />} label="Reference" desc="Import a historical map image" />
          </div>

          <div style={{ marginTop: 'auto', paddingTop: 28, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={handleStart}
              style={{
                width: '100%', padding: '14px 0',
                background: '#3a7a4a', color: '#d0ecd8',
                border: '1px solid #4a8a5a', borderRadius: 6,
                cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 14, fontWeight: 700, letterSpacing: 0.5,
              }}
            >
              {ctaLabel}
            </button>
            {onOpenPresets && (
              <button
                onClick={onOpenPresets}
                style={{
                  background: 'none', border: 'none', padding: '4px 0',
                  color: '#3a3a5a', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 10, letterSpacing: 0.5,
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#6a6a8a' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#3a3a5a' }}
              >
                Style Presets…
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ──

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ color: '#3e3e5e', marginBottom: 7, textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.8 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function StartCard({ active, onClick, icon, label, desc }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; desc: string
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12,
        padding: '11px 14px',
        background: active ? '#1a3628' : '#17181f',
        border: `1px solid ${active ? '#3a7a4a' : '#2a2a3a'}`,
        borderRadius: 7, cursor: 'pointer',
        color: active ? '#8ecfa0' : '#484868',
        fontFamily: 'inherit', textAlign: 'left',
      }}
    >
      {icon}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: active ? '#8ecfa0' : '#8a8aaa' }}>{label}</span>
        <span style={{ fontSize: 10, color: active ? '#4a7a5a' : '#52526a', lineHeight: 1.3 }}>{desc}</span>
      </div>
    </button>
  )
}

function IconBtn({ active, onClick, label, children }: {
  active: boolean; onClick: () => void; label: string; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        padding: '5px 4px',
        background: active ? '#1a3628' : '#17181f',
        border: `1px solid ${active ? '#3a7a4a' : '#2a2a3a'}`,
        borderRadius: 4, cursor: 'pointer',
        color: active ? '#8ecfa0' : '#585878',
        fontFamily: 'inherit', fontSize: 9, letterSpacing: 0.3,
      }}
    >
      {children}
      <span>{label}</span>
    </button>
  )
}

function Pill({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '3px 8px',
        background: active ? '#3a6e4a' : '#17181f',
        color: active ? '#d0ecd8' : '#585878',
        border: `1px solid ${active ? '#4a7e5a' : '#2a2a3a'}`,
        borderRadius: 3, cursor: 'pointer',
        fontFamily: 'inherit', fontSize: 11,
      }}
    >
      {children}
    </button>
  )
}

// ── Icons ──

function HexLogo() {
  return (
    <svg width="48" height="56" viewBox="0 0 48 56" fill="none">
      <polygon points="24,2 46,14 46,42 24,54 2,42 2,14" stroke="#3a7a4a" strokeWidth="1.5" fill="none" />
      <polygon points="24,11 39,19.5 39,36.5 24,45 9,36.5 9,19.5" stroke="#2a5a3a" strokeWidth="1" fill="none" opacity="0.5" />
      <polygon points="24,20 33,25 33,35 24,40 15,35 15,25" stroke="#3a7a4a" strokeWidth="1.5" fill="#1a3628" />
    </svg>
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
    <svg width="11" height="16" viewBox="0 0 16 22">
      <rect x="1.5" y="1.5" width="13" height="19" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function LandscapeIcon() {
  return (
    <svg width="16" height="11" viewBox="0 0 22 16">
      <rect x="1.5" y="1.5" width="19" height="13" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function FlatHexIcon() {
  return (
    <svg width="16" height="14" viewBox="0 0 22 20">
      <polygon points="19,10 15,17 7,17 3,10 7,3 15,3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function PointyHexIcon() {
  return (
    <svg width="14" height="16" viewBox="0 0 20 22">
      <polygon points="10,2 17.8,6.5 17.8,15.5 10,20 2.2,15.5 2.2,6.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function ResumeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4a8a5a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5,3 19,12 5,21" fill="#1a3628" stroke="#4a8a5a" strokeWidth="1.5" />
    </svg>
  )
}
