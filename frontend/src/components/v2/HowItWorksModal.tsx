import { useEffect } from 'react'
import { TK } from '../../theme'

const STEPS = [
  {
    num: '01',
    title: 'Start from OSM or a map reference',
    body: 'Pull any real-world location from OpenStreetMap, or upload a historical map image and trace over it as a reference layer. Your choice of source, same editor either way.',
  },
  {
    num: '02',
    title: 'Real geodata, auto-classified',
    body: 'Terrain, rivers, roads, settlements, and elevation fetched from actual earth data and automatically mapped to hex types. A usable map in seconds.',
  },
  {
    num: '03',
    title: 'A full set of editing tools',
    body: 'Paint terrain by hand, adjust blob shapes, tune elevation shading, style roads and rail, place settlement icons, draw rivers. Every layer is independently editable and togglable.',
  },
  {
    num: '04',
    title: 'Export a print-ready PDF',
    body: 'Scaled exactly to your paper — A3 scenario sheets, A4 reference maps, A1 campaign boards. What you see is what prints.',
  },
]

export function HowItWorksModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(42,37,32,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
        padding: 32,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: TK.paper,
          border: `1px solid ${TK.line}`,
          width: '100%',
          maxWidth: 1100,
          position: 'relative',
          padding: '52px 52px 48px',
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 18, right: 18,
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 6,
            color: TK.inkFaint,
            fontFamily: TK.mono,
            fontSize: 18,
            lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = TK.ink }}
          onMouseLeave={e => { e.currentTarget.style.color = TK.inkFaint }}
        >
          ✕
        </button>

        {/* Header */}
        <div style={{ marginBottom: 44 }}>
          <h2 style={{
            fontFamily: TK.serif,
            fontWeight: 400,
            fontSize: 32,
            color: TK.ink,
            margin: '0 0 8px 0',
            letterSpacing: -0.3,
          }}>
            How it works
          </h2>
          <p style={{
            fontFamily: TK.sans,
            fontSize: 12,
            color: TK.inkMute,
            margin: 0,
            lineHeight: 1.5,
          }}>
            From a location to a print-ready wargame map, in four steps.
          </p>
        </div>

        {/* 4-column grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 24,
        }}>
          {STEPS.map(step => (
            <StepCard key={step.num} {...step} />
          ))}
        </div>
      </div>
    </div>
  )
}

function StepCard({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Image placeholder */}
      <div style={{
        width: '100%',
        aspectRatio: '4 / 3',
        background: TK.paper2,
        border: `1px solid ${TK.line}`,
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{
          fontFamily: TK.mono,
          fontSize: 10,
          color: TK.inkFaint,
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}>
          {num}
        </span>
      </div>

      {/* Step number */}
      <span style={{
        fontFamily: TK.mono,
        fontSize: 10,
        color: TK.rust,
        letterSpacing: 1.5,
        marginBottom: 8,
      }}>
        {num}
      </span>

      {/* Title */}
      <h3 style={{
        fontFamily: TK.serif,
        fontWeight: 400,
        fontSize: 17,
        color: TK.ink,
        margin: '0 0 10px 0',
        lineHeight: 1.25,
        letterSpacing: -0.1,
      }}>
        {title}
      </h3>

      {/* Body */}
      <p style={{
        fontFamily: TK.sans,
        fontSize: 12,
        color: TK.inkMute,
        margin: 0,
        lineHeight: 1.65,
      }}>
        {body}
      </p>
    </div>
  )
}
