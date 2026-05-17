import type { MapStore, RawRoadWay, RoadEdge, RoadHex, RoadTierStyle, ActiveTool } from '../mapStore'
import { TIER_HIGHWAYS, HIGHWAY_TO_TIER, roadEdgeCanonicalKey, DEFAULT_ROAD_TIER_STYLES } from '../mapStore'

export type RoadsSlice = {
  rawRoadWays: RawRoadWay[]
  roadEdges: RoadEdge[]
  roadControlOverrides: Record<string, [number, number]>
  roadsDisplayMode: 'raw' | 'per_hex'
  roadsFetchTiers: [boolean, boolean, boolean]
  roadsVisibleTiers: [boolean, boolean, boolean]
  roadsStatus: 'idle' | 'loading' | 'error' | 'done'
  roadsError: string | null
  settlementRoadsStatus: 'idle' | 'loading' | 'error' | 'done'
  settlementRoadsError: string | null
  roadPaintMode: boolean
  roadPaintBrush: 0 | 1 | 2
  roadPaintEraser: boolean
  roadNodeEditMode: boolean
  roadWiggleAmp: number
  roadWiggleFreq: number
  roadSmoothing: number
  roadChainOverrides: Record<string, [number, number][]>
  roadTierStyles: [RoadTierStyle, RoadTierStyle, RoadTierStyle]
  fetchRoads: () => Promise<void>
  fetchSettlementRoads: () => Promise<void>
  setRoadsDisplayMode: (mode: 'raw' | 'per_hex') => void
  setRoadsFetchTiers: (tiers: [boolean, boolean, boolean]) => void
  setRoadsVisibleTiers: (tiers: [boolean, boolean, boolean]) => void
  clearRoads: () => void
  clearManualRoads: () => void
  addRoadEdge: (q1: number, r1: number, q2: number, r2: number, tier: 0 | 1 | 2) => void
  removeRoadHexEdges: (q: number, r: number, tier: 0 | 1 | 2) => void
  removeAllRoadHexEdges: (q: number, r: number) => void
  setRoadPaintBrush: (v: 0 | 1 | 2) => void
  setRoadPaintEraser: (v: boolean) => void
  setRoadNodeEditMode: (v: boolean) => void
  setRoadControlOverride: (key: string, pos: [number, number]) => void
  deleteRoadControlOverride: (key: string) => void
  setRoadWiggleAmp: (v: number) => void
  setRoadWiggleFreq: (v: number) => void
  setRoadSmoothing: (v: number) => void
  setRoadChainOverride: (id: string, pts: [number, number][]) => void
  deleteRoadChainOverride: (id: string) => void
  clearRoadChainOverrides: () => void
  setRoadTierStyle: (tier: 0 | 1 | 2, update: Partial<RoadTierStyle>) => void
  roadSegmentProps: Record<string, { wiggleAmp?: number; wiggleFreq?: number }>
  roadHopProps: Record<string, { wiggleAmp?: number; wiggleFreq?: number }>
  roadSelectMode: boolean
  selectedRoadSegmentKeys: string[]
  selectedRoadHopKey: string | null
  setRoadSelectMode: (v: boolean) => void
  toggleRoadSegmentSelection: (key: string) => void
  setSelectedRoadSegmentKeys: (keys: string[]) => void
  setRoadSegmentProp: (key: string, prop: { wiggleAmp?: number; wiggleFreq?: number }) => void
  clearRoadSegmentProp: (key: string) => void
  setRoadHopProp: (key: string, prop: { wiggleAmp?: number; wiggleFreq?: number }) => void
  clearRoadHopProp: (key: string) => void
  setSelectedRoadHopKey: (key: string | null) => void
}

type Set = (partial: Partial<MapStore> | ((s: MapStore) => Partial<MapStore>)) => void

export const createRoadsSlice = (set: Set, get: () => MapStore): RoadsSlice => ({
  rawRoadWays: [],
  roadEdges: [],
  roadControlOverrides: {},
  roadsDisplayMode: 'per_hex',
  roadsFetchTiers: [true, true, false],
  roadsVisibleTiers: [true, true, true],
  roadsStatus: 'idle',
  roadsError: null,
  settlementRoadsStatus: 'idle',
  settlementRoadsError: null,
  roadPaintMode: false,
  roadPaintBrush: 1,
  roadPaintEraser: false,
  roadNodeEditMode: false,
  roadWiggleAmp: 0,
  roadWiggleFreq: 2.5,
  roadSmoothing: 10,
  roadChainOverrides: {},
  roadTierStyles: [...DEFAULT_ROAD_TIER_STYLES] as [RoadTierStyle, RoadTierStyle, RoadTierStyle],
  roadSegmentProps: {},
  roadHopProps: {},
  roadSelectMode: false,
  selectedRoadSegmentKeys: [],
  selectedRoadHopKey: null,

  clearRoads: () => set(s => ({
    rawRoadWays: [], roadEdges: [], roadsVisibleTiers: [true, true, true], roadsStatus: 'idle', roadsError: null,
    roadPaintMode: false, roadPaintEraser: false, roadNodeEditMode: false,
    activeTool: (s.activeTool.type === 'road' || s.activeTool.type === 'node-edit') ? { type: 'none' } as ActiveTool : s.activeTool,
  })),
  clearManualRoads: () => { get().pushUndoSnapshot(); set((s) => ({ roadEdges: s.roadEdges.filter((e) => !e.manual) })) },
  setRoadsDisplayMode: (mode) => set({ roadsDisplayMode: mode }),
  setRoadsFetchTiers: (tiers) => set({ roadsFetchTiers: tiers }),
  setRoadsVisibleTiers: (tiers) => set({ roadsVisibleTiers: tiers }),

  fetchRoads: async () => {
    const { generatedMetadata, hexOrientation, roadsFetchTiers } = get()
    if (!generatedMetadata) return

    set({ roadsStatus: 'loading', roadsError: null })

    const highway_types = roadsFetchTiers.flatMap(
      (on, t) => on ? TIER_HIGHWAYS[t as 0 | 1 | 2] : []
    )

    try {
      const resp = await fetch('/api/generate/roads', {
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
          highway_types,
        }),
      })
      if (!resp.ok) throw new Error(await resp.text())
      const data = await resp.json()

      const edgeSet = new Set<string>()
      const roadEdges: RoadEdge[] = []
      for (const rh of data.road_hexes as RoadHex[]) {
        const tier = (HIGHWAY_TO_TIER[rh.highway] ?? 2) as 0 | 1 | 2
        for (const conn of rh.connections) {
          const key = roadEdgeCanonicalKey(rh.q, rh.r, conn.q, conn.r, tier)
          if (!edgeSet.has(key)) {
            edgeSet.add(key)
            roadEdges.push({ q1: rh.q, r1: rh.r, q2: conn.q, r2: conn.r, tier })
          }
        }
      }
      set({ rawRoadWays: data.raw_ways, roadEdges, roadChainOverrides: {}, roadsStatus: 'done' })
    } catch (e) {
      set({ roadsStatus: 'error', roadsError: String(e) })
    }
  },

  fetchSettlementRoads: async () => {
    const { generatedMetadata, hexOrientation, roadsFetchTiers, settlements } = get()
    if (!generatedMetadata) return

    const includedSettlements = settlements
      .filter((s) => s.included)
      .map((s) => ({ lat: s.lat, lon: s.lon, name: s.name }))
    if (includedSettlements.length < 2) return

    const highway_types = roadsFetchTiers.flatMap(
      (on, t) => (on ? TIER_HIGHWAYS[t as 0 | 1 | 2] : [])
    )
    if (highway_types.length === 0) return

    set({ settlementRoadsStatus: 'loading', settlementRoadsError: null })

    try {
      const resp = await fetch('/api/generate/settlement-roads', {
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
          settlements: includedSettlements,
          highway_types,
        }),
      })
      if (!resp.ok) throw new Error(await resp.text())
      const data = await resp.json()

      const edgeSet = new Set<string>()
      const roadEdges: RoadEdge[] = []
      for (const rh of data.road_hexes as RoadHex[]) {
        const tier = (HIGHWAY_TO_TIER[rh.highway] ?? 2) as 0 | 1 | 2
        for (const conn of rh.connections) {
          const key = roadEdgeCanonicalKey(rh.q, rh.r, conn.q, conn.r, tier)
          if (!edgeSet.has(key)) {
            edgeSet.add(key)
            roadEdges.push({ q1: rh.q, r1: rh.r, q2: conn.q, r2: conn.r, tier })
          }
        }
      }
      set({ rawRoadWays: data.raw_ways, roadEdges, roadChainOverrides: {}, settlementRoadsStatus: 'done' })
    } catch (e) {
      set({ settlementRoadsStatus: 'error', settlementRoadsError: String(e) })
    }
  },

  setRoadNodeEditMode: (v) => set({ roadNodeEditMode: v, ...(v ? { roadPaintMode: false, railPaintMode: false, terrainPaintMode: false, elevationPaintMode: false } : {}) }),
  deleteRoadControlOverride: (key) => set(s => { const { [key]: _, ...rest } = s.roadControlOverrides; return { roadControlOverrides: rest } }),
  setRoadWiggleAmp: (v) => set({ roadWiggleAmp: v }),
  setRoadWiggleFreq: (v) => set({ roadWiggleFreq: v }),
  setRoadSmoothing: (v) => set({ roadSmoothing: v }),
  setRoadChainOverride: (id, pts) => set(s => ({ roadChainOverrides: { ...s.roadChainOverrides, [id]: pts } })),
  deleteRoadChainOverride: (id) => set(s => { const { [id]: _, ...rest } = s.roadChainOverrides; return { roadChainOverrides: rest } }),
  clearRoadChainOverrides: () => set({ roadChainOverrides: {} }),
  setRoadPaintBrush: (v) => set({ roadPaintBrush: v }),
  setRoadPaintEraser: (v) => set({ roadPaintEraser: v }),
  setRoadControlOverride: (key, pos) => set(s => ({ roadControlOverrides: { ...s.roadControlOverrides, [key]: pos } })),

  addRoadEdge: (q1, r1, q2, r2, tier) => {
    const { roadEdges } = get()
    const newKey = roadEdgeCanonicalKey(q1, r1, q2, r2, tier)
    const pairKey = (e: RoadEdge) => {
      const a = `${e.q1},${e.r1}`, b = `${e.q2},${e.r2}`
      return a < b ? `${a}|${b}` : `${b}|${a}`
    }
    const thisPair = (() => { const a = `${q1},${r1}`, b = `${q2},${r2}`; return a < b ? `${a}|${b}` : `${b}|${a}` })()
    const filtered = roadEdges.filter((e) => pairKey(e) !== thisPair)
    if (filtered.some((e) => roadEdgeCanonicalKey(e.q1, e.r1, e.q2, e.r2, e.tier) === newKey)) return
    set({ roadEdges: [...filtered, { q1, r1, q2, r2, tier, manual: true }] })
  },

  removeRoadHexEdges: (q, r, tier) => {
    const { roadEdges } = get()
    set({ roadEdges: roadEdges.filter((e) => !(e.tier === tier && ((e.q1 === q && e.r1 === r) || (e.q2 === q && e.r2 === r)))) })
  },

  removeAllRoadHexEdges: (q, r) => {
    const { roadEdges } = get()
    set({ roadEdges: roadEdges.filter((e) => !((e.q1 === q && e.r1 === r) || (e.q2 === q && e.r2 === r))) })
  },

  setRoadTierStyle: (tier, update) => set((state) => {
    const styles = [...state.roadTierStyles] as [RoadTierStyle, RoadTierStyle, RoadTierStyle]
    styles[tier] = { ...styles[tier], ...update }
    return { roadTierStyles: styles }
  }),

  setRoadSelectMode: (v) => set({ roadSelectMode: v, selectedRoadSegmentKeys: [], selectedRoadHopKey: null }),
  setSelectedRoadSegmentKeys: (keys) => set({ selectedRoadSegmentKeys: keys }),
  toggleRoadSegmentSelection: (key) => set(s => ({
    selectedRoadSegmentKeys: s.selectedRoadSegmentKeys.includes(key)
      ? s.selectedRoadSegmentKeys.filter(k => k !== key)
      : [...s.selectedRoadSegmentKeys, key]
  })),
  setRoadSegmentProp: (key, prop) => set(s => ({ roadSegmentProps: { ...s.roadSegmentProps, [key]: { ...(s.roadSegmentProps[key] ?? {}), ...prop } } })),
  clearRoadSegmentProp: (key) => set(s => { const { [key]: _, ...rest } = s.roadSegmentProps; return { roadSegmentProps: rest } }),
  setRoadHopProp: (key, prop) => set(s => ({ roadHopProps: { ...s.roadHopProps, [key]: { ...(s.roadHopProps[key] ?? {}), ...prop } } })),
  clearRoadHopProp: (key) => set(s => { const { [key]: _, ...rest } = s.roadHopProps; return { roadHopProps: rest } }),
  setSelectedRoadHopKey: (key) => set({ selectedRoadHopKey: key }),
})
