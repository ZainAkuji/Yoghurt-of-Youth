import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

declare global {
  interface Window { fbq: (...args: any[]) => void; _fbq: any; }
}

// ---- Meta Conversions API (server-side, bypasses ad blockers) ----
async function sendCAPIEvent(eventName: string, customData: Record<string, any> = {}) {
  try {
    await fetch('/api/meta-capi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: eventName,
        user_agent: navigator.userAgent,
        event_source_url: window.location.href,
        custom_data: customData,
      }),
    });
  } catch (e) {
    console.error('CAPI request failed:', e);
  }
}

// Fire a server-side PageView once when the app loads
sendCAPIEvent('PageView');
// ------------------------------------------------------------------

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
