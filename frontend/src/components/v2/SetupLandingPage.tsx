import { useState } from 'react'
import { TK } from '../../theme'
import { useMapStore } from '../../store/mapStore'
import { HowItWorksModal } from './HowItWorksModal'

export function SetupLandingPage({
  onNewMap,
  onResume,
  onLoadFile,
}: {
  onNewMap: () => void
  onResume: () => void
  onLoadFile: () => void
}) {
  const { generatedHexes, generatedMetadata, paperSize, orientation } = useMapStore()
  const hasSavedMap = generatedHexes.length > 0
  const [showHowItWorks, setShowHowItWorks] = useState(false)

  return (
    <div style={{
      position: 'relative',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      background: TK.paper,
      fontFamily: TK.sans,
      color: TK.ink,
    }}>
      {/* Ghost map background */}
      <div style={{
        position: 'absolute',
        right: 0, top: 0, bottom: 0,
        width: '65%',
        overflow: 'hidden',
        pointerEvents: 'none',
      }}>
        <img
          src="/map-placeholder.jpg"
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'left center',
            opacity: 0.25,
            mixBlendMode: 'multiply',
          }}
        />
        <div style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(to right, ${TK.paper} 0%, ${TK.paper}cc 20%, ${TK.paper}44 55%, transparent 100%)`,
        }} />
      </div>

      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: '20px 28px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        zIndex: 1,
      }}>
        <HachureLogo />
        <span style={{ fontFamily: TK.mono, fontSize: 10, color: TK.inkFaint, letterSpacing: 1.5 }}>V0.1</span>
      </div>

      {/* Main content */}
      <div style={{
        position: 'relative', zIndex: 1,
        height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        paddingLeft: 80,
      }}>
        <h1 style={{
          fontFamily: TK.serif,
          fontSize: 72,
          fontWeight: 400,
          color: TK.ink,
          lineHeight: 1.02,
          margin: '0 0 18px 0',
          letterSpacing: -0.5,
        }}>
          A hex map<br />editor.
        </h1>

        <p style={{
          fontFamily: TK.sans,
          fontSize: 13,
          color: TK.inkMute,
          maxWidth: 370,
          lineHeight: 1.65,
          margin: '0 0 36px 0',
        }}>
          Build printable hex maps from real geodata, blank
          grids, or traced references. Exports a print-ready PDF.
        </p>

        {/* Resume — standalone, only when there's saved work */}
        {hasSavedMap && (
          <>
            <button
              onClick={onResume}
              style={{
                width: 420,
                background: TK.ink,
                border: `1px solid ${TK.line}`,
                padding: '20px 22px',
                cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                textAlign: 'left',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = TK.ink2 }}
              onMouseLeave={e => { e.currentTarget.style.background = TK.ink }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: TK.sans, fontWeight: 600, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: '#fff' }}>
                    Resume
                  </span>
                  <span style={{ fontFamily: TK.serif, fontStyle: 'italic', fontSize: 13, color: TK.inkFaint }}>
                    last session
                  </span>
                </div>
                <div style={{ fontFamily: TK.sans, fontSize: 11, color: TK.inkFaint }}>
                  {generatedMetadata
                    ? `${paperSize} · ${orientation} · ${generatedMetadata.hex_count} hexes · ${generatedMetadata.hex_size_km.toFixed(1)} km each`
                    : `${paperSize} · ${orientation} · ${generatedHexes.length} hexes`}
                </div>
              </div>
              <ArrowRight />
            </button>

            {/* Separator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 420, margin: '16px 0' }}>
              <div style={{ flex: 1, height: 1, background: TK.line }} />
              <span style={{ fontFamily: TK.sans, fontSize: 10, color: TK.inkFaint, letterSpacing: 1, textTransform: 'uppercase' }}>or</span>
              <div style={{ flex: 1, height: 1, background: TK.line }} />
            </div>
          </>
        )}

        {/* Action card group */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          width: 420,
          border: `1px solid ${TK.line}`,
        }}>
          {/* NEW MAP */}
          <button
            onClick={onNewMap}
            style={{
              background: hasSavedMap ? TK.surface : TK.ink,
              border: 'none',
              padding: '20px 22px',
              cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              textAlign: 'left',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = hasSavedMap ? TK.paper2 : TK.ink2 }}
            onMouseLeave={e => { e.currentTarget.style.background = hasSavedMap ? TK.surface : TK.ink }}
          >
            <div>
              <div style={{ fontFamily: TK.sans, fontWeight: 600, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: hasSavedMap ? TK.ink : '#fff', marginBottom: 4 }}>
                New Map
              </div>
              <div style={{ fontFamily: TK.sans, fontSize: 11, color: hasSavedMap ? TK.inkMute : TK.inkFaint }}>
                Choose source · set paper · paint
              </div>
            </div>
            {hasSavedMap ? <ArrowRightDark /> : <ArrowRight />}
          </button>

          {/* LOAD FROM FILE */}
          <button
            onClick={onLoadFile}
            style={{
              background: TK.surface,
              border: 'none',
              borderTop: `1px solid ${TK.line}`,
              padding: '18px 22px',
              cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              textAlign: 'left',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = TK.paper2 }}
            onMouseLeave={e => { e.currentTarget.style.background = TK.surface }}
          >
            <div>
              <div style={{ fontFamily: TK.sans, fontWeight: 600, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: TK.ink, marginBottom: 4 }}>
                Load from Saved File
              </div>
              <div style={{ fontFamily: TK.sans, fontSize: 11, color: TK.inkMute }}>
                .tabula or .json format
              </div>
            </div>
            <FolderIcon />
          </button>
        </div>

        {/* How it works link */}
        <button
          onClick={() => setShowHowItWorks(true)}
          style={{
            marginTop: 16,
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontFamily: TK.sans,
            fontSize: 11,
            color: TK.inkMute,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            letterSpacing: 0.2,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = TK.ink }}
          onMouseLeave={e => { e.currentTarget.style.color = TK.inkMute }}
        >
          How does it work?
          <span style={{ fontSize: 12 }}>→</span>
        </button>
      </div>

      {showHowItWorks && <HowItWorksModal onClose={() => setShowHowItWorks(false)} />}

      {/* Footer */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '13px 28px',
        display: 'flex', alignItems: 'center',
        borderTop: `1px solid ${TK.line2}`,
        zIndex: 1,
      }}>
        <span style={{ fontFamily: TK.mono, fontSize: 10, color: TK.inkFaint, letterSpacing: 0.5 }}>
          Hachure · v0.1
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 28 }}>
          <FooterStat label="PAPER" value="A1–A6" />
          <FooterStat label="SOURCES" value="OSM · Blank · Ref" />
          <FooterStat label="OUTPUT" value="PDF · print scale" />
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function HachureLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <HexIcon />
      <span style={{ fontFamily: TK.sans, fontWeight: 500, fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase', color: TK.ink }}>
        Hachure
      </span>
    </div>
  )
}

function HexIcon() {
  return (
    <svg width="18" height="20" viewBox="0 0 18 20" fill="none">
      <polygon
        points="9,1.5 16.8,5.75 16.8,14.25 9,18.5 1.2,14.25 1.2,5.75"
        stroke={TK.ink}
        strokeWidth="1.2"
        fill="none"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function FooterStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontFamily: TK.mono, fontSize: 9, color: TK.inkFaint, letterSpacing: 1, textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ fontFamily: TK.sans, fontSize: 11, color: TK.inkMute }}>
        {value}
      </span>
    </div>
  )
}

function ArrowRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ArrowRightDark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 8h10M9 4l4 4-4 4" stroke={TK.inkFaint} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 4.5C2 3.67 2.67 3 3.5 3h3l1.5 2h5C13.33 5 14 5.67 14 6.5v6c0 .83-.67 1.5-1.5 1.5h-9C2.67 14 2 13.33 2 12.5v-8z" stroke={TK.inkFaint} strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}

function BookmarkIcon() {
  return (
    <svg width="14" height="16" viewBox="0 0 14 16" fill="none">
      <path d="M2 2h10v13l-5-3-5 3V2z" stroke={TK.inkFaint} strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}
