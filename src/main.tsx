import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { sendCAPIEvent } from "./capi";

declare global {
  interface Window {
    fbq: (...args: any[]) => void;
    _fbq: any;
    __fbPageViewId?: string;
  }
}

// ---- Meta Conversions API (server-side, bypasses ad blockers) ----
async function sendCAPIEvent(
  eventName: string,
  customData: Record<string, any> = {},
  eventId?: string
) {
  try {
    await fetch('/api/meta-capi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: eventName,
        event_id: eventId,
        user_agent: navigator.userAgent,
        event_source_url: window.location.href,
        custom_data: customData,
      }),
    });
  } catch (e) {
    console.error('CAPI request failed:', e);
  }
}

// Server-side PageView, sharing the pixel's ID (set in index.html) so it dedupes
sendCAPIEvent("PageView", { eventId: window.__fbPageViewId });
// ------------------------------------------------------------------

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
