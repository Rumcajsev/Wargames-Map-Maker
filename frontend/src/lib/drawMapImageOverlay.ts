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

