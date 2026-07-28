import { useState } from 'react';
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import useConfirm from '../src/hooks/useConfirm';
import type { ConfirmOptions } from '../src/hooks/useConfirm';

// Docker-only look of the confirm dialog - the replacement for the browser's own `window.confirm`,
// which cannot be styled at all. References live in test/expected/useConfirm.

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

function ask(message: string, options?: ConfirmOptions) {
  const api: { ask?: () => void } = {};
  function Host() {
    const { confirm, confirmDialog } = useConfirm();
    const [, force] = useState(0);
    api.ask = () => {
      void confirm(message, options);
      force((n) => n + 1);
    };
    return <>{confirmDialog}</>;
  }
  teardown();
  container = document.createElement('div');
  // Mirror the app: body.sbb-ui carries the control tokens the footer buttons read.
  container.className = 'sbb-ui';
  document.body.appendChild(container);
  root = createRoot(container);
  flushSync(() => root!.render(<Host />));
  flushSync(() => api.ask!());
}

const dialogShot = (name: string) =>
  expect(page.elementLocator(document.querySelector('.rsp-modal') as HTMLElement)).toMatchScreenshot(name);

describe.skipIf(!__PIXEL_REFERENCES__)('useConfirm visual', () => {
  it('default question (Confirm / OK / Cancel)', async () => {
    ask('Are you sure you want to return the default value?');
    await vi.waitFor(() => expect(document.querySelector('.rsp-modal')).not.toBeNull());
    await dialogShot('confirm-default');
  });

  it('with an action-specific title and button label', async () => {
    ask('Are you sure you want to delete this mapping?', { title: 'Delete mapping', okText: 'Delete' });
    await vi.waitFor(() => expect(document.querySelector('.rsp-modal')).not.toBeNull());
    await dialogShot('confirm-delete');
  });
});
