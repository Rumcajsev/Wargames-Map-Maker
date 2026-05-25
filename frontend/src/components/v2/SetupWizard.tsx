import { useState, useEffect, useRef } from 'react'
import { TK } from '../../theme'
import { useMapStore } from '../../store/mapStore'
import type { PaperSize, Orientation, HexOrientation } from '../../store/mapStore'
import { PaperHexPreview } from '../PaperHexPreview'
import { MapView } from '../MapView'

type WizardStep = 'source' | 'paper-blank' | 'paper-area' | 'generating'
type SourceMode = 'osm' | 'blank' | 'reference'

export function SetupWizard({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const [step, setStep] = useState<WizardStep>('source')
  const [source, setSource] = useState<SourceMode>('osm')
  const { setBlankMap, generateMap, startImageImport } = useMapStore()

  function handleContinue() {
    if (step === 'source') {
      if (source === 'blank') {
        setStep('paper-blank')
      } else if (source === 'reference') {
        startImageImport()
      } else {
        setStep('paper-area')
      }
    }
  }

  function handleStartBlank() {
    setBlankMap(true)
    generateMap()
    onDone()
  }

  function handleGenerate() {
    setBlankMap(false)
    setStep('generating')
    generateMap()
  }

  return (
    <div style={{
      height: '100vh', width: '100vw',
      display: 'flex', flexDirection: 'column',
      background: TK.paper, fontFamily: TK.sans, color: TK.ink,
      overflow: 'hidden',
    }}>
      <WizardTopBar step={step} onExit={onCancel} />

      {step === 'source' && (
        <SourcePickerStep
          selected={source}
          onSelect={setSource}
          onBack={onCancel}
          onContinue={handleContinue}
        />
      )}

      {step === 'paper-blank' && (
        <PaperAreaStep showMap={false} onBack={() => setStep('source')} onGenerate={handleStartBlank} />
      )}

      {step === 'paper-area' && (
        <PaperAreaStep onBack={() => setStep('source')} onGenerate={handleGenerate} />
      )}

      {step === 'generating' && (
        <GeneratingStep onDone={onDone} />
      )}
    </div>
  )
}

// ── Wizard top bar ──────────────────────────────────────────────────────────

function WizardTopBar({ step, onExit }: {
  step: WizardStep
  onExit: () => void
}) {
  return (
    <div style={{
      height: TK.topBarHeight,
      flexShrink: 0,
      display: 'flex', alignItems: 'center',
      padding: '0 20px',
      borderBottom: `1px solid ${TK.line2}`,
    }}>
      <HachureLogo />

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
        {step === 'source' && (
          <span style={{ fontFamily: TK.mono, fontSize: 10, color: TK.inkFaint, letterSpacing: 0.5 }}>
            DRAFT · UNTITLED
          </span>
        )}
        {step !== 'generating' && (
          <button
            onClick={onExit}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: TK.mono, fontSize: 10, color: TK.inkMute,
              letterSpacing: 0.5, padding: '4px 0',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = TK.ink }}
            onMouseLeave={e => { e.currentTarget.style.color = TK.inkMute }}
          >
            ESC · SAVE &amp; EXIT
          </button>
        )}
      </div>
    </div>
  )
}

// ── Screen 01 — Source picker ───────────────────────────────────────────────

function SourcePickerStep({ selected, onSelect, onBack, onContinue }: {
  selected: SourceMode
  onSelect: (m: SourceMode) => void
  onBack: () => void
  onContinue: () => void
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Main content */}
      <div style={{
        flex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '32px 40px',
        gap: 32,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontFamily: TK.mono, fontSize: 10, letterSpacing: 2,
            color: TK.rust, textTransform: 'uppercase', marginBottom: 12,
          }}>
            Step 01 of 03
          </div>
          <h2 style={{
            fontFamily: TK.serif, fontSize: 52, fontWeight: 400,
            color: TK.ink, margin: '0 0 14px 0', lineHeight: 1.05,
          }}>
            What are we starting <em>from?</em>
          </h2>
          <p style={{
            fontFamily: TK.sans, fontSize: 13, color: TK.inkMute,
            maxWidth: 520, lineHeight: 1.6, margin: '0 auto',
          }}>
            One choice — cannot be reversed after generation. Paper, hex size, and
            region are all adjustable in the next step.
          </p>
        </div>

        {/* Cards */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
          <SourceCard
            num="01" category="REAL WORLD"
            title="OSM Data"
            desc="Generate terrain from OpenStreetMap. Pick a region, set paper size, and hexes are built from real elevation and land use."
            footer="REGION SET IN NEXT STEP"
            selected={selected === 'osm'}
            onClick={() => onSelect('osm')}
            illustration={<OsmIllustration />}
          />
          <SourceCard
            num="02" category="EMPTY"
            title="Blank"
            desc="Skip to the editor with an empty grid. For original worlds, scenario design, or freeform painting from scratch."
            footer="NO AREA SETUP NEEDED"
            selected={selected === 'blank'}
            onClick={() => onSelect('blank')}
            illustration={<BlankIllustration />}
          />
          <SourceCard
            num="03" category="REFERENCE"
            title="Reference image"
            desc="Drop a scanned or historical map. Hexes overlay on top — trace terrain by hand without auto-generation."
            footer="UPLOAD IMAGE IN NEXT STEP"
            selected={selected === 'reference'}
            onClick={() => onSelect('reference')}
            illustration={<ReferenceIllustration />}
          />
        </div>
      </div>

      {/* Bottom nav */}
      <BottomNav
        left={<NavButton onClick={onBack} ghost>← CANCEL</NavButton>}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <span style={{ fontFamily: TK.mono, fontSize: 10, color: TK.inkMute, letterSpacing: 0.5 }}>
              STEP 1 / 3
            </span>
            <NavButton onClick={onContinue}>CONTINUE →</NavButton>
          </div>
        }
      />
    </div>
  )
}

function SourceCard({ num, category, title, desc, footer, selected, onClick, illustration }: {
  num: string; category: string; title: string; desc: string; footer: string
  selected: boolean; onClick: () => void; illustration: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 280,
        display: 'flex', flexDirection: 'column',
        background: TK.surface,
        border: `1px solid ${selected ? TK.ink : TK.line}`,
        borderRadius: 2,
        padding: 0,
        cursor: 'pointer',
        textAlign: 'left',
        position: 'relative',
        outline: 'none',
      }}
    >
      {/* Checkmark badge */}
      {selected && (
        <div style={{
          position: 'absolute', top: 12, right: 12,
          width: 20, height: 20,
          background: TK.ink,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, color: '#fff',
          zIndex: 1,
        }}>
          ✓
        </div>
      )}

      {/* Illustration */}
      <div style={{
        height: 140,
        background: TK.paper2,
        overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderBottom: `1px solid ${TK.line2}`,
      }}>
        {illustration}
      </div>

      {/* Content */}
      <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{
          fontFamily: TK.mono, fontSize: 9, letterSpacing: 1.5,
          color: TK.rust, textTransform: 'uppercase',
        }}>
          {num} · {category}
        </div>
        <div style={{
          fontFamily: TK.serif, fontSize: 24, fontWeight: 400,
          color: TK.ink, lineHeight: 1.1,
        }}>
          {title}
        </div>
        <div style={{
          fontFamily: TK.sans, fontSize: 12, color: TK.inkMute,
          lineHeight: 1.55, flex: 1,
        }}>
          {desc}
        </div>
      </div>

      {/* Footer note */}
      <div style={{
        padding: '10px 18px',
        borderTop: `1px solid ${TK.line2}`,
        fontFamily: TK.mono, fontSize: 9, letterSpacing: 1.2,
        color: TK.inkFaint, textTransform: 'uppercase',
      }}>
        {footer}
      </div>
    </button>
  )
}

function PaperAreaStep({ onBack, onGenerate, showMap = true }: { onBack: () => void; onGenerate: () => void; showMap?: boolean }) {
  const {
    paperSize, orientation, pageGrid,
    hexSizeMm, hexOrientation, marginMm, hexEdgeMode,
    zoom, framePixelWidth,
    setPaperSize, setOrientation, setPageGrid,
    setHexSizeMm, setHexOrientation, setMarginMm, setHexEdgeMode,
    flyTo,
  } = useMapStore()

  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const isDisabled = showMap && framePixelWidth === 0

  async function handleSearch() {
    if (!searchQuery.trim()) return
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`)
    const data = await r.json()
    if (data[0]) flyTo([parseFloat(data[0].lon), parseFloat(data[0].lat)], 12)
  }

  const zoomDisplay = `Z${Math.round(zoom)}`

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left panel ── */}
        <div style={{
          width: 380, flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          borderRight: `1px solid ${TK.line}`,
          overflowY: 'auto',
          background: TK.surface,
        }}>

          {/* PAPER */}
          <PanelSection label="PAPER">
            <FieldLabel>SIZE</FieldLabel>
            <ToggleGroup>
              {(['A4','A3','A2','A1'] as PaperSize[]).map(s => (
                <ToggleBtn key={s} active={paperSize === s} onClick={() => setPaperSize(s)}>{s}</ToggleBtn>
              ))}
            </ToggleGroup>

            <FieldLabel style={{ marginTop: 14 }}>ORIENTATION</FieldLabel>
            <ToggleGroup>
              <ToggleBtn active={orientation === 'landscape'} onClick={() => setOrientation('landscape' as Orientation)}>Landscape</ToggleBtn>
              <ToggleBtn active={orientation === 'portrait'}  onClick={() => setOrientation('portrait'  as Orientation)}>Portrait</ToggleBtn>
            </ToggleGroup>

            <FieldLabel style={{ marginTop: 14 }}>SHEETS</FieldLabel>
            <ToggleGroup>
              <ToggleBtn active={pageGrid.cols === 1 && pageGrid.rows === 1} onClick={() => setPageGrid({ cols: 1, rows: 1 })}>Single</ToggleBtn>
              <ToggleBtn active={pageGrid.cols > 1 || pageGrid.rows > 1}    onClick={() => setPageGrid({ cols: 2, rows: 1 })}>Two sheets</ToggleBtn>
            </ToggleGroup>
          </PanelSection>

          {/* HEX SIZE + STYLE */}
          <PanelSection>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 8 }}>
              <div>
                <FieldLabel>HEX SIZE</FieldLabel>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontFamily: TK.serif, fontSize: 40, lineHeight: 1, color: TK.ink }}>{hexSizeMm}</span>
                  <span style={{ fontFamily: TK.mono, fontSize: 11, color: TK.inkMute }}>mm</span>
                </div>
              </div>
              <div style={{ flex: 1, marginBottom: 6 }}>
                <span style={{ fontFamily: TK.mono, fontSize: 9, color: TK.inkFaint }}>5–50 mm</span>
              </div>
            </div>
            <input
              type="range" min={5} max={50} step={1} value={hexSizeMm}
              onChange={e => setHexSizeMm(Number(e.target.value))}
              style={{ width: '100%', accentColor: TK.rust, marginBottom: 14 }}
            />

            <FieldLabel>STYLE</FieldLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ToggleGroup>
                <ToggleBtn active={hexOrientation === 'pointy'} onClick={() => setHexOrientation('pointy' as HexOrientation)}>Pointy</ToggleBtn>
                <ToggleBtn active={hexOrientation === 'flat'}   onClick={() => setHexOrientation('flat'   as HexOrientation)}>Flat</ToggleBtn>
              </ToggleGroup>
              <HexOrientIcon orientation={hexOrientation} />
            </div>
          </PanelSection>

          {/* ADVANCED */}
          <PanelSection>
            <button
              onClick={() => setAdvancedOpen(v => !v)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: TK.mono, fontSize: 10, color: TK.inkMute,
                letterSpacing: 1, textTransform: 'uppercase',
              }}
            >
              <span style={{ transform: advancedOpen ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 0.15s', fontSize: 8 }}>▶</span>
              ADVANCED
              <span style={{ color: TK.inkFaint }}>{advancedOpen ? '' : '· SHOW'}</span>
            </button>

            {advancedOpen && (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <FieldLabel>PRINT MARGIN — {marginMm}mm</FieldLabel>
                  <input type="range" min={0} max={25} step={1} value={marginMm}
                    onChange={e => setMarginMm(Number(e.target.value))}
                    style={{ width: '100%', accentColor: TK.rust }} />
                </div>
                <div>
                  <FieldLabel>EDGE HEXES</FieldLabel>
                  <ToggleGroup>
                    <ToggleBtn active={hexEdgeMode === 'whole'} onClick={() => setHexEdgeMode('whole')}>Full only</ToggleBtn>
                    <ToggleBtn active={hexEdgeMode === 'half'}  onClick={() => setHexEdgeMode('half')}>Partial</ToggleBtn>
                  </ToggleGroup>
                </div>
              </div>
            )}
          </PanelSection>

          {/* AREA — OSM only */}
          {showMap && (
            <PanelSection label="AREA">
              <div style={{
                display: 'flex', alignItems: 'center',
                border: `1px solid ${TK.line}`,
                background: TK.paper,
                marginBottom: 10,
              }}>
                <span style={{ padding: '0 10px', color: TK.inkFaint, fontSize: 13 }}>⌕</span>
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Search location…"
                  style={{
                    flex: 1, border: 'none', background: 'transparent',
                    fontFamily: TK.sans, fontSize: 12, color: TK.ink,
                    padding: '8px 0', outline: 'none',
                  }}
                />
                <span style={{
                  padding: '0 10px',
                  fontFamily: TK.mono, fontSize: 9, color: TK.inkFaint,
                  letterSpacing: 0.5,
                }}>
                  {zoomDisplay}
                </span>
              </div>
            </PanelSection>
          )}
        </div>

        {/* ── Right: map or paper preview ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {showMap ? <MapView /> : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: TK.paper2 }}>
              <PaperHexPreview
                paperSize={paperSize}
                orientation={orientation}
                pageGrid={pageGrid}
                marginMm={marginMm}
                hexSizeMm={hexSizeMm}
                hexOrientation={hexOrientation}
                maxW={480} maxH={520}
                colors={{ paper: TK.paper, border: TK.line, hex: TK.line, margin: TK.line2, labelPrimary: TK.inkMute, labelSecondary: TK.inkFaint }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom nav ── */}
      <div style={{
        height: 52, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px',
        borderTop: `1px solid ${TK.line2}`,
        background: TK.surface,
      }}>
        <NavButton onClick={onBack} ghost>← BACK</NavButton>
        <NavButton onClick={onGenerate} disabled={isDisabled}>
          {showMap ? 'GENERATE →' : 'START EDITING →'}
        </NavButton>
      </div>
    </div>
  )
}

// ── Panel primitives ────────────────────────────────────────────────────────

function PanelSection({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '18px 20px', borderBottom: `1px solid ${TK.line2}` }}>
      {label && (
        <div style={{ fontFamily: TK.mono, fontSize: 9, color: TK.inkFaint, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>
          {label}
        </div>
      )}
      {children}
    </div>
  )
}

function FieldLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontFamily: TK.mono, fontSize: 9, color: TK.inkFaint, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 7, ...style }}>
      {children}
    </div>
  )
}

function ToggleGroup({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 0 }}>{children}</div>
}

function ToggleBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 16px',
        background: active ? TK.ink : TK.paper,
        color: active ? '#fff' : TK.inkMute,
        border: `1px solid ${TK.line}`,
        marginLeft: -1,
        cursor: 'pointer',
        fontFamily: TK.sans, fontSize: 11,
        position: 'relative', zIndex: active ? 1 : 0,
      }}
    >
      {children}
    </button>
  )
}

function HexOrientIcon({ orientation }: { orientation: HexOrientation }) {
  const pts = orientation === 'pointy'
    ? '10,2 18,6.5 18,15.5 10,20 2,15.5 2,6.5'
    : '2,11 7.5,2 16.5,2 22,11 16.5,20 7.5,20'
  return (
    <svg width="22" height="22" viewBox="0 0 24 22" fill="none">
      <polygon points={pts} stroke={TK.inkMute} strokeWidth="1.5" fill="none" strokeLinejoin="round" />
    </svg>
  )
}

// ── Shared nav primitives ───────────────────────────────────────────────────

function BottomNav({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div style={{
      height: 64, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 32px',
      borderTop: `1px solid ${TK.line2}`,
      background: TK.surface,
    }}>
      {left}
      {right}
    </div>
  )
}

function NavButton({ children, onClick, ghost, disabled }: {
  children: React.ReactNode; onClick: () => void; ghost?: boolean; disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '12px 24px',
        background: ghost ? 'transparent' : TK.ink,
        color: ghost ? TK.inkMute : '#fff',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: TK.mono,
        fontSize: 11,
        letterSpacing: 1,
        fontWeight: ghost ? 400 : 600,
        opacity: disabled ? 0.4 : 1,
      }}
      onMouseEnter={e => {
        if (disabled) return
        if (ghost) e.currentTarget.style.color = TK.ink
        else e.currentTarget.style.background = TK.ink2
      }}
      onMouseLeave={e => {
        if (ghost) e.currentTarget.style.color = TK.inkMute
        else e.currentTarget.style.background = TK.ink
      }}
    >
      {children}
    </button>
  )
}

// ── Card illustrations ──────────────────────────────────────────────────────

function OsmIllustration() {
  const sq3 = Math.sqrt(3)
  const R = 14
  const colors = [
    '#d4c9b0','#c8bfa2','#b5a882','#d4c9b0','#cdc4ae',
    '#b8c9a8','#a8ba98','#c8bfa2','#b5a882','#d4c9b0',
    '#cdc4ae','#b8c9a8','#d4c9b0','#c8bfa2','#a8ba98',
    '#b5a882','#cdc4ae','#b8c9a8','#d4c9b0','#c8bfa2',
    '#a8ba98','#b5a882','#cdc4ae','#d4c9b0','#b8c9a8',
  ]
  const hexes: { cx: number; cy: number; color: string }[] = []
  const colSpacing = 1.5 * R
  const rowSpacing = sq3 * R
  let idx = 0
  for (let q = 0; q < 5; q++) {
    const cx = 20 + q * colSpacing
    const offset = q % 2 !== 0 ? rowSpacing / 2 : 0
    for (let r = 0; r < 5; r++) {
      const cy = 16 + r * rowSpacing - offset
      hexes.push({ cx, cy, color: colors[idx % colors.length] })
      idx++
    }
  }
  const pts = (cx: number, cy: number) =>
    [0,60,120,180,240,300].map(a => {
      const rad = a * Math.PI / 180
      return `${cx + R * Math.cos(rad)},${cy + R * Math.sin(rad)}`
    }).join(' ')

  return (
    <svg width="280" height="140" style={{ display: 'block' }}>
      {hexes.map((h, i) => (
        <polygon key={i} points={pts(h.cx, h.cy)} fill={h.color} stroke={TK.paper2} strokeWidth={0.8} />
      ))}
    </svg>
  )
}

function BlankIllustration() {
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: TK.paper2,
    }}>
      <span style={{
        fontFamily: TK.mono, fontSize: 11, letterSpacing: 2,
        color: TK.inkFaint, textTransform: 'uppercase',
      }}>
        EMPTY
      </span>
    </div>
  )
}

function ReferenceIllustration() {
  return (
    <svg width="280" height="140" style={{ display: 'block' }} viewBox="0 0 280 140">
      <rect width="280" height="140" fill={TK.paper2} />
      {/* Road/river curves */}
      <path d="M 20 100 C 80 80, 140 90, 200 60 S 260 30, 270 20"
        stroke={TK.inkFaint} strokeWidth="1.5" fill="none" />
      <path d="M 30 140 C 90 120, 160 115, 220 100 S 265 90, 270 80"
        stroke={TK.line} strokeWidth="1" fill="none" />
      {/* Settlement dots */}
      <circle cx="148" cy="82" r="3" fill={TK.ink} />
      <text x="154" y="79" fontFamily="Geist, sans-serif" fontSize="10" fill={TK.ink} fontStyle="italic">Bruck</text>
      <circle cx="218" cy="60" r="3" fill={TK.ink} />
      <text x="224" y="57" fontFamily="Geist, sans-serif" fontSize="10" fill={TK.ink} fontStyle="italic">Aldorf</text>
    </svg>
  )
}

// ── Screen 03 — Generating ──────────────────────────────────────────────────

const TERRAIN_STEPS = [
  { id: 'grid',      label: 'INITIALISING GRID' },
  { id: 'raster',    label: 'FETCHING RASTER DATA' },
  { id: 'classify',  label: 'CLASSIFYING TERRAIN' },
  { id: 'coastline', label: 'COMPOSITING COASTLINE' },
]

const LAYER_STEPS = [
  { id: 'roads-rails',  label: 'ROADS & RAILS' },
  { id: 'rivers',       label: 'RIVERS' },
  { id: 'settlements',  label: 'SETTLEMENTS' },
  { id: 'elevation',    label: 'ELEVATION' },
]

function GeneratingStep({ onDone }: { onDone: () => void }) {
  const {
    generateStatus, generateProgress, center,
    roadsStatus, railsStatus, riversOsmStatus, settlementsStatus,
    elevationStatus, elevationProgress,
    fetchRoads, fetchRails, fetchRivers, fetchSettlements, fetchElevation,
  } = useMapStore()

  const [cityName, setCityName]   = useState<string | null>(null)
  const [phase, setPhase]         = useState<'terrain' | 'layers'>('terrain')
  // tick fires every second purely to trigger re-renders for elapsed time display
  const [tick, setTick]           = useState(0)

  const terrainStepStartRef = useRef(Date.now())
  const prevTerrainStepRef  = useRef<string | null>(null)
  const layerStartsRef      = useRef<Record<string, number>>({})
  const layersFetchedRef    = useRef(false)

  useEffect(() => {
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${center[1]}&lon=${center[0]}&format=json`)
      .then(r => r.json())
      .then(d => { const a = d.address ?? {}; setCityName(a.city || a.town || a.village || a.county || null) })
      .catch(() => {})
  }, [])

  // Single 1-second ticker for all elapsed timers
  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // Track which terrain SSE step we're on so elapsed resets per step
  useEffect(() => {
    const step = generateProgress?.step ?? null
    if (step !== prevTerrainStepRef.current) {
      prevTerrainStepRef.current = step
      terrainStepStartRef.current = Date.now()
    }
  }, [generateProgress?.step])

  // Kick off all layer fetches the moment terrain completes
  useEffect(() => {
    if (generateStatus === 'done' && !layersFetchedRef.current) {
      layersFetchedRef.current = true
      const now = Date.now()
      layerStartsRef.current = { 'roads-rails': now, rivers: now, settlements: now, elevation: now }
      setPhase('layers')
      fetchRoads()
      fetchRails()
      fetchRivers()
      fetchSettlements()
      fetchElevation()
    }
  }, [generateStatus, fetchRoads, fetchRails, fetchRivers, fetchSettlements, fetchElevation])

  // Layer completion (error counts as finished so we don't block forever)
  const roadsRailsDone  = (roadsStatus === 'done' || roadsStatus === 'error')
                       && (railsStatus === 'done' || railsStatus === 'error')
  const riversDone      = riversOsmStatus === 'done'   || riversOsmStatus === 'error'
  const settlementsDone = settlementsStatus === 'done' || settlementsStatus === 'error'
  const elevationDone   = elevationStatus === 'done'   || elevationStatus === 'error'
  const allLayersDone   = roadsRailsDone && riversDone && settlementsDone && elevationDone

  useEffect(() => {
    if (phase === 'layers' && allLayersDone) {
      const t = setTimeout(onDone, 700)
      return () => clearTimeout(t)
    }
  }, [phase, allLayersDone, onDone])

  // Elapsed helpers (recomputed on every tick)
  void tick
  const now = Date.now()
  const terrainElapsed = Math.floor((now - terrainStepStartRef.current) / 1000)
  const layerElapsed   = (id: string) => {
    const s = layerStartsRef.current[id]
    return s ? Math.floor((now - s) / 1000) : 0
  }

  // Smooth progress bar: elevation SSE drives a continuous fraction, others are 0 or 1
  const terrainProgress  = generateStatus === 'done' ? 100 : (generateProgress?.progress ?? 0)
  const elevFrac         = elevationDone ? 100 : (elevationProgress?.progress ?? 0)
  const nonElevDoneCount = [roadsRailsDone, riversDone, settlementsDone].filter(Boolean).length
  const layersProgress   = (nonElevDoneCount * 100 + elevFrac) / 4
  const progress         = phase === 'terrain' ? terrainProgress : layersProgress

  // Terrain checklist
  const currentStepId     = generateProgress?.step ?? null
  const currentTerrainIdx = TERRAIN_STEPS.findIndex(s => s.id === currentStepId)
  const terrainAllDone    = generateStatus === 'done'

  // Layer active flags
  const roadsRailsActive  = phase === 'layers' && (roadsStatus === 'loading' || railsStatus === 'loading')
  const riversActive      = phase === 'layers' && riversOsmStatus === 'loading'
  const settlementsActive = phase === 'layers' && settlementsStatus === 'loading'
  const elevationActive   = phase === 'layers' && elevationStatus === 'loading'

  // Detail annotations shown inline on each active row
  const layerDetail: Record<string, string | undefined> = {
    'roads-rails':  roadsRailsActive  ? `${layerElapsed('roads-rails')}s`            : undefined,
    'rivers':       riversActive      ? `${layerElapsed('rivers')}s`                 : undefined,
    'settlements':  settlementsActive ? `${layerElapsed('settlements')}s`            : undefined,
    'elevation':    elevationActive   ? `${elevationProgress?.progress ?? 0}%`       : undefined,
  }

  const layerState = {
    'roads-rails': { done: roadsRailsDone,  active: roadsRailsActive  },
    'rivers':      { done: riversDone,      active: riversActive      },
    'settlements': { done: settlementsDone, active: settlementsActive },
    'elevation':   { done: elevationDone,   active: elevationActive   },
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 36,
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: TK.mono, fontSize: 9, letterSpacing: 2,
          color: TK.inkFaint, textTransform: 'uppercase', marginBottom: 10,
        }}>
          {allLayersDone && phase === 'layers' ? 'COMPLETE' : 'GENERATING'}
        </div>
        <h1 style={{
          fontFamily: TK.serif, fontSize: 52, fontWeight: 400,
          color: TK.ink, margin: 0, fontStyle: 'italic',
        }}>
          {cityName ?? 'Untitled'}
        </h1>
      </div>

      <HexDotBar progress={progress} />

      {/* Terrain phase status line */}
      {phase === 'terrain' && generateProgress && (
        <div style={{
          fontFamily: TK.mono, fontSize: 10, color: TK.inkMute,
          letterSpacing: 0.5, textAlign: 'center',
        }}>
          {generateProgress.message} · {terrainElapsed}s
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {TERRAIN_STEPS.map((s, i) => {
          const done   = terrainAllDone || currentTerrainIdx > i
          const active = !terrainAllDone && s.id === currentStepId
          const detail = active ? `${terrainElapsed}s` : undefined
          return <CheckRow key={s.id} label={s.label} done={done} active={active} detail={detail} />
        })}

        <div style={{ height: 1, background: TK.line2, margin: '4px 0' }} />

        {LAYER_STEPS.map(s => {
          const ls = layerState[s.id as keyof typeof layerState]
          return (
            <CheckRow
              key={s.id}
              label={s.label}
              done={ls.done}
              active={ls.active}
              pending={phase === 'terrain'}
              detail={layerDetail[s.id]}
            />
          )
        })}
      </div>
    </div>
  )
}

function CheckRow({ label, done, active, pending, detail }: {
  label: string; done: boolean; active: boolean; pending?: boolean; detail?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {done ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke={TK.rust} strokeWidth="1" />
            <path d="M4.5 7l2 2 3.5-3.5" stroke={TK.rust} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : active ? (
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: TK.rust }} />
        ) : (
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: pending ? TK.line2 : TK.line }} />
        )}
      </div>
      <span style={{
        fontFamily: TK.mono, fontSize: 10, letterSpacing: 1,
        color: done ? TK.ink : active ? TK.ink2 : TK.inkFaint,
      }}>
        {label}
        {detail && (
          <span style={{ marginLeft: 8, color: TK.inkFaint }}>· {detail}</span>
        )}
      </span>
    </div>
  )
}

function HexDotBar({ progress }: { progress: number }) {
  const TOTAL = 20
  const filled = Math.round((progress / 100) * TOTAL)
  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {Array.from({ length: TOTAL }, (_, i) => (
        <svg key={i} width="13" height="15" viewBox="0 0 13 15">
          <polygon
            points="6.5,1 12,4 12,11 6.5,14 1,11 1,4"
            fill={i < filled ? TK.rust : 'none'}
            stroke={i < filled ? TK.rust : TK.line}
            strokeWidth="1"
          />
        </svg>
      ))}
    </div>
  )
}

// ── Logo ─────────────────────────────────────────────────────────────────────

function HachureLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width="16" height="18" viewBox="0 0 18 20" fill="none">
        <polygon points="9,1.5 16.8,5.75 16.8,14.25 9,18.5 1.2,14.25 1.2,5.75"
          stroke={TK.ink} strokeWidth="1.2" fill="none" strokeLinejoin="round" />
      </svg>
      <span style={{ fontFamily: TK.sans, fontWeight: 500, fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase', color: TK.ink }}>
        Hachure
      </span>
    </div>
  )
}
