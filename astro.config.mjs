import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
// https://astro.build/config
export default defineConfig({
  site: 'https://cekdulu.co.id',
vite: {
    plugins: [tailwindcss()],
  },

  integrations: [
    react(),
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname;
        return !path.startsWith('/p/') && !path.startsWith('/campaign') && !path.startsWith('/for-marketers/coming-soon');
      },
      serialize: (item) => {
        if (item.url !== 'https://cekdulu.co.id/' && item.url.endsWith('/')) {
          item.url = item.url.slice(0, -1);
        }
        return item;
      },
    }),
  ],

  redirects: {
    '/30-hari-tanpa-paylater': '/challenges/30-hari-tanpa-paylater',
    '/campaign': '/for-marketers',
    '/campaign/terms': '/for-marketers/terms',
    '/campaign/privacy': '/for-marketers/privacy',
  },
});