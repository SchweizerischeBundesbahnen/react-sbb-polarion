import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

// Per-component subfolder derived from the test file name so references group by component as the suite
// grows, e.g. "SearchableSelect.visual.test.tsx" -> "SearchableSelect".
const componentDir = (testFileName: string): string => testFileName.split(/[\\/]/).pop()!.split('.')[0];

// Separate from vite.config.ts (the library build) on purpose: tests run in a real Chromium via
// Vitest browser mode, so behavior assertions see real CSS/layout and the visual layer
// (toMatchScreenshot) captures the components' actual look. Reference screenshots are committed and
// MUST be generated in the pinned Playwright Docker image (see test/README.md) so Windows-dev and
// Linux-CI produce identical pixels.
// The committed reference screenshots are pixel-locked to the pinned Playwright image, so the visual
// assertions are meaningful only there. scripts/docker-test.mjs sets PIXEL_REFERENCES=1 inside the
// container; everywhere else (a developer's macOS/Windows box, a plain CI runner) the visual suites
// skip themselves rather than failing on the host's font metrics - which shift both the antialiasing
// and the rendered element height, i.e. a red run that says nothing about the code.
const pixelReferences = process.env.PIXEL_REFERENCES === '1';

export default defineConfig({
  define: { __PIXEL_REFERENCES__: JSON.stringify(pixelReferences) },
  plugins: [react()],
  test: {
    // Tests live under test/, not co-located in src/.
    include: ['test/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./test/setup.ts'],
    coverage: {
      // Istanbul (source instrumented at Vite transform time), NOT v8: in browser mode the v8 provider
      // collects coverage via the browser's CDP and intermittently reports 0% depending on the
      // dep-optimization cache state ("Re-optimizing dependencies" runs). Istanbul is deterministic -
      // it injects counters into each module, independent of CDP - so the gate is stable. Only emitted
      // when a run passes --coverage (npm run test:coverage[:docker]).
      provider: 'istanbul',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      // Only report files actually imported by the run - do NOT synthesize 0%-entries for untouched
      // files. istanbul's uncovered-files pass (getCoverageMapForUncoveredFiles) intermittently crashes
      // in browser mode with "Coverage must be initialized with a path or an object"; disabling `all`
      // removes that code path entirely. Every RSP source file is imported by a test, so the reported
      // numbers are unchanged (the trade-off is only that a brand-new file no test imports would not
      // show up - add its test alongside it).
      all: false,
      // Score RSP's own hand-written code only.
      include: ['src/**'],
      exclude: [
        // Vendored, transitional foreign code (its own behavior suite covers it; not RSP-authored).
        'src/generic/**',
        // Type-only files - no runtime code to execute (v8 would report them as 0/0).
        'src/**/*.d.ts',
        'src/types.ts',
        'src/**/*.css',
        // Barrel re-exports only.
        'src/index.ts',
      ],
      // Every line and every function is executed by the suite, and the gate says so: a new branch of
      // code that no test reaches fails the run rather than quietly eroding a percentage.
      //
      // Statements and branches sit just below 100 on purpose. Four guards cannot be reached from a
      // test without rewriting the code they protect, so they are left honest and visible in the
      // report instead of being annotated away:
      //   - BreadcrumbInjector `!shellDocument?.head` - only true for a cross-origin top window, and
      //     the runner is same-origin with its own shell.
      //   - SearchableSelect `!element` and PropertiesEditor `!highlight` - refs that are always
      //     attached by the time the effect/handler runs; the check exists to satisfy the type, and
      //     replacing it with a non-null assertion would turn a no-op into a crash.
      //   - About `getAttribute('href') ?? ''` - the querySelector is `a[href^="#"]`, so the attribute
      //     is always there.
      // Raise these two floors if one of those guards ever becomes reachable.
      //
      // Behavior-only and full-suite give the same numbers (the visual tests render components the
      // behavior tests already exercise), so the gate holds for both the local behavior-only run and
      // the Docker full-suite run.
      thresholds: {
        lines: 100,
        functions: 100,
        statements: 99,
        branches: 98,
      },
    },
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      // Desktop viewport (Playwright's own default). These are Polarion desktop admin/editor surfaces,
      // not mobile-first, so we override Vitest browser mode's 414x896 mobile-ish default.
      instances: [{ browser: 'chromium', viewport: { width: 1280, height: 720 } }],
      expect: {
        toMatchScreenshot: {
          // A single expected screenshot per assertion, no -<browser>-<platform> suffix. The committed
          // reference is always the Linux one generated in the pinned Playwright Docker image (see
          // test/README.md and the `test:update` guard in package.json). Consequence: the visual
          // assertion only pixel-matches on Linux/Docker/CI; a bare Windows/macOS `npm test` will diff
          // on the screenshot (font antialiasing) even when the component is unchanged. Behavior
          // assertions still pass everywhere. (If we ever run more than one browser, reintroduce
          // `browserName`.)
          resolveScreenshotPath: ({ root, arg, ext, testFileName }) =>
            `${root}/test/expected/${componentDir(testFileName)}/${arg}${ext}`,
          // Mismatch diff/actual artifacts are transient - keep them out of test/expected and out of git.
          resolveDiffPath: ({ root, arg, ext, testFileName }) =>
            `${root}/test/__diff__/${componentDir(testFileName)}/${arg}${ext}`,
        },
      },
    },
  },
});
