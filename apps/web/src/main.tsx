import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';

async function start() {
  // No modo demonstração (GitHub Pages) a API é simulada no navegador pelo MSW
  if (import.meta.env.VITE_DEMO === 'true') {
    const { worker } = await import('./mocks/browser');
    await worker.start({
      serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
      onUnhandledRequest: 'bypass',
      quiet: true,
    });
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void start();
