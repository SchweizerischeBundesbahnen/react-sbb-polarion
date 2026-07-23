import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Modal from '../src/components/Modal';
import { keydown } from './helpers';

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
const overlay = () => q<HTMLElement>('.rsp-modal-overlay');
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

  it('exposes dialog ARIA semantics', () => {
    openModal({ title: 'Paper size' });
    const d = dialog();
    expect(d.getAttribute('role')).toBe('dialog');
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(d.getAttribute('aria-label')).toBe('Paper size');
  });

  it('calls onCancel on Escape', () => {
    const { onCancel } = openModal();
    keydown(document.body, 'Escape');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel on an overlay click', () => {
    const { onCancel } = openModal();
    overlay().click();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does NOT close when the dialog body is clicked (click does not bubble to the overlay)', () => {
    const { onCancel } = openModal();
    dialog().click();
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
});
