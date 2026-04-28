import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom'; // 1. Ye import karein
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {/* 2. BrowserRouter se wrap karein aur basename dein */}
      <BrowserRouter basename="/RaheeCards">
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
