import { useRef, useCallback, useState, useEffect } from 'react'
import { useMapStore } from './store/mapStore'
import { PresetsPanel } from './components/PresetsPanel'
import { TerrainSidebar } from './components/TerrainSidebar'
import { RiversSidebarV2 } from './components/v2/RiversSidebarV2'
import { DisplaySidebar } from './components/DisplaySidebar'
import { SettlementsSidebar } from './components/SettlementsSidebar'
import { HighlightsSidebar } from './components/HighlightsSidebar'
import { AreasSidebar } from './components/AreasSidebar'
import { ElevationSidebar } from './components/ElevationSidebar'
import { TerrainViewCanvas, type TerrainViewCanvasHandle } from './components/TerrainViewCanvas'
import { ImageAlignView } from './components/ImageAlignView'
import { TK } from './theme'
import { EditorTopBar } from './components/v2/EditorTopBar'
import { TerrainSidebarV2 } from './components/v2/TerrainSidebarV2'
import { RoadsSidebarV2 } from './components/v2/RoadsSidebarV2'
import { OverlaysSidebarV2 } from './components/v2/OverlaysSidebarV2'
import { BottomDock } from './components/v2/BottomDock'
import { SetupLandingPage } from './components/v2/SetupLandingPage'
import { SetupWizard } from './components/v2/SetupWizard'

export function AppV2() {
  const { step, activePanel, undo, redo, generateStatus, generateProgress } = useMapStore()
  const canvasHandleRef = useRef<TerrainViewCanvasHandle>(null)
  const [presetsOpen, setPresetsOpen] = useState(false)
  const [screen, setScreen] = useState<'landing' | 'wizard' | 'editor'>('landing')

  // If the store resets step to 'setup' while in the editor (e.g. mid-generation SSE flow),
  // treat it as wizard so the editor doesn't render against an empty store.
  const activeScreen = screen === 'editor' && step === 'setup' ? 'wizard' : screen

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  const handleExportPDF = useCallback(async () => {
    const sheets = await canvasHandleRef.current?.exportSheets()
    if (!sheets) return

    const toB64 = (blob: Blob): Promise<string> => new Promise((res, rej) => {
      const r = new FileReader()
      r.onload = () => res((r.result as string).split(',')[1])
      r.onerror = rej
      r.readAsDataURL(blob)
    })

    const sheetPayloads = await Promise.all(sheets.map(async s => ({
      image_b64: await toB64(s.blob),
      paper_mm: s.paperMm,
    })))

    const res = await fetch('/api/export/sheets-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheets: sheetPayloads }),
    })
    if (!res.ok) return
    const pdfBlob = await res.blob()
    const url = URL.createObjectURL(pdfBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'map.pdf'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  if (activeScreen === 'landing') {
    return (
      <SetupLandingPage
        onNewMap={() => setScreen('wizard')}
        onResume={() => setScreen('editor')}
        onLoadFile={() => { /* TODO: file load */ setScreen('editor') }}
      />
    )
  }

  if (activeScreen === 'wizard') {
    return (
      <SetupWizard
        onCancel={() => setScreen('landing')}
        onDone={() => setScreen('editor')}
      />
    )
  }

  if (step === 'image-align') return <ImageAlignView />

  const sidebar = activePanel === 'terrain'     ? <TerrainSidebarV2 />
    : activePanel === 'display'     ? <DisplaySidebar />
    : activePanel === 'roads'       ? <RoadsSidebarV2 />
    : activePanel === 'rivers'      ? <RiversSidebarV2 />
    : activePanel === 'settlements' ? <SettlementsSidebar />
    : activePanel === 'highlights'  ? <OverlaysSidebarV2 />
    : activePanel === 'areas'       ? <AreasSidebar />
    : activePanel === 'elevation'   ? <ElevationSidebar />
    : <TerrainSidebar />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden', background: TK.paper, fontFamily: TK.sans, color: TK.ink }}>
      {presetsOpen && <PresetsPanel onClose={() => setPresetsOpen(false)} />}

      <EditorTopBar onExportPDF={handleExportPDF} onGoHome={() => setScreen('landing')} />

      {/* Progress bar */}
      {generateStatus === 'loading' && generateProgress && (
        <div style={{ height: 2, background: TK.paper2, flexShrink: 0 }}>
          <div style={{ height: '100%', width: `${generateProgress.progress}%`, background: TK.rust, transition: 'width 0.25s ease' }} />
        </div>
      )}

      {/* Canvas + floating sidebar */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Canvas fills the full area */}
        <div style={{ width: '100%', height: '100%', display: 'flex' }}>
          <TerrainViewCanvas ref={canvasHandleRef} surroundColor="#B7B0A6" />
        </div>
        {/* Sidebar floats over the canvas */}
        <div style={{ position: 'absolute', top: 16, left: 16, bottom: 16, zIndex: 10, pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto', height: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.13), 0 1px 6px rgba(0,0,0,0.07)' }}>
            {sidebar}
          </div>
        </div>

        {/* Bottom dock */}
        <BottomDock canvasRef={canvasHandleRef} />
      </div>
    </div>
  )
}
