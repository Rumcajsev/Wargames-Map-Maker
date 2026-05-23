import { useEffect, useRef, useCallback, useState } from 'react'
import { useMapStore } from './store/mapStore'
import { SetupPanel } from './components/SetupPanel'
import { MapView } from './components/MapView'
import { TopBar } from './components/TopBar'
import { PresetsPanel } from './components/PresetsPanel'
import { TerrainSidebar } from './components/TerrainSidebar'
import { RoadsSidebar } from './components/RoadsSidebar'
import { RiversSidebar } from './components/RiversSidebar'
import { DisplaySidebar } from './components/DisplaySidebar'
import { SettlementsSidebar } from './components/SettlementsSidebar'
import { HighlightsSidebar } from './components/HighlightsSidebar'
import { AreasSidebar } from './components/AreasSidebar'
import { ElevationSidebar } from './components/ElevationSidebar'
import { TerrainViewCanvas, type TerrainViewCanvasHandle } from './components/TerrainViewCanvas'
import { MapImageModal } from './components/MapImageModal'

function App() {
  const { step, activePanel, undo, redo, generateStatus, generateProgress, mapImageModalOpen, mapImageClassifyProgress } = useMapStore()
  const canvasHandleRef = useRef<TerrainViewCanvasHandle>(null)
  const [presetsOpen, setPresetsOpen] = useState(false)
  const [paperRect, setPaperRect] = useState<{ pw: number; ph: number; px: number; py: number } | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  useEffect(() => {
    if (mapImageModalOpen) {
      setPaperRect(canvasHandleRef.current?.getPaperRect() ?? null)
    }
  }, [mapImageModalOpen])

  const handleExportPDF = useCallback(async () => {
    const result = await canvasHandleRef.current?.exportBlob()
    if (!result) return
    const { blob, paperMm } = result
    const reader = new FileReader()
    reader.onload = async () => {
      const b64 = (reader.result as string).split(',')[1]
      const res = await fetch('/api/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_b64: b64, paper_mm: paperMm }),
      })
      if (!res.ok) return
      const pdfBlob = await res.blob()
      const url = URL.createObjectURL(pdfBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'map.pdf'
      a.click()
      URL.revokeObjectURL(url)
    }
    reader.readAsDataURL(blob)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {presetsOpen && <PresetsPanel onClose={() => setPresetsOpen(false)} />}
      {paperRect && <MapImageModal paperRect={paperRect} />}
      {step === 'setup' ? (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <SetupPanel onOpenPresets={() => setPresetsOpen(true)} />
          <MapView />
        </div>
      ) : (
        <>
          <TopBar onExportPDF={handleExportPDF} onOpenPresets={() => setPresetsOpen(true)} />
          {generateStatus === 'loading' && generateProgress && (
            <div style={{ height: 3, background: '#1a2a22', flexShrink: 0 }}>
              <div style={{ height: '100%', width: `${generateProgress.progress}%`, background: '#4a9a6a', transition: 'width 0.25s ease' }} />
            </div>
          )}
          {mapImageClassifyProgress && (
            <div style={{ height: 3, background: '#1a2a22', flexShrink: 0 }}>
              <div style={{ height: '100%', width: `${mapImageClassifyProgress.progress}%`, background: '#5a9e6f', transition: 'width 0.3s ease' }} />
            </div>
          )}
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {activePanel === 'display' ? <DisplaySidebar /> : activePanel === 'roads' ? <RoadsSidebar /> : activePanel === 'rivers' ? <RiversSidebar /> : activePanel === 'settlements' ? <SettlementsSidebar /> : activePanel === 'highlights' ? <HighlightsSidebar /> : activePanel === 'areas' ? <AreasSidebar /> : activePanel === 'elevation' ? <ElevationSidebar /> : <TerrainSidebar />}
            <TerrainViewCanvas ref={canvasHandleRef} />
          </div>
        </>
      )}
    </div>
  )
}

export default App
