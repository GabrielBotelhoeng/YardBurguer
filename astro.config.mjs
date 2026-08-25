// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Landing estatica: zero JS por padrao. O motion carrega num unico bundle
// com client:visible na cena que precisa dele.
export default defineConfig({
  site: 'https://yardburguer.com.br',
  vite: {
    plugins: [tailwindcss()],
  },
  image: {
    // AVIF primeiro, WebP como fallback — decidido em config/tech-stack.md
    responsiveStyles: true,
  },
  build: {
    inlineStylesheets: 'auto',
  },
});
