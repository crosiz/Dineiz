import React from 'react'
import ReactDOM from 'react-dom/client'
import AppShell from './AppShell'
import { installDevMock } from './devMock'
import './globals.css'

// Only ever true when this page was opened directly in a plain browser tab
// (e.g. http://localhost:5173) instead of the real Electron window — the
// real app always has a genuine window.dineiz bridge, so this branch never
// runs there and is dead-code-eliminated from production builds entirely
// (import.meta.env.DEV is a build-time constant). Exists purely so this
// screen's UI can be exercised without driving a native window; it is not,
// and must never be mistaken for, a real installation.
let usingMockBridge = false
if (import.meta.env.DEV && typeof window.dineiz === 'undefined') {
  installDevMock()
  usingMockBridge = true
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {usingMockBridge && (
      <div className="fixed inset-x-0 top-0 z-[9999] bg-black py-1 text-center text-xs font-bold tracking-wide text-yellow-300">
        ⚠ DEV MODE — test data only, not a real installation
      </div>
    )}
    <AppShell />
  </React.StrictMode>
)
