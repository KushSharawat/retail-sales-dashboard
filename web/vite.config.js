import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from https://kushsharawat.github.io/retail-sales-dashboard/ in production
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/retail-sales-dashboard/' : '/',
}))
