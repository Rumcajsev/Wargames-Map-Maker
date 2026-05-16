import type { MapStore, HexHighlight, ActiveTool } from '../mapStore'

export type HighlightsSlice = {
  highlights: HexHighlight[]
  highlightedHexes: Record<string, string>
  highlightLines: Record<string, string[][]>
  highlightEdgePaths: Record<string, [number, number][][]>
  activeHighlightId: string | null
  highlightPaintMode: boolean
  highlightLineEraser: boolean
  addHighlight: (h: Omit<HexHighlight, 'id'>) => void
  updateHighlight: (id: string, changes: Partial<Omit<HexHighlight, 'id'>>) => void
  deleteHighlight: (id: string) => void
  setActiveHighlightId: (id: string | null) => void
  setHighlightPaintMode: (v: boolean) => void
  setHighlightLineEraser: (v: boolean) => void
  setHexHighlight: (q: number, r: number, highlightId: string) => void
  clearHexHighlight: (q: number, r: number) => void
  clearAllHexHighlights: (highlightId: string) => void
  startNewLineSegment: (highlightId: string) => void
  appendHexToLine: (highlightId: string, q: number, r: number) => void
  removeLastHexFromLine: (highlightId: string) => void
  truncateHighlightLine: (highlightId: string, length: number) => void
  clearHighlightLine: (highlightId: string) => void
  eraseHexFromLine: (highlightId: string, q: number, r: number) => void
  setHighlightEdgePath: (highlightId: string, segments: [number, number][][]) => void
  clearHighlightEdgePath: (highlightId: string) => void
}

type Set = (partial: Partial<MapStore> | ((s: MapStore) => Partial<MapStore>)) => void

export const createHighlightsSlice = (set: Set, _get: () => MapStore): HighlightsSlice => ({
  highlights: [],
  highlightedHexes: {},
  highlightLines: {},
  highlightEdgePaths: {},
  activeHighlightId: null,
  highlightPaintMode: false,
  highlightLineEraser: false,

  addHighlight: (h) => set((s) => ({
    highlights: [...s.highlights, { ...h, id: crypto.randomUUID() }],
  })),
  updateHighlight: (id, changes) => set((s) => ({
    highlights: s.highlights.map(h => h.id === id ? { ...h, ...changes } : h),
  })),
  deleteHighlight: (id) => set((s) => {
    const highlightedHexes = { ...s.highlightedHexes }
    for (const key of Object.keys(highlightedHexes)) {
      if (highlightedHexes[key] === id) delete highlightedHexes[key]
    }
    const highlightLines = { ...s.highlightLines }
    delete highlightLines[id]
    const highlightEdgePaths = { ...s.highlightEdgePaths }
    delete highlightEdgePaths[id]
    return {
      highlights: s.highlights.filter(h => h.id !== id),
      highlightedHexes,
      highlightLines,
      highlightEdgePaths,
      activeHighlightId: s.activeHighlightId === id ? null : s.activeHighlightId,
      activeTool: (s.activeTool.type === 'highlight-paint' || s.activeTool.type === 'highlight-erase') && s.activeTool.id === id
        ? { type: 'none' } as ActiveTool : s.activeTool,
      highlightPaintMode: s.highlightPaintMode && s.activeHighlightId !== id,
      highlightLineEraser: s.highlightLineEraser && s.activeHighlightId !== id,
    }
  }),
  setActiveHighlightId: (id) => set({ activeHighlightId: id }),
  setHighlightPaintMode: (v) => set({ highlightPaintMode: v }),
  setHighlightLineEraser: (v) => set({ highlightLineEraser: v }),

  eraseHexFromLine: (highlightId, q, r) => set((s) => {
    const key = `${q},${r}`
    const segs = s.highlightLines[highlightId] ?? []
    const newSegs: string[][] = []
    for (const seg of segs) {
      const idx = seg.indexOf(key)
      if (idx === -1) {
        newSegs.push(seg)
      } else {
        const before = seg.slice(0, idx)
        const after = seg.slice(idx + 1)
        if (before.length >= 2) newSegs.push(before)
        if (after.length >= 2) newSegs.push(after)
      }
    }
    return { highlightLines: { ...s.highlightLines, [highlightId]: newSegs } }
  }),
  setHexHighlight: (q, r, highlightId) => set((s) => ({
    highlightedHexes: { ...s.highlightedHexes, [`${q},${r}`]: highlightId },
  })),
  clearHexHighlight: (q, r) => set((s) => {
    const highlightedHexes = { ...s.highlightedHexes }
    delete highlightedHexes[`${q},${r}`]
    return { highlightedHexes }
  }),
  clearAllHexHighlights: (highlightId) => set((s) => {
    const highlightedHexes = { ...s.highlightedHexes }
    for (const key of Object.keys(highlightedHexes)) {
      if (highlightedHexes[key] === highlightId) delete highlightedHexes[key]
    }
    return { highlightedHexes }
  }),
  startNewLineSegment: (highlightId) => set((s) => {
    const segs = s.highlightLines[highlightId] ?? []
    if (segs.length > 0 && segs[segs.length - 1].length === 0) return {}
    return { highlightLines: { ...s.highlightLines, [highlightId]: [...segs, []] } }
  }),
  appendHexToLine: (highlightId, q, r) => set((s) => {
    const segs = s.highlightLines[highlightId] ?? []
    if (segs.length === 0) return { highlightLines: { ...s.highlightLines, [highlightId]: [[`${q},${r}`]] } }
    const last = segs[segs.length - 1]
    return { highlightLines: { ...s.highlightLines, [highlightId]: [...segs.slice(0, -1), [...last, `${q},${r}`]] } }
  }),
  removeLastHexFromLine: (highlightId) => set((s) => {
    const segs = s.highlightLines[highlightId] ?? []
    if (segs.length === 0) return {}
    const last = segs[segs.length - 1]
    const newLast = last.slice(0, -1)
    return { highlightLines: { ...s.highlightLines, [highlightId]: newLast.length > 0 ? [...segs.slice(0, -1), newLast] : segs.slice(0, -1) } }
  }),
  truncateHighlightLine: (highlightId, length) => set((s) => {
    const segs = s.highlightLines[highlightId] ?? []
    if (segs.length === 0) return {}
    const truncated = segs[segs.length - 1].slice(0, length)
    return { highlightLines: { ...s.highlightLines, [highlightId]: truncated.length > 0 ? [...segs.slice(0, -1), truncated] : segs.slice(0, -1) } }
  }),
  clearHighlightLine: (highlightId) => set((s) => ({
    highlightLines: { ...s.highlightLines, [highlightId]: [] },
  })),
  setHighlightEdgePath: (highlightId, path) => set((s) => ({
    highlightEdgePaths: { ...s.highlightEdgePaths, [highlightId]: path },
  })),
  clearHighlightEdgePath: (highlightId) => set((s) => ({
    highlightEdgePaths: { ...s.highlightEdgePaths, [highlightId]: [] },
  })),
})
