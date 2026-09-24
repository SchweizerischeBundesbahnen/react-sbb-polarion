import axe from 'axe-core';

/*
 * Test helpers for the extensions, published as `@sbb-polarion/react-sbb-polarion/testing`. Kept out of the
 * main entry so that `axe-core` (an optional peer dependency) is needed only by the tests that import this.
 */

// Excluded on purpose: fixing these requires significant design changes, so they are left for later, when
// there is an urgent need.
// - color-contrast: the placeholder and inactive-tab text color is the shared --sbb-control-placeholder
//   token, defined in the vendored generic CSS (src/generic/css/control-tokens.css).
// - target-size (WCAG 2.2): the compact Polarion controls, e.g. the revision revert icons and the weight
//   arrows, are smaller than 24x24 px.
const EXCLUDED_RULES = {
  'color-contrast': { enabled: false },
  'target-size': { enabled: false },
};

export interface A11yViolation {
  rule: string;
  impact: string | null | undefined;
  help: string;
  targets: string[];
}

export interface A11yOptions {
  /** CSS selectors of subtrees not to check, e.g. HTML the server renders rather than the component. */
  exclude?: string[];
}

/**
 * Runs axe-core over a rendered subtree and returns its violations in a form that reads in a test diff:
 * `expect(await a11yViolations(container)).toEqual([])`.
 *
 * axe walks into open shadow roots on its own, so a panel mounted in one is checked through its host. Only
 * WCAG A and AA rules run: the best-practice set flags layout choices, not defects.
 */
export async function a11yViolations(
  context: Element | Document = document,
  options: A11yOptions = {},
): Promise<A11yViolation[]> {
  const results = await axe.run(
    { include: context instanceof Document ? undefined : [context], exclude: options.exclude ?? [] },
    {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      rules: EXCLUDED_RULES,
    },
  );
  return results.violations.map((violation) => ({
    rule: violation.id,
    impact: violation.impact,
    help: violation.help,
    targets: violation.nodes.map((node) => `${node.target.join(' >> ')} :: ${node.failureSummary ?? ''}`),
  }));
}

/**
 * Checks the whole rendered page: `expect(await pageViolations()).toEqual([])`. The extensions render under
 * `<body class="sbb-ui">` (their index.html), where RSP's tokens live, so the scan runs with that class set.
 * It is set only for the scan, because the visual references are captured without it.
 */
export async function pageViolations(options: A11yOptions = {}): Promise<A11yViolation[]> {
  const added = !document.body.classList.contains('sbb-ui');
  if (added) {
    document.body.classList.add('sbb-ui');
  }
  try {
    return await a11yViolations(document.body, options);
  } finally {
    if (added) {
      document.body.classList.remove('sbb-ui');
    }
  }
}
