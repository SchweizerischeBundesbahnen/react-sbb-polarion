import js from '@eslint/js';
import globals from 'globals';
import { polarionEslintConfig } from './eslint/index.js';

// Built from the shared config this library publishes (eslint/index.js), so RSP lints exactly the way
// the extensions do. Only what is RSP's own comes on top.
export default polarionEslintConfig({
  // Vendored from ch.sbb.polarion.extension.generic (never linted; re-copy to update, keeping the local
  // patches listed in .greptile/rules.md), and the test artifacts.
  ignores: ['src/generic', 'test/expected', 'test/__diff__', 'test/__screenshots__', '.vitest'],
  configs: [
    {
      files: ['src/**/*.{ts,tsx}'],
      rules: {
        // Modal's content <section> takes the focus on purpose (#136): it is the dialog's only scroller,
        // and the keyboard scrolls only the focused element's scrollable ancestor. `roles` cannot allow
        // it, because it matches an explicit role attribute and a <section>'s region role is implicit.
        // The Modal holds the only <section> here; axe still checks any other at runtime.
        'jsx-a11y/no-noninteractive-tabindex': [
          'error',
          { tags: ['section'], roles: ['tabpanel'], allowExpressionValues: true },
        ],
      },
    },
    // Plain JS/ESM (the configs, the shared ESLint config, the docker-test wrapper).
    {
      files: ['**/*.{js,mjs}'],
      extends: [js.configs.recommended],
      languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        globals: { ...globals.node },
      },
    },
    // Scripts this library ships to run in a Polarion page instead of in its own bundle
    // (BreadcrumbBridge.js, DleToolbarStarter.js). They see the browser globals rather than Node's, so
    // neither of the blocks above describes them. They are *delivered* as classic <script> files, but
    // the sources are parsed as modules because Vite bundles them (DleToolbarStarter imports its CSS
    // `?inline`); each build emits a self-contained IIFE.
    {
      files: ['src/shell/**/*.js'],
      extends: [js.configs.recommended],
      languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        globals: { ...globals.browser, top: 'readonly' },
      },
    },
  ],
});
