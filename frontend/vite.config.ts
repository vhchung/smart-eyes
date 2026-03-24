import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3113,
    proxy: {
      '/api': {
        target: 'http://localhost:8118',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/streaming/ws': {
        target: 'http://localhost:8118',
        ws: true,
      },
      '/snapshot-files': {
        target: 'http://localhost:8118',
        changeOrigin: true,
      },
    },
  },
});
