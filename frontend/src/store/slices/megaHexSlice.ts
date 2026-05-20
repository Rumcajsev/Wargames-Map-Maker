import type { MapStore } from '../mapStore'

export interface MegaHexSlice {
  megaHexEnabled: boolean
  megaHexRadius: number
  megaHexColor: string
  megaHexOpacity: number
  megaHexLineWidth: number
  megaHexOriginQ: number
  megaHexOriginR: number
  setMegaHexEnabled: (v: boolean) => void
  setMegaHexRadius: (v: number) => void
  setMegaHexColor: (v: string) => void
  setMegaHexOpacity: (v: number) => void
  setMegaHexLineWidth: (v: number) => void
  setMegaHexOrigin: (q: number, r: number) => void
}

export function createMegaHexSlice(
  set: (partial: Partial<MapStore>) => void,
): MegaHexSlice {
  return {
    megaHexEnabled: false,
    megaHexRadius: 1,
    megaHexColor: '#cc4444',
    megaHexOpacity: 0.8,
    megaHexLineWidth: 2,
    megaHexOriginQ: 0,
    megaHexOriginR: 0,
    setMegaHexEnabled: (v) => set({ megaHexEnabled: v }),
    setMegaHexRadius: (v) => set({ megaHexRadius: v }),
    setMegaHexColor: (v) => set({ megaHexColor: v }),
    setMegaHexOpacity: (v) => set({ megaHexOpacity: v }),
    setMegaHexLineWidth: (v) => set({ megaHexLineWidth: v }),
    setMegaHexOrigin: (q, r) => set({ megaHexOriginQ: q, megaHexOriginR: r }),
  }
}
