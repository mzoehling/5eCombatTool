/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/5eCombatTool/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      // The app registers the service worker itself (see UpdateBanner.tsx) so
      // it can show an "update available" prompt instead of reloading blind.
      injectRegister: false,
      includeAssets: ['apple-touch-icon.png'],
      workbox: {
        // App shell + bundled SRD data — fully offline from first launch
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json,woff2}'],
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
      },
      manifest: {
        name: '5e Combat Tool',
        short_name: '5eCombat',
        description: 'Offline-first D&D 5e (2024) initiative & battle tracker',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#16161e',
        background_color: '#16161e',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
  },
})
