import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ErrorBoundary } from './components/Shared/ErrorBoundary'

// Surface uncaught errors that happen outside React's render cycle
// (e.g. during bootstrap) so they aren't a silent blank screen.
window.addEventListener('error', (e) => {
  const msg = e.error?.message || e.message || 'Unknown error'
  if (msg === 'ResizeObserver loop' || msg.startsWith('ResizeObserver')) return
  showGlobalError(msg)
})
window.addEventListener('unhandledrejection', (e) => {
  const msg = e.reason?.message || String(e.reason) || 'Unhandled promise rejection'
  showGlobalError(msg)
})

function showGlobalError(message: string) {
  const el = document.getElementById('root-error')
  if (el) {
    el.style.display = 'block'
    el.textContent = `Runtime error: ${message}`
    return
  }
  const div = document.createElement('div')
  div.id = 'root-error'
  div.style.cssText =
    'position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#ff6b6b;color:#fff;padding:8px 12px;font:12px monospace;white-space:pre-wrap'
  div.textContent = `Runtime error: ${message}`
  document.body.appendChild(div)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
