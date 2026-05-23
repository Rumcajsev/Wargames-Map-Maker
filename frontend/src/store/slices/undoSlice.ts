import type { MapStore, UndoSnapshot } from '../mapStore'

const MAX_UNDO = 50

export type UndoSlice = {
  undoStack: UndoSnapshot[]
  redoStack: UndoSnapshot[]
  pushUndoSnapshot: () => void
  undo: () => void
  redo: () => void
}

type Set = (partial: Partial<MapStore> | ((s: MapStore) => Partial<MapStore>)) => void

export const createUndoSlice = (set: Set, get: () => MapStore): UndoSlice => ({
  undoStack: [],
  redoStack: [],

  pushUndoSnapshot: () => {
    const { generatedHexes, roadEdges, railEdges, riverEdges, settlements, areas, areaHexes, undoStack } = get()
    const snap: UndoSnapshot = {
      terrainHexes: generatedHexes.map(({ q, r, terrain, manual_override, isLake }) => ({
        q, r, terrain, manual_override: manual_override ?? false, isLake: isLake ?? false,
      })),
      roadEdges: [...roadEdges],
      railEdges: [...railEdges],
      riverEdges: [...riverEdges],
      settlements: [...settlements],
      areas: [...areas],
      areaHexes: { ...areaHexes },
    }
    set({ undoStack: [...undoStack, snap].slice(-MAX_UNDO), redoStack: [] })
  },

  undo: () => {
    const { undoStack, redoStack, generatedHexes, roadEdges, railEdges, riverEdges, settlements, areas, areaHexes } = get()
    if (undoStack.length === 0) return
    const prev = undoStack[undoStack.length - 1]
    const current: UndoSnapshot = {
      terrainHexes: generatedHexes.map(({ q, r, terrain, manual_override, isLake }) => ({
        q, r, terrain, manual_override: manual_override ?? false, isLake: isLake ?? false,
      })),
      roadEdges: [...roadEdges],
      railEdges: [...railEdges],
      riverEdges: [...riverEdges],
      settlements: [...settlements],
      areas: [...areas],
      areaHexes: { ...areaHexes },
    }
    const hexMap = new Map(prev.terrainHexes.map((h) => [`${h.q},${h.r}`, h]))
    const restoredHexes = generatedHexes.map((h) => {
      const snap = hexMap.get(`${h.q},${h.r}`)
      return snap ? { ...h, terrain: snap.terrain, manual_override: snap.manual_override, isLake: snap.isLake } : h
    })
    set({
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, current],
      generatedHexes: restoredHexes,
      roadEdges: prev.roadEdges,
      railEdges: prev.railEdges ?? railEdges,
      riverEdges: prev.riverEdges ?? riverEdges,
      settlements: prev.settlements,
      areas: prev.areas ?? areas,
      areaHexes: prev.areaHexes ?? areaHexes,
    })
  },

  redo: () => {
    const { undoStack, redoStack, generatedHexes, roadEdges, railEdges, riverEdges, settlements, areas, areaHexes } = get()
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    const current: UndoSnapshot = {
      terrainHexes: generatedHexes.map(({ q, r, terrain, manual_override, isLake }) => ({
        q, r, terrain, manual_override: manual_override ?? false, isLake: isLake ?? false,
      })),
      roadEdges: [...roadEdges],
      railEdges: [...railEdges],
      riverEdges: [...riverEdges],
      settlements: [...settlements],
      areas: [...areas],
      areaHexes: { ...areaHexes },
    }
    const hexMap = new Map(next.terrainHexes.map((h) => [`${h.q},${h.r}`, h]))
    const restoredHexes = generatedHexes.map((h) => {
      const snap = hexMap.get(`${h.q},${h.r}`)
      return snap ? { ...h, terrain: snap.terrain, manual_override: snap.manual_override, isLake: snap.isLake } : h
    })
    set({
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, current],
      generatedHexes: restoredHexes,
      roadEdges: next.roadEdges,
      railEdges: next.railEdges ?? railEdges,
      riverEdges: next.riverEdges ?? riverEdges,
      settlements: next.settlements,
      areas: next.areas ?? areas,
      areaHexes: next.areaHexes ?? areaHexes,
    })
  },
})
