// Runs the test suite inside the pinned Playwright Docker image (Linux) so screenshots match CI -
// wrapping the long `docker run ...` command behind an npm script. Used by `test:docker` and
// `test:update:docker` (see package.json).
//
// Why a Node wrapper (not an npm-inline docker command): the bind-mount needs the absolute project
// path, and `${PWD}` is not portable across npm's shells (cmd.exe on Windows has no ${PWD}). Spawning
// docker directly with an argv array avoids all shell-quoting issues.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Which inner npm script to run in the container (default: test). E.g. "test" or "test:update".
const script = process.argv[2] || 'test';

// Pin the image to the installed Playwright version so the container's browser + system deps match the
// version references were authored with. (Ubuntu base: noble = 24.04, which is what Playwright
// publishes for current releases; bump alongside a Playwright bump if the base ever changes again.)
let playwrightVersion;
try {
  const pkg = JSON.parse(readFileSync(resolve(root, 'node_modules/playwright/package.json'), 'utf8'));
  playwrightVersion = pkg.version;
} catch {
  console.error('Cannot read node_modules/playwright - run `npm install` first.');
  process.exit(1);
}
const image = `mcr.microsoft.com/playwright:v${playwrightVersion}-noble`;

const args = [
  'run',
  '--rm',
  // Marks this run as THE reference environment for the pixel comparisons. The committed screenshots
  // are locked to this image, so the visual tests assert only when this is set (see vitest.config.ts);
  // anywhere else they skip instead of failing on the host's font metrics.
  '-e',
  'PIXEL_REFERENCES=1',
  // Mount the project; an anonymous volume shadows node_modules so the container's Linux `npm ci` does
  // not overwrite a Windows/macOS host's native binaries. Screenshots still write back via the mount.
  '-v',
  `${root}:/work`,
  '-v',
  '/work/node_modules',
  '-w',
  '/work',
  image,
  'bash',
  '-c',
  `npm ci && npm run ${script}`,
];

console.log(`> docker ${args.join(' ')}`);
const result = spawnSync('docker', args, { stdio: 'inherit' });
if (result.error) {
  console.error(`Failed to launch docker: ${result.error.message}. Is Docker installed and running?`);
  process.exit(1);
}
process.exit(result.status ?? 1);
