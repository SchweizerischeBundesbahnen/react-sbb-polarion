import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Toaster from '../src/components/Toaster';

// Behavior tests for the shared Toaster (screenshot-free; the colored look is covered in
// Toaster.visual.test.tsx). The component is a thin wrapper over sonner's Toaster preconfigured with
// the standard SBB style, so these assert that the host mounts with that config and that a fired toast
// renders through it. Rendered via createRoot + flushSync, matching the other RSP behavior tests.

let container: HTMLDivElement | undefined;
let root: Root | undefined;

function teardown() {
  toast.dismiss();
  if (root) {
    flushSync(() => root!.unmount());
    root = undefined;
  }
  container?.remove();
  container = undefined;
}

afterEach(teardown);

function mount(props: Record<string, unknown> = {}) {
  teardown();
  container = document.createElement('div');
  container.className = 'sbb-ui';
  document.body.appendChild(container);
  root = createRoot(container);
  flushSync(() => root!.render(<Toaster {...props} />));
}

const host = () => document.querySelector('[data-sonner-toaster]');

const firstToast = () => document.querySelector('[data-sonner-toast]');

describe('Toaster', () => {
  it('mounts the sonner host at the standard SBB position (top-center)', async () => {
    mount();
    // The sonner host `<ol data-sonner-toaster>` renders after mount/first toast, not synchronously.
    toast.success('hello');
    await vi.waitFor(() => expect(host()).not.toBeNull());
    // Position is carried on the toaster host `<ol>`.
    expect(host()!.getAttribute('data-y-position')).toBe('top');
    expect(host()!.getAttribute('data-x-position')).toBe('center');
  });

  it('applies richColors so a fired toast carries its severity styling', async () => {
    mount();
    toast.success('Data successfully saved.');
    await vi.waitFor(() => expect(firstToast()).not.toBeNull());
    expect(document.body.textContent).toContain('Data successfully saved.');
    // richColors + the severity are carried on each toast `<li>` (not the host).
    expect(firstToast()!.getAttribute('data-type')).toBe('success');
    expect(firstToast()!.getAttribute('data-rich-colors')).toBe('true');
  });

  it('lets a caller override a default prop (position)', async () => {
    mount({ position: 'bottom-right' });
    toast.message('somewhere else');
    await vi.waitFor(() => expect(host()).not.toBeNull());
    expect(host()!.getAttribute('data-y-position')).toBe('bottom');
    expect(host()!.getAttribute('data-x-position')).toBe('right');
  });
});
