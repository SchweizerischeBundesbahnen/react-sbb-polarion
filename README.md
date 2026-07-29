# @grigoriev/react-sbb-polarion

[![npm version](https://img.shields.io/npm/v/@grigoriev/react-sbb-polarion)](https://www.npmjs.com/package/@grigoriev/react-sbb-polarion)
[![npm downloads](https://img.shields.io/npm/dm/@grigoriev/react-sbb-polarion)](https://www.npmjs.com/package/@grigoriev/react-sbb-polarion)
[![node](https://img.shields.io/node/v/@grigoriev/react-sbb-polarion)](https://www.npmjs.com/package/@grigoriev/react-sbb-polarion)
[![license](https://img.shields.io/npm/l/@grigoriev/react-sbb-polarion)](./LICENSE)

[![codecov](https://codecov.io/gh/grigoriev/react-sbb-polarion/graph/badge.svg)](https://codecov.io/gh/grigoriev/react-sbb-polarion)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=grigoriev_react-sbb-polarion&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=grigoriev_react-sbb-polarion)

[![Reliability](https://sonarcloud.io/api/project_badges/measure?project=grigoriev_react-sbb-polarion&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=grigoriev_react-sbb-polarion)
[![Security](https://sonarcloud.io/api/project_badges/measure?project=grigoriev_react-sbb-polarion&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=grigoriev_react-sbb-polarion)
[![Maintainability](https://sonarcloud.io/api/project_badges/measure?project=grigoriev_react-sbb-polarion&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=grigoriev_react-sbb-polarion)
[![Technical Debt](https://sonarcloud.io/api/project_badges/measure?project=grigoriev_react-sbb-polarion&metric=sqale_index)](https://sonarcloud.io/summary/new_code?id=grigoriev_react-sbb-polarion)
[![Duplicated Lines](https://sonarcloud.io/api/project_badges/measure?project=grigoriev_react-sbb-polarion&metric=duplicated_lines_density)](https://sonarcloud.io/summary/new_code?id=grigoriev_react-sbb-polarion)

Shared React UI components for the SBB Polarion extensions' React admin apps. Published to npmjs as
[`@grigoriev/react-sbb-polarion`](https://www.npmjs.com/package/@grigoriev/react-sbb-polarion) —
public, Apache-2.0, with npm provenance on every release.

## Build

```bash
npm install
npm run build   # -> dist/index.js (ESM) + dist/*.d.ts
```

`react` / `react-dom` are **peer dependencies** and are left external in the bundle, so the consuming
app supplies the single React instance at runtime.

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

Uses [ESLint](https://eslint.org/) with a flat config (`eslint.config.js`): `@eslint/js` +
`typescript-eslint` recommended, the `eslint-plugin-react-hooks` rules (rules-of-hooks +
exhaustive-deps), and `eslint-config-prettier` last so ESLint never fights Prettier over formatting.
`src/generic/` and the test artifacts are ignored.

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
  suite in the pinned Playwright image **and enforces the coverage gate** - 100% of lines and
  functions (needs Docker running;
  ~30–60s+). Fires on commits touching `.ts`/`.tsx`/`.css`.

Activate once (the repo must be git-initialized first):

```bash
pip install pre-commit        # or: brew install pre-commit
pre-commit install            # installs the pre-commit + commit-msg hooks
pre-commit run --all-files    # optional: run every hook once
```

## Consume it from a local checkout

In an extension's `ui/` folder:

```bash
npm install file:../../react-sbb-polarion
```

npm records `"@grigoriev/react-sbb-polarion": "file:../../react-sbb-polarion"` and symlinks it into
`node_modules`. Because the symlinked package carries its own dev copy of React, add a dedupe rule to
the consumer's `vite.config.js` so both sides share one React:

```js
resolve: {
  dedupe: ['react', 'react-dom'];
}
```

Then import from the package name:

```tsx
import { PageLayout } from '@grigoriev/react-sbb-polarion';
```

Rebuild the library (`npm run build`, or `npm run dev` for watch mode) after changing a component;
the symlinked consumer picks up the new `dist/`.

## How consumers depend on this package

Published to **npmjs** as [`@grigoriev/react-sbb-polarion`](https://www.npmjs.com/package/@grigoriev/react-sbb-polarion),
public, Apache-2.0. A consuming extension declares a plain semver range and needs nothing else - no
`.npmrc`, no token, no registry configuration, because npmjs is npm's default registry:

```jsonc
// <ext>/ui/package.json
"dependencies": {
  "@grigoriev/react-sbb-polarion": "^0.0.7"
}
```

Renovate tracks it like any other dependency, and each release carries **npm provenance** - a signed
attestation, issued from the release workflow's OIDC token, that the tarball was built by that workflow
from that commit.

> Earlier versions were consumed as a **GitHub release tarball URL**
> (`https://github.com/grigoriev/react-sbb-polarion/releases/download/vX/…tgz`). That is no longer
> possible: **npm 12 refuses "remote" dependencies** outright (`EALLOWREMOTE`, `allow-remote` defaults to
> `none`), and renovate could never track a URL anyway. The release asset is still published for the
> versions pinned to it, but new consumers use the registry.

Nothing about the application code changes between the two - the imports,
`configureGenericModules(...)` and the `style.css` import stay exactly as they are.

The `resolve.dedupe: ['react', 'react-dom']` in `vite.config.js` (and `vite.formext.config.js` where
present) only mattered for the `file:` symlink, which nests its own React. A registry install has no
nested React, so the dedupe is a no-op - harmless to keep, and it is what makes a temporary switch back
to a local checkout work without touching the config.

## Exports

**Hooks**: `useConfirm()` — `window.confirm` as a real dialog: returns a promise-returning `confirm(message, options?)` plus the `confirmDialog` element to render.

**Components**: `PageLayout`, `SearchableSelect`, `Tabs`, `Modal`, `Toaster`, `BreadcrumbInjector`,
`RestAuthTest`, `About`, `UserGuide`, `ConfigurationsPane`, `RevisionsTable`, `ConfigurationButtons`,
`PropertiesEditor`, `AuthorizationSettings`.

`SearchableSelect` is the shared combobox for both selection modes. By default it is a single-select
(`value: string`); pass `multiple` and it renders checkbox options in the popup and one removable chip
per selection, with `value` / `onChange` switching to a string list. Options may carry `iconURL`,
`iconBg` and `indent`, so a nested or icon-bearing list needs no bespoke control.

`Tabs` is the shared tab bar from the generic framework's `tabs.css` - one tab-bar look for every
extension. It is controlled (`items`, `activeId`, `onSelect`) and selects only: the caller renders
whatever the active tab stands for. It uses that stylesheet's JS-driven variant, so the tab count is
free; generic's pure-CSS variant caps at four. The tabs stay real radio inputs, visually hidden rather
than removed, so the bar is still keyboard-reachable and arrow keys switch tabs.

`AuthorizationSettings` is the whole "which roles may do this" administration page - the global and
project roles of the current scope as checkboxes, the Save / Cancel / Default / Revisions toolbar and
the revision table. Pair it with `createAuthorizationService(sendRequest, settingName)`, which builds
the calls over generic's own endpoints (`/roles` and the single-setting endpoints); the extension
supplies the title and its own Quick Help text. Note that
`/roles` is opt-in on the Java side: the extension has to name generic's `RolesInternalController` and
`RolesApiController` in its REST application.

**Config / helpers**: `configureGenericModules(base)` (sets the base URL for the generic ES modules the
library still loads at runtime - now only `BreadcrumbBridge.js` via `BreadcrumbInjector`; call once per
entry point that uses the breadcrumb), `createEditableSelect` / `createSearchableSelect` (the vendored
generic combobox factories, for controls `SearchableSelect` does not cover - a free-text editable input,
the class's build mode or clearable trigger, a non-React-controlled `<select>`), `getCookie`/`setCookie`,
`isEmbedded()`, `getScope()` / `getProjectIdFromScope(scope)`.

**Functions**: `createAuthorizationService(sendRequest, settingName)`, `tokenizePropertiesLine(line)` - the `.properties` line tokenizer behind
`PropertiesEditor`, exported so a consumer can highlight the same way outside the editor.

**Types**: `ConfirmOptions`, `UseConfirm`, `SelectOption`, `SearchableSelectProps`, `SingleSelectProps`,
`MultiSelectProps`, `SearchableDropdownInstance`, `ConfigurationsPaneHandle`,
`ConfigurationsService<T>`, `AuthorizationService`, `AuthorizationContent`, `RolesInfo`,
`SettingName`, `Revision`, `Version`, `ConfigurationProperty`, `ConfigurationPropertiesModel`,
`ConfigurationStatus`, `SendRequest`.

Component **and** generic control CSS are bundled into one stylesheet, imported once by the consumer:
`import '@grigoriev/react-sbb-polarion/style.css'`.

## Bundled generic assets

To make the library self-contained (and to work in `vite dev` without a running Polarion), the shared
generic vanilla-JS combobox and its CSS are **copied into this package** instead of loaded from the
Polarion-served generic bundle at runtime:

- `src/generic/*.js` - `searchableSelect.js` + `SearchableDropdown.js`, copied verbatim from
  `ch.sbb.polarion.extension.generic` (`app/src/main/resources/js/modules/`). `SearchableSelect`
  statically imports them, so they bundle into `dist/index.js` (no runtime fetch). `ensureSharedStyles.js`
  is a local **no-op** (CSS is bundled here rather than injected at runtime). Do not hand-edit these;
  re-copy from generic to update.
- `src/generic/css/*` - the generic control stylesheets (`control-tokens`, `checkboxes`, `radios`,
  `inputs`, `searchable-dropdown`, `buttons`, `alerts`), aggregated by `controls.css` and bundled into
  `dist/style.css`. The `control-tokens` icon SVGs (`src/generic/images/`) are inlined as data URIs at
  build (`assetsInlineLimit`), so `style.css` is fully self-contained; generic's build-time `inline:`
  placeholders were rewritten to real `url()` for Vite to inline.

Consuming SPA apps import `style.css` once in `main.tsx` and no longer link the generic control CSS in
`index.html`. Surfaces without an index.html (form-extension panels injected into the Polarion editor)
inject the stylesheet via a `?inline` import in the dependent extension's form-extension entry.
