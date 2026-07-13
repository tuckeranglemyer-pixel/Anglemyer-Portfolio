import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import SiteApp from './site/SiteApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SiteApp />
  </StrictMode>,
)
