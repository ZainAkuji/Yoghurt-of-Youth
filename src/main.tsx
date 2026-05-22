import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Meta Pixel Base Code
const pixelId = import.meta.env.VITE_META_PIXEL_ID || '1639585477324656';

if (typeof window !== 'undefined') {
  !(function (f: any, b: any, e: any, v: any, n: any, t: any, s: any) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = '2.0';
    n.queue = [];
    t = b.createElement(e);
    t.async = !0;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode?.insertBefore(t, s);
  })(
    window,
    document,
    'script',
    'https://connect.facebook.net/en_US/fbevents.js'
  );

  window.fbq('init', pixelId);
  window.fbq('track', 'PageView');
}

const el = document.getElementById('root')!;
createRoot(el).render(<App />);
