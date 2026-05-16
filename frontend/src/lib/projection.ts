/** Geo↔canvas projection utilities. Pure functions, no React or store deps
 *  (but takes GridMetadata by value so callers control the import). */

import { FRAME_MARGIN } from '../store/mapStore'
import type { GridMetadata } from '../store/mapStore'

/** Projects geographic coordinates onto the paper rect in canvas logical pixels. */
export function projectToCanvas(
  lon: number, lat: number,
  meta: GridMetadata,
  paperW: number, paperH: number,
  paperX: number, paperY: number,
): [number, number] {
  const MPDEG = 111319
  const cosLat = Math.cos((meta.center[1] * Math.PI) / 180)
  const β = (meta.bearing * Math.PI) / 180
  const E_m = (lon - meta.center[0]) * cosLat * MPDEG
  const N_m = (lat - meta.center[1]) * MPDEG
  const px_m = E_m * Math.cos(β) - N_m * Math.sin(β)
  const py_m = E_m * Math.sin(β) + N_m * Math.cos(β)
  const scalePxPerM = paperW / (meta.scale_m_per_mm * meta.paper_mm[0])
  return [
    paperX + paperW / 2 + px_m * scalePxPerM,
    paperY + paperH / 2 - py_m * scalePxPerM,
  ]
}

/** Inverts projectToCanvas — canvas pixel → geographic coordinates. */
export function unprojectFromCanvas(
  cx: number, cy: number,
  meta: GridMetadata,
  paperW: number, paperH: number,
  paperX: number, paperY: number,
): [number, number] {
  const MPDEG = 111319
  const cosLat = Math.cos((meta.center[1] * Math.PI) / 180)
  const β = (meta.bearing * Math.PI) / 180
  const scalePxPerM = paperW / (meta.scale_m_per_mm * meta.paper_mm[0])
  const px_m = (cx - paperX - paperW / 2) / scalePxPerM
  const py_m = -(cy - paperY - paperH / 2) / scalePxPerM
  const E_m = px_m * Math.cos(β) + py_m * Math.sin(β)
  const N_m = -px_m * Math.sin(β) + py_m * Math.cos(β)
  return [meta.center[0] + E_m / (cosLat * MPDEG), meta.center[1] + N_m / MPDEG]
}

/** Fits the paper rect (with FRAME_MARGIN) into a CSS canvas of cssW×cssH. */
export function computePaper(cssW: number, cssH: number, meta: GridMetadata) {
  const [pwMm, phMm] = meta.paper_mm
  const aspect = pwMm / phMm
  const margin = FRAME_MARGIN
  let pw = cssW * margin
  let ph = pw / aspect
  if (ph > cssH * margin) { ph = cssH * margin; pw = ph * aspect }
  const px = (cssW - pw) / 2
  const py = (cssH - ph) / 2
  return { pw, ph, px, py }
}
