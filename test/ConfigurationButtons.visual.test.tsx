import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import ConfigurationButtons from '../src/components/ConfigurationButtons';

// Visual-regression states for the shared ConfigurationButtons toolbar. Kept separate from the behavior
// tests (Docker-only, since any toMatchScreenshot file diffs on non-Linux font antialiasing).
// References live in test/expected/ConfigurationButtons/ and MUST be generated in Docker
// (npm run test:update:docker). Rendered via createRoot + flushSync so the toolbar is committed
// synchronously before the screenshot. The host carries .sbb-ui so the sbb-btn control tokens resolve.
// We screenshot the .actions-pane gray bar (the full-width toolbar with the four buttons).

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

function renderToolbar({ withDefault = true }: { withDefault?: boolean } = {}) {
  teardown();
  container = document.createElement('div');
  // Mirror the app: body.sbb-ui carries the control tokens; a fixed width shows the full-width gray bar.
  container.className = 'sbb-ui';
  container.style.width = '900px';
  document.body.appendChild(container);
  root = createRoot(container);
  flushSync(() => {
    root!.render(
      <ConfigurationButtons
        onSave={() => {}}
        onCancel={() => {}}
        onRevertToDefault={withDefault ? () => {} : undefined}
        onToggleRevisions={() => {}}
      />,
    );
  });
}

const barShot = (name: string) =>
  expect(page.elementLocator(document.querySelector('.actions-pane') as HTMLElement)).toMatchScreenshot(name);

describe('ConfigurationButtons visual states', () => {
  it('default (gray bar, Save/Cancel/Default/Revisions control buttons)', async () => {
    renderToolbar();
    await barShot('configuration-buttons-default');
  });

  it('without the Default button (onRevertToDefault omitted, e.g. excel-importer Mappings)', async () => {
    renderToolbar({ withDefault: false });
    await barShot('configuration-buttons-no-default');
  });
});
