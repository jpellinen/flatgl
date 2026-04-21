import { defineConfig } from 'tsup';
import path from 'path';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  loader: {
    '.glsl': 'text',
    '.obj': 'text',
  },
  esbuildOptions(options) {
    options.alias = {
      '@': path.resolve('./src'),
    };
  },
});
