import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Same origin for app, API and Swagger UI, so "Try it out" sends the session cookie (KB-A3)
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    proxy: { '/api': 'http://backend:3000', '/docs': 'http://swagger:8080' },
  },
})
