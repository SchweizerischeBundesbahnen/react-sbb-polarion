import { defineConfig } from 'vite';

// Third build, next to vite.config.ts (the ES library) and vite.bridge.config.ts. Like the breadcrumb
// bridge, src/shell/DleToolbarStarter.js runs outside this library's bundle: an extension's starter.js
// loads it with a plain <script> into the Polarion document editor, so it must be a classic script and
// gets its own self-contained file, dist/dle-toolbar-starter.js.
//
// Its dleToolbar.css is imported `?inline` and bundled into that one file, so there is no stylesheet
// to serve alongside it. cssCodeSplit: false keeps Vite from emitting a separate .css asset anyway.
//
// `emptyOutDir: false` because vite.config.ts runs first and owns wiping dist/. Keep that order in the
// `build` script.
export default defineConfig({
  build: {
    lib: {
      entry: 'src/shell/DleToolbarStarter.js',
      formats: ['iife'],
      // The script has no exports (it self-registers window.GenericDleToolbarStarter), so this name is
      // only the wrapper variable rollup needs for the iife format; nothing reads it.
      name: 'GenericDleToolbarStarterBundle',
      fileName: () => 'dle-toolbar-starter.js',
    },
    cssCodeSplit: false,
    emptyOutDir: false,
  },
});
