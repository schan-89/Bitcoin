import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/favicon-16.png', 'icons/favicon-32.png'],
      manifest: {
        name: '가늠자 · BTC 기준선 대시보드',
        short_name: '가늠자',
        description: '비트코인/멀티자산 기준선 기반 분석 대시보드 — 매매를 추천하지 않고 현재 구간과 다음 확인 지점만 보여줍니다.',
        lang: 'ko',
        start_url: '/Bitcoin/',
        scope: '/Bitcoin/',
        display: 'standalone',
        background_color: '#0b0b12',
        theme_color: '#7e14ff',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Real-time BTC/asset prices must never be served stale from cache;
        // only precache the built app shell, let network calls to Binance
        // pass straight through.
        globPatterns: ['**/*.{js,css,svg,png,ico}'],
        // vite-plugin-pwa's default binds every navigation to a *fixed*
        // precached index.html (cache-first, no network attempt at all) —
        // after a redeploy that shell keeps pointing at now-deleted hashed
        // asset files until the whole SW update/activate/reload cycle
        // completes, which is exactly the "blank page after deploy" bug.
        // Disable that fixed binding and use NetworkFirst for navigations
        // instead, so every successful page open fetches the current
        // index.html directly; the cached copy is only a same-origin
        // fallback for the rare case the network request itself fails.
        navigateFallback: undefined,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'html-shell', networkTimeoutSeconds: 3 },
          },
        ],
      },
    }),
  ],
  // GitHub Pages serves this project from /Bitcoin/, so built asset URLs
  // need that prefix instead of the default root-relative paths.
  base: '/Bitcoin/',
})
