import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import Toaster from '../src/components/Toaster';

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

describe.skipIf(!__PIXEL_REFERENCES__)('Toaster visual', () => {
  it('rich colors (success / warning / error)', async () => {
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
    // Long duration so the toasts do not auto-dismiss (default 5s) during capture; `expand` shows all
    // three fully stacked so every severity color is visible in one shot.
    flushSync(() => root!.render(<Toaster expand visibleToasts={5} duration={100000} />));

    toast.success('Data successfully saved.');
    toast.warning('Saved with warnings.');
    toast.error('Save failed.');

    await vi.waitFor(() => expect(document.querySelectorAll('[data-sonner-toast]').length).toBe(3));
    // Small settle so sonner has finished measuring/positioning the expanded stack before capture.
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Screenshot the whole viewport (body), not the position:fixed sonner host: the host's bounding box
    // is not stable enough for Playwright's screenshot actionability, but the body's is. The toasts sit
    // top-center on an otherwise empty page.
    await expect(page.elementLocator(document.body)).toMatchScreenshot('toaster-rich-colors');
  });
});
