import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ensureSrdData } from './data/loadSrd.ts'
import { ViewerApp } from './features/playerView/ViewerApp.tsx'

// `#/play/{code}` renders the read-only Player View instead of the DM app
const playMatch = location.hash.match(/^#\/play\/([A-Za-z0-9]+)$/)

if (!playMatch) {
  ensureSrdData().catch((err: unknown) => console.error('SRD data load failed:', err))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>{playMatch ? <ViewerApp code={playMatch[1]} /> : <App />}</StrictMode>,
)
