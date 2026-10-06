import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// Apply the saved theme before React paints to avoid a light-theme flash on reload.
try {
  document.documentElement.dataset.theme = window.localStorage.getItem('finance-manager-theme') === 'dark' ? 'dark' : 'light';
} catch {
  document.documentElement.dataset.theme = 'light';
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found in DOM');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
