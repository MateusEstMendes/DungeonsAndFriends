import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: 'prompt', manifestFilename: 'manifest.json', includeAssets: ['icons/*.png'],
    manifest: { id: '/', name: 'Dungeons & Friends', short_name: 'D&F', description: 'Sua mesa de aventura com amigos', lang: 'pt-BR',
      start_url: '/', scope: '/', display: 'standalone', orientation: 'any', theme_color: '#0f172a', background_color: '#09090b',
      icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }],
    },
    workbox: {
      cacheId: 'df-assets-v1.0.0', cleanupOutdatedCaches: true, maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      globPatterns: ['**/*.{js,css,html,png}'], globIgnores: ['enemies/**', 'items/**'],
      navigateFallback: '/index.html', navigateFallbackDenylist: [/^\/health/, /^\/api/, /^\/matchmake/, /^\/colyseus/],
      runtimeCaching: [
        { urlPattern: ({ url }) => /^\/(health|api|matchmake|colyseus)(\/|$)/.test(url.pathname), handler: 'NetworkOnly' },
        { urlPattern: ({ url }) => /\/(enemies|audio|icons|items)\/.*\.(webp|png|svg|webm|mp3|json)$/.test(url.pathname) || /\.(woff2?|ttf|otf)$/.test(url.pathname),
          handler: 'CacheFirst', options: { cacheName: 'df-media-v1.0.0', expiration: { maxEntries: 200, maxAgeSeconds: 30 * 86400 }, cacheableResponse: { statuses: [0, 200] } } },
      ],
    },
  })],
  server: { proxy: {
    '/health': 'http://localhost:2567', '/api': 'http://localhost:2567', '/matchmake': 'http://localhost:2567',
    '/colyseus': { target: 'ws://localhost:2567', ws: true, rewrite: path => path.replace(/^\/colyseus/, '') },
  } },
});
