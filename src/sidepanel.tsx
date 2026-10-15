import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './sidebar/App'
import './styles/sidebar.css'

/**
 * A long-lived port serves two purposes: the worker learns when this panel is
 * closed, so it can drop the queue, and the open connection keeps the worker
 * from being shut down during the long waits while Flow renders.
 */
const port = chrome.runtime.connect({ name: 'sidepanel' })
const keepAlive = window.setInterval(() => {
  try {
    port.postMessage({ type: 'keepalive' })
  } catch {
    window.clearInterval(keepAlive)
  }
}, 20000)

port.onDisconnect.addListener(() => window.clearInterval(keepAlive))

createRoot(document.getElementById('root')!).render(<App />)
