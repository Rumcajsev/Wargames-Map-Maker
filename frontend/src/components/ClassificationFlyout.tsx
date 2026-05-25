import { useEffect } from 'react'
import { useMapStore, TERRAIN_COLORS, DEFAULT_THRESHOLDS, TERRAIN_PRIORITY, MANUAL_ONLY_TERRAINS } from '../store/mapStore'
import { FlyoutContainer, FlyoutHeader } from './ui'

const terrainLabel = (t: string) => t.replace(/_/g, ' ')

const SLIDER_TERRAINS = [...TERRAIN_PRIORITY].filter(t => t !== 'clear' && !MANUAL_ONLY_TERRAINS.has(t))

interface Props {
  anchorY: number
  onClose: () => void
}

export function ClassificationFlyout({ anchorY, onClose }: Props) {
  const { thresholds, setTerrainThreshold, disabledTerrains, toggleTerrainDisabled, terrainColors } = useMapStore()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-classification-flyout]')) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <FlyoutContainer
      top={Math.min(anchorY, window.innerHeight - 48)}
      scrollable
      data-classification-flyout=""
    >
      <FlyoutHeader title="OSM Classification" onClose={onClose} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {SLIDER_TERRAINS.map(terrain => {
          const disabled = disabledTerrains.has(terrain)
          const value = thresholds[terrain] ?? DEFAULT_THRESHOLDS[terrain] ?? 0.25
          const color = terrainColors[terrain] ?? TERRAIN_COLORS[terrain] ?? '#888'
          return (
            <div key={terrain} style={{ opacity: disabled ? 0.4 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <button
                    onClick={() => toggleTerrainDisabled(terrain)}
                    title={disabled ? 'Enable' : 'Disable'}
                    style={{
                      width: 10, height: 10, borderRadius: 2,
                      background: disabled ? '#2a2a3a' : color,
                      border: disabled ? '1px solid #4a4a6a' : 'none',
                      flexShrink: 0, cursor: 'pointer', padding: 0,
                    }}
                  />
                  <span style={{ textTransform: 'capitalize', color: disabled ? '#4a4a6a' : '#a0a0c0' }}>
                    {terrainLabel(terrain)}
                  </span>
                </div>
                <span style={{ color: '#5a5a7a', fontSize: 10 }}>
                  {Math.round(value * 100)}%
                </span>
              </div>
              <input
                type="range" min={0} max={100} step={1}
                value={Math.round(value * 100)}
                disabled={disabled}
                onChange={e => setTerrainThreshold(terrain, Number(e.target.value) / 100)}
                style={{ width: '100%', accentColor: color, cursor: disabled ? 'not-allowed' : 'pointer' }}
              />
            </div>
          )
        })}
      </div>
    </FlyoutContainer>
  )
}
