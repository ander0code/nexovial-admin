import {resolve} from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {'@': resolve(__dirname, './src')},
  },
  server: {
    // Puerto propio de NexoVial — 5173 está ocupado por otros proyectos
    port: 5377,
    strictPort: true,
  },
});
