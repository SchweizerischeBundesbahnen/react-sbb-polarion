import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import RevisionsTable from '../src/components/RevisionsTable';
import type { Revision } from '../src/types';

// Behavior tests for the shared RevisionsTable (screenshot-free, so they run on Windows and Docker
// alike). Appearance is covered in RevisionsTable.visual.test.tsx. Driven through the real component
// with an injected loadRevisions, asserting observable DOM.

const REVISIONS: Revision[] = [
  { name: '3388', date: '2026-07-01', author: 'alice', baseline: 'B-1', description: 'Initial' },
  { name: '3390', date: '2026-07-02', author: 'bob', baseline: '', description: 'Tweak sheet name' },
];

const q = <T extends Element>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`not found: ${sel}`);
  return el;
};
const rows = () => Array.from(document.querySelectorAll<HTMLTableRowElement>('.revisions-table tbody tr'));
const revertButtons = () => Array.from(document.querySelectorAll<HTMLButtonElement>('.revert-to-revision-button'));

async function waitForTable(): Promise<void> {
  await vi.waitFor(() => expect(document.querySelector('.revisions-table')).not.toBeNull());
}

afterEach(cleanup);

describe('RevisionsTable', () => {
  it('lists the revisions returned by loadRevisions, one row each', async () => {
    const loadRevisions = vi.fn().mockResolvedValue(REVISIONS);
    render(<RevisionsTable name="cfg" scope="" reloadToken={0} loadRevisions={loadRevisions} onRevert={() => {}} />);
    await vi.waitFor(() => expect(rows()).toHaveLength(2));
    expect(loadRevisions).toHaveBeenCalledWith('cfg', '');
    // Columns: revision number, baseline, date, author, comment, actions.
    const cells = Array.from(rows()[0].querySelectorAll('td')).map((td) => td.textContent?.trim());
    expect(cells).toEqual(['3 388', 'B-1', '2026-07-01', 'alice', 'Initial', '']);
  });

  it('groups a numeric revision number with spaces (3388 -> "3 388") and leaves non-numeric names as-is', async () => {
    const loadRevisions = vi
      .fn()
      .mockResolvedValue([
        { name: '3388' },
        { name: '12' },
        { name: '1234567' },
        { name: 'HEAD' },
      ] satisfies Revision[]);
    render(<RevisionsTable name="cfg" scope="" reloadToken={0} loadRevisions={loadRevisions} onRevert={() => {}} />);
    await vi.waitFor(() => expect(rows()).toHaveLength(4));
    const numbers = Array.from(document.querySelectorAll('.revision-number')).map((s) => s.textContent);
    expect(numbers).toEqual(['3 388', '12', '1 234 567', 'HEAD']);
  });

  it('shows the "No revisions." message when the list is empty', async () => {
    const loadRevisions = vi.fn().mockResolvedValue([]);
    render(<RevisionsTable name="cfg" scope="" reloadToken={0} loadRevisions={loadRevisions} onRevert={() => {}} />);
    await waitForTable();
    await vi.waitFor(() => expect(q('.empty-message').textContent?.trim()).toBe('No revisions.'));
    expect(rows()).toHaveLength(1);
  });

  it('shows an error banner (not the table) when loadRevisions rejects', async () => {
    const loadRevisions = vi.fn().mockRejectedValue(new Error('boom'));
    render(<RevisionsTable name="cfg" scope="" reloadToken={0} loadRevisions={loadRevisions} onRevert={() => {}} />);
    await vi.waitFor(() => expect(document.querySelector('.alert-error')).not.toBeNull());
    expect(q('.alert-error').textContent).toContain('Could not load revisions.');
    expect(document.querySelector('.revisions-table')).toBeNull();
  });

  it('fires onRevert with the clicked row when its revert button is pressed', async () => {
    const loadRevisions = vi.fn().mockResolvedValue(REVISIONS);
    const onRevert = vi.fn();
    render(<RevisionsTable name="cfg" scope="" reloadToken={0} loadRevisions={loadRevisions} onRevert={onRevert} />);
    await vi.waitFor(() => expect(revertButtons()).toHaveLength(2));
    revertButtons()[1].click();
    expect(onRevert).toHaveBeenCalledTimes(1);
    expect(onRevert).toHaveBeenCalledWith(REVISIONS[1]);
  });

  it('does not call loadRevisions and renders no rows when name is empty', async () => {
    const loadRevisions = vi.fn().mockResolvedValue(REVISIONS);
    render(<RevisionsTable name="" scope="" reloadToken={0} loadRevisions={loadRevisions} onRevert={() => {}} />);
    await waitForTable();
    expect(loadRevisions).not.toHaveBeenCalled();
    // The table renders with only the empty-state row.
    await vi.waitFor(() => expect(q('.empty-message')).toBeInTheDocument());
  });

  it('re-fetches when reloadToken changes', async () => {
    const loadRevisions = vi.fn().mockResolvedValue(REVISIONS);
    // A host that bumps reloadToken on click - exercises the real "reloadToken prop changes" path
    // (render() returns a Promise in browser mode, so we avoid destructuring a rerender off it).
    function Host() {
      const [token, setToken] = useState(0);
      return (
        <div>
          <button type="button" data-testid="bump" onClick={() => setToken((t) => t + 1)}>
            reload
          </button>
          <RevisionsTable name="cfg" scope="s1" reloadToken={token} loadRevisions={loadRevisions} onRevert={() => {}} />
        </div>
      );
    }
    render(<Host />);
    await vi.waitFor(() => expect(loadRevisions).toHaveBeenCalledTimes(1));
    q<HTMLButtonElement>('[data-testid="bump"]').click();
    await vi.waitFor(() => expect(loadRevisions).toHaveBeenCalledTimes(2));
  });

  // Both settle paths are guarded by the effect's `cancelled` flag. Closing the revisions toggle (or
  // leaving the page) while a slow list request is in flight must not push rows or an error banner
  // into a table that is no longer mounted.
  it('ignores a revision list that resolves after unmount', async () => {
    let settle!: (items: Revision[]) => void;
    const loadRevisions = vi.fn(() => new Promise<Revision[]>((resolve) => (settle = resolve)));
    render(<RevisionsTable name="cfg" scope="s1" reloadToken={0} loadRevisions={loadRevisions} onRevert={() => {}} />);
    await waitForTable();

    cleanup();
    settle(REVISIONS);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelector('.revisions-table')).toBeNull();
    expect(document.body.textContent).not.toContain('3 388');
  });

  it('ignores a failed revision list that rejects after unmount', async () => {
    let fail!: (reason: Error) => void;
    const loadRevisions = vi.fn(() => new Promise<Revision[]>((_resolve, reject) => (fail = reject)));
    render(<RevisionsTable name="cfg" scope="s1" reloadToken={0} loadRevisions={loadRevisions} onRevert={() => {}} />);
    await waitForTable();

    cleanup();
    fail(new Error('boom'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelector('.alert-error')).toBeNull();
  });
});
