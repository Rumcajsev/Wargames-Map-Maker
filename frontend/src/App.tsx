import { useEffect } from 'react'
import { useMapStore } from './store/mapStore'
import { SetupPanel } from './components/SetupPanel'
import { MapView } from './components/MapView'
import { TopBar } from './components/TopBar'
import { TerrainSidebar } from './components/TerrainSidebar'
import { TerrainView } from './components/TerrainView'

function App() {
  const { step, undo, redo } = useMapStore()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {step === 'setup' ? (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <SetupPanel />
          <MapView />
        </div>
      ) : (
        <>
          <TopBar />
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <TerrainSidebar />
            <TerrainView />
          </div>
        </>
      )}
    </div>
  )
}

export default App
