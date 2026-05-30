import type { MapStore } from '../mapStore'
import {
  extractStylePreset, type StylePreset,
  extractColorPalette, type ColorPalette,
  BUILTIN_PRESET_MAP, BUILTIN_PALETTE_MAP,
} from '../../lib/stylePreset'

const STORAGE_KEY = 'ig2-style-presets'
const ACTIVE_PRESET_KEY = 'ig2-active-preset'
const ACTIVE_PALETTE_KEY = 'ig2-active-palette'

export interface StylePresetEntry {
  id: string
  name: string
  createdAt: number
  data: StylePreset
}

export interface ColorPaletteEntry {
  id: string
  name: string
  createdAt: number
  data: ColorPalette
}

export interface PresetsSlice {
  userPresets: StylePresetEntry[]
  activePresetId: string | null
  activePaletteId: string | null
  savePreset: (name: string) => void
  loadPreset: (id: string) => void
  loadBuiltinPreset: (id: string) => void
  deletePreset: (id: string) => void
  exportPreset: (id: string) => void
  importPresetData: (data: unknown) => string | null
  loadBuiltinPalette: (id: string) => void
}

function loadFromStorage(): StylePresetEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as StylePresetEntry[]
  } catch {
    return []
  }
}

function saveToStorage(presets: StylePresetEntry[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(presets)) } catch { /* ignore quota errors */ }
}

function loadId(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

function saveId(key: string, id: string | null): void {
  try {
    if (id) localStorage.setItem(key, id)
    else localStorage.removeItem(key)
  } catch { /* ignore */ }
}

export function createPresetsSlice(
  set: (partial: Partial<MapStore>) => void,
  get: () => MapStore,
): PresetsSlice {
  return {
    userPresets: loadFromStorage(),
    activePresetId: loadId(ACTIVE_PRESET_KEY),
    activePaletteId: loadId(ACTIVE_PALETTE_KEY),

    savePreset: (name: string) => {
      const entry: StylePresetEntry = {
        id: crypto.randomUUID(),
        name: name.trim() || 'Untitled',
        createdAt: Date.now(),
        data: extractStylePreset(get()),
      }
      const updated = [...get().userPresets, entry]
      saveToStorage(updated)
      saveId(ACTIVE_PRESET_KEY, null)
      saveId(ACTIVE_PALETTE_KEY, null)
      set({ userPresets: updated, activePresetId: null, activePaletteId: null })
    },

    loadPreset: (id: string) => {
      const entry = get().userPresets.find(p => p.id === id)
      if (!entry) return
      saveId(ACTIVE_PRESET_KEY, null)
      saveId(ACTIVE_PALETTE_KEY, null)
      set({ ...(entry.data as Partial<MapStore>), activePresetId: null, activePaletteId: null })
    },

    loadBuiltinPreset: (id: string) => {
      const preset = BUILTIN_PRESET_MAP[id]
      if (!preset) return
      // Also load the preset's default palette
      const palette = BUILTIN_PALETTE_MAP[preset.defaultPaletteId]
      const paletteData = palette?.data ?? {}
      saveId(ACTIVE_PRESET_KEY, id)
      saveId(ACTIVE_PALETTE_KEY, preset.defaultPaletteId ?? null)
      set({
        ...(preset.data as Partial<MapStore>),
        ...(paletteData as Partial<MapStore>),
        activePresetId: id,
        activePaletteId: preset.defaultPaletteId ?? null,
      })
    },

    loadBuiltinPalette: (id: string) => {
      const palette = BUILTIN_PALETTE_MAP[id]
      if (!palette) return
      saveId(ACTIVE_PALETTE_KEY, id)
      set({ ...(palette.data as Partial<MapStore>), activePaletteId: id })
    },

    deletePreset: (id: string) => {
      const updated = get().userPresets.filter(p => p.id !== id)
      saveToStorage(updated)
      set({ userPresets: updated })
    },

    exportPreset: (id: string) => {
      const entry = get().userPresets.find(p => p.id === id)
      if (!entry) return
      const payload = { type: 'ig2-style-preset', version: 1, name: entry.name, createdAt: entry.createdAt, data: entry.data }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${entry.name.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.ig2style`
      a.click()
      URL.revokeObjectURL(url)
    },

    importPresetData: (data: unknown) => {
      try {
        const parsed = data as Record<string, unknown>
        if (parsed.type !== 'ig2-style-preset') return 'Not a valid style preset file'
        const entry: StylePresetEntry = {
          id: crypto.randomUUID(),
          name: typeof parsed.name === 'string' ? parsed.name : 'Imported',
          createdAt: Date.now(),
          data: (parsed.data as StylePreset) ?? {},
        }
        const updated = [...get().userPresets, entry]
        saveToStorage(updated)
        set({ userPresets: updated })
        return null
      } catch {
        return 'Failed to import preset'
      }
    },
  }
}
