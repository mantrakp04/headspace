import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import { playerBuild } from './player-build';

export default defineConfig({
  plugins: [playerBuild(), tanstackStart(), react(), nitro()],
  server: { host: '127.0.0.1', port: 4390, strictPort: true },
});
