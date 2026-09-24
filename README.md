# @sbb-polarion/react-sbb-polarion

[![npm version](https://img.shields.io/npm/v/@sbb-polarion/react-sbb-polarion)](https://www.npmjs.com/package/@sbb-polarion/react-sbb-polarion)
[![npm downloads](https://img.shields.io/npm/dm/@sbb-polarion/react-sbb-polarion)](https://www.npmjs.com/package/@sbb-polarion/react-sbb-polarion)
[![node](https://img.shields.io/node/v/@sbb-polarion/react-sbb-polarion)](https://www.npmjs.com/package/@sbb-polarion/react-sbb-polarion)
[![license](https://img.shields.io/npm/l/@sbb-polarion/react-sbb-polarion)](./LICENSE)

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=SchweizerischeBundesbahnen_react-sbb-polarion&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=SchweizerischeBundesbahnen_react-sbb-polarion)
[![Reliability](https://sonarcloud.io/api/project_badges/measure?project=SchweizerischeBundesbahnen_react-sbb-polarion&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=SchweizerischeBundesbahnen_react-sbb-polarion)
[![Security](https://sonarcloud.io/api/project_badges/measure?project=SchweizerischeBundesbahnen_react-sbb-polarion&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=SchweizerischeBundesbahnen_react-sbb-polarion)
[![Maintainability](https://sonarcloud.io/api/project_badges/measure?project=SchweizerischeBundesbahnen_react-sbb-polarion&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=SchweizerischeBundesbahnen_react-sbb-polarion)
[![Technical Debt](https://sonarcloud.io/api/project_badges/measure?project=SchweizerischeBundesbahnen_react-sbb-polarion&metric=sqale_index)](https://sonarcloud.io/summary/new_code?id=SchweizerischeBundesbahnen_react-sbb-polarion)
[![Duplicated Lines](https://sonarcloud.io/api/project_badges/measure?project=SchweizerischeBundesbahnen_react-sbb-polarion&metric=duplicated_lines_density)](https://sonarcloud.io/summary/new_code?id=SchweizerischeBundesbahnen_react-sbb-polarion)

Shared React UI components for the SBB Polarion extensions' React admin apps. Published to npmjs as
[`@sbb-polarion/react-sbb-polarion`](https://www.npmjs.com/package/@sbb-polarion/react-sbb-polarion) —
public, Apache-2.0, with npm provenance on every release.

## Build

```bash
npm install
npm run build   # -> dist/index.js (ESM) + dist/*.d.ts + the two shell scripts + dist/testing.js
```

`dist/breadcrumb-bridge.js` and `dist/dle-toolbar-starter.js` come from two further, separate builds
(`vite.bridge.config.ts`, `vite.toolbar.config.ts`). They are not part of the ES bundle: they run in a
Polarion page rather than in the app, so each has to be a classic script a consumer serves. See
[Shell scripts](#shell-scripts).

`dist/testing.js` is the fourth build (`vite.testing.config.ts`): the test helpers the extensions import as
`@sbb-polarion/react-sbb-polarion/testing`. It is a separate entry so that `axe-core` stays out of
`dist/index.js`. The shared ESLint config (`eslint/`) is shipped as source and is not built. See
[Accessibility checks for the extensions](#accessibility-checks-for-the-extensions).

`react` / `react-dom` are **peer dependencies** and are left external in the bundle, so the consuming
app supplies the single React instance at runtime. The packages of the two tooling entry points
(`axe-core` and the ESLint packages) are **optional** peer dependencies, left external in the same way.

`refractor` (the Prism grammars behind `CodeEditor`) is a regular **dependency**, so npm installs it for
the consumer automatically - but it is left external too, so `dist/index.js` carries an import of it
rather than a second copy of the grammars, and the consuming app's own Vite build tree-shakes it.

## Testing

Behavior **and** visual-regression tests run in real Chromium via **Vitest browser mode**. Reference
("expected") screenshots are committed and generated in a pinned Playwright Docker image so they match
CI regardless of the developer's OS.

```bash
npm test              # behavior + visual, locally (visual diffs on non-Linux are expected - see docs)
npm run test:docker   # CI-equivalent run inside the pinned Playwright image (authoritative)
```

> [!IMPORTANT]
> Full testing guide - how to run, the two test layers, and the **Docker-only** rule for
> (re)generating reference screenshots - lives in **[`test/README.md`](./test/README.md)**.

Each component's behavior suite also runs [axe-core](https://github.com/dequelabs/axe-core) over the
component as an extension shows it (inside `.sbb-ui`), through the same `a11yViolations` and
`pageViolations` helpers the extensions use - see [Accessibility checks for the extensions](#accessibility-checks-for-the-extensions).

## Code formatting

Uses [Prettier](https://prettier.io/) (config in `.prettierrc`, matching the other SBB Polarion React
apps: single quotes, 120 print width, 2-space indent, and import sorting via
`@trivago/prettier-plugin-sort-imports`).

```bash
npm run format        # format all source files
npm run format:check  # verify formatting without writing (useful in CI)
```

The vendored generic code in `src/generic/` is **excluded** (see `.prettierignore`): it is copied
verbatim from `ch.sbb.polarion.extension.generic` and must be re-copied to update, never reformatted.

### IntelliJ IDEA setup

1. Go to **Settings > Plugins**, install the **Prettier** plugin if not already installed.
2. Go to **Settings > Languages & Frameworks > JavaScript > Prettier**.
3. Set **Prettier package** to `node_modules/prettier` (or let IDEA auto-detect it).
4. Check **On 'Reformat Code' action** and, optionally, **On save**.
5. In **Run for files**, ensure it includes: `{**/*.ts,**/*.tsx,**/*.css,**/*.mjs}`

### VS Code setup

1. Install the **Prettier - Code formatter** extension (`esbenp.prettier-vscode`).
2. In **Settings** (`Ctrl+,`) set **Editor: Default Formatter** to Prettier and **Format On Save** to true,
   or add a `.vscode/settings.json`:

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true
}
```

## Linting

Uses [ESLint](https://eslint.org/) with a flat config (`eslint.config.js`), built from the shared config
this library publishes (`eslint/index.js`), so RSP lints the way the extensions do: `@eslint/js` +
`typescript-eslint` recommended, the `eslint-plugin-react-hooks` rules (rules-of-hooks +
exhaustive-deps), the `eslint-plugin-jsx-a11y` recommended rules on the TypeScript sources in `src/`, and `eslint-config-prettier`
last so ESLint never fights Prettier over formatting. `src/generic/` and the test artifacts are ignored.
RSP adds one exception on top: `Modal`'s content `<section>` may take the focus, because it is the
dialog's only scroller and the keyboard scrolls only the focused element's scrollable ancestor.

```bash
npm run lint      # report problems
npm run lint:fix  # auto-fix what can be fixed
```

Editor integration: in **IntelliJ IDEA**, enable **Settings > Languages & Frameworks > JavaScript >
Code Quality Tools > ESLint → Automatic ESLint configuration**; in **VS Code**, install the **ESLint**
extension (`dbaeumer.vscode-eslint`), which picks up `eslint.config.js` automatically.

## Git hooks (pre-commit)

Commit-time checks use the [`pre-commit`](https://pre-commit.com/) framework
(`.pre-commit-config.yaml`), the same as the other SBB Polarion extensions. Alongside the shared
hygiene / secret-scanning / commit-message (Conventional Commits) hooks, three local hooks run this
repo's npm scripts:

- **Prettier (`format:check`)** and **ESLint (`lint`)** - check-only: they block the commit but never
  modify your working tree (run `npm run format` / `npm run lint:fix` to fix).
- **Vitest in Docker + coverage (`test:coverage:docker`)** - runs the behavior + visual-regression
  suite in the pinned Playwright image **and enforces the coverage gate** - a 90% floor, with the
  suite actually running well above it (needs Docker running;
  ~30–60s+). Fires on commits touching `.ts`/`.tsx`/`.css`.

Activate once (the repo must be git-initialized first):

```bash
pip install pre-commit        # or: brew install pre-commit
pre-commit install            # installs the pre-commit + commit-msg hooks
pre-commit run --all-files    # optional: run every hook once
```

## Consume it from a local checkout

To test an extension against an unreleased build of this library, pack it and install the tarball from
inside the extension's `ui/` folder:

```bash
# in this repo, after npm run build
npm pack --pack-destination ../<extension>/ui
```

```jsonc
// <extension>/ui/package.json
"@sbb-polarion/react-sbb-polarion": "file:sbb-polarion-react-sbb-polarion-<version>.tgz"
```

then `npm install` in `ui/`. After every later change here, repack and force the consumer's lockfile
entry to be re-derived:

```bash
node -e "const f='package-lock.json',fs=require('fs'),l=JSON.parse(fs.readFileSync(f,'utf8'));delete l.packages['node_modules/@sbb-polarion/react-sbb-polarion'];fs.writeFileSync(f,JSON.stringify(l,null,2)+'\n')"
rm -rf node_modules/@sbb-polarion && npm install
```

A plain `npm install` is not enough. The dependency spec string is unchanged, so npm installs the new
tarball contents but leaves the **old** integrity hash in the lockfile. The host build then passes
while `npm ci` in the extension's test container dies with `EINTEGRITY`, naming a hash that matches
nothing on disk.

> [!WARNING]
> Do **not** use `npm install file:../../react-sbb-polarion`. The symlink it creates works for
> `npm test` on the host but breaks the extension's `npm run test:docker`, which mounts `ui/` alone
> into the container: the link target sits outside the mount, so `npm ci` fails with `EUSAGE`. A linked
> package also contributes none of this library's own dependencies, so `refractor` silently goes
> missing from the consumer's tree. A tarball inside `ui/` resolves inside the mount and installs the
> real dependency graph.

Then import from the package name:

```tsx
import { PageLayout } from '@sbb-polarion/react-sbb-polarion';
```

Restore the published version range and the tarball-free lockfile before committing in the extension.

## How consumers depend on this package

Published to **npmjs** as [`@sbb-polarion/react-sbb-polarion`](https://www.npmjs.com/package/@sbb-polarion/react-sbb-polarion),
public, Apache-2.0. A consuming extension declares a plain semver range and needs nothing else - no
`.npmrc`, no token, no registry configuration, because npmjs is npm's default registry:

```jsonc
// <ext>/ui/package.json
"dependencies": {
  "@sbb-polarion/react-sbb-polarion": "^0.0.7"
}
```

Renovate tracks it like any other dependency, and each release carries **npm provenance** - a signed
attestation, issued from the release workflow's OIDC token, that the tarball was built by that workflow
from that commit.

> Earlier versions were consumed as a **GitHub release tarball URL**
> (`https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/releases/download/vX/…tgz`). That is no longer
> possible: **npm 12 refuses "remote" dependencies** outright (`EALLOWREMOTE`, `allow-remote` defaults to
> `none`), and renovate could never track a URL anyway. The release asset is still published for the
> versions pinned to it, but new consumers use the registry.

Nothing about the application code changes between the two - the imports and the `style.css` import
stay exactly as they are.

The `resolve.dedupe: ['react', 'react-dom']` in `vite.config.js` (and `vite.formext.config.js` where
present) only mattered for the `file:` symlink, which nests its own React. A registry install has no
nested React, so the dedupe is a no-op - harmless to keep, and it is what makes a temporary switch back
to a local checkout work without touching the config.

## Accessibility checks for the extensions

Two entry points let an extension check its React UI the way RSP checks its own components: a shared
ESLint config with `eslint-plugin-jsx-a11y`, and an axe-core helper for the tests. Both are optional. The
packages they need are **optional peer dependencies**, so an extension that uses neither installs nothing
extra.

1. Add the dev dependencies (the other ESLint packages are already in every extension):

   ```bash
   npm install --save-dev eslint-plugin-jsx-a11y axe-core
   ```

2. Add this to the extension's `package.json`. `eslint-plugin-jsx-a11y` declares peers only up to
   ESLint 9, and npm applies `overrides` only in the root project, so every extension needs it until
   [upstream supports ESLint 10](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/issues/1075):

   ```json
   "overrides": {
     "eslint-plugin-jsx-a11y": { "eslint": "$eslint" }
   }
   ```

### Shared ESLint config: `@sbb-polarion/react-sbb-polarion/eslint-config`

```js
// <ext>/ui/eslint.config.js
import { polarionEslintConfig } from '@sbb-polarion/react-sbb-polarion/eslint-config';

export default polarionEslintConfig({
  appFiles: ['src/**/*.{ts,tsx}'], // what jsx-a11y checks (the default); tests stay out, their JSX is fixture markup
  ignores: ['test/expected', '.vitest'], // on top of dist, node_modules and coverage
  configs: [
    // the extension's own blocks, e.g. plain JS/JSX sources, E2E specs, tooling
  ],
});
```

Pass the extension's own blocks in `configs` rather than appending them to the result: they are placed
before Prettier's rule set, which has to come last. A recommended set added after it, such as
`js.configs.recommended`, would switch formatting rules like `no-unexpected-multiline` back on.

### axe-core helper: `@sbb-polarion/react-sbb-polarion/testing`

```tsx
import { a11yViolations } from '@sbb-polarion/react-sbb-polarion/testing';

it('has no WCAG A/AA violations', async () => {
  render(<div className="sbb-ui"><MyPage /></div>);
  await vi.waitFor(() => expect(document.querySelector('.my-page')).not.toBeNull());
  expect(await a11yViolations()).toEqual([]);
});
```

`a11yViolations(context?, options?)` runs the WCAG 2.0-2.2 A and AA rules over `context` (default: the
whole document) and returns the violations as a list that reads in a test diff. It walks into open shadow
roots, so a form-extension panel is checked through its host element. `options.exclude` takes CSS
selectors of subtrees not to check, such as HTML the server renders rather than the component. Wait until
the component has rendered before calling it, and render inside `.sbb-ui` so the page looks as it does in
production. Add `'@sbb-polarion/react-sbb-polarion/testing'` and `'axe-core'` to `optimizeDeps.include` in
the Vitest config, so Vite does not discover them mid-run.

Two rules are excluded on purpose, because fixing them requires significant design changes: `color-contrast`
(the placeholder and inactive-tab text color is a shared token in the vendored generic CSS) and
`target-size` (the compact Polarion controls are smaller than 24x24 px).

### Where the axe cases go in an extension

The team standard: each page's own test file calls `pageViolations()` from
`@sbb-polarion/react-sbb-polarion/testing`. Do not collect the cases in a separate `a11y.test.tsx`. A
separate file needs its own copy of each page's mount code, routes and wait conditions, and a page missing
from it goes unnoticed. In the page's own file, a case reuses the mount helper, the fixtures and the
interaction helpers already there, so a new state costs a few lines.

`pageViolations(options?)` scans `document.body` with `.sbb-ui` set on it, as `index.html` does in
production. It sets the class only for the scan, so the visual references stay unchanged. It takes the
same `exclude` option as `a11yViolations`.

1. In each page's test file, add an `accessibility` block. Mount the page with that file's helper, bring
   it into the state to check, wait until it has rendered, then scan:

   ```tsx
   // <ext>/ui/test/Repair.test.tsx
   import { pageViolations } from '@sbb-polarion/react-sbb-polarion/testing';

   describe('accessibility', () => {
     it('has no WCAG A/AA violations with the results expanded', async () => {
       await mountRepair();
       await runScan();
       document.querySelector<HTMLElement>('.issues-table .col-issues.clickable')!.click();
       await vi.waitFor(() => expect(document.querySelector('.issue-list')).not.toBeNull());
       expect(await pageViolations()).toEqual([]);
     });
   });
   ```

2. Cover every page, and every state that renders more markup: an open dialog, an error banner, an edit
   mode, expanded rows, an alternative mode of a form.

3. Where a control's name matters, add a name test. axe does not fail a control named by its placeholder:

   ```tsx
   it('names every scan control after its label', async () => {
     await mountRepair();
     expect(page.getByRole('combobox', { name: 'Entity Type' }).element()).toBeVisible();
     expect(page.getByRole('textbox', { name: 'Sort By' }).element()).toBeVisible();
   });
   ```

   `getByRole({ name })` also falls back to the placeholder. Where the placeholder text equals the label
   text, it finds the control whether it has a name or not. Check the attribute that carries the name instead:

   ```tsx
   const triggers = Array.from(document.querySelectorAll('.filter-bar .sd-trigger'));
   expect(triggers.map((t) => t.getAttribute('aria-label'))).toEqual(['Project', 'Document', 'Revision']);
   ```

4. Run each new case against the old component once, to prove that it fails without the fix.

Two variations:

- A form-extension panel in a shadow root is scanned through its host: `a11yViolations(panel.host)`. Its
  mount already puts `.sbb-ui` inside the shadow root, so `pageViolations` is not needed there.
- HTML that the server renders is excluded with `options.exclude`, for example
  `pageViolations({ exclude: ['.diff-leaf'] })`. Keep the selector list in one constant of the test code.

xml-repair and diff-tool follow this layout: an `accessibility` block in each page test.

What these checks cannot tell you:

- axe checks only what a test renders. A dialog, an error state or an edit mode needs a test that opens it.
- axe and `getByRole({ name })` accept a `placeholder` as a name, so a control can pass while it is
  announced by its placeholder instead of its label.
- jsx-a11y cannot see into components, and it assumes that a `{expression}` inside a `<label>` may render
  the control, so it does not report such a label that names nothing.

## Releasing

Releases are driven by [release-please](https://github.com/googleapis/release-please), through the SBB
Polarion org's shared reusable workflow, the same way every `ch.sbb.polarion.extension.*` repository
does it. There is no button to press and no version to type:

1. Merge conventional commits to `main`. `feat:` moves the minor, `fix:` the patch, a
   `BREAKING CHANGE:` footer the major.
2. release-please keeps a **release PR** open with the version bump and the generated `CHANGELOG.md`.
   Review it like any other PR.
3. Merging it creates the tag and the GitHub release, which triggers the publish job: the suite runs
   once more in the pinned Playwright image, then the package goes to npmjs and the tarball is attached
   to the release.

`.release-please-manifest.json` holds the last released version - it, not the git history, is the
source of truth for what comes next.

The publish authenticates with the workflow's OIDC identity (npm **trusted publishing**), so there is
no npm token anywhere, and every release carries a provenance attestation. That binding names both this
repository and the workflow's file name; see the note at the top of `.github/workflows/release-please.yml`
before renaming or moving either.

## Exports

**Hooks**: `useConfirm()` — `window.confirm` as a real dialog: returns a promise-returning `confirm(message, options?)` plus the `confirmDialog` element to render.

**Components**: `PageLayout`, `SearchableSelect`, `Tabs`, `Modal`, `Toaster`, `BreadcrumbInjector`,
`RestAuthTest`, `About`, `UserGuide`, `ConfigurationsPane`, `RevisionsTable`, `ConfigurationButtons`,
`CodeEditor`, `DateInput`, `DateRangePicker`, `AuthorizationSettings`, `StylePackageWeights`, `Disclaimer`,
`FeatureRouter`, `DocsProvider`, `DocPage`, `DocLinkInterceptor`.

`SearchableSelect` is the shared combobox for both selection modes. By default it is a single-select
(`value: string`); pass `multiple` and it renders checkbox options in the popup and one removable chip
per selection, with `value` / `onChange` switching to a string list. Options may carry `iconURL`,
`iconBg` and `indent`, so a nested or icon-bearing list needs no bespoke control.

`DateInput` is a native `<input type="date">` - the platform's own calendar popup, keyboard entry and
locale-formatted display - wearing the control look of every other input here, which the browser's
default box does not: it is taller, rounded and in the system font, so a date used to break the line of
a control row. It is controlled (`value`, `onChange`) on the ISO `yyyy-MM-dd` string the input itself
uses, never a `Date`, and takes an optional `label`, `min`, `max`, `disabled` and `title`. An empty
`min` / `max` means unbounded, so a form holding "no date yet" as `''` can forward its state as is. A
field shown without a `label`, e.g. under a heading, takes its accessible name from `ariaLabel`.

`DateRangePicker` composes two of them into a period and bounds each end by the other, so neither
calendar offers a day that would invert the range. `min` / `max` bound the range from the outside; the
labels default to `From` / `To`. With empty labels (a bare row) the fields keep a name, `From` / `To` by
default, which `startAriaLabel` / `endAriaLabel` change. The styling is on the components' own classes
(`.sbb-date-input`, `.sbb-date-field`, `.sbb-date-range`), so a date input an extension writes itself is
left alone.

For the row those fields usually sit in, the same stylesheet carries `.sbb-control-row`: it
bottom-aligns the labelled fields and pulls a taller control - a toolbar button is 28px against the
controls' 23px, which is Polarion's own relationship - down by half the difference, so it is centred on
the line the fields make instead of standing proud of it.

`ConfigurationsPane` is the named-configuration selector plus create / rename / delete. Pass the optional
`visibility` prop - `{ globalHidden, onChange, note?, disabled? }` - and it grows a `Change visibility`
button, behind a separator, after `Add new`: a dialog that explains what the configurations of the global
level are, carries a checkbox for the current state and Cancel / Change. The wording is composed from
`label`, so the dialog of a page whose `label` is `style package` speaks of style packages. The pane does
not read or store the flag itself (each extension keeps it somewhere else): it hands the chosen value to
`onChange` and reloads its list once that resolves, since hiding or showing the global level changes which
configurations the scope has.

`Tabs` is the shared tab bar from the generic framework's `tabs.css` - one tab-bar look for every
extension. It is controlled (`items`, `activeId`, `onSelect`) and selects only: the caller renders
whatever the active tab stands for. It uses that stylesheet's JS-driven variant, so the tab count is
free; generic's pure-CSS variant caps at four. The tabs stay real radio inputs, visually hidden rather
than removed, so the bar is still keyboard-reachable and arrow keys switch tabs. A tab with `disabled`
stays in the bar, dimmed, and neither a click nor the arrow keys select it; disabling the active tab does
not move the selection, which stays the caller's.

`CodeEditor` is the editor for a settings page whose content is a document rather than a form - a
textarea with a syntax-highlighted layer painted underneath it. With `readOnly` it is filled like a
control, so it does not look editable. It is controlled (`value`, `onChange`) and needs a `language`:

| `language`     | for                                                           |
| -------------- | ------------------------------------------------------------- |
| `'properties'` | a `.properties` configuration (the DMS connectors)            |
| `'css'`        | a stylesheet (the exporters' CSS and style packages)          |
| `'html'`       | a markup fragment                                             |
| `'velocity'`   | a Velocity template, markup and all (filename, cover, header) |

`'velocity'` is Velocity **inside markup** - the grammar is `'html'` extended with directives,
`$variables` and `#* *#` comments, which is exactly what an exporter template is. So there is no
`'html+velocity'`: use `'velocity'` whenever a template may contain directives, `'html'` only for a
fragment that never does.

The grammars are Prism's own, through [`refractor`](https://github.com/wooorm/refractor), and the colors
are Prism's default theme - the one the legacy `<code-input>` pages loaded, so a migrated page keeps the
highlighting its users know. Give the wrapper a height through `className`; it carries only a minimum of
its own.

`StylePackageWeights` is the exporters' style-package ordering page: a weighted list where higher weight
means higher position and the top entry is the one preselected in the export panel. Rows reorder by drag
and drop or by the caret buttons, and either way the weights are rewritten to match - an entry keeps the
weight it had whenever that still fits between its new neighbours. A package defined at the global scope
shows read-only in a project scope (lock icon, greyed field) and acts as a fixed reference point that
others can be dropped above or below. Pair it with `createStylePackageWeightsService(sendRequest)`; the
endpoint is the extension's own. Its toolbar is Save / Cancel only, since that endpoint has neither
default values nor revisions.

`AuthorizationSettings` is the whole "which roles may do this" administration page - the global and
project roles of the current scope as two multi-select `SearchableSelect`s (granted roles as chips, the
rest as checkbox options behind a search box), the Save / Cancel / Default / Revisions toolbar and the
revision table. It stores only roles the scope still offers, so a role deleted since the last save drops
out instead of lingering in the setting. Pair it with `createAuthorizationService(sendRequest, settingName)`, 
which builds the calls over generic's own endpoints (`/roles` and the single-setting endpoints); the extension
supplies the title and its own Quick Help text. Note that `/roles` is opt-in on the Java side: the extension 
has to name generic's `RolesInternalController` and `RolesApiController` in its REST application.

### Single-bundle admin app and documentation site

`FeatureRouter` is the router of an admin app that ships as one `index.html`: every administration entry in
`hivemodule.xml` points at `index.html?feature=<id>&embedded=true&scope=$scope$`, and the router renders the
`features` entry whose `id` matches, or `fallback` when none does. The ids must equal the extender ids -
a mismatch is a blank page. `Feature` is the `{ id, component }` it routes on; extend it with whatever the
app lists besides (a label, a description). `findFeature(features, id)` is the same lookup.

`Disclaimer` is the Usage Disclaimer page next to `About` and `UserGuide`: it reads generic's `/disclaimer`
endpoint, shows the build-generated article, links `sourceUrl` when the endpoint answers an empty body
(nothing was generated), and reports a failed request as an error.

The documentation site renders build-generated help articles (one markdown file each) with a sidebar, a
search over a build-generated section index, a breadcrumb, prev/next and an "on this page" rail. An
extension supplies only its data:

```tsx
// App.tsx
const docsConfig = buildDocsConfig({
  docs: [
    { id: 'quick-start', title: 'Quick Start', source: 'QUICK_START.md' },
    { id: 'configuration', title: 'Configuration', source: 'CONFIGURATION.md' },
  ], // reading order: the sidebar and prev/next follow it
  searchIndex, // optional; search is hidden without it
  sourceBaseUrl: 'https://github.com/<org>/<repo>/blob/main', // "not generated" and repo-file links
  extraMdLinks: { 'README.md': 'about', 'DISCLAIMER.md': 'disclaimer' }, // non-article .md targets
  onDocLinkNavigate: adminNav.switchToFeatureNode, // optional admin-shell sync, see below
});

const FEATURES: Feature[] = [
  { id: 'about', component: AboutPage },
  { id: 'disclaimer', component: DisclaimerPage },
  ...docsConfig.docs.map((doc) => ({ id: doc.id, component: () => <DocPage doc={doc} /> })),
  // ...the settings pages
];

export default function App() {
  return (
    <DocsProvider config={docsConfig}>
      <DocLinkInterceptor>
        <div className="standard-admin-page">
          <FeatureRouter features={FEATURES} fallback={Landing} />
        </div>
      </DocLinkInterceptor>
    </DocsProvider>
  );
}
```

- Build `docsConfig` once (module level or `useMemo`): an inline `buildDocsConfig({...})` is a new context
  value on every render.
- `DocPage` fetches `../../html/<id>.html` relative to the app by default (`articleHtmlUrl` overrides it).
- `DocLinkInterceptor` is what makes the articles' own relative links work: a `<feature>.html` of a known
  page or a `.md` source (mapped from each article's `source` plus `extraMdLinks`) becomes a `?feature=`
  switch; any other relative link opens at `sourceBaseUrl` in a new tab. Wrap the whole app in it, not only
  the documentation pages, so links inside About or the Disclaimer work the same way.

**Admin-shell sync** (optional). Polarion's breadcrumb and left menu follow the top window's hash, which an
in-frame `?feature=` switch does not change. `createAdminNav` switches the shell to the node that serves the
target when a link crosses nodes (e.g. an article linking to the Disclaimer), handing the intended article
and fragment across the node reload through `sessionStorage`:

```tsx
// adminNav.ts
export const adminNav = createAdminNav({
  adminBase: 'pdf-export', // the context in #/[project/<id>/]administration/<adminBase>/<node>
  // every article lives under the `documentation` node; About and Disclaimer are their own nodes
  nodeForFeature: docNodeForFeature({ docs, selfNodes: ['about', 'disclaimer'] }),
});

// main.tsx - before the first render: when a node switch stashed a target, go there instead
if (!adminNav.resumePendingDoc()) {
  ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
}
```

A stashed target expires after 30 seconds, so a switch that never reloaded the frame (cancelled, or ignored
by Polarion) cannot redirect a later, unrelated page load.

**Config / helpers**: `createEditableSelect` / `createSearchableSelect` (the vendored
generic combobox factories, for controls `SearchableSelect` does not cover - a free-text editable input,
the class's build mode or clearable trigger, a non-React-controlled `<select>`), `getCookie`/`setCookie`,
`isEmbedded()`, `getScope()` / `getProjectIdFromScope(scope)`.

**Functions**: `createAuthorizationService(sendRequest, settingName)`,
`createStylePackageWeightsService(sendRequest)`, `buildDocsConfig(options)`, `findFeature(features, id)`,
`createAdminNav(options)`, `docNodeForFeature(options)`.

**Types**: `ConfirmOptions`, `UseConfirm`, `SelectOption`, `SearchableSelectProps`, `SingleSelectProps`,
`MultiSelectProps`, `SearchableDropdownInstance`, `CodeLanguage`, `ConfigurationsPaneHandle`,
`ConfigurationsService<T>`, `ConfigurationsVisibility`, `AuthorizationService`, `AuthorizationContent`, `RolesInfo`,
`StylePackageWeight`, `StylePackageWeightsService`, `WeightEntry`,
`SettingName`, `Revision`, `Version`, `ConfigurationProperty`, `ConfigurationPropertiesModel`,
`ConfigurationStatus`, `SendRequest`, `Feature`, `DocEntry`, `DocSearchRecord`, `DocsConfig`,
`BuildDocsConfigOptions`, `AdminNav`, `AdminNavOptions`, `DocNodeForFeatureOptions`.

Component **and** generic control CSS are bundled into one stylesheet, imported once by the consumer:
`import '@sbb-polarion/react-sbb-polarion/style.css'`.

**Separate entry points**, for an extension's tooling rather than its UI (see
[Accessibility checks for the extensions](#accessibility-checks-for-the-extensions)):
`@sbb-polarion/react-sbb-polarion/eslint-config` (`polarionEslintConfig`, `PolarionEslintOptions`) and
`@sbb-polarion/react-sbb-polarion/testing` (`a11yViolations`, `pageViolations`, `A11yViolation`,
`A11yOptions`).

## Bundled generic assets

To make the library self-contained (and to work in `vite dev` without a running Polarion), the shared
generic vanilla-JS combobox and its CSS are **copied into this package** instead of loaded from the
Polarion-served generic bundle at runtime:

- `src/generic/*.js` - `searchableSelect.js` + `SearchableDropdown.js`, copied verbatim from
  `ch.sbb.polarion.extension.generic` (`app/src/main/resources/js/modules/`). `SearchableSelect`
  statically imports them, so they bundle into `dist/index.js` (no runtime fetch). `ensureSharedStyles.js`
  is a local **no-op** (CSS is bundled here rather than injected at runtime). Do not hand-edit these;
  re-copy from generic to update, and keep the local patches listed in
  [`.greptile/rules.md`](./.greptile/rules.md#local-patches-that-must-survive-a-re-copy).
- `src/generic/css/*` - the generic control stylesheets (`control-tokens`, `checkboxes`, `radios`,
  `inputs`, `searchable-dropdown`, `buttons`, `alerts`, `tabs`, `tables`, `configurations`), aggregated
  by `controls.css` and bundled into `dist/style.css`. `tables.css` styles no component here - it is
  the shared `.sbb-table` look an extension opts into for its own result grids, and bundling it is what
  makes that class work without the extension linking anything. The `control-tokens` icon SVGs (`src/generic/images/`) are inlined as data URIs at
  build (`assetsInlineLimit`), so `style.css` is fully self-contained; generic's build-time `inline:`
  placeholders were rewritten to real `url()` for Vite to inline.
- `src/generic/css/github-markdown-light.css` - the base `.markdown-body` styling `About` and
  `UserGuide` render help articles with, imported by `src/components/markdown.css`, which layers the
  Polarion heading look on top. Copied from generic rather than from the upstream
  `github-markdown-css` package: generic's copy comments out `color`, `background-color`,
  `font-family`, `font-size` and `line-height` so the article inherits Polarion's typography instead
  of GitHub's, and adds vertical margins. Upstream would restyle every help page.

Consuming SPA apps import `style.css` once in `main.tsx` and no longer link the generic control CSS in
`index.html`. The `github-markdown-light.css` link an app still carries is now a duplicate fetch and
can be dropped. Surfaces without an index.html (form-extension panels injected into the Polarion editor)
inject the stylesheet via a `?inline` import in the dependent extension's form-extension entry.

## Shell scripts

Almost everything here is bundled. Two files cannot be, because they do not run in the app's own frame
at all. Both are classic scripts, so neither is an ES module nor part of `dist/index.js`; `npm run
build` emits each as its own self-contained file.

| File                             | Emitted as                    | Runs in                                          | Loaded by                                                                                |
| -------------------------------- | ----------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `src/shell/BreadcrumbBridge.js`  | `dist/breadcrumb-bridge.js`   | the Polarion shell window (`window.top`)         | this library's `BreadcrumbInjector`                                                      |
| `src/shell/DleToolbarStarter.js` | `dist/dle-toolbar-starter.js` | Polarion's document-editor iframe, driving `top` | the extension's own `starter.js` / `dle-toolbar.js`, via `scriptInjection.dleEditorHead` |

`DleToolbarStarter` is the self-healing toolbar-button engine: it injects an extension's button into
Polarion's native document (DLE) or Rich Page toolbar and re-injects it whenever GWT re-renders the
toolbar. It registers itself as `window.CommonDleToolbarStarter`, which every extension's `starter.js`
reads, so that name is the contract. Its CSS is imported `?inline` and bundled into the same file, so
there is no stylesheet to serve alongside it.

> [!NOTE]
> This engine began life in `ch.sbb.polarion.extension.generic` as `GenericDleToolbarStarter`. The
> global was renamed, but everything **shared between extensions on one page** deliberately keeps its
> original names: the `top.__genericDleToolbar*` registries, `top.__genericRpeAutoExpandObserver` and
> the `generic-dle-toolbar-styles` element id. Those are a wire format, not a name. An extension still
> loading generic's older engine coordinates through exactly those keys, so renaming them would split
> the registries and break button ordering across the old/new boundary. See the NAMING note at the top
> of `src/shell/DleToolbarStarter.js`.
>
> One page can evaluate this engine twice - an administrator configuring the same injector in two places
> produces exactly that - so the disabled state remembers its click blocker on the button element rather
> than in the load that added it. The element is what both loads can reach; the load cannot be.

Each is exposed as an export: `@sbb-polarion/react-sbb-polarion/breadcrumb-bridge.js` and
`@sbb-polarion/react-sbb-polarion/dle-toolbar-starter.js`.

A consuming extension copies the ones it uses into the folder Polarion serves its app from, next to the
app bundle. Add this to the extension's `ui/vite.config.js`:

```js
import { copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// Copy the shell scripts next to the built app. They cannot be bundled: they run in a Polarion page,
// outside this app's frame, and have to stay classic scripts.
const RSP_SHELL_SCRIPTS = ['dle-toolbar-starter.js', 'breadcrumb-bridge.js'];

function copyRspShellScripts() {
  return {
    name: 'copy-rsp-shell-scripts',
    writeBundle(options) {
      const require = createRequire(import.meta.url);
      for (const name of RSP_SHELL_SCRIPTS) {
        copyFileSync(require.resolve(`@sbb-polarion/react-sbb-polarion/${name}`), `${options.dir}/${name}`);
      }
    },
  };
}
```

then add `copyRspShellScripts()` to `plugins`.

> [!NOTE]
> The toolbar engine coordinates button order, observers and ownership through registries on the top
> window, shared by every extension in one Polarion page. Those registry names are kept compatible with
> generic's older engine, so an extension on the old version and one on this engine still order their
> buttons against each other and share a single injected stylesheet. Keep it that way: see the NAMING
> note in `src/shell/DleToolbarStarter.js`.

`BreadcrumbInjector` resolves its URL relative to the running app, so nothing else needs configuring;
pass its `src` prop only if the extension serves the file from somewhere else. For the toolbar engine
the extension's own `starter.js` names the URL, so point it at the app base rather than at generic's
webapp (`/polarion/<ext>-app/ui/app/dle-toolbar-starter.js`). The administrator-facing
`scriptInjection.dleEditorHead` value does not change.

In `vite dev` neither file is copied and the requests 404. That is harmless: the shell app header and
the document editor do not exist in the dev server anyway.
