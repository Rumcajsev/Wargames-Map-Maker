import { useRef, useCallback, useState, useEffect } from 'react'
import { useMapStore } from './store/mapStore'
import { SetupLanding } from './components/SetupLanding'
import { AreaSelectPanel } from './components/AreaSelectPanel'
import { MapView } from './components/MapView'
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
import { ImageAlignView } from './components/ImageAlignView'
import { TK } from './theme'
import { EditorTopBar } from './components/v2/EditorTopBar'
import { TerrainSidebarV2 } from './components/v2/TerrainSidebarV2'
import { RoadsSidebarV2 } from './components/v2/RoadsSidebarV2'
import { BottomDock } from './components/v2/BottomDock'
import { SetupLandingPage } from './components/v2/SetupLandingPage'
import { SetupWizard } from './components/v2/SetupWizard'

export function AppV2() {
  const { step, activePanel, undo, redo, generateStatus, generateProgress } = useMapStore()
  const canvasHandleRef = useRef<TerrainViewCanvasHandle>(null)
  const [presetsOpen, setPresetsOpen] = useState(false)
  const [setupPhase, setSetupPhase] = useState<'landing' | 'source-picker' | 'area-select'>('landing')
  // Always show the onboarding landing on fresh session load
  const [showLanding, setShowLanding] = useState(true)
  const [showWizard, setShowWizard] = useState(false)

  useEffect(() => {
    if (step === 'setup') setSetupPhase('landing')
  }, [step])

  // When step resets to 'setup' (e.g. resetToSetup from the editor), ensure
  // showWizard is true so the editor doesn't re-appear mid-generation when
  // the grid SSE event changes step → 'terrain' while showWizard is still false.
  useEffect(() => {
    if (step === 'setup' && !showLanding) setShowWizard(true)
  }, [step, showLanding])

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

  // Landing is always shown first on session start, regardless of persisted step
  if (showLanding) {
    return (
      <SetupLandingPage
        onNewMap={() => { setShowLanding(false); setShowWizard(true) }}
        onResume={() => setShowLanding(false)}
        onLoadFile={() => { /* TODO: file load */ setShowLanding(false) }}
      />
    )
  }

  if (showWizard || step === 'setup') {
    return (
      <SetupWizard
        onCancel={() => { setShowWizard(false); setShowLanding(true) }}
        onDone={() => setShowWizard(false)}
      />
    )
  }

  if (step === 'image-align') return <ImageAlignView />

  const sidebar = activePanel === 'terrain'     ? <TerrainSidebarV2 />
    : activePanel === 'display'     ? <DisplaySidebar />
    : activePanel === 'roads'       ? <RoadsSidebarV2 />
    : activePanel === 'rivers'      ? <RiversSidebar />
    : activePanel === 'settlements' ? <SettlementsSidebar />
    : activePanel === 'highlights'  ? <HighlightsSidebar />
    : activePanel === 'areas'       ? <AreasSidebar />
    : activePanel === 'elevation'   ? <ElevationSidebar />
    : <TerrainSidebar />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden', background: TK.paper, fontFamily: TK.sans, color: TK.ink }}>
      {presetsOpen && <PresetsPanel onClose={() => setPresetsOpen(false)} />}

      <EditorTopBar onExportPDF={handleExportPDF} />

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
