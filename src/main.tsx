import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'

// /descent (or ?v=terrain) -> SUMMIT TO BUNKER; default -> the index site.
const isTerrain =
  window.location.pathname === '/descent' ||
  new URLSearchParams(window.location.search).get('v') === 'terrain'
const SiteApp = lazy(() => import('./site/SiteApp.tsx'))
const TerrainApp = lazy(() => import('./terrain/TerrainApp.tsx'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>{isTerrain ? <TerrainApp /> : <SiteApp />}</Suspense>
  </StrictMode>,
)
