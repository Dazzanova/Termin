// @ts-check
import { defineConfig } from 'astro/config';
import { devWriteApi } from './src/dev/write-api.ts';

// https://astro.build/config
export default defineConfig({
  integrations: [devWriteApi()],
});
