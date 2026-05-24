import { useMapStore, TERRAIN_COLORS, TERRAIN_PRIORITY } from '../store/mapStore'
import { ToolButton } from './ToolButton'

const terrainLabel = (t: string) => t.replace(/_/g, ' ')

interface Props {
  activeBrush: string | null
  paintMode: boolean
  onSelect: (terrain: string) => void
  onSettings?: (terrain: string, y: number) => void
}

export function TerrainBrushPicker({ activeBrush, paintMode, onSelect, onSettings }: Props) {
  const { terrainColors, terrainTypeBlobStyles, customTerrains } = useMapStore()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {TERRAIN_PRIORITY.map((terrain, idx) => {
        const color = terrainColors[terrain] ?? TERRAIN_COLORS[terrain] ?? '#888'
        return (
          <ToolButton
            key={terrain}
            label={terrainLabel(terrain)}
            active={paintMode && activeBrush === terrain}
            color={color}
            shortcut={String(idx + 1)}
            onSelect={() => onSelect(terrain)}
            onSettings={onSettings ? (y) => onSettings(terrain, y) : undefined}
            extraDot={terrainTypeBlobStyles[terrain]?.enabled === true}
            swatchBorder={terrain === 'clear' ? '1px solid #3a3a5a' : undefined}
            cogDataAttrib="data-terrain-flyout"
          />
        )
      })}
      {customTerrains.length > 0 && (
        <div style={{ borderTop: '1px solid #2a2a3a', marginTop: 2, paddingTop: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
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
        </div>
      )}
    </div>
  )
}
