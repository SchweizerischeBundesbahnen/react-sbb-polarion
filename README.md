# @grigoriev/react-sbb-polarion

Shared React UI components for the SBB Polarion extensions' React admin apps. Local prototype: not yet
published to a registry.

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
  suite in the pinned Playwright image **and enforces the 80% coverage gate** (needs Docker running;
  ~30–60s+). Fires on commits touching `.ts`/`.tsx`/`.css`.

Activate once (the repo must be git-initialized first):

```bash
pip install pre-commit        # or: brew install pre-commit
pre-commit install            # installs the pre-commit + commit-msg hooks
pre-commit run --all-files    # optional: run every hook once
```

## Consume it locally (before it is published)

In an extension's `ui/` folder:

```bash
npm install file:../../react-sbb-polarion
```

npm records `"@grigoriev/react-sbb-polarion": "file:../../react-sbb-polarion"` and symlinks it into
`node_modules`. Because the symlinked package carries its own dev copy of React, add a dedupe rule to
the consumer's `vite.config.js` so both sides share one React:

```js
resolve: { dedupe: ['react', 'react-dom'] }
```

Then import from the package name:

```tsx
import { PageLayout } from '@grigoriev/react-sbb-polarion';
```

Rebuild the library (`npm run build`, or `npm run dev` for watch mode) after changing a component;
the symlinked consumer picks up the new `dist/`.

## Switch to the published package (semver + GitHub Packages)

Once this package is published, each consumer moves off the local `file:` link to a normal semver
dependency. **No application code changes** - the imports, `configureGenericModules(...)` calls, and
the `style.css` import all stay exactly as they are. Only the dependency source and a bit of build
config change.

**In this package (one-time publish setup):**

1. Give it a real version (`package.json` `"version"`, e.g. `0.1.0`) and remove `"private": true`.
2. Point publishing at the org registry:

   ```json
   "publishConfig": {
     "registry": "https://npm.pkg.github.com"
   }
   ```

3. Publish (auth with a GitHub token that has `write:packages`):

   ```bash
   npm publish
   ```

**In each consuming extension (`ui/`):**

1. Add an `.npmrc` so the `@grigoriev` scope resolves to GitHub Packages (the scope
   must match the GitHub org, and npm scopes are lowercase):

   ```
   @grigoriev:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
   ```

   (CI already provides a token; developers use a personal access token with `read:packages`.)

2. Change the dependency from the local link to a semver range, then reinstall:

   ```jsonc
   // package.json
   // - "@grigoriev/react-sbb-polarion": "file:../../react-sbb-polarion"
   // + "@grigoriev/react-sbb-polarion": "^0.1.0"
   ```

   ```bash
   npm install
   ```

3. Remove the `resolve.dedupe: ['react', 'react-dom']` line from `vite.config.js` (and
   `vite.formext.config.js` where present). It only existed to collapse the two React copies the
   `file:` symlink created; a registry install has no nested React, so the dedupe becomes a no-op -
   leaving it is harmless, removing it keeps the config clean.

To go back to local development against unpublished changes, reverse step 2
(`npm install file:../../react-sbb-polarion`) and re-add the dedupe rule.

## Exports

**Components**: `PageLayout`, `SearchableSelect`, `Modal`, `Toaster`, `BreadcrumbInjector`,
`RestAuthTest`, `About`, `UserGuide`, `ConfigurationsPane`, `RevisionsTable`, `ConfigurationButtons`,
`PropertiesEditor`.

**Config / helpers**: `configureGenericModules(base)` (sets the base URL for the generic ES modules the
library still loads at runtime - now only `BreadcrumbBridge.js` via `BreadcrumbInjector`; call once per
entry point that uses the breadcrumb), `createEditableSelect` / `createSearchableSelect` (the vendored
generic combobox factories, for bespoke editable / richer-option inputs), `getCookie`/`setCookie`,
`isEmbedded()`, `getScope()` / `getProjectIdFromScope(scope)`.

**Functions**: `tokenizePropertiesLine(line)` - the `.properties` line tokenizer behind
`PropertiesEditor`, exported so a consumer can highlight the same way outside the editor.

**Types**: `SelectOption`, `SearchableDropdownInstance`, `ConfigurationsPaneHandle`,
`ConfigurationsService<T>`, `SettingName`, `Revision`, `Version`, `ConfigurationProperty`,
`ConfigurationPropertiesModel`, `ConfigurationStatus`, `SendRequest`.

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
