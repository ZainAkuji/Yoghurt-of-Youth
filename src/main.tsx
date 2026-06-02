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

// Server-side PageView, sharing the pixel's ID (set in index.html) so it dedupes
sendCAPIEvent("PageView", { eventId: window.__fbPageViewId });

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
