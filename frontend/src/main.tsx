import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppV2 } from './AppV2.tsx'

const useV2 = new URLSearchParams(location.search).has('v2')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {useV2 ? <AppV2 /> : <App />}
  </StrictMode>,
)
