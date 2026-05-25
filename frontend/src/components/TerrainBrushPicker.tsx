import { useMapStore, TERRAIN_COLORS, TERRAIN_PRIORITY, MANUAL_ONLY_TERRAINS } from '../store/mapStore'
import { ToolButton } from './ToolButton'

const terrainLabel = (t: string) => t.replace(/_/g, ' ')

const OSM_TERRAINS = [...TERRAIN_PRIORITY].filter(t => !MANUAL_ONLY_TERRAINS.has(t))
const MANUAL_TERRAINS = [...TERRAIN_PRIORITY].filter(t => MANUAL_ONLY_TERRAINS.has(t))

const divider = (key: string) => (
  <div key={key} style={{ borderTop: '1px solid #2a2a3a', margin: '2px 0' }} />
)

interface Props {
  activeBrush: string | null
  paintMode: boolean
  onSelect: (terrain: string) => void
  onSettings?: (terrain: string, y: number) => void
  onAddTerrain?: (anchorY: number) => void
}

export function TerrainBrushPicker({ activeBrush, paintMode, onSelect, onSettings, onAddTerrain }: Props) {
  const { terrainColors, terrainTypeBlobStyles, customTerrains } = useMapStore()

  const makeButton = (terrain: string, globalIdx: number) => {
    const color = terrainColors[terrain] ?? TERRAIN_COLORS[terrain] ?? '#888'
    return (
      <ToolButton
        key={terrain}
        label={terrainLabel(terrain)}
        active={paintMode && activeBrush === terrain}
        color={color}
        shortcut={String(globalIdx + 1)}
        onSelect={() => onSelect(terrain)}
        onSettings={onSettings ? (y) => onSettings(terrain, y) : undefined}
        extraDot={terrainTypeBlobStyles[terrain]?.enabled === true}
        swatchBorder={terrain === 'clear' ? '1px solid #3a3a5a' : undefined}
        cogDataAttrib="data-terrain-flyout"
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {OSM_TERRAINS.map((terrain, idx) => makeButton(terrain, idx))}

      {divider('d-manual')}

      {MANUAL_TERRAINS.map((terrain, idx) => makeButton(terrain, OSM_TERRAINS.length + idx))}

      {customTerrains.length > 0 && (
        <>
          {divider('d-custom')}
          {customTerrains.map(ct => (
            <ToolButton
              key={ct.id}
              label={ct.name}
              active={paintMode && activeBrush === ct.id}
              color={ct.color}
              onSelect={() => onSelect(ct.id)}
              onSettings={onSettings ? (y) => onSettings(ct.id, y) : undefined}
              cogDataAttrib="data-terrain-flyout"
            />
          ))}
        </>
      )}

      <div style={{ borderTop: '1px solid #1e1f2e', marginTop: 2, paddingTop: 2 }}>
        <button
          data-add-terrain-flyout=""
          onClick={e => onAddTerrain?.(e.currentTarget.getBoundingClientRect().top)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '5px 8px', width: '100%', boxSizing: 'border-box',
            background: 'none', border: '1px dashed #2a2a3a',
            borderRadius: 3, cursor: 'pointer',
            fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#3a3a5a',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#6a6a8a'; e.currentTarget.style.borderColor = '#3a3a5a' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#3a3a5a'; e.currentTarget.style.borderColor = '#2a2a3a' }}
        >
          <span style={{
            width: 9, height: 9, borderRadius: 2, flexShrink: 0,
            border: '1px dashed currentColor',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 8, lineHeight: 1,
          }}>+</span>
          <span>Add terrain</span>
        </button>
      </div>
    </div>
  )
}
