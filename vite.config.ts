import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// El `base` NO va fijo acá: se pasa por build (GitHub Pages: `--base=/pwa_finanzas/`
// en `predeploy`; VPS: sin flag). El plugin PWA lo toma de ahí para el manifest y el SW.
// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Finanzas',
        short_name: 'Finanzas',
        description: 'Gestión de finanzas personales, sin conexión',
        theme_color: '#1D1C1A',
        background_color: '#F3EFE6',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
})
