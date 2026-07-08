import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const host = process.env.TAURI_DEV_HOST || 'localhost';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  clearScreen: false,
  server: {
    cors: true,
    host: host || false,
    port: 1420,
    strictPort: true,
    watch: {
      usePolling: true,
    },
  },
  envPrefix: ['TAURI_ENV_', 'TAURI'],
});
