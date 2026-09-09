import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/',
  publicDir: 'assets',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
  server: { host: '127.0.0.1', port: 4383, strictPort: true },
});
