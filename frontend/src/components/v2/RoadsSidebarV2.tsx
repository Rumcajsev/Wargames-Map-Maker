import { useState, useEffect, useRef, useMemo } from 'react'
import {
  useMapStore,
  DEFAULT_ROAD_TIER_STYLES, DEFAULT_RAIL_STYLE, DEFAULT_ROAD_GEOM, DEFAULT_RAIL_GEOM,
} from '../../store/mapStore'
import type { RoadDashStyle, RoadTierStyle } from '../../store/mapStore'
import { buildRoadChains, buildRailChains } from '../../lib/roadChains'
import { drawRoadsAndRails } from '../../lib/drawRoadsRails'
import { PALETTE_RAIL_LIGHT, PALETTE_RAIL_DARK } from '../../palettes'
import { computePaper } from '../../lib/projection'
import { useTheme } from '../../context/ThemeContext'
import {
  SidebarShell, SidebarHeader, SidebarSection, SidebarDetailHeader,
  DetailSection, DetailViewShell, ToggleRow,
  BrushRow, MiniSlider, BigColorSwatch, SegmentedControl, tintBg,
} from './sidebar'

// ── Palette groups ────────────────────────────────────────────────────────────

const ROAD_SURFACE_GROUPS = [
  { label: 'Pale', colors: ['#ffffff', '#f5f0e8', '#f0e8d0', '#e8dcc8'] },
  { label: 'Warm', colors: ['#ffe8a8', '#ffe0a0', '#ffd080', '#f5d878', '#f0e0b8', '#d8d8c0', '#d0cca8'] },
  { label: 'Red',  colors: ['#c83030', '#a02020', '#802020', '#d85050'] },
] as const satisfies { label: string; colors: string[] }[]

const ROAD_CASING_GROUPS = [
  { label: 'Dark', colors: ['#1a1208', '#3a3020', '#4a3820'] },
  { label: 'Warm', colors: ['#6a4828', '#8a5c2a', '#b07820', '#786040', '#a09070', '#606060', '#808060'] },
  { label: 'Red',  colors: ['#5a1010', '#781818', '#380808'] },
] as const satisfies { label: string; colors: string[] }[]

const RAIL_LIGHT_GROUPS = [{ label: 'Light', colors: [...PALETTE_RAIL_LIGHT] }] as const satisfies { label: string; colors: string[] }[]
const RAIL_DARK_GROUPS  = [{ label: 'Dark',  colors: [...PALETTE_RAIL_DARK]  }] as const satisfies { label: string; colors: string[] }[]

// ── HexPreview ────────────────────────────────────────────────────────────────
// Shared road + rail preview. Uses the exact same buildRoadChains / buildRailChains
// + drawRoadsAndRails pipeline as the map — synthetic hex centers in pixel space,
// identity project fn, so every style/wiggle/smoothing param reflects live.

function HexPreview({ mode, tier = 0 }: { mode: 'road' | 'rail'; tier?: 0 | 1 | 2 }) {
  const t = useTheme()
  const {
    hexSizeMm, hexOrientation,
    roadTierStyles, roadWiggleAmp, roadWiggleFreq, roadSmoothing, roadPathSmoothing,
    roadTierGeometry, mapStyle,
    railStyle, railWiggleAmp, railWiggleFreq, railSmoothing, railGeomOverride,
    generatedMetadata,
  } = useMapStore()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const PX_PER_MM = 96 / 25.4
  const sqrt3 = Math.sqrt(3)

  // Hex and road at true 1:1 print scale (96dpi).
  // Hexes: hexSizeMm is flat-to-flat → outer radius = hexSizeMm / sqrt(3)
  const hexR = (hexSizeMm / sqrt3) * PX_PER_MM
  const isFlat = hexOrientation === 'flat'
  // Adjacent hex center distance = sqrt(3) * outer_radius = hexSizeMm (in any unit-space)
  const interHexDist = hexSizeMm * PX_PER_MM

  // Road stroke scale: outerW is in canvas-coordinate pixels at the map's fit-to-screen scale.
  // Physical road width in mm = outerW * paper_mm[0] / pw_screen.
  // At 96dpi that becomes outerW * PX_PER_MM * paper_mm[0] / pw_screen.
  // We need to multiply outerW by this physicalScale before drawing.
  const physicalScale = (() => {
    if (!generatedMetadata) return 1
    const canvasAreaW = window.innerWidth - t.sidebarWidth - 32
    const canvasAreaH = window.innerHeight - 48
    const { pw } = computePaper(canvasAreaW, canvasAreaH, generatedMetadata)
    return PX_PER_MM * generatedMetadata.paper_mm[0] / pw
  })()

  const W = t.sidebarWidth
  const hexH = (isFlat ? sqrt3 : 2) * hexR
  const H = Math.min(140, Math.max(70, Math.round(hexH * 2.4)))
  const cy = H / 2

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, W, H)

    // Synthetic hex centers in pixel space — path follows manually defined
    // key points (as [t, yOffset] fractions of H) smoothly interpolated via
    // smoothstep, so the base curve shape is deliberate. Wiggle + smoothing
    // then apply on top exactly as on the map.
    const numHexes = Math.ceil(W / interHexDist) + 6
    const hexIdx = new Map<string, { center: [number, number] }>()

    // Key points: [t along path 0–1, y offset as fraction of H]
    const keyPts: [number, number][] = [
      [0,    0.30],
      [0.20, 0.22],
      [0.42, -0.10],
      [0.60, -0.28],
      [0.78, -0.20],
      [1,    0.00],
    ]
    const pathY = (t: number) => {
      for (let k = 0; k < keyPts.length - 1; k++) {
        const [t0, y0] = keyPts[k], [t1, y1] = keyPts[k + 1]
        if (t <= t1) {
          const f = (t - t0) / (t1 - t0)
          const sf = f * f * (3 - 2 * f)   // smoothstep
          return cy + H * (y0 + sf * (y1 - y0))
        }
      }
      return cy + H * keyPts[keyPts.length - 1][1]
    }

    for (let i = 0; i < numHexes; i++) {
      const t = i / (numHexes - 1)
      hexIdx.set(`${i},0`, { center: [(i - 2) * interHexDist, pathY(t)] })
    }

    // Identity projection — hex centers are already in canvas pixel coords
    const project = (x: number, y: number): [number, number] => [x, y]

    if (mode === 'road') {
      const geom = roadTierGeometry[tier]
      const wiggleAmp     = geom?.wiggleAmp     ?? roadWiggleAmp
      const wiggleFreq    = geom?.wiggleFreq    ?? roadWiggleFreq
      const smoothing     = geom?.smoothing     ?? roadSmoothing
      const pathSmoothing = geom?.pathSmoothing ?? roadPathSmoothing

      const edges = Array.from({ length: numHexes - 1 }, (_, i) => ({
        q1: i, r1: 0, q2: i + 1, r2: 0, tier,
      }))
      const { chains } = buildRoadChains(edges, hexIdx, {}, wiggleAmp, wiggleFreq, smoothing, pathSmoothing)

      // Scale outerW to physical print size (96dpi)
      const tierStyles = DEFAULT_ROAD_TIER_STYLES.map(
        (def, t) => t === tier
          ? { ...roadTierStyles[tier], outerW: roadTierStyles[tier].outerW * physicalScale }
          : { ...def, outerW: def.outerW * physicalScale },
      ) as [RoadTierStyle, RoadTierStyle, RoadTierStyle]

      drawRoadsAndRails(ctx, {
        roadChains: chains, junctions: [], railChains: [],
        tierStyles, railStyle: DEFAULT_RAIL_STYLE,
        project, mapStyle: mapStyle ?? 'standard',
      })
    } else {
      const wiggleAmp  = railGeomOverride?.wiggleAmp  ?? railWiggleAmp
      const wiggleFreq = railGeomOverride?.wiggleFreq ?? railWiggleFreq
      const smoothing  = railGeomOverride?.smoothing  ?? railSmoothing

      const edges = Array.from({ length: numHexes - 1 }, (_, i) => ({
        q1: i, r1: 0, q2: i + 1, r2: 0,
      }))
      const { chains } = buildRailChains(
        edges, [], hexIdx, new Map(), new Map(), {}, wiggleAmp, wiggleFreq, smoothing,
      )

      drawRoadsAndRails(ctx, {
        roadChains: [], junctions: [], railChains: chains,
        tierStyles: DEFAULT_ROAD_TIER_STYLES,
        railStyle: { ...railStyle, thickness: railStyle.thickness * physicalScale },
        project,
      })
    }
  }, [
    mode, tier, W, H, cy, interHexDist, physicalScale,
    roadTierStyles, roadWiggleAmp, roadWiggleFreq, roadSmoothing, roadPathSmoothing,
    roadTierGeometry, mapStyle,
    railStyle, railWiggleAmp, railWiggleFreq, railSmoothing, railGeomOverride,
    generatedMetadata,
  ])

  // Hex grid centers for the SVG underlay
  const centers = useMemo(() => {
    const cx = W / 2
    const cs: { x: number; y: number }[] = []
    if (isFlat) {
      const colStep = 1.5 * hexR, rowStep = sqrt3 * hexR
      const cols = Math.ceil(cx / colStep) + 2, rows = Math.ceil(cy / rowStep) + 2
      for (let c = -cols; c <= cols; c++) {
        const yOff = Math.abs(c) % 2 === 1 ? rowStep / 2 : 0
        for (let r = -rows; r <= rows; r++)
          cs.push({ x: cx + c * colStep, y: cy + r * rowStep + yOff })
      }
    } else {
      const colStep = sqrt3 * hexR, rowStep = 1.5 * hexR
      const cols = Math.ceil(cx / colStep) + 2, rows = Math.ceil(cy / rowStep) + 2
      for (let r = -rows; r <= rows; r++) {
        const xOff = Math.abs(r) % 2 === 1 ? colStep / 2 : 0
        for (let c = -cols; c <= cols; c++)
          cs.push({ x: cx + c * colStep + xOff, y: cy + r * rowStep })
      }
    }
    return cs
  }, [isFlat, hexR, cy, sqrt3, W])

  const hexPolyPts = (hx: number, hy: number) => {
    const off = isFlat ? 0 : -30
    return Array.from({ length: 6 }, (_, i) => {
      const a = ((i * 60) + off) * Math.PI / 180
      return `${hx + Math.cos(a) * hexR},${hy + Math.sin(a) * hexR}`
    }).join(' ')
  }

  return (
    <div style={{ position: 'relative', width: W, height: H }}>
      {/* Hex grid — SVG so it stays crisp and needs no canvas state */}
      <svg width={W} height={H} style={{ display: 'block', position: 'absolute', top: 0, left: 0 }}>
        {centers.map(({ x, y }, i) => (
          <polygon key={i} points={hexPolyPts(x, y)} fill="none" stroke={t.line} strokeWidth={0.8} />
        ))}
      </svg>
      {/* Road / rail — drawn by the exact same canvas pipeline as the map */}
      <canvas
        ref={canvasRef} width={W} height={H}
        style={{ display: 'block', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      />
    </div>
  )
}

// ── Sub-label ─────────────────────────────────────────────────────────────────

function SubLabel({ label }: { label: string }) {
  const t = useTheme()
  return (
    <div style={{ padding: '6px 14px 0', fontFamily: t.mono, fontSize: 9, letterSpacing: 0.8, color: t.inkFaint, textTransform: 'uppercase', fontWeight: 600 }}>
      {label}
    </div>
  )
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROAD_TIERS = [
  { tier: 0 as const, label: 'Motorway', color: '#b07820' },
  { tier: 1 as const, label: 'Primary',  color: '#8a5c2a' },
  { tier: 2 as const, label: 'Secondary', color: '#606060' },
]

type ViewId = 'list' | 'road-style' | 'rail-style' | 'road-shape' | 'rail-shape' | 'segment'

// ── ActionLink — small right-aligned text link for section headers ─────────────

function ActionLink({ label, onClick }: { label: string; onClick: () => void }) {
  const t = useTheme()
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        fontFamily: t.mono, fontSize: 9, color: t.inkMute, letterSpacing: 0.3,
      }}
    >
      {label} ›
    </button>
  )
}

// ── FetchButton ────────────────────────────────────────────────────────────────

function FetchButton({ label, status, onFetch, onClear }: {
  label: string
  status: string
  onFetch: () => void
  onClear?: () => void
}) {
  const t = useTheme()
  const loading = status === 'loading'
  const done = status === 'done'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 14px' }}>
      <button
        onClick={onFetch}
        disabled={loading}
        style={{
          flex: 1, padding: '5px 0',
          background: 'none',
          border: `1px solid ${loading ? t.line : t.rust}`,
          color: loading ? t.inkFaint : t.rust,
          cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: t.mono, fontSize: 10, letterSpacing: 0.3,
        }}
      >
        {loading ? 'fetching…' : `Fetch ${label}`}
      </button>
      {done && onClear && (
        <button
          onClick={onClear}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            fontFamily: t.mono, fontSize: 9, color: t.inkFaint,
          }}
        >
          clear
        </button>
      )}
    </div>
  )
}

// ── ApplyRow — tier apply buttons ─────────────────────────────────────────────

function ApplyRow({ tiers, highlightTier, onApply, onHighlight, onUnhighlight }: {
  tiers: string[]
  highlightTier: number | null
  onApply: (i: number) => void
  onHighlight: (i: number) => void
  onUnhighlight: () => void
}) {
  const t = useTheme()
  return (
    <div style={{ display: 'flex', gap: 4, padding: '4px 14px' }}>
      {tiers.map((label, i) => (
        <button
          key={label}
          onClick={() => onApply(i)}
          onMouseEnter={() => onHighlight(i)}
          onMouseLeave={onUnhighlight}
          style={{
            flex: 1, padding: '4px 0',
            background: highlightTier === i ? tintBg(t.rust, 0.1) : 'transparent',
            border: `1px solid ${highlightTier === i ? t.rust : t.line}`,
            color: highlightTier === i ? t.rust : t.inkMute,
            cursor: 'pointer', fontFamily: t.mono, fontSize: 9, letterSpacing: 0.3,
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ── RoadShapeView ─────────────────────────────────────────────────────────────

function RoadShapeView({ onBack }: { onBack: () => void }) {
  const t = useTheme()
  const {
    roadWiggleAmp, setRoadWiggleAmp,
    roadWiggleFreq, setRoadWiggleFreq,
    roadPathSmoothing, setRoadPathSmoothing,
    roadSmoothing, setRoadSmoothing,
  } = useMapStore()

  const isModified =
    roadWiggleAmp !== DEFAULT_ROAD_GEOM.wiggleAmp ||
    roadWiggleFreq !== DEFAULT_ROAD_GEOM.wiggleFreq ||
    roadPathSmoothing !== DEFAULT_ROAD_GEOM.pathSmoothing ||
    roadSmoothing !== DEFAULT_ROAD_GEOM.smoothing

  const handleReset = () => {
    setRoadWiggleAmp(DEFAULT_ROAD_GEOM.wiggleAmp)
    setRoadWiggleFreq(DEFAULT_ROAD_GEOM.wiggleFreq)
    setRoadPathSmoothing(DEFAULT_ROAD_GEOM.pathSmoothing)
    setRoadSmoothing(DEFAULT_ROAD_GEOM.smoothing)
  }

  return (
    <DetailViewShell header={
      <SidebarDetailHeader
        title="Road shape"
        onBack={onBack}
        status={isModified ? 'modified' : 'default'}
        onReset={isModified ? handleReset : undefined}
      />
    }>
      <DetailSection label="Geometry" hint="Default wiggle and smoothing for all road tiers.">
        <MiniSlider label="Wiggle amp" display={`${Math.round(roadWiggleAmp * 100)}%`} value={Math.round(roadWiggleAmp * 100)} min={0} max={100} step={1} accentColor={t.rust} onChange={v => setRoadWiggleAmp(v / 100)} />
        <MiniSlider label="Wiggle freq" display={roadWiggleFreq.toFixed(1)} value={Math.round(roadWiggleFreq * 10)} min={5} max={100} step={1} accentColor={t.rust} onChange={v => setRoadWiggleFreq(v / 10)} />
        <MiniSlider label="Path smooth" display={roadPathSmoothing} value={roadPathSmoothing} min={0} max={50} step={1} accentColor={t.rust} onChange={setRoadPathSmoothing} />
        <MiniSlider label="Line smooth" display={roadSmoothing} value={roadSmoothing} min={0} max={30} step={1} accentColor={t.rust} onChange={setRoadSmoothing} />
      </DetailSection>
    </DetailViewShell>
  )
}

// ── RailShapeView ─────────────────────────────────────────────────────────────

function RailShapeView({ onBack }: { onBack: () => void }) {
  const t = useTheme()
  const {
    railWiggleAmp, setRailWiggleAmp,
    railWiggleFreq, setRailWiggleFreq,
    railPathSmoothing, setRailPathSmoothing,
    railSmoothing, setRailSmoothing,
  } = useMapStore()

  const railColor = '#4a7a9a'

  const isModified =
    railWiggleAmp !== DEFAULT_RAIL_GEOM.wiggleAmp ||
    railWiggleFreq !== DEFAULT_RAIL_GEOM.wiggleFreq ||
    railPathSmoothing !== DEFAULT_RAIL_GEOM.pathSmoothing ||
    railSmoothing !== DEFAULT_RAIL_GEOM.smoothing

  const handleReset = () => {
    setRailWiggleAmp(DEFAULT_RAIL_GEOM.wiggleAmp)
    setRailWiggleFreq(DEFAULT_RAIL_GEOM.wiggleFreq)
    setRailPathSmoothing(DEFAULT_RAIL_GEOM.pathSmoothing)
    setRailSmoothing(DEFAULT_RAIL_GEOM.smoothing)
  }

  return (
    <DetailViewShell header={
      <SidebarDetailHeader
        title="Rail shape"
        onBack={onBack}
        status={isModified ? 'modified' : 'default'}
        onReset={isModified ? handleReset : undefined}
      />
    }>
      <DetailSection label="Geometry" hint="Default wiggle and smoothing for rail lines.">
        <MiniSlider label="Wiggle amp" display={`${Math.round(railWiggleAmp * 100)}%`} value={Math.round(railWiggleAmp * 100)} min={0} max={100} step={1} accentColor={railColor} onChange={v => setRailWiggleAmp(v / 100)} />
        <MiniSlider label="Wiggle freq" display={railWiggleFreq.toFixed(1)} value={Math.round(railWiggleFreq * 10)} min={5} max={100} step={1} accentColor={railColor} onChange={v => setRailWiggleFreq(v / 10)} />
        <MiniSlider label="Path smooth" display={railPathSmoothing} value={railPathSmoothing} min={0} max={50} step={1} accentColor={railColor} onChange={setRailPathSmoothing} />
        <MiniSlider label="Line smooth" display={railSmoothing} value={railSmoothing} min={0} max={30} step={1} accentColor={railColor} onChange={setRailSmoothing} />
      </DetailSection>
    </DetailViewShell>
  )
}

// ── RoadStyleView ─────────────────────────────────────────────────────────────

function RoadStyleView({ tier, onBack }: { tier: 0 | 1 | 2; onBack: () => void }) {
  const t = useTheme()
  const {
    mapStyle,
    roadTierStyles, setRoadTierStyle,
    roadWiggleAmp, roadWiggleFreq, roadPathSmoothing, roadSmoothing,
    roadTierGeometry, setRoadTierGeometry, clearRoadTierGeometry,
  } = useMapStore()

  const s = roadTierStyles[tier]
  const def = DEFAULT_ROAD_TIER_STYLES[tier]

  const geomOverride = roadTierGeometry[tier]
  const overrideEnabled = geomOverride !== null
  const globalGeom = { wiggleAmp: roadWiggleAmp, wiggleFreq: roadWiggleFreq, pathSmoothing: roadPathSmoothing, smoothing: roadSmoothing }
  const effectiveGeom = geomOverride ?? globalGeom

  const isModified =
    s.outer !== def.outer || s.inner !== def.inner || s.outerW !== def.outerW ||
    s.caseDash !== def.caseDash || s.fillDash !== def.fillDash ||
    s.roughness !== def.roughness || s.bowing !== def.bowing

  const handleReset = () => setRoadTierStyle(tier, { ...def })

  const DASH_OPTIONS: { value: RoadDashStyle; label: string }[] = [
    { value: 'solid', label: 'Solid' },
    { value: 'dashed', label: 'Dashed' },
    { value: 'dotted', label: 'Dotted' },
  ]

  return (
    <DetailViewShell header={
      <SidebarDetailHeader
        title={ROAD_TIERS[tier].label}
        onBack={onBack}
        status={isModified ? 'modified' : 'default'}
        onReset={isModified ? handleReset : undefined}
      />
    }>
      <DetailSection
        label="Appearance"
        preview={<HexPreview mode="road" tier={tier} />}
      >
        <MiniSlider label="Thickness" display={s.outerW.toFixed(1)} value={s.outerW * 10} min={5} max={100} step={5} accentColor={ROAD_TIERS[tier].color} onChange={v => setRoadTierStyle(tier, { outerW: v / 10 })} />
        <SubLabel label="Surface" />
        <BigColorSwatch value={s.inner} onChange={v => setRoadTierStyle(tier, { inner: v })} groups={ROAD_SURFACE_GROUPS} />
        <SubLabel label="Fill stroke" />
        <div style={{ padding: '4px 14px' }}>
          <SegmentedControl options={DASH_OPTIONS} value={s.fillDash} onChange={v => setRoadTierStyle(tier, { fillDash: v })} />
        </div>
        <SubLabel label="Casing" />
        <BigColorSwatch value={s.outer} onChange={v => setRoadTierStyle(tier, { outer: v })} groups={ROAD_CASING_GROUPS} />
        <SubLabel label="Casing stroke" />
        <div style={{ padding: '4px 14px' }}>
          <SegmentedControl options={DASH_OPTIONS} value={s.caseDash} onChange={v => setRoadTierStyle(tier, { caseDash: v })} />
        </div>
      </DetailSection>

      <DetailSection
        label="Geometry override"
        hint="Override the default road shape for this tier."
        toggle={{
          enabled: overrideEnabled,
          onChange: checked => {
            if (checked) setRoadTierGeometry(tier, { ...globalGeom })
            else clearRoadTierGeometry(tier)
          },
        }}
      >
        <MiniSlider label="Wiggle amp" display={`${Math.round(effectiveGeom.wiggleAmp * 100)}%`} value={Math.round(effectiveGeom.wiggleAmp * 100)} min={0} max={100} step={1} accentColor={ROAD_TIERS[tier].color} onChange={v => setRoadTierGeometry(tier, { wiggleAmp: v / 100 })} />
        <MiniSlider label="Wiggle freq" display={effectiveGeom.wiggleFreq.toFixed(1)} value={Math.round(effectiveGeom.wiggleFreq * 10)} min={5} max={100} step={1} accentColor={ROAD_TIERS[tier].color} onChange={v => setRoadTierGeometry(tier, { wiggleFreq: v / 10 })} />
        <MiniSlider label="Path smooth" display={effectiveGeom.pathSmoothing} value={effectiveGeom.pathSmoothing} min={0} max={50} step={1} accentColor={ROAD_TIERS[tier].color} onChange={v => setRoadTierGeometry(tier, { pathSmoothing: v })} />
        <MiniSlider label="Line smooth" display={effectiveGeom.smoothing} value={effectiveGeom.smoothing} min={0} max={30} step={1} accentColor={ROAD_TIERS[tier].color} onChange={v => setRoadTierGeometry(tier, { smoothing: v })} />
      </DetailSection>
    </DetailViewShell>
  )
}

// ── RailStyleView ─────────────────────────────────────────────────────────────

function RailStyleView({ onBack }: { onBack: () => void }) {
  const t = useTheme()
  const {
    railStyle, setRailStyle,
    railWiggleAmp, railWiggleFreq, railPathSmoothing, railSmoothing,
    railGeomOverride, setRailGeomOverride, clearRailGeomOverride,
  } = useMapStore()

  const railColor = '#4a7a9a'
  const def = DEFAULT_RAIL_STYLE
  const globalGeom = { wiggleAmp: railWiggleAmp, wiggleFreq: railWiggleFreq, pathSmoothing: railPathSmoothing, smoothing: railSmoothing }
  const effectiveGeom = railGeomOverride ?? globalGeom

  const isModified =
    railStyle.thickness !== def.thickness ||
    railStyle.innerColor !== def.innerColor ||
    railStyle.outerColor !== def.outerColor ||
    railStyle.railStyle !== def.railStyle

  return (
    <DetailViewShell header={
      <SidebarDetailHeader
        title="Rail"
        onBack={onBack}
        status={isModified ? 'modified' : 'default'}
        onReset={isModified ? () => setRailStyle({ ...def }) : undefined}
      />
    }>
      <DetailSection label="Appearance" preview={<HexPreview mode="rail" />}>
        <div style={{ padding: '4px 14px' }}>
          <div style={{ fontFamily: t.sans, fontSize: 11, color: t.ink2, marginBottom: 6 }}>Style</div>
          <SegmentedControl
            options={[{ value: 'classic', label: 'Classic' }, { value: 'cross', label: 'Cross' }]}
            value={railStyle.railStyle}
            onChange={s => setRailStyle({ railStyle: s })}
          />
        </div>
        <MiniSlider label="Thickness" display={railStyle.thickness.toFixed(1)} value={railStyle.thickness * 10} min={5} max={80} step={5} accentColor={railColor} onChange={v => setRailStyle({ thickness: v / 10 })} />
        {railStyle.railStyle === 'classic' && (
          <>
            <SubLabel label="Inner color" />
            <BigColorSwatch value={railStyle.innerColor} onChange={v => setRailStyle({ innerColor: v })} groups={RAIL_LIGHT_GROUPS} />
          </>
        )}
        <SubLabel label={railStyle.railStyle === 'classic' ? 'Outer color' : 'Line color'} />
        <BigColorSwatch value={railStyle.outerColor} onChange={v => setRailStyle({ outerColor: v })} groups={RAIL_DARK_GROUPS} />
      </DetailSection>

      <DetailSection
        label="Geometry override"
        hint="Override the default rail shape."
        toggle={{
          enabled: railGeomOverride !== null,
          onChange: checked => {
            if (checked) setRailGeomOverride({ ...globalGeom })
            else clearRailGeomOverride()
          },
        }}
      >
        <MiniSlider label="Wiggle amp" display={`${Math.round(effectiveGeom.wiggleAmp * 100)}%`} value={Math.round(effectiveGeom.wiggleAmp * 100)} min={0} max={100} step={1} accentColor={railColor} onChange={v => setRailGeomOverride({ wiggleAmp: v / 100 })} />
        <MiniSlider label="Wiggle freq" display={effectiveGeom.wiggleFreq.toFixed(1)} value={Math.round(effectiveGeom.wiggleFreq * 10)} min={5} max={100} step={1} accentColor={railColor} onChange={v => setRailGeomOverride({ wiggleFreq: v / 10 })} />
        <MiniSlider label="Path smooth" display={effectiveGeom.pathSmoothing} value={effectiveGeom.pathSmoothing} min={0} max={50} step={1} accentColor={railColor} onChange={v => setRailGeomOverride({ pathSmoothing: v })} />
        <MiniSlider label="Line smooth" display={effectiveGeom.smoothing} value={effectiveGeom.smoothing} min={0} max={30} step={1} accentColor={railColor} onChange={v => setRailGeomOverride({ smoothing: v })} />
      </DetailSection>
    </DetailViewShell>
  )
}

// ── SegmentView ───────────────────────────────────────────────────────────────

function SegmentView({ mode, onBack }: { mode: 'road' | 'rail'; onBack: () => void }) {
  const t = useTheme()
  const {
    roadWiggleAmp, roadWiggleFreq,
    railWiggleAmp, railWiggleFreq,
    roadSegmentProps, railSegmentProps,
    roadHopProps, railHopProps,
    selectedRoadSegmentKeys, selectedRailSegmentKeys,
    selectedRoadHopKey, selectedRailHopKey,
    setSelectedRoadHopKey, setSelectedRailHopKey,
    setRoadSegmentProp, clearRoadSegmentProp,
    setRailSegmentProp, clearRailSegmentProp,
    setRoadHopProp, clearRoadHopProp,
    setRailHopProp, clearRailHopProp,
  } = useMapStore()

  const isRoad = mode === 'road'
  const accentColor = isRoad ? t.rust : '#4a7a9a'
  const selectedKeys = isRoad ? selectedRoadSegmentKeys : selectedRailSegmentKeys
  const segmentProps = isRoad ? roadSegmentProps : railSegmentProps
  const hopProps = isRoad ? roadHopProps : railHopProps
  const selectedHopKey = isRoad ? selectedRoadHopKey : selectedRailHopKey
  const globalAmp = isRoad ? roadWiggleAmp : railWiggleAmp
  const globalFreq = isRoad ? roadWiggleFreq : railWiggleFreq
  const setProp = isRoad ? setRoadSegmentProp : setRailSegmentProp
  const clearProp = isRoad ? clearRoadSegmentProp : clearRailSegmentProp
  const setHopProp = isRoad ? setRoadHopProp : setRailHopProp
  const clearHopProp = isRoad ? clearRoadHopProp : clearRailHopProp
  const setSelectedHopKey = isRoad ? setSelectedRoadHopKey : setSelectedRailHopKey

  const firstProps = segmentProps[selectedKeys[0]]
  const segAmp = firstProps?.wiggleAmp ?? globalAmp
  const segFreq = firstProps?.wiggleFreq ?? globalFreq
  const hasSegOverride = selectedKeys.some(k => segmentProps[k] !== undefined)

  const hopP = selectedHopKey ? hopProps[selectedHopKey] : null
  const hopAmp = hopP?.wiggleAmp ?? (firstProps?.wiggleAmp ?? globalAmp)
  const hopFreq = hopP?.wiggleFreq ?? (firstProps?.wiggleFreq ?? globalFreq)
  const hasHopOverride = !!hopP

  return (
    <DetailViewShell header={
      <SidebarDetailHeader
        title={`${selectedKeys.length} segment${selectedKeys.length !== 1 ? 's' : ''}`}
        onBack={onBack}
        status={hasSegOverride ? 'modified' : 'default'}
        onReset={hasSegOverride ? () => { selectedKeys.forEach(k => clearProp(k)); setSelectedHopKey(null) } : undefined}
      />
    }>
      <DetailSection label="Wiggle" hint="Per-segment override. Reverts to default shape when cleared.">
        <MiniSlider
          label="Amplitude"
          display={`${Math.round(segAmp * 100)}%`}
          value={Math.round(segAmp * 100)}
          min={0} max={100} step={1}
          accentColor={accentColor}
          onChange={v => selectedKeys.forEach(k => setProp(k, { wiggleAmp: v / 100 }))}
        />
        <MiniSlider
          label="Frequency"
          display={segFreq.toFixed(1)}
          value={Math.round(segFreq * 10)}
          min={5} max={100} step={1}
          accentColor={accentColor}
          onChange={v => selectedKeys.forEach(k => setProp(k, { wiggleFreq: v / 10 }))}
        />
      </DetailSection>

      {selectedHopKey && (
        <DetailSection
          label="Hop wiggle"
          hint="Override for this specific hop point."
        >
          <MiniSlider
            label="Amplitude"
            display={`${Math.round(hopAmp * 100)}%`}
            value={Math.round(hopAmp * 100)}
            min={0} max={100} step={1}
            accentColor={accentColor}
            onChange={v => setHopProp(selectedHopKey, { wiggleAmp: v / 100 })}
          />
          <MiniSlider
            label="Frequency"
            display={hopFreq.toFixed(1)}
            value={Math.round(hopFreq * 10)}
            min={5} max={100} step={1}
            accentColor={accentColor}
            onChange={v => setHopProp(selectedHopKey, { wiggleFreq: v / 10 })}
          />
          {hasHopOverride && (
            <div style={{ padding: '4px 14px 0' }}>
              <button
                onClick={() => { clearHopProp(selectedHopKey); setSelectedHopKey(null) }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  fontFamily: t.mono, fontSize: 9, color: t.inkFaint, letterSpacing: 0.3,
                }}
              >
                ↺ reset hop
              </button>
            </div>
          )}
        </DetailSection>
      )}
    </DetailViewShell>
  )
}

// ── RoadsSidebarV2 ────────────────────────────────────────────────────────────

export function RoadsSidebarV2() {
  const t = useTheme()
  const {
    roadPaintMode, roadPaintBrush, roadPaintEraser,
    railPaintMode, railPaintEraser,
    roadNodeEditMode, railNodeEditMode,
    roadSelectMode, railSelectMode,
    setActiveTool,
    roadsStatus, fetchRoads, clearRoads,
    railsStatus, fetchRails, clearRails,
    osmHexPaths, osmHighlightTier, setOsmHighlightTier, applyOsmTier,
    osmRailHexPaths, osmRailHighlight, setOsmRailHighlight, applyOsmRails,
    showRawOsmRoads, setShowRawOsmRoads,
    selectedRoadSegmentKeys, setSelectedRoadSegmentKeys,
    selectedRailSegmentKeys, setSelectedRailSegmentKeys,
    bridgesEnabled, setBridgesEnabled,
    bridgeStyle, setBridgeStyle,
    bridgeTiers, updateBridgeTier, addBridgeTier, removeBridgeTier,
    dataSource,
  } = useMapStore()

  const [view, setView] = useState<ViewId>('list')
  const [activeTier, setActiveTier] = useState<0 | 1 | 2>(0)
  const [segmentMode, setSegmentMode] = useState<'road' | 'rail'>('road')

  // Auto-navigate to segment view when a segment is selected
  useEffect(() => {
    if (selectedRoadSegmentKeys.length > 0) {
      setSegmentMode('road')
      setView('segment')
    } else if (selectedRailSegmentKeys.length > 0) {
      setSegmentMode('rail')
      setView('segment')
    } else if (view === 'segment') {
      setView('list')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoadSegmentKeys.length, selectedRailSegmentKeys.length])

  const selectRoadBrush = (tier: 0 | 1 | 2) => {
    if (roadPaintMode && roadPaintBrush === tier && !roadPaintEraser) setActiveTool({ type: 'none' })
    else setActiveTool({ type: 'road', tier, erasing: false })
  }
  const selectRoadEraser = () => {
    if (roadPaintMode && roadPaintEraser) setActiveTool({ type: 'none' })
    else setActiveTool({ type: 'road', tier: roadPaintBrush, erasing: true })
  }
  const selectRailBrush = () => {
    if (railPaintMode && !railPaintEraser) setActiveTool({ type: 'none' })
    else setActiveTool({ type: 'rail', erasing: false })
  }
  const selectRailEraser = () => {
    if (railPaintMode && railPaintEraser) setActiveTool({ type: 'none' })
    else setActiveTool({ type: 'rail', erasing: true })
  }

  const eraserActive = roadPaintMode && roadPaintEraser
  const railBrushActive = railPaintMode && !railPaintEraser
  const railEraserActive = railPaintMode && railPaintEraser

  if (view === 'road-style') return <RoadStyleView tier={activeTier} onBack={() => setView('list')} />
  if (view === 'rail-style') return <RailStyleView onBack={() => setView('list')} />
  if (view === 'road-shape') return <RoadShapeView onBack={() => setView('list')} />
  if (view === 'rail-shape') return <RailShapeView onBack={() => setView('list')} />
  if (view === 'segment') return (
    <SegmentView
      mode={segmentMode}
      onBack={() => {
        if (segmentMode === 'road') setSelectedRoadSegmentKeys([])
        else setSelectedRailSegmentKeys([])
        setView('list')
      }}
    />
  )

  return (
    <SidebarShell>
      <SidebarHeader title="Roads" />

      {/* ── Roads ── */}
      <SidebarSection label="Roads" action={<ActionLink label="shape" onClick={() => setView('road-shape')} />}>
        {ROAD_TIERS.map(({ tier, label, color }) => (
          <BrushRow
            key={tier}
            label={label}
            color={color}
            active={roadPaintMode && roadPaintBrush === tier && !roadPaintEraser}
            shortcut={String(tier + 1)}
            showCog
            cogOpen={false}
            onSelect={() => selectRoadBrush(tier)}
            onCog={() => { setActiveTier(tier); setView('road-style') }}
          />
        ))}
        <BrushRow
          label="Eraser"
          color={t.inkFaint}
          active={eraserActive}
          shortcut="E"
          onSelect={selectRoadEraser}
        />
        {(roadNodeEditMode || roadSelectMode) && (
          <div style={{ padding: '4px 14px 0', fontFamily: t.sans, fontSize: 10.5, color: t.inkMute, lineHeight: 1.5 }}>
            {roadSelectMode ? 'Click a road to select. Cmd+click for a hop.' : 'Click nodes to edit.'}
          </div>
        )}
        {dataSource === 'osm' && (
          <>
            <FetchButton label="from OSM" status={roadsStatus} onFetch={fetchRoads} onClear={clearRoads} />
            {roadsStatus === 'done' && osmHexPaths.length > 0 && (
              <>
                <div style={{ padding: '2px 14px 0', fontFamily: t.sans, fontSize: 10.5, color: t.inkMute }}>Apply as tier:</div>
                <ApplyRow
                  tiers={['Highways', 'Primary', 'Secondary']}
                  highlightTier={osmHighlightTier}
                  onApply={i => applyOsmTier(i as 0 | 1 | 2)}
                  onHighlight={i => setOsmHighlightTier(i as 0 | 1 | 2)}
                  onUnhighlight={() => setOsmHighlightTier(null)}
                />
                <div style={{ padding: '2px 14px' }}>
                  <ToggleRow label="Show all OSM roads" checked={showRawOsmRoads} onChange={setShowRawOsmRoads} />
                </div>
              </>
            )}
          </>
        )}
      </SidebarSection>

      {/* ── Rails ── */}
      <SidebarSection label="Rails" action={<ActionLink label="shape" onClick={() => setView('rail-shape')} />}>
        <BrushRow
          label="Rail"
          color='#4a7a9a'
          active={railBrushActive}
          showCog
          cogOpen={false}
          onSelect={selectRailBrush}
          onCog={() => setView('rail-style')}
        />
        <BrushRow
          label="Eraser"
          color={t.inkFaint}
          active={railEraserActive}
          onSelect={selectRailEraser}
        />
        {railSelectMode && (
          <div style={{ padding: '4px 14px 0', fontFamily: t.sans, fontSize: 10.5, color: t.inkMute, lineHeight: 1.5 }}>
            Right-click a rail to select.
          </div>
        )}
        {dataSource === 'osm' && (
          <>
            <FetchButton label="from OSM" status={railsStatus} onFetch={fetchRails} onClear={clearRails} />
            {railsStatus === 'done' && osmRailHexPaths.length > 0 && (
              <div style={{ padding: '2px 14px' }}>
                <button
                  onClick={applyOsmRails}
                  onMouseEnter={() => setOsmRailHighlight(true)}
                  onMouseLeave={() => setOsmRailHighlight(false)}
                  style={{
                    width: '100%', padding: '4px 0',
                    background: osmRailHighlight ? tintBg('#4a7a9a', 0.1) : 'transparent',
                    border: `1px solid ${osmRailHighlight ? '#4a7a9a' : t.line}`,
                    color: osmRailHighlight ? '#4a7a9a' : t.inkMute,
                    cursor: 'pointer', fontFamily: t.mono, fontSize: 10, letterSpacing: 0.3,
                  }}
                >
                  Apply Rails
                </button>
              </div>
            )}
          </>
        )}
      </SidebarSection>

      {/* ── Bridges ── */}
      <DetailSection
        label="Bridges"
        hint="Render bridge symbols on road crossings."
        toggle={{ enabled: bridgesEnabled, onChange: setBridgesEnabled }}
      >
        <div style={{ padding: '4px 14px' }}>
          <div style={{ fontFamily: t.sans, fontSize: 11, color: t.ink2, marginBottom: 6 }}>Style</div>
          <SegmentedControl
            options={[{ value: 'plank', label: 'Plank' }, { value: 'icon', label: 'Icon' }]}
            value={bridgeStyle}
            onChange={setBridgeStyle}
          />
        </div>

        <div style={{ padding: '8px 14px 4px', fontFamily: t.mono, fontSize: 9, letterSpacing: 0.8, color: t.inkFaint, textTransform: 'uppercase', fontWeight: 600 }}>Tiers</div>
        {bridgeTiers.map((t, idx) => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 14px' }}>
            <span style={{ fontFamily: t.mono, fontSize: 10, color: t.inkFaint, width: 14, textAlign: 'right', flexShrink: 0 }}>{idx + 1}</span>
            <input
              type="color"
              value={t.color}
              onChange={e => updateBridgeTier(t.id, { color: e.target.value })}
              style={{ width: 22, height: 18, border: `1px solid ${t.line}`, padding: 0, cursor: 'pointer', background: 'none', flexShrink: 0 }}
            />
            <input
              type="text"
              value={t.label}
              onChange={e => updateBridgeTier(t.id, { label: e.target.value })}
              style={{
                flex: 1, minWidth: 0, background: t.paper, border: `1px solid ${t.line}`,
                color: t.ink2, fontSize: 11, padding: '2px 6px', fontFamily: t.sans, outline: 'none',
              }}
            />
            <button
              onClick={() => removeBridgeTier(t.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: t.inkFaint, fontSize: 13, lineHeight: 1 }}
              onMouseEnter={e => (e.currentTarget.style.color = t.rust)}
              onMouseLeave={e => (e.currentTarget.style.color = t.inkFaint)}
            >×</button>
          </div>
        ))}
        {bridgeTiers.length < 5 && (
          <div style={{ padding: '4px 14px' }}>
            <button
              onClick={addBridgeTier}
              style={{
                width: '100%', padding: '4px 0',
                background: 'transparent', border: `1px dashed ${t.line}`,
                color: t.inkFaint, cursor: 'pointer', fontFamily: t.mono, fontSize: 9, letterSpacing: 0.5,
              }}
            >
              + Add tier
            </button>
          </div>
        )}
      </DetailSection>

    </SidebarShell>
  )
}
