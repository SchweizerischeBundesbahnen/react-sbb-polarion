import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import RevisionsTable from '../src/components/RevisionsTable';
import type { Revision } from '../src/types';
import { parkPointer } from './helpers';

// Visual-regression states for the shared RevisionsTable. Kept separate from the behavior tests
// (Docker-only, since any toMatchScreenshot file diffs on non-Linux font antialiasing). References
// live in test/expected/RevisionsTable/ and MUST be generated in Docker (npm run test:update:docker).
//
// The component loads its rows asynchronously via the injected loadRevisions, so each state renders
// the real component with a resolved mock and waits for the rows before capturing. We screenshot the
// in-flow `.revisions-expand-container` (not a fixed-position element), which captures cleanly.

const REVISIONS: Revision[] = [
  { name: '3388', date: '2026-07-01', author: 'alice', baseline: 'B-1', description: 'Initial mapping' },
  { name: '3390', date: '2026-07-02', author: 'bob', baseline: '', description: 'Tweak sheet name' },
  { name: '3401', date: '2026-07-05', author: 'carol', baseline: 'Release 6.1', description: 'Add link column' },
];

const host = (testid: string): HTMLDivElement => {
  const h = document.createElement('div');
  // .sbb-ui defines the --sbb-* tokens (revert icon); a fixed width mirrors the Mappings page column.
  h.className = 'sbb-ui visual-host';
  h.setAttribute('data-testid', testid);
  h.style.width = '720px';
  h.style.padding = '16px';
  document.body.appendChild(h);
  return h;
};

// A long value with spaces (wraps within its cell on the spaces) and a long hyphenated identifier with
// no spaces (wraps at its hyphens, since hyphens are soft break opportunities). Used by the long-value
// states below.
const LONG_WORDS =
  'This is a deliberately long comment value that keeps going well past the width of its column so it exercises how the cell wraps its text across several lines inside the fixed-width table.';
const LONG_TOKEN = 'a-very-long-hyphenated-identifier-value-with-no-spaces-0123456789-abcdefghijklmnopqrstuvwxyz';

async function renderTable(container: HTMLElement, revisions: Revision[]): Promise<void> {
  render(
    <RevisionsTable
      name="cfg"
      scope=""
      reloadToken={0}
      loadRevisions={vi.fn().mockResolvedValue(revisions)}
      onRevert={() => {}}
    />,
    { container },
  );
  await vi.waitFor(() => expect(container.querySelector('.revisions-table')).not.toBeNull());
  if (revisions.length > 0) {
    await vi.waitFor(() =>
      expect(container.querySelectorAll('.revisions-table tbody tr').length).toBe(revisions.length),
    );
  } else {
    await vi.waitFor(() => expect(container.querySelector('.empty-message')).not.toBeNull());
  }
}

const shot = async (container: HTMLElement, name: string) => {
  await parkPointer();
  return expect(
    page.elementLocator(container.querySelector('.revisions-expand-container') as HTMLElement),
  ).toMatchScreenshot(name);
};

afterEach(() => {
  cleanup();
  document.querySelectorAll('.visual-host').forEach((el) => el.remove());
});

describe.skipIf(!__PIXEL_REFERENCES__)('RevisionsTable visual states', () => {
  it('populated (zebra rows, revert icons)', async () => {
    const h = host('populated');
    await renderTable(h, REVISIONS);
    await shot(h, 'revisions-populated');
  });

  it('empty ("No revisions.")', async () => {
    const h = host('empty');
    await renderTable(h, []);
    await shot(h, 'revisions-empty');
  });
});

// Long-value states in their own group (like the SearchableSelect long-value group): the table has no
// `table-layout: fixed` and no truncation, so a long value wraps within its cell (a hyphenated token
// wraps at its hyphens, plain text wraps on its spaces) and the column grows to the widest line rather
// than the row overflowing horizontally. These references fixate that current wrapping behavior on
// purpose - a future ellipsis/nowrap would flip them and force review. Each case keeps one short row
// above the long one so the effect on the column width (and on the neighbouring short row) is visible.
describe.skipIf(!__PIXEL_REFERENCES__)('RevisionsTable visual states - long values', () => {
  it('long Baseline name (hyphenated identifier wraps at its hyphens)', async () => {
    const h = host('long-baseline');
    await renderTable(h, [
      { name: '3388', date: '2026-07-01', author: 'alice', baseline: 'B-1', description: 'Initial mapping' },
      { name: '3390', date: '2026-07-02', author: 'bob', baseline: LONG_TOKEN, description: 'Rename baseline' },
    ]);
    await shot(h, 'revisions-long-baseline');
  });

  it('long Author (hyphenated identifier wraps at its hyphens)', async () => {
    const h = host('long-author');
    await renderTable(h, [
      { name: '3388', date: '2026-07-01', author: 'alice', baseline: 'B-1', description: 'Initial mapping' },
      { name: '3390', date: '2026-07-02', author: LONG_TOKEN, baseline: '', description: 'Long author' },
    ]);
    await shot(h, 'revisions-long-author');
  });

  it('long Comment (text with spaces wraps within the cell)', async () => {
    const h = host('long-comment');
    await renderTable(h, [
      { name: '3388', date: '2026-07-01', author: 'alice', baseline: 'B-1', description: 'Initial mapping' },
      { name: '3390', date: '2026-07-02', author: 'bob', baseline: '', description: LONG_WORDS },
    ]);
    await shot(h, 'revisions-long-comment');
  });
});
