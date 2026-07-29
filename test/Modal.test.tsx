import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import Modal from '../src/components/Modal';

// Behavior tests for the shared Modal (screenshot-free, so they run on Windows and Docker alike).
// Appearance is covered in Modal.visual.test.tsx.
//
// We render with React's own createRoot + flushSync rather than vitest-browser-react's render(): in
// browser mode the latter commits asynchronously with timing that is hard to await reliably here, while
// flushSync commits synchronously so every assertion below can run right after the render.

const q = <T extends Element>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`not found: ${sel}`);
  return el;
};
const dialog = () => q<HTMLElement>('.rsp-modal');
const closeBtn = () => q<HTMLButtonElement>('.rsp-modal-close');
const cancelBtn = () => q<HTMLButtonElement>('.rsp-modal-footer .sbb-btn--secondary');
const okBtn = () => q<HTMLButtonElement>('.rsp-modal-footer .sbb-btn--primary');

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

function openModal(
  overrides: {
    open?: boolean;
    title?: string;
    okText?: string;
    cancelText?: string;
    okDisabled?: boolean;
    children?: ReactNode;
  } = {},
) {
  teardown();
  const onOk = vi.fn();
  const onCancel = vi.fn();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  flushSync(() => {
    root!.render(
      <Modal
        open={overrides.open ?? true}
        title={overrides.title ?? 'Dialog title'}
        okText={overrides.okText}
        cancelText={overrides.cancelText}
        okDisabled={overrides.okDisabled}
        onOk={onOk}
        onCancel={onCancel}
      >
        {overrides.children ?? <p>Body content</p>}
      </Modal>,
    );
  });
  return { onOk, onCancel };
}

describe('Modal', () => {
  it('renders nothing when open is false', () => {
    openModal({ open: false });
    expect(document.querySelector('.rsp-modal')).toBeNull();
  });

  it('renders the title, content and footer buttons when open', () => {
    openModal({ title: 'Export', children: <p data-testid="body">Hello</p> });
    expect(q('.rsp-modal-title').textContent).toBe('Export');
    expect(document.querySelector('[data-testid="body"]')).not.toBeNull();
    expect(cancelBtn()).toBeInTheDocument();
    expect(okBtn()).toBeInTheDocument();
  });

  it('uses default button labels (Cancel / Accept) and honors custom ones', () => {
    openModal();
    expect(cancelBtn().textContent).toBe('Cancel');
    expect(okBtn().textContent).toBe('Accept');
    openModal({ okText: 'Export', cancelText: 'Close' });
    expect(cancelBtn().textContent).toBe('Close');
    expect(okBtn().textContent).toBe('Export');
  });

  // The dialog role and aria-modal are implicit in a <dialog> shown with showModal(), so they are not
  // present as attributes - asserting on them would only re-test redundant ARIA we deliberately do not
  // write. What matters is that it really is a modal dialog element, open, and named by its title.
  it('exposes dialog semantics natively', () => {
    openModal({ title: 'Paper size' });
    const d = dialog() as HTMLDialogElement;
    expect(d.tagName).toBe('DIALOG');
    expect(d.open).toBe(true);
    expect(d.getAttribute('aria-label')).toBe('Paper size');
  });

  // A real key press, not a synthetic keydown: Escape on a modal <dialog> is handled by the browser,
  // which fires `cancel` on the element. Dispatching a KeyboardEvent by hand would not produce it.
  it('calls onCancel on Escape', async () => {
    const { onCancel } = openModal();
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  // `closedby="any"` makes the browser treat a click outside the box as a close request, so this needs
  // a real pointer at real coordinates - the backdrop is a pseudo-element and cannot be dispatched at.
  // The target sits in a corner the dialog never covers; `force` is needed because the backdrop is in
  // the top layer and would fail the actionability check.
  it('calls onCancel when the backdrop is clicked', async () => {
    const { onCancel } = openModal();
    const corner = document.createElement('div');
    corner.style.cssText = 'position:fixed;left:0;top:0;width:4px;height:4px;';
    document.body.appendChild(corner);
    try {
      await userEvent.click(corner, { force: true });
    } finally {
      corner.remove();
    }
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does NOT close when the content inside the dialog is clicked', async () => {
    const { onCancel } = openModal();
    await userEvent.click(q<HTMLElement>('.rsp-modal-content'));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('calls onCancel from the close (x) button and the Cancel button', () => {
    const { onCancel } = openModal();
    closeBtn().click();
    expect(onCancel).toHaveBeenCalledTimes(1);
    cancelBtn().click();
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('calls onOk (and does not cancel) from the OK button', () => {
    const { onOk, onCancel } = openModal({ okText: 'Export' });
    okBtn().click();
    expect(onOk).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('disables the OK button and does not fire onOk when okDisabled', () => {
    const { onOk } = openModal({ okDisabled: true });
    expect(okBtn().disabled).toBe(true);
    okBtn().click();
    expect(onOk).not.toHaveBeenCalled();
  });

  // Only a close request dismisses the dialog. Enter and Space are in this list precisely because
  // focus rests on the dialog itself rather than on the close button the focusing steps would have
  // picked - so neither activates anything, which is the point of focusing the container.
  it('ignores keys other than Escape', async () => {
    const { onCancel } = openModal();
    await userEvent.keyboard('a{Enter}{ }{ArrowDown}{Tab}');
    expect(onCancel).not.toHaveBeenCalled();
  });
});
