import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import './styles.css'

// Guard the mount point: if #root is missing (e.g. a stale index.html is being
// served), throwing here with a clear message beats the browser's opaque
// "null is not an object" on createRoot(null).
const container = document.getElementById('root')
if (!container) {
  document.body.innerHTML =
    '<p style="font-family:sans-serif;padding:2rem">BookQuiz failed to start: missing #root element. The page being served may be out of date — hard-refresh (Ctrl/Cmd+Shift+R).</p>'
} else {
  createRoot(container).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  )
}
