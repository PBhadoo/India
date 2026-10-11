import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://india-explained.pages.dev',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
});
