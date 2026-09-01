import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
// https://astro.build/config
export default defineConfig({
  site: 'https://cekdulu.my.id',
  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [
    react(),
    sitemap({
      filter: (page) => page !== 'https://cekdulu.my.id/calculator/',
      serialize: (item) => {
        if (item.url !== 'https://cekdulu.my.id/' && item.url.endsWith('/')) {
          item.url = item.url.slice(0, -1);
        }
        return item;
      },
    }),
  ]
});