import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Frontend lives in web/, builds to dist/ (Netlify publish dir). Static site: no server, data stays in the browser.
export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: { outDir: '../dist', emptyOutDir: true },
  server: { port: 5173, strictPort: true },
})
