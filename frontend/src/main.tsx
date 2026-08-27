import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/inter/cyrillic-400.css'
import '@fontsource/inter/cyrillic-500.css'
import '@fontsource/inter/cyrillic-600.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import { AppProviders } from './app/providers'
import { markBootResourcesReady, waitForBootResources } from './app/boot'
import './app/config'
import './index.css'
import './register-service-worker'
import { preloadEmptyStateLotties } from './shared/ui/empty-state-lotties'

void startApp()

async function startApp() {
  void Promise.allSettled([
    waitForBootResources(),
    preloadEmptyStateLotties(),
  ]).then(markBootResourcesReady)

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppProviders />
    </StrictMode>,
  )
}
