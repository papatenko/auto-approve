import React from 'react';
import { createRoot } from 'react-dom/client';
import '@/globals.css';
import { initTheme } from '@/lib/theme';
import { Options } from './Options';

initTheme();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>,
);
