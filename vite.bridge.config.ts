import { defineConfig } from 'vite';

// Second build, on top of the ES library build in vite.config.ts: `src/shell/BreadcrumbBridge.js` runs
// in the Polarion shell window rather than in this library's bundle, so it cannot be an ES module and
// cannot be bundled into dist/index.js. It is emitted here as its own self-contained classic script,
// dist/breadcrumb-bridge.js, which a consuming extension copies into the folder Polarion serves its app
// from; BreadcrumbInjector loads it from there with a plain <script src>.
//
// `emptyOutDir: false` because vite.config.ts runs first and owns wiping dist/ - this build only adds
// one more file to it. Keep that order in the `build` script.
export default defineConfig({
  build: {
    lib: {
      entry: 'src/shell/BreadcrumbBridge.js',
      formats: ['iife'],
      // The script has no exports (it self-registers globalThis.SbbBreadcrumbBridge), so this name is
      // only the wrapper variable rollup needs for the iife format; nothing reads it.
      name: 'SbbBreadcrumbBridgeBundle',
      fileName: () => 'breadcrumb-bridge.js',
    },
    emptyOutDir: false,
  },
});
