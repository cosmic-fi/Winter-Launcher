import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  base: './',
  server: {
    // Serve console files from src/views
    fs: {
      allow: ['..', './src/console']
    },
    // Add middleware to serve console files
    middlewareMode: false
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    // Only build main app, exclude console from vite processing
    rollupOptions: {
      input: {
        main: './index.html'
        // Remove console from vite processing - we'll handle it separately
      }
    }
  }
})
