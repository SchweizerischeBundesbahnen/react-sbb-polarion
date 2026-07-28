import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import Tabs from '../src/components/Tabs';

// Visual-regression states for the shared tab bar. Kept separate from the behavior tests (Docker-only,
// since any toMatchScreenshot file diffs on non-Linux font antialiasing). References live in
// test/expected/Tabs/ and MUST be generated in Docker (npm run test:update:docker).
//
// The active tab is the whole point of the stylesheet: a teal top accent, a white fill, and a bottom
// edge that cuts the bar's baseline so the tab reads as one surface with the panel below. A bar alone
// cannot show that, so a panel is rendered under it.

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

function renderBar({ activeId }: { activeId?: string } = { activeId: 'second' }) {
  teardown();
  container = document.createElement('div');
  // Mirror the app: .sbb-ui carries the control tokens the tab colours resolve against.
  container.className = 'sbb-ui';
  container.style.width = '520px';
  container.style.padding = '12px';
  container.style.background = '#fff';
  document.body.appendChild(container);
  root = createRoot(container);
  flushSync(() => {
    root!.render(
      <>
        <Tabs
          items={[
            { id: 'first', label: 'First hook' },
            { id: 'second', label: 'Second hook' },
            { id: 'third', label: 'Third hook' },
          ]}
          activeId={activeId}
          onSelect={() => {}}
        />
        <div style={{ border: '1px solid #c9c9c9', borderTop: 'none', padding: '16px' }}>Panel</div>
      </>,
    );
  });
}

const barShot = (name: string) => expect(page.elementLocator(container as HTMLElement)).toMatchScreenshot(name);

describe.skipIf(!__PIXEL_REFERENCES__)('Tabs visual states', () => {
  it('active tab merges into the panel below', async () => {
    renderBar();
    await barShot('tabs-active');
  });

  it('nothing selected yet (no hook chosen)', async () => {
    renderBar({ activeId: undefined });
    await barShot('tabs-none-active');
  });
});
