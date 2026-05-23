import type { MapStore, GeneratedHex, GenerateProgress, ClassificationParams } from '../mapStore'
import { DEFAULT_CLASSIFICATION_PARAMS } from '../mapStore'
import { classifyElevation as _classify } from '../../lib/elevationClassify'

export type ElevationSlice = {
  elevationStatus: 'idle' | 'loading' | 'error' | 'done'
  elevationError: string | null
  elevationProgress: GenerateProgress | null
  showElevationDebug: boolean
  classificationParams: ClassificationParams
  fetchElevation: () => Promise<void>
  setShowElevationDebug: (v: boolean) => void
  setClassificationParam: (key: keyof ClassificationParams, v: number) => void
  classifyElevation: () => void
}

type Set = (partial: Partial<MapStore> | ((s: MapStore) => Partial<MapStore>)) => void

export const createElevationSlice = (set: Set, get: () => MapStore): ElevationSlice => ({
  elevationStatus: 'idle',
  elevationError: null,
  elevationProgress: null,
  showElevationDebug: false,
  classificationParams: { ...DEFAULT_CLASSIFICATION_PARAMS },

  fetchElevation: async () => {
    const { generatedHexes, generatedMetadata, hexOrientation } = get()
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
            const params = get().classificationParams
            const classified = _classify(event.hexes as GeneratedHex[], params)
            set({ generatedHexes: classified, elevationStatus: 'done', elevationProgress: null })
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

  setShowElevationDebug: (v) => set({ showElevationDebug: v }),

  setClassificationParam: (key, v) => {
    const next = { ...get().classificationParams, [key]: v }
    const updated = _classify(get().generatedHexes, next)
    set({ classificationParams: next, generatedHexes: updated })
  },

  classifyElevation: () => {
    const { generatedHexes, classificationParams } = get()
    set({ generatedHexes: _classify(generatedHexes, classificationParams) })
  },
})
