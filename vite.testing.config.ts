import { defineConfig } from 'vite';

// Third build, on top of the ES library build in vite.config.ts: the test helpers the extensions import
// as `@sbb-polarion/react-sbb-polarion/testing`. A separate entry keeps axe-core out of dist/index.js, and
// axe-core stays external because it is an optional peer dependency, installed by the consumer's tests.
//
// `emptyOutDir: false` because vite.config.ts runs first and owns wiping dist/. Keep that order in the
// `build` script.
export default defineConfig({
  build: {
    lib: {
      entry: 'src/testing/index.ts',
      formats: ['es'],
      fileName: () => 'testing.js',
    },
    rollupOptions: {
      external: ['axe-core'],
    },
    emptyOutDir: false,
  },
});
