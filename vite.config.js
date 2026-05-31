import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// On `vite build` the app is published to GitHub Pages at
// https://<user>.github.io/bookquiz/, so it must be built with that base path.
// In dev it stays at root. Override with BASE_PATH if the repo name differs.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? process.env.BASE_PATH || '/bookquiz/' : '/',
  plugins: [react()],
}))
