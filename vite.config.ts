import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    // Remove crossorigin for Electron compatibility
    {
      name: 'remove-crossorigin',
      transformIndexHtml(html: string) {
        return html.replace(/ crossorigin/g, '');
      }
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Study Manager',
        short_name: 'StudyApp',
        description: 'Planner de estudos com roadmap personalizado para cibersegurança',
        start_url: '/',
        display: 'standalone',
        background_color: '#0a0a0f',
        theme_color: '#00e5ff',
        orientation: 'portrait-primary',
        lang: 'pt-BR',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Cache pages visited during session
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  // Use './' for Electron (file:// protocol), '/' for web/PWA deploy
  base: process.env.ELECTRON_BUILD ? './' : '/',
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5173,
  },
})

