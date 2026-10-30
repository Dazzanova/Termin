// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  security: {
    // Render terminates TLS and forwards plain HTTP, so Astro builds an `http`
    // request URL and its built-in origin check then rejects every same-origin
    // browser POST. Writes are guarded in src/middleware.ts and
    // src/lib/http/api.ts instead, where only the Origin host is compared and
    // the proxy cannot break it.
    checkOrigin: false,
  },
});
