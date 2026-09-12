import React from 'react'
import ReactDOM from 'react-dom/client'
import AppShell from './AppShell'
import { installDevMock } from './devMock'
import './globals.css'

// Requires an explicit ?mock=1 in the URL — plainly opening this dev
// server's URL (e.g. http://localhost:5173, with no query string) must
// fall through to AppShell's own "no Electron bridge" message instead of
// silently landing in a fully-populated fake restaurant. That silent
// fallback used to trigger on nothing more than "window.dineiz is
// undefined," which is exactly what happens the moment anyone opens this
// URL directly instead of using the real Electron window — indistinguishable
// from the real app at a glance, confirmed to have actually confused a real
// user twice. Only ever meant to be opened with ?mock=1 deliberately, for
// exercising renderer screens without driving a native window.
// Dead-code-eliminated from production builds entirely regardless
// (import.meta.env.DEV is a build-time constant).
let usingMockBridge = false
if (
  import.meta.env.DEV &&
  typeof window.dineiz === 'undefined' &&
  new URLSearchParams(window.location.search).get('mock') === '1'
) {
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
