import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Library build: emit a single ESM bundle to dist/. React (and the JSX runtime) are kept external
// so the consuming app supplies the one and only React instance at runtime (see peerDependencies).
// `sonner` is external for the same reason (the Toaster host wraps the app's single sonner instance).
export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => 'index.js',
      // Emit the bundled component CSS as dist/style.css (consumers import it once).
      cssFileName: 'style',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'sonner'],
    },
    // Inline all bundled assets (the control-token SVG icons) as base64 into style.css, so the
    // emitted stylesheet is fully self-contained - no separate asset files to serve alongside it.
    assetsInlineLimit: () => true,
    emptyOutDir: true,
  },
});
