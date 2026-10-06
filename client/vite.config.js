import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// API on :8787, Vite on :5173. Client talks to /api (proxied in dev,
// same-origin in the single-process production fallback).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
});
