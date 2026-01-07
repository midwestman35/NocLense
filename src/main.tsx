import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { loadServiceMappings } from './utils/messageCleanup'
import { Analytics } from '@vercel/analytics/react'

// Load service mappings before rendering
loadServiceMappings().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
      <Analytics />
    </StrictMode>,
  )
});
