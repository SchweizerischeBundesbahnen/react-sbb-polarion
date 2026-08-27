# CLAUDE.md

Non-obvious rules for this repo. How-to (build, test, lint) is in `package.json`, `README.md` and
`test/README.md` - read those directly rather than duplicating here.

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
- A bare `npm test` on Windows/macOS will **diff on the screenshot even when the component is
  unchanged** (OS font antialiasing - the control font stack is Windows-only Segoe UI, absent on Linux).
  That is expected; do NOT "fix" it by overwriting the reference. Confirm real visual changes with
  `npm run test:docker`.

## Do not take shortcuts to make checks pass

- Never silence a check to get green: no `eslint-disable`, no weakening a type to `any`, no overwriting
  a visual reference, no skipping a failing test. Fix the cause or ask.

## Packaging constraints

- `react` / `react-dom` are **peer dependencies** and must stay external - never add them as bundled
  dependencies or import them in a way that bundles a second React copy into `dist/`.
- `--sbb-*` design tokens are declared on the `.sbb-ui` / `.standard-admin-page` / `.modal__container` /
  `.form-wrapper` scopes, **not `:root`**. A component only renders styled under one of those ancestors
  (tests wrap the render in `.sbb-ui`); a component that looks unstyled is usually missing that scope.
