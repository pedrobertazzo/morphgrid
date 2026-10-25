import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  plugins: [react()],
  resolve: { alias: { morphgrid: fileURLToPath(new URL('../src/index.ts', import.meta.url)) } },
  build: { outDir: '../demo-dist', emptyOutDir: true },
});
