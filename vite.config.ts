import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

function firebaseMessagingSw(mode: string): Plugin {
  return {
    name: 'firebase-messaging-sw',
    config(_config, { mode: configMode }) {
      const env = loadEnv(configMode || mode, process.cwd(), '')
      const firebaseConfig = {
        apiKey: env.VITE_FIREBASE_API_KEY,
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: env.VITE_FIREBASE_APP_ID,
      }
      const content = `importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js');
firebase.initializeApp(${JSON.stringify(firebaseConfig)});
firebase.messaging();
`
      mkdirSync('public', { recursive: true })
      writeFileSync(join('public', 'firebase-messaging-sw.js'), content)
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [
    firebaseMessagingSw(mode),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      selfDestroying: false,
      includeAssets: ['favicon.svg', 'icons/*.png', 'firebase-messaging-sw.js'],
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
}))
