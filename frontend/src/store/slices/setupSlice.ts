import type { MapStore, PaperSize, Orientation, MapMode, DiptychJoin, HexOrientation, HexEdgeMode, Hex, GridMetadata } from '../mapStore'
import { combinedDimsMm, mapResolutionMpx } from '../mapStore'

export type SetupSlice = {
  step: 'setup' | 'terrain' | 'image-align'
  paperSize: PaperSize
  orientation: Orientation
  mapMode: MapMode
  diptychJoin: DiptychJoin
  hexSizeMm: number
  hexOrientation: HexOrientation
  marginMm: number
  hexEdgeMode: HexEdgeMode
  bearing: number
  center: [number, number]
  zoom: number
  framePixelWidth: number
  hexes: Hex[]
  metadata: GridMetadata | null
  status: 'idle' | 'loading' | 'error' | 'done'
  error: string | null
  setPaperSize: (v: PaperSize) => void
  setOrientation: (v: Orientation) => void
  setMapMode: (v: MapMode) => void
  setDiptychJoin: (v: DiptychJoin) => void
  setHexSizeMm: (v: number) => void
  setHexOrientation: (v: HexOrientation) => void
  setMarginMm: (v: number) => void
  setHexEdgeMode: (v: HexEdgeMode) => void
  flyTarget: { center: [number, number]; zoom: number; id: number } | null
  setMapState: (bearing: number, center: [number, number], zoom: number) => void
  setFramePixelWidth: (w: number) => void
  flyTo: (center: [number, number], zoom: number) => void
  clearFlyTarget: () => void
  generateGrid: () => Promise<void>
  resumeMap: () => void
}

type Set = (partial: Partial<MapStore> | ((s: MapStore) => Partial<MapStore>)) => void

export const createSetupSlice = (set: Set, get: () => MapStore): SetupSlice => ({
  step: 'setup',
  paperSize: 'A3',
  orientation: 'landscape',
  mapMode: 'single',
  diptychJoin: 'long',
  hexSizeMm: 20,
  hexOrientation: 'flat',
  marginMm: 8,
  hexEdgeMode: 'whole',
  bearing: 0,
  center: [15, 50],
  zoom: 7,
  framePixelWidth: 0,
  hexes: [],
  metadata: null,
  status: 'idle',
  error: null,
  flyTarget: null,

  setPaperSize: (v) => set({ paperSize: v }),
  setOrientation: (v) => set({ orientation: v }),
  setMapMode: (v) => set({ mapMode: v }),
  setDiptychJoin: (v) => set({ diptychJoin: v }),
  setHexSizeMm: (v) => set({ hexSizeMm: v }),
  setHexOrientation: (v) => set({ hexOrientation: v }),
  setMarginMm: (v) => set({ marginMm: v }),
  setHexEdgeMode: (v) => set({ hexEdgeMode: v }),
  setMapState: (bearing, center, zoom) => set({ bearing, center, zoom }),
  setFramePixelWidth: (w) => set({ framePixelWidth: w }),
  flyTo: (center, zoom) => set({ flyTarget: { center, zoom, id: Date.now() } }),
  clearFlyTarget: () => set({ flyTarget: null }),

  resumeMap: () => set({ step: 'terrain' }),

  generateGrid: async () => {
    const { paperSize, orientation, mapMode, diptychJoin, hexSizeMm, hexOrientation, bearing, center, zoom, framePixelWidth } = get()
    if (framePixelWidth === 0) return

    const [cwMm, chMm] = combinedDimsMm(paperSize, orientation, mapMode, diptychJoin)
    const res = mapResolutionMpx(center[1], zoom)
    const widthM = framePixelWidth * res
    const heightM = widthM * (chMm / cwMm)

    set({ status: 'loading', error: null })

    try {
      const resp = await fetch('/api/generate/grid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          center_lon: center[0],
          center_lat: center[1],
          bearing,
          width_m: widthM,
          height_m: heightM,
          hex_size_mm: hexSizeMm,
          paper_size: paperSize,
          orientation,
          hex_orientation: hexOrientation,
          paper_width_mm: cwMm,
          paper_height_mm: chMm,
        }),
      })
      if (!resp.ok) throw new Error(await resp.text())
      const data = await resp.json()
      set({ hexes: data.hexes, metadata: data.metadata, status: 'done' })
    } catch (e) {
      set({ status: 'error', error: String(e) })
    }
  },
})
