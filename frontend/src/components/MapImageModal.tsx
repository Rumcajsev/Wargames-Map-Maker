import { useRef, useCallback, useEffect } from 'react'
import { useMapStore } from '../store/mapStore'
import { projectToCanvas } from '../lib/projection'
import type { HexCrop } from '../store/slices/mapImageSlice'

interface Props {
  paperRect: { pw: number; ph: number; px: number; py: number }
}

export function MapImageModal({ paperRect }: Props) {
  const {
    mapImageModalOpen, mapImageModalStep,
    mapImageDataUrl, mapImageNaturalSize,
    mapImageTransform, mapImageOpacity,
    mapImageClassifyStatus, mapImageClassifyProgress,
    setMapImageDataUrl, setMapImageTransform, setMapImageOpacity,
    setMapImageModalStep, closeMapImageModal,
    fetchMapImageClassification,
    generatedHexes, generatedMetadata,
  } = useMapStore()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const previewImageRef = useRef<HTMLImageElement | null>(null)
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ mx: 0, my: 0, tx: 0, ty: 0 })

  // Load image element when dataUrl changes
  useEffect(() => {
    if (!mapImageDataUrl) return
    const img = new Image()
    img.onload = () => { previewImageRef.current = img; drawPreview() }
    img.src = mapImageDataUrl
  }, [mapImageDataUrl])

  const drawPreview = useCallback(() => {
    const canvas = previewCanvasRef.current
    const img = previewImageRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width, H = canvas.height
    ctx.clearRect(0, 0, W, H)

    // Paper background
    ctx.fillStyle = '#1a1b2e'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#f5f0e8'
    const margin = 20
    const pw = W - margin * 2, ph = H - margin * 2
    ctx.fillRect(margin, margin, pw, ph)

    // Draw image overlay
    const t = mapImageTransform
    const canvasScale = (t.scaleFrac * pw) / img.naturalWidth
    const cx = margin + pw / 2 + t.translateX * pw
    const cy = margin + ph / 2 + t.translateY * ph
    const iw = img.naturalWidth * canvasScale
    const ih = img.naturalHeight * canvasScale
    ctx.save()
    ctx.globalAlpha = mapImageOpacity
    ctx.translate(cx, cy)
    ctx.rotate((t.rotation * Math.PI) / 180)
    ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih)
    ctx.restore()

    // Hex grid overlay (simple flat-top grid for alignment reference)
    ctx.strokeStyle = 'rgba(60,120,80,0.5)'
    ctx.lineWidth = 0.8
    const hexR = pw / 12
    const cols = Math.ceil(pw / (hexR * 1.5)) + 2
    const rows = Math.ceil(ph / (hexR * Math.sqrt(3))) + 2
    for (let col = -1; col < cols; col++) {
      for (let row = -1; row < rows; row++) {
        const hx = margin + col * hexR * 1.5
        const hy = margin + row * hexR * Math.sqrt(3) + (col % 2 === 0 ? 0 : hexR * Math.sqrt(3) / 2)
        ctx.beginPath()
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3
          const x = hx + hexR * Math.cos(angle)
          const y = hy + hexR * Math.sin(angle)
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
        }
        ctx.closePath()
        ctx.stroke()
      }
    }
  }, [mapImageTransform, mapImageOpacity])

  useEffect(() => { drawPreview() }, [drawPreview])

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const img = new Image()
      img.onload = () => setMapImageDataUrl(dataUrl, img.naturalWidth, img.naturalHeight)
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) handleFile(file)
  }

  // Canvas drag to move image
  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true
    dragStartRef.current = {
      mx: e.clientX, my: e.clientY,
      tx: mapImageTransform.translateX, ty: mapImageTransform.translateY,
    }
  }
  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return
    const canvas = previewCanvasRef.current!
    const pw = canvas.width - 40
    const ph = canvas.height - 40
    const dx = (e.clientX - dragStartRef.current.mx) / pw
    const dy = (e.clientY - dragStartRef.current.my) / ph
    setMapImageTransform({ translateX: dragStartRef.current.tx + dx, translateY: dragStartRef.current.ty + dy })
  }
  const onMouseUp = () => { isDraggingRef.current = false }

  const handleClassify = async () => {
    if (!generatedHexes.length || !generatedMetadata || !mapImageDataUrl || !mapImageNaturalSize) return
    setMapImageModalStep('classify')

    const { pw, ph, px, py } = paperRect
    const meta = generatedMetadata

    const metersPerCanvasPx = (meta.scale_m_per_mm * meta.paper_mm[0]) / pw
    const t = mapImageTransform
    const canvasScale = (t.scaleFrac * pw) / mapImageNaturalSize.w
    const imgCX = px + pw / 2 + t.translateX * pw
    const imgCY = py + ph / 2 + t.translateY * ph

    // Build an offscreen canvas matching the original image for cropping
    const srcImg = previewImageRef.current!
    const offscreen = document.createElement('canvas')
    offscreen.width = mapImageNaturalSize.w
    offscreen.height = mapImageNaturalSize.h
    const offCtx = offscreen.getContext('2d')!
    offCtx.drawImage(srcImg, 0, 0)

    const crops: HexCrop[] = []
    const patchSizePx = Math.max(32, Math.round((meta.outer_radius_m / metersPerCanvasPx) * 2 / canvasScale))

    for (const hex of generatedHexes) {
      const [lon, lat] = hex.center
      const [hx, hy] = projectToCanvas(lon, lat, meta, pw, ph, px, py)

      // Invert image transform to get position in image pixel space
      const dx = hx - imgCX
      const dy = hy - imgCY
      const angle = -(t.rotation * Math.PI) / 180
      const rx = dx * Math.cos(angle) - dy * Math.sin(angle)
      const ry = dx * Math.sin(angle) + dy * Math.cos(angle)
      const cx = rx / canvasScale + mapImageNaturalSize.w / 2
      const cy = ry / canvasScale + mapImageNaturalSize.h / 2

      crops.push({ q: hex.q, r: hex.r, cx, cy, size: patchSizePx })
    }

    await fetchMapImageClassification(crops)
  }

  if (!mapImageModalOpen) return null

  const s: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
  const box: React.CSSProperties = {
    background: '#13141f', border: '1px solid #2a2b3d',
    borderRadius: 8, padding: 24, width: 700, maxWidth: '95vw',
    fontFamily: 'ui-monospace, monospace', color: '#c0c0d8', fontSize: 13,
  }

  return (
    <div style={s} onClick={(e) => e.target === e.currentTarget && closeMapImageModal()}>
      <div style={box}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#e0e0f0' }}>Import historical map</span>
          <button onClick={closeMapImageModal} style={btnStyle('#6a6a8a')}>✕</button>
        </div>

        {/* Step indicators */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(['upload', 'align', 'classify'] as const).map((step, i) => (
            <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {i > 0 && <div style={{ width: 24, height: 1, background: '#2a2b3d' }} />}
              <div style={{
                padding: '3px 10px', borderRadius: 4, fontSize: 11,
                background: mapImageModalStep === step ? '#2a3a2a' : 'transparent',
                color: mapImageModalStep === step ? '#5a9e6f' : '#4a4a6a',
                border: `1px solid ${mapImageModalStep === step ? '#3a6a4a' : '#2a2b3d'}`,
              }}>
                {i + 1}. {step.charAt(0).toUpperCase() + step.slice(1)}
              </div>
            </div>
          ))}
        </div>

        {/* Step: Upload */}
        {mapImageModalStep === 'upload' && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed #2a2b3d', borderRadius: 6,
              padding: 48, textAlign: 'center', cursor: 'pointer',
              color: '#4a4a6a',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#3a6a4a')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#2a2b3d')}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>🗺</div>
            <div>Drop a scanned map image here, or click to browse</div>
            <div style={{ fontSize: 11, marginTop: 8, color: '#3a3a5a' }}>PNG, JPG, WEBP — any size</div>
            <input
              ref={fileInputRef} type="file" accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
          </div>
        )}

        {/* Step: Align */}
        {mapImageModalStep === 'align' && (
          <div>
            <div style={{ marginBottom: 10, color: '#8a8aaa', fontSize: 12 }}>
              Drag the image to align it with the hex grid. Use sliders to scale and rotate.
            </div>
            <canvas
              ref={previewCanvasRef}
              width={652} height={420}
              style={{ width: '100%', borderRadius: 4, cursor: 'grab', display: 'block' }}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
              <Slider label="Scale" min={0.1} max={4} step={0.01}
                value={mapImageTransform.scaleFrac}
                onChange={(v) => setMapImageTransform({ scaleFrac: v })} />
              <Slider label="Rotation" min={-180} max={180} step={1}
                value={mapImageTransform.rotation}
                onChange={(v) => setMapImageTransform({ rotation: v })} />
              <Slider label="Opacity" min={0.1} max={1} step={0.05}
                value={mapImageOpacity}
                onChange={setMapImageOpacity} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setMapImageModalStep('upload')} style={btnStyle('#6a6a8a')}>← Back</button>
              <button onClick={handleClassify} style={btnStyle('#5a9e6f')}>Classify hexes →</button>
            </div>
          </div>
        )}

        {/* Step: Classify */}
        {mapImageModalStep === 'classify' && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            {mapImageClassifyStatus === 'loading' && mapImageClassifyProgress && (
              <>
                <div style={{ marginBottom: 12, color: '#a0a0c0' }}>{mapImageClassifyProgress.message}</div>
                <div style={{ background: '#1e1f2e', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 4,
                    background: '#5a9e6f',
                    width: `${mapImageClassifyProgress.progress}%`,
                    transition: 'width 0.3s',
                  }} />
                </div>
                <div style={{ marginTop: 8, color: '#4a4a6a', fontSize: 12 }}>
                  {mapImageClassifyProgress.progress}%
                </div>
              </>
            )}
            {mapImageClassifyStatus === 'error' && (
              <div style={{ color: '#e06060' }}>
                Classification failed. Check that ANTHROPIC_API_KEY is set in the backend.
                <br /><br />
                <button onClick={() => setMapImageModalStep('align')} style={btnStyle('#6a6a8a')}>← Back</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Slider({ label, min, max, step, value, onChange }: {
  label: string; min: number; max: number; step: number
  value: number; onChange: (v: number) => void
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: '#6a6a8a' }}>
        {label}: <span style={{ color: '#a0a0c0' }}>{Math.round(value * 100) / 100}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%' }} />
    </label>
  )
}

function btnStyle(color: string): React.CSSProperties {
  return {
    padding: '6px 14px', borderRadius: 4, border: `1px solid ${color}`,
    background: 'transparent', color, cursor: 'pointer',
    fontFamily: 'ui-monospace, monospace', fontSize: 12,
  }
}
