import type { MapStore, RiverStyleConfig } from '../mapStore'
import { DEFAULT_RIVER_STYLE, DEFAULT_CANAL_STYLE } from '../mapStore'

export type RiversSlice = {
  riverEdges: { q1: number; r1: number; q2: number; r2: number }[]
  canalEdges: { q1: number; r1: number; q2: number; r2: number }[]
  showRiverLabels: boolean
  riverLabelColor: string
  riverSegmentProps: Record<string, { width?: number; taper?: number; taperRange?: [number, number]; wiggle?: number }>
  canalSegmentProps: Record<string, { width?: number; taper?: number; taperRange?: [number, number] }>
  riverSelectMode: boolean
  canalSelectMode: boolean
  selectedSegmentKeys: string[]
  selectedCanalSegmentKeys: string[]
  riverStyle: RiverStyleConfig
  canalStyle: RiverStyleConfig
  riverEditMode: boolean
  canalEditMode: boolean
  riverWidthScale: number
  canalWidthScale: number
  riverFlowStyle: number
  riverCurveSteps: number
  riverWobble: number
  riverDetail: number
  setShowRiverLabels: (v: boolean) => void
  setRiverLabelColor: (v: string) => void
  toggleRiverEdge: (q1: number, r1: number, q2: number, r2: number) => void
  setRiverEdges: (edges: { q1: number; r1: number; q2: number; r2: number }[]) => void
  setRiverSelectMode: (v: boolean) => void
  setSelectedSegmentKeys: (keys: string[]) => void
  toggleSegmentSelection: (key: string) => void
  setRiverSegmentProp: (key: string, prop: { width?: number; taper?: number; taperRange?: [number, number]; wiggle?: number }) => void
  setRiverSegmentPropMany: (keys: string[], prop: { width?: number; taper?: number; taperRange?: [number, number]; wiggle?: number }) => void
  clearRiverSegmentProp: (key: string) => void
  clearRiverSegmentPropMany: (keys: string[]) => void
  setRiverStyle: (s: Partial<RiverStyleConfig>) => void
  toggleCanalEdge: (q1: number, r1: number, q2: number, r2: number) => void
  setCanalSelectMode: (v: boolean) => void
  setSelectedCanalSegmentKeys: (keys: string[]) => void
  toggleCanalSegmentSelection: (key: string) => void
  setCanalSegmentProp: (key: string, prop: { width?: number; taper?: number; taperRange?: [number, number] }) => void
  setCanalSegmentPropMany: (keys: string[], prop: { width?: number; taper?: number; taperRange?: [number, number] }) => void
  clearCanalSegmentProp: (key: string) => void
  clearCanalSegmentPropMany: (keys: string[]) => void
  setCanalStyle: (s: Partial<RiverStyleConfig>) => void
  setCanalWidthScale: (v: number) => void
  setRiverWidthScale: (v: number) => void
  setRiverFlowStyle: (v: number) => void
  setRiverCurveSteps: (v: number) => void
  setRiverWobble: (v: number) => void
  setRiverDetail: (v: number) => void
}

type Set = (partial: Partial<MapStore> | ((s: MapStore) => Partial<MapStore>)) => void

type SegProp = { width?: number; taper?: number; taperRange?: [number, number]; wiggle?: number }

const edgeKey = (q1: number, r1: number, q2: number, r2: number) => {
  const s1 = `${q1},${r1}`, s2 = `${q2},${r2}`
  return s1 < s2 ? `${s1}|${s2}` : `${s2}|${s1}`
}

function makeSegmentActions(
  propsKey: 'riverSegmentProps' | 'canalSegmentProps',
  selKey: 'selectedSegmentKeys' | 'selectedCanalSegmentKeys',
  set: Set,
  get: () => MapStore,
) {
  return {
    setSelectedKeys: (keys: string[]) => set({ [selKey]: keys } as Partial<MapStore>),
    toggleSelection: (key: string) => {
      const selected = get()[selKey]
      const next = selected.includes(key)
        ? selected.filter(k => k !== key)
        : [...selected, key]
      set({ [selKey]: next } as Partial<MapStore>)
    },
    setProp: (key: string, prop: SegProp) => {
      const props = get()[propsKey]
      set({ [propsKey]: { ...props, [key]: { ...(props[key] ?? {}), ...prop } } } as Partial<MapStore>)
    },
    setPropMany: (keys: string[], prop: SegProp) => {
      const props = get()[propsKey]
      const next = { ...props }
      for (const key of keys) next[key] = { ...(next[key] ?? {}), ...prop }
      set({ [propsKey]: next } as Partial<MapStore>)
    },
    clearProp: (key: string) => {
      const props = get()[propsKey]
      const next = { ...props }
      delete next[key]
      set({ [propsKey]: next } as Partial<MapStore>)
    },
    clearPropMany: (keys: string[]) => {
      const props = get()[propsKey]
      const next = { ...props }
      for (const key of keys) delete next[key]
      set({ [propsKey]: next } as Partial<MapStore>)
    },
  }
}

export const createRiversSlice = (set: Set, get: () => MapStore): RiversSlice => {
  const river = makeSegmentActions('riverSegmentProps', 'selectedSegmentKeys', set, get)
  const canal = makeSegmentActions('canalSegmentProps', 'selectedCanalSegmentKeys', set, get)

  return {
    riverEdges: [],
    canalEdges: [],
    showRiverLabels: true,
    riverLabelColor: '#2a5a8a',
    riverEditMode: false,
    canalEditMode: false,
    riverSegmentProps: {},
    canalSegmentProps: {},
    riverSelectMode: false,
    canalSelectMode: false,
    selectedSegmentKeys: [],
    selectedCanalSegmentKeys: [],
    riverStyle: { ...DEFAULT_RIVER_STYLE },
    canalStyle: { ...DEFAULT_CANAL_STYLE },
    riverWidthScale: 1.0,
    canalWidthScale: 0.45,
    riverFlowStyle: 1,
    riverCurveSteps: 3,
    riverWobble: 0,
    riverDetail: 0,

    setShowRiverLabels: (v) => set({ showRiverLabels: v }),
    setRiverLabelColor: (v) => set({ riverLabelColor: v }),
    setRiverSelectMode: (v) => set({ riverSelectMode: v, selectedSegmentKeys: [] }),
    setSelectedSegmentKeys: river.setSelectedKeys,
    toggleSegmentSelection: river.toggleSelection,
    setRiverSegmentProp: river.setProp,
    setRiverSegmentPropMany: river.setPropMany,
    clearRiverSegmentProp: river.clearProp,
    clearRiverSegmentPropMany: river.clearPropMany,
    setRiverStyle: (s) => set(st => ({ riverStyle: { ...st.riverStyle, ...s } })),

    toggleRiverEdge: (q1, r1, q2, r2) => {
      get().pushUndoSnapshot()
      const { riverEdges } = get()
      const k = edgeKey(q1, r1, q2, r2)
      const idx = riverEdges.findIndex(e => edgeKey(e.q1, e.r1, e.q2, e.r2) === k)
      set({ riverEdges: idx >= 0 ? riverEdges.filter((_, i) => i !== idx) : [...riverEdges, { q1, r1, q2, r2 }] })
    },
    setRiverEdges: (edges) => set({ riverEdges: edges }),

    toggleCanalEdge: (q1, r1, q2, r2) => {
      get().pushUndoSnapshot()
      const { canalEdges } = get()
      const k = edgeKey(q1, r1, q2, r2)
      const idx = canalEdges.findIndex(e => edgeKey(e.q1, e.r1, e.q2, e.r2) === k)
      set({ canalEdges: idx >= 0 ? canalEdges.filter((_, i) => i !== idx) : [...canalEdges, { q1, r1, q2, r2 }] })
    },
    setCanalSelectMode: (v) => set({ canalSelectMode: v, selectedCanalSegmentKeys: [] }),
    setSelectedCanalSegmentKeys: canal.setSelectedKeys,
    toggleCanalSegmentSelection: canal.toggleSelection,
    setCanalSegmentProp: canal.setProp,
    setCanalSegmentPropMany: canal.setPropMany,
    clearCanalSegmentProp: canal.clearProp,
    clearCanalSegmentPropMany: canal.clearPropMany,
    setCanalStyle: (s) => set(st => ({ canalStyle: { ...st.canalStyle, ...s } })),
    setCanalWidthScale: (v) => set({ canalWidthScale: v }),
    setRiverWidthScale: (v) => set({ riverWidthScale: v }),
    setRiverFlowStyle: (v) => set({ riverFlowStyle: v }),
    setRiverCurveSteps: (v) => set({ riverCurveSteps: v }),
    setRiverWobble: (v) => set({ riverWobble: v }),
    setRiverDetail: (v) => set({ riverDetail: v }),
  }
}
