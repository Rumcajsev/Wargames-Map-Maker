import { useRef } from 'react'
import { useMapStore } from '../store/mapStore'
import { TerrainViewCanvas } from './TerrainViewCanvas'
import { sidebarStyle, sectionStyle, labelStyle } from './sidebarStyles'

export function ImageAlignView() {
  const {
    mapImageDataUrl, mapImageTransform, mapImageOpacity,
    generatedHexes,
    setMapImageDataUrl, setMapImageTransform, setMapImageOpacity,
    confirmImageAlign, clearMapImage,
  } = useMapStore()

  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const canConfirm = !!mapImageDataUrl && generatedHexes.length > 0

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100%' }}>
      {/* Left sidebar */}
      <div style={{ ...sidebarStyle, display: 'flex', flexDirection: 'column', gap: 0, flexShrink: 0 }}>
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #1e1f2e' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#e0e0f0', marginBottom: 2 }}>Import reference map</div>
          <div style={{ fontSize: 10, color: '#4a4a6a' }}>{generatedHexes.length} hexes · align image, then paint terrain</div>
        </div>

        {/* Upload */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Map image</div>
          {mapImageDataUrl ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, color: '#5a9e6f' }}>✓ Image loaded</span>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{ background: 'none', border: 'none', color: '#6a6a8a', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit', padding: 0 }}
                onMouseEnter={e => (e.currentTarget.style.color = '#a0a0c0')}
                onMouseLeave={e => (e.currentTarget.style.color = '#6a6a8a')}
              >Change</button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%', padding: '20px 0', textAlign: 'center',
                background: 'none', border: '2px dashed #2a2b3d', borderRadius: 4,
                color: '#4a4a6a', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#3a6a4a'; e.currentTarget.style.color = '#6a9a7a' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2b3d'; e.currentTarget.style.color = '#4a4a6a' }}
            >
              Click or drop image here
            </button>
          )}
          <input
            ref={fileInputRef} type="file" accept="image/*"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
        </div>

        {/* Transform controls */}
        {mapImageDataUrl && (
          <div style={sectionStyle}>
            <div style={labelStyle}>Align</div>
            <div style={{ fontSize: 10, color: '#4a4a6a', marginBottom: 8 }}>Drag on canvas to move · sliders to scale/rotate</div>
            <Slider label="Scale" min={0.05} max={5} step={0.01}
              value={mapImageTransform.scaleFrac}
              onChange={v => setMapImageTransform({ scaleFrac: v })} />
            <Slider label="Rotation" min={-180} max={180} step={1}
              value={mapImageTransform.rotation}
              onChange={v => setMapImageTransform({ rotation: v })} />
            <Slider label="Opacity" min={0.1} max={1} step={0.05}
              value={mapImageOpacity}
              onChange={setMapImageOpacity} />
          </div>
        )}

        {mapImageDataUrl && (
          <div style={{ ...sectionStyle, fontSize: 10, color: '#4a4a6a' }}>
            Hold <kbd style={{ background: '#1e1f2e', border: '1px solid #2a2b3d', borderRadius: 3, padding: '1px 4px', color: '#8a8fb0' }}>Space</kbd> to preview image at full opacity while painting
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Bottom actions */}
        <div style={{ padding: 14, borderTop: '1px solid #1e1f2e', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={confirmImageAlign}
            disabled={!canConfirm}
            style={{
              width: '100%', padding: '9px 0',
              background: canConfirm ? '#2a4a3a' : 'none',
              color: canConfirm ? '#7ad4a0' : '#3a3a5a',
              border: `1px solid ${canConfirm ? '#4a8a6a' : '#2a2a4a'}`,
              borderRadius: 4, cursor: canConfirm ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
            }}
            onMouseEnter={e => { if (canConfirm) e.currentTarget.style.background = '#3a6a4a' }}
            onMouseLeave={e => { if (canConfirm) e.currentTarget.style.background = '#2a4a3a' }}
          >
            Start painting →
          </button>
          <button
            onClick={clearMapImage}
            style={{
              width: '100%', padding: '6px 0',
              background: 'none', color: '#4a4a6a',
              border: '1px solid #1e1f2e', borderRadius: 4,
              cursor: 'pointer', fontFamily: 'inherit', fontSize: 11,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#9e5a5a')}
            onMouseLeave={e => (e.currentTarget.style.color = '#4a4a6a')}
          >
            ← Back to Setup
          </button>
        </div>
      </div>

      {/* Full-screen canvas */}
      <TerrainViewCanvas />
    </div>
  )
}

function Slider({ label, min, max, step, value, onChange }: {
  label: string; min: number; max: number; step: number
  value: number; onChange: (v: number) => void
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
      <span style={{ fontSize: 10, color: '#6a6a8a', display: 'flex', justifyContent: 'space-between' }}>
        <span>{label}</span>
        <span style={{ color: '#a0a0c0' }}>{Math.round(value * 100) / 100}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%' }} />
    </label>
  )
}
