import { useMapStore, TERRAIN_COLORS } from '../store/mapStore'
import { sidebarStyle, sectionStyle, labelStyle } from './sidebarStyles'

const BG_PALETTE = ['#ffffff', '#f5f0e8', '#eae4d4', '#ddd5c0', '#d4e8d4', '#d0dce8', '#e8d8d0', '#1a1a2a', '#000000'] as const

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

const MEGA_HEX_SIZES: Record<number, string> = { 1: '7', 2: '19', 3: '37', 4: '61', 5: '91' }

export function DisplaySidebar() {
  const {
    hexBorderMode, setHexBorderMode,
    hexBorderOpacity, setHexBorderOpacity,
    hexBorderColor, setHexBorderColor,
    hexBorderDifference, setHexBorderDifference,
    hexNumbersEnabled, setHexNumbersEnabled,
    hexNumberStartCorner, setHexNumberStartCorner,
    hexNumberEdge, setHexNumberEdge,
    hexNumberColor, setHexNumberColor,
    hexNumberFontScale, setHexNumberFontScale,
    hexOrientation,
    mapBgColor, setMapBgColor,
    mapBorderEnabled, setMapBorderEnabled,
    mapBorderColor, setMapBorderColor,
    mapBorderWidth, setMapBorderWidth,
    clipToHexGrid, setClipToHexGrid,
    excludedHexKeys, resetExcludedHexes,
    activeTool, setActiveTool,
    megaHexEnabled, setMegaHexEnabled,
    megaHexRadius, setMegaHexRadius,
    megaHexColor, setMegaHexColor,
    megaHexOpacity, setMegaHexOpacity,
    megaHexLineWidth, setMegaHexLineWidth,
  } = useMapStore()

  const hexMaskMode = activeTool.type === 'hex-mask' ? activeTool.mode : null

  const edgeLabels = hexOrientation === 'flat' ? FLAT_EDGE_LABELS : POINTY_EDGE_LABELS
  const currentLabel = edgeLabels[hexNumberEdge] ?? '?'

  return (
    <div style={sidebarStyle}>

      {/* ── Hex borders ── */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Hex Borders</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: hexBorderMode !== 'none' ? 8 : 0 }}>
          {(['full', 'stubs', 'none'] as const).map(mode => (
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

        {hexBorderMode !== 'none' && (
          <>
            {/* Opacity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: '#5a5a7a', width: 44, flexShrink: 0 }}>Opacity</div>
              <input
                type="range" min={0.05} max={1.0} step={0.05}
                value={hexBorderOpacity}
                onChange={e => setHexBorderOpacity(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 10, color: '#5a5a7a', width: 28, textAlign: 'right' }}>
                {Math.round(hexBorderOpacity * 100)}%
              </span>
            </div>

            {/* Color — hidden when difference mode is active */}
            {!hexBorderDifference && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 10, color: '#5a5a7a', width: 44, flexShrink: 0 }}>Color</div>
                {([['#000000', 'Dark'], ['#ffffff', 'Light']] as const).map(([c, label]) => (
                  <button
                    key={c}
                    onClick={() => setHexBorderColor(c)}
                    title={label}
                    style={{
                      padding: '2px 8px', fontSize: 10,
                      background: hexBorderColor === c ? '#1a2a3a' : 'none',
                      color: hexBorderColor === c ? '#7de0a0' : '#5a5a7a',
                      border: '1px solid',
                      borderColor: hexBorderColor === c ? '#4a9a6a' : '#1e1f2e',
                      borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {label}
                  </button>
                ))}
                <input
                  type="color"
                  value={hexBorderColor}
                  onChange={e => setHexBorderColor(e.target.value)}
                  style={{ width: 24, height: 20, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                />
              </div>
            )}

            {/* Auto-contrast */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <div style={{ fontSize: 10, color: '#5a5a7a' }}>Auto-contrast</div>
              <button
                onClick={() => setHexBorderDifference(!hexBorderDifference)}
                style={{
                  padding: '2px 8px',
                  background: hexBorderDifference ? '#1a2a3a' : 'none',
                  color: hexBorderDifference ? '#7de0a0' : '#5a5a7a',
                  border: '1px solid',
                  borderColor: hexBorderDifference ? '#4a9a6a' : '#1e1f2e',
                  borderRadius: 3, cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 11,
                }}
              >
                {hexBorderDifference ? 'On' : 'Off'}
              </button>
            </div>
          </>
        )}
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

            {/* Size */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: '#5a5a7a', width: 28, flexShrink: 0 }}>Size</div>
              <input
                type="range" min={0.1} max={3.0} step={0.05}
                value={hexNumberFontScale}
                onChange={e => setHexNumberFontScale(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 10, color: '#5a5a7a', width: 24, textAlign: 'right' }}>
                {hexNumberFontScale.toFixed(1)}×
              </span>
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

      {/* ── Map Shape ── */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={labelStyle}>Map Shape</div>
          {excludedHexKeys.length > 0 && (
            <button
              onClick={resetExcludedHexes}
              style={{
                padding: '2px 8px', background: 'none',
                color: '#7a4a4a', border: '1px solid #3a2a2a',
                borderRadius: 3, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 11,
              }}
            >
              Reset
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['exclude', 'include'] as const).map(mode => {
            const active = hexMaskMode === mode
            return (
              <button
                key={mode}
                onClick={() => setActiveTool(active ? { type: 'none' } : { type: 'hex-mask', mode })}
                style={{
                  flex: 1, padding: '4px 0',
                  background: active ? (mode === 'exclude' ? '#3a1a1a' : '#1a2a1a') : 'none',
                  color: active ? (mode === 'exclude' ? '#e07070' : '#7de0a0') : '#5a5a7a',
                  border: '1px solid',
                  borderColor: active ? (mode === 'exclude' ? '#8a3a3a' : '#4a9a6a') : '#1e1f2e',
                  borderRadius: 3, cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 11, textTransform: 'capitalize',
                }}
              >
                {mode === 'exclude' ? '− Remove' : '+ Add'}
              </button>
            )
          })}
        </div>
        {excludedHexKeys.length > 0 && (
          <div style={{ fontSize: 10, color: '#5a5a7a', marginTop: 6 }}>
            {excludedHexKeys.length} hex{excludedHexKeys.length !== 1 ? 'es' : ''} removed
          </div>
        )}
      </div>

      {/* ── Map Frame ── */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Map Frame</div>

        {/* Background color */}
        <div style={{ fontSize: 10, color: '#5a5a7a', marginBottom: 4 }}>Background color</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 10, alignItems: 'center' }}>
          {BG_PALETTE.map(color => (
            <button
              key={color}
              onClick={() => setMapBgColor(color)}
              title={color}
              style={{
                width: 16, height: 16,
                background: color,
                border: mapBgColor.toLowerCase() === color.toLowerCase()
                  ? '2px solid #7de0a0'
                  : '1px solid rgba(255,255,255,0.18)',
                borderRadius: 2, cursor: 'pointer', padding: 0,
                boxSizing: 'border-box',
                boxShadow: mapBgColor.toLowerCase() === color.toLowerCase() ? '0 0 0 1px rgba(0,0,0,0.5)' : 'none',
              }}
            />
          ))}
          <input
            type="color"
            value={mapBgColor}
            onChange={e => setMapBgColor(e.target.value)}
            title="Custom color"
            style={{ width: 16, height: 16, border: '1px dashed #4a4a6a', borderRadius: 2, cursor: 'pointer', padding: 0, background: 'none' }}
          />
        </div>

        {/* Clip to hex grid */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: '#5a5a7a' }}>Clip to hex grid</div>
          <button
            onClick={() => setClipToHexGrid(!clipToHexGrid)}
            style={{
              padding: '2px 8px',
              background: clipToHexGrid ? '#1a2a3a' : 'none',
              color: clipToHexGrid ? '#7de0a0' : '#5a5a7a',
              border: '1px solid',
              borderColor: clipToHexGrid ? '#4a9a6a' : '#1e1f2e',
              borderRadius: 3, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 11,
            }}
          >
            {clipToHexGrid ? 'On' : 'Off'}
          </button>
        </div>

        {/* Map border */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: mapBorderEnabled ? 8 : 0 }}>
          <div style={{ fontSize: 10, color: '#5a5a7a' }}>Map border</div>
          <button
            onClick={() => setMapBorderEnabled(!mapBorderEnabled)}
            style={{
              padding: '2px 8px',
              background: mapBorderEnabled ? '#1a2a3a' : 'none',
              color: mapBorderEnabled ? '#7de0a0' : '#5a5a7a',
              border: '1px solid',
              borderColor: mapBorderEnabled ? '#4a9a6a' : '#1e1f2e',
              borderRadius: 3, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 11,
            }}
          >
            {mapBorderEnabled ? 'On' : 'Off'}
          </button>
        </div>

        {mapBorderEnabled && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ fontSize: 10, color: '#5a5a7a', width: 36, flexShrink: 0 }}>Color</div>
              <input
                type="color"
                value={mapBorderColor}
                onChange={e => setMapBorderColor(e.target.value)}
                style={{ width: 28, height: 20, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
              />
              <span style={{ fontSize: 10, color: '#5a5a7a' }}>{mapBorderColor}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 10, color: '#5a5a7a', width: 36, flexShrink: 0 }}>Width</div>
              <input
                type="range" min={0.25} max={8} step={0.25}
                value={mapBorderWidth}
                onChange={e => setMapBorderWidth(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 10, color: '#5a5a7a', width: 28, textAlign: 'right' }}>
                {mapBorderWidth.toFixed(2)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── Mega Hex Grid ── */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: megaHexEnabled ? 10 : 0 }}>
          <div style={labelStyle}>Mega Hex Grid</div>
          <button
            onClick={() => setMegaHexEnabled(!megaHexEnabled)}
            style={{
              padding: '2px 8px',
              background: megaHexEnabled ? '#1a2a3a' : 'none',
              color: megaHexEnabled ? '#7de0a0' : '#5a5a7a',
              border: '1px solid',
              borderColor: megaHexEnabled ? '#4a9a6a' : '#1e1f2e',
              borderRadius: 3, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 11,
            }}
          >
            {megaHexEnabled ? 'On' : 'Off'}
          </button>
        </div>

        {megaHexEnabled && (
          <>
            {/* Size */}
            <div style={{ fontSize: 10, color: '#5a5a7a', marginBottom: 4 }}>
              Size — {MEGA_HEX_SIZES[megaHexRadius] ?? '?'} hexes
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <input
                type="range" min={1} max={5} step={1}
                value={megaHexRadius}
                onChange={e => setMegaHexRadius(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 10, color: '#5a5a7a', width: 16, textAlign: 'right' }}>
                R{megaHexRadius}
              </span>
            </div>

            {/* Color */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ fontSize: 10, color: '#5a5a7a', width: 36, flexShrink: 0 }}>Color</div>
              <input
                type="color"
                value={megaHexColor}
                onChange={e => setMegaHexColor(e.target.value)}
                style={{ width: 28, height: 20, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
              />
              <span style={{ fontSize: 10, color: '#5a5a7a' }}>{megaHexColor}</span>
            </div>

            {/* Opacity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ fontSize: 10, color: '#5a5a7a', width: 36, flexShrink: 0 }}>Opacity</div>
              <input
                type="range" min={0.05} max={1} step={0.05}
                value={megaHexOpacity}
                onChange={e => setMegaHexOpacity(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 10, color: '#5a5a7a', width: 28, textAlign: 'right' }}>
                {Math.round(megaHexOpacity * 100)}%
              </span>
            </div>

            {/* Line width */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: '#5a5a7a', width: 36, flexShrink: 0 }}>Width</div>
              <input
                type="range" min={0.5} max={8} step={0.5}
                value={megaHexLineWidth}
                onChange={e => setMegaHexLineWidth(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 10, color: '#5a5a7a', width: 28, textAlign: 'right' }}>
                {megaHexLineWidth.toFixed(1)}
              </span>
            </div>

            {/* Set origin */}
            <button
              onClick={() => setActiveTool(
                activeTool.type === 'mega-hex-origin' ? { type: 'none' } : { type: 'mega-hex-origin' }
              )}
              style={{
                width: '100%', padding: '4px 0',
                background: activeTool.type === 'mega-hex-origin' ? '#1a2a3a' : 'none',
                color: activeTool.type === 'mega-hex-origin' ? '#7de0a0' : '#5a5a7a',
                border: '1px solid',
                borderColor: activeTool.type === 'mega-hex-origin' ? '#4a9a6a' : '#1e1f2e',
                borderRadius: 3, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 11,
              }}
            >
              {activeTool.type === 'mega-hex-origin' ? 'Click a hex to set origin…' : 'Set origin'}
            </button>
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
