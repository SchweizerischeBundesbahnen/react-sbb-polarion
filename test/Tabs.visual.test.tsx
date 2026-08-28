import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import Tabs from '../src/components/Tabs';
import { settleBeforeCapture } from './helpers';

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

const THREE = [
  { id: 'first', label: 'First hook' },
  { id: 'second', label: 'Second hook' },
  { id: 'third', label: 'Third hook' },
];

function renderBar(opts: { activeId?: string; items?: typeof THREE } = {}) {
  // Read through `in` rather than a destructuring default: `{ activeId: undefined }` is the "no tab
  // selected" case and a default would silently swallow it back into the selected one.
  const activeId = 'activeId' in opts ? opts.activeId : 'second';
  const items = opts.items ?? THREE;
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
        <Tabs items={items} activeId={activeId} onSelect={() => {}} />
        <div style={{ border: '1px solid #c9c9c9', borderTop: 'none', padding: '16px' }}>Panel</div>
      </>,
    );
  });
}

/** Raw capture, pointer left wherever the test put it - for the hover state itself. */
const capture = (name: string) => expect(page.elementLocator(container as HTMLElement)).toMatchScreenshot(name);

/** Resting-state capture: parks the pointer first so an ambient mouse cannot bake a :hover tab in. */
const barShot = async (name: string) => {
  await settleBeforeCapture();
  return capture(name);
};

const tabLabel = (index: number) => document.querySelectorAll<HTMLElement>('.tab > label')[index];

describe.skipIf(!__PIXEL_REFERENCES__)('Tabs visual states', () => {
  it('active tab merges into the panel below', async () => {
    renderBar();
    await barShot('tabs-active');
  });

  it('nothing selected yet (no hook chosen)', async () => {
    renderBar({ activeId: undefined });
    await barShot('tabs-none-active');
  });

  // tabs.css gives the first tab a different left join (`.tab:not(:first-child)` adds the shared
  // border), so which end is active changes the drawing, not just the accent's position.
  it('first tab active - the left end of the bar', async () => {
    renderBar({ activeId: 'first' });
    await barShot('tabs-first-active');
  });

  it('last tab active - the right end of the bar', async () => {
    renderBar({ activeId: 'third' });
    await barShot('tabs-last-active');
  });

  // This is the JS-driven variant precisely so the tab count is not capped: generic's pure-CSS variant
  // stops at four because its :nth-of-type map is spelled out. Six tabs is the case that one cannot do.
  it('more tabs than the pure-CSS variant can address', async () => {
    renderBar({
      activeId: 'e',
      items: [
        { id: 'a', label: 'Import' },
        { id: 'b', label: 'Export' },
        { id: 'c', label: 'Validate' },
        { id: 'd', label: 'Publish' },
        { id: 'e', label: 'Archive' },
        { id: 'f', label: 'Audit' },
      ],
    });
    await barShot('tabs-many');
  });

  it('hover lifts an inactive tab', async () => {
    renderBar();
    await userEvent.hover(tabLabel(2));
    await capture('tabs-hover');
  });

  // The radios are visually hidden rather than removed, so the bar stays keyboard-reachable and the
  // ring is mirrored onto the tab. Tab-ing is required: :focus-visible does not match a scripted
  // .focus(). With nothing selected the focus lands on the first tab, so the ring shows on its own.
  it('keyboard focus ring on an unselected tab', async () => {
    renderBar({ activeId: undefined });
    await userEvent.tab();
    await barShot('tabs-focus');
  });

  it('keyboard focus ring on the active tab', async () => {
    renderBar();
    await userEvent.tab();
    await barShot('tabs-focus-active');
  });
});
