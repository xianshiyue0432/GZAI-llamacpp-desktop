import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import GZAIStudio from './components/GZAIStudio'

function PopoutApp() {
  const params = new URLSearchParams(window.location.search)
  const cwd = params.get('cwd') || undefined
  return <GZAIStudio cwd={cwd} onClose={() => window.close()} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PopoutApp />
  </StrictMode>,
)
