import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  // Never inline assets as data: URIs; the content security policy allows only same-origin fonts.
  build: { outDir: '../dist', emptyOutDir: true, assetsInlineLimit: 0 },
  server: { proxy: { '/api': 'http://127.0.0.1:3000' } },
});
