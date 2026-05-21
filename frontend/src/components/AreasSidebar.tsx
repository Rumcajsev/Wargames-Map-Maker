import { useMapStore } from '../store/mapStore'
import type { MapArea } from '../store/mapStore'
import { sidebarStyle, sectionStyle, labelStyle, modeBtn } from './sidebarStyles'

// ── Area row ──────────────────────────────────────────────────────────────────

function AreaRow({
  area, isActive, hexCount,
  onSelect, onRename, onColorChange, onDelete,
}: {
  area: MapArea
  isActive: boolean
  hexCount: number
  onSelect: () => void
  onRename: (name: string) => void
  onColorChange: (color: string) => void
  onDelete: () => void
}) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0',
        background: isActive ? '#1e2a3a' : 'transparent',
        borderRadius: 3, cursor: 'pointer',
      }}
      onClick={onSelect}
    >
      {/* Color swatch / picker */}
      <input
        type="color"
        value={area.color}
        style={{ width: 16, height: 16, border: 'none', padding: 0, background: 'none', cursor: 'pointer', flexShrink: 0 }}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onColorChange(e.target.value)}
      />
      {/* Name */}
      <input
        type="text"
        value={area.name}
        style={{
          flex: 1, background: 'none', border: 'none', outline: 'none',
          color: '#c0c0e0', fontSize: 11, fontFamily: 'ui-monospace, monospace',
          cursor: 'text', minWidth: 0,
        }}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onRename(e.target.value)}
      />
      {/* Hex count badge */}
      <span style={{ fontSize: 9, color: '#4a4a6a', flexShrink: 0 }}>{hexCount}</span>
      {/* Delete */}
      <button
        style={{
          background: 'none', border: 'none', color: '#5a3a3a', cursor: 'pointer',
          fontSize: 12, padding: '0 2px', lineHeight: 1, flexShrink: 0,
        }}
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        title="Delete area"
      >×</button>
    </div>
  )
}

// ── Main sidebar ──────────────────────────────────────────────────────────────

export function AreasSidebar() {
  const {
    areasMode, setAreasMode,
    areas, areaHexes,
    activeAreaId, setActiveAreaId,
    areasStyle, setAreasStyle,
    areasGenParams, setAreasGenParams,
    generateAreas,
    addArea, updateArea, deleteArea,
    eraseAllHexesForArea,
    activeTool, setActiveTool,
  } = useMapStore()

  // Hex counts per area
  const hexCountByArea: Record<string, number> = {}
  for (const aId of Object.values(areaHexes)) {
    hexCountByArea[aId] = (hexCountByArea[aId] ?? 0) + 1
  }

  const handleSelectArea = (id: string) => {
    setActiveAreaId(id)
    setActiveTool({ type: 'area-paint', id })
  }

  const handleClearAll = () => {
    // Reset to empty (store action via direct state update)
    for (const area of areas) eraseAllHexesForArea(area.id)
    // Note: areas list stays, just hexes cleared. User can also delete areas individually.
  }

  return (
    <div style={sidebarStyle}>

      {/* ── Mode toggle ──────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={{ ...labelStyle, marginBottom: 8 }}>Areas Map Mode</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button style={modeBtn(areasMode)} onClick={() => setAreasMode(true)}>On</button>
          <button style={modeBtn(!areasMode)} onClick={() => setAreasMode(false)}>Off</button>
        </div>
        {areasMode && (
          <div style={{ marginTop: 6, fontSize: 10, color: '#4a6a4a' }}>
            Hex borders hidden
          </div>
        )}
      </div>

      {/* ── Auto-generate ─────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Generate</div>
        <div style={{ marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span>Target size</span>
            <span style={{ color: '#8ab0e0' }}>{areasGenParams.targetSize} hexes</span>
          </div>
          <input
            type="range" min={2} max={30} step={1} value={areasGenParams.targetSize}
            style={{ width: '100%' }}
            onChange={(e) => setAreasGenParams({ targetSize: +e.target.value })}
          />
        </div>
        <div style={{ marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span>River borders</span>
            <span style={{ color: '#8ab0e0' }}>{Math.round(areasGenParams.riverWeight * 100)}%</span>
          </div>
          <input
            type="range" min={0} max={100} step={5} value={Math.round(areasGenParams.riverWeight * 100)}
            style={{ width: '100%' }}
            onChange={(e) => setAreasGenParams({ riverWeight: +e.target.value / 100 })}
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span>Terrain borders</span>
            <span style={{ color: '#8ab0e0' }}>{areasGenParams.terrainWeight.toFixed(1)}</span>
          </div>
          <input
            type="range" min={0} max={10} step={0.5} value={areasGenParams.terrainWeight}
            style={{ width: '100%' }}
            onChange={(e) => setAreasGenParams({ terrainWeight: +e.target.value })}
          />
        </div>
        <button
          style={{
            width: '100%', padding: '5px 0', fontSize: 10, letterSpacing: 0.5,
            textTransform: 'uppercase', background: '#1a2a3a', border: '1px solid #2a3a5a',
            color: '#8ab0e0', borderRadius: 3, cursor: 'pointer', marginBottom: 4,
            fontFamily: 'ui-monospace, monospace',
          }}
          onClick={generateAreas}
        >
          Generate Areas
        </button>
        <button
          style={{
            width: '100%', padding: '4px 0', fontSize: 10, letterSpacing: 0.5,
            textTransform: 'uppercase', background: 'none', border: '1px solid #2a2a4a',
            color: '#4a4a6a', borderRadius: 3, cursor: 'pointer',
            fontFamily: 'ui-monospace, monospace',
          }}
          onClick={handleClearAll}
        >
          Clear Hexes
        </button>
      </div>

      {/* ── Area list ─────────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={labelStyle}>Areas ({areas.length})</span>
        </div>
        <div style={{ overflowY: 'auto', maxHeight: 220 }}>
          {areas.map((area) => (
            <AreaRow
              key={area.id}
              area={area}
              isActive={activeAreaId === area.id}
              hexCount={hexCountByArea[area.id] ?? 0}
              onSelect={() => handleSelectArea(area.id)}
              onRename={(name) => updateArea(area.id, { name })}
              onColorChange={(color) => updateArea(area.id, { color })}
              onDelete={() => deleteArea(area.id)}
            />
          ))}
          {areas.length === 0 && (
            <div style={{ color: '#3a3a5a', fontSize: 11, paddingTop: 4 }}>
              No areas yet. Generate or add one.
            </div>
          )}
        </div>
        <button
          style={{
            width: '100%', marginTop: 8, padding: '4px 0', fontSize: 10, letterSpacing: 0.5,
            textTransform: 'uppercase', background: 'none', border: '1px solid #2a2a4a',
            color: '#6a8a6a', borderRadius: 3, cursor: 'pointer',
            fontFamily: 'ui-monospace, monospace',
          }}
          onClick={() => {
            const idx = areas.length
            const COLORS = ['#5a3a1a','#1a3a5a','#1a5a3a','#5a1a3a','#3a5a1a','#3a1a5a','#5a4a3a','#1a5a5a']
            const id = addArea(`Area ${idx + 1}`, COLORS[idx % COLORS.length])
            handleSelectArea(id)
          }}
        >
          + Add Area
        </button>
      </div>

      {/* ── Paint tools (active area only) ───────────────────────────────── */}
      {activeAreaId && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Paint</div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            <button
              style={modeBtn(activeTool.type === 'area-paint')}
              onClick={() => setActiveTool({ type: 'area-paint', id: activeAreaId })}
            >
              Paint
            </button>
            <button
              style={modeBtn(activeTool.type === 'area-erase')}
              onClick={() => setActiveTool({ type: 'area-erase' })}
            >
              Erase
            </button>
          </div>
          <button
            style={{
              width: '100%', padding: '4px 0', fontSize: 10, letterSpacing: 0.5,
              textTransform: 'uppercase', background: 'none', border: '1px solid #2a2a4a',
              color: '#6a4a4a', borderRadius: 3, cursor: 'pointer',
              fontFamily: 'ui-monospace, monospace',
            }}
            onClick={() => eraseAllHexesForArea(activeAreaId)}
          >
            Clear Area
          </button>
        </div>
      )}

      {/* ── Style ─────────────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Style</div>
        <div style={{ marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span>Border width</span>
            <span style={{ color: '#8ab0e0' }}>{areasStyle.borderWidth.toFixed(1)}</span>
          </div>
          <input
            type="range" min={0.5} max={6} step={0.5} value={areasStyle.borderWidth}
            style={{ width: '100%' }}
            onChange={(e) => setAreasStyle({ borderWidth: +e.target.value })}
          />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span>Label size</span>
            <span style={{ color: '#8ab0e0' }}>{areasStyle.labelSize.toFixed(1)}×</span>
          </div>
          <input
            type="range" min={0.5} max={2.5} step={0.1} value={areasStyle.labelSize}
            style={{ width: '100%' }}
            onChange={(e) => setAreasStyle({ labelSize: +e.target.value })}
          />
        </div>
      </div>

    </div>
  )
}
