import React from 'react'
import ReactDOM from 'react-dom/client'
import AppShell from './AppShell'
import { installDevMock } from './devMock'
import './globals.css'

if (import.meta.env.DEV && typeof window.dineiz === 'undefined') {
  installDevMock()
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppShell />
  </React.StrictMode>
)
