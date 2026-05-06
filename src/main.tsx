import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Tone from 'tone'
import './index.css'
import App from './App.tsx'

// Use large audio buffers and generous scheduling headroom to prevent glitches.
// 'playback' latencyHint gives ~1024-sample buffers vs the default 256-sample 'interactive'.
// lookAhead: 0.3 means events are queued 300ms before they fire, so JS hiccups don't matter.
Tone.setContext(new Tone.Context({ latencyHint: 'playback', lookAhead: 0.5 }));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
