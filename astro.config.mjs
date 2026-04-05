import { defineConfig } from 'astro/config';

const site = 'https://igophy.github.io';

export default defineConfig({
  site,
  output: 'static',
  server: {
    host: true
  }
});
