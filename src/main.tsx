import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ensureSrdData } from './data/loadSrd.ts'

ensureSrdData().catch((err: unknown) => console.error('SRD data load failed:', err))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
