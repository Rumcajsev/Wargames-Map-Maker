import type { MapStore } from '../mapStore'

export type ImageTransform = {
  translateX: number  // fraction of paperWidth offset from paper center
  translateY: number  // fraction of paperHeight offset from paper center
  scaleFrac: number   // image width as fraction of paperWidth (1.0 = fills width)
  rotation: number    // degrees
}

export type HexCrop = {
  q: number
  r: number
  cx: number   // center x in image pixel space
  cy: number   // center y in image pixel space
  size: number // crop size in pixels
}

export type MapImageSlice = {
  dataSource: 'osm' | 'map_image'
  mapImageDataUrl: string | null
  mapImageNaturalSize: { w: number; h: number } | null
  mapImageTransform: ImageTransform
  mapImageOpacity: number
  mapImageModalOpen: boolean
  mapImageModalStep: 'upload' | 'align' | 'classify'
  mapImageClassifyStatus: 'idle' | 'loading' | 'done' | 'error'
  mapImageClassifyProgress: { message: string; progress: number } | null
  mapImageConfidenceVisible: boolean

  setMapImageDataUrl: (url: string, w: number, h: number) => void
  setMapImageTransform: (t: Partial<ImageTransform>) => void
  setMapImageOpacity: (v: number) => void
  openMapImageModal: () => void
  closeMapImageModal: () => void
  setMapImageModalStep: (step: 'upload' | 'align' | 'classify') => void
  clearMapImage: () => void
  fetchMapImageClassification: (hexCrops: HexCrop[]) => Promise<void>
  setMapImageConfidenceVisible: (v: boolean) => void
}

const DEFAULT_TRANSFORM: ImageTransform = { translateX: 0, translateY: 0, scaleFrac: 1, rotation: 0 }

type Set = (partial: Partial<MapStore> | ((s: MapStore) => Partial<MapStore>)) => void

export const createMapImageSlice = (set: Set, get: () => MapStore): MapImageSlice => ({
  dataSource: 'osm',
  mapImageDataUrl: null,
  mapImageNaturalSize: null,
  mapImageTransform: DEFAULT_TRANSFORM,
  mapImageOpacity: 0.6,
  mapImageModalOpen: false,
  mapImageModalStep: 'upload',
  mapImageClassifyStatus: 'idle',
  mapImageClassifyProgress: null,
  mapImageConfidenceVisible: false,

  setMapImageDataUrl: (url, w, h) => set({
    mapImageDataUrl: url,
    mapImageNaturalSize: { w, h },
    mapImageTransform: DEFAULT_TRANSFORM,
    mapImageModalStep: 'align',
  }),

  setMapImageTransform: (t) => set((s) => ({
    mapImageTransform: { ...s.mapImageTransform, ...t },
  })),

  setMapImageOpacity: (v) => set({ mapImageOpacity: v }),

  openMapImageModal: () => set({ mapImageModalOpen: true, mapImageModalStep: 'upload' }),

  closeMapImageModal: () => set({ mapImageModalOpen: false }),

  setMapImageModalStep: (step) => set({ mapImageModalStep: step }),

  clearMapImage: () => set({
    dataSource: 'osm',
    mapImageDataUrl: null,
    mapImageNaturalSize: null,
    mapImageTransform: DEFAULT_TRANSFORM,
    mapImageModalOpen: false,
    mapImageModalStep: 'upload',
    mapImageClassifyStatus: 'idle',
    mapImageClassifyProgress: null,
    mapImageConfidenceVisible: false,
  }),

  fetchMapImageClassification: async (hexCrops) => {
    const { mapImageDataUrl } = get()
    if (!mapImageDataUrl) return

    set({ mapImageClassifyStatus: 'loading', mapImageClassifyProgress: { message: 'Starting…', progress: 0 } })

    // Compress image to max 2000px wide before sending
    const imageB64 = await compressImage(mapImageDataUrl, 2000)

    try {
      const resp = await fetch('/api/generate/map-image-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_b64: imageB64, hex_crops: hexCrops }),
      })

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)

      const reader = resp.body!.getReader()
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
            const hexResults = event.hexes as Array<{
              q: number; r: number; terrain: string; elevation_class: string;
              confidence: number; notes: string
            }>
            const roadEdges = event.road_edges as Array<{ q1: number; r1: number; q2: number; r2: number; tier: number }>
            const riverEdges = event.river_edges as Array<{ q1: number; r1: number; q2: number; r2: number }>

            // Build lookup for fast hex update
            const resultMap = new Map(hexResults.map(h => [`${h.q},${h.r}`, h]))

            set((s) => ({
              generatedHexes: s.generatedHexes.map((h) => {
                const r = resultMap.get(`${h.q},${h.r}`)
                if (!r) return h
                return {
                  ...h,
                  terrain: r.terrain,
                  terrains: r.terrain === 'clear' ? [] : [r.terrain],
                  elevation_class: r.elevation_class as 'flat' | 'hills' | 'mountains',
                  ai_confidence: r.confidence,
                  ai_notes: r.notes,
                }
              }),
              roadEdges: roadEdges.map(e => ({ ...e, manual: true as const })),
              riverEdges: riverEdges,
              generateStatus: 'done' as const,
              roadsStatus: 'done' as const,
              dataSource: 'map_image' as const,
              mapImageClassifyStatus: 'done' as const,
              mapImageClassifyProgress: null,
              mapImageModalOpen: false,
              mapImageConfidenceVisible: true,
            }))
          } else if (event.step === 'error') {
            set({ mapImageClassifyStatus: 'error', mapImageClassifyProgress: null })
          } else {
            set({ mapImageClassifyProgress: { message: event.message as string, progress: event.progress as number } })
          }
        }
      }
    } catch (err) {
      set({ mapImageClassifyStatus: 'error', mapImageClassifyProgress: null })
      console.error('Map image classification failed:', err)
    }
  },

  setMapImageConfidenceVisible: (v) => set({ mapImageConfidenceVisible: v }),
})

async function compressImage(dataUrl: string, maxWidth: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.naturalWidth)
      const w = Math.round(img.naturalWidth * scale)
      const h = Math.round(img.naturalHeight * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      const compressed = canvas.toDataURL('image/jpeg', 0.85)
      resolve(compressed.split(',')[1])
    }
    img.src = dataUrl
  })
}
