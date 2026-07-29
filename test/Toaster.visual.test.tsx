import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import Toaster from '../src/components/Toaster';
import { parkPointer } from './helpers';

// Visual-regression for the shared Toaster's rich-color styling (Docker-only, like the other RSP
// visual tests). Fires one toast of each severity and screenshots the sonner host, fixating that
// success is green, warning amber and error red - the whole reason this component is centralized.
// Rendered `expand`ed with a high visibleToasts so all three are fully shown in one shot.

let container: HTMLDivElement | undefined;
let root: Root | undefined;
let noAnim: HTMLStyleElement | undefined;

function teardown() {
  toast.dismiss();
  if (root) {
    flushSync(() => root!.unmount());
    root = undefined;
  }
  container?.remove();
  container = undefined;
  noAnim?.remove();
  noAnim = undefined;
}

afterEach(teardown);

function mountHost() {
  // Disable sonner's enter/stack transitions so the toasts jump straight to their resting state:
  // otherwise the animated (transform/opacity) element never stabilizes and `toMatchScreenshot`
  // times out with "Could not capture a stable screenshot".
  noAnim = document.createElement('style');
  noAnim.textContent =
    '[data-sonner-toaster], [data-sonner-toaster] * { transition: none !important; animation: none !important; }';
  document.head.appendChild(noAnim);

  container = document.createElement('div');
  container.className = 'sbb-ui';
  document.body.appendChild(container);
  root = createRoot(container);
  // Long duration so the toasts do not auto-dismiss (default 5s) during capture; `expand` shows the
  // stack fully so every colour is visible in one shot.
  flushSync(() => root!.render(<Toaster expand visibleToasts={5} duration={100000} />));
}

async function settled(count: number) {
  await vi.waitFor(() => expect(document.querySelectorAll('[data-sonner-toast]')).toHaveLength(count));
  // Small settle so sonner has finished measuring/positioning the expanded stack before capture.
  await new Promise((resolve) => setTimeout(resolve, 300));
}

// Screenshot the whole viewport (body), not the position:fixed sonner host: the host's bounding box is
// not stable enough for Playwright's screenshot actionability, but the body's is. The toasts sit
// top-center on an otherwise empty page.
const toastShot = async (name: string) => {
  await parkPointer();
  return expect(page.elementLocator(document.body)).toMatchScreenshot(name);
};

describe.skipIf(!__PIXEL_REFERENCES__)('Toaster visual', () => {
  it('rich colors (success / warning / error)', async () => {
    mountHost();

    toast.success('Data successfully saved.');
    toast.warning('Saved with warnings.');
    toast.error('Save failed.');

    await settled(3);
    await toastShot('toaster-rich-colors');
  });

  // The other two shapes an extension reaches for. `richColors` tints info blue, while a bare toast()
  // stays the neutral white card - so the two together fixate that only the severities get colour.
  it('neutral and info toasts', async () => {
    mountHost();

    toast('Nothing to import - the sheet is empty.');
    toast.info('The mapping is inherited from the global scope.');

    await settled(2);
    await toastShot('toaster-neutral-and-info');
  });
});
