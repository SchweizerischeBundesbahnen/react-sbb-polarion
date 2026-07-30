import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import StylePackageWeights from '../src/components/StylePackageWeights';
import type { StylePackageWeight, StylePackageWeightsService } from '../src/services/stylePackageWeights';
import { parkPointer } from './helpers';

// Visual-regression states for the weights list: the row look ported from generic's
// style-package-weights.css (drag handle, weight field with its spinner, reorder carets), the greyed
// read-only row a project scope inherits from global, and the accent line that marks where a dragged row
// would land. Docker-only - see ConfigurationButtons.visual.test.tsx. References live in
// test/expected/StylePackageWeights/ (npm run test:update:docker).

const WEIGHTS: StylePackageWeight[] = [
  { name: 'compact', scope: 'project/elibrary/', weight: 90 },
  { name: 'inherited-default', scope: '', weight: 60 },
  { name: 'verbose', scope: 'project/elibrary/', weight: 30 },
];

const origUrl = window.location.pathname + window.location.search;
const setScope = (scope: string) => window.history.replaceState({}, '', `?scope=${encodeURIComponent(scope)}`);

const service = (weights: StylePackageWeight[]): StylePackageWeightsService => ({
  loadWeights: () => Promise.resolve(weights.map((w) => ({ ...w }))),
  saveWeights: () => Promise.resolve(),
});

const rows = (): HTMLLIElement[] => Array.from(document.querySelectorAll<HTMLLIElement>('.weight-item'));

/** Dispatches one drag event on a row, aimed at the given fraction of its height. */
function fireDrag(row: HTMLLIElement, type: 'dragstart' | 'dragover', atFraction: number) {
  const rect = row.getBoundingClientRect();
  row.dispatchEvent(
    new DragEvent(type, {
      bubbles: true,
      cancelable: true,
      clientY: rect.top + rect.height * atFraction,
      dataTransfer: new DataTransfer(),
    }),
  );
}

let container: HTMLDivElement | undefined;

async function mount(weights = WEIGHTS) {
  container = document.createElement('div');
  // Both classes, for the reason spelled out in AuthorizationSettings.visual.test.tsx: .sbb-ui declares
  // the --sbb-* tokens this list's border, hover tint and drop-edge accent all read, and
  // .standard-admin-page is the scope the generic control CSS keys its own rules to. Without them the
  // rows screenshot unstyled - which is exactly the trap the repo's CLAUDE.md warns about.
  container.className = 'sbb-ui standard-admin-page';
  container.style.width = '700px';
  container.style.background = '#fff';
  document.body.appendChild(container);
  render(<StylePackageWeights title="PDF Exporter: Style Package Weights" service={service(weights)} />, {
    container,
  });
  await vi.waitFor(() => expect(document.querySelectorAll('.weight-item')).toHaveLength(weights.length));
}

afterEach(() => {
  cleanup();
  container?.remove();
  container = undefined;
  window.history.replaceState({}, '', origUrl);
});

/**
 * Waits out the row's `background-color` / `box-shadow` transitions (120ms and 80ms) and the frame after
 * them.
 *
 * The drag state needs this to be a reference at all rather than a coin flip: `.dragging` is
 * `opacity: 0.4`, which promotes the row to its own compositing layer, and Chromium renders text with
 * subpixel antialiasing before that promotion and grayscale after it. Capturing mid-promotion produced a
 * reference with colored glyph fringes that the next run redrew in gray - 567 pixels' worth of "failure"
 * on unchanged code.
 */
const settlePaint = () => new Promise<void>((resolve) => setTimeout(() => requestAnimationFrame(() => resolve()), 250));

const listShot = (name: string) =>
  parkPointer()
    .then(settlePaint)
    .then(() =>
      expect(page.elementLocator(document.querySelector('.weights-list') as HTMLElement)).toMatchScreenshot(name),
    );

describe.skipIf(!__PIXEL_REFERENCES__)('StylePackageWeights visual states', () => {
  it('a project scope: own rows movable, the global one locked', async () => {
    setScope('project/elibrary/');
    await mount();
    await listShot('style-package-weights-project-scope');
  });

  it('the global scope, where every row is movable', async () => {
    setScope('');
    await mount();
    await listShot('style-package-weights-global-scope');
  });

  it('mid-drag: the dragged row faded, the drop edge marked', async () => {
    setScope('');
    await mount();

    fireDrag(rows()[0], 'dragstart', 0.5);
    await vi.waitFor(() => expect(rows()[0].classList.contains('dragging')).toBe(true));
    fireDrag(rows()[2], 'dragover', 0.75);
    await vi.waitFor(() => expect(rows()[2].classList.contains('drop-below')).toBe(true));

    await listShot('style-package-weights-dragging');
  });

  it('a single row, where both reorder carets are disabled', async () => {
    setScope('');
    await mount([{ name: 'only-one', scope: '', weight: 50 }]);
    await listShot('style-package-weights-single-row');
  });
});
