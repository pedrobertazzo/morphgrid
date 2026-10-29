import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  plugins: [react()],
  resolve: { alias: { morphgrid: fileURLToPath(new URL('../src/index.ts', import.meta.url)) } },
  build: {
    outDir: '../demo-dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        auto: fileURLToPath(new URL('./auto.html', import.meta.url)),
      },
    },
  },
});
