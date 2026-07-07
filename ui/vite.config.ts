import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// Builds the extension's popup and options pages. `base: './'` keeps asset
// URLs relative so they resolve inside chrome-extension:// / moz-extension://.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  resolve: {
    alias: { '@': path.resolve(rootDir, 'src') },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: path.resolve(rootDir, 'popup.html'),
        options: path.resolve(rootDir, 'options.html'),
      },
    },
  },
});
