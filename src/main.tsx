import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary, TestErrorThrower } from './components/ErrorBoundary.tsx';
import { setDbAdapter } from './lib/db.ts';
import { createIrisAdapter } from './lib/irisAdapter.ts';
import './index.css';

// Detect Iris launch params — if present, use the Iris API instead of IndexedDB
const params = new URLSearchParams(window.location.search);
const apiUrl = params.get('apiUrl');
const token = params.get('token');
const setId = params.get('setId');

if (apiUrl && token && setId) {
  setDbAdapter(createIrisAdapter(apiUrl, token, setId));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <TestErrorThrower />
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
