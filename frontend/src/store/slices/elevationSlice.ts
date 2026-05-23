import type { MapStore, GeneratedHex, GenerateProgress, ElevationThresholds } from '../mapStore'
import { DEFAULT_ELEVATION_THRESHOLDS } from '../mapStore'

const ELEVATION_RANK: Record<string, number> = { flat: 0, hills: 1, mountains: 2 }

function classifyElevationModeA(
  medianM: number,
  rangeM: number,
  t: ElevationThresholds,
): 'flat' | 'hills' | 'mountains' {
  const rangeClass =
    rangeM >= t.mountains_range_m ? 'mountains'
    : rangeM >= t.hills_range_m   ? 'hills'
    : 'flat'
  const absClass =
    medianM >= t.mountains_absolute_m ? 'mountains'
    : medianM >= t.hills_absolute_m   ? 'hills'
    : 'flat'
  return (ELEVATION_RANK[rangeClass] >= ELEVATION_RANK[absClass] ? rangeClass : absClass) as 'flat' | 'hills' | 'mountains'
}

export type ElevationSlice = {
  elevationThresholds: ElevationThresholds
  elevationStatus: 'idle' | 'loading' | 'error' | 'done'
  elevationError: string | null
  elevationProgress: GenerateProgress | null
  showReliefHeatmap: boolean
  showElevHeatmap: boolean
  elevationPaintMode: boolean
  elevationPaintBrush: 'flat' | 'hills' | 'mountains'
  elevationStyle: 'hachure' | 'contour'
  contourInterval: number
  fetchElevation: () => Promise<void>
  setElevationThreshold: (key: keyof ElevationThresholds, v: number) => void
  setShowReliefHeatmap: (v: boolean) => void
  setShowElevHeatmap: (v: boolean) => void
  setElevationPaintMode: (v: boolean) => void
  setElevationPaintBrush: (v: 'flat' | 'hills' | 'mountains') => void
  overrideHexElevation: (q: number, r: number, elevation_class: 'flat' | 'hills' | 'mountains') => void
  setElevationStyle: (v: 'hachure' | 'contour') => void
  setContourInterval: (v: number) => void
}

type Set = (partial: Partial<MapStore> | ((s: MapStore) => Partial<MapStore>)) => void

export const createElevationSlice = (set: Set, get: () => MapStore): ElevationSlice => ({
  elevationThresholds: { ...DEFAULT_ELEVATION_THRESHOLDS },
  elevationStatus: 'idle',
  elevationError: null,
  elevationProgress: null,
  showReliefHeatmap: false,
  showElevHeatmap: false,
  elevationPaintMode: false,
  elevationPaintBrush: 'hills',
  elevationStyle: 'hachure',
  contourInterval: 0,

  fetchElevation: async () => {
    const { generatedHexes, generatedMetadata, hexOrientation, elevationThresholds } = get()
    if (generatedHexes.length === 0 || !generatedMetadata) return

    set({ elevationStatus: 'loading', elevationError: null, elevationProgress: null })

    const { center, bearing, scale_m_per_mm, paper_mm, outer_radius_m } = generatedMetadata

    try {
      const resp = await fetch('/api/generate/elevation-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hexes: generatedHexes,
          center_lon: center[0],
          center_lat: center[1],
          bearing,
          width_m: scale_m_per_mm * paper_mm[0],
          height_m: scale_m_per_mm * paper_mm[1],
          hex_orientation: hexOrientation,
          outer_radius_m,
          ...elevationThresholds,
        }),
      })
      if (!resp.ok) throw new Error(await resp.text())
      if (!resp.body) throw new Error('No response body')

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr) continue
          let event: Record<string, unknown>
          try { event = JSON.parse(jsonStr) } catch { continue }

          if (event.step === 'done') {
            set({ generatedHexes: event.hexes as GeneratedHex[], elevationStatus: 'done', elevationProgress: null })
          } else if (event.step === 'error') {
            set({ elevationStatus: 'error', elevationError: event.message as string, elevationProgress: null })
          } else {
            set({ elevationProgress: { step: event.step as string, message: event.message as string, progress: event.progress as number } })
          }
        }
      }
    } catch (e) {
      set({ elevationStatus: 'error', elevationError: String(e), elevationProgress: null })
    }
  },

  setElevationThreshold: (key, v) => {
    const { elevationThresholds, generatedHexes } = get()
    const next = { ...elevationThresholds, [key]: v }
    const updated = generatedHexes.map((h) => {
      if (h.elevation_manual_override) return h
      if (h.terrain === 'sea' || h.isLake || h.elevation_median_m == null || h.elevation_range_m == null) return h
      return { ...h, elevation_class: classifyElevationModeA(h.elevation_median_m, h.elevation_range_m, next) }
    })
    set({ elevationThresholds: next, generatedHexes: updated })
  },

  setShowReliefHeatmap: (v) => set({ showReliefHeatmap: v, showElevHeatmap: v ? false : get().showElevHeatmap }),
  setShowElevHeatmap: (v) => set({ showElevHeatmap: v, showReliefHeatmap: v ? false : get().showReliefHeatmap }),

  setElevationPaintMode: (v) => set({ elevationPaintMode: v, ...(v ? { terrainPaintMode: false, roadPaintMode: false, railPaintMode: false } : {}) }),
  setElevationPaintBrush: (v) => set({ elevationPaintBrush: v }),

  overrideHexElevation: (q, r, elevation_class) => {
    const { generatedHexes } = get()
    const updated = generatedHexes.map((h) =>
      h.q === q && h.r === r ? { ...h, elevation_class, elevation_manual_override: true } : h
    )
    set({ generatedHexes: updated })
  },

  setElevationStyle: (v) => set({ elevationStyle: v }),
  setContourInterval: (v) => set({ contourInterval: v }),
})
