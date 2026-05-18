import type { MapStore, RawRailWay, RailEdge, HexRailPath, RailStyle, ActiveTool } from '../mapStore'
import { railEdgeCanonicalKey, DEFAULT_RAIL_STYLE } from '../mapStore'

export type RailsSlice = {
  rawRailWays: RawRailWay[]
  osmRailHexPaths: HexRailPath[]
  osmRailHighlight: boolean
  railEdges: RailEdge[]
  railsFetchTypes: string[]
  railsStatus: 'idle' | 'loading' | 'error' | 'done'
  railsError: string | null
  railPaintMode: boolean
  railPaintEraser: boolean
  railStyle: RailStyle
  setOsmRailHighlight: (v: boolean) => void
  fetchRails: () => Promise<void>
  applyOsmRails: () => void
  setRailsFetchTypes: (types: string[]) => void
  clearRails: () => void
  addRailEdge: (q1: number, r1: number, q2: number, r2: number) => void
  removeRailEdge: (q1: number, r1: number, q2: number, r2: number) => void
  removeRailHexEdges: (q: number, r: number) => void
  setRailPaintEraser: (v: boolean) => void
  setRailStyle: (update: Partial<RailStyle>) => void
}

type Set = (partial: Partial<MapStore> | ((s: MapStore) => Partial<MapStore>)) => void

export const createRailsSlice = (set: Set, get: () => MapStore): RailsSlice => ({
  rawRailWays: [],
  osmRailHexPaths: [],
  osmRailHighlight: false,
  railEdges: [],
  railsFetchTypes: ['rail'],
  railsStatus: 'idle',
  railsError: null,
  railPaintMode: false,
  railPaintEraser: false,
  railStyle: { ...DEFAULT_RAIL_STYLE },

  setOsmRailHighlight: (v) => set({ osmRailHighlight: v }),

  clearRails: () => set(s => ({
    rawRailWays: [], osmRailHexPaths: [], osmRailHighlight: false,
    railEdges: [], railsStatus: 'idle', railsError: null,
    railPaintMode: false, railPaintEraser: false,
    activeTool: (s.activeTool.type === 'rail') ? { type: 'none' } as ActiveTool : s.activeTool,
  })),
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

      set({ rawRailWays: data.raw_ways, osmRailHexPaths: data.hex_paths ?? [], railsStatus: 'done' })
    } catch (e) {
      set({ railsStatus: 'error', railsError: String(e) })
    }
  },

  applyOsmRails: () => {
    get().pushUndoSnapshot()
    const { osmRailHexPaths, railEdges } = get()
    const existingPairs = new Set<string>()
    for (const e of railEdges) {
      const a = `${e.q1},${e.r1}`, b = `${e.q2},${e.r2}`
      existingPairs.add(a < b ? `${a}|${b}` : `${b}|${a}`)
    }
    const edgeSet = new Set<string>()
    const newEdges: RailEdge[] = []
    for (const path of osmRailHexPaths) {
      for (let i = 0; i < path.hexes.length - 1; i++) {
        const [q1, r1] = path.hexes[i]
        const [q2, r2] = path.hexes[i + 1]
        const dq = q2 - q1, dr = r2 - r1
        const adj = (dq === 1 && dr === 0) || (dq === -1 && dr === 0) ||
                    (dq === 0 && dr === 1) || (dq === 0 && dr === -1) ||
                    (dq === 1 && dr === -1) || (dq === -1 && dr === 1)
        if (!adj) continue
        const a = `${q1},${r1}`, b = `${q2},${r2}`
        const pairKey = a < b ? `${a}|${b}` : `${b}|${a}`
        if (existingPairs.has(pairKey)) continue
        const key = railEdgeCanonicalKey(q1, r1, q2, r2)
        if (!edgeSet.has(key)) {
          edgeSet.add(key)
          newEdges.push({ q1, r1, q2, r2 })
        }
      }
    }
    if (newEdges.length > 0) set(s => ({ railEdges: [...s.railEdges, ...newEdges] }))
  },

  addRailEdge: (q1, r1, q2, r2) => {
    const { railEdges } = get()
    const key = railEdgeCanonicalKey(q1, r1, q2, r2)
    if (railEdges.some((e) => railEdgeCanonicalKey(e.q1, e.r1, e.q2, e.r2) === key)) return
    set({ railEdges: [...railEdges, { q1, r1, q2, r2, manual: true }] })
  },

  removeRailEdge: (q1, r1, q2, r2) => {
    const key = railEdgeCanonicalKey(q1, r1, q2, r2)
    set(s => ({ railEdges: s.railEdges.filter(e => railEdgeCanonicalKey(e.q1, e.r1, e.q2, e.r2) !== key) }))
  },

  removeRailHexEdges: (q, r) => {
    const { railEdges } = get()
    set({ railEdges: railEdges.filter((e) => !((e.q1 === q && e.r1 === r) || (e.q2 === q && e.r2 === r))) })
  },
})
