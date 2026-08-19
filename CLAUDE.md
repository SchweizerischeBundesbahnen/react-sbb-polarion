# CLAUDE.md

Non-obvious rules for this repo. How-to (build, test, lint) is in `package.json`, `README.md` and
`test/README.md` - read those directly rather than duplicating here.

## Vendored generic code - transitional; don't edit for style, preserve the local patches

`src/generic/**` is a **transit artifact**, not a permanent dependency. It is kept in sync with
`ch.sbb.polarion.extension.generic` (`app/src/main/resources/js` and `/css`) only until the other
extensions finish migrating onto RSP; then generic deletes its copy (and its tests), and RSP rewrites
each file in idiomatic React (e.g. `SearchableDropdown.js`'s logic folds into `SearchableSelect.tsx` and
the standalone class goes away). So:

- **Synced, not owned (for now):** to change it, **re-copy from generic** - never hand-edit, restyle, or
  "clean it up" (it is excluded from Prettier and ESLint). Don't invest effort polishing it; it is
  slated to be replaced by React, not maintained here.
- Because generic will delete its own tests before RSP finishes the rewrite, RSP owns behavior tests for
  this code in `test/` (written behavior-level so they also guard the eventual React rewrite).
- The copy carries **intentional local deviations that must survive a re-copy** (do not let a fresh copy
  clobber them):
  - `SearchableDropdown.js` - the option-list portal appends to `getRootNode()` (shadow-root aware, not
    always `document.body`) and outside-click detection uses `event.composedPath()`. Required so the
    dropdown works inside the form-extension shadow roots.
  - `control-tokens.css` - generic's `inline:` icon placeholders are rewritten to real
    `url(../images/…)` (Vite inlines them at build); `ensureSharedStyles.js` is a local no-op (the CSS
    is bundled, not injected at runtime).
  - `github-markdown-light.css` - generic's copy is **not** upstream `github-markdown-css`: `color`,
    `background-color`, `font-family`, `font-size` and `line-height` are commented out so a help
    article inherits Polarion's typography, and `.markdown-body` gains 25px vertical margins. Taking
    the npm package instead would restyle every About and User Guide page.
  - `control-tokens.css` - the two Selawik **`@font-face`** blocks (400 + 700, pointing at Polarion's
    own `/polarion/ria/fonts/selawik/*.ttf`). Generic's copy has **none**, and this is deliberate and
    permanent: Polarion's native pages already load Selawik through the petrel theme, so
    only the React SPAs - which run in their own iframe without petrel - need the declaration. A
    by-the-book re-copy from generic silently deletes it, every admin page falls back to Arial, and the
    **test suite stays green** (nothing serves `/polarion/ria/fonts/…` under test, so the references
    render the fallback either way). Re-add it after any re-copy.

## Visual-regression reference screenshots

- References in `test/expected/` are canonical **only when generated on Linux** in the pinned Playwright
  Docker image. Regenerate with `npm run test:update:docker` - never bare `npm run test:update` (it is
  guarded to refuse off Linux, so the committed PNG always matches CI).
- **Every font a component names must exist in the pinned image**, or the reference is hostage to
  fontconfig tie-breaking and the suite goes intermittently red. The image ships no Consolas / Monaco /
  Ubuntu Mono / DejaVu, and its generic `monospace` keyword matches three faces (WenQuanYi Zen Hei Mono,
  Liberation Mono, FreeMono) with no stable winner — `PropertiesEditor` hit exactly this, failing one CI
  run and passing the next on the same commit. End such a stack on a face the image has (`Liberation
  Mono`, `Liberation Sans`, `FreeMono`); list what the image has with
  `docker run --rm "$(grep -om1 'mcr.microsoft.com/playwright:[^ ]*' .github/workflows/ci.yml)" fc-list : family`.
- **The Playwright version is written in four places that must move together**: the `playwright` pin in
  `package.json`, the `container:` image tag in `ci.yml` **and** in `release-please.yml`, and
  `NODE_VERSION` in `release-please.yml`, which has to be the node shipped inside that image. The
  committed references were generated against that image, so bumping one and not the others turns the
  visual suite red. `scripts/docker-test.mjs` derives its tag from `node_modules` and follows on its own;
  the workflows cannot, which is why Renovate edits them through a custom manager.
- **Call `parkPointer()` (`test/helpers.ts`) before capturing a resting state.** Playwright leaves the
  mouse wherever the last action put it, and that position outlives the test *and* the test file, so a
  test that never touches the mouse inherits a stray pointer - and if the component sits under it the
  reference is written in its `:hover` paint, silently, because the capture still succeeds. Capture
  without parking only in a test that is deliberately about `:hover`. A reference that flips between two
  otherwise identical runs is this, not flaky rendering.
- A bare `npm test` on Windows/macOS will **diff on the screenshot even when the component is
  unchanged** (OS font antialiasing - the control font stack is Windows-only Segoe UI, absent on Linux).
  That is expected; do NOT "fix" it by overwriting the reference. Confirm real visual changes with
  `npm run test:docker`.

## Do not take shortcuts to make checks pass

- Never silence a check to get green: no `eslint-disable`, no weakening a type to `any`, no overwriting
  a visual reference, no skipping a failing test. Fix the cause or ask.
- **The coverage floor only applies when `--coverage` is passed**, so a bare `npm test` enforces nothing
  and swapping CI's `npm run test:coverage:full` for it removes the gate without failing anything. The
  same floor is the coverage condition of the SonarQube Cloud quality gate, so widening
  `coverage.exclude` or `sonar.coverage.exclusions`, or an `istanbul ignore`, games two gates at once.
  New code is expected to arrive with its tests; clearing the floor is not evidence that it did.

## Packaging constraints

- `react` / `react-dom` are **peer dependencies** and must stay external - never add them as bundled
  dependencies or import them in a way that bundles a second React copy into `dist/`.
- `--sbb-*` design tokens are declared on the `.sbb-ui` / `.standard-admin-page` / `.modal__container` /
  `.form-wrapper` scopes, **not `:root`**. A component only renders styled under one of those ancestors
  (tests wrap the render in `.sbb-ui`); a component that looks unstyled is usually missing that scope.

## Commits

- `type: subject`, in English, **no scope** - never `type(scope): subject`. Imperative, lowercase first
  letter, no trailing period, at most 50 characters. No issue references and no attribution trailers
  (`Co-Authored-By`, "Generated with Claude Code"). The pull-request title follows the same rule and is
  the one that reaches `main`, because merging is by squash.
