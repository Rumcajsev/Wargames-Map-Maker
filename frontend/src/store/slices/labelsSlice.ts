import type { MapStore, LabelOverlay, ActiveTool } from '../mapStore'

export type PlacedLabel = { lon: number; lat: number; text: string }

export type LabelsSlice = {
  labelOverlays: LabelOverlay[]
  placedLabels: Record<string, PlacedLabel[]>
  activeLabelOverlayId: string | null

  addLabelOverlay: (o: Omit<LabelOverlay, 'id'>) => void
  updateLabelOverlay: (id: string, changes: Partial<Omit<LabelOverlay, 'id'>>) => void
  deleteLabelOverlay: (id: string) => void
  setActiveLabelOverlayId: (id: string | null) => void
  placeLabel: (overlayId: string, lon: number, lat: number, text: string) => void
  updateLabelText: (overlayId: string, index: number, text: string) => void
  moveLabelTo: (overlayId: string, index: number, lon: number, lat: number) => void
  removeLabelAt: (overlayId: string, index: number) => void
  clearLabelOverlay: (overlayId: string) => void
}

type Set = (partial: Partial<MapStore> | ((s: MapStore) => Partial<MapStore>)) => void

export const createLabelsSlice = (set: Set, _get: () => MapStore): LabelsSlice => ({
  labelOverlays: [],
  placedLabels: {},
  activeLabelOverlayId: null,

  addLabelOverlay: (o) => set((s) => ({
    labelOverlays: [...s.labelOverlays, { ...o, id: crypto.randomUUID() }],
  })),

  updateLabelOverlay: (id, changes) => set((s) => ({
    labelOverlays: s.labelOverlays.map(o => o.id === id ? { ...o, ...changes } : o),
  })),

  deleteLabelOverlay: (id) => set((s) => {
    const placedLabels = { ...s.placedLabels }
    delete placedLabels[id]
    return {
      labelOverlays: s.labelOverlays.filter(o => o.id !== id),
      placedLabels,
      activeLabelOverlayId: s.activeLabelOverlayId === id ? null : s.activeLabelOverlayId,
      activeTool: (s.activeTool.type === 'label-place' || s.activeTool.type === 'label-erase') && s.activeTool.id === id
        ? { type: 'none' } as ActiveTool : s.activeTool,
    }
  }),

  setActiveLabelOverlayId: (id) => set({ activeLabelOverlayId: id }),

  placeLabel: (overlayId, lon, lat, text) => set((s) => ({
    placedLabels: {
      ...s.placedLabels,
      [overlayId]: [...(s.placedLabels[overlayId] ?? []), { lon, lat, text }],
    },
  })),

  updateLabelText: (overlayId, index, text) => set((s) => {
    const labels = s.placedLabels[overlayId] ?? []
    return {
      placedLabels: {
        ...s.placedLabels,
        [overlayId]: labels.map((l, i) => i === index ? { ...l, text } : l),
      },
    }
  }),

  moveLabelTo: (overlayId, index, lon, lat) => set((s) => {
    const labels = s.placedLabels[overlayId] ?? []
    return {
      placedLabels: {
        ...s.placedLabels,
        [overlayId]: labels.map((l, i) => i === index ? { ...l, lon, lat } : l),
      },
    }
  }),

  removeLabelAt: (overlayId, index) => set((s) => {
    const labels = s.placedLabels[overlayId] ?? []
    return {
      placedLabels: {
        ...s.placedLabels,
        [overlayId]: labels.filter((_, i) => i !== index),
      },
    }
  }),

  clearLabelOverlay: (overlayId) => set((s) => ({
    placedLabels: { ...s.placedLabels, [overlayId]: [] },
  })),
})
