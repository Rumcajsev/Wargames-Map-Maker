import type { MapStore, MapArea, AreasStyle, AreasGenParams } from '../mapStore'

export type AreasSlice = {
  areasMode: boolean
  areas: MapArea[]
  areaHexes: Record<string, string>
  activeAreaId: string | null
  areasStyle: AreasStyle
  areasGenParams: AreasGenParams

  setAreasMode: (v: boolean) => void
  setAreasStyle: (patch: Partial<AreasStyle>) => void
  setAreasGenParams: (patch: Partial<AreasGenParams>) => void

  addArea: (name: string, color: string) => string
  updateArea: (id: string, changes: Partial<Omit<MapArea, 'id'>>) => void
  deleteArea: (id: string) => void
  setActiveAreaId: (id: string | null) => void

  paintHexArea: (q: number, r: number, areaId: string) => void
  eraseHexArea: (q: number, r: number) => void
  eraseAllHexesForArea: (id: string) => void

  generateAreas: () => void

  _setAreasState: (areas: MapArea[], areaHexes: Record<string, string>) => void
}

const AREA_COLORS = [
  '#5a3a1a', '#1a3a5a', '#1a5a3a', '#5a1a3a',
  '#3a5a1a', '#3a1a5a', '#5a4a3a', '#1a5a5a',
]

const TERRAIN_NAMES: Record<string, string> = {
  woods: 'Woods',
  light_woods: 'Forest',
  rough: 'Hills',
  marsh: 'Marsh',
  sea: 'Sea',
  clear: 'Fields',
}

const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]]

function adjEdgeKey(q1: number, r1: number, q2: number, r2: number): string {
  const a = `${q1},${r1}`, b = `${q2},${r2}`
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

export function createAreasSlice(
  set: (fn: (s: MapStore) => Partial<MapStore>) => void,
  get: () => MapStore,
): AreasSlice {
  return {
    areasMode: false,
    areas: [],
    areaHexes: {},
    activeAreaId: null,
    areasStyle: { borderWidth: 2.0, labelSize: 1.0, borderColor: '#2c1a00' },
    areasGenParams: { targetSize: 8, riverWeight: 0.7, terrainWeight: 2.0 },

    setAreasMode: (v) => set((s) => {
      const updates: Partial<MapStore> = { areasMode: v }
      const t = s.activeTool.type
      if (v && t !== 'areas-draw' && t !== 'areas-erase') {
        updates.activeTool = { type: 'areas-draw' }
      }
      if (!v && (t === 'areas-draw' || t === 'areas-erase')) {
        updates.activeTool = { type: 'none' }
      }
      return updates
    }),

    setAreasStyle: (patch) => set((s) => ({ areasStyle: { ...s.areasStyle, ...patch } })),

    setAreasGenParams: (patch) => set((s) => ({ areasGenParams: { ...s.areasGenParams, ...patch } })),

    addArea: (name, color) => {
      const id = crypto.randomUUID()
      set((s) => ({ areas: [...s.areas, { id, name, color }] }))
      return id
    },

    updateArea: (id, changes) => set((s) => ({
      areas: s.areas.map((a) => a.id === id ? { ...a, ...changes } : a),
    })),

    deleteArea: (id) => set((s) => {
      const areaHexes = { ...s.areaHexes }
      for (const key of Object.keys(areaHexes)) {
        if (areaHexes[key] === id) delete areaHexes[key]
      }
      const updates: Partial<MapStore> = {
        areas: s.areas.filter((a) => a.id !== id),
        areaHexes,
      }
      if (s.activeAreaId === id) updates.activeAreaId = null
      const t = s.activeTool
      if (t.type === 'areas-draw' || t.type === 'areas-erase') {
        updates.activeTool = { type: 'areas-draw' }
      }
      return updates
    }),

    setActiveAreaId: (id) => set(() => ({ activeAreaId: id })),

    paintHexArea: (q, r, areaId) => set((s) => ({
      areaHexes: { ...s.areaHexes, [`${q},${r}`]: areaId },
    })),

    eraseHexArea: (q, r) => set((s) => {
      const areaHexes = { ...s.areaHexes }
      delete areaHexes[`${q},${r}`]
      return { areaHexes }
    }),

    eraseAllHexesForArea: (id) => set((s) => {
      const areaHexes = { ...s.areaHexes }
      for (const key of Object.keys(areaHexes)) {
        if (areaHexes[key] === id) delete areaHexes[key]
      }
      return { areaHexes }
    }),

    generateAreas: () => {
      const { generatedHexes, riverEdges, areasGenParams } = get()
      const { targetSize, riverWeight, terrainWeight } = areasGenParams

      if (generatedHexes.length === 0) return

      // 1. Build hex lookup (include partial hexes)
      const hexByKey = new Map<string, { q: number; r: number; terrain: string; center: [number, number] }>()
      for (const h of generatedHexes) {
        hexByKey.set(`${h.q},${h.r}`, { q: h.q, r: h.r, terrain: h.terrain, center: h.center })
      }

      // 2. Build river edge set
      const riverEdgeSet = new Set<string>()
      for (const e of riverEdges) {
        riverEdgeSet.add(adjEdgeKey(e.q1, e.r1, e.q2, e.r2))
      }

      // 3. Seed placement via furthest-point sampling
      const allKeys = [...hexByKey.keys()]
      const N = Math.max(1, Math.round(allKeys.length / Math.max(1, targetSize)))

      // Seed 0: hex nearest map centroid
      let cx = 0, cy = 0
      for (const h of hexByKey.values()) { cx += h.center[0]; cy += h.center[1] }
      cx /= hexByKey.size; cy /= hexByKey.size

      let bestDist = Infinity, seed0 = allKeys[0]
      for (const k of allKeys) {
        const h = hexByKey.get(k)!
        const d = (h.center[0] - cx) ** 2 + (h.center[1] - cy) ** 2
        if (d < bestDist) { bestDist = d; seed0 = k }
      }

      const seeds: string[] = [seed0]
      const minDist = new Map<string, number>()
      for (const k of allKeys) {
        const h = hexByKey.get(k)!, s0 = hexByKey.get(seed0)!
        minDist.set(k, (h.center[0] - s0.center[0]) ** 2 + (h.center[1] - s0.center[1]) ** 2)
      }

      while (seeds.length < N) {
        let best = -1, bestKey = allKeys[0]
        for (const k of allKeys) {
          if (seeds.includes(k)) continue
          const d = minDist.get(k) ?? 0
          if (d > best) { best = d; bestKey = k }
        }
        seeds.push(bestKey)
        // Update minDist
        const ns = hexByKey.get(bestKey)!
        for (const k of allKeys) {
          const h = hexByKey.get(k)!
          const d = (h.center[0] - ns.center[0]) ** 2 + (h.center[1] - ns.center[1]) ** 2
          if (d < (minDist.get(k) ?? Infinity)) minDist.set(k, d)
        }
      }

      // 4. Dijkstra Voronoi flood fill
      const assigned = new Map<string, number>()
      // [cost, hexKey, seedIdx]
      const pq: [number, string, number][] = []
      for (let i = 0; i < seeds.length; i++) {
        pq.push([0, seeds[i], i])
        assigned.set(seeds[i], i)
      }

      while (pq.length > 0) {
        pq.sort((a, b) => a[0] - b[0])
        const [cost, key, seedIdx] = pq.shift()!
        if (assigned.get(key) !== seedIdx) continue
        const [q, r] = key.split(',').map(Number)
        const cur = hexByKey.get(key)!
        for (const [dq, dr] of DIRS) {
          const nk = `${q + dq},${r + dr}`
          if (!hexByKey.has(nk) || assigned.has(nk)) continue
          const nb = hexByKey.get(nk)!
          let edgeCost = 1.0
          if (riverEdgeSet.has(adjEdgeKey(q, r, q + dq, r + dr))) edgeCost *= (1 - riverWeight)
          if (cur.terrain !== nb.terrain) edgeCost += terrainWeight
          assigned.set(nk, seedIdx)
          pq.push([cost + edgeCost, nk, seedIdx])
        }
      }

      // 5. Build MapArea entries
      const terrainCountBySeed = new Map<number, Map<string, number>>()
      for (const [key, seedIdx] of assigned) {
        const h = hexByKey.get(key)!
        if (!terrainCountBySeed.has(seedIdx)) terrainCountBySeed.set(seedIdx, new Map())
        const tc = terrainCountBySeed.get(seedIdx)!
        tc.set(h.terrain, (tc.get(h.terrain) ?? 0) + 1)
      }

      const newAreas: MapArea[] = []
      const newAreaHexes: Record<string, string> = {}
      const seedToAreaId = new Map<number, string>()

      for (let i = 0; i < seeds.length; i++) {
        const tc = terrainCountBySeed.get(i)
        if (!tc || tc.size === 0) continue
        let dominant = 'clear', maxCount = 0
        for (const [t, c] of tc) { if (c > maxCount) { maxCount = c; dominant = t } }
        const id = crypto.randomUUID()
        const idx = newAreas.length
        newAreas.push({
          id,
          name: TERRAIN_NAMES[dominant] ?? `Area ${idx + 1}`,
          color: AREA_COLORS[idx % AREA_COLORS.length],
        })
        seedToAreaId.set(i, id)
      }

      for (const [key, seedIdx] of assigned) {
        const areaId = seedToAreaId.get(seedIdx)
        if (areaId) newAreaHexes[key] = areaId
      }

      set(() => ({ areas: newAreas, areaHexes: newAreaHexes, areasMode: true }))
    },

    _setAreasState: (areas, areaHexes) => set(() => ({ areas, areaHexes })),
  }
}
