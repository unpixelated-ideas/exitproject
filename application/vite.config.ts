import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const proxy = {
  '/board-api': {
    target: 'http://127.0.0.1:8787',
    rewrite: (path: string) => path.replace(/^\/board-api/, ''),
  },
};

export default defineConfig({
  base: './',
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
});
