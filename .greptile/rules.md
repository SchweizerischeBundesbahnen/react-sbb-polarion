# Review rules for react-sbb-polarion

Prose companion to `config.json`. The structured rules there are the enforceable list; this file
gives the reasoning, because most of the traps in this repo are ones where **the checks stay green
and the product is still broken**. Weight review accordingly: a green CI run is not evidence that a
diff is correct here.

## `src/generic/**` is vendored, not owned

It is a copy of `ch.sbb.polarion.extension.generic` (`app/src/main/resources/js` and `/css`), kept
in sync only until the other extensions finish migrating onto RSP. Then generic deletes its copy and
RSP rewrites each file in idiomatic React — `SearchableDropdown.js`'s logic folds into
`SearchableSelect.tsx` and the standalone class disappears.

So it is a transit artifact with a scheduled death, and effort spent polishing it is wasted:

- To change it, **re-copy from generic**. Never hand-edit, restyle or modernise it. It is excluded
  from Prettier and ESLint on purpose, so "fixing" its formatting is noise, not cleanup.
- RSP owns the *behavior* tests for this code in `test/` (generic will delete its own tests first).
  Those tests are written behavior-level deliberately, so they also guard the eventual React
  rewrite — a diff that rewrites them against implementation details defeats that.

### Local patches that must survive a re-copy

A faithful re-copy from generic silently deletes these. Treat their removal as a defect:

| Where | Deviation | What breaks without it |
| --- | --- | --- |
| `SearchableDropdown.js` | Option-list portal appends to `getRootNode()` (shadow-root aware), outside-click uses `event.composedPath()` | The dropdown stops working inside the form-extension shadow roots |
| `control-tokens.css` | Generic's `inline:` icon placeholders rewritten to real `url(../images/…)`; `ensureSharedStyles.js` is a local no-op | Icons vanish — the CSS here is bundled by Vite, not injected at runtime |
| `control-tokens.css` | Two Selawik `@font-face` blocks (400 + 700) pointing at `/polarion/ria/fonts/selawik/*.ttf` | Every admin page falls back to Arial — **and the test suite stays green**, since nothing serves those fonts under test |

The Selawik blocks are permanent and deliberate: Polarion's native pages already load Selawik via
the petrel theme, but the React SPAs run in their own iframe without petrel, so only they need the
declaration. Generic's copy has none, and never will.

## Visual regression

References in `test/expected/` are canonical **only** when generated on Linux in the pinned
Playwright Docker image — `npm run test:update:docker`, never bare `npm run test:update` (which is
guarded to refuse off Linux precisely so the committed PNG always matches CI).

- A bare `npm test` on macOS or Windows **diffs on the screenshot even when the component is
  unchanged**, because the control font stack starts with Windows-only Segoe UI. That is expected.
  Overwriting the reference to silence it is never the fix; confirm real changes with
  `npm run test:docker`.
- Every font a component names must exist in the pinned image. The image ships no Consolas, Monaco,
  Ubuntu Mono or DejaVu, and its generic `monospace` keyword matches three faces (WenQuanYi Zen Hei
  Mono, Liberation Mono, FreeMono) with **no stable winner** — `PropertiesEditor` hit exactly this
  and failed one CI run then passed the next on the same commit. End stacks on `Liberation Mono`,
  `Liberation Sans` or `FreeMono`.

### Screenshots capture a resting state

Playwright leaves the mouse where the previous action put it, and that position outlives the test
**and the test file**. A visual test that never touches the mouse inherits whatever pointer the
suite left behind; if the captured component sits under it, the reference is written in its
`:hover` paint and the capture still succeeds. That is how the `PageLayout` and `UserGuide`
references came to carry the `.page-nav a:hover` underline and flip between runs.

So: call `parkPointer()` (`test/helpers.ts`) before capturing a resting state; capture without
parking only in a test that is deliberately about `:hover`. A reference that changes between two
otherwise identical runs is this bug, not flaky rendering — find the pointer, don't re-record.

## Packaging

- `react` / `react-dom` are **peer** dependencies and must stay external. Nothing may bundle a
  second React copy into `dist/`.
- The `--sbb-*` design tokens live on the `.sbb-ui` / `.standard-admin-page` / `.modal__container` /
  `.form-wrapper` scopes, **not `:root`**. A component only renders styled under one of those
  ancestors, and tests wrap the render in `.sbb-ui`. A component that "looks unstyled" is usually
  just missing that scope — so a diff that reacts by moving tokens to `:root` is treating the
  symptom.

## Version lockstep

The `playwright` devDependency and the `container: mcr.microsoft.com/playwright:v<version>-noble`
tag in `ci.yml` / `release.yml` are the same number written twice, and the committed screenshots
were generated against it. `scripts/docker-test.mjs` derives its own tag from `node_modules`, so it
follows automatically — the workflows do not. Bumping one without the other turns the visual suite
red. `NODE_VERSION` in `release.yml` must likewise match the node inside that image.

## No shortcuts to green

Never silence a check: no `eslint-disable`, no `@ts-ignore`, no type weakened to `any`, no
overwritten visual reference, no skipped test, no lowered coverage threshold. Fix the cause or ask.

## Commits

Conventional Commits in English, `type: subject` with **no scope**. Imperative mood, lowercase first
letter, no trailing period, ≤ 50 characters. No issue/task references. No attribution trailers
(`Co-Authored-By`, "Generated with Claude Code").
