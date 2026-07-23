# Testing react-sbb-polarion

Unified UI testing for the shared component library. One runner (**Vitest browser mode**, real
Chromium via the Playwright provider) covers two layers in the same test file:

- **Behavior** - interaction/DOM assertions (`click opens the portal`, `outside-click closes it`,
  `onChange fires`). Because tests run in a real browser, computed CSS and layout are real (unlike
  jsdom).
- **Visual regression** - `toMatchScreenshot(...)` captures a component's rendered look and pixel-diffs
  it against a committed reference PNG. This is the DOM equivalent of the pdf-exporter PDF→PNG
  reference approach.

## Layout

- `vitest.config.ts` - browser mode (`chromium`, headless), `test/setup.ts` as a setup file,
  `include: ['test/**/*.{test,spec}.{ts,tsx}']`, and the `toMatchScreenshot` path resolvers.
- `test/setup.ts` - imports the library's bundled control CSS (so components render with their real
  styling) and registers `@testing-library/jest-dom` matchers.
- `test/**/*.test.tsx` - the tests (not co-located in `src/`).
- `test/expected/<Component>/` - committed reference PNGs, grouped per component (folder derived from
  the test file name, e.g. `SearchableSelect`), one per screenshot, no platform suffix.
- `test/__diff__/`, `test/__screenshots__/` - transient mismatch-diff and failure artifacts, git-ignored.

## How to run

### First-time setup (once per machine)

```bash
npm install                    # installs the test toolchain (Vitest, provider, playwright, ...)
npx playwright install chromium  # downloads the Chromium the tests drive
```

Docker is required to (re)generate reference screenshots (see below); make sure Docker is installed
and running.

### Day-to-day (local)

```bash
npm test            # run the whole suite once (behavior + visual)
npm run test:watch  # watch mode while authoring a test
```

- On **Linux** these are authoritative - the visual assertions pixel-match the committed references.
- On **Windows/macOS** the **behavior** assertions are reliable, but the **visual** assertions will
  usually show a pixel diff even when nothing changed: the committed reference is a Linux screenshot
  and OS font antialiasing differs. That is expected - treat a local screenshot diff on Windows/macOS
  as "run it in Docker to confirm", not as a real regression. `npm test` does **not** modify
  references, so a local run can never corrupt them.

### Authoritative run / CI (Docker, Linux)

The pass/fail that gates CI is a run inside the pinned Playwright Docker image (Linux), matched to the
Playwright version in `package.json`. Use the alias - it works the same on Windows, macOS and Linux:

```bash
npm run test:docker    # CI-equivalent: run the suite in Docker against the committed references
```

Under the hood this runs `scripts/docker-test.mjs`, which spawns:

```bash
docker run --rm -v "<project>:/work" -v /work/node_modules -w /work \
  mcr.microsoft.com/playwright:v<playwright-version>-jammy \
  bash -c "npm ci && npm test"
```

The image tag is derived from the installed Playwright version, so it never drifts from
`package.json`. The anonymous volume on `/work/node_modules` shadows the host `node_modules`, so the
container's Linux `npm ci` does **not** overwrite a Windows/macOS dev's native binaries; screenshots
still write back through the main mount. (The wrapper spawns docker directly, avoiding the `${PWD}`
quoting differences between shells.)

## Reference screenshots - generate ONLY in Docker

There is a single committed reference per screenshot (no `-<browser>-<platform>` suffix), and it must
always be a **Linux** screenshot so it matches CI. To (re)generate references - after adding a visual
assertion or intentionally changing a component's look - run the Docker update alias:

```bash
npm run test:update:docker
```

(Same wrapper as `test:docker`, but it runs `npm run test:update` inside the container.) Then
**review the changed PNGs** in `test/expected/` before committing them.

- `npm run test:update` is **guarded**: it refuses to run off Linux (see `package.json`), so a
  Windows/macOS dev cannot accidentally overwrite a committed reference with mismatching pixels. Always
  update through Docker.
- References are grouped into a per-component folder (`test/expected/<Component>/`, from the test file
  name), so a screenshot name only needs to be unique within its component.
- When the Playwright version in `package.json` bumps, update the image tag in the commands above and
  regenerate all references in the new image.

## First run of a new visual assertion

`toMatchScreenshot` with no existing reference **creates** the reference and **fails** the run (by
design, to force review). Add the assertion, generate its reference in Docker (`test:update`), review
the PNG, commit it, and the assertion passes on subsequent runs.
