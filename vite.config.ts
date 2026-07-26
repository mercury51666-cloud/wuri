import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      selfDestroying: false,
      // 커스텀 서비스워커(src/sw.ts)를 써서 Firebase Cloud Messaging
      // 백그라운드 푸시 처리를 워크박스 캐싱과 한 SW 안에서 함께 처리한다.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,ico,png,svg,webp,woff2}'],
        globIgnores: ['**/index.html'],
      },
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'WURI — 우리만의 공간',
        short_name: 'WURI',
        description: '친한 친구들과 함께하는 프라이빗 공간',
        theme_color: '#7c3aed',
        background_color: '#0d0d0d',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'ko',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
})
