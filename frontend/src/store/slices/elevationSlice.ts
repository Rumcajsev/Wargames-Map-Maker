import type { MapStore, GeneratedHex, GenerateProgress } from '../mapStore'

export type ElevationSlice = {
  elevationStatus: 'idle' | 'loading' | 'error' | 'done'
  elevationError: string | null
  elevationProgress: GenerateProgress | null
  showElevationDebug: boolean
  fetchElevation: () => Promise<void>
  setShowElevationDebug: (v: boolean) => void
}

type Set = (partial: Partial<MapStore> | ((s: MapStore) => Partial<MapStore>)) => void

export const createElevationSlice = (set: Set, get: () => MapStore): ElevationSlice => ({
  elevationStatus: 'idle',
  elevationError: null,
  elevationProgress: null,
  showElevationDebug: false,

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

  setShowElevationDebug: (v) => set({ showElevationDebug: v }),
})
