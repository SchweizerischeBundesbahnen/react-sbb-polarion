import type { Linter } from 'eslint';

export interface PolarionEslintOptions {
  /** The application sources the accessibility rules check. Default: `['src/**\/*.{ts,tsx}']`. */
  appFiles?: string[];
  /** Paths to ignore on top of `dist`, `node_modules` and `coverage`. */
  ignores?: string[];
  /** The extension's own config blocks. They are placed before Prettier's rule set, which has to come last. */
  configs?: Linter.Config[];
}

/** The ESLint setup the extensions' React apps share. See eslint/index.js for the peer requirements. */
export function polarionEslintConfig(options?: PolarionEslintOptions): Linter.Config[];
