/**
 * Vite config for standalone app build (Render deployment).
 *
 * Unlike the default vite.config.ts (library mode for embedding),
 * this produces dist/index.html + bundled JS/CSS for serving as a SPA.
 */
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    // No build.lib — standard app build that processes index.html
    // No rollupOptions.external — bundle React for standalone use
    cssCodeSplit: false,
  },
  server: {
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' http://localhost:8000; frame-ancestors 'none'; form-action 'self'; base-uri 'self'",
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    },
  },
});
