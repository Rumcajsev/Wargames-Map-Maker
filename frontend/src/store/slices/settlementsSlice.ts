import type {
  MapStore, Settlement, SettlementTier, SettlementTierStyle,
} from '../mapStore'
import { DEFAULT_SETTLEMENT_TIER_STYLES } from '../mapStore'
import { pointInPolygon } from '../../lib/geometry'

export type SettlementsSlice = {
  settlements: Settlement[]
  settlementsStatus: 'idle' | 'loading' | 'error' | 'done'
  settlementsError: string | null
  settlementsLimit: number
  settlementsTypes: string[]
  settlementTierThresholds: [number, number, number]
  settlementsAutoPlace: number
  showSettlementLabels: boolean
  settlementLabelFont: 'classic' | 'antique' | 'modern'
  settlementLabelColor: string
  settlementLabelSizeScale: number
  settlementLabelOverrides: Record<number, { hidden?: boolean; dx?: number; dy?: number }>
  settlementEditMode: boolean
  settlementPlaceTarget: { q: number; r: number; vertices: [number, number][] } | null
  settlementMoveIndex: number | null
  settlementPlaceTier: SettlementTier
  settlementTierStyles: Record<SettlementTier, SettlementTierStyle>
  fetchSettlements: () => Promise<void>
  clearSettlements: () => void
  setSettlementsLimit: (v: number) => void
  setSettlementsTypes: (v: string[]) => void
  setSettlementTierThresholds: (v: [number, number, number]) => void
  setSettlementsAutoPlace: (v: number) => void
  toggleSettlementIncluded: (index: number) => void
  toggleSettlementPlaced: (index: number) => void
  updateSettlement: (index: number, changes: Partial<Pick<Settlement, 'name' | 'type' | 'included' | 'hex_q' | 'hex_r' | 'tier'>>) => void
  deleteSettlement: (index: number) => void
  addSettlement: (s: Omit<Settlement, 'included'> & { hex_q: number; hex_r: number }) => void
  placeSettlementAtHex: (hexQ: number, hexR: number, vertices: [number, number][], center: [number, number], tier: SettlementTier) => void
  lookupSettlementsInHex: (vertices: [number, number][]) => Promise<Settlement[]>
  setShowSettlementLabels: (v: boolean) => void
  setSettlementLabelFont: (v: 'classic' | 'antique' | 'modern') => void
  setSettlementLabelColor: (v: string) => void
  setSettlementLabelSizeScale: (v: number) => void
  setSettlementLabelOverride: (index: number, override: { hidden?: boolean; dx?: number; dy?: number }) => void
  resetSettlementLabelOverride: (index: number) => void
  setSettlementEditMode: (v: boolean) => void
  setSettlementPlaceTarget: (v: { q: number; r: number; vertices: [number, number][] } | null) => void
  setSettlementMoveIndex: (v: number | null) => void
  setSettlementPlaceTier: (tier: SettlementTier) => void
  setSettlementTierStyle: (tier: SettlementTier, style: Partial<SettlementTierStyle>) => void
}

type Set = (partial: Partial<MapStore> | ((s: MapStore) => Partial<MapStore>)) => void

export const createSettlementsSlice = (set: Set, get: () => MapStore): SettlementsSlice => ({
  settlements: [],
  settlementsStatus: 'idle',
  settlementsError: null,
  settlementsLimit: 50,
  settlementsTypes: ['city', 'town', 'village'],
  settlementTierThresholds: [50000, 10000, 2000],
  settlementsAutoPlace: 5,
  showSettlementLabels: true,
  settlementLabelFont: 'classic',
  settlementLabelColor: '#1a1008',
  settlementLabelSizeScale: 1.0,
  settlementLabelOverrides: {},
  settlementEditMode: false,
  settlementPlaceTarget: null,
  settlementMoveIndex: null,
  settlementPlaceTier: 1,
  settlementTierStyles: { ...DEFAULT_SETTLEMENT_TIER_STYLES },

  setSettlementsLimit: (v) => set({ settlementsLimit: v }),
  setSettlementsTypes: (v) => set({ settlementsTypes: v }),
  setSettlementTierThresholds: (v) => set({ settlementTierThresholds: v }),
  setSettlementsAutoPlace: (v) => set({ settlementsAutoPlace: v }),
  clearSettlements: () => {
    const { settlements } = get()
    set({ settlements: settlements.filter((s) => s.isCustom), settlementsStatus: 'idle', settlementsError: null })
  },
  setShowSettlementLabels: (v) => set({ showSettlementLabels: v }),
  setSettlementLabelFont: (v) => set({ settlementLabelFont: v }),
  setSettlementLabelColor: (v) => set({ settlementLabelColor: v }),
  setSettlementLabelSizeScale: (v) => set({ settlementLabelSizeScale: v }),
  setSettlementLabelOverride: (index, override) => {
    const prev = get().settlementLabelOverrides
    set({ settlementLabelOverrides: { ...prev, [index]: { ...prev[index], ...override } } })
  },
  resetSettlementLabelOverride: (index) => {
    const { [index]: _, ...rest } = get().settlementLabelOverrides
    set({ settlementLabelOverrides: rest })
  },

  setSettlementEditMode: (v) => set({ settlementEditMode: v, ...(v ? {} : { settlementPlaceTarget: null, settlementMoveIndex: null }) }),
  setSettlementPlaceTarget: (v) => set({ settlementPlaceTarget: v }),
  setSettlementMoveIndex: (v) => set({ settlementMoveIndex: v, settlementEditMode: v !== null }),
  setSettlementPlaceTier: (tier) => set({ settlementPlaceTier: tier }),
  setSettlementTierStyle: (tier, style) => {
    const { settlementTierStyles } = get()
    set({ settlementTierStyles: { ...settlementTierStyles, [tier]: { ...settlementTierStyles[tier], ...style } } })
  },

  toggleSettlementIncluded: (index) => {
    const { settlements } = get()
    set({ settlements: settlements.map((s, i) => i === index ? { ...s, included: !s.included } : s) })
  },

  toggleSettlementPlaced: (index) => {
    const { settlements, generatedHexes } = get()
    const s = settlements[index]
    if (!s) return
    if (s.hex_q !== null) {
      set({ settlements: settlements.map((t, i) => i === index ? { ...t, hex_q: null, hex_r: null } : t) })
    } else {
      for (const hex of generatedHexes) {
        if (pointInPolygon(s.lon, s.lat, hex.vertices)) {
          const blocker = settlements.findIndex((t, i) => i !== index && t.hex_q === hex.q && t.hex_r === hex.r && t.included)
          if (blocker >= 0) return
          set({ settlements: settlements.map((t, i) => i === index ? { ...t, hex_q: hex.q, hex_r: hex.r, included: true } : t) })
          return
        }
      }
    }
  },

  updateSettlement: (index, changes) => {
    get().pushUndoSnapshot()
    const { settlements } = get()
    set({ settlements: settlements.map((s, i) => i === index ? { ...s, ...changes } : s) })
  },

  deleteSettlement: (index) => {
    get().pushUndoSnapshot()
    const { settlements } = get()
    set({ settlements: settlements.filter((_, i) => i !== index) })
  },

  addSettlement: (s) => {
    get().pushUndoSnapshot()
    const { settlements } = get()
    set({ settlements: [...settlements, { ...s, included: true }] })
  },

  placeSettlementAtHex: (hexQ, hexR, vertices, center, tier) => {
    const TIER_LABELS: Record<SettlementTier, string> = { 1: 'Tier I', 2: 'Tier II', 3: 'Tier III', 4: 'Tier IV' }
    get().pushUndoSnapshot()
    set((s) => ({
      settlements: [...s.settlements, {
        name: TIER_LABELS[tier],
        type: 'city' as const,
        population: 0,
        lon: center[0],
        lat: center[1],
        hex_q: hexQ,
        hex_r: hexR,
        included: true,
        isCustom: true,
        tier,
      }],
    }))
    get().lookupSettlementsInHex(vertices).then((found) => {
      console.log('[settlements] hex lookup returned', found.length, 'results', found[0])
      const top = found[0]
      if (!top) return
      const current = get().settlements
      const idx = current.findIndex((s) => s.isCustom && s.hex_q === hexQ && s.hex_r === hexR)
      if (idx >= 0) {
        set({
          settlements: current.map((s, i) =>
            i === idx
              ? { ...s, name: top.name, type: top.type as Settlement['type'], population: top.population, lon: top.lon, lat: top.lat }
              : s
          ),
        })
      }
    }).catch((e) => { console.error('[settlements] hex lookup failed:', e) })
  },

  lookupSettlementsInHex: async (vertices) => {
    const resp = await fetch('/api/generate/settlement-hex-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vertices }),
    })
    if (!resp.ok) throw new Error(await resp.text())
    const data = await resp.json()
    return (data.settlements as Array<{ name: string; type: string; population: number; lon: number; lat: number }>)
      .map((s) => ({ ...s, type: s.type as Settlement['type'], hex_q: null, hex_r: null, included: true }))
  },

  fetchSettlements: async () => {
    const {
      paperSize, orientation,
      settlementsLimit, settlementsTypes, generatedHexes, generatedMetadata,
      settlementTierThresholds, settlementsAutoPlace,
    } = get()
    if (!generatedMetadata) return

    const widthM = generatedMetadata.scale_m_per_mm * generatedMetadata.paper_mm[0]
    const heightM = generatedMetadata.scale_m_per_mm * generatedMetadata.paper_mm[1]

    set({ settlementsStatus: 'loading', settlementsError: null })

    try {
      const resp = await fetch('/api/generate/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          center_lon: generatedMetadata.center[0],
          center_lat: generatedMetadata.center[1],
          bearing: generatedMetadata.bearing,
          width_m: widthM,
          height_m: heightM,
          paper_size: paperSize,
          orientation,
          limit: settlementsLimit,
          types: settlementsTypes,
        }),
      })
      if (!resp.ok) throw new Error(await resp.text())
      const data = await resp.json()

      const rawList = data.settlements as Array<{ name: string; type: string; population: number; lon: number; lat: number }>

      const computeTier = (pop: number, t: [number, number, number]): SettlementTier => {
        if (pop >= t[0]) return 1
        if (pop >= t[1]) return 2
        if (pop >= t[2]) return 3
        return 4
      }
      const populations = rawList.map((s) => s.population)
      let thresholds = settlementTierThresholds
      if (populations.length > 0) {
        const tierCounts = [0, 0, 0, 0]
        for (const p of populations) tierCounts[computeTier(p, thresholds) - 1]++
        if (tierCounts.some((c) => c === 0)) {
          const sorted = [...populations].sort((a, b) => b - a)
          const n = sorted.length
          const at = (frac: number) => sorted[Math.min(n - 1, Math.floor(n * frac))]
          thresholds = [at(0.1), at(0.35), at(0.65)]
          if (thresholds[1] >= thresholds[0]) thresholds[1] = Math.max(0, thresholds[0] - 1)
          if (thresholds[2] >= thresholds[1]) thresholds[2] = Math.max(0, thresholds[1] - 1)
        }
      }

      const hexByCoord = new Map<string, { hex: (typeof generatedHexes)[0]; pop: number; sIdx: number }>()
      const rawSettlements: Settlement[] = rawList.map((s) => ({
        ...s,
        type: s.type as Settlement['type'],
        hex_q: null,
        hex_r: null,
        included: true,
        tier: computeTier(s.population, thresholds),
      }))

      for (let i = 0; i < rawSettlements.length; i++) {
        const s = rawSettlements[i]
        for (const hex of generatedHexes) {
          if (pointInPolygon(s.lon, s.lat, hex.vertices)) {
            const key = `${hex.q},${hex.r}`
            const existing = hexByCoord.get(key)
            if (!existing || s.population > existing.pop) {
              if (existing) {
                rawSettlements[existing.sIdx].hex_q = null
                rawSettlements[existing.sIdx].hex_r = null
              }
              rawSettlements[i].hex_q = hex.q
              rawSettlements[i].hex_r = hex.r
              hexByCoord.set(key, { hex, pop: s.population, sIdx: i })
            }
            break
          }
        }
      }

      let placed = 0
      for (const s of rawSettlements) {
        if (s.hex_q !== null) {
          if (placed >= settlementsAutoPlace) {
            s.hex_q = null
            s.hex_r = null
          } else {
            placed++
          }
        }
      }

      const { settlements: existing } = get()
      const customSettlements = existing.filter((s) => s.isCustom)
      set({ settlements: [...rawSettlements, ...customSettlements], settlementsStatus: 'done' })
    } catch (e) {
      set({ settlementsStatus: 'error', settlementsError: String(e) })
    }
  },
})
