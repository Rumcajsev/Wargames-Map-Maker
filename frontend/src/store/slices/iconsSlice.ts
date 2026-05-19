import type { MapStore, IconOverlay, ActiveTool } from '../mapStore'

export type IconsSlice = {
  iconOverlays: IconOverlay[]
  placedIcons: Record<string, [number, number][]>
  activeIconOverlayId: string | null
  iconPlaceMode: boolean
  iconEraseMode: boolean

  addIconOverlay: (o: Omit<IconOverlay, 'id'>) => void
  updateIconOverlay: (id: string, changes: Partial<Omit<IconOverlay, 'id'>>) => void
  deleteIconOverlay: (id: string) => void
  setActiveIconOverlayId: (id: string | null) => void
  placeIcon: (overlayId: string, lon: number, lat: number) => void
  removeIconAt: (overlayId: string, index: number) => void
  clearIconOverlay: (overlayId: string) => void
}

type Set = (partial: Partial<MapStore> | ((s: MapStore) => Partial<MapStore>)) => void

export const createIconsSlice = (set: Set, _get: () => MapStore): IconsSlice => ({
  iconOverlays: [],
  placedIcons: {},
  activeIconOverlayId: null,
  iconPlaceMode: false,
  iconEraseMode: false,

  addIconOverlay: (o) => set((s) => ({
    iconOverlays: [...s.iconOverlays, { ...o, id: crypto.randomUUID() }],
  })),
  updateIconOverlay: (id, changes) => set((s) => ({
    iconOverlays: s.iconOverlays.map(o => o.id === id ? { ...o, ...changes } : o),
  })),
  deleteIconOverlay: (id) => set((s) => {
    const placedIcons = { ...s.placedIcons }
    delete placedIcons[id]
    return {
      iconOverlays: s.iconOverlays.filter(o => o.id !== id),
      placedIcons,
      activeIconOverlayId: s.activeIconOverlayId === id ? null : s.activeIconOverlayId,
      activeTool: (s.activeTool.type === 'icon-place' || s.activeTool.type === 'icon-erase') && s.activeTool.id === id
        ? { type: 'none' } as ActiveTool : s.activeTool,
    }
  }),
  setActiveIconOverlayId: (id) => set({ activeIconOverlayId: id }),
  placeIcon: (overlayId, lon, lat) => set((s) => ({
    placedIcons: {
      ...s.placedIcons,
      [overlayId]: [...(s.placedIcons[overlayId] ?? []), [lon, lat]],
    },
  })),
  removeIconAt: (overlayId, index) => set((s) => {
    const icons = s.placedIcons[overlayId] ?? []
    return {
      placedIcons: {
        ...s.placedIcons,
        [overlayId]: icons.filter((_, i) => i !== index),
      },
    }
  }),
  clearIconOverlay: (overlayId) => set((s) => ({
    placedIcons: { ...s.placedIcons, [overlayId]: [] },
  })),
})
