import React from 'react';
import { createRoot } from 'react-dom/client';
import '@/globals.css';
import { initTheme } from '@/lib/theme';
import { Popup } from './Popup';

initTheme();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
);
