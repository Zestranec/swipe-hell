import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // '/swipe-hell/' in production so GitHub Pages serves assets from the right path.
  // '/' in dev so the local dev server works without a sub-path prefix.
  base: process.env.NODE_ENV === 'production' ? '/swipe-hell/' : '/',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
  },
});
