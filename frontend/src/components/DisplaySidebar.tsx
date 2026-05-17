import { useMapStore, TERRAIN_COLORS } from '../store/mapStore'
import { sidebarStyle, sectionStyle, labelStyle } from './sidebarStyles'

const terrainLabel = (t: string) => t.replace(/_/g, ' ')

// Edge labels per orientation: index 0–5 are edge midpoints, 6 = center.
// Flat-top vertex angles (canvas, Y-down): 0°,60°,120°,180°,240°,300°
//   → edge i midpoint is between V[i] and V[i+1]
const FLAT_EDGE_LABELS = ['SE', 'S', 'SW', 'NW', 'N', 'NE', 'C'] as const
// Pointy-top vertex angles: 30°,90°,150°,210°,270°,330°
const POINTY_EDGE_LABELS = ['SE', 'S', 'SW', 'NW', 'N', 'NE', 'C'] as const

function HexEdgePicker({
  hexOrientation,
  edgeIndex,
  onChange,
}: {
  hexOrientation: 'flat' | 'pointy'
  edgeIndex: number
  onChange: (i: number) => void
}) {
  const size = 52
  const cx = size / 2
  const cy = size / 2
  const R = size * 0.42
  const base = hexOrientation === 'flat' ? 0 : 30

  const verts = Array.from({ length: 6 }, (_, i) => {
    const a = ((base + 60 * i) * Math.PI) / 180
    return [cx + R * Math.cos(a), cy + R * Math.sin(a)] as [number, number]
  })

  const edgeMids = verts.map((v, i) => {
    const v2 = verts[(i + 1) % 6]
    return [(v[0] + v2[0]) / 2, (v[1] + v2[1]) / 2] as [number, number]
  })

  const polyStr = verts.map(([x, y]) => `${x},${y}`).join(' ')

  return (
    <svg
      width={size}
      height={size}
      style={{ display: 'block', cursor: 'pointer', flexShrink: 0 }}
    >
      <polygon points={polyStr} fill="none" stroke="#2a2b3d" strokeWidth={1} />

      {/* Edge hit areas */}
      {edgeMids.map(([mx, my], i) => {
        const active = edgeIndex === i
        return (
          <circle
            key={i}
            cx={mx}
            cy={my}
            r={6}
            fill={active ? '#7de0a0' : '#1e2030'}
            stroke={active ? '#4a9a6a' : '#3a3b4d'}
            strokeWidth={1}
            onClick={() => onChange(i)}
            style={{ cursor: 'pointer' }}
          />
        )
      })}

      {/* Center */}
      <circle
        cx={cx}
        cy={cy}
        r={6}
        fill={edgeIndex === 6 ? '#7de0a0' : '#1e2030'}
        stroke={edgeIndex === 6 ? '#4a9a6a' : '#3a3b4d'}
        strokeWidth={1}
        onClick={() => onChange(6)}
        style={{ cursor: 'pointer' }}
      />
    </svg>
  )
}

const CORNER_OPTIONS = [
  { value: 'top-left',     label: '↖' },
  { value: 'top-right',    label: '↗' },
  { value: 'bottom-left',  label: '↙' },
  { value: 'bottom-right', label: '↘' },
] as const

export function DisplaySidebar() {
  const {
    hexBorderMode, setHexBorderMode,
    hexNumbersEnabled, setHexNumbersEnabled,
    hexNumberStartCorner, setHexNumberStartCorner,
    hexNumberEdge, setHexNumberEdge,
    hexNumberColor, setHexNumberColor,
    hexOrientation,
  } = useMapStore()

  const edgeLabels = hexOrientation === 'flat' ? FLAT_EDGE_LABELS : POINTY_EDGE_LABELS
  const currentLabel = edgeLabels[hexNumberEdge] ?? '?'

  return (
    <div style={sidebarStyle}>

      {/* ── Hex borders ── */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Hex Borders</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['full', 'dots', 'none'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setHexBorderMode(mode)}
              style={{
                flex: 1, padding: '4px 0',
                background: hexBorderMode === mode ? '#1a2a3a' : 'none',
                color: hexBorderMode === mode ? '#7de0a0' : '#5a5a7a',
                border: '1px solid',
                borderColor: hexBorderMode === mode ? '#4a9a6a' : '#1e1f2e',
                borderRadius: 3, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 11, textTransform: 'capitalize',
              }}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* ── Hex Numbers ── */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={labelStyle}>Hex Numbers</div>
          <button
            onClick={() => setHexNumbersEnabled(!hexNumbersEnabled)}
            style={{
              padding: '2px 8px',
              background: hexNumbersEnabled ? '#1a2a3a' : 'none',
              color: hexNumbersEnabled ? '#7de0a0' : '#5a5a7a',
              border: '1px solid',
              borderColor: hexNumbersEnabled ? '#4a9a6a' : '#1e1f2e',
              borderRadius: 3, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 11,
            }}
          >
            {hexNumbersEnabled ? 'On' : 'Off'}
          </button>
        </div>

        {hexNumbersEnabled && (
          <>
            {/* Starting corner */}
            <div style={{ fontSize: 10, color: '#5a5a7a', marginBottom: 4 }}>Starting corner</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, marginBottom: 10 }}>
              {CORNER_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setHexNumberStartCorner(value)}
                  style={{
                    padding: '3px 0',
                    background: hexNumberStartCorner === value ? '#1a2a3a' : 'none',
                    color: hexNumberStartCorner === value ? '#7de0a0' : '#5a5a7a',
                    border: '1px solid',
                    borderColor: hexNumberStartCorner === value ? '#4a9a6a' : '#1e1f2e',
                    borderRadius: 3, cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 14,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Edge picker */}
            <div style={{ fontSize: 10, color: '#5a5a7a', marginBottom: 6 }}>
              Label position — {currentLabel}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <HexEdgePicker
                hexOrientation={hexOrientation}
                edgeIndex={hexNumberEdge}
                onChange={setHexNumberEdge}
              />
              <div style={{ fontSize: 10, color: '#5a5a7a', lineHeight: 1.5 }}>
                Click an edge<br />dot or center
              </div>
            </div>

            {/* Color */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 10, color: '#5a5a7a' }}>Color</div>
              <input
                type="color"
                value={hexNumberColor}
                onChange={e => setHexNumberColor(e.target.value)}
                style={{ width: 28, height: 20, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
              />
              <span style={{ fontSize: 10, color: '#5a5a7a' }}>{hexNumberColor}</span>
            </div>
          </>
        )}
      </div>

      {/* ── Terrain legend ── */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Terrain</div>
        {Object.entries(TERRAIN_COLORS).map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{
              display: 'inline-block', width: 10, height: 10, borderRadius: 2,
              background: color, flexShrink: 0,
            }} />
            <span style={{ textTransform: 'capitalize' }}>{terrainLabel(type)}</span>
          </div>
        ))}
      </div>

    </div>
  )
}
