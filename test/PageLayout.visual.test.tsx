import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import PageLayout from '../src/components/PageLayout';
import { parkPointer } from './helpers';

// Visual-regression states for the shared page frame. Kept separate from the behavior tests
// (Docker-only, since any toMatchScreenshot file diffs on non-Linux font antialiasing). References live
// in test/expected/PageLayout/ and MUST be generated in Docker (npm run test:update:docker).
//
// The frame is three decisions: whether the "Overview" back link is there (it is hidden exactly when
// Polarion embeds the page), whether an admin <h1> with its underline is drawn, and the body spacing
// underneath. Each capture below isolates one of those.

const origUrl = window.location.pathname + window.location.search;

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

afterEach(() => {
  teardown();
  window.history.replaceState({}, '', origUrl);
});

/** PageLayout reads the mode straight off the query string, so the URL is the fixture here. */
function renderPage({ title, search }: { title?: string; search: string }) {
  teardown();
  window.history.replaceState({}, '', search);
  container = document.createElement('div');
  container.className = 'sbb-ui standard-admin-page';
  container.style.width = '760px';
  container.style.background = '#fff';
  document.body.appendChild(container);
  root = createRoot(container);
  flushSync(() => {
    root!.render(
      <PageLayout title={title}>
        <p>Body content sits in the page body, under the heading rule.</p>
      </PageLayout>,
    );
  });
}

const shot = async (name: string) => {
  await parkPointer();
  return expect(page.elementLocator(container as HTMLElement)).toMatchScreenshot(name);
};

describe.skipIf(!__PIXEL_REFERENCES__)('PageLayout visual states', () => {
  it('admin page: back link above the underlined heading', async () => {
    renderPage({ title: 'Repair Authorization', search: '?scope=project%2Felibrary%2F' });
    await shot('page-with-title');
  });

  it('embedded by Polarion: heading only, no way back out', async () => {
    renderPage({ title: 'Repair Authorization', search: '?embedded=true' });
    await shot('page-embedded');
  });

  it('product surface: back link but no admin heading', async () => {
    renderPage({ search: '?' });
    await shot('page-without-title');
  });
});
