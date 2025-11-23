import React from 'react';
import ReactDOM from 'react-dom/client';
import AuthGate, { ToastProvider } from './AuthGate';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ToastProvider>
      <AuthGate />
    </ToastProvider>
  </React.StrictMode>
);
