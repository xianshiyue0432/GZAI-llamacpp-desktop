import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import TerminalStandalone from './components/TerminalStandalone'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TerminalStandalone />
  </StrictMode>,
)
