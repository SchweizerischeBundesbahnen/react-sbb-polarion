import { useState } from 'react';
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import useConfirm from '../src/hooks/useConfirm';
import type { ConfirmOptions } from '../src/hooks/useConfirm';

// The promise-based confirm dialog: what it resolves to, and the cases a plain component would not
// have - a second question asked while one is open, and a page that goes away with one pending.
// Both would otherwise leave a caller awaiting forever.

let container: HTMLDivElement | undefined;
let root: Root | undefined;

function teardown() {
  if (root) {
    flushSync(() => root!.unmount());
    root = undefined;
  }
  container?.remove();
  container = undefined;
}

afterEach(teardown);

const dialog = () => document.querySelector('.rsp-modal');
const footerButton = (label: string): HTMLButtonElement => {
  const found = Array.from(document.querySelectorAll<HTMLButtonElement>('.rsp-modal-footer .sbb-btn')).find(
    (b) => (b.textContent ?? '').trim() === label,
  );
  if (!found) throw new Error(`dialog button not found: ${label}`);
  return found;
};

/** Renders a host that exposes `ask` so a test can drive the hook from outside. */
function renderHost() {
  const api: { ask?: (message: string, options?: ConfirmOptions) => Promise<boolean> } = {};

  function Host() {
    const { confirm, confirmDialog } = useConfirm();
    const [, force] = useState(0);
    api.ask = (message, options) => {
      const promise = confirm(message, options);
      force((n) => n + 1);
      return promise;
    };
    return <div className="sbb-ui">{confirmDialog}</div>;
  }

  teardown();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  flushSync(() => root!.render(<Host />));
  return api as { ask: (message: string, options?: ConfirmOptions) => Promise<boolean> };
}

describe('useConfirm', () => {
  it('renders nothing until a question is asked', () => {
    renderHost();
    expect(dialog()).toBeNull();
  });

  it('resolves true when confirmed, and closes', async () => {
    const host = renderHost();
    const answer = host.ask('Delete it?');
    await vi.waitFor(() => expect(dialog()).not.toBeNull());
    expect(document.querySelector('.rsp-confirm-message')!.textContent).toBe('Delete it?');

    footerButton('OK').click();

    await expect(answer).resolves.toBe(true);
    await vi.waitFor(() => expect(dialog()).toBeNull());
  });

  it('resolves false when cancelled', async () => {
    const host = renderHost();
    const answer = host.ask('Delete it?');
    await vi.waitFor(() => expect(dialog()).not.toBeNull());

    footerButton('Cancel').click();

    await expect(answer).resolves.toBe(false);
  });

  it('resolves false on Escape', async () => {
    const host = renderHost();
    const answer = host.ask('Delete it?');
    await vi.waitFor(() => expect(dialog()).not.toBeNull());

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    await expect(answer).resolves.toBe(false);
  });

  it('uses the given title and button labels, and defaults otherwise', async () => {
    const host = renderHost();
    host.ask('Delete it?', { title: 'Delete mapping', okText: 'Delete', cancelText: 'Keep' });
    await vi.waitFor(() => expect(dialog()).not.toBeNull());

    expect(document.querySelector('.rsp-modal-title')!.textContent).toBe('Delete mapping');
    expect(footerButton('Delete')).toBeTruthy();
    expect(footerButton('Keep')).toBeTruthy();

    footerButton('Delete').click();
    host.ask('And this one?');
    await vi.waitFor(() => expect(document.querySelector('.rsp-modal-title')!.textContent).toBe('Confirm'));
    expect(footerButton('OK')).toBeTruthy();
    expect(footerButton('Cancel')).toBeTruthy();
  });

  it('answers a question no when a second one replaces it', async () => {
    const host = renderHost();
    const first = host.ask('First?');
    await vi.waitFor(() => expect(dialog()).not.toBeNull());

    const second = host.ask('Second?');

    await expect(first).resolves.toBe(false);
    await vi.waitFor(() => expect(document.querySelector('.rsp-confirm-message')!.textContent).toBe('Second?'));

    footerButton('OK').click();
    await expect(second).resolves.toBe(true);
  });

  it('answers a pending question no when the page goes away', async () => {
    const host = renderHost();
    const answer = host.ask('Still there?');
    await vi.waitFor(() => expect(dialog()).not.toBeNull());

    teardown();

    await expect(answer).resolves.toBe(false);
  });
});
