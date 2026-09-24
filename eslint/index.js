import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/*
 * The ESLint setup the extensions' React apps share, published as
 * `@sbb-polarion/react-sbb-polarion/eslint-config`. Shipped as source, not bundled: ESLint loads it in Node.
 * The plugins it imports are optional peer dependencies, installed by the consuming extension.
 *
 * eslint-plugin-jsx-a11y declares peers only up to ESLint 9, so a consumer on ESLint 10 needs this in its
 * own package.json (npm applies overrides only in the root project), until upstream supports ESLint 10:
 *   "overrides": { "eslint-plugin-jsx-a11y": { "eslint": "$eslint" } }
 *   https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/issues/1075
 *
 * Usage, with the extension's own blocks passed in:
 *   export default polarionEslintConfig({ ignores: ['test/expected'], configs: [{ files: [...], rules: {...} }] });
 * They go before Prettier's rule set, which has to come last: a recommended set added after it, such as
 * js.configs.recommended, would switch formatting rules like no-unexpected-multiline back on.
 */
export function polarionEslintConfig({ appFiles = ['src/**/*.{ts,tsx}'], ignores = [], configs = [] } = {}) {
  return defineConfig(
    { ignores: ['dist', 'node_modules', 'coverage', ...ignores] },
    // TypeScript + React sources.
    {
      files: ['**/*.{ts,tsx}'],
      extends: [js.configs.recommended, ...tseslint.configs.recommended],
      plugins: { 'react-hooks': reactHooks },
      languageOptions: {
        ecmaVersion: 2022,
        globals: { ...globals.browser, ...globals.node },
      },
      rules: {
        // eslint-plugin-react-hooks recommended set (declared explicitly - the plugin's shipped flat config
        // uses a legacy string-array `plugins` key that ESLint 10 rejects when spread directly).
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'warn',
      },
    },
    // Accessibility rules for the application markup. Tests stay out: their JSX is fixture markup.
    {
      files: appFiles,
      ...jsxA11y.flatConfigs.recommended,
    },
    ...configs,
    prettier,
  );
}
