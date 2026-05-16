import type { MapStore, RawRailWay, RailEdge, RailHex, RailStyle, ActiveTool } from '../mapStore'
import { railEdgeCanonicalKey, DEFAULT_RAIL_STYLE } from '../mapStore'

export type RailsSlice = {
  rawRailWays: RawRailWay[]
  railEdges: RailEdge[]
  railsDisplayMode: 'raw' | 'per_hex'
  railsFetchTypes: string[]
  railsStatus: 'idle' | 'loading' | 'error' | 'done'
  railsError: string | null
  railPaintMode: boolean
  railPaintEraser: boolean
  railStyle: RailStyle
  fetchRails: () => Promise<void>
  setRailsDisplayMode: (mode: 'raw' | 'per_hex') => void
  setRailsFetchTypes: (types: string[]) => void
  clearRails: () => void
  addRailEdge: (q1: number, r1: number, q2: number, r2: number) => void
  removeRailHexEdges: (q: number, r: number) => void
  setRailPaintEraser: (v: boolean) => void
  setRailStyle: (update: Partial<RailStyle>) => void
}

type Set = (partial: Partial<MapStore> | ((s: MapStore) => Partial<MapStore>)) => void

export const createRailsSlice = (set: Set, get: () => MapStore): RailsSlice => ({
  rawRailWays: [],
  railEdges: [],
  railsDisplayMode: 'per_hex',
  railsFetchTypes: ['rail'],
  railsStatus: 'idle',
  railsError: null,
  railPaintMode: false,
  railPaintEraser: false,
  railStyle: { ...DEFAULT_RAIL_STYLE },

  clearRails: () => set(s => ({
    rawRailWays: [], railEdges: [], railsStatus: 'idle', railsError: null,
    railPaintMode: false, railPaintEraser: false,
    activeTool: (s.activeTool.type === 'rail') ? { type: 'none' } as ActiveTool : s.activeTool,
  })),
  setRailsDisplayMode: (mode) => set({ railsDisplayMode: mode }),
  setRailsFetchTypes: (types) => set({ railsFetchTypes: types }),
  setRailPaintEraser: (v) => set({ railPaintEraser: v }),
  setRailStyle: (update) => set((state) => ({ railStyle: { ...state.railStyle, ...update } })),

  fetchRails: async () => {
    const { generatedMetadata, hexOrientation, railsFetchTypes } = get()
    if (!generatedMetadata) return

    set({ railsStatus: 'loading', railsError: null })

    try {
      const resp = await fetch('/api/generate/rails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          center_lon: generatedMetadata.center[0],
          center_lat: generatedMetadata.center[1],
          bearing: generatedMetadata.bearing,
          width_m: generatedMetadata.scale_m_per_mm * generatedMetadata.paper_mm[0],
          height_m: generatedMetadata.scale_m_per_mm * generatedMetadata.paper_mm[1],
          hex_orientation: hexOrientation,
          R_m: generatedMetadata.outer_radius_m,
          rail_types: railsFetchTypes,
        }),
      })
      if (!resp.ok) throw new Error(await resp.text())
      const data = await resp.json()

      const edgeSet = new Set<string>()
      const railEdges: RailEdge[] = []
      for (const rh of data.rail_hexes as RailHex[]) {
        for (const conn of rh.connections) {
          const key = railEdgeCanonicalKey(rh.q, rh.r, conn.q, conn.r)
          if (!edgeSet.has(key)) {
            edgeSet.add(key)
            railEdges.push({ q1: rh.q, r1: rh.r, q2: conn.q, r2: conn.r })
          }
        }
      }
      set({ rawRailWays: data.raw_ways, railEdges, railsStatus: 'done' })
    } catch (e) {
      set({ railsStatus: 'error', railsError: String(e) })
    }
  },

  addRailEdge: (q1, r1, q2, r2) => {
    const { railEdges } = get()
    const key = railEdgeCanonicalKey(q1, r1, q2, r2)
    if (railEdges.some((e) => railEdgeCanonicalKey(e.q1, e.r1, e.q2, e.r2) === key)) return
    set({ railEdges: [...railEdges, { q1, r1, q2, r2, manual: true }] })
  },

  removeRailHexEdges: (q, r) => {
    const { railEdges } = get()
    set({ railEdges: railEdges.filter((e) => !((e.q1 === q && e.r1 === r) || (e.q2 === q && e.r2 === r))) })
  },
})
