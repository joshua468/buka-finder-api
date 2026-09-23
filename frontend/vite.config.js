import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Dev proxy: the consumer talks to /api/v1 on this SAME origin during `npm
// run dev`. Point VITE_API_BASE elsewhere (e.g. the deployed URL) in prod.
const apiTarget = process.env.VITE_API_BASE || 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/v1': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
})