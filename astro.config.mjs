import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import AstroPWA from '@vite-pwa/astro';
import remarkGfm from 'remark-gfm';
import remarkWikiLink from 'remark-wiki-link';

export default defineConfig({
  site: 'https://anemora-viewer.pages.dev',
  trailingSlash: 'never',
  integrations: [
    react(),
    tailwind({ applyBaseStyles: false }),
    AstroPWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Viewer',
        short_name: 'Viewer',
        description: 'Mobile viewer',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/offline',
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Precache only the shell + static assets. HTML pages and images are
        // cached at runtime via runtimeCaching (below). This keeps the initial
        // PWA install well under iOS's ~50MB Service Worker limit.
        globPatterns: ['index.html', '404.html', 'offline/index.html', 'manifest.webmanifest', 'icons/**', '_astro/**/*.{js,css,woff2}'],
        navigateFallbackDenylist: [/^\/thumbs/, /^\/originals/, /^\/pagefind/, /^\/sw\.js$/, /^\/workbox-/],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
              networkTimeoutSeconds: 5,
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|webp|svg|gif)$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'images', expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 } },
          },
          {
            urlPattern: /\.(?:js|css|woff2)$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'static-assets' },
          },
          {
            urlPattern: /\/(?:thumbs|originals)\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'content-images', expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 14 } },
          },
        ],
      },
    }),
  ],
  markdown: {
    remarkPlugins: [
      remarkGfm,
      [remarkWikiLink, { aliasDivider: '|', hrefTemplate: (slug) => `/docs/${slug}` }],
    ],
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' } },
  },
  vite: {
    server: { fs: { allow: ['..'] } },
  },
});
