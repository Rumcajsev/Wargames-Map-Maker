import type { ImageTransform } from '../store/slices/mapImageSlice'

export interface DrawMapImageOverlayParams {
  ctx: CanvasRenderingContext2D
  image: HTMLImageElement
  transform: ImageTransform
  opacity: number
  px: number
  py: number
  pw: number
  ph: number
}

export function drawMapImageOverlay({
  ctx, image, transform, opacity, px, py, pw, ph,
}: DrawMapImageOverlayParams): void {
  const canvasScale = (transform.scaleFrac * pw) / image.naturalWidth
  const cx = px + pw / 2 + transform.translateX * pw
  const cy = py + ph / 2 + transform.translateY * ph
  const w = image.naturalWidth * canvasScale
  const h = image.naturalHeight * canvasScale

  ctx.save()
  ctx.globalAlpha = opacity
  ctx.translate(cx, cy)
  ctx.rotate((transform.rotation * Math.PI) / 180)
  ctx.drawImage(image, -w / 2, -h / 2, w, h)
  ctx.restore()
}

export interface DrawConfidenceOverlayParams {
  ctx: CanvasRenderingContext2D
  hexes: Array<{ q: number; r: number; ai_confidence?: number }>
  hexLayout: { flatTop: boolean }
  outerRadiusPx: number
  hexCenters: Map<string, [number, number]>
  threshold: number
}

export function drawConfidenceOverlay({
  ctx, hexes, hexCenters, outerRadiusPx, threshold,
}: DrawConfidenceOverlayParams): void {
  for (const h of hexes) {
    const conf = h.ai_confidence
    if (conf === undefined || conf >= threshold) continue
    const center = hexCenters.get(`${h.q},${h.r}`)
    if (!center) continue
    const [cx, cy] = center
    const alpha = 0.15 + 0.3 * (1 - conf / threshold)
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = '#ff8c00'
    ctx.beginPath()
    ctx.arc(cx, cy, outerRadiusPx * 0.85, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}
